import type { CloudDriveEntryDto, CloudDriveProviderId } from 'librechat-data-provider';
import type { CloudDriveBrowserSession } from './atoms';

const GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const ONEDRIVE_SCOPES = 'Files.ReadWrite';

const GOOGLE_EXPORT_MAP: Record<string, { exportMime: string; ext: string }> = {
  'application/vnd.google-apps.document': { exportMime: 'text/markdown', ext: '.md' },
  'application/vnd.google-apps.spreadsheet': { exportMime: 'text/csv', ext: '.csv' },
  'application/vnd.google-apps.presentation': { exportMime: 'text/plain', ext: '.txt' },
};

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: GoogleTokenResponse) => void;
    error_callback?: (err: { type?: string; message?: string }) => void;
  }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
  revoke: (token: string, done?: () => void) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleAccountsOAuth2;
      };
    };
  }
}

let gsiScriptPromise: Promise<void> | null = null;

function loadGoogleGsiScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Browser environment required'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gsiScriptPromise) {
    return gsiScriptPromise;
  }
  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error('Failed to load Google Identity Services script.'));
    };
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

async function connectGoogleDrive(clientId: string): Promise<CloudDriveBrowserSession> {
  await loadGoogleGsiScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services failed to initialize.');
  }

  return new Promise<CloudDriveBrowserSession>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'Google Drive sign-in failed.'));
          return;
        }
        const expiresInSec = typeof resp.expires_in === 'number' ? resp.expires_in : 3600;
        resolve({
          accessToken: resp.access_token,
          expiresAt: Date.now() + expiresInSec * 1000,
        });
      },
      error_callback: (err) => {
        reject(new Error(err.message || err.type || 'Google Drive sign-in cancelled.'));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function connectOneDrive(
  clientId: string,
  tenantId = 'common',
): Promise<CloudDriveBrowserSession> {
  const verifier = randomBase64Url(32);
  const challenge = await sha256Base64Url(verifier);
  const state = randomBase64Url(16);
  const redirectUri = `${window.location.origin}/`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: ONEDRIVE_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  const authUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${params.toString()}`;
  const popup = window.open(authUrl, 'satchida_onedrive_pkce', 'width=560,height=680');
  if (!popup) {
    throw new Error('Popup blocked. Please allow popups to sign in with OneDrive.');
  }

  const code = await new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(pollId);
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      reject(new Error('OneDrive sign-in timed out.'));
    }, 180_000);

    const pollId = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(pollId);
        window.clearTimeout(timeoutId);
        reject(new Error('OneDrive sign-in was cancelled.'));
        return;
      }
      try {
        if (popup.location.origin === window.location.origin) {
          const search = new URLSearchParams(popup.location.search);
          const returnedCode = search.get('code');
          const returnedState = search.get('state');
          const error = search.get('error');
          if (returnedCode || error) {
            window.clearInterval(pollId);
            window.clearTimeout(timeoutId);
            popup.close();
            if (error) {
              reject(new Error(search.get('error_description') || error));
            } else if (returnedState !== state) {
              reject(new Error('Invalid OAuth state returned from Microsoft.'));
            } else if (returnedCode) {
              resolve(returnedCode);
            }
          }
        }
      } catch {
        /* Cross-origin while user is on login.microsoftonline.com — expected */
      }
    }, 250);
  });

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: ONEDRIVE_SCOPES,
  });

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    },
  );

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(
      tokenJson.error_description || tokenJson.error || 'OneDrive token exchange failed.',
    );
  }

  return {
    accessToken: tokenJson.access_token,
    expiresAt: Date.now() + (tokenJson.expires_in ?? 3600) * 1000,
  };
}

export async function connectCloudDriveProvider(
  provider: CloudDriveProviderId,
  config: { clientId: string; tenantId?: string },
): Promise<CloudDriveBrowserSession> {
  if (provider === 'google_drive') {
    return connectGoogleDrive(config.clientId);
  }
  return connectOneDrive(config.clientId, config.tenantId);
}

export function disconnectCloudDriveProvider(
  provider: CloudDriveProviderId,
  session: CloudDriveBrowserSession | null,
): void {
  if (provider === 'google_drive' && session?.accessToken) {
    try {
      window.google?.accounts?.oauth2?.revoke(session.accessToken);
    } catch {
      /* best-effort revoke */
    }
  }
}

export async function listCloudDriveFolder(
  provider: CloudDriveProviderId,
  accessToken: string,
  folderId = 'root',
): Promise<CloudDriveEntryDto[]> {
  if (provider === 'google_drive') {
    const parent = folderId === 'root' ? 'root' : folderId;
    const q = `'${parent.replace(/'/g, "\\'")}' in parents and trashed = false`;
    const params = new URLSearchParams({
      q,
      pageSize: '100',
      orderBy: 'folder,name',
      fields: 'files(id,name,mimeType,size,modifiedTime)',
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Google Drive list failed (${res.status})`);
    }
    const data = (await res.json()) as {
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        modifiedTime?: string;
      }>;
    };
    return (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      mimeType: f.mimeType,
      size: f.size != null ? Number(f.size) : null,
      modifiedTime: f.modifiedTime ?? null,
    }));
  }

  const endpoint =
    folderId === 'root'
      ? 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100'
      : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folderId)}/children?$top=100`;
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`OneDrive list failed (${res.status})`);
  }
  const data = (await res.json()) as {
    value?: Array<{
      id: string;
      name: string;
      folder?: Record<string, unknown>;
      file?: { mimeType?: string };
      size?: number;
      lastModifiedDateTime?: string;
    }>;
  };
  return (data.value ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.folder ? 'folder' : 'file',
    mimeType: item.file?.mimeType ?? (item.folder ? 'folder' : 'application/octet-stream'),
    size: typeof item.size === 'number' ? item.size : null,
    modifiedTime: item.lastModifiedDateTime ?? null,
  }));
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(bin);
}

export async function downloadCloudDriveEntry(
  provider: CloudDriveProviderId,
  accessToken: string,
  entry: CloudDriveEntryDto,
): Promise<{ filename: string; contentBase64: string }> {
  if (provider === 'google_drive') {
    const exportSpec = GOOGLE_EXPORT_MAP[entry.mimeType];
    const url = exportSpec
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.id)}/export?mimeType=${encodeURIComponent(exportSpec.exportMime)}`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.id)}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Google Drive download failed (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    const filename =
      exportSpec && !entry.name.endsWith(exportSpec.ext)
        ? `${entry.name}${exportSpec.ext}`
        : entry.name;
    return { filename, contentBase64: arrayBufferToBase64(buf) };
  }

  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(entry.id)}/content`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`OneDrive download failed (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return { filename: entry.name, contentBase64: arrayBufferToBase64(buf) };
}

export async function uploadToCloudDriveFolder(
  provider: CloudDriveProviderId,
  accessToken: string,
  params: { folderId: string; filename: string; content: string },
): Promise<{ name: string }> {
  if (provider === 'google_drive') {
    const metadata: Record<string, unknown> = { name: params.filename };
    if (params.folderId && params.folderId !== 'root') {
      metadata.parents = [params.folderId];
    }
    const boundary = `satchida_${Date.now()}`;
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
      `${params.content}\r\n` +
      `--${boundary}--`;
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) {
      throw new Error(`Google Drive upload failed (${res.status})`);
    }
    return { name: params.filename };
  }

  const encodedName = encodeURIComponent(params.filename);
  const url =
    params.folderId && params.folderId !== 'root'
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.folderId)}:/${encodedName}:/content`
      : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedName}:/content`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain; charset=UTF-8',
    },
    body: params.content,
  });
  if (!res.ok) {
    throw new Error(`OneDrive upload failed (${res.status})`);
  }
  return { name: params.filename };
}

export async function uploadBlobToCloudDriveFolder(
  provider: CloudDriveProviderId,
  accessToken: string,
  params: { folderId: string; filename: string; blob: Blob },
): Promise<{ name: string }> {
  const mimeType = params.blob.type || 'application/octet-stream';
  if (provider === 'google_drive') {
    const metadata: Record<string, unknown> = { name: params.filename };
    if (params.folderId && params.folderId !== 'root') {
      metadata.parents = [params.folderId];
    }
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', params.blob, params.filename);
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      },
    );
    if (!res.ok) {
      throw new Error(`Google Drive upload failed (${res.status})`);
    }
    return { name: params.filename };
  }

  const encodedName = encodeURIComponent(params.filename);
  const url =
    params.folderId && params.folderId !== 'root'
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.folderId)}:/${encodedName}:/content`
      : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedName}:/content`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
    },
    body: params.blob,
  });
  if (!res.ok) {
    throw new Error(`OneDrive upload failed (${res.status})`);
  }
  return { name: params.filename };
}

export async function createCloudDriveFolder(
  provider: CloudDriveProviderId,
  accessToken: string,
  params: { parentFolderId: string; name: string },
): Promise<{ id: string; name: string }> {
  const folderName = params.name.trim();
  if (!folderName) {
    throw new Error('Folder name is required.');
  }
  if (provider === 'google_drive') {
    const metadata: Record<string, unknown> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (params.parentFolderId && params.parentFolderId !== 'root') {
      metadata.parents = [params.parentFolderId];
    }
    const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    if (!res.ok) {
      throw new Error(`Google Drive folder creation failed (${res.status})`);
    }
    const data = (await res.json()) as { id: string; name: string };
    return { id: data.id, name: data.name };
  }

  const url =
    params.parentFolderId && params.parentFolderId !== 'root'
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.parentFolderId)}/children`
      : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }),
  });
  if (!res.ok) {
    throw new Error(`OneDrive folder creation failed (${res.status})`);
  }
  const data = (await res.json()) as { id: string; name: string };
  return { id: data.id, name: data.name };
}
