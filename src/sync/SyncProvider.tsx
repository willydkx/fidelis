import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useData } from '@/data/DataProvider';
import { downloadSyncFile, DriveAuthError, uploadSyncFile } from '@/sync/drive';
import {
  connectGoogle,
  disconnectGoogle,
  discardAccessToken,
  googleAccessToken,
  googleAccount,
  googleAuthAvailable,
} from '@/sync/googleAuth';
import { adoptMatchingObjectives, buildSnapshot, mergeSnapshot, parseSnapshot } from '@/sync/snapshot';

// Per-device settings (never synced themselves).
const ACCOUNT_KEY = 'sync_account';
const LAST_SYNC_KEY = 'sync_last';

// Wait for a burst of edits to settle before syncing them.
const AFTER_CHANGE_MS = 4_000;
// While the app is open, also pick up changes made on other devices.
const PERIODIC_MS = 5 * 60_000;

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

interface SyncContextValue {
  available: boolean;
  account: string | null;
  status: SyncStatus;
  lastSync: number | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncNow: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

function describe(error: unknown): string {
  if (error instanceof DriveAuthError) return 'Google ha rechazado el acceso. Vuelve a conectar la cuenta.';
  if (error instanceof TypeError) return 'Sin conexión a internet. Se sincronizará cuando vuelva.';
  return error instanceof Error ? error.message : String(error);
}

/**
 * Keeps this device in sync with the shared copy in the user's Google Drive: on start, a few
 * seconds after every change, when the app comes back to the foreground and every few minutes.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { db, settings, version, notifyChanged } = useData();
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const running = useRef(false);
  const again = useRef(false);
  // A merge bumps the data version; that bump shouldn't schedule another sync.
  const ownChange = useRef(false);

  const sync = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      do {
        again.current = false;
        let token = await googleAccessToken();
        let remote: Awaited<ReturnType<typeof downloadSyncFile>>;
        try {
          remote = await downloadSyncFile(token);
        } catch (e) {
          if (!(e instanceof DriveAuthError)) throw e;
          // An expired token cached by the system: drop it and try once more.
          await discardAccessToken(token);
          token = await googleAccessToken();
          remote = await downloadSyncFile(token);
        }
        let changed = false;
        if (remote) {
          const snapshot = parseSnapshot(remote.text);
          if ((await settings.get(LAST_SYNC_KEY)) === null) await adoptMatchingObjectives(db, snapshot);
          changed = await mergeSnapshot(db, snapshot);
        }
        const local = JSON.stringify(await buildSnapshot(db));
        if (local !== remote?.text) await uploadSyncFile(token, remote?.id ?? null, local);
        if (changed) {
          ownChange.current = true;
          notifyChanged();
        }
      } while (again.current);
      const now = Date.now();
      await settings.set(LAST_SYNC_KEY, String(now));
      setLastSync(now);
      setError(null);
      setStatus('idle');
    } catch (e) {
      console.warn('[Fidelis] sync', e);
      setError(describe(e));
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, [db, settings, notifyChanged]);

  // Restore the connection saved on this device.
  useEffect(() => {
    if (!googleAuthAvailable) return;
    let cancelled = false;
    (async () => {
      const saved = await settings.get(ACCOUNT_KEY);
      const last = await settings.get(LAST_SYNC_KEY);
      if (cancelled || !saved) return;
      setLastSync(last ? Number(last) : null);
      setAccount((await googleAccount().catch(() => null)) ?? saved);
      setStatus('idle');
    })();
    return () => {
      cancelled = true;
    };
  }, [settings]);

  // Sync when connected, after changes (debounced), on return to the app and periodically.
  useEffect(() => {
    if (!account) return;
    if (ownChange.current) {
      ownChange.current = false;
      return;
    }
    const timer = setTimeout(sync, AFTER_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [account, version, sync]);

  useEffect(() => {
    if (!account) return;
    const interval = setInterval(sync, PERIODIC_MS);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && sync());
    const onVisible = () => document.visibilityState === 'visible' && sync();
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [account, sync]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const email = await connectGoogle();
      if (!email) return;
      await settings.set(ACCOUNT_KEY, email);
      setAccount(email);
      setStatus('idle');
      await sync();
    } catch (e) {
      setError(describe(e));
    }
  }, [settings, sync]);

  const disconnect = useCallback(async () => {
    await disconnectGoogle().catch((e) => console.warn('[Fidelis] disconnect', e));
    await settings.set(ACCOUNT_KEY, '');
    setAccount(null);
    setStatus('off');
    setError(null);
  }, [settings]);

  const value = useMemo(
    () => ({
      available: googleAuthAvailable,
      account,
      status,
      lastSync,
      error,
      connect,
      disconnect,
      syncNow: () => void sync(),
    }),
    [account, status, lastSync, error, connect, disconnect, sync],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>');
  return value;
}
