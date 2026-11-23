import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { getCategoryConfig, type QCInspectionRecord } from '../types/qc';
import { formatIndonesianDate } from '../utils/storage';
import { normalizeBarcodeCore } from '../utils/barcode';
import { BarcodeSvg } from './BarcodeSvg';
import { ResilientImage } from './ResilientImage';

interface PrintableQcSheetProps {
  records: QCInspectionRecord[];
}

export const PrintableQcSheet: React.FC<PrintableQcSheetProps> = ({ records }) => {
  if (records.length === 0) {
    return null;
  }

  return (
    <div className="print-container space-y-8">
      {records.map((record) => {
        const category = getCategoryConfig(record.productCategory);
        const photoGridClass =
          record.photos.length === 1
            ? 'grid-cols-1 max-w-md'
            : record.photos.length <= 4
              ? 'grid-cols-2'
              : 'grid-cols-3';

        return (
          <article
            key={record.id}
            className="print-record-page bg-white border border-slate-300 text-slate-900 p-6 md:p-8 print:border-slate-800 print:p-5"
          >
            {/* Header Dokumen Resmi */}
            <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
              <div>
                <p className="text-xs font-medium text-slate-600 tracking-wide">
                  Quality Control Finish Good · {category.label}
                </p>
                <h1 className="text-xl font-bold tracking-tight text-slate-950 mt-0.5">
                  {category.formTitle}
                </h1>
                <p className="text-xs font-mono text-slate-700 mt-1 tabular-nums">
                  No. Dokumen: {record.docNumber} · Tag ID: {record.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="sm:text-right shrink-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-emerald-700 bg-emerald-50 text-emerald-900 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>BARCODE TERVERIFIKASI COCOK</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
                  Tanggal di Tag: {formatIndonesianDate(record.tagDate)} · {record.tagTime}
                </p>
              </div>
            </header>

            {/* Informasi Utama Tag QC & Barcode Ganda */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-5 py-4 border-b border-slate-300">
              <div className="md:col-span-7 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="block text-xs text-slate-500">Quality Control Checked</span>
                  <span className="font-semibold text-slate-950">{record.qcName}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Tanggal di Tag QC</span>
                  <span className="font-semibold text-slate-950 tabular-nums">
                    {formatIndonesianDate(record.tagDate)} ({record.tagTime})
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Type Unit</span>
                  <span className="font-mono font-semibold text-slate-950 tabular-nums">
                    {record.unitType}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Status Unit</span>
                  <span className="font-semibold text-slate-950">{record.unitStatus}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Nomor Barcode 1 (Unit / Tangki)</span>
                  <span className="font-mono font-bold text-slate-950 tracking-wide tabular-nums">
                    {record.barcodeUnit}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Nomor Barcode 2 (Karton)</span>
                  <span className="font-mono font-bold text-slate-950 tracking-wide tabular-nums">
                    {record.barcodeCarton}
                  </span>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col items-center justify-center border border-slate-200 bg-slate-50/50 p-3 print:bg-white print:border-slate-400">
                <span className="text-[11px] font-medium text-slate-600 mb-1.5 text-center">
                  {record.barcodeUnit.toUpperCase() === record.barcodeCarton.toUpperCase()
                    ? 'Barcode Unit & Karton (Terverifikasi Sama)'
                    : `Terverifikasi Sama (Nomor Inti: ${normalizeBarcodeCore(record.barcodeUnit)})`}
                </span>
                <BarcodeSvg value={record.barcodeUnit} height={46} />
              </div>
            </section>

            {/* Checklist Komponen Pendukung */}
            <section className="py-3.5 border-b border-slate-300">
              <h2 className="text-xs font-bold text-slate-800 tracking-wide mb-2">
                Pemeriksaan Kelengkapan Komponen Produk ({category.shortLabel})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                {category.checklistItems.map((item) => {
                  const checked = Boolean(record.checklist[item.key]);
                  return (
                    <div key={item.key} className="flex items-center gap-2 text-slate-800">
                      <span
                        className={`inline-flex items-center justify-center w-3.5 h-3.5 border text-[10px] font-bold shrink-0 ${
                          checked
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-400 bg-white text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className={checked ? 'font-medium text-slate-900' : 'text-slate-500'}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {record.notes.trim() && (
                <p className="mt-2.5 text-xs text-slate-700 border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Catatan QC: </span>
                  {record.notes}
                </p>
              )}
            </section>

            {/* Bukti Foto Kelengkapan Produk */}
            <section className="py-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-800 tracking-wide">
                  Bukti Foto Kelengkapan Produk ({record.photos.length} Lampiran)
                </h2>
                <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                  Barcode: {record.barcodeUnit}
                </span>
              </div>

              {record.photos.length === 0 ? (
                <div className="border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  Tidak ada foto terlampir.
                </div>
              ) : (
                <div className={`grid ${photoGridClass} gap-3`}>
                  {record.photos.map((photo, index) => (
                    <figure
                      key={photo.id}
                      className="border border-slate-300 bg-white overflow-hidden break-inside-avoid"
                    >
                      <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
                        <ResilientImage
                          src={photo.dataUrl}
                          alt={photo.label || `Bukti Kelengkapan ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <figcaption className="px-2.5 py-1.5 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px] bg-slate-50 print:bg-white">
                        <span className="font-medium text-slate-800 truncate">
                          {index + 1}. {photo.label || 'Foto Kelengkapan'}
                        </span>
                        <span className="font-mono text-slate-500 shrink-0 tabular-nums">
                          {record.tagDate}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>

            {/* Footer Tanda Tangan / Paraf */}
            <footer className="pt-4 mt-2 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-700">
              <div className="flex flex-col justify-between min-h-[88px]">
                <p className="text-slate-600 leading-snug">
                  Diperiksa Quality Control Inspection
                </p>
                <p className="font-semibold text-slate-900 border-t border-slate-400 pt-1 mt-8">
                  {record.qcName}
                </p>
              </div>
              <div className="flex flex-col justify-between min-h-[88px]">
                <p className="text-slate-600 leading-snug">
                  Verifikasi Koordinator Quality Control
                </p>
                <p className="font-medium text-slate-900 border-t border-slate-400 pt-1 mt-8">
                  Koordinator Quality Control
                </p>
              </div>
              <div className="flex flex-col justify-between min-h-[88px]">
                <p className="text-slate-600 leading-snug">
                  Pengesahan Manager Quality Control
                </p>
                <p className="font-medium text-slate-900 border-t border-slate-400 pt-1 mt-8">
                  Manager Quality Control
                </p>
              </div>
            </footer>
          </article>
        );
      })}
    </div>
  );
};
