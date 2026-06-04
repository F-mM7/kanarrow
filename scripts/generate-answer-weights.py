#!/usr/bin/env python3
"""各答え B の「矢印上限ごとのペア数」テーブルを算出して
src/data/answer-weights.json を出力する。

ペア (A, B) とは、辞書語 A の各文字を「五十音表上で 1 方向に k マス（k≥1、
盤面の端まで）」動かすと辞書語 B になる、という対のこと。あるペアの「必要上限」は
各文字位置のマス数の最大値で、上限 K の問題として出せるのは必要上限が K 以下のペア。

出題では、上限 K に対して各答え B のペア数 w_K(B) に比例して B を選び、その後
元の単語 A を一様に選ぶことで、上限 K で出せる全ペアが等確率になる（厳密一様）。
さらに、ある文字数範囲・上限で出せるペアが無いとき、UI 側は w_K から「出せる
ようになる最小の上限」を求めて自動で引き上げられる。

ある始点セルから「方向 × マス数」の組は必ず別々のセルに着地するため、(A, B) が
ペアなら各文字の動かし方は一意に定まる。よって w_K(B) は「必要上限 K 以下で B に
化けられる A の個数」になり、出題側（実行時の逆引き列挙）の個数と厳密に一致する。

入力:
    ippan.txt のような 1 行 1 語の辞書ファイル。引数で渡す（必須）。
    引数が無い場合や、指定されたファイルが存在しない場合は失敗する。

整形は generate-words.py と同一（カタカナ→ひらがな、清音 46 文字のみ、1〜6 文字）。
盤面・向き・盤面サイズの定義は src/data/grid.ts から読み取る。

出力（JSON）:
    { "1": { "<answer>": [w_1, w_2, ..., w_M], ... }, "2": {...}, ..., "6": {...} }
    各配列は上限 1..M の累積ペア数 w_K（非減少）。M はそのペア群を全て含む最小の上限
    （w_M = 端まで基準の総ペア数 w(B)）。上限 K > M では w_K = w_M。ペア数 0 の答えは
    含めない。長さは実測でペアが存在する 1〜6 のみ現れる。

使い方:
    python3 scripts/generate-answer-weights.py <辞書ファイル> [出力先(.json)]
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

ROOT = Path(__file__).resolve().parent.parent
GRID_TS = ROOT / "src" / "data" / "grid.ts"
DEFAULT_OUT = ROOT / "src" / "data" / "answer-weights.json"

MIN_LEN = 1
MAX_LEN = 6


def parse_grid(
    grid_src: str,
) -> tuple[dict[str, tuple[int, int]], list[tuple[int, int]], int, int]:
    """grid.ts から かな→座標・向き(dr,dc)・盤面サイズを取り出す。"""
    pos: dict[str, tuple[int, int]] = {}
    for m in re.finditer(r"(\S)\s*:\s*\{\s*row:\s*(\d+)\s*,\s*col:\s*(\d+)\s*\}", grid_src):
        pos[m.group(1)] = (int(m.group(2)), int(m.group(3)))

    dirs: list[tuple[int, int]] = []
    for m in re.finditer(
        r"\{\s*key:\s*'[^']+',\s*dr:\s*(-?\d+),\s*dc:\s*(-?\d+),", grid_src
    ):
        dirs.append((int(m.group(1)), int(m.group(2))))

    rows_m = re.search(r"GRID_ROWS\s*=\s*(\d+)", grid_src)
    cols_m = re.search(r"GRID_COLS\s*=\s*(\d+)", grid_src)
    if not pos or not dirs or not rows_m or not cols_m:
        raise RuntimeError("grid.ts の解析に失敗しました（フォーマット変更の可能性）")
    return pos, dirs, int(rows_m.group(1)), int(cols_m.group(1))


def to_hiragana(s: str) -> str:
    return "".join(
        chr(code - 0x60) if 0x30A1 <= (code := ord(ch)) <= 0x30F6 else ch for ch in s
    )


def normalize(word: str, valid: frozenset[str]) -> str | None:
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
        sys.exit(
            "使い方: python3 scripts/generate-answer-weights.py <辞書ファイル> [出力先(.json)]"
        )
    input_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT

    pos, dirs, rows, cols = parse_grid(GRID_TS.read_text(encoding="utf-8"))
    valid = frozenset(pos)
    pos_to_kana = {rc: kana for kana, rc in pos.items()}

    # 各かなから、各方向へ 1 マス以上動かした先（盤面内の文字マス）と、そのマス数。
    # 途中の空欄は通過し、盤面の端で止まる。
    reach: dict[str, list[tuple[str, int]]] = {}
    for kana, (r, c) in pos.items():
        targets: list[tuple[str, int]] = []
        for dr, dc in dirs:
            rr, cc, dist = r, c, 0
            while True:
                rr += dr
                cc += dc
                dist += 1
                if not (0 <= rr < rows and 0 <= cc < cols):
                    break  # 盤外で停止
                t = pos_to_kana.get((rr, cc))
                if t:  # 空欄は通過し、文字のあるマスだけ候補にする
                    targets.append((t, dist))
        reach[kana] = targets

    raw = load_source(input_path)
    words = sorted({h for w in raw if (h := normalize(w, valid))})
    word_set = set(words)
    print(f"source words: {len(raw)} -> normalized & filtered: {len(words)}")

    # 答え候補の枝刈り用に、辞書語のすべての接頭辞を集める。
    prefixes: set[str] = set()
    for w in words:
        for i in range(1, len(w) + 1):
            prefixes.add(w[:i])

    # 元の単語 A の各文字を動かして答え B を作り、B が辞書語なら、その経路の
    # 必要上限（各位置のマス数の最大値）ごとに件数を数える。
    hist: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))

    def walk(source: str, idx: int, answer: str, maxd: int) -> None:
        if idx == len(source):
            if answer in word_set:
                hist[answer][maxd] += 1
            return
        for target, dist in reach[source[idx]]:
            nxt = answer + target
            if nxt in prefixes:  # この接頭辞を持つ辞書語が無ければ打ち切り
                walk(source, idx + 1, nxt, maxd if maxd >= dist else dist)

    for source in words:
        walk(source, 0, "", 0)

    # 必要上限ヒストグラムを「上限 1..M の累積ペア数」に変換する。
    total_pairs = 0
    by_len_min_cap: dict[int, int] = {}
    table: dict[str, dict[str, list[int]]] = defaultdict(dict)
    for b, h in hist.items():
        top = max(h)  # 最大の必要上限（末尾。これ以降は累積一定なので切り詰める）
        cum: list[int] = []
        run = 0
        for k in range(1, top + 1):
            run += h.get(k, 0)
            cum.append(run)
        table[str(len(b))][b] = cum
        total_pairs += run
        first_cap = next(k for k in range(1, top + 1) if h.get(k, 0))
        by_len_min_cap[len(b)] = min(by_len_min_cap.get(len(b), first_cap), first_cap)

    ordered = {
        k: {b: table[k][b] for b in sorted(table[k])}
        for k in sorted(table, key=int)
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(ordered, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    by_len = {k: len(v) for k, v in ordered.items()}
    print(f"answers with pairs: {len(hist)}  total pairs: {total_pairs}")
    print("by length (#answers):", ", ".join(f"{k}:{v}" for k, v in by_len.items()))
    print(
        "min cap per length:",
        ", ".join(f"{k}:{by_len_min_cap[k]}" for k in sorted(by_len_min_cap)),
    )
    print(f"wrote {out_path} ({len(out_path.read_bytes())} bytes)")


if __name__ == "__main__":
    main()
