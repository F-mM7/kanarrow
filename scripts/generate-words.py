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
座標定義から読み取る。整形ルールと grid.ts の解析は _kana.py に集約している。

出力:
    src/data/words.ts。WORDS_RAW（改行区切りの語）と WORDS（配列）を export する。

使い方:
    python3 scripts/generate-words.py <辞書ファイル> [出力先(.ts)]
"""
import sys
from pathlib import Path

from _kana import GRID_TS, MAX_LEN, MIN_LEN, load_source, normalize, parse_grid

sys.stdout.reconfigure(line_buffering=True)

DEFAULT_OUT = GRID_TS.parent / "words.ts"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("使い方: python3 scripts/generate-words.py <辞書ファイル> [出力先(.ts)]")
    input_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT

    pos, _dirs, _rows, _cols = parse_grid()
    valid = frozenset(pos)

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
