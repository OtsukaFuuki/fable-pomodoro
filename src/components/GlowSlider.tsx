// 自作スライダー: 素の input[type=range] を使わない理由は見た目の再現性（spec §2.2）
// Pointer Events で実装し、トラック左側とつまみをチャンネルカラーで発光させる。
// ドラッグ中はつまみの上に現在値をフロート表示する
"use client";
import { useRef, useState } from "react";

interface GlowSliderProps {
  value: number;            // 0..100
  onChange(v: number): void;
  color: string;            // 例 "#9DB8F0"（tailwind トークンの実値）
  label: string;
}

export function GlowSlider({ value, onChange, color, label }: GlowSliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(Math.round(ratio * 100));
  };

  return (
    <div
      ref={track}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      // トラック自体を 44px 高のタップ領域にする（見た目の線は 2px でも触れる範囲は太く）
      className="relative flex h-11 w-full cursor-pointer touch-none items-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        pick(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && pick(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onChange(Math.min(100, value + 5));
        if (e.key === "ArrowLeft") onChange(Math.max(0, value - 5));
      }}
    >
      <div className="h-0.5 w-full rounded bg-haze/30" />
      <div
        className="absolute h-0.5 rounded"
        style={{ width: `${value}%`, background: color, boxShadow: `0 0 8px ${color}66` }}
      />
      <div
        className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full"
        style={{ left: `${value}%`, background: color, boxShadow: `0 0 12px ${color}AA` }}
      />
      {dragging && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 text-[11px] tabular-nums"
          style={{ left: `${value}%`, color, textShadow: `0 0 8px ${color}88` }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
