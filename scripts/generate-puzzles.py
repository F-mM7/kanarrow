#!/usr/bin/env python3
"""向き付きの問題リストを生成する。

各問題は「元の単語 source の各文字を、対応する矢印の向きに五十音表で 1 マス動かすと
答え answer になる」という関係を表す。source と answer の両方が整形後の辞書に
含まれるものだけを、向き付き（source -> answer）で列挙する。

入力:
    ippan.txt のような 1 行 1 語の辞書ファイル。引数で渡す（必須）。
    引数が無い場合や、指定されたファイルが存在しない場合は失敗する。

整形（出題に使う前処理）:
    - カタカナはひらがなへ変換する（「イス」→「いす」）。
    - 五十音表の清音 46 文字だけで構成される語に限定する。
      これにより濁音・半濁音・拗音・促音・長音符などを含む語は除外される。
    - 文字数の制限は設けない。

盤面（文字の座標）と矢印（向き）の定義は、ゲーム本体と食い違わないよう
src/data/grid.ts から読み取る。

使い方:
    python3 scripts/generate-puzzles.py <辞書ファイル> [出力先(.json)]
"""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

ROOT = Path(__file__).resolve().parent.parent
GRID_TS = ROOT / "src" / "data" / "grid.ts"
DEFAULT_OUT = ROOT / "src" / "data" / "puzzles.json"


def parse_grid(grid_src: str) -> tuple[dict[str, tuple[int, int]], list[tuple[int, int, str]]]:
    """grid.ts から かな→座標 と 向き(dr,dc,矢印) を取り出す。"""
    pos: dict[str, tuple[int, int]] = {}
    for m in re.finditer(r"(\S)\s*:\s*\{\s*row:\s*(\d+)\s*,\s*col:\s*(\d+)\s*\}", grid_src):
        pos[m.group(1)] = (int(m.group(2)), int(m.group(3)))

    dirs: list[tuple[int, int, str]] = []
    for m in re.finditer(
        r"\{\s*key:\s*'[^']+',\s*dr:\s*(-?\d+),\s*dc:\s*(-?\d+),\s*arrow:\s*'([^']+)'",
        grid_src,
    ):
        dirs.append((int(m.group(1)), int(m.group(2)), m.group(3)))

    if not pos or not dirs:
        raise RuntimeError("grid.ts の解析に失敗しました（フォーマット変更の可能性）")
    return pos, dirs


def to_hiragana(s: str) -> str:
    """カタカナ（ァ〜ヶ）をひらがなに変換する。長音符などはそのまま。"""
    return "".join(
        chr(code - 0x60) if 0x30A1 <= (code := ord(ch)) <= 0x30F6 else ch for ch in s
    )


def normalize(word: str, valid: frozenset[str]) -> str | None:
    """整形して清音のみの語なら返す。表現できない文字を含むなら None。"""
    h = to_hiragana(word.strip())
    if h and all(ch in valid for ch in h):
        return h
    return None


def load_source(path: Path) -> list[str]:
    if not path.is_file():
        sys.exit(f"辞書ファイルが見つかりません: {path}")
    text = path.read_text(encoding="utf-8")
    return [w.strip() for w in text.splitlines() if w.strip()]


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("使い方: python3 scripts/generate-puzzles.py <辞書ファイル> [出力先(.json)]")
    input_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT

    pos, dirs = parse_grid(GRID_TS.read_text(encoding="utf-8"))
    valid = frozenset(pos)
    pos_to_kana = {rc: kana for kana, rc in pos.items()}

    # 各かなから 1 マス動かせる先（隣接かな）と、その向きの矢印。
    neighbors: dict[str, list[tuple[str, str]]] = {}
    for kana, (r, c) in pos.items():
        moves: list[tuple[str, str]] = []
        for dr, dc, arrow in dirs:
            target = pos_to_kana.get((r + dr, c + dc))
            if target:
                moves.append((target, arrow))
        neighbors[kana] = moves

    raw = load_source(input_path)
    words = sorted({h for w in raw if (h := normalize(w, valid))})
    word_set = set(words)
    print(f"source words: {len(raw)} -> normalized & filtered: {len(words)}")

    # 答え候補の枝刈り用に、辞書語のすべての接頭辞を集める。
    prefixes: set[str] = set()
    for w in words:
        for i in range(1, len(w) + 1):
            prefixes.add(w[:i])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with out_path.open("w", encoding="utf-8") as f:
        f.write("[\n")
        first = True

        def emit(source: str, arrows: str, answer: str) -> None:
            nonlocal count, first
            rec = json.dumps(
                {"source": source, "arrows": arrows, "answer": answer},
                ensure_ascii=False,
                separators=(",", ":"),
            )
            f.write(rec if first else ",\n" + rec)
            first = False
            count += 1

        def walk(source: str, idx: int, answer: str, arrows: str) -> None:
            if idx == len(source):
                if answer in word_set:
                    emit(source, arrows, answer)
                return
            for target, arrow in neighbors[source[idx]]:
                nxt = answer + target
                if nxt in prefixes:  # この接頭辞を持つ辞書語が無ければ打ち切り
                    walk(source, idx + 1, nxt, arrows + arrow)

        for source in words:
            walk(source, 0, "", "")

        f.write("\n]\n")

    print(f"wrote {out_path} ({count} problems)")


if __name__ == "__main__":
    main()
