// ズレないカウントダウンの最小形。「残り秒を減らす」のではなく「終了時刻から逆算する」
// なぜか: バックグラウンドで setInterval は止まる/間引かれるが、Date.now() は嘘をつかない

export interface CountdownState {
  endTime: number | null;    // 実行中: 終了予定の epoch ms
  remainingMs: number;       // 一時停止中はここに残量を退避
  running: boolean;
}

export function startCountdown(durationMs: number): CountdownState {
  return { endTime: Date.now() + durationMs, remainingMs: durationMs, running: true };
}

export function pauseCountdown(s: CountdownState): CountdownState {
  if (!s.running || s.endTime === null) return s;
  return { endTime: null, remainingMs: Math.max(0, s.endTime - Date.now()), running: false };
}

export function resumeCountdown(s: CountdownState): CountdownState {
  if (s.running) return s;
  return { endTime: Date.now() + s.remainingMs, remainingMs: s.remainingMs, running: true };
}

// 表示更新は requestAnimationFrame or 250ms interval からこれを呼ぶだけ。
// visibilitychange 復帰時にも呼べば、バックグラウンド経過が自動で反映される
export function getRemainingMs(s: CountdownState): number {
  return s.running && s.endTime !== null
    ? Math.max(0, s.endTime - Date.now())
    : s.remainingMs;
}

export function isFinished(s: CountdownState): boolean {
  return getRemainingMs(s) === 0 && s.running;
}

export function formatMmSs(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
