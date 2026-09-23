import { Hono } from 'hono';
import { serveStatic, getConnInfo } from 'hono/bun';
import type { MiddlewareHandler } from 'hono';
import { findHint, makeBoard, ROWS, COLS } from './game';

const app = new Hono();

/* ---------- 간단한 슬라이딩 윈도우 rate limiter (의존성 없음) ----------
 * /api/hint는 보드 전체 브루트포스(O(rows^2 × cols^2))라 남용 시 CPU 낭비 가능.
 * IP당 분당 max회로 제한하고 초과 시 429 + Retry-After 반환.
 * IP 결정: nginx가 X-Real-IP를 실제 remote_addr로 덮어써 줌(클라 위조 불가, 신뢰).
 * nginx 우회 직접 접속 시에는 TCP 연결 정보를 사용. 둘 다 없으면 'unknown' 공유 버킷.
 */
interface LimiterOpts {
  max?: number;       // 윈도우 내 허용 요청 수
  windowMs?: number;  // 윈도우 길이 (ms)
}
const MAX_TRACKED_IPS = 10_000;

export function createRateLimiter({ max = 30, windowMs = 60_000 }: LimiterOpts = {}): MiddlewareHandler {
  const hits = new Map<string, number[]>();
  return async (c, next) => {
    let ip: string;
    const real = c.req.header('x-real-ip');
    if (real) ip = real;
    else {
      try { ip = getConnInfo(c).remote.address || 'unknown'; }
      catch { ip = 'unknown'; }
    }

    const now = Date.now();
    let arr = hits.get(ip);
    if (!arr) {
      // 메모리 상한: 유니크 IP 폭주 시 전체 리셋 (개인 서비스에 충분한 안전판)
      if (hits.size >= MAX_TRACKED_IPS) hits.clear();
      arr = [];
      hits.set(ip, arr);
    }
    while (arr.length && now - arr[0] >= windowMs) arr.shift();
    if (arr.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - arr[0])) / 1000));
      return c.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        429,
        { 'Retry-After': String(retryAfter) }
      );
    }
    arr.push(now);
    await next();
  };
}

const hintLimiter = createRateLimiter();

// 힌트 API: 서버 측 브루트포스 스캔 (클라이언트와 동일 규칙: live 사과 합 == 10, 빈칸 무시, live ≥ 1)
// 남용 방지: IP당 분당 30회 제한
app.post('/api/hint', hintLimiter, async (c) => {
  let body: { board?: unknown; removed?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '잘못된 요청입니다.' }, 400);
  }
  const board = body?.board;
  if (!Array.isArray(board) || board.length !== ROWS || !board.every((row) => Array.isArray(row) && row.length === COLS)) {
    return c.json({ error: '보드 형식이 올바르지 않습니다.' }, 400);
  }
  // removed(빈칸 마스크)는 선택: 형식이 일치하면 적용, 아니면 전부 살아있는 것으로 간주
  let removed: boolean[][] | undefined;
  const rm = body?.removed;
  if (Array.isArray(rm) && rm.length === ROWS && rm.every((row) => Array.isArray(row) && row.length === COLS && row.every((v) => typeof v === 'boolean'))) {
    removed = rm as boolean[][];
  }
  const hint = findHint(board as number[][], 10, removed);
  if (!hint) {
    return c.json({ found: false, message: '현재 가능한 조합이 없어요' });
  }
  return c.json({ found: true, hint });
});

// 새 보드 API (다시 시작에 사용 가능)
app.get('/api/board', (c) => {
  return c.json({ board: makeBoard() });
});

app.use('/*', serveStatic({ root: './public' }));
app.get('/', serveStatic({ path: './public/index.html' }));

const port = Number(process.env.PORT ?? 3100);
console.log(`🍎 사과게임 서버 시작: http://localhost:${port}`);
export default { port, fetch: app.fetch };
