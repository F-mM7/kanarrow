import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Arrow from './components/Arrow';
import KanaGrid from './components/KanaGrid';
import { isCorrect } from './lib/normalize';
import type { Puzzle } from './lib/puzzle';
import {
  LENGTHS,
  MAX_DIST,
  feasibleMaxDist,
  loadPuzzles,
  nextPuzzle,
} from './lib/puzzles';
import styles from './App.module.css';

type Phase = 'playing' | 'correct';
type Status = 'loading' | 'ready' | 'error';

const AUTO_ADVANCE_MS = 1100;
const MIN_LEN = LENGTHS[0];
const MAX_LEN = LENGTHS[LENGTHS.length - 1];
const DEFAULT_MAX_DIST = 1;
// マス数上限のプルダウン候補（1〜MAX_DIST マス）。MAX_DIST まで＝端まで。
const DIST_OPTIONS = Array.from({ length: MAX_DIST }, (_, i) => i + 1);

// 出題中の問題が現在の設定（文字数範囲・矢印上限）を満たすか。
function fitsSettings(p: Puzzle, mn: number, mx: number, md: number): boolean {
  const len = [...p.answer].length;
  return len >= mn && len <= mx && p.clues.every((c) => c.dist <= md);
}

function TitleBrand() {
  return (
    <div className={styles.brand}>
      <h1 className={styles.title}>
        <span className={styles.titleClue}>
          い<Arrow dr={-1} dc={-1} strokeWidth={2.5} className={styles.titleArrow} />ち
          <Arrow dr={-1} dc={-1} strokeWidth={2.5} className={styles.titleArrow} />れ
          <Arrow dr={1} dc={0} strokeWidth={2.5} className={styles.titleArrow} />い
          <Arrow dr={1} dc={0} strokeWidth={2.5} className={styles.titleArrow} />
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
  const [minLen, setMinLen] = useState(MIN_LEN);
  const [maxLen, setMaxLen] = useState(MAX_LEN);
  const [maxDist, setMaxDist] = useState(DEFAULT_MAX_DIST);
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

  // 指定条件で新しい問題を出し、入力状態をリセットする。
  // 条件に合う問題が無いとき（上限が厳しすぎる等）は前の問題を保持する。
  const startPuzzle = useCallback(
    (mn: number, mx: number, md: number, previous?: string) => {
      let next: Puzzle;
      try {
        next = nextPuzzle({
          minLength: mn,
          maxLength: mx,
          maxDist: md,
          previousAnswer: previous,
        });
      } catch {
        return;
      }
      clearTimer();
      setPuzzle(next);
      setInput('');
      setPhase('playing');
      setWrongKey(0);
      setShake(false);
    },
    [clearTimer],
  );

  const loadNext = useCallback(
    (previous?: string) => startPuzzle(minLen, maxLen, maxDist, previous),
    [startPuzzle, minLen, maxLen, maxDist],
  );

  // 設定を反映する。出題中の問題が新しい設定に反しているときだけ出し直す。
  const applySettings = useCallback(
    (mn: number, mx: number, mdDesired: number) => {
      // その範囲・上限で問題が無いときは、出せる最小の上限まで自動で引き上げる
      const md = feasibleMaxDist(mn, mx, mdDesired);
      setMinLen(mn);
      setMaxLen(mx);
      setMaxDist(md);
      if (!puzzle || !fitsSettings(puzzle, mn, mx, md)) {
        startPuzzle(mn, mx, md, puzzle?.answer);
      }
    },
    [puzzle, startPuzzle],
  );

  const changeMinLen = (value: number) =>
    applySettings(value, Math.max(value, maxLen), maxDist);
  const changeMaxLen = (value: number) =>
    applySettings(Math.min(value, minLen), value, maxDist);
  const changeMaxDist = (value: number) => applySettings(minLen, maxLen, value);

  // 起動時に問題データを初期化する（fetch なし）
  useEffect(() => {
    let cancelled = false;
    loadPuzzles()
      .then(() => {
        if (cancelled) return;
        setPuzzle(
          nextPuzzle({
            minLength: MIN_LEN,
            maxLength: MAX_LEN,
            maxDist: DEFAULT_MAX_DIST,
          }),
        );
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

  // 出題時、答えをコンソールに出力する（確認用）
  useEffect(() => {
    if (puzzle) console.log(puzzle.answer);
  }, [puzzle]);

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

  const sources = useMemo(
    () => new Set(puzzle?.clues.map((c) => c.source) ?? []),
    [puzzle],
  );
  const targets = useMemo(
    () => new Set(puzzle?.clues.map((c) => c.target) ?? []),
    [puzzle],
  );

  const solved = phase === 'correct';

  const controls = (
    <div className={styles.controls}>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>文字数</span>
        <select
          className={styles.select}
          value={minLen}
          onChange={(e) => changeMinLen(Number(e.target.value))}
        >
          {LENGTHS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className={styles.rangeSep}>〜</span>
        <select
          className={styles.select}
          value={maxLen}
          onChange={(e) => changeMaxLen(Number(e.target.value))}
        >
          {LENGTHS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>矢印上限</span>
        <select
          className={styles.select}
          value={maxDist}
          onChange={(e) => changeMaxDist(Number(e.target.value))}
        >
          {DIST_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

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
              : '問題を準備中…'}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <TitleBrand />
        {controls}
      </header>

      <main className={styles.card}>
        <div className={styles.boardArea}>
          <div className={styles.board}>
            {puzzle.clues.map((clue, i) => (
              <div key={i} className={styles.tile}>
                <div className={styles.tileTop}>
                  <span className={styles.tileKana}>{clue.source}</span>
                  <Arrow
                    dr={clue.direction.dr}
                    dc={clue.direction.dc}
                    count={clue.dist}
                    className={styles.tileArrow}
                  />
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
            placeholder="ひらがなで入力"
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
          <button
            className={styles.primaryBtn}
            onClick={handleSubmit}
            disabled={phase !== 'playing' || input.trim() === ''}
          >
            SUBMIT
          </button>
        </div>

        <div className={styles.feedback} aria-live="polite">
          {phase === 'correct' && (
            <span className={styles.correctMsg}>CORRECT!!</span>
          )}
          {phase === 'playing' && wrongKey > 0 && (
            <span className={styles.wrongMsg} key={wrongKey}>
              INCORRECT
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
            {showGrid ? '五十音表を非表示' : '五十音表を表示'}
          </button>
        </div>

        {showGrid && (
          <KanaGrid
            highlightSources={sources}
            highlightTargets={solved ? targets : undefined}
          />
        )}
      </section>
    </div>
  );
}
