import type { QCInspectionRecord } from '../types/qc';

export interface OneDriveFolderConfig {
  mode: 'personal' | 'shared';
  driveId?: string;
  itemId?: string;
  name: string;
  webUrl?: string;
  shareUrl?: string;
}

export interface OneDriveStatus {
  configured: boolean;
  connected: boolean;
  user: {
    displayName: string;
    email: string;
  } | null;
  targetFolder: OneDriveFolderConfig | null;
  sharedFolderHint?: string;
  sharedFolderError?: string | null;
  redirectUri: string;
}

export interface SharedFolderItem {
  driveId: string;
  itemId: string;
  name: string;
  webUrl?: string;
  ownerName?: string;
}

const SHARED_FOLDER_PREF_KEY = 'wie_qc_shared_folder_url_v1';

// Disimpan strictly di memori JS (bukan localStorage/sessionStorage)
let memorySessionToken: string | null = null;

export function setMemorySessionToken(token: string | null): void {
  memorySessionToken = token;
}

export function getMemorySessionToken(): string | null {
  return memorySessionToken;
}

export function getSavedSharedFolderUrl(): string {
  try {
    return localStorage.getItem(SHARED_FOLDER_PREF_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSharedFolderUrlPref(url: string): void {
  try {
    if (url.trim()) {
      localStorage.setItem(SHARED_FOLDER_PREF_KEY, url.trim());
    } else {
      localStorage.removeItem(SHARED_FOLDER_PREF_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function buildHeaders(isMutation = false, hasJsonBody = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (isMutation) {
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (memorySessionToken) {
    headers['X-QC-Session'] = memorySessionToken;
  }
  return headers;
}

async function parseJsonSafely<T>(
  resp: Response,
  fallbackError: string
): Promise<T> {
  const text = await resp.text();
  if (!text) {
    if (!resp.ok) {
      throw new Error(`${fallbackError} (HTTP ${resp.status})`);
    }
    return {} as T;
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('<')) {
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(trimmed);
    const htmlTitle = titleMatch ? titleMatch[1].trim() : '';
    const detail = htmlTitle ? ` (${htmlTitle})` : '';
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(
        `Proxy browser/pratinjau menolak permintaan (HTTP ${resp.status}${detail}). Jika membuka dari pratinjau AI Studio, buka aplikasi di Tab Baru (ikon panah keluar), lalu refresh (F5) dan hubungkan ulang OneDrive.`
      );
    }
    if (resp.status >= 500) {
      throw new Error(
        `Server sedang memuat ulang atau sibuk (HTTP ${resp.status}${detail}). Tunggu beberapa detik lalu coba lagi.`
      );
    }
    throw new Error(
      `Respon server bukan JSON (HTTP ${resp.status}${detail}). Silakan refresh halaman (F5) lalu coba lagi.`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackError);
  }
}

export async function fetchOneDriveStatus(): Promise<OneDriveStatus> {
  const resp = await fetch('/api/auth/microsoft/status', {
    credentials: 'include',
    headers: buildHeaders(false, false),
  });
  const data = await parseJsonSafely<OneDriveStatus & { error?: string }>(
    resp,
    'Gagal memeriksa status koneksi OneDrive.'
  );
  if (!resp.ok) {
    throw new Error(data.error || 'Gagal memeriksa status koneksi OneDrive.');
  }
  return data;
}

export async function getMicrosoftAuthUrl(): Promise<string> {
  const resp = await fetch('/api/auth/microsoft/url', {
    credentials: 'include',
    headers: buildHeaders(false, false),
  });
  const data = await parseJsonSafely<{ url?: string; error?: string }>(
    resp,
    'Gagal membuat URL login Microsoft.'
  );
  if (!resp.ok || !data.url) {
    throw new Error(data.error || 'Gagal membuat URL login Microsoft.');
  }
  return data.url;
}

export async function disconnectOneDrive(): Promise<void> {
  await fetch('/api/auth/microsoft/logout', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(true, false),
  });
  memorySessionToken = null;
}

export async function fetchSharedOneDriveFolders(): Promise<SharedFolderItem[]> {
  const resp = await fetch('/api/onedrive/shared-folders', {
    credentials: 'include',
    headers: buildHeaders(false, false),
  });
  const data = await parseJsonSafely<{
    folders?: SharedFolderItem[];
    error?: string;
  }>(resp, 'Gagal mengambil daftar folder bersama OneDrive.');
  if (!resp.ok) {
    throw new Error(data.error || 'Gagal mengambil daftar folder bersama OneDrive.');
  }
  return data.folders || [];
}

function encodeUtf8Base64(val: string): string {
  const bytes = new TextEncoder().encode(val);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function setOneDriveTargetFolder(
  payload:
    | { mode: 'personal'; folderName?: string }
    | {
        mode: 'shared';
        shareUrl?: string;
        driveId?: string;
        itemId?: string;
        name?: string;
        webUrl?: string;
      }
): Promise<OneDriveFolderConfig> {
  const safePayload =
    payload.mode === 'shared' && payload.shareUrl
      ? {
          mode: 'shared' as const,
          shareUrlB64: encodeUtf8Base64(payload.shareUrl),
          driveId: payload.driveId,
          itemId: payload.itemId,
          name: payload.name,
          webUrl: payload.webUrl,
        }
      : payload;

  const resp = await fetch('/api/onedrive/folder', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(true, true),
    body: JSON.stringify(safePayload),
  });
  const data = await parseJsonSafely<{
    targetFolder?: OneDriveFolderConfig;
    error?: string;
  }>(resp, 'Gagal mengatur folder tujuan OneDrive.');
  if (!resp.ok || !data.targetFolder) {
    throw new Error(data.error || 'Gagal mengatur folder tujuan OneDrive.');
  }
  return data.targetFolder;
}

export async function fetchOneDriveRecords(): Promise<{
  records: QCInspectionRecord[];
  targetFolder: OneDriveFolderConfig | null;
}> {
  const resp = await fetch('/api/onedrive/records', {
    credentials: 'include',
    headers: buildHeaders(false, false),
  });
  const data = await parseJsonSafely<{
    records?: QCInspectionRecord[];
    targetFolder?: OneDriveFolderConfig | null;
    error?: string;
  }>(resp, 'Gagal mengambil data QC dari OneDrive.');
  if (!resp.ok) {
    throw new Error(data.error || 'Gagal mengambil data QC dari OneDrive.');
  }
  return {
    records: data.records || [],
    targetFolder: data.targetFolder ?? null,
  };
}

export async function saveRecordToOneDrive(
  record: QCInspectionRecord
): Promise<QCInspectionRecord> {
  const resp = await fetch('/api/onedrive/records', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(true, true),
    body: JSON.stringify(record),
  });
  const data = await parseJsonSafely<{
    record?: QCInspectionRecord;
    error?: string;
  }>(resp, 'Gagal menyimpan data QC ke OneDrive.');
  if (!resp.ok || !data.record) {
    throw new Error(data.error || 'Gagal menyimpan data QC ke OneDrive.');
  }
  return data.record;
}

export async function deleteRecordFromOneDrive(id: string): Promise<void> {
  const resp = await fetch(`/api/onedrive/records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(true, false),
  });
  const data = await parseJsonSafely<{ ok?: boolean; error?: string }>(
    resp,
    'Gagal menghapus data QC dari OneDrive.'
  );
  if (!resp.ok) {
    throw new Error(data.error || 'Gagal menghapus data QC dari OneDrive.');
  }
}
