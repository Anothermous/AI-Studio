import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

dotenv.config();

const PORT = 3000;
const SESSION_COOKIE_NAME = 'wie_qc_sid';
const DEFAULT_ROOT_FOLDER_NAME = 'Finish-Good-QC';

const CATEGORY_FOLDER_NAMES: Record<string, string> = {
  tangki_swh: 'Tangki-SWH',
  kolektor_swh: 'Kolektor-SWH',
  at_series: 'Aircon-WH',
  electric_wh: 'Electric-WH',
  heat_pump: 'Heat-Pump',
};

interface TargetFolderConfig {
  mode: 'personal' | 'shared';
  driveId?: string;
  itemId?: string;
  name: string;
  webUrl?: string;
  shareUrl?: string;
}

interface SessionData {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    displayName: string;
    email: string;
  };
  targetFolder: TargetFolderConfig;
  sharedFolderError?: string;
  createdAt: number;
}

interface OAuthStateEntry {
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();
const oauthStates = new Map<string, OAuthStateEntry>();
let workspaceSharedFolderUrl = process.env.ONEDRIVE_SHARED_FOLDER_URL?.trim() || '';

function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, entry] of oauthStates.entries()) {
    if (entry.expiresAt < now) {
      oauthStates.delete(key);
    }
  }
}

function getAppUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const forwardedHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
  return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
}

function getRedirectUri(req: Request): string {
  return `${getAppUrl(req)}/auth/callback`;
}

function getTenantId(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || 'common';
}

function isOAuthConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_SECRET?.trim()
  );
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function getSessionFromRequest(req: Request): SessionData | null {
  const cookies = parseCookies(req);
  const headerSid = req.headers['x-qc-session'];
  const sid =
    (typeof headerSid === 'string' && headerSid.trim()) ||
    cookies[SESSION_COOKIE_NAME] ||
    '';
  if (!sid) return null;
  return sessions.get(sid) ?? null;
}

function setSessionCookie(res: Response, sessionId: string): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=604800`
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}

function requireCsrfHeader(req: Request, res: Response, next: NextFunction): void {
  const xrw = req.headers['x-requested-with'];
  if (xrw !== 'XMLHttpRequest') {
    res.status(403).json({ error: 'Header X-Requested-With diperlukan.' });
    return;
  }
  next();
}

async function getValidAccessToken(session: SessionData): Promise<string> {
  if (Date.now() < session.expiresAt - 60_000) {
    return session.accessToken;
  }

  if (!session.refreshToken) {
    throw new Error('Sesi OneDrive kedaluwarsa. Silakan login ulang.');
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() || '';
  const tenant = getTenantId();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    scope: 'offline_access User.Read Files.ReadWrite',
  });

  const tokenResp = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }
  );

  const tokenText = await tokenResp.text();
  let tokenData: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  } = {};
  try {
    tokenData = JSON.parse(tokenText) as typeof tokenData;
  } catch {
    throw new Error(
      `Respon token Microsoft tidak valid (HTTP ${tokenResp.status}). Silakan login ulang OneDrive.`
    );
  }

  if (!tokenResp.ok || !tokenData.access_token) {
    sessions.delete(session.id);
    throw new Error(
      tokenData.error_description || 'Gagal memperbarui token OneDrive. Silakan login ulang.'
    );
  }

  session.accessToken = tokenData.access_token;
  if (tokenData.refresh_token) {
    session.refreshToken = tokenData.refresh_token;
  }
  session.expiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000;
  return session.accessToken;
}

function normalizeBarcodeCore(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return '';
  if (!/\d/.test(cleaned)) return cleaned;
  return cleaned
    .replace(/^[A-D](?=\d)/, '')
    .replace(/(\d)[A-D]$/, '$1');
}

function isBarcodePairValid(b1: string, b2: string): boolean {
  const u = b1.trim().toUpperCase();
  const c = b2.trim().toUpperCase();
  if (!u || !c) return false;
  if (u === c) return true;
  const uCore = normalizeBarcodeCore(u);
  const cCore = normalizeBarcodeCore(c);
  return uCore.length > 0 && uCore === cCore;
}

function encodeOneDriveShareUrl(shareUrl: string): string {
  const b64 = Buffer.from(shareUrl, 'utf8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  return `u!${b64}`;
}

function isValidOneDriveShareUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === '1drv.ms' ||
      host === 'onedrive.live.com' ||
      host.endsWith('.onedrive.live.com') ||
      host.endsWith('.sharepoint.com') ||
      host.endsWith('.sharepoint.us')
    );
  } catch {
    return false;
  }
}

function isSafeGraphId(val: string): boolean {
  return /^[a-zA-Z0-9_!.-]+$/.test(val) && !val.includes('..');
}

function sanitizeSegment(val: string): string {
  return val
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'unit';
}

interface DriveItemRef {
  id: string;
  driveId: string;
  name: string;
  webUrl?: string;
}

async function graphJson<T>(
  accessToken: string,
  url: string,
  init?: RequestInit
): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  const text = await resp.text();
  if (!resp.ok) {
    let msg = `Microsoft Graph error (${resp.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {
      if (text) msg = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    }
    throw new Error(msg);
  }

  if (resp.status === 204 || !text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Respon Microsoft Graph bukan JSON yang valid (HTTP ${resp.status}).`
    );
  }
}

async function ensureRootFolder(
  accessToken: string,
  session: SessionData
): Promise<DriveItemRef> {
  const target = session.targetFolder;
  if (target.mode === 'shared' && target.driveId && target.itemId) {
    return {
      driveId: target.driveId,
      id: target.itemId,
      name: target.name,
      webUrl: target.webUrl,
    };
  }

  if (target.driveId && target.itemId) {
    return {
      driveId: target.driveId,
      id: target.itemId,
      name: target.name,
      webUrl: target.webUrl,
    };
  }

  const folderName = sanitizeSegment(target.name || DEFAULT_ROOT_FOLDER_NAME);
  try {
    const existing = await graphJson<{
      id: string;
      name: string;
      webUrl?: string;
      parentReference?: { driveId?: string };
    }>(
      accessToken,
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folderName)}`
    );
    const driveId = existing.parentReference?.driveId || (await getMyDriveId(accessToken));
    target.driveId = driveId;
    target.itemId = existing.id;
    target.webUrl = existing.webUrl;
    return { driveId, id: existing.id, name: existing.name, webUrl: existing.webUrl };
  } catch {
    const created = await graphJson<{
      id: string;
      name: string;
      webUrl?: string;
      parentReference?: { driveId?: string };
    }>(accessToken, 'https://graph.microsoft.com/v1.0/me/drive/root/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'replace',
      }),
    });
    const driveId = created.parentReference?.driveId || (await getMyDriveId(accessToken));
    target.driveId = driveId;
    target.itemId = created.id;
    target.webUrl = created.webUrl;
    return { driveId, id: created.id, name: created.name, webUrl: created.webUrl };
  }
}

async function getMyDriveId(accessToken: string): Promise<string> {
  const drive = await graphJson<{ id: string }>(
    accessToken,
    'https://graph.microsoft.com/v1.0/me/drive'
  );
  return drive.id;
}

async function ensureChildFolder(
  accessToken: string,
  driveId: string,
  parentItemId: string,
  folderName: string
): Promise<DriveItemRef> {
  const cleanName = sanitizeSegment(folderName);
  const pathUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}:/${encodeURIComponent(cleanName)}`;
  try {
    const existing = await graphJson<{
      id: string;
      name: string;
      webUrl?: string;
    }>(accessToken, pathUrl);
    return { driveId, id: existing.id, name: existing.name, webUrl: existing.webUrl };
  } catch {
    try {
      const created = await graphJson<{
        id: string;
        name: string;
        webUrl?: string;
      }>(
        accessToken,
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        }
      );
      return { driveId, id: created.id, name: created.name, webUrl: created.webUrl };
    } catch (createErr) {
      // Jika terjadi race condition antar 2 QC yang membuat folder bersamaan, baca ulang folder yang sudah ada
      try {
        const retryExisting = await graphJson<{
          id: string;
          name: string;
          webUrl?: string;
        }>(accessToken, pathUrl);
        return {
          driveId,
          id: retryExisting.id,
          name: retryExisting.name,
          webUrl: retryExisting.webUrl,
        };
      } catch {
        throw createErr;
      }
    }
  }
}

async function ensureDbRecordsFolder(
  accessToken: string,
  session: SessionData
): Promise<{ root: DriveItemRef; dbRecords: DriveItemRef }> {
  const root = await ensureRootFolder(accessToken, session);
  const dbFolder = await ensureChildFolder(accessToken, root.driveId, root.id, '_db');
  const dbRecords = await ensureChildFolder(
    accessToken,
    root.driveId,
    dbFolder.id,
    'records'
  );
  return { root, dbRecords };
}

async function bindSharedFolderToSession(
  accessToken: string,
  session: SessionData,
  opts: {
    shareUrl?: string;
    driveId?: string;
    itemId?: string;
    name?: string;
    webUrl?: string;
  }
): Promise<void> {
  let resolvedDriveId = '';
  let resolvedItemId = '';
  let resolvedName = opts.name?.trim() || 'Folder Bersama QC';
  let resolvedWebUrl = opts.webUrl;
  const cleanShareUrl = (opts.shareUrl || '').trim();

  if (
    opts.driveId &&
    opts.itemId &&
    isSafeGraphId(opts.driveId) &&
    isSafeGraphId(opts.itemId)
  ) {
    const item = await graphJson<{
      id: string;
      name: string;
      webUrl?: string;
      folder?: Record<string, unknown>;
    }>(
      accessToken,
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(opts.driveId)}/items/${encodeURIComponent(opts.itemId)}`
    );
    if (!item.folder) {
      throw new Error('Item yang dipilih bukan sebuah folder OneDrive.');
    }
    resolvedDriveId = opts.driveId;
    resolvedItemId = item.id;
    resolvedName = item.name || resolvedName;
    resolvedWebUrl = item.webUrl || resolvedWebUrl;
  } else {
    if (!cleanShareUrl || !isValidOneDriveShareUrl(cleanShareUrl)) {
      throw new Error(
        'Masukkan link Shared Folder dari tombol Bagikan (Share) -> Salin Tautan (https://...-my.sharepoint.com/... atau https://1drv.ms/...).'
      );
    }

    if (cleanShareUrl.includes('/_layouts/15/onedrive.aspx')) {
      throw new Error(
        'Link tersebut adalah URL address bar browser. Gunakan link dari tombol Bagikan (Share) -> Salin Tautan (Copy Link) dengan izin Dapat Mengedit, atau pilih folder langsung dari daftar "Folder Dibagikan ke Anda".'
      );
    }

    const encodedShare = encodeOneDriveShareUrl(cleanShareUrl);
    const item = await graphJson<{
      id: string;
      name: string;
      webUrl?: string;
      folder?: Record<string, unknown>;
      parentReference?: { driveId?: string };
      remoteItem?: {
        id?: string;
        name?: string;
        webUrl?: string;
        folder?: Record<string, unknown>;
        parentReference?: { driveId?: string };
      };
    }>(accessToken, `https://graph.microsoft.com/v1.0/shares/${encodedShare}/driveItem`);

    const targetItem = item.remoteItem || item;
    const targetDriveId =
      targetItem.parentReference?.driveId || item.parentReference?.driveId;
    const targetItemId = targetItem.id || item.id;
    const targetFolderObj = targetItem.folder || item.folder;

    if (!targetFolderObj || !targetDriveId || !targetItemId) {
      throw new Error('Link yang dimasukkan bukan sebuah folder OneDrive dengan akses edit.');
    }

    resolvedDriveId = targetDriveId;
    resolvedItemId = targetItemId;
    resolvedName = targetItem.name || item.name || resolvedName;
    resolvedWebUrl = targetItem.webUrl || item.webUrl;
  }

  const prevTarget = session.targetFolder;
  session.targetFolder = {
    mode: 'shared',
    driveId: resolvedDriveId,
    itemId: resolvedItemId,
    name: resolvedName,
    webUrl: resolvedWebUrl,
    shareUrl: cleanShareUrl || undefined,
  };

  try {
    await ensureDbRecordsFolder(accessToken, session);
  } catch (permErr) {
    session.targetFolder = prevTarget;
    const rawMsg = permErr instanceof Error ? permErr.message : '';
    throw new Error(
      `Akun ${session.user.email} belum memiliki izin tulis (Can Edit) ke folder "${resolvedName}". Minta pemilik folder membagikan ulang dengan izin "Dapat Mengedit / Can Edit" (atau tambahkan akun teman langsung saat Share). Detail: ${rawMsg}`
    );
  }

  if (cleanShareUrl) {
    workspaceSharedFolderUrl = cleanShareUrl;
  }
}

interface StoredPhotoRef {
  id: string;
  name: string;
  label: string;
  driveId: string;
  itemId: string;
  sizeBytes: number;
}

interface StoredOneDriveRecord {
  id: string;
  docNumber: string;
  productCategory?: string;
  qcOption: 'Arif Kurniawan' | 'Nur Rohmat Kurniawan' | 'Lainnya';
  qcName: string;
  barcodeUnit: string;
  barcodeCarton: string;
  barcodeVerified: boolean;
  unitType: string;
  unitStatus: string;
  tagDate: string;
  tagTime: string;
  checklist: Record<string, boolean>;
  photos: StoredPhotoRef[];
  notes: string;
  createdAt: string;
  folderDriveId?: string;
  folderItemId?: string;
  folderWebUrl?: string;
}

function hydrateRecordForClient(stored: StoredOneDriveRecord) {
  return {
    ...stored,
    photos: (stored.photos || []).map((p) => ({
      id: p.id,
      name: p.name,
      label: p.label,
      sizeBytes: p.sizeBytes,
      dataUrl: `/api/onedrive/photo/${encodeURIComponent(p.driveId)}/${encodeURIComponent(p.itemId)}`,
    })),
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '30mb' }));

  // 1. OAuth Status
  app.get('/api/auth/microsoft/status', (req, res) => {
    const session = getSessionFromRequest(req);
    const redirectUri = getRedirectUri(req);
    res.json({
      configured: isOAuthConfigured(),
      connected: Boolean(session),
      user: session ? session.user : null,
      targetFolder: session ? session.targetFolder : null,
      sharedFolderHint: workspaceSharedFolderUrl,
      sharedFolderError: session?.sharedFolderError || null,
      redirectUri,
    });
  });

  // 2. Get Microsoft OAuth Authorization URL
  app.get('/api/auth/microsoft/url', (req, res) => {
    if (!isOAuthConfigured()) {
      res.status(400).json({
        error:
          'MICROSOFT_CLIENT_ID dan MICROSOFT_CLIENT_SECRET belum dikonfigurasi di AI Studio Secrets.',
        redirectUri: getRedirectUri(req),
      });
      return;
    }

    cleanupExpiredStates();
    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });

    const tenant = getTenantId();
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!.trim(),
      response_type: 'code',
      redirect_uri: getRedirectUri(req),
      response_mode: 'query',
      scope: 'offline_access User.Read Files.ReadWrite',
      state,
      prompt: 'select_account',
    });

    const authUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params.toString()}`;
    res.json({ url: authUrl });
  });

  // 3. OAuth Callback (handle both with and without trailing slash)
  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const errParam = typeof req.query.error_description === 'string'
      ? req.query.error_description
      : typeof req.query.error === 'string'
        ? req.query.error
        : '';

    const sendPopupError = (message: string) => {
      const safeMsg = JSON.stringify(message);
      res.status(400).send(`<!doctype html>
<html><body style="font-family:sans-serif;padding:24px;">
<p style="color:#b91c1c;font-weight:600;">Gagal menghubungkan OneDrive</p>
<p>${escapeHtml(message)}</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'ONEDRIVE_AUTH_ERROR', message: ${safeMsg} }, '*');
  }
</script>
</body></html>`);
    };

    if (errParam) {
      sendPopupError(errParam);
      return;
    }

    if (!state || !oauthStates.has(state)) {
      sendPopupError('State OAuth tidak valid atau sudah kedaluwarsa. Silakan coba lagi.');
      return;
    }

    const stateEntry = oauthStates.get(state)!;
    oauthStates.delete(state);
    if (stateEntry.expiresAt < Date.now()) {
      sendPopupError('Sesi otorisasi telah kedaluwarsa. Silakan ulangi login.');
      return;
    }

    if (!code) {
      sendPopupError('Kode otorisasi Microsoft tidak ditemukan.');
      return;
    }

    try {
      const tenant = getTenantId();
      const body = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!.trim(),
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!.trim(),
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(req),
        scope: 'offline_access User.Read Files.ReadWrite',
      });

      const tokenResp = await fetch(
        `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        }
      );

      const tokenData = (await tokenResp.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error_description?: string;
      };

      if (!tokenResp.ok || !tokenData.access_token) {
        sendPopupError(tokenData.error_description || 'Gagal menukar kode OAuth Microsoft.');
        return;
      }

      const profile = await graphJson<{
        displayName?: string;
        mail?: string;
        userPrincipalName?: string;
      }>(tokenData.access_token, 'https://graph.microsoft.com/v1.0/me');

      const sessionId = crypto.randomBytes(32).toString('hex');
      const session: SessionData = {
        id: sessionId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
        user: {
          displayName: profile.displayName || 'QC Inspector',
          email: profile.mail || profile.userPrincipalName || '',
        },
        targetFolder: {
          mode: 'personal',
          name: DEFAULT_ROOT_FOLDER_NAME,
        },
        createdAt: Date.now(),
      };

      // Jika ONEDRIVE_SHARED_FOLDER_URL sudah disetel di workspace, langsung hubungkan otomatis ke folder bersama
      if (workspaceSharedFolderUrl && isValidOneDriveShareUrl(workspaceSharedFolderUrl)) {
        try {
          await bindSharedFolderToSession(tokenData.access_token, session, {
            shareUrl: workspaceSharedFolderUrl,
          });
        } catch (autoShareErr) {
          session.sharedFolderError =
            autoShareErr instanceof Error
              ? autoShareErr.message
              : 'Gagal menghubungkan otomatis ke folder bersama OneDrive.';
        }
      }

      sessions.set(sessionId, session);

      setSessionCookie(res, sessionId);
      const payload = JSON.stringify({
        type: 'ONEDRIVE_AUTH_SUCCESS',
        sessionToken: sessionId,
      });

      res.send(`<!doctype html>
<html>
<body style="font-family:sans-serif;padding:24px;color:#0f172a;">
  <p style="font-weight:600;">Microsoft OneDrive berhasil terhubung.</p>
  <p style="font-size:13px;color:#475569;">Jendela ini akan tertutup otomatis...</p>
  <script>
    if (window.opener) {
      window.opener.postMessage(${payload}, '*');
      window.close();
    } else {
      window.location.href = '/';
    }
  </script>
</body>
</html>`);
    } catch (err) {
      sendPopupError(err instanceof Error ? err.message : 'Kesalahan server saat OAuth.');
    }
  });

  // 4. Logout OneDrive
  app.post('/api/auth/microsoft/logout', requireCsrfHeader, (req, res) => {
    const session = getSessionFromRequest(req);
    if (session) {
      sessions.delete(session.id);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // 5a. List Folders Shared With Current User (OneDrive "Shared with me" + Shortcuts)
  app.get('/api/onedrive/shared-folders', async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Belum terhubung ke OneDrive.' });
      return;
    }

    try {
      const accessToken = await getValidAccessToken(session);
      const folderMap = new Map<
        string,
        {
          driveId: string;
          itemId: string;
          name: string;
          webUrl?: string;
          ownerName?: string;
        }
      >();

      const collectItem = (item: {
        id?: string;
        name?: string;
        webUrl?: string;
        folder?: Record<string, unknown>;
        parentReference?: { driveId?: string };
        remoteItem?: {
          id?: string;
          name?: string;
          webUrl?: string;
          folder?: Record<string, unknown>;
          parentReference?: { driveId?: string };
          shared?: { owner?: { user?: { displayName?: string } } };
        };
        createdBy?: { user?: { displayName?: string } };
      }) => {
        const remote = item.remoteItem;
        const isFolder = Boolean(remote?.folder || item.folder);
        const driveId = remote?.parentReference?.driveId || item.parentReference?.driveId;
        const itemId = remote?.id || item.id;
        if (!isFolder || !driveId || !itemId) return;

        const key = `${driveId}:${itemId}`;
        if (!folderMap.has(key)) {
          folderMap.set(key, {
            driveId,
            itemId,
            name: remote?.name || item.name || 'Folder Bersama',
            webUrl: remote?.webUrl || item.webUrl,
            ownerName:
              remote?.shared?.owner?.user?.displayName ||
              item.createdBy?.user?.displayName ||
              undefined,
          });
        }
      };

      try {
        const sharedResp = await graphJson<{ value?: Array<Record<string, unknown>> }>(
          accessToken,
          'https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$top=100'
        );
        for (const item of sharedResp.value || []) {
          collectItem(item as Parameters<typeof collectItem>[0]);
        }
      } catch {
        // Lanjutkan cek shortcut di root drive
      }

      try {
        const rootResp = await graphJson<{ value?: Array<Record<string, unknown>> }>(
          accessToken,
          'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100'
        );
        for (const item of rootResp.value || []) {
          if ((item as { remoteItem?: unknown }).remoteItem) {
            collectItem(item as Parameters<typeof collectItem>[0]);
          }
        }
      } catch {
        // Abaikan jika gagal membaca root shortcuts
      }

      res.json({ folders: Array.from(folderMap.values()) });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Gagal memuat daftar folder bersama dari OneDrive.',
      });
    }
  });

  // 5b. Set Target Folder (Personal vs Shared Folder Link / Shared With Me for All QC)
  app.post('/api/onedrive/folder', requireCsrfHeader, async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Belum terhubung ke OneDrive.' });
      return;
    }

    const { mode, shareUrl, shareUrlB64, folderName, driveId, itemId, name, webUrl } = req.body as {
      mode?: 'personal' | 'shared';
      shareUrl?: string;
      shareUrlB64?: string;
      folderName?: string;
      driveId?: string;
      itemId?: string;
      name?: string;
      webUrl?: string;
    };

    let decodedShareUrl = (shareUrl || '').trim();
    if (!decodedShareUrl && typeof shareUrlB64 === 'string' && shareUrlB64.trim()) {
      try {
        decodedShareUrl = Buffer.from(shareUrlB64.trim(), 'base64').toString('utf8').trim();
      } catch {
        decodedShareUrl = '';
      }
    }

    try {
      const accessToken = await getValidAccessToken(session);

      if (mode === 'shared') {
        await bindSharedFolderToSession(accessToken, session, {
          shareUrl: decodedShareUrl || undefined,
          driveId,
          itemId,
          name,
          webUrl,
        });
        session.sharedFolderError = undefined;
        res.json({ targetFolder: session.targetFolder });
        return;
      }

      session.targetFolder = {
        mode: 'personal',
        name: sanitizeSegment(folderName || DEFAULT_ROOT_FOLDER_NAME),
      };
      session.sharedFolderError = undefined;
      await ensureRootFolder(accessToken, session);
      res.json({ targetFolder: session.targetFolder });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengatur folder OneDrive.';
      if (/access\s*denied|forbidden|permission|unauthorized/i.test(msg)) {
        res.status(403).json({
          error: `Akses ditolak untuk akun ${session.user.email}. Pastikan folder di-share dengan izin "Dapat Mengedit (Can Edit)" ke akun tersebut (bukan hanya "Dapat Melihat"). (${msg})`,
        });
        return;
      }
      res.status(400).json({ error: msg });
    }
  });

  // 6. List QC Records from OneDrive
  app.get('/api/onedrive/records', async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Belum terhubung ke OneDrive.' });
      return;
    }

    try {
      const accessToken = await getValidAccessToken(session);
      const { root, dbRecords } = await ensureDbRecordsFolder(accessToken, session);

      const listResp = await graphJson<{
        value: Array<{
          id: string;
          name: string;
          file?: Record<string, unknown>;
        }>;
      }>(
        accessToken,
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(dbRecords.id)}/children?$top=200`
      );

      const jsonItems = (listResp.value || []).filter(
        (item) => item.file && item.name.endsWith('.json')
      );

      const loaded: StoredOneDriveRecord[] = [];
      const batchSize = 8;
      for (let i = 0; i < jsonItems.length; i += batchSize) {
        const batch = jsonItems.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (fileItem) => {
            try {
              const contentResp = await fetch(
                `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(fileItem.id)}/content`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                }
              );
              if (!contentResp.ok) return null;
              return (await contentResp.json()) as StoredOneDriveRecord;
            } catch {
              return null;
            }
          })
        );
        for (const r of results) {
          if (r && r.id) loaded.push(r);
        }
      }

      loaded.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      res.json({
        records: loaded.map(hydrateRecordForClient),
        targetFolder: session.targetFolder,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat data dari OneDrive.',
      });
    }
  });

  // 7. Save QC Record + Photos to OneDrive
  app.post('/api/onedrive/records', requireCsrfHeader, async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Belum terhubung ke OneDrive.' });
      return;
    }

    const body = req.body as {
      id?: string;
      docNumber?: string;
      productCategory?: string;
      qcOption?: 'Arif Kurniawan' | 'Nur Rohmat Kurniawan' | 'Lainnya';
      qcName?: string;
      barcodeUnit?: string;
      barcodeCarton?: string;
      unitType?: string;
      unitStatus?: string;
      tagDate?: string;
      tagTime?: string;
      checklist?: Record<string, boolean>;
      photos?: Array<{
        id: string;
        name: string;
        label: string;
        dataUrl: string;
        sizeBytes: number;
      }>;
      notes?: string;
      createdAt?: string;
    };

    const qcName = (body.qcName || '').trim();
    const barcodeUnit = (body.barcodeUnit || '').trim();
    const barcodeCarton = (body.barcodeCarton || '').trim();
    const unitType = (body.unitType || '').trim();
    const unitStatus = (body.unitStatus || '').trim();
    const tagDate = (body.tagDate || '').trim();
    const tagTime = (body.tagTime || '').trim();
    const photos = Array.isArray(body.photos) ? body.photos : [];

    if (!qcName || !barcodeUnit || !barcodeCarton || !unitType || !unitStatus || !tagDate) {
      res.status(400).json({ error: 'Data inspeksi wajib belum lengkap.' });
      return;
    }

    if (!isBarcodePairValid(barcodeUnit, barcodeCarton)) {
      res.status(400).json({
        error: 'Verifikasi gagal: Nomor Barcode 1 dan Nomor Barcode 2 (Karton) tidak cocok.',
      });
      return;
    }

    if (photos.length === 0) {
      res.status(400).json({ error: 'Minimal 1 bukti foto kelengkapan produk wajib diunggah.' });
      return;
    }

    const recordId = sanitizeSegment(
      body.id || `QC-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
    );
    const categoryId = body.productCategory || 'tangki_swh';
    const categoryFolderName = CATEGORY_FOLDER_NAMES[categoryId] || 'Tangki-SWH';
    const coreBarcode = sanitizeSegment(normalizeBarcodeCore(barcodeUnit));

    try {
      const accessToken = await getValidAccessToken(session);
      const { root, dbRecords } = await ensureDbRecordsFolder(accessToken, session);

      // Buat folder kategori & folder unit yang rapi di OneDrive
      const categoryFolder = await ensureChildFolder(
        accessToken,
        root.driveId,
        root.id,
        categoryFolderName
      );
      const unitFolderName = `${sanitizeSegment(tagDate)}_${coreBarcode}_${recordId}`;
      const unitFolder = await ensureChildFolder(
        accessToken,
        root.driveId,
        categoryFolder.id,
        unitFolderName
      );

      // Upload semua foto kelengkapan produk
      const uploadedPhotos: StoredPhotoRef[] = [];
      for (let idx = 0; idx < photos.length; idx++) {
        const photo = photos[idx];
        const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(
          photo.dataUrl || ''
        );
        if (!match) {
          throw new Error(`Format gambar foto ke-${idx + 1} tidak valid.`);
        }
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const ext = mimeType.includes('png') ? 'png' : 'jpg';
        const fileName = `foto-${idx + 1}-${sanitizeSegment(photo.label || 'kelengkapan')}.${ext}`;

        const uploaded = await graphJson<{
          id: string;
          size?: number;
          parentReference?: { driveId?: string };
        }>(
          accessToken,
          `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(unitFolder.id)}:/${encodeURIComponent(fileName)}:/content`,
          {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: buffer,
          }
        );

        uploadedPhotos.push({
          id: photo.id || `photo-${idx + 1}`,
          name: fileName,
          label: photo.label || `Foto Kelengkapan ${idx + 1}`,
          driveId: uploaded.parentReference?.driveId || root.driveId,
          itemId: uploaded.id,
          sizeBytes: uploaded.size ?? buffer.length,
        });
      }

      // Upload ringkasan.txt agar mudah dibaca langsung di OneDrive
      const summaryLines = [
        `FORM FINISH GOOD - ${categoryFolderName}`,
        `No Dokumen      : ${body.docNumber || 'WIE-QES-PR-QC-01/01'}`,
        `ID Tag QC       : ${recordId}`,
        `Nama QC         : ${qcName}`,
        `Tanggal di Tag  : ${tagDate} ${tagTime}`,
        `Type Unit       : ${unitType}`,
        `Status Unit     : ${unitStatus}`,
        `Barcode 1 (Unit): ${barcodeUnit}`,
        `Barcode 2 (Ktn) : ${barcodeCarton}`,
        `Nomor Inti      : ${normalizeBarcodeCore(barcodeUnit)}`,
        `Jumlah Foto     : ${uploadedPhotos.length}`,
        `Catatan         : ${(body.notes || '-').trim() || '-'}`,
      ].join('\n');

      await graphJson(
        accessToken,
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(unitFolder.id)}:/ringkasan.txt:/content`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: Buffer.from(summaryLines, 'utf8'),
        }
      );

      const storedRecord: StoredOneDriveRecord = {
        id: recordId,
        docNumber: body.docNumber || 'WIE-QES-PR-QC-01/01',
        productCategory: categoryId,
        qcOption: body.qcOption || 'Lainnya',
        qcName,
        barcodeUnit,
        barcodeCarton,
        barcodeVerified: true,
        unitType,
        unitStatus,
        tagDate,
        tagTime,
        checklist: body.checklist || {},
        photos: uploadedPhotos,
        notes: (body.notes || '').trim(),
        createdAt: body.createdAt || new Date().toISOString(),
        folderDriveId: root.driveId,
        folderItemId: unitFolder.id,
        folderWebUrl: unitFolder.webUrl,
      };

      await graphJson(
        accessToken,
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(dbRecords.id)}:/${encodeURIComponent(`${recordId}.json`)}:/content`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: Buffer.from(JSON.stringify(storedRecord), 'utf8'),
        }
      );

      res.status(201).json({ record: hydrateRecordForClient(storedRecord) });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menyimpan data ke OneDrive.',
      });
    }
  });

  // 8. Proxy OneDrive Photo Image securely for <img> and A4 Print
  app.get('/api/onedrive/photo/:driveId/:itemId', async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).send('Unauthorized');
      return;
    }

    const { driveId, itemId } = req.params;
    if (!isSafeGraphId(driveId) || !isSafeGraphId(itemId)) {
      res.status(400).send('Invalid file identifier');
      return;
    }

    try {
      const accessToken = await getValidAccessToken(session);
      const graphResp = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!graphResp.ok) {
        res.status(graphResp.status).send('Image not found');
        return;
      }

      const contentType = graphResp.headers.get('content-type') || 'image/jpeg';
      const arrayBuf = await graphResp.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(Buffer.from(arrayBuf));
    } catch {
      res.status(500).send('Failed to fetch image from OneDrive');
    }
  });

  // 9. Delete QC Record + Photo Folder from OneDrive
  app.delete('/api/onedrive/records/:id', requireCsrfHeader, async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Belum terhubung ke OneDrive.' });
      return;
    }

    const recordId = sanitizeSegment(req.params.id || '');
    if (!recordId || !isSafeGraphId(recordId)) {
      res.status(400).json({ error: 'ID catatan tidak valid.' });
      return;
    }

    try {
      const accessToken = await getValidAccessToken(session);
      const { root, dbRecords } = await ensureDbRecordsFolder(accessToken, session);

      // Baca JSON untuk mengetahui lokasi folder foto agar ikut terhapus
      try {
        const jsonResp = await fetch(
          `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(dbRecords.id)}:/${encodeURIComponent(`${recordId}.json`)}:/content`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (jsonResp.ok) {
          const rec = (await jsonResp.json()) as StoredOneDriveRecord;
          if (rec.folderDriveId && rec.folderItemId && isSafeGraphId(rec.folderDriveId) && isSafeGraphId(rec.folderItemId)) {
            await fetch(
              `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(rec.folderDriveId)}/items/${encodeURIComponent(rec.folderItemId)}`,
              {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
          }
        }
      } catch {
        // Lanjutkan penghapusan metadata JSON
      }

      await fetch(
        `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(root.driveId)}/items/${encodeURIComponent(dbRecords.id)}:/${encodeURIComponent(`${recordId}.json`)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menghapus data dari OneDrive.',
      });
    }
  });

  // Pastikan seluruh endpoint /api/* selalu mengembalikan JSON (tidak pernah jatuh ke HTML Vite/SPA)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg =
      err instanceof Error ? err.message : 'Terjadi kesalahan internal pada server API.';
    res.status(500).json({ error: msg });
  });

  // Vite dev middleware or static dist serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
