/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Cloud, CloudOff, Printer, RefreshCw, Settings2 } from 'lucide-react';
import { InspectionForm } from './components/InspectionForm';
import { OneDriveSettingsModal } from './components/OneDriveSettingsModal';
import { PrintHistoryView } from './components/PrintHistoryView';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import type { ProductCategoryId, QCInspectionRecord } from './types/qc';
import {
  deleteRecordById,
  getAllRecords,
  saveRecord,
} from './utils/storage';
import {
  deleteRecordFromOneDrive,
  disconnectOneDrive,
  fetchOneDriveRecords,
  fetchOneDriveStatus,
  getMicrosoftAuthUrl,
  getSavedSharedFolderUrl,
  saveRecordToOneDrive,
  saveSharedFolderUrlPref,
  setMemorySessionToken,
  setOneDriveTargetFolder,
  type OneDriveStatus,
} from './utils/onedrive';

type WorkspaceTab = 'form' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('form');
  const [selectedCategory, setSelectedCategory] =
    useState<ProductCategoryId>('tangki_swh');
  const [records, setRecords] = useState<QCInspectionRecord[]>([]);
  const [localRecords, setLocalRecords] = useState<QCInspectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [printQueue, setPrintQueue] = useState<QCInspectionRecord[]>([]);

  const [oneDriveStatus, setOneDriveStatus] = useState<OneDriveStatus>({
    configured: false,
    connected: false,
    user: null,
    targetFolder: null,
    redirectUri:
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : '',
  });
  const [isOneDriveModalOpen, setIsOneDriveModalOpen] = useState(false);
  const [oneDriveError, setOneDriveError] = useState<string | null>(null);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [savedShareUrl, setSavedShareUrl] = useState<string>(() =>
    getSavedSharedFolderUrl()
  );

  const loadWorkspaceData = useCallback(async () => {
    setIsLoading(true);
    setOneDriveError(null);
    try {
      const localData = await getAllRecords();
      setLocalRecords(localData);

      try {
        const status = await fetchOneDriveStatus();
        setOneDriveStatus(status);

        if (status.connected) {
          if (status.sharedFolderError) {
            setOneDriveError(status.sharedFolderError);
          }
          const prefShareUrl =
            getSavedSharedFolderUrl() || status.sharedFolderHint?.trim() || '';
          if (
            prefShareUrl &&
            status.targetFolder?.mode !== 'shared' &&
            !status.sharedFolderError
          ) {
            try {
              const updatedFolder = await setOneDriveTargetFolder({
                mode: 'shared',
                shareUrl: prefShareUrl,
              });
              status.targetFolder = updatedFolder;
              saveSharedFolderUrlPref(prefShareUrl);
              setSavedShareUrl(prefShareUrl);
              setOneDriveStatus({ ...status });
            } catch (folderErr) {
              setOneDriveError(
                folderErr instanceof Error
                  ? folderErr.message
                  : 'Gagal menghubungkan ke folder bersama OneDrive.'
              );
            }
          }
          const { records: odRecords, targetFolder } =
            await fetchOneDriveRecords();
          if (targetFolder) {
            setOneDriveStatus((prev) => ({ ...prev, targetFolder }));
          }
          setRecords(odRecords);
          return;
        }
      } catch (err) {
        setOneDriveError(
          err instanceof Error
            ? err.message
            : 'Gagal memeriksa koneksi OneDrive.'
        );
      }

      setRecords(localData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Dengarkan hasil popup OAuth Microsoft OneDrive
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'ONEDRIVE_AUTH_SUCCESS') {
        if (typeof event.data.sessionToken === 'string') {
          setMemorySessionToken(event.data.sessionToken);
        }
        setOneDriveError(null);
        void loadWorkspaceData();
      } else if (event.data?.type === 'ONEDRIVE_AUTH_ERROR') {
        setOneDriveError(
          typeof event.data.message === 'string'
            ? event.data.message
            : 'Gagal menghubungkan akun Microsoft OneDrive.'
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadWorkspaceData]);

  const handleConnectOneDrive = async () => {
    setOneDriveError(null);
    if (!oneDriveStatus.configured) {
      setIsOneDriveModalOpen(true);
      return;
    }

    try {
      const authUrl = await getMicrosoftAuthUrl();
      const authWindow = window.open(
        authUrl,
        'microsoft_onedrive_oauth',
        'width=600,height=720'
      );
      if (!authWindow) {
        setOneDriveError(
          'Popup login diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.'
        );
      }
    } catch (err) {
      setOneDriveError(
        err instanceof Error ? err.message : 'Gagal membuka login OneDrive.'
      );
      setIsOneDriveModalOpen(true);
    }
  };

  const handleDisconnectOneDrive = async () => {
    await disconnectOneDrive();
    setOneDriveStatus((prev) => ({
      ...prev,
      connected: false,
      user: null,
      targetFolder: null,
    }));
    const localData = await getAllRecords();
    setLocalRecords(localData);
    setRecords(localData);
  };

  const handleSaveFolderConfig = async (
    mode: 'personal' | 'shared',
    options?: {
      shareUrl?: string;
      driveId?: string;
      itemId?: string;
      name?: string;
      webUrl?: string;
    }
  ) => {
    if (mode === 'shared') {
      const cleanUrl = (options?.shareUrl || '').trim();
      if (cleanUrl) {
        saveSharedFolderUrlPref(cleanUrl);
        setSavedShareUrl(cleanUrl);
      }
      if (oneDriveStatus.connected) {
        const updated = await setOneDriveTargetFolder({
          mode: 'shared',
          shareUrl: cleanUrl || undefined,
          driveId: options?.driveId,
          itemId: options?.itemId,
          name: options?.name,
          webUrl: options?.webUrl,
        });
        setOneDriveStatus((prev) => ({ ...prev, targetFolder: updated }));
        await loadWorkspaceData();
      }
    } else {
      saveSharedFolderUrlPref('');
      setSavedShareUrl('');
      if (oneDriveStatus.connected) {
        const updated = await setOneDriveTargetFolder({ mode: 'personal' });
        setOneDriveStatus((prev) => ({ ...prev, targetFolder: updated }));
        await loadWorkspaceData();
      }
    }
  };

  const handleSyncLocalToOneDrive = async () => {
    if (!oneDriveStatus.connected || localRecords.length === 0) return;
    setIsSyncingLocal(true);
    setOneDriveError(null);
    try {
      const existingIds = new Set(records.map((r) => r.id));
      for (const localRec of localRecords) {
        if (!existingIds.has(localRec.id)) {
          await saveRecordToOneDrive(localRec);
        }
        await deleteRecordById(localRec.id);
      }
      setLocalRecords([]);
      await loadWorkspaceData();
    } catch (err) {
      setOneDriveError(
        err instanceof Error
          ? err.message
          : 'Gagal menyinkronkan data lokal ke OneDrive.'
      );
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const handleRecordSaved = async (record: QCInspectionRecord) => {
    if (oneDriveStatus.connected) {
      const savedInOneDrive = await saveRecordToOneDrive(record);
      setRecords((prev) => [
        savedInOneDrive,
        ...prev.filter((r) => r.id !== savedInOneDrive.id),
      ]);
      return;
    }

    await saveRecord(record);
    setLocalRecords((prev) => [
      record,
      ...prev.filter((r) => r.id !== record.id),
    ]);
    setRecords((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
  };

  const handleDeleteRecord = async (id: string) => {
    if (oneDriveStatus.connected) {
      await deleteRecordFromOneDrive(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      return;
    }

    await deleteRecordById(id);
    setLocalRecords((prev) => prev.filter((r) => r.id !== id));
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleHeaderPrintAction = () => {
    const categoryItems = records.filter(
      (r) => (r.productCategory ?? 'tangki_swh') === selectedCategory
    );
    if (categoryItems.length > 0) {
      setPrintQueue(categoryItems);
    } else if (records.length > 0) {
      setPrintQueue(records);
    } else {
      setActiveTab('history');
    }
  };

  return (
    <>
      <div className="no-print min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {/* Top Bar Contract: 3 Zona (Wordmark - Nav Links - 1 Primary Action) */}
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            {/* Zona 1: Brand Wordmark satu baris */}
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="text-base font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 cursor-pointer"
            >
              WIE Quality Control
            </button>

            {/* Zona 2: Navigasi teks satu baris */}
            <nav className="flex items-center gap-6 text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'form'
                    ? 'border-blue-700 text-slate-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-950'
                }`}
              >
                Input Inspeksi
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-blue-700 text-slate-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-950'
                }`}
              >
                Riwayat &amp; Cetak ({records.length})
              </button>
            </nav>

            {/* Zona 3: 1 Primary Action */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handleHeaderPrintAction}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Laporan</span>
              </button>
            </div>
          </div>
        </header>

        {/* Konten Utama */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Bar Status Penyimpanan OneDrive */}
          <section className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 text-xs">
              {oneDriveStatus.connected ? (
                <>
                  <Cloud className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-emerald-900">
                      OneDrive Terhubung
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-800 font-medium">
                      {oneDriveStatus.user?.displayName}
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-600 font-mono">
                      Folder:{' '}
                      {oneDriveStatus.targetFolder?.name || 'Finish-Good-QC'}
                      {oneDriveStatus.targetFolder?.mode === 'shared'
                        ? ' (Bersama Seluruh QC)'
                        : ''}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <CloudOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-slate-900">
                      Mode Penyimpanan Lokal
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-600">
                      Hubungkan Microsoft OneDrive agar data &amp; foto tersimpan bersama untuk seluruh QC.
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {oneDriveStatus.connected && (
                <button
                  type="button"
                  onClick={() => void loadWorkspaceData()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang</span>
                </button>
              )}

              {!oneDriveStatus.connected && oneDriveStatus.configured ? (
                <button
                  type="button"
                  onClick={() => void handleConnectOneDrive()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 text-white rounded-md text-xs font-semibold hover:bg-blue-800 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Hubungkan OneDrive</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setIsOneDriveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Pengaturan OneDrive</span>
              </button>
            </div>
          </section>

          {oneDriveError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-xs font-medium text-red-900 flex items-center justify-between gap-3"
            >
              <span>{oneDriveError}</span>
              <button
                type="button"
                onClick={() => setOneDriveError(null)}
                className="text-red-700 font-semibold hover:underline shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {activeTab === 'form' ? (
            <InspectionForm
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onRecordSaved={handleRecordSaved}
              onRequestPrint={(record) => setPrintQueue([record])}
            />
          ) : (
            <PrintHistoryView
              records={records}
              activeCategory={selectedCategory}
              onChangeCategory={setSelectedCategory}
              isLoading={isLoading}
              onDeleteRecord={handleDeleteRecord}
              onPrintRecords={(items) => setPrintQueue(items)}
              onNavigateToForm={(cat) => {
                setSelectedCategory(cat);
                setActiveTab('form');
              }}
            />
          )}
        </main>
      </div>

      {/* Modal Pengaturan OneDrive */}
      <OneDriveSettingsModal
        isOpen={isOneDriveModalOpen}
        onClose={() => setIsOneDriveModalOpen(false)}
        status={oneDriveStatus}
        localRecordCount={localRecords.length}
        isSyncingLocal={isSyncingLocal}
        onConnect={() => void handleConnectOneDrive()}
        onDisconnect={handleDisconnectOneDrive}
        onSaveFolderConfig={handleSaveFolderConfig}
        onSyncLocalToOneDrive={handleSyncLocalToOneDrive}
        savedShareUrl={savedShareUrl}
      />

      {/* Modal Pratinjau & Cetak A4 */}
      <PrintPreviewModal
        records={printQueue}
        onClose={() => setPrintQueue([])}
      />
    </>
  );
}
