import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSession } from '../SessionContext';
import { WIILogo } from '../../shared/components/WIILogo';
import { Alert, Button, Input } from '../../shared/components';
import { ApiError } from '../../shared/services/api';
import { navigate } from '../../shared/router';
import { formatOrgAddress } from '../../types';
import { ArrowLeft, ArrowRight, Check, KeyRound, Lock, MapPin, ShieldCheck } from 'lucide-react';

/** Same rules the server applies; shown here only as a checklist while typing. */
const RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'At least one letter', test: (pw) => /\p{L}/u.test(pw) },
  { label: 'At least one number', test: (pw) => /\d/.test(pw) },
];

type FieldErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>;

/**
 * Set your own password.
 *   first   (new or reactivated account, signed in with the default password): shown once before the lobby. It can be
 *           skipped, and the password changed later from the lobby.
 *   !first  (from the lobby): the same page, with a way back.
 */
export const ChangePasswordPage: React.FC<{ first: boolean }> = ({ first }) => {
  const { orgBranding } = useApp();
  const { session, changePassword, skipPasswordChange, logout: signOut } = useSession();
  // Fixed system accounts (Administrator / Auditor) cannot skip: the server refuses everything else until they do.
  const mustSet = Boolean(session?.passwordChangeRequired);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setDone(null);
    setErrors({});

    setSaving(true);
    try {
      await changePassword(current, next, confirm);
      setCurrent('');
      setNext('');
      setConfirm('');
      if (first) navigate('/lobby', { replace: true });
      else setDone('Your password has been changed. You were signed out on other devices.');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors((err.details ?? {}) as FieldErrors);
        setError(err.details && Object.keys(err.details).length ? null : err.message);
      } else {
        setError('Unable to change the password right now. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      await skipPasswordChange();
      navigate('/lobby', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to continue right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center select-none">
          <WIILogo variant="horizontal" size="md" align="center" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-100 pb-3.5 flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <KeyRound className="w-4.5 h-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                {first ? 'Set your own password' : 'Change password'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {session?.user.name} · {session?.user.email}
              </p>
            </div>
          </div>

          {first && (
            <Alert variant="info">
              {mustSet
                ? 'You signed in with the default password. Choose your own password to continue.'
                : 'You signed in with the default password. You can choose your own password now, or skip and change it later from the lobby.'}
            </Alert>
          )}
          {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
          {done && <Alert variant="success" onDismiss={() => setDone(null)}>{done}</Alert>}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <input type="text" name="username" autoComplete="username" value={session?.user.email ?? ''} readOnly hidden />
            <Input
              label={first ? 'Default password' : 'Current password'}
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => { setCurrent(e.target.value); setErrors((x) => ({ ...x, currentPassword: undefined })); }}
              leftIcon={Lock}
              maxLength={128}
              error={errors.currentPassword}
              required
            />
            <Input
              label="New password"
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => { setNext(e.target.value); setErrors((x) => ({ ...x, newPassword: undefined })); }}
              leftIcon={ShieldCheck}
              maxLength={128}
              error={errors.newPassword}
              required
            />
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px]" aria-label="Password rules">
              {RULES.map((rule) => {
                const ok = rule.test(next);
                return (
                  <li key={rule.label} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      {ok && <Check className="w-2.5 h-2.5" aria-hidden="true" />}
                    </span>
                    {rule.label}
                  </li>
                );
              })}
            </ul>
            <Input
              label="Confirm new password"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setErrors((x) => ({ ...x, confirmPassword: undefined })); }}
              leftIcon={ShieldCheck}
              maxLength={128}
              error={errors.confirmPassword}
              required
            />

            <Button type="submit" variant="primary" size="md" fullWidth loading={saving} loadingText="Saving…">
              {first ? 'Save password and continue' : 'Change password'}
            </Button>
          </form>

          <div className="pt-1 flex justify-center">
            {first && mustSet ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary cursor-pointer"
              >
                Sign out
              </button>
            ) : first ? (
              <button
                type="button"
                onClick={() => void skip()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary cursor-pointer disabled:opacity-60"
              >
                Skip for now <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/lobby')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to lobby
              </button>
            )}
          </div>
        </div>

        <div className="pt-2 text-[11px] text-center text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">
            {orgBranding?.copyrightText || `© ${new Date().getFullYear()} ${orgBranding?.orgName || 'Wildlife Institute of India'}`}
          </p>
          {formatOrgAddress(orgBranding) && (
            <p className="flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-brand shrink-0" aria-hidden="true" />
              <span>{formatOrgAddress(orgBranding)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
