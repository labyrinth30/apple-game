import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { findHint, makeBoard, ROWS, COLS } from './game';

const app = new Hono();

// 힌트 API: 서버 측 브루트포스 스캔 (클라이언트와 동일 규칙: live 사과 합 == 10, 빈칸 무시, live ≥ 1)
app.post('/api/hint', async (c) => {
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
