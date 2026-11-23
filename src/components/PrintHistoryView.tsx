import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  FilePlus2,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  getCategoryConfig,
  type ProductCategoryId,
  type QCInspectionRecord,
} from '../types/qc';
import { formatIndonesianDate, getTodayDateInput } from '../utils/storage';
import { normalizeBarcodeCore } from '../utils/barcode';
import { ResilientImage } from './ResilientImage';

interface PrintHistoryViewProps {
  records: QCInspectionRecord[];
  activeCategory: ProductCategoryId;
  onChangeCategory: (category: ProductCategoryId) => void;
  isLoading: boolean;
  onDeleteRecord: (id: string) => Promise<void>;
  onPrintRecords: (recordsToPrint: QCInspectionRecord[]) => void;
  onNavigateToForm: (category: ProductCategoryId) => void;
}

export const PrintHistoryView: React.FC<PrintHistoryViewProps> = ({
  records,
  activeCategory,
  onChangeCategory,
  isLoading,
  onDeleteRecord,
  onPrintRecords,
  onNavigateToForm,
}) => {
  const [filterQcName, setFilterQcName] = useState<string>('ALL');
  const [filterBarcode, setFilterBarcode] = useState<string>('');
  const [filterTagDate, setFilterTagDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeCategoryConfig = getCategoryConfig(activeCategory);

  const categoryCounts = useMemo(() => {
    const counts: Record<ProductCategoryId, number> = {
      tangki_swh: 0,
      kolektor_swh: 0,
      at_series: 0,
      electric_wh: 0,
      heat_pump: 0,
    };
    for (const rec of records) {
      const cat = rec.productCategory ?? 'tangki_swh';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [records]);

  const categoryRecords = useMemo(
    () =>
      records.filter(
        (rec) => (rec.productCategory ?? 'tangki_swh') === activeCategory
      ),
    [records, activeCategory]
  );

  const uniqueQcNames = useMemo(() => {
    const names = new Set<string>(['Arif Kurniawan', 'Nur Rohmat Kurniawan']);
    for (const rec of categoryRecords) {
      if (rec.qcName.trim()) {
        names.add(rec.qcName.trim());
      }
    }
    return Array.from(names);
  }, [categoryRecords]);

  const filteredRecords = useMemo(() => {
    const query = filterBarcode.trim().toLowerCase();
    return categoryRecords.filter((rec) => {
      if (filterQcName !== 'ALL' && rec.qcName !== filterQcName) {
        return false;
      }
      if (filterTagDate && rec.tagDate !== filterTagDate) {
        return false;
      }
      if (query) {
        const queryCore = normalizeBarcodeCore(filterBarcode).toLowerCase();
        const matchUnit = rec.barcodeUnit.toLowerCase().includes(query);
        const matchCarton = rec.barcodeCarton.toLowerCase().includes(query);
        const matchCore =
          queryCore.length > 0 &&
          normalizeBarcodeCore(rec.barcodeUnit).toLowerCase().includes(queryCore);
        if (!matchUnit && !matchCarton && !matchCore) {
          return false;
        }
      }
      return true;
    });
  }, [categoryRecords, filterQcName, filterBarcode, filterTagDate]);

  const selectedFilteredRecords = useMemo(
    () => filteredRecords.filter((rec) => selectedIds.has(rec.id)),
    [filteredRecords, selectedIds]
  );

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((rec) => selectedIds.has(rec.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const rec of filteredRecords) {
          next.delete(rec.id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const rec of filteredRecords) {
          next.add(rec.id);
        }
        return next;
      });
    }
  };

  const toggleRowSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilterQcName('ALL');
    setFilterBarcode('');
    setFilterTagDate('');
  };

  const handleConfirmDelete = async (id: string) => {
    await onDeleteRecord(id);
    setConfirmDeleteId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const hasActiveFilters =
    filterQcName !== 'ALL' || filterBarcode.trim() !== '' || filterTagDate !== '';

  return (
    <div className="space-y-5">
      {/* Tab Riwayat Terpisah per Kategori Produk */}
      <nav
        aria-label="Kategori Riwayat Produk"
        className="bg-white border border-slate-200 rounded-lg p-2 flex flex-wrap items-center gap-1.5"
      >
        {PRODUCT_CATEGORIES.map((cat) => {
          const active = cat.id === activeCategory;
          const count = categoryCounts[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onChangeCategory(cat.id);
                setSelectedIds(new Set());
                setConfirmDeleteId(null);
              }}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                active
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{cat.shortLabel}</span>
              <span
                className={`font-mono tabular-nums ${
                  active ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </nav>

      {/* Filter Bar: Nama QC, Nomor Barcode, Tanggal di Tag */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-lg font-bold text-slate-950 tracking-tight">
              Riwayat {activeCategoryConfig.label}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Filter laporan {activeCategoryConfig.shortLabel} berdasarkan Nama QC, Nomor Barcode, dan Tanggal di Tag sebelum mencetak.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedFilteredRecords.length > 0 ? (
              <button
                type="button"
                onClick={() => onPrintRecords(selectedFilteredRecords)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Terpilih ({selectedFilteredRecords.length})</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={filteredRecords.length === 0}
                onClick={() => onPrintRecords(filteredRecords)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Hasil Filter ({filteredRecords.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4">
          {/* Filter Nama QC */}
          <div className="md:col-span-4">
            <label
              htmlFor="filter-qc"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Nama QC
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="filter-qc"
                value={filterQcName}
                onChange={(e) => setFilterQcName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="ALL">Semua Nama QC</option>
                {uniqueQcNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Nomor Barcode */}
          <div className="md:col-span-4">
            <label
              htmlFor="filter-barcode"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Nomor Barcode (Tangki / Karton)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="filter-barcode"
                type="text"
                value={filterBarcode}
                onChange={(e) => setFilterBarcode(e.target.value)}
                placeholder="Cari nomor barcode..."
                className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 tabular-nums"
              />
            </div>
          </div>

          {/* Filter Tanggal di Tag */}
          <div className="md:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="filter-tag-date"
                className="block text-xs font-medium text-slate-700"
              >
                Tanggal di Tag
              </label>
              <button
                type="button"
                onClick={() => setFilterTagDate(getTodayDateInput())}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                Hari Ini
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="filter-tag-date"
                  type="date"
                  value={filterTagDate}
                  onChange={(e) => setFilterTagDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 tabular-nums"
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="Reset filter"
                  className="inline-flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Metadata ringkasan unboxed */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 tabular-nums">
            <span>
              Menampilkan <strong className="text-slate-900">{filteredRecords.length}</strong> dari{' '}
              <strong className="text-slate-900">{categoryRecords.length}</strong> data{' '}
              {activeCategoryConfig.shortLabel}
            </span>
            {filterQcName !== 'ALL' && (
              <>
                <span aria-hidden="true">·</span>
                <span>QC: {filterQcName}</span>
              </>
            )}
            {filterTagDate && (
              <>
                <span aria-hidden="true">·</span>
                <span>Tanggal Tag: {formatIndonesianDate(filterTagDate)}</span>
              </>
            )}
          </div>
          {selectedFilteredRecords.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batalkan pilihan ({selectedFilteredRecords.length})
            </button>
          )}
        </div>
      </section>

      {/* Tabel Data Inspeksi */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-12 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : categoryRecords.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-base font-bold text-slate-900">
              Belum Ada Data Inspeksi {activeCategoryConfig.label}
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Setiap unit {activeCategoryConfig.shortLabel} yang lolos verifikasi barcode ganda dan foto kelengkapan akan tersimpan terpisah di tab ini.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToForm(activeCategory)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-md hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Input {activeCategoryConfig.shortLabel} Sekarang</span>
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-sm font-bold text-slate-900">
              Tidak Ada Data yang Sesuai Filter
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Coba ubah filter Nama QC, Nomor Barcode, atau Tanggal di Tag.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      aria-label="Pilih semua data terfilter"
                      className="accent-blue-700 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">Tanggal di Tag</th>
                  <th className="py-3 px-3 whitespace-nowrap">Nama QC</th>
                  <th className="py-3 px-3 whitespace-nowrap">Nomor Barcode (Unit &amp; Karton)</th>
                  <th className="py-3 px-3 whitespace-nowrap">Type &amp; Status Unit</th>
                  <th className="py-3 px-3 whitespace-nowrap">Bukti Foto Kelengkapan</th>
                  <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRecords.map((rec) => {
                  const isSelected = selectedIds.has(rec.id);
                  const isConfirmingDelete = confirmDeleteId === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelect(rec.id)}
                          aria-label={`Pilih barcode ${rec.barcodeUnit}`}
                          className="accent-blue-700 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 align-middle whitespace-nowrap font-mono tabular-nums text-slate-800">
                        <div className="font-medium text-slate-900">{rec.tagDate}</div>
                        <div className="text-[11px] text-slate-500">{rec.tagTime}</div>
                      </td>
                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{rec.qcName}</span>
                      </td>
                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-950 tabular-nums">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>{rec.barcodeUnit}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums pl-5">
                          Karton: {rec.barcodeCarton}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">
                          {rec.unitType}
                        </div>
                        <div className="text-[11px] text-slate-600">{rec.unitStatus}</div>
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {rec.photos.slice(0, 3).map((photo) => (
                              <ResilientImage
                                key={photo.id}
                                src={photo.dataUrl}
                                alt={photo.label}
                                className="w-9 h-9 object-cover border border-slate-200 rounded bg-slate-100 shrink-0"
                              />
                            ))}
                          </div>
                          <span className="font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                            {rec.photos.length} foto
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pl-3 pr-4 align-middle text-right whitespace-nowrap">
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleConfirmDelete(rec.id)}
                              className="px-2.5 py-1.5 bg-red-600 text-white text-[11px] font-semibold rounded hover:bg-red-700 cursor-pointer"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 border border-slate-300 text-slate-700 text-[11px] font-medium rounded hover:bg-slate-100 cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onPrintRecords([rec])}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-semibold rounded hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Preview &amp; Cetak</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(rec.id)}
                              aria-label={`Hapus data ${rec.barcodeUnit}`}
                              className="p-1.5 border border-slate-200 rounded text-slate-500 hover:text-red-700 hover:border-red-300 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
