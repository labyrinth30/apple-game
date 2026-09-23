/**
 * 사과게임 힌트 로직 (서버/클라이언트 공용, 순수 함수)
 *
 * 보드: rows x cols 2차원 배열, 값 1~9 (0 또는 null = 제거된 칸)
 */

export type Board = number[][];

export interface HintRect {
  r1: number; // 시작 행 (포함)
  c1: number; // 시작 열 (포함)
  r2: number; // 끝 행 (포함)
  c2: number; // 끝 열 (포함)
  cells: [number, number][]; // [row, col] 목록 (0-indexed)
}

export const ROWS = 17;
export const COLS = 10;

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
 * 브루트포스 힌트 탐색: 합이 정확히 10인 직사각형 하나를 찾는다.
 * O(rows^2 * cols^2) 영역 후보 × O(rows*cols) 합 계산이지만
 * 행/열 누적합으로 합 계산을 상수 시간으로 만든다.
 * 제거된 칸(0/null)은 합에서 제외되며, 제거된 칸을 포함한 영역은 후보에서 배제한다.
 */
export function findHint(board: Board, target = 10): HintRect | null {
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  if (rows === 0 || cols === 0) return null;

  // 2D 누적합 (prefix sum): sum[r2][c2] = (0,0)~(r2-1,c2-1) 합
  // validCount: 영역 내 유효(0이 아닌) 칸 수
  const sum: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
  const valid: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = board[r][c];
      const isVal = typeof v === 'number' && v > 0;
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
          // 영역 안에 살아있는 사과가 최소 1개 이상 있고, 그 합이 target이면 성립
          // (빈칸이 포함돼도 남은 사과 합만 정확히 10이면 유효)
          if (areaValid(r1, c1, r2, c2) === 0) continue;
          if (areaSum(r1, c1, r2, c2) === target) {
            const cells: [number, number][] = [];
            for (let r = r1; r <= r2; r++) {
              for (let c = c1; c <= c2; c++) {
                cells.push([r, c]);
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
