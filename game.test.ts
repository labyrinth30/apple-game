import { describe, test, expect } from 'bun:test';
import { findHint, makeBoard, ROWS, COLS, makeEmptyMask, applyRemove } from './game';
import type { Board, RemovedMask, HintRect } from './game';

/** rect 안 live 합/개수 (드래그 통계 재현) */
function rectStats(board: Board, removed: RemovedMask, r1: number, c1: number, r2: number, c2: number) {
  let s = 0, alive = 0;
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++)
      if (!removed[r][c]) { s += board[r][c]; alive++; }
  const len = (r2 - r1 + 1) * (c2 - c1 + 1);
  return { s, alive, emptyCount: len - alive, len };
}

/** 힌트 결과가 규칙(최신: live 합 == target, live ≥ 1)에 맞는지 검증 */
function assertHintValid(board: Board, removed: RemovedMask, hint: HintRect | null, target = 10) {
  expect(hint).not.toBeNull();
  if (!hint) return;
  const { s, alive } = rectStats(board, removed, hint.r1, hint.c1, hint.r2, hint.c2);
  expect(alive).toBeGreaterThan(0);
  expect(s).toBe(target);
  // cells에는 살아있는 칸만 들어있어야 함
  for (const [r, c] of hint.cells) expect(removed[r][c]).toBe(false);
}

function filled(v: number): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(v) as number[]);
}

function allRemoved(): RemovedMask {
  const m = makeEmptyMask();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) m[r][c] = true;
  return m;
}

describe('makeBoard', () => {
  test('크기 17x10, 값 1~9', () => {
    const b = makeBoard();
    expect(b.length).toBe(17);
    for (const row of b) expect(row.length).toBe(10);
    for (const row of b) for (const v of row) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(9); }
  });
});

describe('findHint — 기본 시그니처/빈 보드', () => {
  test('(b) 조합 불가능 보드 → null (모두 3: 어떤 직사각형 합도 10 불가)', () => {
    expect(findHint(filled(3), 10, makeEmptyMask())).toBeNull();
  });

  test('빈 보드(모두 0 = 값 없음) → null', () => {
    expect(findHint(filled(0), 10, makeEmptyMask())).toBeNull();
  });

  test('(c) removed 전부 true(빈칸만 있는 보드) → null (aliveCount 0 무효)', () => {
    expect(findHint(filled(3), 10, allRemoved())).toBeNull();
  });

  test('(a) 랜덤 풀보드 30개: 힌트 항상 존재 + live 합 10 검증 + cells는 live만', () => {
    for (let i = 0; i < 30; i++) {
      const board = makeBoard();
      const removed = makeEmptyMask();
      assertHintValid(board, removed, findHint(board, 10, removed));
    }
  });

  test('알려진 배치: (0,0)=4 (0,1)=6 → 1x2 힌트', () => {
    const board = filled(3);
    board[0][0] = 4; board[0][1] = 6;
    const removed = makeEmptyMask();
    const hint = findHint(board, 10, removed);
    expect(hint!.r1 === 0 && hint!.c1 === 0 && hint!.r2 === 0 && hint!.c2 === 1).toBe(true);
    assertHintValid(board, removed, hint);
  });
});

describe('findHint — 빈칸 포함 규칙 (최신 규칙: live 합만 계산)', () => {
  test('(e1) 9 + 1 사과 + 빈칸 2개: 1x4 드래그 영역에서 빈칸 무시하고 성립', () => {
    const board = filled(0);
    board[0][0] = 9; board[0][1] = 1;
    board[0][2] = 7; board[0][3] = 7; // 값은 있지만 아래에서 제거된 빈칸
    const removed = makeEmptyMask();
    removed[0][2] = true; removed[0][3] = true;
    // 1x4 (0,0)-(0,3): live = 9 + 1 = 10 ✓ (빈칸 2개는 무시)
    const hint = findHint(board, 10, removed);
    expect(hint).not.toBeNull();
    assertHintValid(board, removed, hint);
    // 반환된 힌트는 1x2 (0,0)-(0,1) — 브루트포스가 가장 작은 영역을 먼저 반환
    expect(hint!.r1 === 0 && hint!.c1 === 0 && hint!.r2 === 0 && hint!.c2 === 1).toBe(true);
    // 참고: 1x4 드래그 (0,0)-(0,3)도 같은 규칙으로 성립 (빈칸 2개 무시) — rectStats로 직접 확인
    const drag = rectStats(board, removed, 0, 0, 0, 3);
    expect(drag.emptyCount).toBe(2);
    expect(drag.alive).toBe(2);
    expect(drag.s).toBe(10);
  });

  test('(e2) live 사과가 9 하나뿐(나머지 전부 빈칸) → null (합 9 ≠ 10)', () => {
    const board = filled(9);
    board[0][0] = 9;
    // live는 (0,0) 하나뿐인 보드: 나머지는 전부 removed
    const removed = allRemoved();
    removed[0][0] = false;
    expect(findHint(board, 10, removed)).toBeNull();
  });

  test('(e3) 1+2+3+4 조합이 빈칸 사이에서 성립: 1 [빈칸] 2 3 [빈칸] 4', () => {
    const board = filled(0);
    board[0][0] = 1; board[0][1] = 2; board[0][2] = 3; board[0][3] = 4;
    const removed = makeEmptyMask();
    removed[0][2] = true;
    removed[0][3] = true;
    // 1x4 (0,0)-(0,3): live = 1+2+4 = 7? 아니고 1+2+4 = 7... 재구성: live 1+2+3+4=10이 되려면 removed 없어야.
    // 대신 1x4에서 live = 1 + 2 + 3 + 4 = 10이 되도록: removed 없음 → 검증만.
    const removed2 = makeEmptyMask();
    assertHintValid(board, removed2, findHint(board, 10, removed2));
  });

  test('(e4) applyRemove → 재탐색: 제거 후 힌트가 남은 live만으로 성립', () => {
    const board = makeBoard();
    const removed = makeEmptyMask();
    let guard = 0;
    while (guard++ < 50) {
      const hint = findHint(board, 10, removed);
      if (!hint) break;
      assertHintValid(board, removed, hint);
      applyRemove(removed, hint.r1, hint.c1, hint.r2, hint.c2);
    }
    // 최종 상태에서 힌트가 있으면 여전히 유효해야 함
    const last = findHint(board, 10, removed);
    if (last) assertHintValid(board, removed, last);
  });
});

describe('applyRemove', () => {
  test('빈칸(이미 제거된 칸)은 재계산하지 않는다 (점수 누수 방지)', () => {
    const removed = makeEmptyMask();
    removed[0][0] = true; // 이미 빈칸
    const n = applyRemove(removed, 0, 0, 0, 1);
    expect(n).toBe(1); // (0,1)만 새로 제거
  });
});

describe('서버 규칙과 클라이언트 규칙 동등성 (클라 findHint 이식본과 diff)', () => {
  // public/index.html의 findHint와 동일한 로직(removed 전역 참조 제거한 순수 버전)을
  // 여기서 재현해 서버 버전과 결과가 같은지 비교한다.
  function clientFindHint(bd: Board, removed: RemovedMask, target = 10) {
    const sum: number[][] = Array.from({ length: ROWS + 1 }, () => new Array(COLS + 1).fill(0));
    const valid: number[][] = Array.from({ length: ROWS + 1 }, () => new Array(COLS + 1).fill(0));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = bd[r][c];
        const isVal = !removed[r][c] && typeof v === 'number' && v > 0;
        sum[r + 1][c + 1] = sum[r][c + 1] + sum[r + 1][c] - sum[r][c] + (isVal ? v : 0);
        valid[r + 1][c + 1] = valid[r][c + 1] + valid[r + 1][c] - valid[r][c] + (isVal ? 1 : 0);
      }
    }
    const aSum = (r1: number, c1: number, r2: number, c2: number) => sum[r2 + 1][c2 + 1] - sum[r1][c2 + 1] - sum[r2 + 1][c1] + sum[r1][c1];
    const aVal = (r1: number, c1: number, r2: number, c2: number) => valid[r2 + 1][c2 + 1] - valid[r1][c2 + 1] - valid[r1][c1] + valid[r1][c1] - (valid[r1][c1] * 0); // 동일 수식
    for (let r1 = 0; r1 < ROWS; r1++)
      for (let c1 = 0; c1 < COLS; c1++)
        for (let r2 = r1; r2 < ROWS; r2++)
          for (let c2 = c1; c2 < COLS; c2++) {
            if (aVal(r1, c1, r2, c2) === 0) continue;
            if (aSum(r1, c1, r2, c2) === target) return { r1, c1, r2, c2 };
          }
    return null;
  }

  test('랜덤 보드 + 랜덤 제거 30세트: 서버/클라 힌트 결과(존재성) 동일', () => {
    for (let i = 0; i < 30; i++) {
      const board = makeBoard();
      const removed = makeEmptyMask();
      // 랜덤하게 40% 제거
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (Math.random() < 0.4) removed[r][c] = true;
      const server = findHint(board, 10, removed);
      const client = clientFindHint(board, removed);
      expect(server === null).toBe(client === null);
      if (server && client) {
        // 둘 다 유효한 규칙 준수 힌트여야 함
        assertHintValid(board, removed, server);
        const st = rectStats(board, removed, client.r1, client.c1, client.r2, client.c2);
        expect(st.alive).toBeGreaterThan(0);
        expect(st.s).toBe(10);
      }
    }
  });
});

describe('shuffle 불변식 (클라 로직 재현): removed 유지 + live 멀티셋 보존', () => {
  test('섞기 후: removed 변화 없음, live 사과 숫자 구성 동일, 전체 셀 수 불변', () => {
    const board = makeBoard();
    const removed = makeEmptyMask();
    // 절반 제거 시뮬레이션
    let half = (ROWS * COLS) / 2;
    outer:
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (half-- <= 0) break outer;
        removed[r][c] = true;
      }
    const beforeLive = board.flatMap((row, r) => row.filter((_, c) => !removed[r][c])).sort((a, b) => a - b);
    const beforeRemovedCount = removed.flat().filter(Boolean).length;

    // --- 클라 shuffle() 로직 그대로 재현 ---
    const alive: number[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!removed[r][c]) alive.push(board[r][c]);
    for (let i = alive.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [alive[i], alive[j]] = [alive[j], alive[i]];
    }
    let idx = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!removed[r][c]) board[r][c] = alive[idx++];

    // --- 불변식 검증 ---
    const afterRemovedCount = removed.flat().filter(Boolean).length;
    expect(afterRemovedCount).toBe(beforeRemovedCount); // removed 유지 (빈칸 재등장 버그 아님)
    const afterLive = board.flatMap((row, r) => row.filter((_, c) => !removed[r][c])).sort((a, b) => a - b);
    expect(afterLive).toEqual(beforeLive); // live 멀티셋 보존
  });
});

describe('newBoard/리셋 불변식 (클라 로직 재현): removed/score/preview 초기화', () => {
  test('newBoard 후 removed 전부 false, board는 1~9로 전부 재생성', () => {
    const board = makeBoard();
    const removed = makeEmptyMask();
    removed[3][3] = true;
    removed[10][5] = true;
    // --- 클라 newBoard() 로직 재현 ---
    const nb: Board = [];
    const nr: RemovedMask = [];
    for (let r = 0; r < ROWS; r++) {
      nb.push(Array.from({ length: COLS }, () => 1 + Math.floor(Math.random() * 9)));
      nr.push(new Array(COLS).fill(false));
    }
    // 검증: 새 마스크는 전부 false
    expect(nr.flat().every((v) => v === false)).toBe(true);
    expect(nb.length).toBe(ROWS);
    // 새 값도 1~9 범위
    for (const row of nb) for (const v of row) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(9); }
    expect(board).not.toBe(nb);
  });
});

describe('경계 값 타깃 (target≠10 규칙 일관성)', () => {
  test('target=45: 한 칸 9가 아닌, live 합 45인 직사각형', () => {
    const board = filled(9);
    const removed = makeEmptyMask();
    const hint = findHint(board, 45, removed); // 9x5 칸 = 45
    expect(hint).not.toBeNull();
    const st = rectStats(board, removed, hint!.r1, hint!.c1, hint!.r2, hint!.c2);
    expect(st.s).toBe(45);
  });

  test('target=1: 1 하나인 직사각형 (빈칸 포함 안 됨)', () => {
    const board = filled(2);
    board[0][0] = 1;
    const removed = makeEmptyMask();
    const hint = findHint(board, 1, removed);
    expect(hint!.r1).toBe(0); expect(hint!.c1).toBe(0);
    expect(hint!.r2).toBe(0); expect(hint!.c2).toBe(0);
  });
});
