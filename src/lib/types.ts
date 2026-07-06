// ポモドーロタイマーの型定義。状態機械の discriminated union は pomodoro.ts で操作する

import type { CountdownState } from "./timer";

export const DEFAULT_FOCUS_MS = 25 * 60 * 1000;
export const DEFAULT_BREAK_MS = 5 * 60 * 1000;

export type PomodoroPhase =
  | { mode: "idle" }
  | { mode: "focus"; status: "running" | "paused"; countdown: CountdownState }
  | { mode: "break"; status: "running" | "paused"; countdown: CountdownState };

export interface PomodoroSettings {
  focusMs: number;
  breakMs: number;
}

export interface PomodoroState {
  phase: PomodoroPhase;
  sessionsCompleted: number;
  settings: PomodoroSettings;
}
