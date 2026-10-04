/*
 * The shared copy lives in the user's Drive "appDataFolder": a hidden folder that only
 * Fidelis can see (not even the user browsing Drive), reached with the drive.appdata scope.
 */

const FILE_NAME = 'fidelis-sync.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export class DriveAuthError extends Error {}

async function request(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers as Record<string, string>) },
  });
  if (response.status === 401) throw new DriveAuthError('Google ha rechazado el acceso');
  if (!response.ok) throw new Error(`Google Drive respondió ${response.status}`);
  return response;
}

/** Downloads the shared copy: its file id and text, or null if no device has synced yet. */
export async function downloadSyncFile(token: string): Promise<{ id: string; text: string } | null> {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: 'files(id)',
    orderBy: 'modifiedTime desc',
  });
  const { files } = (await (await request(token, `${API}?${query}`)).json()) as { files: { id: string }[] };
  if (!files.length) return null;
  const text = await (await request(token, `${API}/${files[0].id}?alt=media`)).text();
  return { id: files[0].id, text };
}

/** Replaces the shared copy (or creates it the first time). */
export async function uploadSyncFile(token: string, fileId: string | null, text: string): Promise<void> {
  if (fileId) {
    await request(token, `${UPLOAD_API}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    });
    return;
  }
  const boundary = `fidelis${Date.now()}`;
  const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  await request(token, `${UPLOAD_API}?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}
