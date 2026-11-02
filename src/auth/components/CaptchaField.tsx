import React, { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../shared/services/api';

interface CaptchaReply { required: boolean; token?: string; image?: string }

export interface CaptchaHandle {
  /** Fetches a new picture and clears what was typed (call after every sign-in attempt: a picture works once). */
  reload: () => void;
}

interface Props {
  /** The signed token for the current picture and the characters typed; token is '' while no picture is loaded. */
  onChange: (value: { token: string; answer: string }) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * The sign-in verification picture. The server draws it and checks the answer; nothing here can decide
 * whether the answer is right. When the server says no CAPTCHA is needed the field renders nothing.
 */
export const CaptchaField = forwardRef<CaptchaHandle, Props>(function CaptchaField({ onChange, error, disabled }, ref) {
  const [picture, setPicture] = useState<CaptchaReply | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setFailed(null); setAnswer('');
    try {
      const reply = await api<CaptchaReply>('/auth/captcha');
      setPicture(reply);
      onChange({ token: reply.token ?? '', answer: '' });
    } catch (e) {
      setPicture(null);
      setFailed(e instanceof Error ? e.message : 'The verification picture could not be loaded.');
      onChange({ token: '', answer: '' });
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => { void load(); }, [load]);
  useImperativeHandle(ref, () => ({ reload: () => { void load(); } }), [load]);

  if (picture && !picture.required) return null;

  return (
    <div className="space-y-1.5">
      <label htmlFor="captcha-answer" className="block text-xs font-bold text-slate-700">Verification</label>
      <div className="flex items-center gap-2">
        <div className="h-16 w-[190px] shrink-0 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
          {picture?.image
            ? <img src={picture.image} alt="Characters to type" width={190} height={64} draggable={false} className="select-none" />
            : <span className="text-[11px] text-slate-400">{loading ? 'Loading…' : 'Not loaded'}</span>}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={disabled || loading}
          aria-label="Show another picture"
          title="Show another picture"
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="relative">
        <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          id="captcha-answer"
          name="captcha"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          value={answer}
          disabled={disabled}
          onChange={(e) => { setAnswer(e.target.value); onChange({ token: picture?.token ?? '', answer: e.target.value }); }}
          placeholder="Enter the characters shown"
          className={`w-full h-10 rounded-xl border pl-9 pr-3 text-sm tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/30 ${error ? 'border-red-400' : 'border-slate-200'}`}
        />
      </div>
      {(error || failed) && <p className="text-[11px] font-semibold text-red-600">{error || failed}</p>}
    </div>
  );
});
