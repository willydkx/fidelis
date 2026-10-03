import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '@/db/migrations';
import { Db, SqlValue } from '@/db/types';

/** In-memory database backed by Node's built-in SQLite, matching the app's Db interface. */
export async function createTestDb(): Promise<Db & { raw: DatabaseSync }> {
  const raw = new DatabaseSync(':memory:');
  const db = {
    raw,
    async execAsync(source: string) {
      raw.exec(source);
    },
    async runAsync(source: string, params: SqlValue[]) {
      const result = raw.prepare(source).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return raw.prepare(source).all(...params) as T[];
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return (raw.prepare(source).get(...params) as T | undefined) ?? null;
    },
  };
  await runMigrations(db);
  return db;
}
