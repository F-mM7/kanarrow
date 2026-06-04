import puzzlesUrl from '../data/puzzles.json?url';
import { DIRECTION_BY_ARROW } from '../data/grid';
import type { Puzzle } from './puzzle';

// puzzles.json の1件。source/arrows/answer は同じ文字数で、
// source[i] を arrows[i] 方向にずらすと answer[i] になる。
interface PuzzleEntry {
  source: string;
  arrows: string;
  answer: string;
}

let entries: PuzzleEntry[] | null = null;
let loadPromise: Promise<void> | null = null;

async function fetchPuzzles(): Promise<void> {
  const res = await fetch(puzzlesUrl);
  if (!res.ok) {
    throw new Error(`問題データの読み込みに失敗しました (HTTP ${res.status})`);
  }
  entries = (await res.json()) as PuzzleEntry[];
}

// puzzles.json を取得してメモリに保持する（複数回呼んでも fetch は一度だけ）
export function loadPuzzles(): Promise<void> {
  if (!loadPromise) loadPromise = fetchPuzzles();
  return loadPromise;
}

function entryToPuzzle(entry: PuzzleEntry): Puzzle {
  const sources = [...entry.source];
  const arrows = [...entry.arrows];
  const targets = [...entry.answer];
  const clues = sources.map((source, i) => ({
    source,
    direction: DIRECTION_BY_ARROW[arrows[i]],
    target: targets[i],
  }));
  return { answer: entry.answer, clues };
}

// ランダムに1問を返す。直前の答えとは重複させない。
export function nextPuzzle(previousAnswer?: string): Puzzle {
  if (!entries || entries.length === 0) {
    throw new Error('問題データが読み込まれていません');
  }
  const pool = entries;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const entry = pool[Math.floor(Math.random() * pool.length)];
    if (entry.answer === previousAnswer) continue;
    return entryToPuzzle(entry);
  }
  return entryToPuzzle(pool[0]);
}
