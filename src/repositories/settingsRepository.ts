import { Db } from '@/db/types';

export class SettingsRepository {
  constructor(private readonly db: Db) {}

  async get(key: string): Promise<string | null>;
  async get(key: string, defaultValue: string): Promise<string>;
  async get(key: string, defaultValue: string | null = null): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string | null }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key],
    );
    return row ? row.value : defaultValue;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }
}
