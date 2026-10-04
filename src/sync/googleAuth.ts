import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

import { DRIVE_APPDATA_SCOPE, GOOGLE_WEB_CLIENT_ID } from '@/config';

/*
 * Google sign-in on Android: the system account picker, then a token limited to Fidelis's
 * own hidden Drive folder. Google Play services keep and refresh the session; Fidelis never
 * sees the password. The browser/desktop version is in googleAuth.web.ts.
 */

export const googleAuthAvailable = GOOGLE_WEB_CLIENT_ID !== '';

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: [DRIVE_APPDATA_SCOPE] });
  configured = true;
}

/** Opens Google's account picker; resolves with the chosen account, or null if cancelled. */
export async function connectGoogle(): Promise<string | null> {
  configure();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  return isSuccessResponse(response) ? response.data.user.email : null;
}

/** The account connected earlier, restored without asking anything; null if none. */
export async function googleAccount(): Promise<string | null> {
  configure();
  const response = await GoogleSignin.signInSilently();
  return response.type === 'success' ? response.data.user.email : null;
}

export async function googleAccessToken(): Promise<string> {
  configure();
  if (!GoogleSignin.getCurrentUser()) await GoogleSignin.signInSilently();
  return (await GoogleSignin.getTokens()).accessToken;
}

/** Drops a token Google has rejected, so the next request gets a fresh one. */
export async function discardAccessToken(token: string): Promise<void> {
  await GoogleSignin.clearCachedAccessToken(token);
}

/** Forgets the account and withdraws Fidelis's access to it. */
export async function disconnectGoogle(): Promise<void> {
  configure();
  try {
    await GoogleSignin.revokeAccess();
  } finally {
    await GoogleSignin.signOut();
  }
}
