import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, KeyRound, RefreshCw, Save, Send, Server, UserRound } from 'lucide-react';
import { Button, DataTable, Input, Select, Switch } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { EmailLogEntry, EmailSettings, EmailSettingsInput, SmtpSecurity, emailLogApi, emailSettingsApi } from '../masterApi';
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

/** Whether this server sends notification mails now, and if not, the exact reason. */
const SendingStatus: React.FC<{ saved: EmailSettings }> = ({ saved }) => (
  <div className="space-y-2">
    {saved.notReady ? (
      <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p><span className="font-bold">Notification emails are not being sent from this server.</span> {saved.notReady}</p>
      </div>
    ) : (
      <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p><span className="font-bold">Notification emails are sent</span> through {saved.host}:{saved.port} as {saved.fromEmail}. Use “Send test email to me” to check that they arrive.</p>
      </div>
    )}
    {!saved.appUrl && (
      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p><span className="font-bold">Portal address not set.</span> Add <code className="font-mono">APP_URL=http://&lt;server address&gt;:3000</code> to the server’s .env and restart, so emails carry a link to the portal.</p>
      </div>
    )}
  </div>
);

const STATUS_TEXT: Record<EmailLogEntry['status'], { label: string; tone: string }> = {
  delivered: { label: 'Sent', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  sent: { label: 'Sent', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  simulated: { label: 'Not sent', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
  failed: { label: 'Failed', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
};

/** The last mails this server tried to send, with the reason when one did not go out. */
const RecentMails: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const load = useCallback(() => {
    setLoading(true);
    emailLogApi.list()
      .then((r) => { setLogs(r.logs); setError(undefined); })
      .catch((e) => setError(e instanceof Error ? e.message : 'The mail log could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const columns: ColumnDef<EmailLogEntry>[] = [
    { key: 'time', header: 'Time', width: '15%', sortValue: (m) => m.timestamp, render: (m) => formatDateTime(m.timestamp) },
    {
      key: 'to', header: 'To', width: '22%', sortValue: (m) => m.to,
      render: (m) => <div><div className="font-semibold text-slate-900">{m.toName || m.to}</div>{m.toName && <div className="text-[11px] text-slate-500">{m.to}</div>}
        {(m.cc?.length || m.bcc?.length) ? <div className="text-[11px] text-slate-500">{m.cc?.length ? `CC ${m.cc.length}` : ''}{m.cc?.length && m.bcc?.length ? ' · ' : ''}{m.bcc?.length ? `BCC ${m.bcc.length}` : ''}</div> : null}</div>,
    },
    { key: 'subject', header: 'Subject', width: '30%', sortValue: (m) => m.subject, render: (m) => <div>{m.subject}{m.eventType && <div className="text-[11px] text-slate-500 font-mono">{m.eventType}</div>}</div> },
    { key: 'status', header: 'Status', width: '10%', sortValue: (m) => m.status, render: (m) => <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-bold ${STATUS_TEXT[m.status].tone}`}>{STATUS_TEXT[m.status].label}</span> },
    { key: 'reason', header: 'Reason', render: (m) => <span className="text-slate-600">{m.error || '—'}</span> },
  ];
  return (
    <PanelCard
      title={<><History className="w-4 h-4 text-primary" />Recent emails from this server</>}
      description="Every notification, report and test mail this server tried to send since it last started, newest first. A mail that did not go out shows why."
      actions={<Button variant="outline" size="sm" leftIcon={RefreshCw} loading={loading} onClick={load}>Refresh</Button>}
    >
      <DataTable columns={columns} data={logs} loading={loading && !logs.length} error={error} keyExtractor={(m) => m.id}
        emptyTitle="No emails yet" emptyDescription="Nothing has been sent since the server last started." />
    </PanelCard>
  );
};

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
  const [logKey, setLogKey] = useState(0);

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
      setLogKey((k) => k + 1);
      emailSettingsApi.get().then(setSaved).catch(() => undefined);
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
          {saved && <div className="mb-5"><SendingStatus saved={saved} /></div>}
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
      {!readOnly && <RecentMails refreshKey={logKey} />}
    </div>
  );
};
