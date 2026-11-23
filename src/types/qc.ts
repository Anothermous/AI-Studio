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
  | 'heat_pump';

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
      '6. Komponen Pendukung Tangki - Manual & Warranty Books - Long Fixing Strap & Short Fixing Strap - Pipa Aksesoris Panas - Pipa Aksesoris Dingin',
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
      { key: 'komponenPendukung', label: 'Komponen Pendukung Tangki' },
      { key: 'manualWarranty', label: 'Manual & Warranty Books' },
      { key: 'fixingStrap', label: 'Long Fixing Strap & Short Fixing Strap' },
      { key: 'pipaPanas', label: 'Pipa Aksesoris Panas' },
      { key: 'pipaDingin', label: 'Pipa Aksesoris Dingin' },
    ],
    photoSuggestions: [
      'Kelengkapan Komponen Tangki',
      'Manual & Warranty Books',
      'Long & Short Fixing Strap',
      'Pipa Aksesoris Panas & Dingin',
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
      '6. Kelengkapan Kolektor - Manual & Warranty Books - Fitting & Aksesoris Pemasangan - Kemasan Karton',
    unitTypes: [
      'SC165SA-02A',
      'SC165SA-02',
      'SC165SA-02 Signature',
      'SC200LA-02',
      'SC200LB-02',
    ],
    checklistItems: [
      { key: 'unitKolektor', label: 'Unit Kolektor & Kondisi Kaca/Frame' },
      { key: 'manualWarranty', label: 'Manual & Warranty Books' },
      { key: 'fittingKolektor', label: 'Fitting & Nepel Sambungan' },
      { key: 'aksesorisPasang', label: 'Braket / Karet Seal & Aksesoris' },
      { key: 'kemasanKarton', label: 'Pelindung Sudut & Label Karton' },
    ],
    photoSuggestions: [
      'Kondisi Unit Kolektor & Kaca',
      'Manual & Warranty Books',
      'Fitting & Aksesoris Kolektor',
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
      '6. Kelengkapan Unit Aircon WH - Manual & Warranty Books - Braket & Aksesoris Pemasangan - Kemasan Karton',
    unitTypes: ['AT50FHS', 'AT100RHS', 'AT100RHD'],
    checklistItems: [
      { key: 'unitUtama', label: 'Unit Utama Aircon WH & Kondisi Fisik' },
      { key: 'manualWarranty', label: 'Manual & Warranty Books' },
      { key: 'braketBaut', label: 'Braket & Baut Pemasangan' },
      { key: 'aksesorisValve', label: 'Aksesoris Pipa & Safety Valve' },
      { key: 'kemasanKarton', label: 'Kemasan & Label Karton' },
    ],
    photoSuggestions: [
      'Kelengkapan Unit Aircon WH',
      'Manual & Warranty Books',
      'Aksesoris & Braket',
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
      '6. Kelengkapan Electric Water Heater - Manual & Warranty Books - Braket & Safety Valve - Kemasan Karton',
    unitTypes: ['ET15BC01', 'ET30BC01'],
    checklistItems: [
      { key: 'unitElectric', label: 'Unit Electric Water Heater & Kabel Power' },
      { key: 'manualWarranty', label: 'Manual & Warranty Books' },
      { key: 'braketDynabolt', label: 'Braket Dinding & Dynabolt' },
      { key: 'safetyValve', label: 'Safety Valve & Aksesoris' },
      { key: 'kemasanKarton', label: 'Kemasan & Label Karton' },
    ],
    photoSuggestions: [
      'Unit Electric Water Heater',
      'Manual & Warranty Books',
      'Safety Valve, Braket & Aksesoris',
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
      '6. Kelengkapan Heat Pump - Manual & Warranty Books - Controller & Drain Fitting - Kemasan Karton',
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
      { key: 'unitHeatPump', label: 'Unit Heat Pump & Kondisi Casing/Sirip' },
      { key: 'manualWarranty', label: 'Manual & Warranty Books' },
      { key: 'controllerKabel', label: 'Controller / Kabel Sensor' },
      { key: 'drainFitting', label: 'Drain Fitting & Karet Dudukan' },
      { key: 'kemasanKarton', label: 'Kemasan & Label Karton' },
    ],
    photoSuggestions: [
      'Kelengkapan Unit Heat Pump',
      'Manual & Warranty Books',
      'Controller & Drain Fitting',
      'Label Barcode Unit & Karton',
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
