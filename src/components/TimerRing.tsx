// SVG 円形プログレスリング。線幅 2px + グロー、一時停止中は 2s 周期の明滅（spec §2.2 / §3.1）

interface TimerRingProps {
  progress: number; // 0..1 残り比率
  breakMode: boolean;
  paused: boolean;
  reducedMotion: boolean;
}

const R = 88;
const C = 2 * Math.PI * R;

export function TimerRing({ progress, breakMode, paused, reducedMotion }: TimerRingProps) {
  const moon = "#AEB8F4";
  const wave = "#8FE0DC";
  const color = breakMode ? wave : moon;
  const offset = C * (1 - progress);

  return (
    <div
      className={`relative ${paused && !reducedMotion ? "animate-ring-breathe" : ""}`}
      style={{ width: 200, height: 200 }}
    >
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full -rotate-90"
        aria-hidden
      >
        <defs>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="rgba(138, 147, 168, 0.2)"
          strokeWidth={2}
        />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          filter="url(#ring-glow)"
          className="transition-[stroke] duration-700"
          style={{
            opacity: paused ? 0.55 : 1,
            transition: "stroke 0.7s ease, stroke-dashoffset 0.25s linear, opacity 0.7s ease",
          }}
        />
      </svg>
    </div>
  );
}
