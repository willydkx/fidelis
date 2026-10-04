import { callHost, isDesktop } from '@/platform/desktop';

/*
 * In the Windows app, the desktop host signs in through the default browser and keeps the
 * session (encrypted for the Windows user); the page only asks it for short-lived tokens.
 * The browser version has no sync: it can't keep a Google session without a server.
 */

export const googleAuthAvailable = isDesktop;

export async function connectGoogle(): Promise<string | null> {
  return callHost<string | null>('google.signIn');
}

export async function googleAccount(): Promise<string | null> {
  return callHost<string | null>('google.account');
}

export async function googleAccessToken(): Promise<string> {
  return callHost<string>('google.token');
}

/** Drops a token Google has rejected, so the next request gets a fresh one. */
export async function discardAccessToken(_token: string): Promise<void> {
  await callHost('google.discardToken');
}

export async function disconnectGoogle(): Promise<void> {
  await callHost('google.signOut');
}
