import { ISODate } from '@/utils/dateUtils';

export const POMODORO_CONFIG_KEY = 'pomodoro_config';
export const POMODORO_STATE_KEY = 'pomodoro_state';
export const POMODORO_STATS_KEY = 'pomodoro_stats';

export type Phase = 'work' | 'shortBreak' | 'longBreak';
export type Status = 'idle' | 'running' | 'paused';

export interface PomodoroConfig {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Work sessions per cycle; the break after the last one is a long break. */
  sessionsUntilLongBreak: number;
  /** Start the next phase automatically when one ends. */
  autoStart: boolean;
  /** Ring the alarm sound when a phase ends; otherwise the notification only vibrates. */
  alarmSound: boolean;
  /** Numeric objective that receives the minutes of each finished work session. */
  linkedObjectiveId: number | null;
}

export interface PomodoroState {
  phase: Phase;
  status: Status;
  /** Epoch ms when the running phase ends; null unless running. */
  endsAt: number | null;
  /** Time left while idle or paused. */
  remainingMs: number;
  /** Work sessions finished in the current cycle. */
  sessionsDone: number;
}

export interface PomodoroStats {
  day: ISODate;
  sessions: number;
  minutes: number;
}

export const LIMITS = {
  workMinutes: [1, 120],
  shortBreakMinutes: [1, 60],
  longBreakMinutes: [1, 60],
  sessionsUntilLongBreak: [1, 12],
} as const satisfies Record<string, readonly [number, number]>;

export const DEFAULT_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStart: false,
  alarmSound: true,
  linkedObjectiveId: null,
};

const clamp = (value: unknown, [min, max]: readonly [number, number], fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export function parseConfig(stored: string | null): PomodoroConfig {
  let raw: Partial<PomodoroConfig> = {};
  try {
    raw = stored ? JSON.parse(stored) : {};
  } catch {
    raw = {};
  }
  return {
    workMinutes: clamp(raw.workMinutes, LIMITS.workMinutes, DEFAULT_CONFIG.workMinutes),
    shortBreakMinutes: clamp(raw.shortBreakMinutes, LIMITS.shortBreakMinutes, DEFAULT_CONFIG.shortBreakMinutes),
    longBreakMinutes: clamp(raw.longBreakMinutes, LIMITS.longBreakMinutes, DEFAULT_CONFIG.longBreakMinutes),
    sessionsUntilLongBreak: clamp(
      raw.sessionsUntilLongBreak,
      LIMITS.sessionsUntilLongBreak,
      DEFAULT_CONFIG.sessionsUntilLongBreak,
    ),
    autoStart: typeof raw.autoStart === 'boolean' ? raw.autoStart : DEFAULT_CONFIG.autoStart,
    alarmSound: typeof raw.alarmSound === 'boolean' ? raw.alarmSound : DEFAULT_CONFIG.alarmSound,
    linkedObjectiveId: typeof raw.linkedObjectiveId === 'number' ? raw.linkedObjectiveId : null,
  };
}

export function phaseMinutes(phase: Phase, config: PomodoroConfig): number {
  return phase === 'work'
    ? config.workMinutes
    : phase === 'shortBreak'
      ? config.shortBreakMinutes
      : config.longBreakMinutes;
}

export function phaseDurationMs(phase: Phase, config: PomodoroConfig): number {
  return phaseMinutes(phase, config) * 60_000;
}

export function initialState(config: PomodoroConfig): PomodoroState {
  return { phase: 'work', status: 'idle', endsAt: null, remainingMs: phaseDurationMs('work', config), sessionsDone: 0 };
}

export function parseState(stored: string | null, config: PomodoroConfig): PomodoroState {
  try {
    const raw = stored ? (JSON.parse(stored) as Partial<PomodoroState>) : null;
    if (
      raw &&
      (raw.phase === 'work' || raw.phase === 'shortBreak' || raw.phase === 'longBreak') &&
      (raw.status === 'idle' || raw.status === 'running' || raw.status === 'paused') &&
      typeof raw.remainingMs === 'number' &&
      typeof raw.sessionsDone === 'number' &&
      (raw.status !== 'running' || typeof raw.endsAt === 'number')
    ) {
      return {
        phase: raw.phase,
        status: raw.status,
        endsAt: raw.status === 'running' ? raw.endsAt! : null,
        remainingMs: raw.remainingMs,
        sessionsDone: raw.sessionsDone,
      };
    }
  } catch {
    // fall through to a fresh timer
  }
  return initialState(config);
}

export function remainingMs(state: PomodoroState, now: number): number {
  return state.status === 'running' ? Math.max(0, state.endsAt! - now) : state.remainingMs;
}

export function start(state: PomodoroState, now: number): PomodoroState {
  if (state.status === 'running') return state;
  return { ...state, status: 'running', endsAt: now + state.remainingMs };
}

export function pause(state: PomodoroState, now: number): PomodoroState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', endsAt: null, remainingMs: remainingMs(state, now) };
}

/** Back to the start of the current phase, stopped. The cycle count is kept. */
export function resetPhase(state: PomodoroState, config: PomodoroConfig): PomodoroState {
  return { ...state, status: 'idle', endsAt: null, remainingMs: phaseDurationMs(state.phase, config) };
}

/** Back to the first work session of a new cycle. */
export function resetCycle(config: PomodoroConfig): PomodoroState {
  return initialState(config);
}

/** Applies new durations to a stopped timer that hasn't been started in this phase. */
export function applyConfig(state: PomodoroState, previous: PomodoroConfig, next: PomodoroConfig): PomodoroState {
  const untouched = state.status === 'idle' && state.remainingMs === phaseDurationMs(state.phase, previous);
  return untouched ? { ...state, remainingMs: phaseDurationMs(state.phase, next) } : state;
}

export interface Transition {
  state: PomodoroState;
  /** The phase that just ended was a work session (counts towards stats/objective). */
  finishedWork: boolean;
}

/**
 * Moves to the next phase. `completed` = the phase ran out (vs. skipped by the user): only a
 * completed work session counts. With autoStart the next phase starts at `now`.
 */
export function advance(state: PomodoroState, config: PomodoroConfig, now: number, completed: boolean): Transition {
  const finishedWork = state.phase === 'work' && completed;
  let phase: Phase;
  let sessionsDone = state.sessionsDone;

  if (state.phase === 'work') {
    // A skipped work session still moves the cycle forward, so the long break comes when expected.
    sessionsDone += 1;
    phase = sessionsDone >= config.sessionsUntilLongBreak ? 'longBreak' : 'shortBreak';
  } else {
    phase = 'work';
    if (state.phase === 'longBreak') sessionsDone = 0;
  }

  const duration = phaseDurationMs(phase, config);
  const run = completed && config.autoStart;
  return {
    finishedWork,
    state: {
      phase,
      sessionsDone,
      status: run ? 'running' : 'idle',
      endsAt: run ? now + duration : null,
      remainingMs: duration,
    },
  };
}

export function addToStats(stats: PomodoroStats | null, day: ISODate, minutes: number): PomodoroStats {
  const base = stats && stats.day === day ? stats : { day, sessions: 0, minutes: 0 };
  return { day, sessions: base.sessions + 1, minutes: base.minutes + minutes };
}

export function parseStats(stored: string | null, day: ISODate): PomodoroStats {
  try {
    const raw = stored ? (JSON.parse(stored) as PomodoroStats) : null;
    if (raw && raw.day === day && typeof raw.sessions === 'number' && typeof raw.minutes === 'number') return raw;
  } catch {
    // ignore
  }
  return { day, sessions: 0, minutes: 0 };
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const PHASE_LABELS: Record<Phase, string> = {
  work: 'Enfoque',
  shortBreak: 'Descanso corto',
  longBreak: 'Descanso largo',
};

/** Notification text for when `ended` finishes, with {nombre} for the user's name. */
export function phaseEndMessage(ended: Phase, next: Phase, config: PomodoroConfig): string {
  if (ended === 'work') {
    return next === 'longBreak'
      ? `¡Ciclo completado, {nombre}! Te has ganado un descanso largo de ${config.longBreakMinutes} min.`
      : `¡Bien hecho, {nombre}! Toca descanso de ${config.shortBreakMinutes} min.`;
  }
  return `Se acabó el descanso, {nombre}. ¡A por otra sesión de ${config.workMinutes} min!`;
}
