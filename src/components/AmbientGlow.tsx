// 選択中プリセットの色で四隅が呼吸する背景演出
"use client";

interface AmbientGlowProps {
  playing: boolean;
  color: string;
  volume: number; // 0..100
  reducedMotion: boolean;
}

const CORNERS = ["left-0 top-0", "right-0 top-0", "left-0 bottom-0", "right-0 bottom-0"];

export function AmbientGlow({ playing, color, volume, reducedMotion }: AmbientGlowProps) {
  if (!playing || volume === 0) return null;

  const opacity = (volume / 100) * 0.2;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {CORNERS.map((position) => {
        const gradient = `radial-gradient(ellipse at ${
          position.includes("left") ? "0%" : "100%"
        } ${position.includes("top") ? "0%" : "100%"}, ${color}55 0%, transparent 70%)`;

        return (
          <div
            key={position}
            className={`absolute h-[45vh] w-[45vw] ${position}`}
            style={{ opacity }}
          >
            <div
              className={`h-full w-full ${reducedMotion ? "" : "animate-corner-breathe"}`}
              style={{ background: gradient }}
            />
          </div>
        );
      })}
    </div>
  );
}
