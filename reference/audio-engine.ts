// 環境音合成エンジンの最小形: マスター + 「雨」チャンネル 1 つ + チャイム
// なぜ合成か: 音源ファイル不要（権利・容量・継ぎ目の問題が消える）。docs/decisions.md 参照

export interface Channel {
  readonly id: string;
  setVolume(v: number): void; // 0..1。0 でソース停止、>0 で必要なら起動
  dispose(): void;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

// なぜ遅延生成か: iOS はユーザー操作なしに AudioContext を鳴らせない。
// 必ずボタンハンドラ等のジェスチャ内から呼ぶこと
export function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); // 事故的な音割れの保険
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMasterVolume(v: number): void {
  if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

export async function suspendAll(): Promise<void> { await ctx?.suspend(); }

function makeNoiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// 雨 = ローパスしたホワイトノイズ。粒感（インパルス）は第2走者が同じ作法で足す
export function createRainChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  let src: AudioBufferSourceNode | null = null;

  const start = () => {
    if (src) return;
    src = c.createBufferSource();
    src.buffer = makeNoiseBuffer(c);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200; // 高域を落として「遠い雨」にする
    src.connect(lp).connect(gain);
    src.start();
  };
  const stop = () => { src?.stop(); src?.disconnect(); src = null; };

  return {
    id: "rain",
    setVolume(v: number) {
      if (v > 0) start(); else stop(); // 無音を流し続けない（バッテリー配慮）
      gain.gain.setTargetAtTime(v * 0.5, c.currentTime, 0.1); // 0.5 = チャンネル上限。うるさくしない
    },
    dispose() { stop(); gain.disconnect(); },
  };
}

// チャイム: 2 音 + 減衰。フェーズ切替時に呼ぶ
export function playChime(): void {
  const c = ensureContext();
  const notes = [659.25, 880]; // E5 → A5
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.35;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(g).connect(master!);
    osc.start(t);
    osc.stop(t + 1.3);
  });
}
