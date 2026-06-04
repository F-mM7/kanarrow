import type { Direction } from '../data/grid';

// 1文字分のヒント: 「source の文字を direction 方向にずらすと target になる」
export interface Clue {
  source: string;
  direction: Direction;
  target: string;
}

export interface Puzzle {
  answer: string;
  clues: Clue[];
}
