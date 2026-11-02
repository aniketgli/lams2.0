import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSession } from '../SessionContext';
import { WIILogo } from '../../shared/components/WIILogo';
import { Button, Input, Alert } from '../../shared/components';
import { ApiError } from '../../shared/services/api';
import { formatOrgAddress } from '../../types';
import { Lock, Mail, ArrowRight, MapPin } from 'lucide-react';
import { CaptchaField, type CaptchaHandle } from '../components/CaptchaField';

/** Shown until the server's list arrives; the server's list is what is enforced. */

/**
 * Sign in with an institute email. The server decides everything (allowed
 * domains, active account, validity date, password, lockout); this form only
 * catches obvious mistakes early so the user gets a clear message.
 */
export const LoginPage: React.FC = () => {
  const { orgBranding } = useApp();
  const { login, notice } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(notice);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [captchaError, setCaptchaError] = useState<string | undefined>();
  const captchaRef = useRef<CaptchaHandle>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setEmailError(undefined);
    setCaptchaError(undefined);
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password, captcha.token ? captcha : undefined);
    } catch (err) {
      const emailProblem = err instanceof ApiError ? err.details?.email : undefined;
      const captchaProblem = err instanceof ApiError ? err.details?.captcha : undefined;
      if (emailProblem) setEmailError(emailProblem);
      if (captchaProblem) setCaptchaError(captchaProblem);
      setError(err instanceof ApiError && !emailProblem && !captchaProblem ? err.message : emailProblem || captchaProblem ? null : 'Unable to sign in right now. Please try again.');
      setPassword('');
      captchaRef.current?.reload(); // a picture can be checked only once
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

            <CaptchaField ref={captchaRef} onChange={setCaptcha} error={captchaError} disabled={submitting} />

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
              <MapPin className="w-3 h-3 text-brand shrink-0" aria-hidden="true" />
              <span>{formatOrgAddress(orgBranding)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
