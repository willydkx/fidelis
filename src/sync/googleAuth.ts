import type * as GoogleSignInModule from '@react-native-google-signin/google-signin';
import { isRunningInExpoGo } from 'expo';

import { DRIVE_APPDATA_SCOPE, GOOGLE_WEB_CLIENT_ID } from '@/config';

/*
 * Google sign-in on Android: the system account picker, then a token limited to Fidelis's
 * own hidden Drive folder. Google Play services keep and refresh the session; Fidelis never
 * sees the password. The browser/desktop version is in googleAuth.web.ts.
 */

// Expo Go has no Google sign-in native module, and importing it there throws; sync is
// simply hidden in Expo Go and the module is only loaded on first use.
export const googleAuthAvailable = GOOGLE_WEB_CLIENT_ID !== '' && !isRunningInExpoGo();

let signInModule: typeof GoogleSignInModule | null = null;
function configure() {
  if (signInModule) return signInModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see above
  signInModule = require('@react-native-google-signin/google-signin') as typeof GoogleSignInModule;
  signInModule.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: [DRIVE_APPDATA_SCOPE] });
  return signInModule;
}

/** Opens Google's account picker; resolves with the chosen account, or null if cancelled. */
export async function connectGoogle(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse } = configure();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  return isSuccessResponse(response) ? response.data.user.email : null;
}

/** The account connected earlier, restored without asking anything; null if none. */
export async function googleAccount(): Promise<string | null> {
  const { GoogleSignin } = configure();
  const response = await GoogleSignin.signInSilently();
  return response.type === 'success' ? response.data.user.email : null;
}

export async function googleAccessToken(): Promise<string> {
  const { GoogleSignin } = configure();
  if (!GoogleSignin.getCurrentUser()) await GoogleSignin.signInSilently();
  return (await GoogleSignin.getTokens()).accessToken;
}

/** Drops a token Google has rejected, so the next request gets a fresh one. */
export async function discardAccessToken(token: string): Promise<void> {
  await configure().GoogleSignin.clearCachedAccessToken(token);
}

/** Forgets the account and withdraws Fidelis's access to it. */
export async function disconnectGoogle(): Promise<void> {
  const { GoogleSignin } = configure();
  try {
    await GoogleSignin.revokeAccess();
  } finally {
    await GoogleSignin.signOut();
  }
}
