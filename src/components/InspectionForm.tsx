import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Camera,
  CheckCircle2,
  Clock,
  FileCheck2,
  Printer,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DOCUMENT_NUMBER,
  PRODUCT_CATEGORIES,
  QC_PRESET_INSPECTORS,
  UNIT_STATUSES,
  getCategoryConfig,
  type ProductCategoryConfig,
  type ProductCategoryId,
  type QCInspectionRecord,
  type QCPhoto,
  type UnitStatus,
} from '../types/qc';
import {
  compressImageFile,
  formatBytes,
  formatIndonesianDate,
  getCurrentTimeInput,
  getTodayDateInput,
} from '../utils/storage';
import { verifyBarcodesMatch } from '../utils/barcode';
import { BarcodeSvg } from './BarcodeSvg';

interface InspectionFormProps {
  selectedCategory: ProductCategoryId;
  onSelectCategory: (category: ProductCategoryId) => void;
  onRecordSaved: (record: QCInspectionRecord) => Promise<void>;
  onRequestPrint: (record: QCInspectionRecord) => void;
}

function buildDefaultChecklist(
  category: ProductCategoryConfig
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const item of category.checklistItems) {
    result[item.key] = true;
  }
  return result;
}

const MAX_PHOTOS = 6;

export const InspectionForm: React.FC<InspectionFormProps> = ({
  selectedCategory,
  onSelectCategory,
  onRecordSaved,
  onRequestPrint,
}) => {
  const categoryConfig = getCategoryConfig(selectedCategory);

  const [qcOption, setQcOption] = useState<'Arif Kurniawan' | 'Nur Rohmat Kurniawan' | 'Lainnya'>(
    'Arif Kurniawan'
  );
  const [customQcName, setCustomQcName] = useState('');
  const [barcodeUnit, setBarcodeUnit] = useState('');
  const [barcodeCarton, setBarcodeCarton] = useState('');
  const [unitType, setUnitType] = useState<string>('');
  const [unitStatus, setUnitStatus] = useState<UnitStatus | ''>('Barang OK');
  const [tagDate, setTagDate] = useState<string>(() => getTodayDateInput());
  const [tagTime, setTagTime] = useState<string>(() => getCurrentTimeInput());
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() =>
    buildDefaultChecklist(categoryConfig)
  );
  const [photos, setPhotos] = useState<QCPhoto[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const syncClock = () => {
      setTagDate(getTodayDateInput());
      setTagTime(getCurrentTimeInput());
    };
    syncClock();
    const timer = window.setInterval(syncClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedRecord, setSavedRecord] = useState<QCInspectionRecord | null>(null);

  const cartonInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resolvedQcName =
    qcOption === 'Lainnya' ? customQcName.trim() : qcOption;

  const barcodeResult = verifyBarcodesMatch(barcodeUnit, barcodeCarton);
  const trimmedUnit = barcodeResult.unitRaw;
  const trimmedCarton = barcodeResult.cartonRaw;
  const hasBothBarcodes = barcodeResult.hasBoth;
  const isBarcodeMatch = barcodeResult.isMatch;
  const isBarcodeMismatch = barcodeResult.matchType === 'mismatch';

  const canSubmit =
    resolvedQcName.length > 0 &&
    isBarcodeMatch &&
    unitType !== '' &&
    unitStatus !== '' &&
    tagDate.trim().length > 0 &&
    tagTime.trim().length > 0 &&
    photos.length >= 1 &&
    !isProcessingPhotos &&
    !isSubmitting;

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setPhotoError(null);

    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      setPhotoError(`Maksimal ${MAX_PHOTOS} foto kelengkapan produk per unit.`);
      return;
    }

    const incoming = Array.from(fileList).slice(0, remainingSlots);
    const validImages = incoming.filter((f) => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      setPhotoError('Hanya file gambar (JPG, PNG, WEBP) yang dapat diunggah sebagai bukti foto.');
      return;
    }

    setIsProcessingPhotos(true);
    try {
      const processed: QCPhoto[] = [];
      for (let i = 0; i < validImages.length; i++) {
        const file = validImages[i];
        const { dataUrl, sizeBytes } = await compressImageFile(file);
        const nextIdx = photos.length + processed.length;
        processed.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          label:
            categoryConfig.photoSuggestions[nextIdx] ??
            `Foto Kelengkapan ${nextIdx + 1}`,
          dataUrl,
          sizeBytes,
        });
      }
      setPhotos((prev) => [...prev, ...processed]);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Gagal memproses foto yang dipilih.'
      );
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const handleUpdatePhotoLabel = (photoId: string, label: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, label } : p))
    );
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleCategorySwitch = (nextId: ProductCategoryId) => {
    if (nextId === selectedCategory) return;
    const nextConfig = getCategoryConfig(nextId);
    onSelectCategory(nextId);
    setUnitType('');
    setChecklist(buildDefaultChecklist(nextConfig));
    setSubmitError(null);
    setSavedRecord(null);
  };

  const handleResetForNextUnit = () => {
    setBarcodeUnit('');
    setBarcodeCarton('');
    setUnitType('');
    setUnitStatus('Barang OK');
    setTagDate(getTodayDateInput());
    setTagTime(getCurrentTimeInput());
    setChecklist(buildDefaultChecklist(categoryConfig));
    setPhotos([]);
    setNotes('');
    setPhotoError(null);
    setSubmitError(null);
    setSavedRecord(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!resolvedQcName) {
      setSubmitError('Pilih atau masukkan nama Quality Control terlebih dahulu.');
      return;
    }

    if (!trimmedUnit || !trimmedCarton) {
      setSubmitError('Nomor Barcode 1 (Unit) dan Nomor Barcode 2 (Karton) wajib diisi.');
      return;
    }

    if (!barcodeResult.isMatch) {
      setSubmitError(
        'Verifikasi gagal: Nomor Barcode 1 dan Nomor Barcode 2 (Karton) tidak sama. Tidak dapat submit.'
      );
      return;
    }

    if (!unitType) {
      setSubmitError('Pilih Type Unit terlebih dahulu.');
      return;
    }

    if (!unitStatus) {
      setSubmitError('Pilih Status Unit terlebih dahulu.');
      return;
    }

    if (photos.length === 0) {
      setSubmitError('Unggah minimal 1 bukti foto kelengkapan produk sebelum submit.');
      return;
    }

    setIsSubmitting(true);
    try {
      const autoTagDate = getTodayDateInput();
      const autoTagTime = getCurrentTimeInput();
      const record: QCInspectionRecord = {
        id: `QC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        docNumber: DOCUMENT_NUMBER,
        productCategory: selectedCategory,
        qcOption,
        qcName: resolvedQcName,
        barcodeUnit: trimmedUnit,
        barcodeCarton: trimmedCarton,
        barcodeVerified: true,
        unitType,
        unitStatus,
        tagDate: autoTagDate,
        tagTime: autoTagTime,
        checklist: { ...checklist },
        photos,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      await onRecordSaved(record);
      setSavedRecord(record);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data QC.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const allChecklistChecked = categoryConfig.checklistItems.every(
    (item) => Boolean(checklist[item.key])
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Kolom Kiri: Form Finish Good QC */}
      <div className="lg:col-span-8">
        {savedRecord && (
          <div className="mb-6 bg-emerald-50 border border-emerald-300 p-5 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Data Finish Good Berhasil Disimpan &amp; Terverifikasi
                  </h3>
                  <p className="text-xs text-emerald-900 mt-1 font-mono tabular-nums">
                    Barcode: {savedRecord.barcodeUnit} · QC: {savedRecord.qcName} · Tanggal Tag:{' '}
                    {formatIndonesianDate(savedRecord.tagDate)} ({savedRecord.tagTime})
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onRequestPrint(savedRecord)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Tag &amp; Bukti Foto</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetForNextUnit}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Input Unit Baru</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-lg overflow-hidden"
        >
          {/* Pemilih Kategori Produk */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-200 bg-white">
            <p className="text-xs font-semibold text-slate-600 mb-2.5">
              Pilih Kategori Produk yang Diperiksa
            </p>
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              {PRODUCT_CATEGORIES.map((cat) => {
                const active = cat.id === selectedCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySwitch(cat.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {cat.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Header Formulir */}
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70">
            <p className="text-xs font-mono text-slate-600 tabular-nums">
              No Dokumen: {DOCUMENT_NUMBER} · {categoryConfig.label}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight mt-1 text-balance">
              {categoryConfig.formTitle}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Lengkapi pemeriksaan QC, verifikasi kecocokan barcode unit dan karton, serta unggah bukti foto kelengkapan produk.
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {/* 1. Quality Control Checked */}
            <fieldset className="p-6">
              <legend className="text-sm font-semibold text-slate-900 mb-3">
                1. Quality Control Checked <span className="text-red-600">*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {QC_PRESET_INSPECTORS.map((name) => {
                  const selected = qcOption === name;
                  return (
                    <label
                      key={name}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-md text-sm cursor-pointer transition-colors min-h-[42px] ${
                        selected
                          ? 'border-blue-700 bg-blue-50/60 text-slate-950 font-medium'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="qcOption"
                        value={name}
                        checked={selected}
                        onChange={() => setQcOption(name)}
                        className="accent-blue-700 w-4 h-4 shrink-0"
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  );
                })}
                <label
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-md text-sm cursor-pointer transition-colors min-h-[42px] ${
                    qcOption === 'Lainnya'
                      ? 'border-blue-700 bg-blue-50/60 text-slate-950 font-medium'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="qcOption"
                    value="Lainnya"
                    checked={qcOption === 'Lainnya'}
                    onChange={() => setQcOption('Lainnya')}
                    className="accent-blue-700 w-4 h-4 shrink-0"
                  />
                  <span>Lainnya</span>
                </label>
              </div>

              {qcOption === 'Lainnya' && (
                <div className="mt-3">
                  <label
                    htmlFor="custom-qc-name"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Nama Pemeriksa QC (Lainnya) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="custom-qc-name"
                    type="text"
                    value={customQcName}
                    onChange={(e) => setCustomQcName(e.target.value)}
                    placeholder="Masukkan nama lengkap QC..."
                    className="w-full sm:max-w-sm px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    required
                  />
                </div>
              )}
            </fieldset>

            {/* 2. Verifikasi Barcode 1 (Unit/Tangki) & Barcode 2 (Karton) */}
            <section className="p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  2. Verifikasi Nomor Barcode Unit &amp; Karton <span className="text-red-600">*</span>
                </h2>
                <span className="text-xs text-slate-500">
                  Kode tag A/B/C/D diabaikan otomatis selama angka inti barcode sama
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="barcode-unit"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Nomor Barcode 1 (Unit / Tangki) <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="barcode-unit"
                      type="text"
                      value={barcodeUnit}
                      onChange={(e) => {
                        setBarcodeUnit(e.target.value);
                        setSavedRecord(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          cartonInputRef.current?.focus();
                        }
                      }}
                      placeholder="Scan atau ketik barcode tangki..."
                      autoComplete="off"
                      className="w-full pl-9 pr-9 py-2.5 font-mono text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 tabular-nums"
                      required
                    />
                    {barcodeUnit && (
                      <button
                        type="button"
                        onClick={() => setBarcodeUnit('')}
                        aria-label="Hapus barcode 1"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="barcode-carton"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Nomor Barcode 2 (Karton) <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={cartonInputRef}
                      id="barcode-carton"
                      type="text"
                      value={barcodeCarton}
                      onChange={(e) => {
                        setBarcodeCarton(e.target.value);
                        setSavedRecord(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="Scan atau ketik barcode karton..."
                      autoComplete="off"
                      className="w-full pl-9 pr-9 py-2.5 font-mono text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 tabular-nums"
                      required
                    />
                    {barcodeCarton && (
                      <button
                        type="button"
                        onClick={() => setBarcodeCarton('')}
                        aria-label="Hapus barcode 2"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Verifikasi Kecocokan Barcode */}
              <div className="mt-3">
                {!hasBothBarcodes && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-md text-xs text-slate-600">
                    <Barcode className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      Menunggu verifikasi: Masukkan Nomor Barcode 1 (Unit) dan Nomor Barcode 2 (Karton) untuk pencocokan otomatis.
                    </span>
                  </div>
                )}

                {isBarcodeMatch && (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 px-3.5 py-2.5 border border-emerald-300 bg-emerald-50 rounded-md text-xs font-medium text-emerald-900"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <div>
                      {barcodeResult.matchType === 'exact' ? (
                        <span>
                          Terverifikasi Cocok — Nomor Barcode 1 dan Nomor Barcode 2 (Karton) sama persis ({trimmedUnit}).
                        </span>
                      ) : (
                        <>
                          <span className="font-bold">
                            Terverifikasi Cocok (Nomor Inti Sama)
                          </span>
                          <p className="mt-0.5 font-normal text-emerald-800 font-mono tabular-nums">
                            Nomor inti cocok ({barcodeResult.unitCore}) · Kode tag A/B/C/D ({trimmedUnit} ↔ {trimmedCarton}) dianggap sama.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {isBarcodeMismatch && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 px-3.5 py-2.5 border border-red-300 bg-red-50 rounded-md text-xs font-medium text-red-900"
                  >
                    <ShieldAlert className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">
                        Verifikasi Gagal (Tidak Sama) — Tidak Dapat Submit!
                      </span>
                      <p className="mt-0.5 font-normal text-red-800 font-mono tabular-nums">
                        Barcode 1 ({barcodeResult.unitCore}) ≠ Barcode 2 Karton ({barcodeResult.cartonCore}). Periksa kembali label tangki dan karton.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Type Unit / Type Produk */}
            <fieldset className="p-6">
              <legend className="text-sm font-semibold text-slate-900 mb-3">
                {categoryConfig.typeFieldLabel} <span className="text-red-600">*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {categoryConfig.unitTypes.map((type) => {
                  const selected = unitType === type;
                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-md text-sm font-mono cursor-pointer transition-colors min-h-[42px] ${
                        selected
                          ? 'border-blue-700 bg-blue-50/60 text-slate-950 font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="unitType"
                        value={type}
                        checked={selected}
                        onChange={() => setUnitType(type)}
                        className="accent-blue-700 w-4 h-4 shrink-0"
                      />
                      <span className="truncate">{type}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* 4. Status Unit & 5. Tanggal di Tag */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <fieldset className="p-6">
                <legend className="text-sm font-semibold text-slate-900 mb-3">
                  4. Status Unit <span className="text-red-600">*</span>
                </legend>
                <div className="space-y-2.5">
                  {UNIT_STATUSES.map((status) => {
                    const selected = unitStatus === status;
                    return (
                      <label
                        key={status}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-md text-sm cursor-pointer transition-colors min-h-[42px] ${
                          selected
                            ? 'border-blue-700 bg-blue-50/60 text-slate-950 font-medium'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="unitStatus"
                          value={status}
                          checked={selected}
                          onChange={() => setUnitStatus(status)}
                          className="accent-blue-700 w-4 h-4 shrink-0"
                        />
                        <span>{status}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <section className="p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    5. Tanggal &amp; Waktu di Tag QC
                  </h2>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Otomatis Hari Ini</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-md">
                    <span className="block text-[11px] font-medium text-slate-500">
                      Tanggal Tag
                    </span>
                    <span className="block text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">
                      {formatIndonesianDate(tagDate)}
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5 border border-slate-200 bg-slate-50 rounded-md">
                    <span className="block text-[11px] font-medium text-slate-500">
                      Waktu Tag
                    </span>
                    <span className="block text-sm font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                      {tagTime}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Tanggal dan waktu tag diisi otomatis tepat saat inspeksi QC dilakukan dan disubmit.
                </p>
              </section>
            </div>

            {/* 6. Komponen Pendukung & Bukti Foto Kelengkapan Produk */}
            <section className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {categoryConfig.completenessTitle}{' '}
                    <span className="text-red-600">*</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Centang kelengkapan fisik dan unggah foto bukti kelengkapan produk (maksimal {MAX_PHOTOS} foto).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !allChecklistChecked;
                    const updated: Record<string, boolean> = {};
                    for (const item of categoryConfig.checklistItems) {
                      updated[item.key] = nextVal;
                    }
                    setChecklist(updated);
                  }}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {allChecklistChecked ? 'Hapus Centang Semua' : 'Centang Semua'}
                </button>
              </div>

              {/* Checklist Item */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {categoryConfig.checklistItems.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2.5 px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[item.key])}
                      onChange={(e) =>
                        setChecklist((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="accent-blue-700 w-4 h-4 shrink-0"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Dropzone & Upload Actions */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void handleFilesSelected(e.dataTransfer.files);
                }}
                className={`border border-dashed rounded-md p-5 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-300 bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />

                <div className="flex flex-col items-center">
                  <p className="text-sm font-medium text-slate-800">
                    Unggah Bukti Foto Kelengkapan Produk
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Seret foto ke sini atau pilih dari perangkat ({photos.length}/{MAX_PHOTOS} foto terunggah)
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 mt-3">
                    <button
                      type="button"
                      disabled={photos.length >= MAX_PHOTOS || isProcessingPhotos}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {isProcessingPhotos ? 'Memproses Foto...' : 'Pilih Foto dari File'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={photos.length >= MAX_PHOTOS || isProcessingPhotos}
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Ambil Foto Kamera</span>
                    </button>
                  </div>
                </div>
              </div>

              {photoError && (
                <p className="mt-2 text-xs text-red-700 font-medium">{photoError}</p>
              )}

              {/* Preview Foto Terunggah */}
              {photos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {photos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="border border-slate-200 rounded-md overflow-hidden bg-white"
                    >
                      <div className="relative aspect-[4/3] bg-slate-100">
                        <img
                          src={photo.dataUrl}
                          alt={photo.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          aria-label={`Hapus foto ${idx + 1}`}
                          className="absolute top-2 right-2 p-1.5 bg-white/95 border border-slate-300 rounded-md text-slate-700 hover:text-red-700 hover:border-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2.5 border-t border-slate-200 space-y-1.5">
                        <input
                          type="text"
                          value={photo.label}
                          onChange={(e) => handleUpdatePhotoLabel(photo.id, e.target.value)}
                          placeholder={`Keterangan foto ${idx + 1}`}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-600"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                          <span className="truncate max-w-[140px]">{photo.name}</span>
                          <span>{formatBytes(photo.sizeBytes)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 7. Catatan Opsional */}
            <section className="p-6">
              <label
                htmlFor="qc-notes"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                7. Catatan Tambahan QC (Opsional)
              </label>
              <textarea
                id="qc-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan kondisi unit, penggantian aksesoris, atau keterangan tag (opsional)..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </section>
          </div>

          {/* Submit Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs">
              {submitError ? (
                <span className="text-red-700 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </span>
              ) : isBarcodeMismatch ? (
                <span className="text-red-700 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Submit dikunci: Nomor Barcode 1 &amp; Nomor Barcode 2 tidak sama.</span>
                </span>
              ) : !canSubmit ? (
                <span className="text-slate-600">
                  Lengkapi Nama QC, Verifikasi 2 Barcode (sama), Type Unit, dan minimal 1 bukti foto.
                </span>
              ) : (
                <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Semua syarat validasi terpenuhi. Siap disimpan dan dicetak.</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResetForNextUnit}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reset Form
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Submit Data QC'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Kolom Kanan: Panel Verifikasi & Pratinjau Tag QC Live */}
      <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
        {/* Status Kelayakan Submit */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">
            Status Verifikasi Sebelum Submit
          </h2>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-slate-600">Kategori Produk</span>
              <span className="font-semibold text-slate-900">
                {categoryConfig.shortLabel}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-slate-600">Nama QC</span>
              <span
                className={`font-semibold truncate max-w-[180px] ${
                  resolvedQcName ? 'text-slate-900' : 'text-amber-700'
                }`}
              >
                {resolvedQcName || 'Belum diisi'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-slate-600">Verifikasi Barcode 1 &amp; 2</span>
              {isBarcodeMatch ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cocok</span>
                </span>
              ) : isBarcodeMismatch ? (
                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Tidak Sama</span>
                </span>
              ) : (
                <span className="font-medium text-slate-500">Menunggu Input</span>
              )}
            </li>
            <li className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-slate-600">Type &amp; Status Unit</span>
              <span className="font-mono font-medium text-slate-900">
                {unitType ? `${unitType} · ${unitStatus}` : 'Belum dipilih'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-slate-600">Tanggal di Tag</span>
              <span className="font-mono text-slate-900 tabular-nums">
                {tagDate} · {tagTime}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Bukti Foto Kelengkapan</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  photos.length > 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {photos.length} / {MAX_PHOTOS} Foto
              </span>
            </li>
          </ul>
        </div>

        {/* Live Tag Preview */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Pratinjau Tag Finish Good</h2>
            <span className="text-[11px] font-mono text-slate-500">{categoryConfig.shortLabel}</span>
          </div>

          <div className="border border-slate-300 p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <p className="text-[11px] text-slate-500">Quality Control</p>
                <p className="text-xs font-bold text-slate-900">
                  {resolvedQcName || '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500">Tanggal di Tag</p>
                <p className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                  {tagDate}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[11px] text-slate-500">Type Unit</p>
                <p className="font-mono font-semibold text-slate-900">
                  {unitType || '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Status</p>
                <p className="font-semibold text-slate-900">{unitStatus || '—'}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-col items-center">
              <BarcodeSvg
                value={isBarcodeMatch ? trimmedUnit : trimmedUnit || ''}
                height={38}
              />
              <p className="text-[11px] text-slate-500 mt-1.5 font-mono tabular-nums">
                Karton: {trimmedCarton || '—'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
