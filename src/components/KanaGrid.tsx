import { GRID_COLS, GRID_ROWS, kanaAt } from '../data/grid';
import styles from './KanaGrid.module.css';

interface KanaGridProps {
  highlightSources?: ReadonlySet<string>;
  highlightTargets?: ReadonlySet<string>;
}

export default function KanaGrid({
  highlightSources,
  highlightTargets,
}: KanaGridProps) {
  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: GRID_ROWS }).map((_, row) =>
        Array.from({ length: GRID_COLS }).map((__, col) => {
          const kana = kanaAt(row, col);
          if (!kana) {
            return <div key={`${row}-${col}`} className={styles.empty} />;
          }
          const isSource = highlightSources?.has(kana) ?? false;
          const isTarget = highlightTargets?.has(kana) ?? false;
          const cls = [
            styles.cell,
            isTarget ? styles.target : isSource ? styles.source : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={`${row}-${col}`} className={cls}>
              {kana}
            </div>
          );
        }),
      )}
    </div>
  );
}
