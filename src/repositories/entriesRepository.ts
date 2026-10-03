import { Db } from '@/db/types';
import { DailyEntry } from '@/models/entry';
import { ISODate } from '@/utils/dateUtils';

interface EntryRow {
  id: number;
  objective_id: number;
  entry_date: string;
  completed: number;
  value: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: EntryRow): DailyEntry {
  return {
    id: row.id,
    objectiveId: row.objective_id,
    entryDate: row.entry_date,
    completed: Boolean(row.completed),
    value: row.value,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class EntriesRepository {
  constructor(private readonly db: Db) {}

  async upsertEntry(
    objectiveId: number,
    entryDate: ISODate,
    { completed, value = null, note = '' }: { completed: boolean; value?: number | null; note?: string },
  ): Promise<DailyEntry> {
    await this.db.runAsync(
      `INSERT INTO daily_entries (objective_id, entry_date, completed, value, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (objective_id, entry_date) DO UPDATE SET
           completed = excluded.completed,
           value = excluded.value,
           note = excluded.note,
           updated_at = datetime('now')`,
      [objectiveId, entryDate, completed ? 1 : 0, value, note],
    );
    const row = await this.db.getFirstAsync<EntryRow>(
      'SELECT * FROM daily_entries WHERE objective_id = ? AND entry_date = ?',
      [objectiveId, entryDate],
    );
    return rowToEntry(row!);
  }

  async getEntriesForDate(entryDate: ISODate): Promise<DailyEntry[]> {
    const rows = await this.db.getAllAsync<EntryRow>('SELECT * FROM daily_entries WHERE entry_date = ?', [
      entryDate,
    ]);
    return rows.map(rowToEntry);
  }

  async getEntriesInRange(start: ISODate, end: ISODate, objectiveId?: number): Promise<DailyEntry[]> {
    const rows =
      objectiveId === undefined
        ? await this.db.getAllAsync<EntryRow>(
            'SELECT * FROM daily_entries WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date',
            [start, end],
          )
        : await this.db.getAllAsync<EntryRow>(
            `SELECT * FROM daily_entries
             WHERE entry_date BETWEEN ? AND ? AND objective_id = ?
             ORDER BY entry_date`,
            [start, end, objectiveId],
          );
    return rows.map(rowToEntry);
  }

  async deleteEntry(entryId: number): Promise<void> {
    await this.db.runAsync('DELETE FROM daily_entries WHERE id = ?', [entryId]);
  }
}
