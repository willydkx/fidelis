import { Db } from '@/db/types';
import { ISODate } from '@/utils/dateUtils';

/** 1 (bad day) to 5 (great day). */
export type Mood = 1 | 2 | 3 | 4 | 5;

export const JOURNAL_MAX_LENGTH = 20_000;

export interface JournalEntry {
  date: ISODate;
  text: string;
  mood: Mood | null;
}

interface JournalRow {
  entry_date: string;
  text: string;
  mood: number | null;
}

function rowToEntry(row: JournalRow): JournalEntry {
  return { date: row.entry_date, text: row.text, mood: row.mood as Mood | null };
}

/** Lower case without accents, for searching ("Andén" matches "anden"). */
export function searchKey(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export class JournalRepository {
  constructor(private readonly db: Db) {}

  async get(date: ISODate): Promise<JournalEntry | null> {
    const row = await this.db.getFirstAsync<JournalRow>(
      'SELECT entry_date, text, mood FROM journal_entries WHERE entry_date = ?',
      [date],
    );
    return row ? rowToEntry(row) : null;
  }

  /** Saves the day's entry; returns false if nothing changed. */
  async save(date: ISODate, { text, mood }: { text: string; mood: Mood | null }): Promise<boolean> {
    const result = await this.db.runAsync(
      `INSERT INTO journal_entries (entry_date, text, mood, modified_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (entry_date) DO UPDATE SET
           text = excluded.text,
           mood = excluded.mood,
           modified_at = excluded.modified_at
       WHERE text IS NOT excluded.text OR mood IS NOT excluded.mood`,
      [date, text.slice(0, JOURNAL_MAX_LENGTH), mood, Date.now()],
    );
    return result.changes > 0;
  }

  /** Days with something written or a mood, newest first, optionally filtered by text. */
  async list(search = ''): Promise<JournalEntry[]> {
    const rows = await this.db.getAllAsync<JournalRow>(
      `SELECT entry_date, text, mood FROM journal_entries
       WHERE trim(text) <> '' OR mood IS NOT NULL
       ORDER BY entry_date DESC`,
      [],
    );
    const query = searchKey(search.trim());
    const entries = rows.map(rowToEntry);
    return query ? entries.filter((e) => searchKey(e.text).includes(query)) : entries;
  }

  /** Mood of each day in [start, end] that has one. */
  async moodsInRange(start: ISODate, end: ISODate): Promise<Map<ISODate, Mood>> {
    const rows = await this.db.getAllAsync<{ entry_date: string; mood: Mood }>(
      `SELECT entry_date, mood FROM journal_entries
       WHERE entry_date BETWEEN ? AND ? AND mood IS NOT NULL
       ORDER BY entry_date`,
      [start, end],
    );
    return new Map(rows.map((r) => [r.entry_date, r.mood]));
  }
}
