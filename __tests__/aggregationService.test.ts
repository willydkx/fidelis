import { Db } from '@/db/types';
import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { isApplicableOn, Objective } from '@/models/objective';
import { EntriesRepository } from '@/repositories/entriesRepository';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { AggregationService } from '@/services/aggregationService';
import { addDays, ISODate, weekday } from '@/utils/dateUtils';

import { createTestDb } from './testDb';

let db: Db;
let objectivesRepo: ObjectivesRepository;
let entriesRepo: EntriesRepository;
let service: AggregationService;

beforeEach(async () => {
  db = await createTestDb();
  objectivesRepo = new ObjectivesRepository(db);
  entriesRepo = new EntriesRepository(db);
  service = new AggregationService(objectivesRepo, entriesRepo);
});

async function backdate(objectiveId: number, createdAt: ISODate): Promise<Objective> {
  await db.runAsync('UPDATE objectives SET created_at = ? WHERE id = ?', [createdAt, objectiveId]);
  return (await objectivesRepo.get(objectiveId))!;
}

test('periodStats daily numeric', async () => {
  const objective = await objectivesRepo.create({
    name: 'Meditar',
    cadence: Cadence.DAILY,
    trackingType: TrackingType.NUMERIC,
    targetValue: 10,
  });
  await entriesRepo.upsertEntry(objective.id, '2026-01-01', { completed: true, value: 10 });
  await entriesRepo.upsertEntry(objective.id, '2026-01-02', { completed: false, value: 5 });

  const stats = await service.periodStats(objective, '2026-01-01', '2026-01-02');

  expect(stats[0].ratio).toBe(1.0);
  expect(stats[0].completed).toBe(true);
  expect(stats[1].ratio).toBe(0.5);
  expect(stats[1].completed).toBe(false);
});

test('periodStats weekly boolean counts occurrences', async () => {
  const objective = await objectivesRepo.create({
    name: 'Ejercicio',
    cadence: Cadence.WEEKLY,
    trackingType: TrackingType.BOOLEAN,
    targetValue: 3,
  });
  const monday = '2026-01-05';
  await entriesRepo.upsertEntry(objective.id, monday, { completed: true });
  await entriesRepo.upsertEntry(objective.id, addDays(monday, 2), { completed: true });

  const stats = await service.periodStats(objective, monday, addDays(monday, 6));

  expect(stats).toHaveLength(1);
  expect(stats[0].ratio).toBe(2 / 3);
  expect(stats[0].completed).toBe(false);
});

test('currentStreak counts consecutive completed days', async () => {
  const created = await objectivesRepo.create({ name: 'Leer', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
  const today = '2026-01-10';
  const objective = await backdate(created.id, addDays(today, -10));

  for (let offset = 0; offset < 3; offset++) {
    await entriesRepo.upsertEntry(objective.id, addDays(today, -offset), { completed: true });
  }
  await entriesRepo.upsertEntry(objective.id, addDays(today, -3), { completed: false });

  expect(await service.currentStreak(objective, today)).toBe(3);
});

test('currentStreak is zero when today incomplete', async () => {
  const created = await objectivesRepo.create({ name: 'Leer', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
  const today = '2026-01-10';
  const objective = await backdate(created.id, addDays(today, -5));

  expect(await service.currentStreak(objective, today)).toBe(0);
});

test('longestStreak handles gap', async () => {
  const created = await objectivesRepo.create({ name: 'Leer', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
  const start = '2026-01-01';
  const objective = await backdate(created.id, start);

  // Completed on days 0,1,2, gap on day 3, completed again on days 4,5,6,7
  for (const offset of [0, 1, 2, 4, 5, 6, 7]) {
    await entriesRepo.upsertEntry(objective.id, addDays(start, offset), { completed: true });
  }

  expect(await service.longestStreak(objective, addDays(start, 7))).toBe(4);
});

test('dailyCompletionRate', async () => {
  const o1 = await objectivesRepo.create({ name: 'Meditar', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
  const o2 = await objectivesRepo.create({ name: 'Leer', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
  const day = '2026-01-01';
  await backdate(o1.id, '2025-01-01');
  await backdate(o2.id, '2025-01-01');
  await entriesRepo.upsertEntry(o1.id, day, { completed: true });
  await entriesRepo.upsertEntry(o2.id, day, { completed: false });

  expect(await service.dailyCompletionRate(day)).toBe(0.5);
});

test('completionRatesInRange matches dailyCompletionRate for every day', async () => {
  const daily = await objectivesRepo.create({ name: 'Meditar', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
  const custom = await objectivesRepo.create({
    name: 'Vitaminas',
    cadence: Cadence.CUSTOM_DAYS,
    trackingType: TrackingType.BOOLEAN,
    daysOfWeek: [0, 2, 4],
  });
  const weekly = await objectivesRepo.create({
    name: 'Correr',
    cadence: Cadence.WEEKLY,
    trackingType: TrackingType.NUMERIC,
    targetValue: 3,
  });
  await backdate(daily.id, '2026-01-01');
  await backdate(custom.id, '2026-01-03');
  await backdate(weekly.id, '2026-01-02');
  await objectivesRepo.archive(weekly.id, '2026-01-12');
  for (const [id, day] of [
    [daily.id, '2026-01-02'],
    [daily.id, '2026-01-05'],
    [custom.id, '2026-01-05'],
    [weekly.id, '2026-01-06'],
  ] as const) {
    await entriesRepo.upsertEntry(id, day, { completed: true });
  }

  const rates = await service.completionRatesInRange('2026-01-01', '2026-01-14');

  for (const [day, rate] of rates) {
    expect([day, rate]).toEqual([day, await service.dailyCompletionRate(day, null)]);
  }
});

test('efficiencyScore is 100 when targets met', async () => {
  const created = await objectivesRepo.create({
    name: 'Meditar',
    cadence: Cadence.DAILY,
    trackingType: TrackingType.NUMERIC,
    targetValue: 10,
  });
  const today = '2026-01-15';
  const objective = await backdate(created.id, addDays(today, -4));

  for (let offset = 0; offset < 5; offset++) {
    await entriesRepo.upsertEntry(objective.id, addDays(today, -offset), { completed: true, value: 10 });
  }

  expect(await service.efficiencyScore(today)).toBe(100.0);
});

test('efficiencyScore is zero with no active objectives', async () => {
  expect(await service.efficiencyScore()).toBe(0.0);
});

test('periodStats custom days filters to selected weekdays', async () => {
  const objective = await objectivesRepo.create({
    name: 'Vitaminas',
    cadence: Cadence.CUSTOM_DAYS,
    trackingType: TrackingType.BOOLEAN,
    daysOfWeek: [0, 2, 4], // Mon, Wed, Fri
  });
  const monday = '2026-01-05';
  for (let offset = 0; offset < 7; offset++) {
    await entriesRepo.upsertEntry(objective.id, addDays(monday, offset), { completed: true });
  }

  const stats = await service.periodStats(objective, monday, addDays(monday, 6));

  expect(stats.map((s) => weekday(s.periodStart))).toEqual([0, 2, 4]);
  expect(stats.every((s) => s.completed)).toBe(true);
});

test('currentStreak custom days skips non-applicable days', async () => {
  const created = await objectivesRepo.create({
    name: 'Vitaminas',
    cadence: Cadence.CUSTOM_DAYS,
    trackingType: TrackingType.BOOLEAN,
    daysOfWeek: [0, 2, 4],
  });
  const monday = '2026-01-05';
  const objective = await backdate(created.id, addDays(monday, -14));

  for (const offset of [0, 2, 4]) {
    await entriesRepo.upsertEntry(objective.id, addDays(monday, offset), { completed: true });
  }

  expect(await service.currentStreak(objective, addDays(monday, 4))).toBe(3);
});

test('isApplicableOn only selected weekdays', () => {
  const objective: Objective = {
    id: 1,
    name: 'Vitaminas',
    cadence: Cadence.CUSTOM_DAYS,
    trackingType: TrackingType.BOOLEAN,
    status: ObjectiveStatus.ACTIVE,
    createdAt: '2026-01-01 00:00:00',
    description: null,
    targetValue: null,
    unit: null,
    color: null,
    sortOrder: 0,
    archivedAt: null,
    daysOfWeek: [0, 2, 4],
  };

  expect(isApplicableOn(objective, '2026-01-05')).toBe(true); // Monday
  expect(isApplicableOn(objective, '2026-01-06')).toBe(false); // Tuesday
});
