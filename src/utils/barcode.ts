export interface BarcodeVerificationResult {
  hasBoth: boolean;
  isMatch: boolean;
  matchType: 'empty' | 'exact' | 'normalized_abcd' | 'mismatch';
  unitRaw: string;
  cartonRaw: string;
  unitCore: string;
  cartonCore: string;
}

/**
 * Menormalkan nomor barcode dengan mengabaikan kode huruf A/B/C/D di awal
 * (sebelum angka) atau di akhir (setelah angka), misal:
 * A21426270037B & A21426270037D -> core sama: 21426270037.
 */
export function normalizeBarcodeCore(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return '';

  // Hanya terapkan normalisasi kode A/B/C/D jika barcode mengandung angka
  if (!/\d/.test(cleaned)) {
    return cleaned;
  }

  return cleaned
    .replace(/^[A-D](?=\d)/, '')
    .replace(/(\d)[A-D]$/, '$1');
}

export function verifyBarcodesMatch(
  barcodeUnit: string,
  barcodeCarton: string
): BarcodeVerificationResult {
  const unitRaw = barcodeUnit.trim();
  const cartonRaw = barcodeCarton.trim();

  if (!unitRaw || !cartonRaw) {
    return {
      hasBoth: false,
      isMatch: false,
      matchType: 'empty',
      unitRaw,
      cartonRaw,
      unitCore: normalizeBarcodeCore(unitRaw),
      cartonCore: normalizeBarcodeCore(cartonRaw),
    };
  }

  const unitUpper = unitRaw.toUpperCase();
  const cartonUpper = cartonRaw.toUpperCase();

  if (unitUpper === cartonUpper) {
    return {
      hasBoth: true,
      isMatch: true,
      matchType: 'exact',
      unitRaw,
      cartonRaw,
      unitCore: normalizeBarcodeCore(unitRaw),
      cartonCore: normalizeBarcodeCore(cartonRaw),
    };
  }

  const unitCore = normalizeBarcodeCore(unitRaw);
  const cartonCore = normalizeBarcodeCore(cartonRaw);

  if (unitCore.length > 0 && unitCore === cartonCore) {
    return {
      hasBoth: true,
      isMatch: true,
      matchType: 'normalized_abcd',
      unitRaw,
      cartonRaw,
      unitCore,
      cartonCore,
    };
  }

  return {
    hasBoth: true,
    isMatch: false,
    matchType: 'mismatch',
    unitRaw,
    cartonRaw,
    unitCore,
    cartonCore,
  };
}
