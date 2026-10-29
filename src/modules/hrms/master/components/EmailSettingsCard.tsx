import React, { useEffect, useState } from 'react';
import { KeyRound, Save, Send, Server, UserRound } from 'lucide-react';
import { Button, Input, Select, Switch } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { EmailSettings, EmailSettingsInput, SmtpSecurity, emailSettingsApi } from '../masterApi';
import { NoticeBar, PanelCard, formatDateTime, useNotice } from './masterUi';

const SECURITY_OPTIONS: { value: SmtpSecurity; label: string; port: number }[] = [
  { value: 'starttls', label: 'STARTTLS (usually port 587)', port: 587 },
  { value: 'ssl', label: 'SSL / TLS (usually port 465)', port: 465 },
  { value: 'none', label: 'None (not recommended)', port: 25 },
];

const toInput = (s: EmailSettings): EmailSettingsInput => ({
  enabled: s.enabled, fromName: s.fromName, fromEmail: s.fromEmail, replyTo: s.replyTo,
  host: s.host, port: s.port, security: s.security, user: s.user, password: '',
});

const SectionTitle: React.FC<{ icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
    <Icon className="w-3.5 h-3.5" aria-hidden="true" />{children}
  </h4>
);

/**
 * Who notification emails come from and which mail server sends them.
 * The SMTP password is write-only: it is never sent back to the browser.
 */
export const EmailSettingsCard: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const [saved, setSaved] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState<EmailSettingsInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, showNotice, clearNotice] = useNotice();

  useEffect(() => {
    let cancelled = false;
    emailSettingsApi.get()
      .then((s) => { if (!cancelled) { setSaved(s); setForm(toInput(s)); } })
      .catch((e) => !cancelled && showNotice('error', e instanceof Error ? e.message : 'Could not load email settings.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [showNotice]);

  if (loading || !form) {
    return <PanelCard title="Email sender & server"><p className="text-xs text-slate-500">{loading ? 'Loading…' : 'Email settings are not available.'}</p></PanelCard>;
  }

  const set = <K extends keyof EmailSettingsInput>(key: K, value: EmailSettingsInput[K]) => {
    setForm({ ...form, [key]: value });
    if (errors[key as string]) setErrors({ ...errors, [key as string]: '' });
  };

  const dirty = !saved || saved.source !== 'database' || form.password !== '' || Boolean(form.clearPassword) ||
    (Object.keys(toInput(saved)) as (keyof EmailSettingsInput)[]).some((k) => k !== 'password' && form[k] !== toInput(saved)[k]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const result = await emailSettingsApi.save({ ...form, port: Number(form.port) });
      setSaved(result);
      setForm(toInput(result));
      showNotice('success', 'Email settings saved.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        showNotice('error', error.message);
      } else showNotice('error', 'Could not save email settings.');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await emailSettingsApi.test();
      showNotice(result.success ? 'success' : 'error', result.message);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The test failed.');
    } finally {
      setTesting(false);
    }
  };

  const status = saved?.source === 'database'
    ? `Last saved ${formatDateTime(saved.updatedAt)}.`
    : saved?.source === 'env'
      ? 'Currently using the server’s .env settings. Save here to manage them from this page.'
      : 'Not configured yet: no notification emails can be sent.';

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><Server className="w-4 h-4 text-primary" />Email sender &amp; server</>}
        description={`The address notification emails are sent from, and the mail server that sends them. ${status}`}
        actions={
          <Switch
            checked={form.enabled}
            onChange={(v) => set('enabled', v)}
            disabled={readOnly}
            label={form.enabled ? 'Sending on' : 'Sending off'}
          />
        }
      >
        <form onSubmit={save} noValidate>
          <fieldset disabled={readOnly || saving} className="space-y-6">
            <div className="space-y-3">
              <SectionTitle icon={UserRound}>Sender</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Sender name" required maxLength={255} value={form.fromName} error={errors.fromName}
                  placeholder="WII Notifications" onChange={(e) => set('fromName', e.target.value)} />
                <Input label="Sender email (From)" type="email" required maxLength={254} value={form.fromEmail} error={errors.fromEmail}
                  placeholder="notifications@wii.gov.in" onChange={(e) => set('fromEmail', e.target.value)} />
                <Input label="Reply-to email" type="email" maxLength={254} value={form.replyTo} error={errors.replyTo}
                  placeholder="hr@wii.gov.in" helperText="Optional. Where replies go." onChange={(e) => set('replyTo', e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <SectionTitle icon={Server}>Mail server (SMTP)</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <Input label="Server" required maxLength={255} value={form.host} error={errors.host}
                  placeholder="smtp.gov.in" onChange={(e) => set('host', e.target.value.trim())} containerClassName="md:col-span-3" />
                <Input label="Port" type="number" required min={1} max={65535} value={String(form.port)} error={errors.port}
                  onChange={(e) => set('port', Number(e.target.value))} containerClassName="md:col-span-1" />
                <Select label="Security" required value={form.security} error={errors.security} containerClassName="md:col-span-2"
                  onChange={(v: SmtpSecurity) => {
                    const preset = SECURITY_OPTIONS.find((o) => o.value === v);
                    const usingDefaultPort = SECURITY_OPTIONS.some((o) => o.port === Number(form.port));
                    setForm({ ...form, security: v, port: usingDefaultPort && preset ? preset.port : form.port });
                  }}
                  options={SECURITY_OPTIONS.map(({ value, label }) => ({ value, label }))} />
              </div>
            </div>

            <div className="space-y-3">
              <SectionTitle icon={KeyRound}>Sign-in</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Username" maxLength={255} value={form.user} error={errors.user} autoComplete="off"
                  helperText="Usually the sender email. Leave empty if the server needs no sign-in." onChange={(e) => set('user', e.target.value.trim())} />
                <div>
                  <Input label="Password" type="password" maxLength={500} value={form.password} error={errors.password} autoComplete="new-password"
                    placeholder={saved?.hasPassword && !form.clearPassword ? '•••••••• (saved — leave blank to keep)' : ''}
                    helperText="Stored encrypted; never shown again." disabled={!form.user}
                    onChange={(e) => setForm({ ...form, password: e.target.value, clearPassword: false })} />
                  {!readOnly && saved?.hasPassword && saved.source === 'database' && form.user && (
                    <button type="button" className="mt-1 text-[11px] font-semibold text-error hover:underline cursor-pointer"
                      onClick={() => setForm({ ...form, password: '', clearPassword: !form.clearPassword })}>
                      {form.clearPassword ? 'Keep the saved password' : 'Remove the saved password'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <Button variant="primary" size="sm" type="submit" leftIcon={Save} loading={saving} disabled={!dirty}>Save email settings</Button>
                <Button variant="outline" size="sm" leftIcon={Send} loading={testing} disabled={dirty || saved?.source !== 'database'} onClick={() => void test()}
                  title={dirty ? 'Save your changes first' : undefined}>
                  Send test email to me
                </Button>
                {dirty && saved?.source === 'database' && (
                  <Button variant="ghost" size="sm" onClick={() => setForm(toInput(saved))}>Discard changes</Button>
                )}
              </div>
            )}
          </fieldset>
        </form>
      </PanelCard>
    </div>
  );
};
