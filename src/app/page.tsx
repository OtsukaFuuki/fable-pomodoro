// Phase 1: 円形リング + 集中⇄休憩の状態機械 + 2 カラムレイアウト（md+）
"use client";
import { useEffect, useRef, useState } from "react";
import { MixerRow } from "@/components/MixerRow";
import { ModeLabel } from "@/components/ModeLabel";
import { TimerRing } from "@/components/TimerRing";
import {
  CHANNELS,
  DEFAULT_VOLUMES,
  type ChannelId,
} from "@/lib/channels";
import {
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
} from "@/lib/pomodoro";
import { formatMmSs } from "@/lib/timer";
import type { PomodoroState } from "@/lib/types";

const PILL_BTN =
  "min-h-11 rounded-full border px-6 text-sm tracking-widest transition-shadow duration-700";

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

export default function Home() {
  const [pomodoro, setPomodoro] = useState<PomodoroState>(createInitialState);
  const [, redraw] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const running = isRunning(pomodoro.phase);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => redraw((n) => n + 1), 250);
    const onVisibility = () => {
      if (document.hidden) return;
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

  const timerLabel =
    pomodoro.phase.mode === "idle" ? "開始" : running ? "一時停止" : "再開";

  const focusMin = Math.round(pomodoro.settings.focusMs / 60_000);
  const breakMin = Math.round(pomodoro.settings.breakMs / 60_000);

  // --- ミキサー: 6 チャンネル + マスター音量 + 一括停止（spec §3.2） ---
  const [playing, setPlaying] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [volumes, setVolumes] = useState(DEFAULT_VOLUMES);
  const channels = useRef<Partial<Record<ChannelId, Channel>>>({});

  useEffect(
    () => () => {
      Object.values(channels.current).forEach((ch) => ch?.dispose());
      channels.current = {};
    },
    [],
  );

  const ensureChannel = (id: ChannelId): Channel => {
    if (!channels.current[id]) {
      const def = CHANNELS.find((d) => d.id === id)!;
      channels.current[id] = def.create();
    }
    return channels.current[id]!;
  };

  const applyChannelVolume = (id: ChannelId, v: number) => {
    if (v > 0 && playing) ensureChannel(id).setVolume(v / 100);
    else if (channels.current[id]) channels.current[id]!.setVolume(v / 100);
  };

  const togglePlay = () => {
    if (playing) {
      void suspendAll();
      setPlaying(false);
      return;
    }
    ensureContext();
    setMasterVolume(masterVol / 100);
    CHANNELS.forEach((def) => {
      const vol = volumes[def.id];
      if (vol > 0) ensureChannel(def.id).setVolume(vol / 100);
    });
    setPlaying(true);
  };

  const changeMasterVol = (v: number) => {
    setMasterVol(v);
    setMasterVolume(v / 100);
  };

  const changeChannelVol = (id: ChannelId, v: number) => {
    setVolumes((prev) => ({ ...prev, [id]: v }));
    applyChannelVolume(id, v);
  };

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl grid-cols-1 gap-5 px-5 pb-10 pt-8 md:grid-cols-2 md:items-start md:gap-8 md:px-8">
      <header className="md:col-span-2">
        <h1 className="text-center text-sm font-light tracking-[0.5em] text-haze">夜凪</h1>
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
            className={`${PILL_BTN} border-haze/30 text-haze shadow-[0_0_12px_rgba(138,147,168,0.1)] hover:shadow-[0_0_20px_rgba(138,147,168,0.2)]`}
          >
            リセット
          </button>
          <button
            type="button"
            onClick={toggleTimer}
            className={`${PILL_BTN} border-moon/40 text-moon shadow-[0_0_16px_rgba(174,184,244,0.15)] hover:shadow-[0_0_28px_rgba(174,184,244,0.35)]`}
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
            {timerLabel}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={pomodoro.phase.mode === "idle"}
            className={`${PILL_BTN} border-haze/30 text-haze shadow-[0_0_12px_rgba(138,147,168,0.1)] hover:shadow-[0_0_20px_rgba(138,147,168,0.2)] disabled:cursor-not-allowed disabled:opacity-40`}
          >
            スキップ
          </button>
        </div>

        <p className="text-[11px] tracking-widest text-haze/80">
          集中 {focusMin} 分 · 休憩 {breakMin} 分
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-frost/5 bg-panel px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="shrink-0 text-xs tracking-widest text-haze">環境音</h2>
          <button
            type="button"
            onClick={togglePlay}
            className={`${PILL_BTN} shrink-0 border-moon/40 px-8 text-moon shadow-[0_0_16px_rgba(174,184,244,0.15)] hover:shadow-[0_0_28px_rgba(174,184,244,0.35)]`}
          >
            {playing ? "一時停止" : "再生"}
          </button>
        </div>

        <MixerRow
          name="全体"
          description="マスター音量"
          color="#AEB8F4"
          value={masterVol}
          onChange={changeMasterVol}
        />

        {CHANNELS.map((def) => (
          <MixerRow
            key={def.id}
            name={def.name}
            description={def.description}
            color={def.color}
            value={volumes[def.id]}
            onChange={(v) => changeChannelVol(def.id, v)}
          />
        ))}
      </section>
    </main>
  );
}
