import React, { useMemo } from 'react';

// Standard ISO/IEC 15417 Code 128 bar/space width patterns (indices 0..106)
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

function encodeCode128B(rawValue: string): { bars: Array<{ x: number; w: number }>; totalWidth: number } {
  const sanitized = rawValue
    .trim()
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126;
    })
    .join('');

  if (!sanitized) {
    return { bars: [], totalWidth: 0 };
  }

  const startCode = 104; // Code B
  const codes: number[] = [startCode];
  let checksum = startCode;

  for (let i = 0; i < sanitized.length; i++) {
    const val = sanitized.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop

  const bars: Array<{ x: number; w: number }> = [];
  const quietZone = 10;
  let cursor = quietZone;

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let j = 0; j < pattern.length; j++) {
      const width = Number(pattern[j]);
      const isBar = j % 2 === 0;
      if (isBar) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width;
    }
  }

  return { bars, totalWidth: cursor + quietZone };
}

interface BarcodeSvgProps {
  value: string;
  height?: number;
  className?: string;
  showText?: boolean;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  height = 44,
  className = '',
  showText = true,
}) => {
  const { bars, totalWidth } = useMemo(() => encodeCode128B(value), [value]);

  if (!value.trim() || bars.length === 0) {
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 font-mono py-3 px-4 rounded ${className}`}
      >
        Barcode belum tersedia
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full max-w-[260px] h-auto bg-white"
        role="img"
        aria-label={`Barcode ${value}`}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={totalWidth} height={height} fill="#ffffff" />
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.w}
            height={height}
            fill="#0f172a"
          />
        ))}
      </svg>
      {showText && (
        <span className="mt-1 font-mono text-xs font-semibold tracking-wider text-slate-900 tabular-nums">
          {value.trim()}
        </span>
      )}
    </div>
  );
};
