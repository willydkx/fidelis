import { Db, SqlValue } from '@/db/types';
import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { JOURNAL_MAX_LENGTH } from '@/repositories/journalRepository';
import { USER_NAME_KEY } from '@/utils/personalization';

/*
 * Sync works on whole snapshots: every device keeps the full data set, so syncing is
 * "download the shared copy, merge it in, upload the result". Each row carries the time of
 * its last change (modified_at) and the newer version wins; deletions are kept as tombstones
 * so they spread too. Merging is idempotent, so a missed or repeated sync heals on the next one.
 */

export const SNAPSHOT_FORMAT = 1;

/** Settings shared between devices. Everything else (reminders, pomodoro...) is per device. */
export const SYNCED_SETTINGS = [USER_NAME_KEY];

export interface SnapshotObjective {
  uid: string;
  name: string;
  description: string | null;
  cadence: string;
  tracking_type: string;
  target_value: number | null;
  unit: string | null;
  status: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
  days_of_week: string | null;
  modified_at: number;
}

export interface SnapshotEntry {
  objective_uid: string;
  entry_date: string;
  completed: number;
  value: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  modified_at: number;
}

export interface SnapshotSetting {
  key: string;
  value: string | null;
  modified_at: number;
}

export interface SnapshotJournalEntry {
  entry_date: string;
  text: string;
  mood: number | null;
  modified_at: number;
}

export interface Tombstone {
  kind: 'objective' | 'entry';
  key: string;
  deleted_at: number;
}

export interface Snapshot {
  format: number;
  objectives: SnapshotObjective[];
  entries: SnapshotEntry[];
  settings: SnapshotSetting[];
  tombstones: Tombstone[];
  /** Added in 1.4.0. Optional so copies from 1.3.0 still load, and 1.3.0 ignores it. */
  journal?: SnapshotJournalEntry[];
}

const OBJECTIVE_FIELDS = [
  'name',
  'description',
  'cadence',
  'tracking_type',
  'target_value',
  'unit',
  'status',
  'color',
  'sort_order',
  'created_at',
  'archived_at',
  'days_of_week',
  'modified_at',
] as const;

const ENTRY_FIELDS = ['completed', 'value', 'note', 'created_at', 'updated_at', 'modified_at'] as const;

const placeholders = (count: number) => Array(count).fill('?').join(', ');

/** Everything this device knows, in a stable order (so equal data gives equal JSON). */
export async function buildSnapshot(db: Db): Promise<Snapshot> {
  const objectives = await db.getAllAsync<SnapshotObjective>(
    `SELECT uid, ${OBJECTIVE_FIELDS.join(', ')} FROM objectives ORDER BY uid`,
    [],
  );
  const entries = await db.getAllAsync<SnapshotEntry>(
    `SELECT o.uid AS objective_uid, e.entry_date, ${ENTRY_FIELDS.map((f) => `e.${f}`).join(', ')}
     FROM daily_entries e JOIN objectives o ON o.id = e.objective_id
     ORDER BY o.uid, e.entry_date`,
    [],
  );
  const settings = await db.getAllAsync<SnapshotSetting>(
    `SELECT key, value, modified_at FROM app_settings WHERE key IN (${placeholders(SYNCED_SETTINGS.length)}) ORDER BY key`,
    SYNCED_SETTINGS,
  );
  const tombstones = await db.getAllAsync<Tombstone>(
    'SELECT kind, key, deleted_at FROM sync_tombstones ORDER BY kind, key',
    [],
  );
  const journal = await db.getAllAsync<SnapshotJournalEntry>(
    'SELECT entry_date, text, mood, modified_at FROM journal_entries ORDER BY entry_date',
    [],
  );
  return { format: SNAPSHOT_FORMAT, objectives, entries, settings, tombstones, journal };
}

/*
 * The copy downloaded from Drive is checked row by row before anything is written locally,
 * so a damaged or tampered file is refused as a whole instead of half-applied.
 */
const UID = /^[0-9a-f]{32}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = /^[0-6](,[0-6])*$/;

const isText = (v: unknown, max = 10_000) => typeof v === 'string' && v.length <= max;
const isTextOrNull = (v: unknown, max = 10_000) => v === null || isText(v, max);
const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isNumberOrNull = (v: unknown) => v === null || isNumber(v);
const isTime = (v: unknown) => isNumber(v) && (v as number) >= 0;
const isOneOf = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v);

function isObjective(o: SnapshotObjective): boolean {
  return (
    UID.test(String(o.uid)) &&
    isText(o.name, 1_000) &&
    isTextOrNull(o.description) &&
    isOneOf(o.cadence, Object.values(Cadence)) &&
    isOneOf(o.tracking_type, Object.values(TrackingType)) &&
    isNumberOrNull(o.target_value) &&
    isTextOrNull(o.unit, 1_000) &&
    isOneOf(o.status, Object.values(ObjectiveStatus)) &&
    isTextOrNull(o.color, 100) &&
    Number.isInteger(o.sort_order) &&
    isText(o.created_at, 40) &&
    isTextOrNull(o.archived_at, 40) &&
    (o.days_of_week === null || DAYS.test(String(o.days_of_week))) &&
    isTime(o.modified_at)
  );
}

function isEntry(e: SnapshotEntry): boolean {
  return (
    UID.test(String(e.objective_uid)) &&
    DATE.test(String(e.entry_date)) &&
    (e.completed === 0 || e.completed === 1) &&
    isNumberOrNull(e.value) &&
    isTextOrNull(e.note) &&
    isText(e.created_at, 40) &&
    isText(e.updated_at, 40) &&
    isTime(e.modified_at)
  );
}

function isSetting(t: SnapshotSetting): boolean {
  return isText(t.key, 100) && isTextOrNull(t.value, 1_000) && isTime(t.modified_at);
}

function isJournalEntry(j: SnapshotJournalEntry): boolean {
  return (
    DATE.test(String(j.entry_date)) &&
    isText(j.text, JOURNAL_MAX_LENGTH) &&
    (j.mood === null || (Number.isInteger(j.mood) && j.mood >= 1 && j.mood <= 5)) &&
    isTime(j.modified_at)
  );
}

function isTombstone(t: Tombstone): boolean {
  if (!isTime(t.deleted_at)) return false;
  if (t.kind === 'objective') return UID.test(String(t.key));
  if (t.kind !== 'entry' || typeof t.key !== 'string') return false;
  const [uid, date] = splitEntryKey(t.key);
  return UID.test(uid) && DATE.test(date);
}

/** Parses the downloaded copy, refusing it entirely if anything in it looks wrong. */
export function parseSnapshot(text: string): Snapshot {
  const invalid = () => new Error('La copia de Drive está dañada y no se ha usado. Tus datos locales están intactos.');
  let value: Snapshot;
  try {
    value = JSON.parse(text) as Snapshot;
  } catch {
    throw invalid();
  }
  const valid =
    !!value &&
    typeof value === 'object' &&
    Number.isInteger(value.format) &&
    Array.isArray(value.objectives) &&
    Array.isArray(value.entries) &&
    Array.isArray(value.settings) &&
    Array.isArray(value.tombstones) &&
    value.objectives.every((o) => !!o && isObjective(o)) &&
    value.entries.every((e) => !!e && isEntry(e)) &&
    value.settings.every((t) => !!t && isSetting(t)) &&
    value.tombstones.every((t) => !!t && isTombstone(t)) &&
    (value.journal === undefined ||
      (Array.isArray(value.journal) && value.journal.every((j) => !!j && isJournalEntry(j))));
  if (!valid) throw invalid();
  return value;
}

/**
 * Brings `remote` into the local database. Returns true if anything local changed.
 * Rows keep the remote modified_at, so merging never makes data look newer than it is.
 */
export async function mergeSnapshot(db: Db, remote: Snapshot): Promise<boolean> {
  if (remote.format > SNAPSHOT_FORMAT) {
    throw new Error('Los datos de sincronización son de una versión más nueva de Fidelis. Actualiza la app.');
  }
  let changed = false;

  // 1. Deletions.
  for (const tombstone of remote.tombstones) {
    await db.runAsync(
      `INSERT INTO sync_tombstones (kind, key, deleted_at) VALUES (?, ?, ?)
       ON CONFLICT (kind, key) DO UPDATE SET deleted_at = max(deleted_at, excluded.deleted_at)`,
      [tombstone.kind, tombstone.key, tombstone.deleted_at],
    );
    if (tombstone.kind === 'objective') {
      const local = await db.getFirstAsync<{ id: number; modified_at: number }>(
        'SELECT id, modified_at FROM objectives WHERE uid = ?',
        [tombstone.key],
      );
      if (local && local.modified_at <= tombstone.deleted_at) {
        await db.runAsync('DELETE FROM daily_entries WHERE objective_id = ?', [local.id]);
        await db.runAsync('DELETE FROM objectives WHERE id = ?', [local.id]);
        changed = true;
      }
    } else {
      const [objectiveUid, date] = splitEntryKey(tombstone.key);
      const result = await db.runAsync(
        `DELETE FROM daily_entries
         WHERE entry_date = ? AND modified_at <= ?
           AND objective_id = (SELECT id FROM objectives WHERE uid = ?)`,
        [date, tombstone.deleted_at, objectiveUid],
      );
      changed ||= result.changes > 0;
    }
  }

  // 2. Objectives.
  const deletedAt = await tombstoneTimes(db);
  for (const objective of remote.objectives) {
    if ((deletedAt.get(`objective:${objective.uid}`) ?? -1) >= objective.modified_at) continue;
    const local = await db.getFirstAsync<{ modified_at: number }>(
      'SELECT modified_at FROM objectives WHERE uid = ?',
      [objective.uid],
    );
    const values = OBJECTIVE_FIELDS.map((field) => objective[field] as SqlValue);
    if (!local) {
      await db.runAsync(
        `INSERT INTO objectives (uid, ${OBJECTIVE_FIELDS.join(', ')}) VALUES (?, ${placeholders(OBJECTIVE_FIELDS.length)})`,
        [objective.uid, ...values],
      );
      changed = true;
    } else if (objective.modified_at > local.modified_at) {
      await db.runAsync(
        `UPDATE objectives SET ${OBJECTIVE_FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE uid = ?`,
        [...values, objective.uid],
      );
      changed = true;
    }
  }

  // 3. Entries (their objective must exist here by now, unless it was deleted).
  const objectiveIds = new Map(
    (await db.getAllAsync<{ id: number; uid: string }>('SELECT id, uid FROM objectives', [])).map((o) => [o.uid, o.id]),
  );
  for (const entry of remote.entries) {
    const objectiveId = objectiveIds.get(entry.objective_uid);
    if (objectiveId === undefined) continue;
    if ((deletedAt.get(`entry:${entry.objective_uid}|${entry.entry_date}`) ?? -1) >= entry.modified_at) continue;
    const local = await db.getFirstAsync<{ modified_at: number }>(
      'SELECT modified_at FROM daily_entries WHERE objective_id = ? AND entry_date = ?',
      [objectiveId, entry.entry_date],
    );
    if (local && entry.modified_at <= local.modified_at) continue;
    const values = ENTRY_FIELDS.map((field) => entry[field] as SqlValue);
    await db.runAsync(
      `INSERT INTO daily_entries (objective_id, entry_date, ${ENTRY_FIELDS.join(', ')})
       VALUES (?, ?, ${placeholders(ENTRY_FIELDS.length)})
       ON CONFLICT (objective_id, entry_date) DO UPDATE SET
         ${ENTRY_FIELDS.map((f) => `${f} = excluded.${f}`).join(', ')}`,
      [objectiveId, entry.entry_date, ...values],
    );
    changed = true;
  }

  // 4. Shared settings.
  for (const setting of remote.settings) {
    if (!SYNCED_SETTINGS.includes(setting.key)) continue;
    const result = await db.runAsync(
      `INSERT INTO app_settings (key, value, modified_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, modified_at = excluded.modified_at
       WHERE excluded.modified_at > app_settings.modified_at`,
      [setting.key, setting.value, setting.modified_at],
    );
    changed ||= result.changes > 0;
  }

  // 5. Diary.
  for (const entry of remote.journal ?? []) {
    const result = await db.runAsync(
      `INSERT INTO journal_entries (entry_date, text, mood, modified_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (entry_date) DO UPDATE SET
           text = excluded.text, mood = excluded.mood, modified_at = excluded.modified_at
       WHERE excluded.modified_at > journal_entries.modified_at`,
      [entry.entry_date, entry.text, entry.mood, entry.modified_at],
    );
    changed ||= result.changes > 0;
  }

  return changed;
}

function splitEntryKey(key: string): [objectiveUid: string, date: string] {
  const separator = key.lastIndexOf('|');
  return [key.slice(0, separator), key.slice(separator + 1)];
}

async function tombstoneTimes(db: Db): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<Tombstone>('SELECT kind, key, deleted_at FROM sync_tombstones', []);
  return new Map(rows.map((t) => [`${t.kind}:${t.key}`, t.deleted_at]));
}

/**
 * For a device's first sync: objectives created separately on each device before connecting
 * (often the same suggestions from the welcome screen) are recognised as one when they have
 * the same name, cadence and kind, instead of showing up twice. The local one takes the
 * remote id, and their entries then merge day by day.
 */
export async function adoptMatchingObjectives(db: Db, remote: Snapshot): Promise<void> {
  const local = await db.getAllAsync<{ id: number; uid: string; name: string; cadence: string; tracking_type: string }>(
    'SELECT id, uid, name, cadence, tracking_type FROM objectives',
    [],
  );
  const localUids = new Set(local.map((o) => o.uid));
  const remoteUids = new Set(remote.objectives.map((o) => o.uid));
  const signature = (o: { name: string; cadence: string; tracking_type: string }) =>
    `${o.name.trim().toLowerCase()}|${o.cadence}|${o.tracking_type}`;
  const unmatchedRemote = new Map<string, string>();
  for (const objective of remote.objectives) {
    if (!localUids.has(objective.uid) && !unmatchedRemote.has(signature(objective))) {
      unmatchedRemote.set(signature(objective), objective.uid);
    }
  }
  for (const objective of local) {
    if (remoteUids.has(objective.uid)) continue;
    const match = unmatchedRemote.get(signature(objective));
    if (!match) continue;
    unmatchedRemote.delete(signature(objective));
    await db.runAsync('UPDATE objectives SET uid = ? WHERE id = ?', [match, objective.id]);
  }
}
