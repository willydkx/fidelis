import type { Database } from 'sql.js';

import { Db, SqlValue } from '@/db/types';

/**
 * Adapts a sql.js database (the web version's SQLite) to the app's Db interface.
 * `onWrite` is called after every statement that may have changed data, so the caller can
 * persist the database.
 */
export function wrapSqlJs(raw: Database, onWrite: () => void): Db {
  const rows = <T>(source: string, params: SqlValue[], limit = Infinity): T[] => {
    const statement = raw.prepare(source, params);
    const result: T[] = [];
    try {
      while (result.length < limit && statement.step()) result.push(statement.getAsObject() as T);
    } finally {
      statement.free();
    }
    return result;
  };

  return {
    async execAsync(source) {
      raw.exec(source);
      onWrite();
    },
    async runAsync(source, params) {
      raw.run(source, params);
      const changes = raw.getRowsModified();
      const lastInsertRowId = Number(raw.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0);
      if (changes > 0) onWrite();
      return { lastInsertRowId, changes };
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return rows<T>(source, params);
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return rows<T>(source, params, 1)[0] ?? null;
    },
  };
}
