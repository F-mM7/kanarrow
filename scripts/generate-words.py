#!/usr/bin/env python3
"""辞書から「1〜6文字の清音語」を抽出して src/data/words.ts を生成する。

出題は実行時に「単語リスト」と「答えごとのペア数テーブル」から組み立てる。
このスクリプトはその土台となる単語リストを作る。元の単語 A・答えの単語 B は
ともにこのリストに含まれる語に限定されるため、A の探索（接頭辞枝刈り）と
B の抽選の両方がこのリストを共有する。

入力:
    ippan.txt のような 1 行 1 語の辞書ファイル。引数で渡す（必須）。
    引数が無い場合や、指定されたファイルが存在しない場合は失敗する。

整形（出題に使う前処理）:
    - カタカナはひらがなへ変換する（「イス」→「いす」）。
    - 五十音表の清音 46 文字だけで構成される語に限定する。
      これにより濁音・半濁音・拗音・促音・長音符などを含む語は除外される。
    - 文字数は MIN_LEN〜MAX_LEN（1〜6）に限定する。

清音 46 文字の集合は、ゲーム本体と食い違わないよう src/data/grid.ts の
座標定義から読み取る。

出力:
    src/data/words.ts。WORDS_RAW（改行区切りの語）と WORDS（配列）を export する。

使い方:
    python3 scripts/generate-words.py <辞書ファイル> [出力先(.ts)]
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

ROOT = Path(__file__).resolve().parent.parent
GRID_TS = ROOT / "src" / "data" / "grid.ts"
DEFAULT_OUT = ROOT / "src" / "data" / "words.ts"

MIN_LEN = 1
MAX_LEN = 6


def parse_valid_kana(grid_src: str) -> frozenset[str]:
    """grid.ts の座標定義から、盤面に存在する清音かなの集合を取り出す。"""
    kana = {
        m.group(1)
        for m in re.finditer(
            r"(\S)\s*:\s*\{\s*row:\s*\d+\s*,\s*col:\s*\d+\s*\}", grid_src
        )
    }
    if not kana:
        raise RuntimeError("grid.ts の解析に失敗しました（フォーマット変更の可能性）")
    return frozenset(kana)


def to_hiragana(s: str) -> str:
    """カタカナ（ァ〜ヶ）をひらがなに変換する。長音符などはそのまま。"""
    return "".join(
        chr(code - 0x60) if 0x30A1 <= (code := ord(ch)) <= 0x30F6 else ch for ch in s
    )


def normalize(word: str, valid: frozenset[str]) -> str | None:
    """整形して 1〜6 文字の清音語なら返す。条件を外れるなら None。"""
    h = to_hiragana(word.strip())
    if MIN_LEN <= len(h) <= MAX_LEN and all(ch in valid for ch in h):
        return h
    return None


def load_source(path: Path) -> list[str]:
    if not path.is_file():
        sys.exit(f"辞書ファイルが見つかりません: {path}")
    text = path.read_text(encoding="utf-8")
    return [w.strip() for w in text.splitlines() if w.strip()]


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("使い方: python3 scripts/generate-words.py <辞書ファイル> [出力先(.ts)]")
    input_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT

    valid = parse_valid_kana(GRID_TS.read_text(encoding="utf-8"))

    raw = load_source(input_path)
    words = sorted({h for w in raw if (h := normalize(w, valid))})
    print(f"source words: {len(raw)} -> normalized & filtered: {len(words)}")

    by_len = {n: sum(1 for w in words if len(w) == n) for n in range(MIN_LEN, MAX_LEN + 1)}
    print("by length:", ", ".join(f"{n}:{c}" for n, c in by_len.items()))

    body = "\n".join(words)
    ts = (
        "// 自動生成ファイル。手で編集しないこと。\n"
        "// scripts/generate-words.py で dict/ippan.txt から再生成する。\n"
        "// 五十音表の清音 46 文字だけで構成される、1〜6 文字の語。\n"
        "\n"
        f"export const WORDS_RAW = `{body}`;\n"
        "\n"
        "export const WORDS: readonly string[] = WORDS_RAW.split('\\n');\n"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(ts, encoding="utf-8")
    print(f"wrote {out_path} ({len(words)} words, {len(ts.encode('utf-8'))} bytes)")


if __name__ == "__main__":
    main()
