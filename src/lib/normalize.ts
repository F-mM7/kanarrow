// 入力された答えを照合用に正規化する。
// - 全角/半角スペース・空白を除去
// - カタカナをひらがなへ変換（カナで打っても正解にする）
export function normalizeAnswer(input: string): string {
  return Array.from(input.trim())
    .filter((ch) => !/\s/.test(ch))
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      // カタカナ（ァ〜ヶ）→ ひらがな
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCodePoint(code - 0x60);
      }
      return ch;
    })
    .join('');
}

export function isCorrect(input: string, answer: string): boolean {
  return normalizeAnswer(input) === answer;
}
