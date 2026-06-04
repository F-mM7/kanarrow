// 50音表（清音のみ）のグリッド定義。
//
// 画面上の配置（伝統的な右→左読み）:
//   左 ←─────────────────────────→ 右
//   ん わ ら や ま は な た さ か あ   ← row 0（あ段）
//      を ろ よ も ほ の と そ こ お   ← row 4（お段）
//         る ゆ む ふ ぬ つ す く う   ← row 2（う段）
//
// col: 0=ん 1=わ行 2=ら行 3=や行 4=ま行 5=は行 6=な行 7=た行 8=さ行 9=か行 10=あ行
// row: 0=あ段 1=い段 2=う段 3=え段 4=お段
//
// 矢印は「画面上の見たままの向き」。右(→)は col+1、下(↓)は row+1。
// 例) む(row2,col4) →右→ ふ(row2,col5) / き(row1,col9) →上→ か(row0,col9)

export interface Pos {
  row: number;
  col: number;
}

export const GRID_ROWS = 5;
export const GRID_COLS = 11;

export const KANA_TO_POS: Readonly<Record<string, Pos>> = {
  // あ行 (col=10)
  あ: { row: 0, col: 10 }, い: { row: 1, col: 10 }, う: { row: 2, col: 10 },
  え: { row: 3, col: 10 }, お: { row: 4, col: 10 },
  // か行 (col=9)
  か: { row: 0, col: 9 }, き: { row: 1, col: 9 }, く: { row: 2, col: 9 },
  け: { row: 3, col: 9 }, こ: { row: 4, col: 9 },
  // さ行 (col=8)
  さ: { row: 0, col: 8 }, し: { row: 1, col: 8 }, す: { row: 2, col: 8 },
  せ: { row: 3, col: 8 }, そ: { row: 4, col: 8 },
  // た行 (col=7)
  た: { row: 0, col: 7 }, ち: { row: 1, col: 7 }, つ: { row: 2, col: 7 },
  て: { row: 3, col: 7 }, と: { row: 4, col: 7 },
  // な行 (col=6)
  な: { row: 0, col: 6 }, に: { row: 1, col: 6 }, ぬ: { row: 2, col: 6 },
  ね: { row: 3, col: 6 }, の: { row: 4, col: 6 },
  // は行 (col=5)
  は: { row: 0, col: 5 }, ひ: { row: 1, col: 5 }, ふ: { row: 2, col: 5 },
  へ: { row: 3, col: 5 }, ほ: { row: 4, col: 5 },
  // ま行 (col=4)
  ま: { row: 0, col: 4 }, み: { row: 1, col: 4 }, む: { row: 2, col: 4 },
  め: { row: 3, col: 4 }, も: { row: 4, col: 4 },
  // や行 (col=3) ※い段・え段は空欄
  や: { row: 0, col: 3 }, ゆ: { row: 2, col: 3 }, よ: { row: 4, col: 3 },
  // ら行 (col=2)
  ら: { row: 0, col: 2 }, り: { row: 1, col: 2 }, る: { row: 2, col: 2 },
  れ: { row: 3, col: 2 }, ろ: { row: 4, col: 2 },
  // わ行 (col=1) ※あ段・お段のみ
  わ: { row: 0, col: 1 }, を: { row: 4, col: 1 },
  // ん (col=0)
  ん: { row: 0, col: 0 },
};

const posKey = (row: number, col: number): string => `${row}-${col}`;

export const POS_TO_KANA: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(KANA_TO_POS).map(([kana, { row, col }]) => [posKey(row, col), kana]),
);

export function kanaAt(row: number, col: number): string | null {
  return POS_TO_KANA[posKey(row, col)] ?? null;
}

export const VALID_POSITIONS: ReadonlySet<string> = new Set(Object.keys(POS_TO_KANA));

// 8方向の定義。dr/dc は画面座標（下方向が row+、右方向が col+）。
export type DirectionKey =
  | 'up' | 'down' | 'left' | 'right'
  | 'upLeft' | 'upRight' | 'downLeft' | 'downRight';

export interface Direction {
  key: DirectionKey;
  dr: number;
  dc: number;
  arrow: string;
  label: string;
}

export const DIRECTIONS: readonly Direction[] = [
  { key: 'up', dr: -1, dc: 0, arrow: '↑', label: '上' },
  { key: 'down', dr: 1, dc: 0, arrow: '↓', label: '下' },
  { key: 'left', dr: 0, dc: -1, arrow: '←', label: '左' },
  { key: 'right', dr: 0, dc: 1, arrow: '→', label: '右' },
  { key: 'upLeft', dr: -1, dc: -1, arrow: '↖', label: '左上' },
  { key: 'upRight', dr: -1, dc: 1, arrow: '↗', label: '右上' },
  { key: 'downLeft', dr: 1, dc: -1, arrow: '↙', label: '左下' },
  { key: 'downRight', dr: 1, dc: 1, arrow: '↘', label: '右下' },
];

// 矢印文字から方向を逆引きするマップ
export const DIRECTION_BY_ARROW: Readonly<Record<string, Direction>> =
  Object.fromEntries(DIRECTIONS.map((d) => [d.arrow, d]));
