// 集中⇄休憩の状態機械。残り時間の真実は CountdownState（endTime 逆算）が持つ
import {
  DEFAULT_BREAK_MS,
  DEFAULT_FOCUS_MS,
  type PomodoroPhase,
  type PomodoroSettings,
  type PomodoroState,
} from "./types";
import {
  getRemainingMs as getCountdownRemaining,
  pauseCountdown,
  resumeCountdown,
  startCountdown,
  type CountdownState,
} from "./timer";

export function createInitialState(
  settings: PomodoroSettings = { focusMs: DEFAULT_FOCUS_MS, breakMs: DEFAULT_BREAK_MS },
): PomodoroState {
  return { phase: { mode: "idle" }, sessionsCompleted: 0, settings };
}

export function getRemainingMs(state: PomodoroState): number {
  const { phase, settings } = state;
  if (phase.mode === "idle") return settings.focusMs;
  return getCountdownRemaining(phase.countdown);
}

export function getPhaseTotalMs(state: PomodoroState): number {
  const { phase, settings } = state;
  if (phase.mode === "break") return settings.breakMs;
  return settings.focusMs;
}

export function getProgress(state: PomodoroState): number {
  const total = getPhaseTotalMs(state);
  if (total === 0) return 0;
  return Math.min(1, Math.max(0, getRemainingMs(state) / total));
}

export function isBreakMode(phase: PomodoroPhase): boolean {
  return phase.mode === "break";
}

export function isPaused(phase: PomodoroPhase): boolean {
  return phase.mode === "focus" || phase.mode === "break" ? phase.status === "paused" : false;
}

export function isRunning(phase: PomodoroPhase): boolean {
  return phase.mode === "focus" || phase.mode === "break" ? phase.status === "running" : false;
}

function focusRunning(countdown: CountdownState): PomodoroPhase {
  return { mode: "focus", status: "running", countdown };
}

function focusPaused(countdown: CountdownState): PomodoroPhase {
  return { mode: "focus", status: "paused", countdown };
}

function breakRunning(countdown: CountdownState): PomodoroPhase {
  return { mode: "break", status: "running", countdown };
}

function breakPaused(countdown: CountdownState): PomodoroPhase {
  return { mode: "break", status: "paused", countdown };
}

export function startFocus(state: PomodoroState): PomodoroState {
  return {
    ...state,
    phase: focusRunning(startCountdown(state.settings.focusMs)),
  };
}

export function pausePhase(state: PomodoroState): PomodoroState {
  const { phase } = state;
  if (phase.mode === "focus" && phase.status === "running") {
    return { ...state, phase: focusPaused(pauseCountdown(phase.countdown)) };
  }
  if (phase.mode === "break" && phase.status === "running") {
    return { ...state, phase: breakPaused(pauseCountdown(phase.countdown)) };
  }
  return state;
}

export function resumePhase(state: PomodoroState): PomodoroState {
  const { phase } = state;
  if (phase.mode === "idle") return startFocus(state);
  if (phase.mode === "focus" && phase.status === "paused") {
    return { ...state, phase: focusRunning(resumeCountdown(phase.countdown)) };
  }
  if (phase.mode === "break" && phase.status === "paused") {
    return { ...state, phase: breakRunning(resumeCountdown(phase.countdown)) };
  }
  return state;
}

export function resetTimer(state: PomodoroState): PomodoroState {
  return { ...state, phase: { mode: "idle" } };
}

function startBreakPhase(state: PomodoroState): PomodoroState {
  return {
    ...state,
    phase: breakRunning(startCountdown(state.settings.breakMs)),
  };
}

/** focus 完了: セッション加算して休憩へ自動遷移（spec §3.1） */
export function completeFocus(state: PomodoroState): PomodoroState {
  return startBreakPhase({
    ...state,
    sessionsCompleted: state.sessionsCompleted + 1,
  });
}

/** break 完了: 開始待ち（idle）へ。勝手に集中は始めない（spec §3.1） */
export function completeBreak(state: PomodoroState): PomodoroState {
  return { ...state, phase: { mode: "idle" } };
}

/** スキップ: focus はセッション数に数えない（spec §3.1） */
export function skipPhase(state: PomodoroState): PomodoroState {
  const { phase } = state;
  if (phase.mode === "focus") return startBreakPhase(state);
  if (phase.mode === "break") return { ...state, phase: { mode: "idle" } };
  return state;
}

/** 実行中フェーズが 0 に到達したら次状態へ。チャイム要否も返す */
export function advanceIfExpired(state: PomodoroState): { state: PomodoroState; chime: boolean } {
  const { phase } = state;
  if (phase.mode !== "focus" && phase.mode !== "break") return { state, chime: false };
  if (phase.status !== "running") return { state, chime: false };
  if (getCountdownRemaining(phase.countdown) > 0) return { state, chime: false };

  if (phase.mode === "focus") return { state: completeFocus(state), chime: true };
  return { state: completeBreak(state), chime: true };
}
