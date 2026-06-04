import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KanaGrid from './components/KanaGrid';
import { isCorrect } from './lib/normalize';
import type { Puzzle } from './lib/puzzle';
import {
  DIFFICULTY_LABELS,
  nextPuzzle,
  type Difficulty,
} from './lib/words';
import styles from './App.module.css';

type Phase = 'playing' | 'correct' | 'revealed';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'mix'];
const AUTO_ADVANCE_MS = 1100;

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('mix');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => nextPuzzle('mix'));
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('playing');
  const [wrongKey, setWrongKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showGrid, setShowGrid] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const advanceTimer = useRef<number | undefined>(undefined);

  const clearTimer = useCallback(() => {
    if (advanceTimer.current !== undefined) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = undefined;
    }
  }, []);

  const loadNext = useCallback(
    (diff: Difficulty, previous?: string) => {
      clearTimer();
      setPuzzle(nextPuzzle(diff, previous));
      setInput('');
      setPhase('playing');
      setWrongKey(0);
      setShake(false);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  // 新しい問題になったら入力欄へフォーカス
  useEffect(() => {
    if (phase === 'playing') inputRef.current?.focus();
  }, [puzzle, phase]);

  const handleSubmit = useCallback(() => {
    if (phase !== 'playing' || input.trim() === '') return;
    if (isCorrect(input, puzzle.answer)) {
      setPhase('correct');
      setSolved((n) => n + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      clearTimer();
      advanceTimer.current = window.setTimeout(
        () => loadNext(difficulty, puzzle.answer),
        AUTO_ADVANCE_MS,
      );
    } else {
      setWrongKey((k) => k + 1);
      setShake(true);
      inputRef.current?.focus();
    }
  }, [phase, input, puzzle.answer, difficulty, clearTimer, loadNext]);

  const handleReveal = useCallback(() => {
    if (phase !== 'playing') return;
    clearTimer();
    setPhase('revealed');
    setStreak(0);
  }, [phase, clearTimer]);

  const handleSkip = useCallback(() => {
    setStreak(0);
    loadNext(difficulty, puzzle.answer);
  }, [difficulty, puzzle.answer, loadNext]);

  const handleNext = useCallback(() => {
    loadNext(difficulty, puzzle.answer);
  }, [difficulty, puzzle.answer, loadNext]);

  const handleDifficulty = useCallback(
    (diff: Difficulty) => {
      if (diff === difficulty) return;
      setDifficulty(diff);
      setStreak(0);
      loadNext(diff);
    },
    [difficulty, loadNext],
  );

  const sources = useMemo(
    () => new Set(puzzle.clues.map((c) => c.source)),
    [puzzle],
  );
  const targets = useMemo(
    () => new Set(puzzle.clues.map((c) => c.target)),
    [puzzle],
  );

  const revealed = phase !== 'playing';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>か</span>
          <div>
            <h1 className={styles.title}>かなろう</h1>
            <p className={styles.tagline}>矢印で五十音表をたどって言葉を当てよう</p>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{streak}</span>
            <span className={styles.statLabel}>連続正解</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{solved}</span>
            <span className={styles.statLabel}>正解数</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{bestStreak}</span>
            <span className={styles.statLabel}>最高連続</span>
          </div>
        </div>
      </header>

      <main className={styles.card}>
        <div className={styles.boardArea}>
          <div className={styles.hintLabel}>このヒントが表す言葉は？</div>
          <div className={styles.board}>
            {puzzle.clues.map((clue, i) => (
              <div
                key={i}
                className={`${styles.tile} ${revealed ? styles.tileResolved : ''}`}
              >
                <div className={styles.tileTop}>
                  <span className={styles.tileKana}>{clue.source}</span>
                  <span className={styles.tileArrow}>{clue.direction.arrow}</span>
                </div>
                <div className={styles.tileResult}>
                  {revealed ? clue.target : ''}
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
            value={revealed ? puzzle.answer : input}
            disabled={revealed}
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
          {phase === 'revealed' && (
            <span className={styles.revealMsg}>こたえは「{puzzle.answer}」でした</span>
          )}
          {phase === 'playing' && wrongKey > 0 && (
            <span className={styles.wrongMsg} key={wrongKey}>
              ちがうみたい…もう一度
            </span>
          )}
        </div>

        <div className={styles.controls}>
          <button className={styles.ghostBtn} onClick={handleSkip}>
            スキップ
          </button>
          <button
            className={styles.ghostBtn}
            onClick={handleReveal}
            disabled={phase !== 'playing'}
          >
            こたえを見る
          </button>
        </div>
      </main>

      <section className={styles.panel}>
        <div className={styles.panelRow}>
          <div className={styles.difficulty}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={`${styles.diffBtn} ${
                  d === difficulty ? styles.diffActive : ''
                }`}
                onClick={() => handleDifficulty(d)}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
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
              highlightTargets={revealed ? targets : undefined}
            />
            <p className={styles.gridNote}>
              青= ヒントの文字 / 矢印の向きに1マス進んだ文字が答え
              {revealed ? '（緑= 答えの文字）' : ''}
            </p>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        言葉データ: F-mM7/word-data（ippan・清音のみ）
      </footer>
    </div>
  );
}
