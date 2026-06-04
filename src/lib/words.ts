import { WORDS } from '../data/words';
import { generatePuzzle, type Puzzle } from './puzzle';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'mix';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'やさしい（3文字）',
  normal: 'ふつう（4文字）',
  hard: 'むずかしい（5〜6文字）',
  mix: 'おまかせ（3〜6文字）',
};

const matchesDifficulty = (word: string, difficulty: Difficulty): boolean => {
  switch (difficulty) {
    case 'easy':
      return word.length === 3;
    case 'normal':
      return word.length === 4;
    case 'hard':
      return word.length >= 5;
    case 'mix':
      return true;
  }
};

const POOLS: Record<Difficulty, readonly string[]> = {
  easy: WORDS.filter((w) => matchesDifficulty(w, 'easy')),
  normal: WORDS.filter((w) => matchesDifficulty(w, 'normal')),
  hard: WORDS.filter((w) => matchesDifficulty(w, 'hard')),
  mix: WORDS,
};

// 難易度に応じてランダムな単語で謎を生成する。直前の単語とは重複させない。
export function nextPuzzle(difficulty: Difficulty, previousAnswer?: string): Puzzle {
  const pool = POOLS[difficulty];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const word = pool[Math.floor(Math.random() * pool.length)];
    if (word === previousAnswer) continue;
    const puzzle = generatePuzzle(word);
    if (puzzle) return puzzle;
  }
  // 万一どれも生成できなかった場合のフォールバック（実質到達しない）
  return generatePuzzle(pool[0]) ?? { answer: pool[0], clues: [] };
}
