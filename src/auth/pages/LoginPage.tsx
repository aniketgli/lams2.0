import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSession } from '../SessionContext';
import { WIILogo } from '../../shared/components/WIILogo';
import { Button, Input, Alert } from '../../shared/components';
import { ApiError, api } from '../../shared/services/api';
import { formatOrgAddress } from '../../types';
import { Lock, Mail, ArrowRight, MapPin } from 'lucide-react';

/** Shown until the server's list arrives; the server's list is what is enforced. */
const DEFAULT_DOMAINS = ['wii.gov.in', 'edu.wii.gov.in'];

/**
 * Sign in with an institute email. The server decides everything (allowed
 * domains, active account, validity date, password, lockout); this form only
 * catches obvious mistakes early so the user gets a clear message.
 */
export const LoginPage: React.FC = () => {
  const { orgBranding } = useApp();
  const { login, notice } = useSession();
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(notice);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ emailDomains?: string[] }>('/auth/config')
      .then((config) => {
        if (active && Array.isArray(config.emailDomains) && config.emailDomains.length > 0) setDomains(config.emailDomains);
      })
      .catch(() => { /* keep defaults */ });
    return () => { active = false; };
  }, []);

  const domainText = domains.map((d) => `@${d}`).join(' or ');

  const checkEmail = (value: string): string | undefined => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return 'Enter your institute email.';
    const at = trimmed.lastIndexOf('@');
    const domain = at > 0 ? trimmed.slice(at + 1) : '';
    if (!domains.includes(domain)) return `Use your institute email (${domainText}).`;
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const problem = checkEmail(email);
    setEmailError(problem);
    if (problem) return;
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
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
          </div>

          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(undefined);
              }}
              onBlur={() => email.trim() && setEmailError(checkEmail(email))}
              placeholder="Enter your email address"
              leftIcon={Mail}
              maxLength={254}
              error={emailError}
              required
            />

            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
