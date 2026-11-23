import React, { useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  ExternalLink,
  FolderOpen,
  LogOut,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import {
  fetchSharedOneDriveFolders,
  type OneDriveStatus,
  type SharedFolderItem,
} from '../utils/onedrive';

interface OneDriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: OneDriveStatus;
  localRecordCount: number;
  isSyncingLocal: boolean;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
  onSaveFolderConfig: (
    mode: 'personal' | 'shared',
    options?: {
      shareUrl?: string;
      driveId?: string;
      itemId?: string;
      name?: string;
      webUrl?: string;
    }
  ) => Promise<void>;
  onSyncLocalToOneDrive: () => Promise<void>;
  savedShareUrl: string;
}

export const OneDriveSettingsModal: React.FC<OneDriveSettingsModalProps> = ({
  isOpen,
  onClose,
  status,
  localRecordCount,
  isSyncingLocal,
  onConnect,
  onDisconnect,
  onSaveFolderConfig,
  onSyncLocalToOneDrive,
  savedShareUrl,
}) => {
  const [folderMode, setFolderMode] = useState<'personal' | 'shared'>(
    status.targetFolder?.mode || (savedShareUrl ? 'shared' : 'personal')
  );
  const [shareUrlInput, setShareUrlInput] = useState<string>(
    status.targetFolder?.shareUrl || savedShareUrl || status.sharedFolderHint || ''
  );
  const [sharedFolders, setSharedFolders] = useState<SharedFolderItem[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderSuccess, setFolderSuccess] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const effectiveMode =
      status.targetFolder?.mode ||
      (savedShareUrl || status.sharedFolderHint ? 'shared' : 'personal');
    setFolderMode(effectiveMode);
    setShareUrlInput(
      status.targetFolder?.shareUrl ||
        savedShareUrl ||
        status.sharedFolderHint ||
        ''
    );
    setFolderError(null);
    setFolderSuccess(null);
  }, [
    isOpen,
    status.targetFolder?.mode,
    status.targetFolder?.shareUrl,
    status.sharedFolderHint,
    savedShareUrl,
  ]);

  useEffect(() => {
    if (!isOpen || !status.connected) return;
    let active = true;
    setIsLoadingShared(true);
    fetchSharedOneDriveFolders()
      .then((list) => {
        if (active) setSharedFolders(list);
      })
      .catch(() => {
        if (active) setSharedFolders([]);
      })
      .finally(() => {
        if (active) setIsLoadingShared(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, status.connected]);

  if (!isOpen) return null;

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(status.redirectUri);
      setCopiedUri(true);
      window.setTimeout(() => setCopiedUri(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleApplyFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFolderError(null);
    setFolderSuccess(null);
    setIsSavingFolder(true);
    try {
      await onSaveFolderConfig(
        folderMode,
        folderMode === 'shared' ? { shareUrl: shareUrlInput } : undefined
      );
      setFolderSuccess(
        folderMode === 'shared'
          ? 'Folder bersama tim QC di OneDrive berhasil terhubung.'
          : 'Folder OneDrive pribadi (/Finish-Good-QC) aktif.'
      );
    } catch (err) {
      setFolderError(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan folder.'
      );
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleSelectSharedFolder = async (folder: SharedFolderItem) => {
    setFolderError(null);
    setFolderSuccess(null);
    setIsSavingFolder(true);
    try {
      await onSaveFolderConfig('shared', {
        driveId: folder.driveId,
        itemId: folder.itemId,
        name: folder.name,
        webUrl: folder.webUrl,
      });
      setFolderSuccess(`Berhasil terhubung ke folder bersama "${folder.name}".`);
    } catch (err) {
      setFolderError(
        err instanceof Error ? err.message : 'Gagal mengakses folder bersama tersebut.'
      );
    } finally {
      setIsSavingFolder(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan Penyimpanan OneDrive QC"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl overflow-hidden my-auto">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-blue-700 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Penyimpanan Bersama OneDrive (Seluruh QC)
              </h2>
              <p className="text-xs text-slate-500">
                Foto kelengkapan dan data QC tersimpan terpusat di folder OneDrive.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan OneDrive"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm max-h-[82vh] overflow-y-auto">
          {/* Status Koneksi Akun Microsoft */}
          {!status.configured ? (
            <div className="border border-amber-300 bg-amber-50 rounded-md p-4 space-y-2.5 text-xs text-amber-950">
              <p className="font-bold">
                Konfigurasi Azure App Registration Belum Dipasang
              </p>
              <p>
                Untuk mengaktifkan login Microsoft OneDrive bagi seluruh tim QC, tambahkan{' '}
                <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">
                  MICROSOFT_CLIENT_ID
                </code>{' '}
                dan{' '}
                <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">
                  MICROSOFT_CLIENT_SECRET
                </code>{' '}
                di menu Secrets AI Studio, lalu daftarkan Redirect URI berikut di Azure Portal:
              </p>
              <div className="flex items-center gap-2 bg-white border border-amber-200 rounded px-2.5 py-1.5">
                <code className="font-mono text-[11px] text-slate-900 truncate flex-1">
                  {status.redirectUri}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyRedirectUri()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer shrink-0"
                >
                  {copiedUri ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-700" />
                      <span>Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : !status.connected ? (
            <div className="border border-slate-200 bg-slate-50 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Akun Microsoft OneDrive Belum Terhubung
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Setiap QC dapat masuk menggunakan akun Microsoft 365 perusahaan (satu tenant) untuk membaca &amp; menyimpan data bersama.
                </p>
              </div>
              <button
                type="button"
                onClick={onConnect}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-md hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Cloud className="w-4 h-4" />
                <span>Masuk dengan OneDrive</span>
              </button>
            </div>
          ) : (
            <div className="border border-emerald-300 bg-emerald-50 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-900">
                  Terhubung ke Microsoft OneDrive
                </p>
                <p className="text-sm font-bold text-slate-950 mt-0.5">
                  {status.user?.displayName}
                </p>
                <p className="text-xs font-mono text-slate-600">
                  {status.user?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onDisconnect()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Akun</span>
              </button>
            </div>
          )}

          {/* Pengaturan Folder Bersama Tim QC */}
          <form onSubmit={handleApplyFolder} className="space-y-3 border-t border-slate-200 pt-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Lokasi Penyimpanan Folder OneDrive
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Agar akun teman masuk ke 1 folder yang sama, pilih{' '}
                <strong>Folder Bersama (Seluruh QC)</strong> lalu pilih folder yang di-share ke akunnya atau tempel link{' '}
                <strong>Bagikan (Share) → Salin Tautan</strong> dengan izin{' '}
                <strong>Dapat Mengedit (Can Edit)</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-2.5 p-3 border rounded-md cursor-pointer transition-colors ${
                  folderMode === 'shared'
                    ? 'border-blue-700 bg-blue-50/60'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="folderMode"
                  value="shared"
                  checked={folderMode === 'shared'}
                  onChange={() => setFolderMode('shared')}
                  className="accent-blue-700 mt-0.5 shrink-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-700" />
                    <span>Folder Bersama (Seluruh QC)</span>
                  </span>
                  <span className="block text-slate-500 mt-0.5">
                    Semua akun QC menulis &amp; membaca dari 1 folder shared.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 border rounded-md cursor-pointer transition-colors ${
                  folderMode === 'personal'
                    ? 'border-blue-700 bg-blue-50/60'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="folderMode"
                  value="personal"
                  checked={folderMode === 'personal'}
                  onChange={() => setFolderMode('personal')}
                  className="accent-blue-700 mt-0.5 shrink-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <FolderOpen className="w-3.5 h-3.5 text-slate-700" />
                    <span>Folder Akun (/Finish-Good-QC)</span>
                  </span>
                  <span className="block text-slate-500 mt-0.5">
                    Menyimpan di folder OneDrive akun yang sedang login.
                  </span>
                </div>
              </label>
            </div>

            {folderMode === 'shared' && (
              <div className="space-y-3">
                {/* Daftar Folder yang sudah di-share ke akun yang sedang login */}
                {status.connected && (
                  <div className="border border-slate-200 rounded-md p-3 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Folder yang Dibagikan ke Akun Ini (Shared with me)
                      </span>
                      {isLoadingShared && (
                        <span className="text-[11px] text-slate-500">Memuat...</span>
                      )}
                    </div>
                    {sharedFolders.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {sharedFolders.map((folder) => {
                          const isActive =
                            status.targetFolder?.mode === 'shared' &&
                            status.targetFolder.itemId === folder.itemId;
                          return (
                            <div
                              key={`${folder.driveId}:${folder.itemId}`}
                              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded border text-xs bg-white ${
                                isActive
                                  ? 'border-emerald-400 bg-emerald-50/40'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">
                                  {folder.name}
                                </p>
                                {folder.ownerName && (
                                  <p className="text-[11px] text-slate-500 truncate">
                                    Pemilik: {folder.ownerName}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={isSavingFolder}
                                onClick={() => void handleSelectSharedFolder(folder)}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold shrink-0 cursor-pointer ${
                                  isActive
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                {isActive ? 'Aktif' : 'Pilih Folder'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : !isLoadingShared ? (
                      <p className="text-[11px] text-slate-500">
                        Belum ada folder yang terdeteksi di "Shared with me". Pastikan pemilik folder sudah melakukan Share langsung ke email akun ini dengan izin <strong>Dapat Mengedit (Can Edit)</strong>, atau tempel link Share di bawah.
                      </p>
                    ) : null}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="onedrive-share-url"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Atau Tempel Link Shared Folder (Bagikan → Salin Tautan, Izin Edit)
                  </label>
                  <input
                    id="onedrive-share-url"
                    type="url"
                    value={shareUrlInput}
                    onChange={(e) => setShareUrlInput(e.target.value)}
                    placeholder="https://...-my.sharepoint.com/:f:/g/personal/... atau https://1drv.ms/..."
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    required={folderMode === 'shared'}
                  />
                </div>
              </div>
            )}

            {status.targetFolder?.webUrl && (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded">
                <span className="truncate">
                  Folder Aktif: <strong className="text-slate-900">{status.targetFolder.name}</strong>
                </span>
                <a
                  href={status.targetFolder.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>Buka di OneDrive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {folderError && (
              <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {folderError}
              </p>
            )}
            {folderSuccess && (
              <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                {folderSuccess}
              </p>
            )}

            {status.connected && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {localRecordCount > 0 ? (
                  <button
                    type="button"
                    disabled={isSyncingLocal}
                    onClick={() => void onSyncLocalToOneDrive()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isSyncingLocal ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isSyncingLocal
                        ? 'Mengunggah...'
                        : `Sinkronkan ${localRecordCount} Data Lokal ke OneDrive`}
                    </span>
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  disabled={isSavingFolder}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isSavingFolder ? 'Menyimpan...' : 'Terapkan Lokasi Folder'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
