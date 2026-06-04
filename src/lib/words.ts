import { WORDS } from '../data/words';
import type { Clue } from './puzzle';

// 全辞書語の集合。元の単語 A が辞書語かどうかの判定に使う。
export const WORD_SET: ReadonlySet<string> = new Set(WORDS);

// 全辞書語のすべての接頭辞。元の単語の探索を枝刈りするのに使う。
// （端まで×8方向で各位置の候補が多くなるため、接頭辞で早めに打ち切る）
export const PREFIXES: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const word of WORDS) {
    for (let i = 1; i <= word.length; i += 1) set.add(word.slice(0, i));
  }
  return set;
})();

// 各位置の候補ヒント（cluesForTarget の結果）から、source を連結すると辞書語に
// なる組み合わせ（＝元の単語 A とそのヒント列）をすべて返す。各位置の source は
// 互いに異なるので、組み合わせと元の単語 A は1対1に対応する。返り値の件数は
// その答えのペア数 w(B) に一致するため、ここから一様に1つ選べばペアが一様になる。
export function findSourceClues(cluesByPosition: readonly Clue[][]): Clue[][] {
  const length = cluesByPosition.length;
  const results: Clue[][] = [];
  const current: Clue[] = [];

  const visit = (index: number, prefix: string): void => {
    if (index === length) {
      if (WORD_SET.has(prefix)) results.push(current.slice());
      return;
    }
    for (const clue of cluesByPosition[index]) {
      const next = prefix + clue.source;
      if (PREFIXES.has(next)) {
        current.push(clue);
        visit(index + 1, next);
        current.pop();
      }
    }
  };

  visit(0, '');
  return results;
}
