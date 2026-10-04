import initSqlJs from 'sql.js';

import { runMigrations } from '@/db/migrations';
import { wrapSqlJs } from '@/db/sqlJsDb';
import { Cadence, TrackingType } from '@/models/enums';
import { EntriesRepository } from '@/repositories/entriesRepository';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { SettingsRepository } from '@/repositories/settingsRepository';
import { buildSnapshot, mergeSnapshot } from '@/sync/snapshot';

import { createTestDb } from './testDb';

// The web version stores its data with sql.js; the repositories must behave as on Android.
async function createSqlJsDb() {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const onWrite = jest.fn();
  const db = wrapSqlJs(raw, onWrite);
  await runMigrations(db);
  onWrite.mockClear();
  return { SQL, raw, db, onWrite };
}

test('repositories work on sql.js and writes are reported', async () => {
  const { db, onWrite } = await createSqlJsDb();
  const objectives = new ObjectivesRepository(db);
  const entries = new EntriesRepository(db);

  const objective = await objectives.create({
    name: 'Leer',
    cadence: Cadence.DAILY,
    trackingType: TrackingType.NUMERIC,
    targetValue: 10,
  });
  expect(objective.id).toBeGreaterThan(0);
  expect(onWrite).toHaveBeenCalled();

  await entries.upsertEntry(objective.id, '2026-10-04', { completed: true, value: 12 });
  expect((await entries.getEntriesForDate('2026-10-04'))[0]).toMatchObject({ objectiveId: objective.id, value: 12 });

  onWrite.mockClear();
  expect(await objectives.get(objective.id + 100)).toBeNull();
  expect(onWrite).not.toHaveBeenCalled();
});

test('a saved database reopens with its data, and deletes still cascade', async () => {
  const { SQL, raw, db } = await createSqlJsDb();
  const objectives = new ObjectivesRepository(db);
  const objective = await objectives.create({ name: 'Andar', cadence: Cadence.DAILY, trackingType: TrackingType.BOOLEAN });
  await new EntriesRepository(db).upsertEntry(objective.id, '2026-10-04', { completed: true });
  await new SettingsRepository(db).set('user_name', 'Ana');

  const reopened = wrapSqlJs(new SQL.Database(raw.export()), () => {});
  await runMigrations(reopened);
  expect(await new SettingsRepository(reopened).get('user_name')).toBe('Ana');

  await new ObjectivesRepository(reopened).delete(objective.id);
  expect(await new EntriesRepository(reopened).getEntriesForDate('2026-10-04')).toHaveLength(0);
});

test('a snapshot from the phone merges into the sql.js database and back', async () => {
  const { db: desktop } = await createSqlJsDb();
  const phone = await createTestDb();
  const objective = await new ObjectivesRepository(phone).create({ name: 'Leer', cadence: Cadence.DAILY, trackingType: TrackingType.NUMERIC, targetValue: 10 });
  await new EntriesRepository(phone).upsertEntry(objective.id, '2026-10-04', { completed: true, value: 12 });

  expect(await mergeSnapshot(desktop, await buildSnapshot(phone))).toBe(true);
  expect(await mergeSnapshot(desktop, await buildSnapshot(phone))).toBe(false);
  expect(JSON.stringify(await buildSnapshot(desktop))).toBe(JSON.stringify(await buildSnapshot(phone)));
});
