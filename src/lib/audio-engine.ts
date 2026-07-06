// 環境音合成エンジン: マスター + 6 チャンネル + チャイム
// なぜ合成か: 音源ファイル不要（権利・容量・継ぎ目の問題が消える）。docs/decisions.md 参照
// チャンネルの追加は createRainChannel の作法に従う:
// 生成した AudioNode はチャンネルの中に閉じ込め、外には setVolume / dispose だけを見せる

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

export async function suspendAll(): Promise<void> {
  await ctx?.suspend();
}

function makeNoiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ピンクノイズ: 1/f スペクトル。風チャンネル用（spec §3.2）
function makePinkNoiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buf;
}

// ブラウンノイズ: 低域寄り。波チャンネル用（spec §3.2）
function makeBrownNoiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

// 雨 = ローパスしたホワイトノイズ（遠い雨のベース）+ ランダムな雨粒インパルス。
// 雨粒のようなランダムイベントは setTimeout で直接鳴らさず、先読みスケジューラで駆動する（spec §4.1）:
// 0.5s ごとの tick で、AudioContext.currentTime 基準の発音時刻を約 1.5s 先まで予約しておく。
// タブがスロットルされて tick が遅れても、予約済みの分は途切れずに鳴る
export function createRainChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  const noise = makeNoiseBuffer(c);
  let src: AudioBufferSourceNode | null = null;
  let schedulerId: number | null = null;
  let nextDropAt = 0;

  const scheduleDrop = (t: number) => {
    const drop = c.createBufferSource();
    drop.buffer = noise;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900 + Math.random() * 1400;
    bp.Q.value = 10;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.12 + Math.random() * 0.08, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    drop.connect(bp).connect(env).connect(gain);
    drop.start(t, Math.random() * 1.5, 0.1);
    drop.stop(t + 0.12);
  };

  const tick = () => {
    if (nextDropAt < c.currentTime) nextDropAt = c.currentTime;
    const horizon = c.currentTime + 1.5;
    while (nextDropAt < horizon) {
      scheduleDrop(nextDropAt);
      nextDropAt += 0.12 + Math.random() * 0.5;
    }
  };

  const start = () => {
    if (src) return;
    src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    src.connect(lp).connect(gain);
    src.start();
    nextDropAt = c.currentTime + 0.3;
    tick();
    schedulerId = window.setInterval(tick, 500);
  };

  const stop = () => {
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
    src?.stop();
    src?.disconnect();
    src = null;
  };

  return {
    id: "rain",
    setVolume(v: number) {
      if (v > 0) start();
      else stop();
      gain.gain.setTargetAtTime(v * 0.5, c.currentTime, 0.1);
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
}

// 波 = ブラウンノイズ + 超低速 LFO（8〜12s 周期）で寄せ引き（spec §3.2）
export function createWaveChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  const noise = makeBrownNoiseBuffer(c);
  let src: AudioBufferSourceNode | null = null;
  let lfo: OscillatorNode | null = null;
  let swellGain: GainNode | null = null;

  const start = () => {
    if (src) return;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 750;

    swellGain = c.createGain();
    swellGain.gain.value = 0.55;

    lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1 / (8 + Math.random() * 4);
    const lfoAmp = c.createGain();
    lfoAmp.gain.value = 0.22;
    lfo.connect(lfoAmp).connect(swellGain.gain);

    src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.connect(lp).connect(swellGain).connect(gain);
    src.start();
    lfo.start();
  };

  const stop = () => {
    try {
      lfo?.stop();
    } catch {
      /* 未開始なら無視 */
    }
    lfo?.disconnect();
    src?.stop();
    src?.disconnect();
    swellGain?.disconnect();
    src = null;
    lfo = null;
    swellGain = null;
  };

  return {
    id: "wave",
    setVolume(v: number) {
      if (v > 0) start();
      else stop();
      gain.gain.setTargetAtTime(v * 0.45, c.currentTime, 0.1);
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
}

// 風 = ピンクノイズ + 中心周波数がゆっくり彷徨うバンドパス（spec §3.2）
export function createWindChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  const noise = makePinkNoiseBuffer(c);
  let src: AudioBufferSourceNode | null = null;
  let bp: BiquadFilterNode | null = null;
  let wanderId: number | null = null;

  const wander = () => {
    if (!bp) return;
    const target = 400 + Math.random() * 900;
    bp.frequency.setTargetAtTime(target, c.currentTime, 2 + Math.random() * 3);
  };

  const start = () => {
    if (src) return;
    bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.6;
    bp.frequency.value = 700;
    src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.connect(bp).connect(gain);
    src.start();
    wander();
    wanderId = window.setInterval(wander, 4000 + Math.random() * 3000);
  };

  const stop = () => {
    if (wanderId !== null) {
      window.clearInterval(wanderId);
      wanderId = null;
    }
    src?.stop();
    src?.disconnect();
    bp?.disconnect();
    src = null;
    bp = null;
  };

  return {
    id: "wind",
    setVolume(v: number) {
      if (v > 0) start();
      else stop();
      gain.gain.setTargetAtTime(v * 0.4, c.currentTime, 0.1);
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
}

// 風鈴 = ペンタトニックの短い減衰音。8〜25s 間隔でランダム（spec §3.2）
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880];

export function createFurinChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  let schedulerId: number | null = null;
  let nextAt = 0;
  let active = false;

  const scheduleBell = (t: number) => {
    const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    [1, 2, 3].forEach((h) => {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * h;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.07 / h, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 + Math.random() * 0.6);
      osc.connect(env).connect(gain);
      osc.start(t);
      osc.stop(t + 2);
    });
  };

  const tick = () => {
    if (!active) return;
    if (nextAt < c.currentTime) nextAt = c.currentTime + 2;
    const horizon = c.currentTime + 2;
    while (nextAt < horizon) {
      scheduleBell(nextAt);
      nextAt += 8 + Math.random() * 17;
    }
  };

  const start = () => {
    if (schedulerId !== null) return;
    active = true;
    nextAt = c.currentTime + 3 + Math.random() * 5;
    tick();
    schedulerId = window.setInterval(tick, 500);
  };

  const stop = () => {
    active = false;
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
  };

  return {
    id: "furin",
    setVolume(v: number) {
      if (v > 0) start();
      else stop();
      gain.gain.setTargetAtTime(v * 0.35, c.currentTime, 0.1);
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
}

// パッド = デチューンした正弦波 2〜3 本 + ゆっくり動くローパス（spec §3.2）
export function createPadChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  const oscs: OscillatorNode[] = [];
  let lp: BiquadFilterNode | null = null;
  let lfo: OscillatorNode | null = null;
  let running = false;

  const start = () => {
    if (running) return;
    running = true;
    lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 550;

    lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.04;
    const lfoAmp = c.createGain();
    lfoAmp.gain.value = 180;
    lfo.connect(lfoAmp).connect(lp.frequency);
    lfo.start();

    const freqs = [110, 164.81, 220];
    const detunes = [-14, 0, 9];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.detune.value = detunes[i];
      osc.connect(lp!);
      osc.start();
      oscs.push(osc);
    });
    lp!.connect(gain);
  };

  const stop = () => {
    if (!running) return;
    running = false;
    try {
      lfo?.stop();
    } catch {
      /* 未開始なら無視 */
    }
    lfo?.disconnect();
    oscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* 未開始なら無視 */
      }
      o.disconnect();
    });
    oscs.length = 0;
    lp?.disconnect();
    lp = null;
    lfo = null;
  };

  return {
    id: "pad",
    setVolume(v: number) {
      if (v > 0) start();
      else stop();
      gain.gain.setTargetAtTime(v * 0.35, c.currentTime, 0.1);
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
}

// 虫の音 = 高域の短いチャープをリズミカルなクラスタで（spec §3.2）
export function createInsectChannel(): Channel {
  const c = ensureContext();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master!);

  let schedulerId: number | null = null;
  let nextAt = 0;
  let active = false;

  const scheduleCluster = (t: number) => {
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const ct = t + i * (0.08 + Math.random() * 0.12);
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = "sine";
      osc.frequency.value = 2800 + Math.random() * 2200;
      env.gain.setValueAtTime(0.0001, ct);
      env.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.03, ct + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, ct + 0.035);
      osc.connect(env).connect(gain);
      osc.start(ct);
      osc.stop(ct + 0.05);
    }
  };

  const tick = () => {
    if (!active) return;
    if (nextAt < c.currentTime) nextAt = c.currentTime;
    const horizon = c.currentTime + 1.5;
    while (nextAt < horizon) {
      scheduleCluster(nextAt);
      nextAt += 1.5 + Math.random() * 4;
    }
  };

  const start = () => {
    if (schedulerId !== null) return;
    active = true;
    nextAt = c.currentTime + 0.5;
    tick();
    schedulerId = window.setInterval(tick, 500);
  };

  const stop = () => {
    active = false;
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
  };

  return {
    id: "insect",
    setVolume(v: number) {
      if (v > 0) start();
      else stop();
      gain.gain.setTargetAtTime(v * 0.3, c.currentTime, 0.1);
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
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

// チャイム: 2 音 + 減衰 + フィードバックディレイ 1 段の残響（spec §4.1）
export function playChime(): void {
  const c = ensureContext();
  const notes = [659.25, 880]; // E5 → A5

  const delay = c.createDelay(0.5);
  delay.delayTime.value = 0.28;
  const feedback = c.createGain();
  feedback.gain.value = 0.32;
  const wet = c.createGain();
  wet.gain.value = 0.18;
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master!);

  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.35;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(g);
    g.connect(master!);
    g.connect(delay);
    osc.start(t);
    osc.stop(t + 1.3);
  });
}
