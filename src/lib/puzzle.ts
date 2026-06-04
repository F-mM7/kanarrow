import { DIRECTIONS, GRID_COLS, GRID_ROWS, KANA_TO_POS, kanaAt } from '../data/grid';
import type { Direction } from '../data/grid';

// 1文字分のヒント: 「source の文字を direction 方向に dist マスずらすと target になる」。
// dist は五十音表上で動かすマス数（1以上、途中の空欄も1マスと数える）。
export interface Clue {
  source: string;
  direction: Direction;
  dist: number;
  target: string;
}

export interface Puzzle {
  answer: string;
  clues: Clue[];
}

// target の文字へ「1方向に dist マス（dist≥1、盤面の端まで）」で到達できる
// すべての (source, direction, dist) を逆算して返す。
//
// target の盤面位置から矢印の逆向きに dist マス戻ったマス（row - dr*dist,
// col - dc*dist）の文字が source。途中の空欄は通過し、盤外に出たらその方向は
// 打ち切る。同じ始点から方向×マス数の組は必ず別マスに着くため、source の文字は
// 互いに重複しない。
export function cluesForTarget(target: string): Clue[] {
  const pos = KANA_TO_POS[target];
  if (!pos) return [];
  const clues: Clue[] = [];
  for (const direction of DIRECTIONS) {
    for (let dist = 1; ; dist += 1) {
      const row = pos.row - direction.dr * dist;
      const col = pos.col - direction.dc * dist;
      if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) break;
      const source = kanaAt(row, col);
      if (source) clues.push({ source, direction, dist, target });
    }
  }
  return clues;
}
