import React, { useEffect, useState } from 'react';

/**
 * A person's photo, or their initials when there is no photo or it fails to load.
 * Use this everywhere a user's picture appears, never a bare <img>.
 *
 *   <UserAvatar name="Aniket Gupta" src={user.avatar} className="w-10 h-10 rounded-full" />
 *
 * `className` sets size, shape and any ring/border; the initials scale with the width class.
 */
export interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  className?: string;
}

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'shri', 'smt', 'km']);

export function initialsOf(name?: string | null): string {
  const words = String(name ?? '')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w && !TITLES.has(w.toLowerCase()));
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Initials font size that fits the avatar, read from its Tailwind width class (w-7, w-10, ...). */
function fontSizeFor(className: string): string {
  const match = className.match(/(?:^|\s)w-(\d+(?:\.\d+)?)(?:\s|$)/);
  const width = match ? Number(match[1]) * 4 : 32; // Tailwind spacing unit = 4px
  return `${Math.max(8, Math.round(width * 0.38))}px`;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ name, src, className = 'w-8 h-8 rounded-full' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const label = name?.trim() || 'User';
  if (src && src.trim() && !failed) {
    return (
      <img
        src={src}
        alt={label}
        onError={() => setFailed(true)}
        className={`${className} object-cover shrink-0`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={`${className} shrink-0 inline-flex items-center justify-center bg-[#701618] text-white font-bold leading-none select-none`}
      style={{ fontSize: fontSizeFor(className) }}
    >
      {initialsOf(name)}
    </span>
  );
};
