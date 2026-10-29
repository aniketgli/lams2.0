import React, { useEffect, useState } from 'react';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { DefaultPasswordStatus, defaultPasswordApi } from '../masterApi';
import { NoticeBar, PanelCard, formatDateTime, useNotice } from './masterUi';

/**
 * The password every new employee starts with. The server stores only its
 * hash, so it can be replaced but never read back. New employees must choose
 * their own password at first sign-in.
 */
export const DefaultPasswordCard: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const [status, setStatus] = useState<DefaultPasswordStatus | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, showNotice, clearNotice] = useNotice();

  useEffect(() => {
    let cancelled = false;
    defaultPasswordApi.get()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e) => !cancelled && showNotice('error', e instanceof Error ? e.message : 'Could not load the default password status.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [showNotice]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const result = await defaultPasswordApi.save(password, confirm);
      setStatus(result);
      setPassword('');
      setConfirm('');
      showNotice('success', 'Default password saved. It applies to employees added from now on.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        showNotice('error', error.message);
      } else showNotice('error', 'Could not save the default password.');
    } finally {
      setSaving(false);
    }
  };

  const state = loading ? 'Loading…'
    : !status?.isSet ? 'Not set yet: new employees cannot be added until it is.'
      : status.source === 'env' ? 'Currently taken from the server’s .env file. Set it here to manage it from this page.'
        : `Last changed ${formatDateTime(status.updatedAt)}${status.updatedBy ? ` by ${status.updatedBy.name ?? status.updatedBy.biometricId}` : ''}.`;

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><KeyRound className="w-4 h-4 text-primary" />Default password for new employees</>}
        description={`Every new employee gets this password and the HRMS “User” role only. They must choose their own password at first sign-in. ${state}`}
        actions={status?.isSet ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle border border-success-border px-2.5 py-0.5 text-[11px] font-semibold text-success">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />Set
          </span>
        ) : undefined}
      >
        {readOnly ? (
          <p className="text-xs text-slate-500">Only an administrator can change the default password. It is never shown to anyone.</p>
        ) : (
          <form onSubmit={save} noValidate>
            <fieldset disabled={saving || loading} className="space-y-4">
              <input type="text" name="username" autoComplete="username" value="default-employee-password" readOnly hidden />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={status?.isSet ? 'New default password' : 'Default password'} type="password" required maxLength={128}
                  autoComplete="new-password" value={password} error={errors.password}
                  helperText={status?.rules ?? 'At least 8 characters, with at least one letter and one number.'}
                  onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })); }} />
                <Input label="Confirm password" type="password" required maxLength={128}
                  autoComplete="new-password" value={confirm} error={errors.confirmPassword}
                  helperText="Stored only in scrambled (hashed) form; it cannot be shown again."
                  onChange={(e) => { setConfirm(e.target.value); setErrors((x) => ({ ...x, confirmPassword: '' })); }} />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <Button variant="primary" size="sm" type="submit" leftIcon={Save} loading={saving} disabled={!password || !confirm}>
                  {status?.isSet ? 'Change default password' : 'Set default password'}
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </PanelCard>
    </div>
  );
};
