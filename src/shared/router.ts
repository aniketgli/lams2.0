import { useSyncExternalStore } from 'react';

/**
 * Minimal History-API router. The URL only says which screen to show; it never
 * grants access. App.tsx resolves every URL against the server session and
 * redirects anything the user may not open (see resolveRoute in App.tsx).
 */

const NAVIGATE_EVENT = 'wii:navigate';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

const getPath = () => normalizePath(window.location.pathname);

export function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed.toLowerCase();
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath, getPath);
}

export function navigate(path: string, { replace = false } = {}) {
  const target = normalizePath(path);
  if (target === getPath()) return;
  if (replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}
