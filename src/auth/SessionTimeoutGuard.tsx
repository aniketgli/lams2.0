import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useSession } from './SessionContext';

const WARN_BEFORE_IDLE_MS = 60_000;
const WARN_BEFORE_EXPIRY_MS = 5 * 60_000;

/**
 * Signs the user out after inactivity, with a one-minute warning, and warns
 * before the session reaches its maximum length. The server enforces both
 * limits on its own; this only makes sure the user sees it coming and that the
 * screen is cleared on time.
 */
export const SessionTimeoutGuard: React.FC = () => {
  const { session, getLastActivity, idleLimitMs, stayActive, logout } = useSession();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const loggingOut = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const idleFor = now - getLastActivity();
  const idleLeftMs = idleLimitMs - idleFor;
  const expiresAt = session ? Date.parse(session.limits.expiresAt) : NaN;
  const expiryLeftMs = Number.isFinite(expiresAt) ? expiresAt - now : Infinity;

  useEffect(() => {
    if (loggingOut.current) return;
    if (idleLeftMs <= 0) {
      loggingOut.current = true;
      void logout(`You were signed out after ${Math.round((session?.limits.idleSeconds ?? 900) / 60)} minutes of inactivity.`);
    } else if (expiryLeftMs <= 0) {
      loggingOut.current = true;
      void logout('Your session has reached its time limit. Please sign in again.');
    }
  }, [idleLeftMs, expiryLeftMs, logout, session]);

  const showIdleWarning = idleLeftMs > 0 && idleLeftMs <= WARN_BEFORE_IDLE_MS;
  const showExpiryNotice = !showIdleWarning && expiryLeftMs > 0 && expiryLeftMs <= WARN_BEFORE_EXPIRY_MS;

  if (showIdleWarning) {
    const seconds = Math.ceil(idleLeftMs / 1000);
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 id="idle-title" className="text-sm font-bold text-slate-900">Are you still there?</h2>
          </div>
          <p id="idle-desc" className="text-xs text-slate-600 leading-relaxed">
            For security, you will be signed out in <strong className="text-slate-900 tabular-nums">{seconds} seconds</strong> because there has been no activity.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => void logout(null)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Sign out now
            </button>
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await stayActive();
                } finally {
                  setBusy(false);
                }
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-brand hover:bg-brand-hover disabled:opacity-60 cursor-pointer"
            >
              Stay signed in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showExpiryNotice) {
    const minutes = Math.max(1, Math.ceil(expiryLeftMs / 60_000));
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)] bg-amber-50 border border-amber-200 text-amber-900 rounded-xl shadow-lg px-4 py-3 text-xs" role="status">
        Your session ends in about {minutes} minute{minutes === 1 ? '' : 's'}. Save your work; you will need to sign in again.
      </div>
    );
  }

  return null;
};
