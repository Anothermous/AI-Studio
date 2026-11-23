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
  redirectUri: string;
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

export async function fetchOneDriveStatus(): Promise<OneDriveStatus> {
  const resp = await fetch('/api/auth/microsoft/status', {
    credentials: 'include',
    headers: buildHeaders(false, false),
  });
  if (!resp.ok) {
    throw new Error('Gagal memeriksa status koneksi OneDrive.');
  }
  return (await resp.json()) as OneDriveStatus;
}

export async function getMicrosoftAuthUrl(): Promise<string> {
  const resp = await fetch('/api/auth/microsoft/url', {
    credentials: 'include',
    headers: buildHeaders(false, false),
  });
  const data = (await resp.json()) as { url?: string; error?: string };
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

export async function setOneDriveTargetFolder(
  payload:
    | { mode: 'personal'; folderName?: string }
    | { mode: 'shared'; shareUrl: string }
): Promise<OneDriveFolderConfig> {
  const resp = await fetch('/api/onedrive/folder', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(true, true),
    body: JSON.stringify(payload),
  });
  const data = (await resp.json()) as {
    targetFolder?: OneDriveFolderConfig;
    error?: string;
  };
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
  const data = (await resp.json()) as {
    records?: QCInspectionRecord[];
    targetFolder?: OneDriveFolderConfig | null;
    error?: string;
  };
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
  const data = (await resp.json()) as {
    record?: QCInspectionRecord;
    error?: string;
  };
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
  const data = (await resp.json()) as { ok?: boolean; error?: string };
  if (!resp.ok) {
    throw new Error(data.error || 'Gagal menghapus data QC dari OneDrive.');
  }
}
