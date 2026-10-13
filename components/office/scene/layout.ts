import type { TileColor } from './colorize'

// AI 사무실 배치 — 16px 타일, 가로 COLS × 세로 ROWS
//   0~1행: 뒷벽 (벽 그림은 1행 바닥에 붙여 위로 32px)
//   왼쪽 0~6열: 카페 라운지 (안내 데스크 = 비서, 커피 바, 소파) / 오른쪽 7열~: 업무 공간
// 가구는 발자국(footprint) 왼쪽 위 타일 기준, 그림은 발자국 아래쪽에 맞춰 위로 그림 (Pixel Agents 규칙)

export const TILE = 16
export const COLS = 20
export const ROWS = 13
export const WALL_ROW = 1 // 이 행까지 벽

export const FLOOR = {
  lounge: { src: '/office/floors/floor_6.png', color: { h: 26, s: 40, b: -6, c: -72 } as TileColor },
  office: { src: '/office/floors/floor_1.png', color: { h: 36, s: 24, b: 18, c: -78 } as TileColor },
}
export const WALL = { src: '/office/walls/wall_0.png', color: { h: 34, s: 28, b: -2, c: -25 } as TileColor }
export const LOUNGE_COLS = 7 // 0~6열 라운지

export type Furniture = {
  src: string
  col: number
  row: number
  fw: number // 발자국 가로 타일
  fh: number // 발자국 세로 타일
  bg?: number // 발자국 위쪽 몇 행이 지나갈 수 있는 배경인지
  onWall?: boolean // 벽에 거는 물건 (걸음 막지 않음)
  dy?: number // 그림 세로 보정(px) — 책상 위 물건 등
  z?: number // 그리기 순서 보정
}

const F = '/office/furniture'

// 책상(3×2) 하나 + 뒤에 의자 + 책상 위 모니터(뒷면) — 사람은 책상 뒤에 앉아 정면을 봄
// extras: 책상 위 소품 (col 기준 0~2칸)
function deskSet(col: number, row: number, extras: Furniture[] = []): Furniture[] {
  return [
    { src: `${F}/WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png`, col: col + 1, row: row - 2, fw: 1, fh: 2, bg: 1, dy: 8, z: -1 },
    { src: `${F}/DESK/DESK_FRONT.png`, col, row, fw: 3, fh: 2, bg: 0 },
    { src: `${F}/PC/PC_BACK.png`, col: col + 2, row, fw: 1, fh: 1, bg: 1, dy: 9, z: 1 },
    ...extras,
  ]
}
// 책상 그림의 윗면은 32px 중 11px부터 — 소품 바닥이 윗면 안쪽에 오도록 dy 보정 (커피잔 기준 10)
const onDesk = (src: string, col: number, row: number, dy = 10): Furniture => ({ src, col, row, fw: 1, fh: 1, bg: 1, dy, z: 1 })

export const FURNITURE: Furniture[] = [
  // ── 라운지 벽
  { src: `${F}/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png`, col: 0, row: 0, fw: 2, fh: 2, onWall: true },
  { src: `${F}/SMALL_PAINTING_2/SMALL_PAINTING_2.png`, col: 3, row: 0, fw: 1, fh: 2, onWall: true },
  { src: `${F}/HANGING_PLANT/HANGING_PLANT.png`, col: 5, row: 0, fw: 1, fh: 2, onWall: true },
  // ── 안내 데스크 (비서) + 커피 한 잔
  ...deskSet(2, 4, [onDesk(`${F}/COFFEE/COFFEE.png`, 2, 4)]),
  { src: `${F}/PLANT/PLANT.png`, col: 5, row: 3, fw: 1, fh: 2, bg: 1 },
  // ── 커피 바
  { src: `${F}/SMALL_TABLE/SMALL_TABLE_FRONT.png`, col: 0, row: 6, fw: 2, fh: 2, bg: 1 },
  { src: `${F}/COFFEE/COFFEE.png`, col: 0, row: 6, fw: 1, fh: 1, bg: 1, dy: 9, z: 1 },
  { src: `${F}/COFFEE/COFFEE.png`, col: 1, row: 6, fw: 1, fh: 1, bg: 1, dy: 9, z: 1 },
  // ── 소파 + 테이블
  { src: `${F}/SOFA/SOFA_FRONT.png`, col: 3, row: 8, fw: 2, fh: 1, bg: 0, z: -1 },
  { src: `${F}/COFFEE_TABLE/COFFEE_TABLE.png`, col: 3, row: 9, fw: 2, fh: 2 },
  { src: `${F}/CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK.png`, col: 5, row: 10, fw: 1, fh: 1 },
  { src: `${F}/LARGE_PLANT/LARGE_PLANT.png`, col: 0, row: 10, fw: 2, fh: 3, bg: 2 },
  { src: `${F}/POT/POT.png`, col: 6, row: 12, fw: 1, fh: 1 },

  // ── 업무 공간 벽
  { src: `${F}/WHITEBOARD/WHITEBOARD.png`, col: 9, row: 0, fw: 2, fh: 2, onWall: true },
  { src: `${F}/BOOKSHELF/BOOKSHELF.png`, col: 12, row: 1, fw: 2, fh: 1, onWall: true },
  { src: `${F}/LARGE_PAINTING/LARGE_PAINTING.png`, col: 15, row: 0, fw: 2, fh: 2, onWall: true },
  { src: `${F}/CLOCK/CLOCK.png`, col: 18, row: 0, fw: 1, fh: 2, onWall: true },
  { src: `${F}/SMALL_PAINTING/SMALL_PAINTING.png`, col: 7, row: 0, fw: 1, fh: 2, onWall: true },
  // ── 위 줄: 경영 → 마케팅
  ...deskSet(9, 4),
  ...deskSet(14, 4, [onDesk(`${F}/COFFEE/COFFEE.png`, 14, 4)]),
  { src: `${F}/PLANT_2/PLANT_2.png`, col: 12, row: 3, fw: 1, fh: 2, bg: 1 },
  // ── 아래 줄: 자금 관리 · 직원 관리 · 원가(빈자리)
  ...deskSet(8, 9),
  ...deskSet(12, 9),
  ...deskSet(16, 9, [onDesk(`${F}/POT/POT.png`, 16, 9, 2)]),
  // ── 장식
  { src: `${F}/PLANT/PLANT.png`, col: 19, row: 3, fw: 1, fh: 2, bg: 1 },
  { src: `${F}/CACTUS/CACTUS.png`, col: 7, row: 11, fw: 1, fh: 2, bg: 1 },
  { src: `${F}/BIN/BIN.png`, col: 11, row: 10, fw: 1, fh: 1 },
  { src: `${F}/BIN/BIN.png`, col: 19, row: 10, fw: 1, fh: 1 },
  { src: `${F}/PLANT_2/PLANT_2.png`, col: 19, row: 11, fw: 1, fh: 2, bg: 1 },
]

// AI별 자리 (책상 뒤 의자 칸) · 캐릭터 그림 · 클릭 영역(책상 주변)
export type Seat = { col: number; row: number; char: string; desk: { col: number; row: number; w: number; h: number } }

const seatOf = (deskCol: number, deskRow: number, char: string): Seat => ({
  col: deskCol + 1,
  row: deskRow - 1,
  char,
  desk: { col: deskCol, row: deskRow - 2, w: 3, h: 4 },
})

export const SEATS: Record<string, Seat> = {
  assistant: seatOf(2, 4, '/office/characters/char_4.png'),
  business: seatOf(9, 4, '/office/characters/char_0.png'),
  marketing: seatOf(14, 4, '/office/characters/char_1.png'),
  cashflow: seatOf(8, 9, '/office/characters/char_3.png'),
  attendance: seatOf(12, 9, '/office/characters/char_2.png'),
  cost: seatOf(16, 9, '/office/characters/char_5.png'), // 입사 전에는 빈자리
}

// 책상에 앉으면 이만큼 아래로 — 책상 윗면(그림 11px)이 다리를 가리고 머리·어깨가 보이게 (책상 뒤에 앉은 모습)
export const DESK_SIT_OFFSET = 16

// 라운지 쉬는 자리 — sit: 소파에 앉음(정면), 아니면 서 있음
export const REST_SPOTS: { col: number; row: number; sit: boolean; dir: 'down' | 'up' | 'right' | 'left' }[] = [
  { col: 3, row: 8, sit: true, dir: 'down' },
  { col: 4, row: 8, sit: true, dir: 'down' },
  { col: 2, row: 7, sit: false, dir: 'left' }, // 커피 바 앞
  { col: 5, row: 9, sit: false, dir: 'down' },
  { col: 3, row: 12, sit: false, dir: 'up' },
  { col: 5, row: 6, sit: false, dir: 'left' },
]

// 지나갈 수 있는 칸
export function buildWalkable(): boolean[][] {
  const grid = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, () => r > WALL_ROW))
  for (const f of FURNITURE) {
    if (f.onWall) continue
    for (let r = f.row + (f.bg ?? 0); r < f.row + f.fh; r++) {
      for (let c = f.col; c < f.col + f.fw; c++) if (grid[r]?.[c] !== undefined) grid[r][c] = false
    }
  }
  // 의자 칸·소파 자리는 앉는 곳이라 들어갈 수 있게
  for (const s of Object.values(SEATS)) grid[s.row][s.col] = true
  for (const s of REST_SPOTS) grid[s.row][s.col] = true
  return grid
}
