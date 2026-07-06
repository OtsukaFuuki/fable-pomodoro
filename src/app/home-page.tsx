// Phase 3: 永続化・ステッパー・背景演出を統合
"use client";
import { useEffect, useRef, useState } from "react";
import { AmbientGlow } from "@/components/AmbientGlow";
import {
  ICON_BTN,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  SkipIcon,
} from "@/components/ControlIcons";
import { MixerRow } from "@/components/MixerRow";
import { ModeLabel } from "@/components/ModeLabel";
import { SettingsModal } from "@/components/SettingsModal";
import { Stepper } from "@/components/Stepper";
import { TimerRing } from "@/components/TimerRing";
import {
  AUDIO_PRESETS,
  DEFAULT_PRESET,
  getPreset,
  type PresetId,
} from "@/lib/audio-presets";
import {
  clearAllData,
  loadSettings,
  loadTodaySessions,
  saveSettings,
  saveTodaySessions,
  todayKey,
} from "@/lib/db";
import {
  createPresetPlayer,
  ensureContext,
  playChime,
  setMasterVolume,
  suspendAll,
  type Channel,
} from "@/lib/audio-engine";
import {
  advanceIfExpired,
  createInitialState,
  getProgress,
  getRemainingMs,
  isBreakMode,
  isPaused,
  isRunning,
  pausePhase,
  resetTimer,
  resumePhase,
  skipPhase,
  startFocus,
  updateSettings,
} from "@/lib/pomodoro";
import { formatMmSs } from "@/lib/timer";
import type { PomodoroState } from "@/lib/types";

const SAVE_DEBOUNCE_MS = 500;

function vibrateOnPhaseEnd(): void {
  try {
    navigator.vibrate?.(200);
  } catch {
    /* 非対応環境は無視 */
  }
}

function chimeAndVibrate(): void {
  playChime();
  vibrateOnPhaseEnd();
}

export function HomePage() {
  const [pomodoro, setPomodoro] = useState<PomodoroState>(createInitialState);
  const [, redraw] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const hydrated = useRef(false);
  const dateKeyRef = useRef(todayKey());

  // --- ミキサー ---
  const [playing, setPlaying] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [selectedPreset, setSelectedPreset] = useState<PresetId>(DEFAULT_PRESET);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const player = useRef<Channel | null>(null);

  // IndexedDB から設定・今日のセッション数を復元（再生状態は復元しない）
  useEffect(() => {
    void (async () => {
      const [settings, sessions] = await Promise.all([loadSettings(), loadTodaySessions()]);
      setPomodoro(
        createInitialState(
          { focusMs: settings.focusMs, breakMs: settings.breakMs },
          sessions,
        ),
      );
      setMasterVol(settings.masterVol);
      setSelectedPreset(settings.selectedPreset);
      hydrated.current = true;
    })();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // 設定・音量のデバウンス保存
  useEffect(() => {
    if (!hydrated.current) return;
    const id = window.setTimeout(() => {
      void saveSettings({
        focusMs: pomodoro.settings.focusMs,
        breakMs: pomodoro.settings.breakMs,
        masterVol,
        selectedPreset,
      });
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [pomodoro.settings.focusMs, pomodoro.settings.breakMs, masterVol, selectedPreset]);

  // セッション数の保存
  useEffect(() => {
    if (!hydrated.current) return;
    void saveTodaySessions(pomodoro.sessionsCompleted);
  }, [pomodoro.sessionsCompleted]);

  const running = isRunning(pomodoro.phase);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => redraw((n) => n + 1), 250);
    const onVisibility = () => {
      if (document.hidden) return;

      // 日付が変わっていればセッション表示をリセット（過去分は DB に残る）
      const key = todayKey();
      if (key !== dateKeyRef.current) {
        dateKeyRef.current = key;
        void loadTodaySessions().then((count) => {
          setPomodoro((prev) => ({ ...prev, sessionsCompleted: count }));
        });
      }

      setPomodoro((prev) => {
        const { state, chime } = advanceIfExpired(prev);
        if (chime) chimeAndVibrate();
        return state;
      });
      redraw((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running, pomodoro.phase]);

  const remainingMs = getRemainingMs(pomodoro);
  const progress = getProgress(pomodoro);
  const breakMode = isBreakMode(pomodoro.phase);
  const paused = isPaused(pomodoro.phase);

  useEffect(() => {
    if (running && remainingMs === 0) {
      setPomodoro((prev) => {
        const { state, chime } = advanceIfExpired(prev);
        if (chime) chimeAndVibrate();
        return state;
      });
    }
  }, [running, remainingMs, pomodoro.phase]);

  useEffect(() => {
    if (pomodoro.phase.mode === "idle") {
      document.title = "夜凪";
      return;
    }
    document.title = `(${formatMmSs(remainingMs)}) 夜凪`;
  }, [pomodoro.phase.mode, remainingMs]);

  const toggleTimer = () => {
    if (pomodoro.phase.mode === "idle") {
      setPomodoro(startFocus(pomodoro));
      return;
    }
    if (running) setPomodoro(pausePhase(pomodoro));
    else setPomodoro(resumePhase(pomodoro));
  };

  const handleReset = () => setPomodoro(resetTimer(pomodoro));

  const handleSkip = () => {
    setPomodoro((prev) => {
      const next = skipPhase(prev);
      if (prev.phase.mode !== "idle" && next.phase.mode !== prev.phase.mode) chimeAndVibrate();
      return next;
    });
  };

  const timerAriaLabel =
    pomodoro.phase.mode === "idle" ? "開始" : running ? "一時停止" : "再開";

  const focusMin = Math.round(pomodoro.settings.focusMs / 60_000);
  const breakMin = Math.round(pomodoro.settings.breakMs / 60_000);
  const stepperDisabled = pomodoro.phase.mode !== "idle";

  const changeFocusMin = (min: number) => {
    setPomodoro((prev) => updateSettings(prev, { focusMs: min * 60_000 }));
  };

  const changeBreakMin = (min: number) => {
    setPomodoro((prev) => updateSettings(prev, { breakMs: min * 60_000 }));
  };

  useEffect(() => () => player.current?.dispose(), []);

  const disposePlayer = () => {
    player.current?.dispose();
    player.current = null;
  };

  const togglePlay = () => {
    if (playing) {
      void suspendAll();
      player.current?.pause();
      setPlaying(false);
      return;
    }
    ensureContext();
    setMasterVolume(masterVol / 100);
    if (!player.current) player.current = createPresetPlayer(selectedPreset);
    player.current.setVolume(masterVol / 100);
    player.current.resume();
    setPlaying(true);
  };

  const changeMasterVol = (v: number) => {
    setMasterVol(v);
    setMasterVolume(v / 100);
    if (playing) player.current?.setVolume(v / 100);
  };

  const selectPreset = (id: PresetId) => {
    setSelectedPreset(id);
    if (!playing) return;
    disposePlayer();
    ensureContext();
    player.current = createPresetPlayer(id);
    player.current.setVolume(masterVol / 100);
    player.current.resume();
  };

  const handleClearData = async () => {
    await clearAllData();
    if (playing) {
      await suspendAll();
      setPlaying(false);
    }
    disposePlayer();
    setPomodoro(createInitialState());
    setMasterVol(80);
    setSelectedPreset(DEFAULT_PRESET);
  };

  const preset = getPreset(selectedPreset);

  return (
    <>
      <AmbientGlow
        playing={playing}
        color={preset.color}
        volume={masterVol}
        reducedMotion={reducedMotion}
      />

      <main className="relative z-10 mx-auto grid min-h-dvh w-full max-w-5xl grid-cols-1 gap-5 px-5 pb-10 pt-8 md:grid-cols-2 md:items-start md:gap-8 md:px-8">
        <header className="relative flex items-center md:col-span-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="設定を開く"
            className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-full border border-haze/30 text-haze shadow-[0_0_12px_rgba(138,147,168,0.1)] transition-shadow duration-700 hover:shadow-[0_0_20px_rgba(138,147,168,0.25)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </button>
          <h1 className="w-full text-center text-sm font-light tracking-[0.5em] text-haze">夜凪</h1>
        </header>

        <section className="flex flex-col items-center gap-6 rounded-2xl border border-frost/5 bg-panel px-6 py-10">
          <ModeLabel breakMode={breakMode} />

          <div className="relative flex items-center justify-center">
            <TimerRing
              progress={progress}
              breakMode={breakMode}
              paused={paused}
              reducedMotion={reducedMotion}
            />
            <p
              className={`absolute text-5xl font-light tabular-nums tracking-widest text-frost transition-opacity duration-700 md:text-6xl ${
                paused ? "opacity-60" : ""
              }`}
              style={{
                textShadow: breakMode
                  ? "0 0 32px rgba(143, 224, 220, 0.25)"
                  : "0 0 32px rgba(174, 184, 244, 0.25)",
              }}
            >
              {formatMmSs(remainingMs)}
            </p>
          </div>

          <p className="text-xs tracking-widest text-haze">
            {pomodoro.sessionsCompleted} セッション完了
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              aria-label="リセット"
              className={`${ICON_BTN} border-haze/30 text-haze shadow-[0_0_12px_rgba(138,147,168,0.1)] hover:shadow-[0_0_20px_rgba(138,147,168,0.2)]`}
            >
              <ResetIcon />
            </button>
            <button
              type="button"
              onClick={toggleTimer}
              aria-label={timerAriaLabel}
              className={`${ICON_BTN} border-moon/40 text-moon shadow-[0_0_16px_rgba(174,184,244,0.15)] hover:shadow-[0_0_28px_rgba(174,184,244,0.35)]`}
              style={
                breakMode
                  ? {
                      borderColor: "rgba(143, 224, 220, 0.4)",
                      color: "#8FE0DC",
                      boxShadow: "0 0 16px rgba(143, 224, 220, 0.15)",
                    }
                  : undefined
              }
            >
              {running ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={pomodoro.phase.mode === "idle"}
              aria-label="スキップ"
              className={`${ICON_BTN} border-haze/30 text-haze shadow-[0_0_12px_rgba(138,147,168,0.1)] hover:shadow-[0_0_20px_rgba(138,147,168,0.2)] disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <SkipIcon />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <Stepper
              label="集中"
              value={focusMin}
              onChange={changeFocusMin}
              disabled={stepperDisabled}
            />
            <Stepper
              label="休憩"
              value={breakMin}
              onChange={changeBreakMin}
              disabled={stepperDisabled}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-frost/5 bg-panel px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="shrink-0 text-xs tracking-widest text-haze">BGM</h2>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "一時停止" : "再生"}
              className={`${ICON_BTN} shrink-0 border-moon/40 text-moon shadow-[0_0_16px_rgba(174,184,244,0.15)] hover:shadow-[0_0_28px_rgba(174,184,244,0.35)]`}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {AUDIO_PRESETS.map((p) => {
              const selected = selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p.id)}
                  className={`min-h-11 rounded-full border px-6 text-sm tracking-widest transition-shadow duration-700 ${
                    selected
                      ? "shadow-[0_0_20px_rgba(242,208,145,0.25)]"
                      : "border-haze/30 text-haze shadow-[0_0_12px_rgba(138,147,168,0.1)] hover:shadow-[0_0_20px_rgba(138,147,168,0.2)]"
                  }`}
                  style={
                    selected
                      ? {
                          borderColor: `${p.color}66`,
                          color: p.color,
                        }
                      : undefined
                  }
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] tracking-widest text-haze">{preset.description}</p>

          <MixerRow
            name="音量"
            description="マスター音量"
            color={preset.color}
            value={masterVol}
            onChange={changeMasterVol}
          />
        </section>
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClearData={() => void handleClearData()}
      />
    </>
  );
}
