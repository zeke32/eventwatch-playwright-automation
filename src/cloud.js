import {readFile} from 'node:fs/promises';
import path from 'node:path';

/** Dropbox API v2 upload with mode=overwrite. Only enabled when credentials are supplied. */
export async function uploadDropbox(filePath, {token, folder, fetchImpl = fetch} = {}) {
  if (!token) throw new Error('Dropbox access token missing (use environment secrets, never commit credentials)');
  if (!folder?.startsWith('/') || folder.includes('..')) throw new Error('Dropbox folder must be an absolute folder path');
  const remotePath = path.posix.join(folder, path.basename(filePath));
  const body = await readFile(filePath);
  const res = await fetchImpl('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST', headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({path: remotePath, mode: 'overwrite', autorename: false, mute: true, strict_conflict: false}),
      'Content-Type': 'application/octet-stream'
    }, body
  });
  if (!res.ok) throw new Error(`Dropbox upload failed: HTTP ${res.status}`);
  const info = await res.json();
  return {path: info.path_display || remotePath, id: info.id || null};
}
