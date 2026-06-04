#!/usr/bin/env python3
"""清音のみの単語データ (src/data/words.ts) を生成する。

入力は F-mM7/word-data の japanese/ippan.txt。
ローカルファイルを渡すか、未指定なら gh CLI 経由で取得する（private リポジトリのため認証が必要）。

使い方:
    python3 scripts/generate-words.py [ippan.txt のパス]
"""
import subprocess
import sys
from pathlib import Path

SEION = set(
    "あいうえお"
    "かきくけこ"
    "さしすせそ"
    "たちつてと"
    "なにぬねの"
    "はひふへほ"
    "まみむめも"
    "やゆよ"
    "らりるれろ"
    "わをん"
)

MIN_LEN = 3
MAX_LEN = 6

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "words.ts"


def load_source() -> list[str]:
    if len(sys.argv) > 1:
        text = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        # private リポジトリなので認証済み gh API 経由で取得する
        text = subprocess.check_output(
            [
                "gh", "api",
                "repos/F-mM7/word-data/contents/japanese/ippan.txt",
                "-H", "Accept: application/vnd.github.raw",
            ],
            text=True,
        )
    return [w.strip() for w in text.splitlines() if w.strip()]


def main() -> None:
    words = load_source()
    selected = sorted(
        {w for w in words if MIN_LEN <= len(w) <= MAX_LEN and all(c in SEION for c in w)}
    )
    header = (
        "// 自動生成ファイル: scripts/generate-words.py で再生成すること（手動編集しない）\n"
        "// 出典: F-mM7/word-data japanese/ippan.txt から清音のみ・"
        f"長さ{MIN_LEN}〜{MAX_LEN}を抽出\n"
    )
    body = (
        "export const WORDS_RAW = `\n"
        + "\n".join(selected)
        + "\n`;\n\n"
        "export const WORDS: readonly string[] = WORDS_RAW.trim().split('\\n');\n"
    )
    OUT.write_text(header + body, encoding="utf-8")
    print(f"wrote {OUT} ({len(selected)} words)")


if __name__ == "__main__":
    main()
