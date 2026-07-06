// BGM エンジン: プリセット内の MP3 を順番に再生してループ + チャイム
import { getPreset, type PresetId } from "./audio-presets";

export interface Channel {
  readonly id: string;
  setVolume(v: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const bufferCache = new Map<string, AudioBuffer>();

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

/** プリセット内のファイルを 1 → 2 → 3 → 1 … と順番に再生する */
export function createPresetPlayer(presetId: PresetId): Channel {
  const preset = getPreset(presetId);
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  let active = false;
  let buffers: (AudioBuffer | null)[] | null = null;
  let currentSrc: AudioBufferSourceNode | null = null;
  let trackIndex = 0;
  let offsetSec = 0;
  let startedAt = 0;

  const stopCurrent = () => {
    if (!currentSrc) return;
    currentSrc.onended = null;
    try {
      currentSrc.stop();
    } catch {
      /* 未開始なら無視 */
    }
    currentSrc.disconnect();
    currentSrc = null;
  };

  const playAt = (index: number, offset = 0) => {
    if (!active || !buffers || buffers.length === 0) return;

    const buf = buffers[index];
    if (!buf) {
      playAt((index + 1) % buffers.length, 0);
      return;
    }

    const safeOffset = Math.min(Math.max(0, offset), Math.max(0, buf.duration - 0.01));

    stopCurrent();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = false;
    src.connect(gain);
    trackIndex = index;
    offsetSec = safeOffset;
    startedAt = c.currentTime - safeOffset;
    const next = (index + 1) % buffers.length;
    src.onended = () => {
      if (active) playAt(next, 0);
    };
    src.start(0, safeOffset);
    currentSrc = src;
  };

  const ensureBuffers = () =>
    buffers
      ? Promise.resolve(buffers)
      : Promise.all(preset.files.map((url) => loadAudioBuffer(c, url))).then((loaded) => {
          buffers = loaded;
          return loaded;
        });

  return {
    id: preset.id,
    setVolume(v: number) {
      gain.gain.setTargetAtTime(v * 0.85, c.currentTime, 0.1);
    },
    pause() {
      if (!active) return;
      if (currentSrc) {
        offsetSec = c.currentTime - startedAt;
        const buf = buffers?.[trackIndex];
        if (buf) offsetSec = Math.min(Math.max(0, offsetSec), Math.max(0, buf.duration - 0.01));
      }
      active = false;
      stopCurrent();
    },
    resume() {
      if (active) return;
      active = true;
      void ensureBuffers().then((loaded) => {
        if (!active) return;
        if (!loaded.some((b) => b)) {
          active = false;
          return;
        }
        playAt(trackIndex, offsetSec);
      });
    },
    dispose() {
      active = false;
      stopCurrent();
      gain.disconnect();
    },
  };
}

export function playChime(): void {
  const c = ensureContext();
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
