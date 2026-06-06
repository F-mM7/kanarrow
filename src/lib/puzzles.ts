import { MAX_DIST } from '../data/grid';
import weightsRaw from '../data/answer-weights.json?raw';
import { cluesForTarget } from './puzzle';
import type { Clue, Puzzle } from './puzzle';
import { findSourceClues } from './words';

// answer-weights.json: { "<length>": { "<answer>": number[] } }
// 各配列は上限 1..M の累積ペア数 w_K（非減少、w_M = 端まで基準の総ペア数）。
// 上限 cap での w_cap(B) = arr[min(cap, M) - 1]。cap が最初の非ゼロ未満なら 0。
type WeightTable = Record<string, Record<string, number[]>>;
const WEIGHTS: WeightTable = JSON.parse(weightsRaw) as WeightTable;

// 出題できる文字数（ペアが存在する長さ）。実測で 1〜6。
export const LENGTHS: readonly number[] = Object.keys(WEIGHTS)
  .map(Number)
  .sort((a, b) => a - b);

// 矢印上限として選べる最大値（grid.ts で定義）。盤面の端から端まで動ける最大マス数。
export { MAX_DIST };

// 出題条件。文字数は [minLength, maxLength]、矢印（マス数）は maxDist 以下。
export interface PuzzleOptions {
  minLength?: number;
  maxLength?: number;
  maxDist?: number;
  previousAnswer?: string;
}

interface Entry {
  answer: string;
  cum: number[]; // 上限 1..M の累積ペア数
}

// 起動時に1度だけ構築する初期化済みデータ（fetch なし）。
interface InitData {
  entriesByLength: Map<number, Entry[]>;
  minCapByLength: Map<number, number>; // その長さで問題が存在する最小の上限
}

let init: InitData | null = null;

// 上限 cap での w_cap(B)。
function weightAt(cum: number[], cap: number): number {
  if (cum.length === 0) return 0;
  return cum[Math.min(cap, cum.length) - 1];
}

// 累積配列で最初に正になる上限（＝この答えが出せる最小の上限）。
function firstFeasibleCap(cum: number[]): number {
  for (let i = 0; i < cum.length; i += 1) if (cum[i] > 0) return i + 1;
  return MAX_DIST; // ペア数>0 の答えのみなので通常ここには来ない
}

function ensureInit(): InitData {
  if (init) return init;
  const entriesByLength = new Map<number, Entry[]>();
  const minCapByLength = new Map<number, number>();
  for (const len of LENGTHS) {
    const table = WEIGHTS[String(len)];
    const entries: Entry[] = [];
    let minCap = MAX_DIST;
    for (const answer of Object.keys(table)) {
      const cum = table[answer];
      entries.push({ answer, cum });
      const fc = firstFeasibleCap(cum);
      if (fc < minCap) minCap = fc;
    }
    entriesByLength.set(len, entries);
    minCapByLength.set(len, minCap);
  }
  init = { entriesByLength, minCapByLength };
  return init;
}

// 旧実装は puzzles.json を fetch していた。現在は import 済みデータから
// 同期的に初期化するだけなので、即座に解決する。
export function loadPuzzles(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ensureInit();
      resolve();
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

// 文字数範囲 [lo, hi] で問題が存在する最小の上限。
function minFeasibleCap(d: InitData, lo: number, hi: number): number {
  let m = MAX_DIST;
  for (const len of LENGTHS) {
    if (len < lo || len > hi) continue;
    const c = d.minCapByLength.get(len);
    if (c !== undefined && c < m) m = c;
  }
  return m;
}

// 指定の文字数範囲・希望上限で問題が無いとき、問題が存在する最小の上限まで
// 引き上げた実効上限を返す（auto-raise）。
export function feasibleMaxDist(
  minLength: number,
  maxLength: number,
  maxDist: number,
): number {
  const d = ensureInit();
  return Math.max(maxDist, minFeasibleCap(d, minLength, maxLength));
}

// 上限 cap・範囲 [lo, hi] の抽選プール。長さごとに w_cap>0 の答えだけを、
// その重み w_cap で集める。設定が変わらない限り作り直さない（単一キャッシュ）。
interface LengthPool {
  answers: string[];
  cumulative: number[];
  total: number;
}
interface PoolSet {
  pools: Map<number, LengthPool>;
  lengthChoices: number[];
  lengthCumulative: number[];
  grandTotal: number;
}
let poolKey = '';
let poolSet: PoolSet | null = null;

function getPool(d: InitData, lo: number, hi: number, cap: number): PoolSet {
  const key = `${lo}-${hi}-${cap}`;
  if (poolSet && poolKey === key) return poolSet;
  const pools = new Map<number, LengthPool>();
  const lengthChoices: number[] = [];
  const lengthCumulative: number[] = [];
  let grandTotal = 0;
  for (const len of LENGTHS) {
    if (len < lo || len > hi) continue;
    const entries = d.entriesByLength.get(len);
    if (!entries) continue;
    const answers: string[] = [];
    const cumulative: number[] = [];
    let sum = 0;
    for (const e of entries) {
      const w = weightAt(e.cum, cap);
      if (w > 0) {
        answers.push(e.answer);
        sum += w;
        cumulative.push(sum);
      }
    }
    if (sum > 0) {
      pools.set(len, { answers, cumulative, total: sum });
      grandTotal += sum;
      lengthChoices.push(len);
      lengthCumulative.push(grandTotal);
    }
  }
  poolSet = { pools, lengthChoices, lengthCumulative, grandTotal };
  poolKey = key;
  return poolSet;
}

// 累積和配列から重み付きで添字を1つ選ぶ（二分探索）。
function pickByWeight(cumulative: number[], total: number): number {
  const r = Math.random() * total;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r < cumulative[mid]) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

// 答え B の各文字の元候補（上限 cap 内）から、連結が辞書語になる元の単語 A を
// 一様に1つ選んでヒント列を作る。w_cap(B)>0 なら必ず1つ以上見つかる。
function buildClues(answer: string, cap: number): Clue[] | null {
  const sources = findSourceClues(
    [...answer].map((ch) => cluesForTarget(ch).filter((c) => c.dist <= cap)),
  );
  if (sources.length === 0) return null;
  return sources[Math.floor(Math.random() * sources.length)];
}

// 出題条件に合う問題を1つ返す。上限は問題が存在する値まで自動で引き上げる。
// 答え B を w_cap(B) に比例して抽選し、元の単語 A を一様に選ぶため、その条件で
// 出せる全ペアが等確率になる。previousAnswer と同じ答えはできるだけ避ける。
export function nextPuzzle(options: PuzzleOptions = {}): Puzzle {
  const d = ensureInit();
  const lo = options.minLength ?? LENGTHS[0];
  const hi = options.maxLength ?? LENGTHS[LENGTHS.length - 1];
  const cap = feasibleMaxDist(lo, hi, options.maxDist ?? MAX_DIST);
  const pool = getPool(d, lo, hi, cap);
  if (pool.grandTotal === 0) {
    throw new Error('指定の条件に合う問題が見つかりませんでした');
  }
  const { previousAnswer } = options;

  let last: Puzzle | null = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const len = pool.lengthChoices[pickByWeight(pool.lengthCumulative, pool.grandTotal)];
    const lp = pool.pools.get(len);
    if (!lp) continue;
    const answer = lp.answers[pickByWeight(lp.cumulative, lp.total)];
    const clues = buildClues(answer, cap);
    if (!clues) continue;
    last = { answer, clues };
    if (answer !== previousAnswer) return last;
  }
  if (last) return last; // 直前回避に失敗してもとにかく1問返す
  throw new Error('問題の生成に失敗しました');
}
