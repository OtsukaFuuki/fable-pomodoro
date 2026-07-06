// BGM プリセット定義。各プリセットは複数 MP3 を順番に再生してループする
export type PresetId = "jazz";

export interface AudioPreset {
  id: PresetId;
  name: string;
  description: string;
  color: string;
  files: string[];
}

export const AUDIO_PRESETS: AudioPreset[] = [
  {
    id: "jazz",
    name: "Jazz",
    description: "",
    color: "#F2D091",
    files: ["/audio/jazz/jazz1.mp3", "/audio/jazz/jazz2.mp3", "/audio/jazz/jazz3.mp3"],
  },
];

export const DEFAULT_PRESET: PresetId = "jazz";

export function getPreset(id: PresetId): AudioPreset {
  return AUDIO_PRESETS.find((p) => p.id === id) ?? AUDIO_PRESETS[0];
}
