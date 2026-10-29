import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSession } from '../SessionContext';
import { WIILogo } from '../../shared/components/WIILogo';
import { Button, Input, Alert } from '../../shared/components';
import { ApiError } from '../../shared/services/api';
import { formatOrgAddress } from '../../types';
import { Lock, User, ArrowRight, MapPin } from 'lucide-react';

/**
 * Sign in with biometric ID or institute email. All checks (active account,
 * validity date, password, lockout after repeated failures) happen on the server;
 * this form only makes sure both fields are filled in.
 */
export const LoginPage: React.FC = () => {
  const { orgBranding } = useApp();
  const { login, notice } = useSession();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(notice);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!userId.trim() || !password) {
      setError('Enter your biometric ID or email, and your password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(userId.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in right now. Please try again.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center select-none">
          <WIILogo variant="horizontal" size="md" align="center" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-100 pb-3.5">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Sign in</h1>
            <p className="text-xs text-slate-500 mt-1">Use your biometric ID or institute email.</p>
          </div>

          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Biometric ID or email"
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. 1024 or name@wii.gov.in"
              leftIcon={User}
              maxLength={255}
              required
            />

            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={Lock}
              maxLength={1024}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              loading={submitting}
              loadingText="Signing in…"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign in
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500 pt-2">
            <span className="font-bold text-slate-700">Forgot password?</span> Contact your administrator.
          </p>
        </div>

        <div className="pt-2 text-[11px] text-center text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">
            {orgBranding?.copyrightText || `© ${new Date().getFullYear()} ${orgBranding?.orgName || 'Wildlife Institute of India'}`}
          </p>
          {formatOrgAddress(orgBranding) && (
            <p className="flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 text-[#701618] shrink-0" aria-hidden="true" />
              <span>{formatOrgAddress(orgBranding)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
