// 環境音エンジン: マスター + 6 チャンネル（音声ファイル再生）+ チャイム
// 音源は public/audio/ に配置した MP3 を Web Audio API でループ再生する
// ミキシング（音量・停止・マスター）は従来どおり Channel インターフェースで閉じ込める

import type { ChannelId } from "./channels";

export interface Channel {
  readonly id: string;
  setVolume(v: number): void; // 0..1。0 でソース停止、>0 で必要なら起動
  dispose(): void;
}

/** public/audio/ 内のファイル名（拡張子 .mp3 固定） */
export const AUDIO_PATHS: Record<ChannelId, string> = {
  rain: "/audio/rain.mp3",
  wave: "/audio/wave.mp3",
  wind: "/audio/wind.mp3",
  furin: "/audio/furin.mp3",
  pad: "/audio/pad.mp3",
  insect: "/audio/insect.mp3",
};

const CHIME_PATH = "/audio/chime.mp3";

/** チャンネルごとのゲイン上限（ファイル側の音量も調整してください） */
const GAIN_CAPS: Record<ChannelId, number> = {
  rain: 0.7,
  wave: 0.7,
  wind: 0.65,
  furin: 0.6,
  pad: 0.6,
  insect: 0.55,
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const bufferCache = new Map<string, AudioBuffer>();

// なぜ遅延生成か: iOS はユーザー操作なしに AudioContext を鳴らせない。
// 必ずボタンハンドラ等のジェスチャ内から呼ぶこと
export function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMasterVolume(v: number): void {
  if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

export async function suspendAll(): Promise<void> {
  await ctx?.suspend();
}

async function loadAudioBuffer(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    const buf = await c.decodeAudioData(data);
    bufferCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

function createFileChannel(id: ChannelId, url: string, gainCap: number): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  let src: AudioBufferSourceNode | null = null;
  let loading: Promise<AudioBuffer | null> | null = null;
  let active = false;

  const stop = () => {
    active = false;
    try {
      src?.stop();
    } catch {
      /* 未開始なら無視 */
    }
    src?.disconnect();
    src = null;
  };

  const start = () => {
    if (src || active) return;
    active = true;

    if (!loading) loading = loadAudioBuffer(c, url);
    void loading.then((buf) => {
      if (!active || !buf) {
        active = false;
        if (!buf) loading = null;
        return;
      }
      src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      src.start();
    });
  };

  return {
    id,
    setVolume(v: number) {
      if (v > 0) start();
      else stop();
      gain.gain.setTargetAtTime(v * gainCap, c.currentTime, 0.1);
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
}

export function createRainChannel(): Channel {
  return createFileChannel("rain", AUDIO_PATHS.rain, GAIN_CAPS.rain);
}
export function createWaveChannel(): Channel {
  return createFileChannel("wave", AUDIO_PATHS.wave, GAIN_CAPS.wave);
}
export function createWindChannel(): Channel {
  return createFileChannel("wind", AUDIO_PATHS.wind, GAIN_CAPS.wind);
}
export function createFurinChannel(): Channel {
  return createFileChannel("furin", AUDIO_PATHS.furin, GAIN_CAPS.furin);
}
export function createPadChannel(): Channel {
  return createFileChannel("pad", AUDIO_PATHS.pad, GAIN_CAPS.pad);
}
export function createInsectChannel(): Channel {
  return createFileChannel("insect", AUDIO_PATHS.insect, GAIN_CAPS.insect);
}

export type ChannelFactory = () => Channel;

export const CHANNEL_FACTORIES: Record<string, ChannelFactory> = {
  rain: createRainChannel,
  wave: createWaveChannel,
  wind: createWindChannel,
  furin: createFurinChannel,
  pad: createPadChannel,
  insect: createInsectChannel,
};

// チャイム: chime.mp3 があれば再生、なければ簡易合成にフォールバック
export function playChime(): void {
  const c = ensureContext();
  void loadAudioBuffer(c, CHIME_PATH).then((buf) => {
    if (buf) {
      const src = c.createBufferSource();
      const g = c.createGain();
      g.gain.value = 0.5;
      src.buffer = buf;
      src.connect(g).connect(master!);
      src.start();
      return;
    }
    playSyntheticChime(c);
  });
}

function playSyntheticChime(c: AudioContext): void {
  const notes = [659.25, 880];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.35;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.connect(g).connect(master!);
    osc.start(t);
    osc.stop(t + 1.1);
  });
}
