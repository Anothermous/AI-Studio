import React, { useEffect, useMemo } from 'react';
import { Printer, X } from 'lucide-react';
import { getCategoryConfig, type QCInspectionRecord } from '../types/qc';
import { PrintableQcSheet } from './PrintableQcSheet';

interface PrintPreviewModalProps {
  records: QCInspectionRecord[];
  onClose: () => void;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPdfFileName(records: QCInspectionRecord[]): string {
  if (records.length === 0) return '';

  const categoryLabels = Array.from(
    new Set(records.map((rec) => getCategoryConfig(rec.productCategory).label))
  );

  if (records.length === 1) {
    const rec = records[0];
    const parts = [
      categoryLabels[0],
      rec.unitType?.trim(),
      rec.barcodeUnit?.trim(),
      rec.tagDate?.trim(),
    ].filter(Boolean);
    return sanitizeFileName(parts.join(' - '));
  }

  const categoryPart = categoryLabels.join(', ');
  const uniqueDates = Array.from(
    new Set(records.map((rec) => rec.tagDate?.trim()).filter(Boolean))
  );
  const dateSuffix = uniqueDates.length === 1 ? ` - ${uniqueDates[0]}` : '';

  return sanitizeFileName(
    `${categoryPart} - Finish Good QC (${records.length} Unit)${dateSuffix}`
  );
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  records,
  onClose,
}) => {
  const pdfFileName = useMemo(() => buildPdfFileName(records), [records]);

  useEffect(() => {
    if (!pdfFileName) return;
    const previousTitle = document.title;
    document.title = pdfFileName;
    return () => {
      document.title = previousTitle;
    };
  }, [pdfFileName]);

  if (records.length === 0) return null;

  const handlePrint = () => {
    if (pdfFileName) {
      document.title = pdfFileName;
    }
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 overflow-y-auto print:static print:bg-white print:overflow-visible"
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Cetak Tag & Bukti Kelengkapan Produk"
    >
      {/* Toolbar Pratinjau Cetak (disembunyikan saat print) */}
      <div className="no-print sticky top-0 z-10 bg-slate-900 text-white border-b border-slate-700 px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate">
            Pratinjau Cetak Laporan Finish Good QC ({records.length} Halaman Tag)
          </h2>
          <p className="text-xs text-slate-300 truncate">
            Menampilkan Nama QC, Barcode Terverifikasi, Tanggal di Tag, dan Foto Kelengkapan Produk.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-600 rounded-md text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Tutup</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Konten Dokumen A4 */}
      <div className="max-w-4xl mx-auto my-6 px-4 print:max-w-none print:my-0 print:px-0">
        <PrintableQcSheet records={records} />
      </div>
    </div>
  );
};
