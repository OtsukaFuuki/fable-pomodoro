// モードラベル: ● 集中 / ● 休憩。休憩中は wave 系の色へクロスフェード（spec §3.1）

interface ModeLabelProps {
  breakMode: boolean;
}

export function ModeLabel({ breakMode }: ModeLabelProps) {
  const color = breakMode ? "#8FE0DC" : "#AEB8F4";
  const label = breakMode ? "休憩" : "集中";

  return (
    <p
      className="flex items-center gap-2 text-xs tracking-widest text-haze transition-colors duration-700"
      style={{ color: breakMode ? "#8FE0DC" : undefined }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full transition-all duration-700"
        style={{
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
        aria-hidden
      />
      {label}
    </p>
  );
}
