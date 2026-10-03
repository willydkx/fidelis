import { Db } from '@/db/types';
import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { EntriesRepository } from '@/repositories/entriesRepository';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { SettingsRepository } from '@/repositories/settingsRepository';

import { createTestDb } from './testDb';

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

function makeObjective() {
  return new ObjectivesRepository(db).create({
    name: 'Meditar',
    cadence: Cadence.DAILY,
    trackingType: TrackingType.NUMERIC,
    targetValue: 10,
  });
}

describe('EntriesRepository', () => {
  test('upsert creates then updates', async () => {
    const objective = await makeObjective();
    const repo = new EntriesRepository(db);

    const first = await repo.upsertEntry(objective.id, '2026-01-01', { completed: true, value: 10 });
    expect(first.value).toBe(10);

    const updated = await repo.upsertEntry(objective.id, '2026-01-01', { completed: true, value: 15 });
    expect(updated.id).toBe(first.id);
    expect(updated.value).toBe(15);

    expect(await repo.getEntriesForDate('2026-01-01')).toHaveLength(1);
  });

  test('getEntriesInRange', async () => {
    const objective = await makeObjective();
    const repo = new EntriesRepository(db);
    await repo.upsertEntry(objective.id, '2026-01-01', { completed: true, value: 10 });
    await repo.upsertEntry(objective.id, '2026-01-05', { completed: true, value: 10 });
    await repo.upsertEntry(objective.id, '2026-02-01', { completed: true, value: 10 });

    const entries = await repo.getEntriesInRange('2026-01-01', '2026-01-31');

    expect(entries.map((e) => e.entryDate)).toEqual(['2026-01-01', '2026-01-05']);
  });

  test('deleteEntry', async () => {
    const objective = await makeObjective();
    const repo = new EntriesRepository(db);
    const entry = await repo.upsertEntry(objective.id, '2026-01-01', { completed: true, value: 10 });

    await repo.deleteEntry(entry.id);

    expect(await repo.getEntriesForDate('2026-01-01')).toEqual([]);
  });
});

describe('ObjectivesRepository', () => {
  test('create and get', async () => {
    const repo = new ObjectivesRepository(db);
    const created = await repo.create({
      name: 'Meditar',
      cadence: Cadence.DAILY,
      trackingType: TrackingType.NUMERIC,
      targetValue: 10,
      unit: 'minutos',
    });

    const fetched = (await repo.get(created.id))!;

    expect(fetched.name).toBe('Meditar');
    expect(fetched.cadence).toBe(Cadence.DAILY);
    expect(fetched.status).toBe(ObjectiveStatus.ACTIVE);
    expect(fetched.targetValue).toBe(10);
  });

  test('list filters by status', async () => {
    const repo = new ObjectivesRepository(db);
    const active = await repo.create({ name: 'Leer', cadence: Cadence.MONTHLY, trackingType: TrackingType.BOOLEAN });
    const toArchive = await repo.create({
      name: 'Viejo habito',
      cadence: Cadence.DAILY,
      trackingType: TrackingType.BOOLEAN,
    });
    await repo.archive(toArchive.id);

    expect((await repo.list(ObjectiveStatus.ACTIVE)).map((o) => o.id)).toEqual([active.id]);
    expect((await repo.list(ObjectiveStatus.ARCHIVED)).map((o) => o.id)).toEqual([toArchive.id]);
  });

  test('update changes fields', async () => {
    const repo = new ObjectivesRepository(db);
    const objective = await repo.create({
      name: 'Ejercicio',
      cadence: Cadence.WEEKLY,
      trackingType: TrackingType.NUMERIC,
      targetValue: 3,
    });

    await repo.update({ ...objective, name: 'Ejercicio intenso', targetValue: 4 });

    const fetched = (await repo.get(objective.id))!;
    expect(fetched.name).toBe('Ejercicio intenso');
    expect(fetched.targetValue).toBe(4);
  });

  test('archive sets status and date', async () => {
    const repo = new ObjectivesRepository(db);
    const objective = await repo.create({ name: 'Temp', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });

    await repo.archive(objective.id, '2026-01-15');

    const fetched = (await repo.get(objective.id))!;
    expect(fetched.status).toBe(ObjectiveStatus.ARCHIVED);
    expect(fetched.archivedAt?.slice(0, 10)).toBe('2026-01-15');
  });

  test('custom days round-trip sorted', async () => {
    const repo = new ObjectivesRepository(db);
    const objective = await repo.create({
      name: 'Vitaminas',
      cadence: Cadence.CUSTOM_DAYS,
      trackingType: TrackingType.BOOLEAN,
      daysOfWeek: [4, 0, 2],
    });

    expect(objective.daysOfWeek).toEqual([0, 2, 4]);
  });

  test('delete removes the objective and only its entries', async () => {
    const repo = new ObjectivesRepository(db);
    const entries = new EntriesRepository(db);
    const doomed = await repo.create({ name: 'Borrar', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
    const kept = await repo.create({ name: 'Conservar', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
    await entries.upsertEntry(doomed.id, '2026-01-01', { completed: true });
    await entries.upsertEntry(kept.id, '2026-01-01', { completed: true });

    await repo.delete(doomed.id);

    expect(await repo.get(doomed.id)).toBeNull();
    expect((await repo.list()).map((o) => o.id)).toEqual([kept.id]);
    expect((await entries.getEntriesForDate('2026-01-01')).map((e) => e.objectiveId)).toEqual([kept.id]);
  });

  test('reorder persists sort order', async () => {
    const repo = new ObjectivesRepository(db);
    const a = await repo.create({ name: 'A', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
    const b = await repo.create({ name: 'B', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });

    await repo.reorder([b.id, a.id]);

    expect((await repo.list()).map((o) => o.name)).toEqual(['B', 'A']);
  });
});

describe('SettingsRepository', () => {
  test('get returns default when missing', async () => {
    expect(await new SettingsRepository(db).get('theme', 'light')).toBe('light');
  });

  test('set then get', async () => {
    const repo = new SettingsRepository(db);
    await repo.set('daily_reminder_time', '20:30');
    expect(await repo.get('daily_reminder_time')).toBe('20:30');
  });

  test('set overwrites existing', async () => {
    const repo = new SettingsRepository(db);
    await repo.set('theme', 'light');
    await repo.set('theme', 'dark');
    expect(await repo.get('theme')).toBe('dark');
  });
});
