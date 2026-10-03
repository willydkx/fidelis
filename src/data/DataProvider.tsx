import { SQLiteDatabase, SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DATABASE_NAME } from '@/config';
import { runMigrations } from '@/db/migrations';
import { ensureNotificationPermission, rescheduleReminders } from '@/notifications/reminders';
import { EntriesRepository } from '@/repositories/entriesRepository';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { SettingsRepository } from '@/repositories/settingsRepository';
import { AggregationService } from '@/services/aggregationService';

export interface DataContextValue {
  db: SQLiteDatabase;
  objectives: ObjectivesRepository;
  entries: EntriesRepository;
  settings: SettingsRepository;
  aggregation: AggregationService;
  /** Bumped after every write; screens reload their data when it changes. */
  version: number;
  notifyChanged: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

function DataContextProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [version, setVersion] = useState(0);

  const repos = useMemo(() => {
    const objectives = new ObjectivesRepository(db);
    const entries = new EntriesRepository(db);
    return {
      objectives,
      entries,
      settings: new SettingsRepository(db),
      aggregation: new AggregationService(objectives, entries),
    };
  }, [db]);

  const notifyChanged = useCallback(() => setVersion((v) => v + 1), []);

  // Ask once on launch; Settings offers the prompt again if it was dismissed.
  useEffect(() => {
    ensureNotificationPermission(true).then(notifyChanged, (error) => console.warn('[Fidelis] permission', error));
  }, [notifyChanged]);

  // Any write can change whether today's reminder is still needed.
  useEffect(() => {
    rescheduleReminders(repos).catch((error) => console.warn('[Fidelis] reminders', error));
  }, [repos, version]);

  const value = useMemo(() => ({ db, ...repos, version, notifyChanged }), [db, repos, version, notifyChanged]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={runMigrations}>
      <DataContextProvider>{children}</DataContextProvider>
    </SQLiteProvider>
  );
}

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) {
    throw new Error('useData must be used inside <DataProvider>');
  }
  return value;
}

/** Runs `load` on mount and after every data change; returns null until the first load finishes. */
export function useDataQuery<T>(load: (data: DataContextValue) => Promise<T>, deps: unknown[] = []): T | null {
  const data = useData();
  const [result, setResult] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(data).then(
      (value) => !cancelled && setResult(value),
      (error) => console.warn('[Fidelis] query failed', error),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.version, ...deps]);

  return result;
}
