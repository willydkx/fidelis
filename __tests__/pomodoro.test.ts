import {
  addToStats,
  advance,
  applyConfig,
  DEFAULT_CONFIG,
  formatClock,
  initialState,
  parseConfig,
  parseState,
  parseStats,
  pause,
  phaseEndMessage,
  PomodoroConfig,
  remainingMs,
  resetCycle,
  resetPhase,
  start,
} from '@/pomodoro/pomodoro';
import { fillName } from '@/utils/personalization';

const MIN = 60_000;
const config: PomodoroConfig = { ...DEFAULT_CONFIG, sessionsUntilLongBreak: 2 };

describe('parseConfig', () => {
  test('defaults when nothing is stored or the JSON is broken', () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig('{nope')).toEqual(DEFAULT_CONFIG);
  });

  test('alarm sound is on by default and can be turned off', () => {
    expect(parseConfig(null).alarmSound).toBe(true);
    expect(parseConfig(JSON.stringify({ alarmSound: false })).alarmSound).toBe(false);
    expect(parseConfig(JSON.stringify({ alarmSound: 'yes' })).alarmSound).toBe(true);
  });

  test('clamps and rounds out-of-range values', () => {
    const c = parseConfig(
      JSON.stringify({ workMinutes: 500, shortBreakMinutes: 0, longBreakMinutes: 7.6, sessionsUntilLongBreak: -3 }),
    );
    expect(c).toMatchObject({ workMinutes: 120, shortBreakMinutes: 1, longBreakMinutes: 8, sessionsUntilLongBreak: 1 });
  });
});

describe('timer', () => {
  test('starts, counts down by wall clock and pauses', () => {
    let s = start(initialState(config), 0);
    expect(remainingMs(s, 10 * MIN)).toBe(15 * MIN);
    s = pause(s, 10 * MIN);
    expect(s).toMatchObject({ status: 'paused', remainingMs: 15 * MIN, endsAt: null });
    // Paused time doesn't count.
    expect(remainingMs(s, 99 * MIN)).toBe(15 * MIN);
    s = start(s, 100 * MIN);
    expect(remainingMs(s, 105 * MIN)).toBe(10 * MIN);
  });

  test('never goes below zero', () => {
    expect(remainingMs(start(initialState(config), 0), 60 * MIN)).toBe(0);
  });

  test('reset phase keeps the cycle; reset cycle starts over', () => {
    const mid = { ...start(initialState(config), 0), sessionsDone: 1 };
    expect(resetPhase(mid, config)).toMatchObject({ status: 'idle', remainingMs: 25 * MIN, sessionsDone: 1 });
    expect(resetCycle(config)).toEqual(initialState(config));
  });
});

describe('advance', () => {
  test('work → short break → work → long break → work, resetting the cycle', () => {
    let s = initialState(config);
    let t = advance(s, config, 0, true);
    expect(t.finishedWork).toBe(true);
    expect(t.state).toMatchObject({ phase: 'shortBreak', sessionsDone: 1, status: 'idle', remainingMs: 5 * MIN });

    s = t.state;
    t = advance(s, config, 0, true);
    expect(t.finishedWork).toBe(false);
    expect(t.state).toMatchObject({ phase: 'work', sessionsDone: 1 });

    t = advance(t.state, config, 0, true);
    expect(t.state).toMatchObject({ phase: 'longBreak', sessionsDone: 2, remainingMs: 15 * MIN });

    t = advance(t.state, config, 0, true);
    expect(t.state).toMatchObject({ phase: 'work', sessionsDone: 0 });
  });

  test('autoStart runs the next phase from now', () => {
    const t = advance(initialState(config), { ...config, autoStart: true }, 1000, true);
    expect(t.state).toMatchObject({ status: 'running', endsAt: 1000 + 5 * MIN });
  });

  test('skipping never auto-starts and a skipped work session is not counted as finished', () => {
    const t = advance(start(initialState(config), 0), { ...config, autoStart: true }, 0, false);
    expect(t.finishedWork).toBe(false);
    expect(t.state).toMatchObject({ phase: 'shortBreak', status: 'idle', sessionsDone: 1 });
  });
});

test('applyConfig only touches an untouched stopped timer', () => {
  const longer = { ...config, workMinutes: 50 };
  expect(applyConfig(initialState(config), config, longer).remainingMs).toBe(50 * MIN);
  const paused = pause(start(initialState(config), 0), 5 * MIN);
  expect(applyConfig(paused, config, longer)).toBe(paused);
});

test('parseState restores valid state and rejects garbage', () => {
  const running = start(initialState(config), 1234);
  expect(parseState(JSON.stringify(running), config)).toEqual(running);
  expect(parseState('{"phase":"lunch"}', config)).toEqual(initialState(config));
  expect(parseState(null, config)).toEqual(initialState(config));
});

test('stats accumulate per day and reset on a new day', () => {
  let stats = addToStats(null, '2026-10-04', 25);
  stats = addToStats(stats, '2026-10-04', 25);
  expect(stats).toEqual({ day: '2026-10-04', sessions: 2, minutes: 50 });
  expect(addToStats(stats, '2026-10-05', 25)).toEqual({ day: '2026-10-05', sessions: 1, minutes: 25 });
  expect(parseStats(JSON.stringify(stats), '2026-10-05')).toEqual({ day: '2026-10-05', sessions: 0, minutes: 0 });
});

test('formatClock rounds up to whole seconds', () => {
  expect(formatClock(25 * MIN)).toBe('25:00');
  expect(formatClock(61_001)).toBe('01:02');
  expect(formatClock(0)).toBe('00:00');
});

test('phase end messages read well with and without a name', () => {
  expect(fillName(phaseEndMessage('work', 'shortBreak', config), 'Willy')).toBe(
    '¡Bien hecho, Willy! Toca descanso de 5 min.',
  );
  expect(fillName(phaseEndMessage('work', 'shortBreak', config), null)).toBe('¡Bien hecho! Toca descanso de 5 min.');
  expect(fillName(phaseEndMessage('shortBreak', 'work', config), null)).toBe(
    'Se acabó el descanso. ¡A por otra sesión de 25 min!',
  );
  expect(fillName(phaseEndMessage('work', 'longBreak', config), 'Ana')).toBe(
    '¡Ciclo completado, Ana! Te has ganado un descanso largo de 15 min.',
  );
});
