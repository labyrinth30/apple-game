import { describe, test, expect } from 'bun:test';
import { findHint, makeBoard, ROWS, COLS } from './game';

function sumRect(board: number[][], r: number, c: number, h: number, w: number) {
  let s = 0;
  for (let i = r; i < r + h; i++) for (let j = c; j < c + w; j++) s += board[i][j];
  return s;
}

describe('findHint', () => {
  test('(a) 랜덤 보드 100개: 항상 합 10 직사각형을 찾는다', () => {
    let found = 0;
    for (let i = 0; i < 100; i++) {
      const board = makeBoard();
      const hint = findHint(board);
      expect(hint).not.toBeNull();
      if (!hint) continue;
      found++;
      const s = sumRect(board, hint.r1, hint.c1, hint.r2 - hint.r1 + 1, hint.c2 - hint.c1 + 1);
      expect(s).toBe(10);
      // 영역 내 모든 칸이 유효(제거 안 됨)한지 — 힌트는 cells를 반환하고 값이 1~9
      for (const [r, c] of hint.cells) {
        expect(board[r][c]).toBeGreaterThanOrEqual(1);
        expect(board[r][c]).toBeLessThanOrEqual(9);
      }
    }
    expect(found).toBe(100);
  });

  test('(b) 조합 불가능 보드: null 반환 (\'현재 가능한 조합이 없어요\' 분기)', () => {
    // 전체 합이 우연히 10인 직사각형을 갖지 않도록 조작: 모두 3으로 채움
    // 어떤 직사각형의 합 = 3×칸수이므로 10 불가능 (3,6,9,12,... 10은 3의 배수 아님)
    const board: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(3));
    expect(sumRect(board, 0, 0, ROWS, COLS)).not.toBeUndefined();
    const hint = findHint(board);
    expect(hint).toBeNull();
  });

  test('(b-2) 3 채움 보드 대신 서버 분기 메시지 확인용: 혼합 보드(3) + 단일 10 셀에 반응 안 함', () => {
    // 3 채움 + 어디에도 합 10 구간이 없는 보드 변형 (모두 3)
    const board: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(3));
    expect(findHint(board)).toBeNull();
  });

  test('빈 보드(null/제거된 칸만) → null', () => {
    const board: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    expect(findHint(board)).toBeNull();
  });

  test('알려진 배치를 정확히 찾는지', () => {
    // (0,0)=4, (0,1)=6 → 합 10인 1x2
    const board: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(3));
    board[0][0] = 4;
    board[0][1] = 6;
    const hint = findHint(board);
    expect(hint).not.toBeNull();
    expect(hint!.r1).toBe(0);
    expect(hint!.c1).toBe(0);
    expect(hint!.r2).toBe(0);
    expect(hint!.c2).toBe(1);
  });
});
