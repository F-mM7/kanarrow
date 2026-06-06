import { MAX_DIST } from '../data/grid';

interface ArrowProps {
  dr: number;
  dc: number;
  count?: number;
  className?: string;
}

// dr/dc（画面座標。下が+row、右が+col）から角度を求め、右向きの矢印を回転させて
// 8方向を描画する。環境依存の矢印文字は使わない。
// count は「動かすマス数」で、その数だけ矢じり（三角）を先端に連ねて表す。
// 本数が増えると間隔が詰まるので、矢じりどうしのギャップ（間隔 − 太さ）が太さ以上に
// 保たれるよう線を細める。これにより最大本数でも見分けられる。
export default function Arrow({
  dr,
  dc,
  count = 1,
  className,
}: ArrowProps) {
  const angle = (Math.atan2(dr, dc) * 180) / Math.PI;
  const n = Math.max(1, Math.floor(count));

  const tipX = 21.5; // 先端（最前の矢じりの頂点）
  const minX = 5.5; // 最後尾の矢じりが収まる最小 x
  // 矢じりの間隔・線の太さは本数によらず統一する。最大本数(MAX_DIST)がちょうど span
  // に等間隔で収まる間隔にし、太さは間隔の 1/4（ギャップ = 間隔 − 太さ = 太さの3倍。
  // 太さ : ギャップ = 1 : 3）。
  const step = (tipX - minX) / (MAX_DIST - 1);
  const stroke = step / 4;
  const headW = 4.5; // 矢じりの奥行き（幅）
  const headH = 7.5; // 矢じりの半分の高さ

  const heads = Array.from({ length: n }, (_, j) => {
    const cx = tipX - j * step;
    const bx = (cx - headW).toFixed(2);
    const top = (12 - headH).toFixed(2);
    const bottom = (12 + headH).toFixed(2);
    return `M ${bx} ${top} L ${cx.toFixed(2)} 12 L ${bx} ${bottom}`;
  }).join(' ');

  const sw = stroke.toFixed(2);

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${angle}deg)` }}
    >
      <path
        d={`M2.5 12 H${tipX}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={heads}
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
