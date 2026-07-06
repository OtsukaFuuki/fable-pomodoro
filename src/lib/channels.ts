// ミキサー 6 チャンネルの定義（UI 用メタデータ + ファクトリ参照）
import {
  createFurinChannel,
  createInsectChannel,
  createPadChannel,
  createRainChannel,
  createWaveChannel,
  createWindChannel,
  type ChannelFactory,
} from "./audio-engine";

export type ChannelId = "rain" | "wave" | "wind" | "furin" | "pad" | "insect";

export interface ChannelDef {
  id: ChannelId;
  name: string;
  description: string;
  color: string;
  create: ChannelFactory;
}

export const CHANNELS: ChannelDef[] = [
  {
    id: "rain",
    name: "雨",
    description: "しとしとと降りつづく",
    color: "#9DB8F0",
    create: createRainChannel,
  },
  {
    id: "wave",
    name: "波",
    description: "寄せては返す遠い渚",
    color: "#8FE0DC",
    create: createWaveChannel,
  },
  {
    id: "wind",
    name: "風",
    description: "梢を渡るざわめき",
    color: "#C9B4F2",
    create: createWindChannel,
  },
  {
    id: "furin",
    name: "風鈴",
    description: "ふと鳴る澄んだ音",
    color: "#F2D091",
    create: createFurinChannel,
  },
  {
    id: "pad",
    name: "パッド",
    description: "低くあたたかい持続音",
    color: "#E8A8D8",
    create: createPadChannel,
  },
  {
    id: "insect",
    name: "虫の音",
    description: "夜のリズム",
    color: "#A8E8B0",
    create: createInsectChannel,
  },
];

export const DEFAULT_VOLUMES: Record<ChannelId, number> = {
  rain: 50,
  wave: 50,
  wind: 50,
  furin: 50,
  pad: 50,
  insect: 50,
};
