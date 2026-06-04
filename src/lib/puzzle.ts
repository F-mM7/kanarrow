import {
  DIRECTIONS,
  KANA_TO_POS,
  kanaAt,
  type Direction,
} from '../data/grid';

// 1文字分のヒント: 「source の文字を dir 方向にずらすと target になる」
export interface Clue {
  source: string;
  direction: Direction;
  target: string;
}

export interface Puzzle {
  answer: string;
  clues: Clue[];
}

// source を dir 方向に1マス動かした先の文字（盤外・空欄なら null）
export function resolveClue(source: string, direction: Direction): string | null {
  const pos = KANA_TO_POS[source];
  if (!pos) return null;
  return kanaAt(pos.row + direction.dr, pos.col + direction.dc);
}

// target にたどり着く (source, dir) の組をすべて列挙する。
// source は target から dir の逆向きに1マス戻った位置の文字。
function cluesForTarget(target: string): Clue[] {
  const pos = KANA_TO_POS[target];
  if (!pos) return [];
  const result: Clue[] = [];
  for (const direction of DIRECTIONS) {
    const source = kanaAt(pos.row - direction.dr, pos.col - direction.dc);
    if (source) {
      result.push({ source, direction, target });
    }
  }
  return result;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// 単語からヒント列を生成する。表現できない文字が混じっていれば null。
export function generatePuzzle(answer: string): Puzzle | null {
  const clues: Clue[] = [];
  for (const ch of answer) {
    const candidates = cluesForTarget(ch);
    if (candidates.length === 0) return null;
    clues.push(pickRandom(candidates));
  }
  return { answer, clues };
}
