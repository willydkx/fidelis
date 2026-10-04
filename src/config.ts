export const DATABASE_NAME = 'fidelis.db';
export const DEFAULT_REMINDER_TIME = '20:30';
export const EFFICIENCY_RATIO_WEIGHT = 0.6;
export const EFFICIENCY_COMPLETION_WEIGHT = 0.4;

// Sync through the user's own Google Drive (a hidden folder only Fidelis can see).
// The OAuth client id is public by design: it identifies the app to Google, it grants nothing.
export const GOOGLE_WEB_CLIENT_ID: string = '318841850686-2fjkfg1p6ikhaeuk0931dr16rq7p1nag.apps.googleusercontent.com';
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
