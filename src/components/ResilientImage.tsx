import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { getMemorySessionToken } from '../utils/onedrive';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retriedWithHeader, setRetriedWithHeader] = useState<boolean>(false);

  useEffect(() => {
    setResolvedSrc(src);
    setHasError(false);
    setRetriedWithHeader(false);
  }, [src]);

  useEffect(() => {
    return () => {
      if (resolvedSrc.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedSrc);
      }
    };
  }, [resolvedSrc]);

  const handleImageError = async () => {
    const token = getMemorySessionToken();
    if (!retriedWithHeader && token && src.startsWith('/api/onedrive/photo/')) {
      setRetriedWithHeader(true);
      try {
        const resp = await fetch(src, {
          credentials: 'include',
          headers: { 'X-QC-Session': token },
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const objUrl = URL.createObjectURL(blob);
          setResolvedSrc(objUrl);
          return;
        }
      } catch {
        // Jatuh ke tampilan fallback
      }
    }
    setHasError(true);
  };

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400 text-xs ${className}`}
      >
        <ImageOff className="w-4 h-4" />
        <span className="text-[10px]">Foto tidak tersedia</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => void handleImageError()}
      className={className}
    />
  );
};
