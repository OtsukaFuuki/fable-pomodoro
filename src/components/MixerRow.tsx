// ミキサー 1 行: 名前 + 説明 + GlowSlider + 数値表示（spec §3.2）
import { GlowSlider } from "./GlowSlider";

interface MixerRowProps {
  name: string;
  description: string;
  color: string;
  value: number;
  onChange(v: number): void;
}

export function MixerRow({ name, description, color, value, onChange }: MixerRowProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-frost">
          {name}
          <span className="ml-3 text-[11px] text-haze">{description}</span>
        </p>
        <p className="text-xs tabular-nums text-haze">{value}</p>
      </div>
      <GlowSlider value={value} onChange={onChange} color={color} label={`${name}の音量`} />
    </div>
  );
}
