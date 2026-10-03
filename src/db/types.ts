export type SqlValue = string | number | null;

/**
 * The subset of expo-sqlite's SQLiteDatabase the app uses. Keeping repositories on this
 * interface lets the Jest tests run them against Node's built-in SQLite.
 */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
}
