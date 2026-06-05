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

type Mode = 'normal' | 'flash';
type Phase = 'playing' | 'correct' | 'reveal';
type Status = 'loading' | 'ready' | 'error';

const AUTO_ADVANCE_MS = 1100;
// FLASHモード: 制限時間が切れた後、正解を見せる時間
const FLASH_REVEAL_MS = 1000;
// FLASHモードの制限時間（秒）。1秒刻みで FLASH_MIN_SEC〜FLASH_MAX_SEC の範囲。
const FLASH_MIN_SEC = 1;
const FLASH_MAX_SEC = 10;
const DEFAULT_FLASH_SEC = 5;
const MIN_LEN = LENGTHS[0];
const MAX_LEN = LENGTHS[LENGTHS.length - 1];
const DEFAULT_MAX_DIST = 1;
// 矢印（マス数）上限の下限。上限は MAX_DIST（端から端まで）。
const MIN_DIST = 1;
// FLASHモードの円形タイマー（SVG座標）の半径と円周。
const TIMER_R = 32;
const TIMER_C = 2 * Math.PI * TIMER_R;

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
          <span className={styles.titleTile}>
            <span className={styles.titleKana}>い</span>
            <Arrow dr={-1} dc={-1} className={styles.titleArrow} />
          </span>
          <span className={styles.titleTile}>
            <span className={styles.titleKana}>ち</span>
            <Arrow dr={-1} dc={-1} className={styles.titleArrow} />
          </span>
          <span className={styles.titleTile}>
            <span className={styles.titleKana}>れ</span>
            <Arrow dr={1} dc={0} className={styles.titleArrow} />
          </span>
          <span className={styles.titleTile}>
            <span className={styles.titleKana}>い</span>
            <Arrow dr={1} dc={0} className={styles.titleArrow} />
          </span>
          <span className={styles.titleEq}>＝</span>
        </span>
        かなろう
      </h1>
    </div>
  );
}

// 設定値を −／＋ ボタンで増減するステッパー。
function Stepper({
  value,
  decLabel,
  incLabel,
  decDisabled,
  incDisabled,
  onDec,
  onInc,
}: {
  value: number;
  decLabel: string;
  incLabel: string;
  decDisabled: boolean;
  incDisabled: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={onDec}
        disabled={decDisabled}
        aria-label={decLabel}
      >
        −
      </button>
      <span className={styles.stepValue}>{value}</span>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={onInc}
        disabled={incDisabled}
        aria-label={incLabel}
      >
        ＋
      </button>
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
  const [mode, setMode] = useState<Mode>('normal');
  const [flashSec, setFlashSec] = useState<number>(DEFAULT_FLASH_SEC);
  const [remainingMs, setRemainingMs] = useState(DEFAULT_FLASH_SEC * 1000);

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

  // モードを切り替える。出題中の問題はそのままに、進行状態だけ初期化する。
  const changeMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      clearTimer();
      setMode(next);
      setPhase('playing');
      setInput('');
      setWrongKey(0);
      setShake(false);
      setRemainingMs(flashSec * 1000);
    },
    [mode, flashSec, clearTimer],
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
  // 制限時間を 1秒刻みで増減する（範囲内にクランプ）。
  const changeFlashSec = (value: number) => {
    const v = Math.min(FLASH_MAX_SEC, Math.max(FLASH_MIN_SEC, value));
    setFlashSec(v);
    setRemainingMs(v * 1000);
  };

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

  // 新しい問題になったら入力欄へフォーカス（通常モードのみ）
  useEffect(() => {
    if (mode === 'normal' && phase === 'playing') inputRef.current?.focus();
  }, [puzzle, phase, mode]);

  // FLASHモード: 制限時間のカウントダウン。0 になったら正解を見せる(reveal)。
  useEffect(() => {
    if (mode !== 'flash' || phase !== 'playing') return;
    const total = flashSec * 1000;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const left = total - (Date.now() - startedAt);
      if (left <= 0) {
        window.clearInterval(id);
        // 次の問題のカウントダウンに備えて満タンに戻す（reveal 中は非表示）
        setRemainingMs(total);
        setPhase('reveal');
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [mode, phase, flashSec, puzzle]);

  // FLASHモード: 正解を一定時間見せたら、即座に次の問題へ。
  useEffect(() => {
    if (mode !== 'flash' || phase !== 'reveal' || !puzzle) return;
    const id = window.setTimeout(
      () => loadNext(puzzle.answer),
      FLASH_REVEAL_MS,
    );
    return () => window.clearTimeout(id);
  }, [mode, phase, puzzle, loadNext]);

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
  // 通常モードの正解／FLASHモードの正解表示のどちらでも答えを見せる
  const showAnswer = phase === 'correct' || phase === 'reveal';

  const modeControl = (
    <div className={styles.modeToggle} role="group" aria-label="モード選択">
      <button
        type="button"
        className={`${styles.modeBtn} ${
          mode === 'normal' ? styles.modeBtnActive : ''
        }`}
        onClick={() => changeMode('normal')}
      >
        通常
      </button>
      <button
        type="button"
        className={`${styles.modeBtn} ${
          mode === 'flash' ? styles.modeBtnActive : ''
        }`}
        onClick={() => changeMode('flash')}
      >
        FLASH
      </button>
    </div>
  );

  const controls = (
    <div className={styles.controls}>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>文字数</span>
        <div className={styles.controlField}>
          <Stepper
            value={minLen}
            decLabel="文字数の下限を減らす"
            incLabel="文字数の下限を増やす"
            decDisabled={minLen <= MIN_LEN}
            incDisabled={minLen >= MAX_LEN}
            onDec={() => changeMinLen(minLen - 1)}
            onInc={() => changeMinLen(minLen + 1)}
          />
          <span className={styles.rangeSep}>〜</span>
          <Stepper
            value={maxLen}
            decLabel="文字数の上限を減らす"
            incLabel="文字数の上限を増やす"
            decDisabled={maxLen <= MIN_LEN}
            incDisabled={maxLen >= MAX_LEN}
            onDec={() => changeMaxLen(maxLen - 1)}
            onInc={() => changeMaxLen(maxLen + 1)}
          />
        </div>
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>矢印上限</span>
        <div className={styles.controlField}>
          <Stepper
            value={maxDist}
            decLabel="矢印上限を減らす"
            incLabel="矢印上限を増やす"
            decDisabled={maxDist <= MIN_DIST}
            incDisabled={maxDist >= MAX_DIST}
            onDec={() => changeMaxDist(maxDist - 1)}
            onInc={() => changeMaxDist(maxDist + 1)}
          />
        </div>
      </div>
      {mode === 'flash' && (
        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>制限時間（秒）</span>
          <div className={styles.controlField}>
            <Stepper
              value={flashSec}
              decLabel="制限時間を減らす"
              incLabel="制限時間を増やす"
              decDisabled={flashSec <= FLASH_MIN_SEC}
              incDisabled={flashSec >= FLASH_MAX_SEC}
              onDec={() => changeFlashSec(flashSec - 1)}
              onInc={() => changeFlashSec(flashSec + 1)}
            />
          </div>
        </div>
      )}
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
        <div className={styles.topRow}>
          <TitleBrand />
          {modeControl}
        </div>
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

        {mode === 'normal' ? (
          <>
            <div className={styles.answerArea}>
              <input
                ref={inputRef}
                className={`${styles.input} ${
                  shake ? styles.inputWrong : ''
                }`}
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
          </>
        ) : (
          <div className={styles.flashArea}>
            <div className={styles.flashAnswer} aria-live="polite">
              <span
                className={phase === 'reveal' ? styles.flashAnswerShow : ''}
              >
                {phase === 'reveal' ? puzzle.answer : '？'}
              </span>
              <div className={styles.timer}>
                <svg
                  className={styles.timerSvg}
                  viewBox="0 0 76 76"
                  role="img"
                  aria-label="残り時間"
                >
                  <circle
                    className={styles.timerTrack}
                    cx="38"
                    cy="38"
                    r={TIMER_R}
                  />
                  <circle
                    className={styles.timerFill}
                    cx="38"
                    cy="38"
                    r={TIMER_R}
                    style={{
                      strokeDasharray: TIMER_C,
                      strokeDashoffset:
                        TIMER_C *
                        (1 -
                          (phase === 'reveal'
                            ? 0
                            : remainingMs / (flashSec * 1000))),
                    }}
                  />
                </svg>
                <span className={styles.timerNum}>
                  {phase === 'reveal' ? 0 : Math.ceil(remainingMs / 1000)}
                </span>
              </div>
            </div>
          </div>
        )}
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
            highlightTargets={showAnswer ? targets : undefined}
          />
        )}

        {controls}
      </section>
    </div>
  );
}
