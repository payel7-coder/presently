import React, { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-14 h-14 text-base',
};

const PALETTES = [
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-slate-100 text-slate-700 border-slate-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-sky-50 text-sky-700 border-sky-200',
];

function getInitials(name: string): string {
  const parts = name
    .replace(/^(engr\.|dr\.|prof\.|mr\.|ms\.|mrs\.)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  // Skip generic stock unsplash placeholders so clean initials render reliably without network dependency
  const isStockPlaceholder = !src || src.includes('images.unsplash.com');

  if (!isStockPlaceholder && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-lg object-cover border border-slate-200 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} ${getPalette(name)} rounded-lg border font-semibold flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};
