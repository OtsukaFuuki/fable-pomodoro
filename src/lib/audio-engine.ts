// 環境音合成エンジン: マスター + 「雨」チャンネル + チャイム
// なぜ合成か: 音源ファイル不要（権利・容量・継ぎ目の問題が消える）。docs/decisions.md 参照
// チャンネルの追加は本ファイルの createRainChannel の作法に従う:
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
    drop.buffer = noise; // バッファは使い回し、再生開始位置だけ変える
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900 + Math.random() * 1400; // 高すぎる粒は耳に刺さるので抑えめに
    bp.Q.value = 10;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t); // exponentialRamp は 0 から始められない
    env.gain.exponentialRampToValueAtTime(0.12 + Math.random() * 0.08, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    drop.connect(bp).connect(env).connect(gain);
    drop.start(t, Math.random() * 1.5, 0.1);
    drop.stop(t + 0.12); // 明示的に止めれば再生後にノードごと GC される
  };

  const tick = () => {
    if (nextDropAt < c.currentTime) nextDropAt = c.currentTime; // スロットル明けの追いつき
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
    lp.frequency.value = 1200; // 高域を落として「遠い雨」にする
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
      else stop(); // 無音を流し続けない（バッテリー配慮）
      gain.gain.setTargetAtTime(v * 0.5, c.currentTime, 0.1); // 0.5 = チャンネル上限。うるさくしない
    },
    dispose() {
      stop();
      gain.disconnect();
    },
  };
}

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
