export const DOCUMENT_NUMBER = 'WIE-QES-PR-QC-01/01';

export const QC_PRESET_INSPECTORS = [
  'Arif Kurniawan',
  'Nur Rohmat Kurniawan',
] as const;

export type ProductCategoryId =
  | 'tangki_swh'
  | 'kolektor_swh'
  | 'at_series'
  | 'electric_wh'
  | 'heat_pump'
  | 'tph';

export interface ChecklistItemDef {
  key: string;
  label: string;
}

export interface ProductCategoryConfig {
  id: ProductCategoryId;
  shortLabel: string;
  label: string;
  formTitle: string;
  typeFieldLabel: string;
  completenessTitle: string;
  unitTypes: readonly string[];
  checklistItems: readonly ChecklistItemDef[];
  photoSuggestions: readonly string[];
}

export const PRODUCT_CATEGORIES: readonly ProductCategoryConfig[] = [
  {
    id: 'tangki_swh',
    shortLabel: 'Tangki SWH',
    label: 'Tangki Solar Water Heater',
    formTitle: 'Form Finish Good Tangki Solar Water Heater',
    typeFieldLabel: '3. Type Unit',
    completenessTitle:
      '6. Kelengkapan Tangki SWH - Pipa Aksesoris Panas & Dingin - Long & Short Fixing Strap',
    unitTypes: [
      'ST100SR-02',
      'ST130SR-02',
      'ST130SR-SG',
      'ST150SR-02',
      'ST150LN-03',
      'ST180LN-03',
      'ST300LN-03',
    ],
    checklistItems: [
      { key: 'pipaPanas', label: 'Pipa Aksesoris Panas' },
      { key: 'pipaDingin', label: 'Pipa Aksesoris Dingin' },
      { key: 'fixingStrap', label: 'Long Fixing Strap & Short Fixing Strap' },
    ],
    photoSuggestions: [
      'Pipa Aksesoris Panas & Dingin',
      'Long & Short Fixing Strap',
      'Label Barcode Unit & Karton',
    ],
  },
  {
    id: 'kolektor_swh',
    shortLabel: 'Kolektor SWH',
    label: 'Kolektor Solar Water Heater (SC Series)',
    formTitle: 'Form Finish Good Kolektor Solar Water Heater',
    typeFieldLabel: '3. Type Unit',
    completenessTitle:
      '6. Kelengkapan Kolektor SWH - Neple Plug (Tipe A & C) dan Non Neple Plug (Tipe B)',
    unitTypes: [
      'SC165SA-02A',
      'SC165SA-02',
      'SC165SA-02 Signature',
      'SC200LA-02',
      'SC200LB-02',
    ],
    checklistItems: [
      { key: 'neplePlug', label: 'Neple Plug (Tipe A & C)' },
      { key: 'nonNeplePlug', label: 'Non Neple Plug (Tipe B)' },
    ],
    photoSuggestions: [
      'Neple Plug / Non Neple Plug',
      'Label Barcode Unit & Karton',
    ],
  },
  {
    id: 'at_series',
    shortLabel: 'Aircon WH',
    label: 'Aircon WH',
    formTitle: 'Form Finish Good Aircon WH',
    typeFieldLabel: '3. Type Produk',
    completenessTitle:
      '6. Kelengkapan Aircon WH - Safety Valve - Hex Nut - Tee Joint - Buku Manual dan Garansi',
    unitTypes: ['AT50FHS', 'AT100RHS', 'AT100RHD'],
    checklistItems: [
      { key: 'safetyValve', label: 'Safety Valve' },
      { key: 'hexNut', label: 'Hex Nut' },
      { key: 'teeJoint', label: 'Tee Joint' },
      { key: 'manualWarranty', label: 'Buku Manual dan Garansi' },
    ],
    photoSuggestions: [
      'Safety Valve, Hex Nut & Tee Joint',
      'Buku Manual dan Garansi',
      'Label Barcode Unit & Karton',
    ],
  },
  {
    id: 'electric_wh',
    shortLabel: 'Electric WH',
    label: 'Electric Water Heater',
    formTitle: 'Form Finish Good Electric Water Heater',
    typeFieldLabel: '3. Type Produk Electric Water Heater',
    completenessTitle:
      '6. Kelengkapan Electric WH - Braket dan Baut Fisher - Buku Manual dan Garansi',
    unitTypes: ['ET15BC01', 'ET30BC01'],
    checklistItems: [
      { key: 'braketBautFisher', label: 'Braket dan Baut Fisher' },
      { key: 'manualWarranty', label: 'Buku Manual dan Garansi' },
    ],
    photoSuggestions: [
      'Braket dan Baut Fisher',
      'Buku Manual dan Garansi',
      'Label Barcode Unit & Karton',
    ],
  },
  {
    id: 'heat_pump',
    shortLabel: 'Heat Pump',
    label: 'Heat Pump Water Heater',
    formTitle: 'Form Finish Good Heat Pump Water Heater',
    typeFieldLabel: '3. Type Unit',
    completenessTitle:
      '6. Kelengkapan Heat Pump - Buku Manual dan Garansi - Kelengkapan Bawaan Heatpump',
    unitTypes: [
      'HPR4-SC-01',
      'HPR6-SC-01',
      'HPR10-SC-01',
      'HPC20-BC-01',
      'HPC40-BC-01',
      'HPS6-SC-01',
      'HPS11-SC-01',
      'HPS15-SC-01',
    ],
    checklistItems: [
      { key: 'manualWarranty', label: 'Buku Manual dan Garansi' },
      { key: 'kelengkapanBawaan', label: 'Kelengkapan Bawaan Heatpump' },
    ],
    photoSuggestions: [
      'Buku Manual dan Garansi',
      'Kelengkapan Bawaan Heatpump',
      'Label Barcode Unit & Karton',
    ],
  },
  {
    id: 'tph',
    shortLabel: 'TPH',
    label: 'Produk TPH',
    formTitle: 'Form Finish Good Produk TPH',
    typeFieldLabel: '3. Type Unit TPH',
    completenessTitle:
      '6. Pemeriksaan Produk TPH (Non-ACC & Non-Buku) - Visual - Stiker Data - Barcode & Plat Nomor',
    unitTypes: ['PT300L', 'PT500L', 'PT500E'],
    checklistItems: [
      { key: 'visual', label: 'Visual Kondisi Fisik Unit' },
      { key: 'stikerData', label: 'Stiker Data Produk' },
      {
        key: 'barcodePlatStiker',
        label: 'Barcode, Plat Nomor & Stiker Data Produk',
      },
    ],
    photoSuggestions: [
      'Visual',
      'Stiker Data',
      'Barcode, Plat Nomor & Stiker Data Produk',
    ],
  },
] as const;

export function getCategoryConfig(
  categoryId?: ProductCategoryId
): ProductCategoryConfig {
  return (
    PRODUCT_CATEGORIES.find((c) => c.id === categoryId) ?? PRODUCT_CATEGORIES[0]
  );
}

export function isKolektorWithoutNeplePlug(unitType: string): boolean {
  const normalized = unitType.trim().toUpperCase();
  if (!normalized) return false;
  return /LB\b|LB-|KOLEKTOR\s*B\b/.test(normalized);
}

export function getChecklistItemsForUnit(
  categoryId: ProductCategoryId | undefined,
  _unitType: string
): readonly ChecklistItemDef[] {
  return getCategoryConfig(categoryId).checklistItems;
}

export function getPhotoSuggestionsForUnit(
  categoryId: ProductCategoryId | undefined,
  unitType: string
): readonly string[] {
  const config = getCategoryConfig(categoryId);
  if (config.id === 'kolektor_swh' && unitType) {
    return isKolektorWithoutNeplePlug(unitType)
      ? ['Non Neple Plug (Tipe B)', 'Label Barcode Unit & Karton']
      : ['Neple Plug (Tipe A & C)', 'Label Barcode Unit & Karton'];
  }
  return config.photoSuggestions;
}

export const UNIT_STATUSES = [
  'Barang OK',
  'Barang Pengganti',
  'Barang Dummy',
] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[number];

export interface QCPhoto {
  id: string;
  name: string;
  label: string;
  dataUrl: string;
  sizeBytes: number;
}

export interface QCInspectionRecord {
  id: string;
  docNumber: string;
  productCategory?: ProductCategoryId;
  qcOption: 'Arif Kurniawan' | 'Nur Rohmat Kurniawan' | 'Lainnya';
  qcName: string;
  barcodeUnit: string;
  barcodeCarton: string;
  barcodeVerified: boolean;
  unitType: string;
  unitStatus: UnitStatus;
  tagDate: string; // YYYY-MM-DD
  tagTime: string; // HH:mm
  checklist: Record<string, boolean>;
  photos: QCPhoto[];
  notes: string;
  createdAt: string;
}
