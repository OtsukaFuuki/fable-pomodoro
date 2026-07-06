// 垂直スライスの見本: リング無しの数字タイマー（開始/一時停止のみ）+ 雨 1 チャンネルのミキサー。
// 円形リング・集中⇄休憩の状態機械・他チャンネル・永続化は Phase 1 以降（docs/handoff.md 参照）
"use client";
import { useEffect, useRef, useState } from "react";
import { GlowSlider } from "@/components/GlowSlider";
import { createRainChannel, ensureContext, suspendAll, type Channel } from "@/lib/audio-engine";
import {
  formatMmSs,
  getRemainingMs,
  pauseCountdown,
  resumeCountdown,
  startCountdown,
  type CountdownState,
} from "@/lib/timer";

const FOCUS_MS = 25 * 60 * 1000; // 分数のカスタムはステッパーごと Phase 3 で

export default function Home() {
  // --- タイマー。時間の真実は countdown が持ち、interval は表示の再描画にしか使わない ---
  const [countdown, setCountdown] = useState<CountdownState>({
    endTime: null,
    remainingMs: FOCUS_MS,
    running: false,
  });
  const [, redraw] = useState(0);

  useEffect(() => {
    if (!countdown.running) return;
    const id = window.setInterval(() => redraw((n) => n + 1), 250);
    // バックグラウンド復帰時は interval を待たずに即再計算する（spec §3.1）
    const onVisibility = () => {
      if (!document.hidden) redraw((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [countdown.running]);

  const remainingMs = getRemainingMs(countdown);

  useEffect(() => {
    // 0 到達で停止するだけ。チャイムと自動フェーズ切替は Phase 1 の状態機械で入れる
    if (countdown.running && remainingMs === 0) {
      setCountdown({ endTime: null, remainingMs: 0, running: false });
    }
  }, [countdown, remainingMs]);

  const toggleTimer = () => {
    if (countdown.running) setCountdown(pauseCountdown(countdown));
    else if (remainingMs === 0) setCountdown(startCountdown(FOCUS_MS));
    else setCountdown(resumeCountdown(countdown));
  };

  const paused = !countdown.running && remainingMs !== FOCUS_MS && remainingMs !== 0;
  const timerLabel = countdown.running ? "一時停止" : paused ? "再開" : "開始";

  // --- ミキサー。AudioContext はユーザー操作の中でしか生成/resume しない（iOS 制限。spec §4.1） ---
  const [playing, setPlaying] = useState(false);
  const [rainVolume, setRainVolume] = useState(50);
  const rain = useRef<Channel | null>(null);

  useEffect(() => () => rain.current?.dispose(), []);

  const togglePlay = () => {
    if (playing) {
      void suspendAll();
      setPlaying(false);
      return;
    }
    ensureContext(); // 初回はここで生成、2 回目以降は resume
    if (!rain.current) rain.current = createRainChannel();
    rain.current.setVolume(rainVolume / 100); // 生成前に動かしたスライダー値をここで反映
    setPlaying(true);
  };

  const changeRainVolume = (v: number) => {
    setRainVolume(v);
    rain.current?.setVolume(v / 100); // context 未生成なら値の保持のみ（初回再生時に反映される）
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pb-10 pt-8">
      <header>
        <h1 className="text-center text-sm font-light tracking-[0.5em] text-haze">夜凪</h1>
      </header>

      <section className="flex flex-col items-center gap-8 rounded-2xl border border-frost/5 bg-panel px-6 py-12">
        <p className="flex items-center gap-2 text-xs tracking-widest text-haze">
          <span className="h-1.5 w-1.5 rounded-full bg-moon shadow-[0_0_8px_#AEB8F4]" aria-hidden />
          集中
        </p>
        <p
          className={`text-6xl font-light tabular-nums tracking-widest text-frost transition-opacity duration-700 ${
            paused ? "opacity-60" : ""
          }`}
          style={{ textShadow: "0 0 32px rgba(174, 184, 244, 0.25)" }}
        >
          {formatMmSs(remainingMs)}
        </p>
        <button
          type="button"
          onClick={toggleTimer}
          className="min-h-11 rounded-full border border-moon/40 px-10 text-sm tracking-widest text-moon shadow-[0_0_16px_rgba(174,184,244,0.15)] transition-shadow duration-700 hover:shadow-[0_0_28px_rgba(174,184,244,0.35)]"
        >
          {timerLabel}
        </button>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-frost/5 bg-panel px-6 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs tracking-widest text-haze">環境音</h2>
          <button
            type="button"
            onClick={togglePlay}
            className="min-h-11 rounded-full border border-moon/40 px-8 text-sm tracking-widest text-moon shadow-[0_0_16px_rgba(174,184,244,0.15)] transition-shadow duration-700 hover:shadow-[0_0_28px_rgba(174,184,244,0.35)]"
          >
            {playing ? "一時停止" : "再生"}
          </button>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-frost">
              雨<span className="ml-3 text-[11px] text-haze">しとしとと降りつづく</span>
            </p>
            <p className="text-xs tabular-nums text-haze">{rainVolume}</p>
          </div>
          <GlowSlider value={rainVolume} onChange={changeRainVolume} color="#9DB8F0" label="雨の音量" />
        </div>
      </section>
    </main>
  );
}
