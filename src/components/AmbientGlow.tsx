// 背景四隅の呼吸グラデーション。鳴っているチャンネルの色だけが音量に応じて息づく（spec §2.1）
"use client";
import { CHANNELS, type ChannelId } from "@/lib/channels";

interface AmbientGlowProps {
  playing: boolean;
  volumes: Record<ChannelId, number>;
  reducedMotion: boolean;
}

const CORNERS: { position: string; channels: ChannelId[] }[] = [
  { position: "left-0 top-0", channels: ["rain"] },
  { position: "right-0 top-0", channels: ["wave"] },
  { position: "left-0 bottom-0", channels: ["wind", "pad"] },
  { position: "right-0 bottom-0", channels: ["furin", "insect"] },
];

const COLOR_MAP = Object.fromEntries(CHANNELS.map((c) => [c.id, c.color])) as Record<
  ChannelId,
  string
>;

function cornerOpacity(playing: boolean, volumes: Record<ChannelId, number>, ids: ChannelId[]): number {
  if (!playing) return 0;
  let max = 0;
  for (const id of ids) {
    if (volumes[id] > 0) max = Math.max(max, volumes[id] / 100);
  }
  return max * 0.22;
}

export function AmbientGlow({ playing, volumes, reducedMotion }: AmbientGlowProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {CORNERS.map(({ position, channels }) => {
        const opacity = cornerOpacity(playing, volumes, channels);
        const primary = COLOR_MAP[channels[0]];
        if (opacity === 0) return null;

        const gradient = `radial-gradient(ellipse at ${
          position.includes("left") ? "0%" : "100%"
        } ${position.includes("top") ? "0%" : "100%"}, ${primary}55 0%, transparent 70%)`;

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
