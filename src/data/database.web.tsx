import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import initSqlJs, { Database } from 'sql.js';

import { DATABASE_NAME } from '@/config';
import { runMigrations } from '@/db/migrations';
import { wrapSqlJs } from '@/db/sqlJsDb';
import { Db } from '@/db/types';
import { callHost, isDesktop, onHostEvent } from '@/platform/desktop';

/*
 * On the web the database is SQLite compiled to WebAssembly (sql.js), kept in memory and
 * saved after every write: to IndexedDB in the browser, or to a real .db file through the
 * desktop app. expo-sqlite's web build needs cross-origin isolation headers, which static
 * hosts such as GitHub Pages can't send.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro turns the .wasm into an asset URL
const wasmAsset = require('sql.js/dist/sql-wasm-browser.wasm');

const IDB_NAME = 'fidelis';
const IDB_STORE = 'databases';
const SAVE_DELAY_MS = 250;

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let connection: Promise<IDBDatabase> | null = null;

async function openStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  if (!connection) {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
    connection = idbRequest(open);
  }
  return (await connection).transaction(IDB_STORE, mode).objectStore(IDB_STORE);
}

interface Storage {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

const browserStorage: Storage = {
  async load() {
    const stored = await idbRequest((await openStore('readonly')).get(DATABASE_NAME));
    return stored instanceof Uint8Array ? stored : null;
  },
  async save(bytes) {
    await idbRequest((await openStore('readwrite')).put(bytes, DATABASE_NAME));
  },
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** The desktop app keeps the database as a regular SQLite file in the user's AppData. */
const desktopStorage: Storage = {
  async load() {
    const base64 = await callHost<string | null>('db.load');
    return base64 ? fromBase64(base64) : null;
  },
  async save(bytes) {
    await callHost('db.save', toBase64(bytes));
  },
};

const storage = isDesktop ? desktopStorage : browserStorage;

function wasmUrl(): string {
  return typeof wasmAsset === 'string' ? wasmAsset : wasmAsset.uri ?? wasmAsset.default;
}

function createDb(raw: Database): Db {
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Saves run one after another so an older snapshot never overwrites a newer one.
  let saving: Promise<void> = Promise.resolve();

  const flush = () => {
    if (!pending) return;
    pending = false;
    clearTimeout(timer);
    const bytes = raw.export();
    // export() resets connection pragmas.
    raw.exec('PRAGMA foreign_keys = ON');
    saving = saving.then(() => storage.save(bytes)).catch((error) => console.warn('[Fidelis] save failed', error));
  };
  const scheduleSave = () => {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  };
  // Don't lose the last change if the tab is closed or the app is sent to the background.
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  // The desktop app frees the page when its window is closed to the tray; save first.
  onHostEvent('hide', () => {
    flush();
    return saving;
  });

  return wrapSqlJs(raw, scheduleSave);
}

async function openDatabase(): Promise<Db> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl() });
  const db = createDb(new SQL.Database((await storage.load()) ?? undefined));
  await runMigrations(db);
  // Ask the browser not to evict the data under storage pressure (best effort).
  navigator.storage?.persist?.().catch(() => {});
  return db;
}

const DbContext = createContext<Db | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    openDatabase().then(setDb, setError);
  }, []);

  if (error) throw error;
  if (!db) return null;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside <DatabaseProvider>');
  return db;
}
