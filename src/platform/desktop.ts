import { Platform } from 'react-native';

/*
 * Bridge to the Windows desktop app, which shows this same web build inside WebView2 and
 * handles what a browser can't: the database file, notifications while the window is
 * closed (the app lives in the tray) and starting with Windows. See desktop/ in the repo.
 */

interface WebViewBridge {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

type HostReply = { id: number; ok: boolean; result?: unknown; error?: string };
type HostEvent = { event: string };

const webview: WebViewBridge | undefined =
  Platform.OS === 'web' ? (globalThis as { chrome?: { webview?: WebViewBridge } }).chrome?.webview : undefined;

/** True when running inside the Windows desktop app. */
export const isDesktop = webview !== undefined;

let nextId = 1;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const eventListeners = new Map<string, Set<() => Promise<void> | void>>();

webview?.addEventListener('message', ({ data }) => {
  const message = data as HostReply | HostEvent;
  if ('event' in message) {
    const listeners = [...(eventListeners.get(message.event) ?? [])];
    // The host waits for this acknowledgement (e.g. before freeing the page when hidden).
    Promise.allSettled(listeners.map((listener) => listener())).then(() =>
      webview.postMessage({ type: 'eventDone', payload: { event: message.event } }),
    );
    return;
  }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.ok) request.resolve(message.result);
  else request.reject(new Error(message.error ?? 'Desktop host error'));
});

/** Calls the desktop host. Only valid when `isDesktop`. */
export function callHost<T = void>(type: string, payload?: unknown): Promise<T> {
  if (!webview) return Promise.reject(new Error('Not running in the desktop app'));
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    webview.postMessage({ id, type, payload });
  });
}

/** Runs `listener` when the host announces `event` ('hide': the window is about to be freed). */
export function onHostEvent(event: string, listener: () => Promise<void> | void): () => void {
  const listeners = eventListeners.get(event) ?? new Set();
  listeners.add(listener);
  eventListeners.set(event, listeners);
  return () => listeners.delete(listener);
}

export interface DesktopNotification {
  /** Epoch milliseconds. */
  at: number;
  title: string;
  body: string;
  /** Play the pomodoro alarm sound. */
  sound?: boolean;
}

/** Replaces every scheduled notification of `group` ('reminders' or 'pomodoro'). */
export function scheduleDesktopNotifications(group: 'reminders' | 'pomodoro', items: DesktopNotification[]) {
  return callHost('notifications.schedule', { group, items });
}
