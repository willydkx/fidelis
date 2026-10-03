import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { Objective } from '@/models/objective';
import {
  defaultReminderConfig,
  parseReminderConfig,
  planReminders,
  ReminderConfig,
  reminderMessage,
} from '@/notifications/reminderConfig';

const MONDAY = '2026-01-05';

function objective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: 1,
    name: 'Leer',
    cadence: Cadence.DAILY,
    trackingType: TrackingType.BOOLEAN,
    status: ObjectiveStatus.ACTIVE,
    createdAt: '2025-12-01 00:00:00',
    description: null,
    targetValue: null,
    unit: null,
    color: null,
    sortOrder: 0,
    archivedAt: null,
    daysOfWeek: null,
    ...overrides,
  };
}

function plan(config: Partial<ReminderConfig>, extra: Partial<Parameters<typeof planReminders>[0]> = {}) {
  return planReminders({
    config: { ...defaultReminderConfig('20:30'), ...config },
    activeObjectives: [objective()],
    startDay: MONDAY,
    now: new Date(2026, 0, 5, 9, 0),
    todayComplete: false,
    daysAhead: 7,
    ...extra,
  }).map((d) => `${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
}

describe('parseReminderConfig', () => {
  test('falls back to the legacy single time', () => {
    expect(parseReminderConfig(null, '21:15')).toEqual(defaultReminderConfig('21:15'));
  });

  test('normalizes stored times and days', () => {
    const config = parseReminderConfig(JSON.stringify({ times: ['21:00', '08:00', '21:00'], days: [4, 0, 4] }), null);
    expect(config.times).toEqual(['08:00', '21:00']);
    expect(config.days).toEqual([0, 4]);
    expect(config.enabled).toBe(true);
  });

  test('ignores corrupt JSON', () => {
    expect(parseReminderConfig('{oops', '20:00')).toEqual(defaultReminderConfig('20:00'));
  });
});

describe('planReminders', () => {
  test('one reminder per day at the configured time', () => {
    expect(plan({})).toEqual(['5 20:30', '6 20:30', '7 20:30', '8 20:30', '9 20:30', '10 20:30', '11 20:30']);
  });

  test('nothing when disabled', () => {
    expect(plan({ enabled: false })).toEqual([]);
  });

  test('several times, skipping the ones already past today', () => {
    expect(plan({ times: ['08:00', '14:00'] }, { daysAhead: 2 })).toEqual(['5 14:00', '6 08:00', '6 14:00']);
  });

  test('only selected weekdays', () => {
    expect(plan({ days: [5, 6] })).toEqual(['10 20:30', '11 20:30']);
  });

  test('onlyIfPending skips today once complete', () => {
    expect(plan({}, { todayComplete: true, daysAhead: 2 })).toEqual(['6 20:30']);
  });

  test('onlyIfPending skips days without applicable objectives', () => {
    const mwf = objective({ cadence: Cadence.CUSTOM_DAYS, daysOfWeek: [0, 2, 4] });
    expect(plan({}, { activeObjectives: [mwf] })).toEqual(['5 20:30', '7 20:30', '9 20:30']);
  });

  test('always mode ignores progress and empty days', () => {
    expect(plan({ onlyIfPending: false }, { activeObjectives: [], todayComplete: true, daysAhead: 2 })).toEqual([
      '5 20:30',
      '6 20:30',
    ]);
  });
});

describe('reminderMessage', () => {
  test('personalizes the defaults with the user name', () => {
    expect(reminderMessage(defaultReminderConfig(), 'Willy')).toBe(
      'Willy, todavía tienes objetivos de hoy sin registrar. ¡No rompas la racha!',
    );
    expect(reminderMessage({ ...defaultReminderConfig(), onlyIfPending: false }, 'Willy')).toBe(
      'Willy, es hora de registrar tus objetivos de hoy.',
    );
  });

  test('defaults read naturally without a name', () => {
    expect(reminderMessage(defaultReminderConfig(), null)).toBe(
      'Todavía tienes objetivos de hoy sin registrar. ¡No rompas la racha!',
    );
    expect(reminderMessage({ ...defaultReminderConfig(), onlyIfPending: false }, '')).toBe(
      'Es hora de registrar tus objetivos de hoy.',
    );
  });

  test('custom text can use {nombre}', () => {
    expect(reminderMessage({ ...defaultReminderConfig(), message: '  ¡A por ello, {nombre}!  ' }, 'Willy')).toBe(
      '¡A por ello, Willy!',
    );
    expect(reminderMessage({ ...defaultReminderConfig(), message: '¡A por ello, {nombre}!' }, null)).toBe('¡A por ello!');
    expect(reminderMessage({ ...defaultReminderConfig(), message: 'Sin marcador' }, 'Willy')).toBe('Sin marcador');
  });
});
