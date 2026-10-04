import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { ReactNode } from 'react';

import { DATABASE_NAME } from '@/config';
import { runMigrations } from '@/db/migrations';
import { Db } from '@/db/types';

/** Opens the app database (expo-sqlite on Android) and runs pending migrations. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={runMigrations}>
      {children}
    </SQLiteProvider>
  );
}

export function useDb(): Db {
  return useSQLiteContext();
}
