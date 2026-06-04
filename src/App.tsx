import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KanaGrid from './components/KanaGrid';
import { isCorrect } from './lib/normalize';
import type { Puzzle } from './lib/puzzle';
import { loadPuzzles, nextPuzzle } from './lib/puzzles';
import styles from './App.module.css';

type Phase = 'playing' | 'correct';
type Status = 'loading' | 'ready' | 'error';

const AUTO_ADVANCE_MS = 1100;

function TitleBrand() {
  return (
    <div className={styles.brand}>
      <h1 className={styles.title}>
        <span className={styles.titleClue}>
          い<span className={styles.titleArrow}>↖</span>ち
          <span className={styles.titleArrow}>↖</span>れ
          <span className={styles.titleArrow}>↓</span>い
          <span className={styles.titleArrow}>↓</span>
          <span className={styles.titleEq}>＝</span>
        </span>
        かなろう
      </h1>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('playing');
  const [wrongKey, setWrongKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const advanceTimer = useRef<number | undefined>(undefined);

  const clearTimer = useCallback(() => {
    if (advanceTimer.current !== undefined) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = undefined;
    }
  }, []);

  const loadNext = useCallback(
    (previous?: string) => {
      clearTimer();
      setPuzzle(nextPuzzle(previous));
      setInput('');
      setPhase('playing');
      setWrongKey(0);
      setShake(false);
    },
    [clearTimer],
  );

  // 起動時に問題データを読み込む
  useEffect(() => {
    let cancelled = false;
    loadPuzzles()
      .then(() => {
        if (cancelled) return;
        setPuzzle(nextPuzzle());
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : '読み込みに失敗しました');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // 新しい問題になったら入力欄へフォーカス
  useEffect(() => {
    if (phase === 'playing') inputRef.current?.focus();
  }, [puzzle, phase]);

  const handleSubmit = useCallback(() => {
    if (!puzzle || phase !== 'playing' || input.trim() === '') return;
    if (isCorrect(input, puzzle.answer)) {
      setPhase('correct');
      clearTimer();
      advanceTimer.current = window.setTimeout(
        () => loadNext(puzzle.answer),
        AUTO_ADVANCE_MS,
      );
    } else {
      setWrongKey((k) => k + 1);
      setShake(true);
      inputRef.current?.focus();
    }
  }, [puzzle, phase, input, clearTimer, loadNext]);

  const handleNext = useCallback(() => {
    loadNext(puzzle?.answer);
  }, [puzzle, loadNext]);

  const sources = useMemo(
    () => new Set(puzzle?.clues.map((c) => c.source) ?? []),
    [puzzle],
  );
  const targets = useMemo(
    () => new Set(puzzle?.clues.map((c) => c.target) ?? []),
    [puzzle],
  );

  const solved = phase === 'correct';

  if (status !== 'ready' || !puzzle) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <TitleBrand />
        </header>
        <main className={styles.card}>
          <p className={styles.status}>
            {status === 'error'
              ? `読み込みエラー: ${errorMsg}`
              : '問題を読み込み中…'}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <TitleBrand />
      </header>

      <main className={styles.card}>
        <div className={styles.boardArea}>
          <div className={styles.board}>
            {puzzle.clues.map((clue, i) => (
              <div
                key={i}
                className={`${styles.tile} ${solved ? styles.tileResolved : ''}`}
              >
                <div className={styles.tileTop}>
                  <span className={styles.tileKana}>{clue.source}</span>
                  <span className={styles.tileArrow}>{clue.direction.arrow}</span>
                </div>
                <div className={styles.tileResult}>
                  {solved ? clue.target : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.answerArea}>
          <input
            ref={inputRef}
            className={`${styles.input} ${
              phase === 'correct' ? styles.inputCorrect : ''
            } ${shake ? styles.inputWrong : ''}`}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="こたえをひらがなで"
            value={solved ? puzzle.answer : input}
            disabled={solved}
            onChange={(e) => setInput(e.target.value)}
            onAnimationEnd={() => setShake(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          {phase === 'playing' ? (
            <button
              className={styles.primaryBtn}
              onClick={handleSubmit}
              disabled={input.trim() === ''}
            >
              こたえあわせ
            </button>
          ) : (
            <button className={styles.primaryBtn} onClick={handleNext} autoFocus>
              次の問題 →
            </button>
          )}
        </div>

        <div className={styles.feedback} aria-live="polite">
          {phase === 'correct' && (
            <span className={styles.correctMsg}>正解！ 「{puzzle.answer}」</span>
          )}
          {phase === 'playing' && wrongKey > 0 && (
            <span className={styles.wrongMsg} key={wrongKey}>
              ちがうみたい…もう一度
            </span>
          )}
        </div>
      </main>

      <section className={styles.panel}>
        <div className={styles.panelRow}>
          <button
            className={styles.toggleBtn}
            onClick={() => setShowGrid((v) => !v)}
          >
            {showGrid ? '五十音表を隠す' : '五十音表を見る'}
          </button>
        </div>

        {showGrid && (
          <div className={styles.gridWrap}>
            <KanaGrid
              highlightSources={sources}
              highlightTargets={solved ? targets : undefined}
            />
            <p className={styles.gridNote}>
              青= ヒントの文字 / 矢印の向きに1マス進んだ文字が答え
              {solved ? '（緑= 答えの文字）' : ''}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
