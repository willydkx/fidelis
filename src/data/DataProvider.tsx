import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DatabaseProvider, useDb } from '@/data/database';
import { Db } from '@/db/types';
import { ensureNotificationPermission, rescheduleReminders } from '@/notifications/reminders';
import { EntriesRepository } from '@/repositories/entriesRepository';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { SettingsRepository } from '@/repositories/settingsRepository';
import { AggregationService } from '@/services/aggregationService';
import { USER_NAME_KEY } from '@/utils/personalization';

export interface DataContextValue {
  db: Db;
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
  const db = useDb();
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

  // Ask once on launch for returning users; first-time users are asked at the end of the
  // welcome screen instead. Settings offers the prompt again if it was dismissed.
  useEffect(() => {
    repos.settings
      .get(USER_NAME_KEY)
      .then((name) => (name === null ? false : ensureNotificationPermission(true)))
      .then(notifyChanged, (error) => console.warn('[Fidelis] permission', error));
  }, [repos, notifyChanged]);

  // Any write can change whether today's reminder is still needed.
  useEffect(() => {
    rescheduleReminders(repos).catch((error) => console.warn('[Fidelis] reminders', error));
  }, [repos, version]);

  const value = useMemo(() => ({ db, ...repos, version, notifyChanged }), [db, repos, version, notifyChanged]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <DatabaseProvider>
      <DataContextProvider>{children}</DataContextProvider>
    </DatabaseProvider>
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
