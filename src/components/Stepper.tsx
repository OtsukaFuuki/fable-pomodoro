// 分数ステッパー: 素の number input 禁止（spec §2.2）。± タップ + 長押し連続変化（1〜99 分）
"use client";
import { useCallback, useEffect, useRef } from "react";

interface StepperProps {
  label: string;
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const HOLD_DELAY_MS = 400;
const HOLD_INTERVAL_MS = 80;

export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: StepperProps) {
  const holdTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const deltaRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const clearTimers = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (repeatTimer.current !== null) {
      window.clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max],
  );

  const beginHold = (delta: number) => {
    if (disabled) return;
    deltaRef.current = delta;
    clearTimers();
    onChange(clamp(valueRef.current + delta));
    holdTimer.current = window.setTimeout(() => {
      repeatTimer.current = window.setInterval(() => {
        onChange(clamp(valueRef.current + deltaRef.current));
      }, HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  };

  const btnClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-moon/30 text-lg text-moon shadow-[0_0_12px_rgba(174,184,244,0.12)] transition-shadow duration-700 hover:shadow-[0_0_20px_rgba(174,184,244,0.28)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-xs tracking-widest text-haze">{label}</span>
      <button
        type="button"
        aria-label={`${label}を減らす`}
        disabled={disabled || value <= min}
        className={btnClass}
        onPointerDown={() => beginHold(-1)}
        onPointerUp={clearTimers}
        onPointerCancel={clearTimers}
        onPointerLeave={clearTimers}
      >
        −
      </button>
      <span
        className="min-w-[3ch] text-center text-sm font-light tabular-nums tracking-widest text-frost"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`${label}を増やす`}
        disabled={disabled || value >= max}
        className={btnClass}
        onPointerDown={() => beginHold(1)}
        onPointerUp={clearTimers}
        onPointerCancel={clearTimers}
        onPointerLeave={clearTimers}
      >
        ＋
      </button>
      <span className="text-xs text-haze">分</span>
    </div>
  );
}
