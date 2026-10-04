import { Db } from '@/db/types';
import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { EntriesRepository } from '@/repositories/entriesRepository';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { SettingsRepository } from '@/repositories/settingsRepository';
import { adoptMatchingObjectives, buildSnapshot, mergeSnapshot, parseSnapshot, Snapshot } from '@/sync/snapshot';
import { USER_NAME_KEY } from '@/utils/personalization';

import { createTestDb } from './testDb';

/** Simulates the shared copy in Drive: each sync downloads it, merges, and uploads the result. */
class Cloud {
  private copy: string | null = null;

  async sync(db: Db): Promise<boolean> {
    const changed = this.copy ? await mergeSnapshot(db, JSON.parse(this.copy) as Snapshot) : false;
    this.copy = JSON.stringify(await buildSnapshot(db));
    return changed;
  }
}

function repos(db: Db) {
  return {
    objectives: new ObjectivesRepository(db),
    entries: new EntriesRepository(db),
    settings: new SettingsRepository(db),
  };
}

const reading = { name: 'Leer', cadence: Cadence.DAILY, trackingType: TrackingType.NUMERIC, targetValue: 10 };

let now = 1_000;
beforeEach(() => {
  now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => (now += 1_000));
});
afterEach(() => jest.restoreAllMocks());

test('objectives, entries and the name travel between devices', async () => {
  const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
  const objective = await repos(phone).objectives.create(reading);
  await repos(phone).entries.upsertEntry(objective.id, '2026-10-04', { completed: true, value: 12 });
  await repos(phone).settings.set(USER_NAME_KEY, 'Willy');

  await cloud.sync(phone);
  expect(await cloud.sync(pc)).toBe(true);

  const [copied] = await repos(pc).objectives.list();
  expect(copied).toMatchObject({ name: 'Leer', targetValue: 10, cadence: Cadence.DAILY });
  expect((await repos(pc).entries.getEntriesForDate('2026-10-04'))[0]).toMatchObject({
    objectiveId: copied.id,
    completed: true,
    value: 12,
  });
  expect(await repos(pc).settings.get(USER_NAME_KEY)).toBe('Willy');

  // Nothing new: a second round changes nothing.
  expect(await cloud.sync(phone)).toBe(false);
  expect(await cloud.sync(pc)).toBe(false);
});

test('the latest change wins, field by row', async () => {
  const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
  const objective = await repos(phone).objectives.create(reading);
  await cloud.sync(phone);
  await cloud.sync(pc);
  const [onPc] = await repos(pc).objectives.list();

  await repos(phone).objectives.update({ ...objective, name: 'Leer (móvil)' });
  await repos(pc).objectives.update({ ...onPc, name: 'Leer (PC)' }); // later

  await cloud.sync(phone);
  await cloud.sync(pc);
  await cloud.sync(phone);
  expect((await repos(phone).objectives.list())[0].name).toBe('Leer (PC)');
  expect((await repos(pc).objectives.list())[0].name).toBe('Leer (PC)');
});

test('both devices logging on the same day keep the newest value', async () => {
  const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
  const objective = await repos(phone).objectives.create(reading);
  await cloud.sync(phone);
  await cloud.sync(pc);
  const [onPc] = await repos(pc).objectives.list();

  await repos(pc).entries.upsertEntry(onPc.id, '2026-10-04', { completed: false, value: 5 });
  await repos(phone).entries.upsertEntry(objective.id, '2026-10-04', { completed: true, value: 10 }); // later

  await cloud.sync(pc);
  await cloud.sync(phone);
  await cloud.sync(pc);
  for (const [db, id] of [[phone, objective.id], [pc, onPc.id]] as const) {
    expect((await repos(db).entries.getEntriesForDate('2026-10-04'))[0]).toMatchObject({ objectiveId: id, value: 10 });
  }
});

test('deleting an objective removes it and its entries everywhere', async () => {
  const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
  const objective = await repos(phone).objectives.create(reading);
  await repos(phone).entries.upsertEntry(objective.id, '2026-10-04', { completed: true, value: 10 });
  await cloud.sync(phone);
  await cloud.sync(pc);

  await repos(phone).objectives.delete(objective.id);
  await cloud.sync(phone);
  expect(await cloud.sync(pc)).toBe(true);

  expect(await repos(pc).objectives.list()).toHaveLength(0);
  expect(await repos(pc).entries.getEntriesForDate('2026-10-04')).toHaveLength(0);
  // And it doesn't come back from the other device.
  await cloud.sync(phone);
  expect(await repos(phone).objectives.list()).toHaveLength(0);
});

test('deleting a single entry spreads too', async () => {
  const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
  const objective = await repos(phone).objectives.create(reading);
  const entry = await repos(phone).entries.upsertEntry(objective.id, '2026-10-04', { completed: true, value: 10 });
  await cloud.sync(phone);
  await cloud.sync(pc);

  await repos(phone).entries.deleteEntry(entry.id);
  await cloud.sync(phone);
  await cloud.sync(pc);
  expect(await repos(pc).entries.getEntriesForDate('2026-10-04')).toHaveLength(0);
});

test('changes made offline on both devices are combined', async () => {
  const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
  await repos(phone).objectives.create(reading);
  await repos(pc).objectives.create({ name: 'Gimnasio', cadence: Cadence.WEEKLY, trackingType: TrackingType.BOOLEAN });

  await cloud.sync(phone);
  await cloud.sync(pc);
  await cloud.sync(phone);
  const names = async (db: Db) => (await repos(db).objectives.list()).map((o) => o.name).sort();
  expect(await names(phone)).toEqual(['Gimnasio', 'Leer']);
  expect(await names(pc)).toEqual(['Gimnasio', 'Leer']);
});

test('archiving and per-device settings', async () => {
  const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
  const objective = await repos(phone).objectives.create(reading);
  await repos(phone).settings.set('reminder_config', '{"enabled":false}');
  await cloud.sync(phone);
  await cloud.sync(pc);

  await repos(phone).objectives.archive(objective.id, '2026-10-04');
  await cloud.sync(phone);
  await cloud.sync(pc);
  expect((await repos(pc).objectives.list())[0]).toMatchObject({ status: ObjectiveStatus.ARCHIVED, archivedAt: '2026-10-04' });
  // Reminders are configured per device.
  expect(await repos(pc).settings.get('reminder_config')).toBeNull();
});

test('a snapshot from a newer app version is refused', async () => {
  const db = await createTestDb();
  const snapshot = { ...(await buildSnapshot(db)), format: 99 };
  await expect(mergeSnapshot(db, snapshot)).rejects.toThrow(/versión más nueva/);
});

test('on a first sync, the same objective created on both devices is not duplicated', async () => {
  const [phone, pc] = [await createTestDb(), await createTestDb()];
  const onPhone = await repos(phone).objectives.create(reading);
  await repos(phone).entries.upsertEntry(onPhone.id, '2026-10-03', { completed: true, value: 10 });
  const onPc = await repos(pc).objectives.create({ ...reading, name: ' leer ' });
  await repos(pc).entries.upsertEntry(onPc.id, '2026-10-04', { completed: true, value: 20 });
  await repos(pc).objectives.create({ name: 'Leer', cadence: Cadence.WEEKLY, trackingType: TrackingType.BOOLEAN });

  const remote = await buildSnapshot(phone);
  await adoptMatchingObjectives(pc, remote);
  await mergeSnapshot(pc, remote);

  const objectives = await repos(pc).objectives.list();
  expect(objectives).toHaveLength(2); // the weekly yes/no "Leer" is a different objective
  const daily = objectives.find((o) => o.cadence === Cadence.DAILY)!;
  const entries = await repos(pc).entries.getEntriesInRange('2026-10-01', '2026-10-31', daily.id);
  expect(entries.map((e) => e.value)).toEqual([10, 20]);
});

test('a damaged or tampered copy is refused whole', async () => {
  const db = await createTestDb();
  await repos(db).objectives.create(reading);
  const good = await buildSnapshot(db);
  expect(parseSnapshot(JSON.stringify(good))).toEqual(good);

  const tampered = [
    'not json',
    JSON.stringify({ ...good, objectives: [{ ...good.objectives[0], status: 'hacked' }] }),
    JSON.stringify({ ...good, objectives: [{ ...good.objectives[0], uid: "x' OR 1=1 --" }] }),
    JSON.stringify({ ...good, entries: [{ objective_uid: good.objectives[0].uid, entry_date: 'ayer' }] }),
    JSON.stringify({ ...good, tombstones: [{ kind: 'table', key: 'objectives', deleted_at: 1 }] }),
    JSON.stringify({ ...good, settings: null }),
  ];
  for (const text of tampered) expect(() => parseSnapshot(text)).toThrow(/dañada/);
});
