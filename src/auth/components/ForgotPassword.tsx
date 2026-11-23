import React, { useRef, useState } from 'react';
import { Lock, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { Button, Input, Alert } from '../../shared/components';
import { ApiError, api } from '../../shared/services/api';
import { CaptchaField, type CaptchaHandle } from './CaptchaField';

/**
 * Forgot password, inside the sign-in card: 1) institute email (+ CAPTCHA) → a 6-digit code is emailed;
 * 2) the code and a new password. The server decides everything (who gets a code, how many tries, password rules,
 * no reuse of the last passwords) — see server/routes/passwordReset.routes.ts.
 */
export const ForgotPassword: React.FC<{ initialEmail: string; onDone: (message: string | null) => void }> = ({ initialEmail, onDone }) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const captchaRef = useRef<CaptchaHandle>(null);

  const fail = (err: unknown, fallback: string) => {
    const details = err instanceof ApiError ? err.details ?? {} : {};
    setErrors(details);
    setMessage(Object.keys(details).length ? null : { kind: 'error', text: err instanceof ApiError ? err.message : fallback });
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setErrors({}); setMessage(null);
    try {
      const reply = await api<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), captchaToken: captcha.token || undefined, captchaAnswer: captcha.answer || undefined },
      });
      setStep('code');
      setMessage({ kind: 'success', text: reply.message });
    } catch (err) {
      fail(err, 'Could not send the code right now. Please try again.');
    } finally {
      captchaRef.current?.reload();
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErrors({}); setMessage(null);
    try {
      const reply = await api<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), otp: otp.trim(), newPassword, confirmPassword },
      });
      onDone(reply.message);
    } catch (err) {
      fail(err, 'Could not reset the password right now. Please try again.');
      setNewPassword(''); setConfirmPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-900 tracking-tight">Reset password</h1>
        <button type="button" onClick={() => onDone(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </button>
      </div>

      {message && <Alert variant={message.kind} onDismiss={() => setMessage(null)}>{message.text}</Alert>}

      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <p className="text-xs text-slate-500">Enter your institute email. A 6-digit code will be sent to it.</p>
          <Input label="Email" type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address"
            leftIcon={Mail} maxLength={254} error={errors.email} required />
          <CaptchaField ref={captchaRef} onChange={setCaptcha} error={errors.captcha} disabled={busy} />
          <Button type="submit" variant="primary" size="md" fullWidth loading={busy} loadingText="Sending…">Send code</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4" noValidate>
          <Input label="Code from the email" name="otp" inputMode="numeric" autoComplete="one-time-code" value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code"
            leftIcon={KeyRound} maxLength={6} error={errors.otp} required />
          <Input label="New password" type="password" name="new-password" autoComplete="new-password" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" leftIcon={Lock} maxLength={1024}
            error={errors.newPassword} required />
          <Input label="Confirm new password" type="password" name="confirm-password" autoComplete="new-password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type the new password again" leftIcon={Lock} maxLength={1024}
            error={errors.confirmPassword} required />
          <p className="text-[11px] text-slate-500">You cannot use your current password or one of your last five.</p>
          <Button type="submit" variant="primary" size="md" fullWidth loading={busy} loadingText="Saving…">Reset password</Button>
          <button type="button" onClick={() => { setStep('email'); setMessage(null); setOtp(''); }}
            className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800">
            Did not get the code? Send a new one
          </button>
        </form>
      )}
    </>
  );
};
