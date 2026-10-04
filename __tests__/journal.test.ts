import { Db } from '@/db/types';
import { JournalRepository } from '@/repositories/journalRepository';
import { buildSnapshot, mergeSnapshot, parseSnapshot, Snapshot } from '@/sync/snapshot';

import { createTestDb } from './testDb';

let now = 1_000;
beforeEach(() => {
  now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => (now += 1_000));
});
afterEach(() => jest.restoreAllMocks());

/** Same shared copy as in sync.test.ts: download, merge, upload. */
class Cloud {
  copy: string | null = null;

  async sync(db: Db): Promise<boolean> {
    const changed = this.copy ? await mergeSnapshot(db, parseSnapshot(this.copy)) : false;
    this.copy = JSON.stringify(await buildSnapshot(db));
    return changed;
  }
}

describe('JournalRepository', () => {
  test('saves, updates and reads one entry per day', async () => {
    const journal = new JournalRepository(await createTestDb());
    expect(await journal.get('2026-10-04')).toBeNull();

    expect(await journal.save('2026-10-04', { text: 'Buen día', mood: 4 })).toBe(true);
    expect(await journal.save('2026-10-04', { text: 'Buen día', mood: 4 })).toBe(false);
    expect(await journal.save('2026-10-04', { text: 'Muy buen día', mood: 5 })).toBe(true);
    expect(await journal.get('2026-10-04')).toEqual({ date: '2026-10-04', text: 'Muy buen día', mood: 5 });
  });

  test('lists non-empty days newest first and searches ignoring case and accents', async () => {
    const journal = new JournalRepository(await createTestDb());
    await journal.save('2026-10-01', { text: 'Fui a la montaña con Jimena', mood: null });
    await journal.save('2026-10-02', { text: '', mood: 2 });
    await journal.save('2026-10-03', { text: '   ', mood: null });
    await journal.save('2026-10-04', { text: 'Examen de cálculo', mood: 3 });

    expect((await journal.list()).map((e) => e.date)).toEqual(['2026-10-04', '2026-10-02', '2026-10-01']);
    expect((await journal.list('MONTANA')).map((e) => e.date)).toEqual(['2026-10-01']);
    expect((await journal.list('calc')).map((e) => e.date)).toEqual(['2026-10-04']);
    expect(await journal.list('nada')).toEqual([]);
  });

  test('moods in a range', async () => {
    const journal = new JournalRepository(await createTestDb());
    await journal.save('2026-09-30', { text: '', mood: 1 });
    await journal.save('2026-10-01', { text: 'sin ánimo', mood: null });
    await journal.save('2026-10-02', { text: '', mood: 5 });
    expect([...(await journal.moodsInRange('2026-10-01', '2026-10-31'))]).toEqual([['2026-10-02', 5]]);
  });
});

describe('diary sync', () => {
  test('entries travel between devices and the latest edit wins', async () => {
    const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
    await new JournalRepository(phone).save('2026-10-04', { text: 'Desde el móvil', mood: 4 });
    await cloud.sync(phone);
    expect(await cloud.sync(pc)).toBe(true);
    expect(await new JournalRepository(pc).get('2026-10-04')).toMatchObject({ text: 'Desde el móvil', mood: 4 });

    await new JournalRepository(phone).save('2026-10-04', { text: 'Móvil, editado', mood: 4 });
    await new JournalRepository(pc).save('2026-10-04', { text: 'PC, más tarde', mood: 3 });
    await cloud.sync(phone);
    await cloud.sync(pc);
    await cloud.sync(phone);
    for (const db of [phone, pc]) {
      expect(await new JournalRepository(db).get('2026-10-04')).toMatchObject({ text: 'PC, más tarde', mood: 3 });
    }
    expect(await cloud.sync(phone)).toBe(false);
  });

  test('emptying an entry also syncs', async () => {
    const [phone, pc, cloud] = [await createTestDb(), await createTestDb(), new Cloud()];
    await new JournalRepository(phone).save('2026-10-04', { text: 'Algo', mood: 2 });
    await cloud.sync(phone);
    await cloud.sync(pc);
    await new JournalRepository(pc).save('2026-10-04', { text: '', mood: null });
    await cloud.sync(pc);
    await cloud.sync(phone);
    expect(await new JournalRepository(phone).list()).toEqual([]);
  });

  test('copies from 1.3.0 (no diary) still load, and the diary survives them', async () => {
    const [phone, cloud] = [await createTestDb(), new Cloud()];
    await new JournalRepository(phone).save('2026-10-04', { text: 'Hola', mood: 5 });
    await cloud.sync(phone);
    // An older device downloads and re-uploads without the diary.
    const old = parseSnapshot(cloud.copy!);
    delete old.journal;
    cloud.copy = JSON.stringify(old);

    expect(await cloud.sync(phone)).toBe(false);
    expect((JSON.parse(cloud.copy) as Snapshot).journal).toHaveLength(1);
  });

  test('a damaged diary entry rejects the whole copy', async () => {
    const db = await createTestDb();
    const snapshot = await buildSnapshot(db);
    const bad = { ...snapshot, journal: [{ entry_date: '2026-10-04', text: 'x', mood: 9, modified_at: 1 }] };
    expect(() => parseSnapshot(JSON.stringify(bad))).toThrow();
    expect(() => parseSnapshot(JSON.stringify({ ...snapshot, journal: 'x' }))).toThrow();
  });
});
