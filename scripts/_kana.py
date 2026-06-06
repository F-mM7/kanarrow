"""generate-words.py と generate-answer-weights.py が共有する整形・解析処理。

辞書語の整形ルール（カタカナ→ひらがな、清音 46 文字のみ、1〜6 文字）と、
盤面定義 src/data/grid.ts のパースをここに集約する。両スクリプトが同じ規則で
母集合を作ることで、単語リストとペア数テーブルが食い違わないようにする。
直接実行するモジュールではない。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRID_TS = ROOT / "src" / "data" / "grid.ts"

MIN_LEN = 1
MAX_LEN = 6


def parse_grid(
    grid_src: str | None = None,
) -> tuple[dict[str, tuple[int, int]], list[tuple[int, int]], int, int]:
    """grid.ts から かな→座標・向き(dr,dc)・盤面サイズを取り出す。

    grid_src を省略すると GRID_TS を読み込む。
    """
    if grid_src is None:
        grid_src = GRID_TS.read_text(encoding="utf-8")

    pos: dict[str, tuple[int, int]] = {}
    for m in re.finditer(r"(\S)\s*:\s*\{\s*row:\s*(\d+)\s*,\s*col:\s*(\d+)\s*\}", grid_src):
        pos[m.group(1)] = (int(m.group(2)), int(m.group(3)))

    dirs: list[tuple[int, int]] = []
    for m in re.finditer(r"\{\s*key:\s*'[^']+',\s*dr:\s*(-?\d+),\s*dc:\s*(-?\d+)", grid_src):
        dirs.append((int(m.group(1)), int(m.group(2))))

    rows_m = re.search(r"GRID_ROWS\s*=\s*(\d+)", grid_src)
    cols_m = re.search(r"GRID_COLS\s*=\s*(\d+)", grid_src)
    if not pos or not dirs or not rows_m or not cols_m:
        raise RuntimeError("grid.ts の解析に失敗しました（フォーマット変更の可能性）")
    return pos, dirs, int(rows_m.group(1)), int(cols_m.group(1))


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
    """1 行 1 語の辞書ファイルを読み、空行を除いた語リストを返す。"""
    if not path.is_file():
        sys.exit(f"辞書ファイルが見つかりません: {path}")
    text = path.read_text(encoding="utf-8")
    return [w.strip() for w in text.splitlines() if w.strip()]
