import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { findHint, makeBoard } from './game';

const app = new Hono();

// 힌트 API: 서버 측 브루트포스 스캔 (클라이언트에서도 동일 로직 사용 가능)
app.post('/api/hint', async (c) => {
  let body: { board?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '잘못된 요청입니다.' }, 400);
  }
  const board = body?.board;
  if (!Array.isArray(board) || board.length !== 10 || !board.every((row) => Array.isArray(row) && row.length === 17)) {
    return c.json({ error: '보드 형식이 올바르지 않습니다.' }, 400);
  }
  const hint = findHint(board as number[][]);
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
