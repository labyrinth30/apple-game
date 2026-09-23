/**
 * 사과게임 힌트 로직 (서버/클라이언트 공용, 순수 함수)
 *
 * 보드: rows x cols 2차원 배열, 값 1~9
 * removed: 같은 크기 불리언 마스크, true = 제거된 빈칸 (값이 있어도 무시)
 *
 * 규칙(최신): 어떤 직사각형 안의 "살아있는(제거되지 않은) 사과" 합이
 * 정확히 target(10)이면 성립. 빈칸은 합/개수 계산에서 완전히 무시되며,
 * 영역 안에 살아있는 사과가 최소 1개 있어야 한다.
 */

export type Board = number[][];
export type RemovedMask = boolean[][];

export interface HintRect {
  r1: number; // 시작 행 (포함)
  c1: number; // 시작 열 (포함)
  r2: number; // 끝 행 (포함)
  c2: number; // 끝 열 (포함)
  cells: [number, number][]; // [row, col] 목록 (0-indexed)
}

export const ROWS = 17;
export const COLS = 10;

/** 모두 false(아무것도 제거되지 않음)인 removed 마스크 생성 */
export function makeEmptyMask(rows = ROWS, cols = COLS): RemovedMask {
  return Array.from({ length: rows }, () => new Array(cols).fill(false) as boolean[]);
}

/** rect 안의 모든 칸을 removed 처리 (제거 적용). 제거된 칸 수를 반환한다. */
export function applyRemove(removed: RemovedMask, r1: number, c1: number, r2: number, c2: number): number {
  let count = 0;
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (!removed[r][c]) { removed[r][c] = true; count++; }
    }
  }
  return count;
}

/** 랜덤 보드 생성: 1~9 숫자 */
export function makeBoard(rows = ROWS, cols = COLS, rng: () => number = Math.random): Board {
  const board: Board = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(1 + Math.floor(rng() * 9));
    }
    board.push(row);
  }
  return board;
}

/**
 * 브루트포스 힌트 탐색: "살아있는 사과 합 == target" 직사각형 하나를 찾는다.
 * 행/열 누적합으로 합 계산을 상수 시간으로 만든다.
 * 제거된 칸(removed=true)은 합과 valid 개수에서 제외된다.
 * 영역 안에 살아있는 사과가 최소 1개 있어야 유효하다(빈칸만 있는 영역 무효).
 */
export function findHint(board: Board, target = 10, removed?: RemovedMask): HintRect | null {
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  if (rows === 0 || cols === 0) return null;
  const mask = removed ?? makeEmptyMask(rows, cols);

  // 2D 누적합: sum[r2][c2] = (0,0)~(r2-1,c2-1) 합 / valid: 살아있는 칸 수
  const sum: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
  const valid: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = board[r][c];
      const isVal = !mask[r][c] && typeof v === 'number' && v > 0;
      sum[r + 1][c + 1] = sum[r][c + 1] + sum[r + 1][c] - sum[r][c] + (isVal ? v : 0);
      valid[r + 1][c + 1] = valid[r][c + 1] + valid[r + 1][c] - valid[r][c] + (isVal ? 1 : 0);
    }
  }

  const areaSum = (r1: number, c1: number, r2: number, c2: number) =>
    sum[r2 + 1][c2 + 1] - sum[r1][c2 + 1] - sum[r2 + 1][c1] + sum[r1][c1];
  const areaValid = (r1: number, c1: number, r2: number, c2: number) =>
    valid[r2 + 1][c2 + 1] - valid[r1][c2 + 1] - valid[r2 + 1][c1] + valid[r1][c1];

  for (let r1 = 0; r1 < rows; r1++) {
    for (let c1 = 0; c1 < cols; c1++) {
      for (let r2 = r1; r2 < rows; r2++) {
        for (let c2 = c1; c2 < cols; c2++) {
          // 살아있는 사과 최소 1개 + live 합이 정확히 target
          if (areaValid(r1, c1, r2, c2) === 0) continue;
          if (areaSum(r1, c1, r2, c2) === target) {
            const cells: [number, number][] = [];
            for (let r = r1; r <= r2; r++) {
              for (let c = c1; c <= c2; c++) {
                if (!mask[r][c]) cells.push([r, c]);
              }
            }
            return { r1, c1, r2, c2, cells };
          }
        }
      }
    }
  }
  return null;
}
