import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileBarChart, History, Mail, Pause, Pencil, Play, Plus, Send, Trash2, XCircle } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Button, DataTable, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { AppTimePicker } from '../../../../shared/components/AppTimePicker';
import { Checkbox } from '../../../../shared/components/forms/Checkbox';
import { ApiError } from '../../../../shared/services/api';
import { actionBtn } from '../../../../shared/components/actionStyles';
import { ConfirmDialog, NoticeBar, formatDateTime, useNotice } from '../../master/components/masterUi';
import { ReportRun, ReportSchedule, ReportSchedules, ScheduleInput, reportsApi } from '../reportsApi';

/**
 * Reports (administrator): which report goes to whom, how often and at what time. The portal emails it on its own,
 * To = each person's registered email, CC / BCC = the organization's list in Master Settings, as CSV and / or PDF.
 * Everything is stored on the server, which checks every field, sends on time and records each send.
 */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FREQUENCIES = [{ label: 'Every day', value: 'daily' }, { label: 'Every week', value: 'weekly' }, { label: 'Every month', value: 'monthly' }];
const RESULT: Record<string, { label: string; pill: string }> = {
  sent: { label: 'Sent', pill: 'bg-success-subtle text-success border-success-border' },
  partial: { label: 'Partly sent', pill: 'bg-warning-subtle text-warning border-warning-border' },
  failed: { label: 'Failed', pill: 'bg-error-subtle text-error border-error-border' },
  no_recipients: { label: 'No one to send to', pill: 'bg-warning-subtle text-warning border-warning-border' },
};
const blank = (): ScheduleInput => ({ name: '', reportKey: '', frequency: 'daily', weekday: 1, monthDay: 1, sendTime: '', formats: ['pdf'], userIds: [], roles: [], status: 'active' });

const formatDay = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<ReportSchedules>({ schedules: [], reports: [], roles: [], people: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [notice, showNotice, clearNotice] = useNotice();
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setData(await reportsApi.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The report schedules could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // ---- Form ---------------------------------------------------------------------------------------
  const [editing, setEditing] = useState<ReportSchedule | null>(null);
  const [form, setForm] = useState<ScheduleInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = (s: ReportSchedule | null) => {
    setEditing(s);
    setForm(s ? {
      name: s.name, reportKey: s.reportKey, frequency: s.frequency, weekday: s.weekday ?? 1, monthDay: s.monthDay ?? 1, sendTime: s.sendTime,
      formats: s.formats, userIds: s.users.map((u) => u.id), roles: s.roles.map((r) => r.id), status: s.status,
    } : blank());
    setErrors({});
    setFormMessage(null);
  };
  const set = <K extends keyof ScheduleInput>(key: K, value: ScheduleInput[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: '' } : e));
  };
  const toggleFormat = (format: 'csv' | 'pdf') => {
    if (!form) return;
    set('formats', form.formats.includes(format) ? form.formats.filter((f) => f !== format) : [...form.formats, format]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setFormMessage(null);
    try {
      const body: ScheduleInput = { ...form, weekday: form.frequency === 'weekly' ? form.weekday : null, monthDay: form.frequency === 'monthly' ? form.monthDay : null };
      const result = editing ? await reportsApi.update(editing.id, body) : await reportsApi.create(body);
      setForm(null);
      showNotice('success', result.message);
      await load();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setFormMessage(error.message);
      } else setFormMessage('The report schedule could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Row actions ------------------------------------------------------------------------------------
  const [busyId, setBusyId] = useState<string | null>(null);
  const sendNow = async (s: ReportSchedule) => {
    if (busyId) return;
    setBusyId(s.id);
    try {
      const result = await reportsApi.sendNow(s.id);
      showNotice(result.result.status === 'sent' || result.result.status === 'partial' ? 'success' : 'error', result.message);
      await load();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The report could not be sent.');
    } finally {
      setBusyId(null);
    }
  };
  const toggle = async (s: ReportSchedule) => {
    if (busyId) return;
    setBusyId(s.id);
    try {
      const result = await reportsApi.setStatus(s.id, s.status === 'active' ? 'paused' : 'active');
      showNotice('success', result.message);
      await load();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The status could not be changed.');
    } finally {
      setBusyId(null);
    }
  };

  const [deleting, setDeleting] = useState<ReportSchedule | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await reportsApi.remove(deleting.id, reason || undefined);
      setDeleting(null);
      showNotice('success', result.message);
      await load();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The report schedule could not be deleted.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const [history, setHistory] = useState<ReportSchedule | null>(null);
  const [runs, setRuns] = useState<ReportRun[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const openHistory = (s: ReportSchedule) => {
    setHistory(s); setRuns(null); setRunsError(null);
    reportsApi.runs(s.id).then((r) => setRuns(r.runs)).catch((e) => setRunsError(e instanceof Error ? e.message : 'The history could not be loaded.'));
  };

  // ---- List ------------------------------------------------------------------------------------------------
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? data.schedules.filter((s) => `${s.name} ${s.reportLabel} ${s.users.map((u) => u.name).join(' ')} ${s.roles.map((r) => r.label).join(' ')}`.toLowerCase().includes(q)) : data.schedules;
  }, [data.schedules, search]);

  const stats = [
    { label: 'Schedules', value: data.schedules.length, icon: FileBarChart, tone: 'bg-primary-subtle text-primary border-primary-border' },
    { label: 'Active', value: data.schedules.filter((s) => s.status === 'active').length, icon: CheckCircle2, tone: 'bg-success-subtle text-success border-success-border' },
    { label: 'Paused', value: data.schedules.filter((s) => s.status === 'paused').length, icon: Pause, tone: 'bg-warning-subtle text-warning border-warning-border' },
    { label: 'Last send failed', value: data.schedules.filter((s) => s.lastStatus === 'failed' || s.lastStatus === 'partial').length, icon: XCircle, tone: 'bg-error-subtle text-error border-error-border' },
  ];

  const columns: ColumnDef<ReportSchedule>[] = [
    {
      key: 'name', header: 'Schedule', width: '20%', sortValue: (s) => s.name,
      render: (s) => (
        <div className="leading-tight min-w-0">
          <div className="font-semibold text-slate-900 truncate" title={s.name}>{s.name}</div>
          <div className="text-[11px] text-slate-500 truncate">{s.reportLabel}</div>
        </div>
      ),
    },
    {
      key: 'when', header: 'When', width: '18%', sortValue: (s) => s.sendTime,
      render: (s) => (
        <div className="leading-tight">
          <div className="text-slate-800 whitespace-normal">{s.timing}</div>
          <div className="text-[11px] text-slate-500">{s.formats.map((f) => f.toUpperCase()).join(' + ')}</div>
        </div>
      ),
    },
    {
      key: 'to', header: 'Sent to', width: '22%',
      render: (s) => {
        const names = [...s.roles.map((r) => `All ${r.label}`), ...s.users.map((u) => u.name)];
        return <div className="whitespace-normal leading-snug text-slate-700 line-clamp-2" title={names.join(', ')}>{names.join(', ')}</div>;
      },
    },
    { key: 'next', header: 'Next send', width: '11%', sortValue: (s) => s.nextRun ?? '', render: (s) => <span className="text-slate-800 whitespace-nowrap">{s.status === 'paused' ? 'Paused' : formatDay(s.nextRun)}</span> },
    {
      key: 'last', header: 'Last send', width: '15%', sortValue: (s) => s.lastRunAt ?? '',
      render: (s) => (s.lastStatus ? (
        <div className="leading-tight space-y-1">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${RESULT[s.lastStatus]?.pill ?? ''}`} title={s.lastMessage ?? undefined}>{RESULT[s.lastStatus]?.label ?? s.lastStatus}</span>
          <div className="text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(s.lastRunAt)}</div>
        </div>
      ) : <span className="text-slate-400">Not sent yet</span>),
    },
    {
      key: 'actions', header: 'Actions', width: '14%', align: 'center',
      render: (s) => (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => void sendNow(s)} disabled={busyId !== null} title="Send now" aria-label={`Send ${s.name} now`} className={actionBtn('success')}><Send className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => openHistory(s)} title="Send history" aria-label={`History of ${s.name}`} className={actionBtn('neutral')}><History className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => void toggle(s)} disabled={busyId !== null} title={s.status === 'active' ? 'Pause' : 'Resume'} aria-label={`${s.status === 'active' ? 'Pause' : 'Resume'} ${s.name}`} className={actionBtn('warning')}>
            {s.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={() => open(s)} title="Edit" aria-label={`Edit ${s.name}`} className={actionBtn('neutral')}><Pencil className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => { setDeleteError(null); setDeleting(s); }} title="Delete" aria-label={`Delete ${s.name}`} className={actionBtn('danger')}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  const chosenReport = data.reports.find((r) => r.key === form?.reportKey);

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={Mail}
        title="Reports"
        subtitle="Choose which report is emailed to whom, how often and at what time"
        rightAction={(
          <button type="button" onClick={() => open(null)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-2xs cursor-pointer">
            <Plus className="w-4 h-4" /> Add schedule
          </button>
        )}
      />
      <NoticeBar notice={notice} onClose={clearNotice} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 min-w-0">
            <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">{label}</p>
              <p className="text-lg font-extrabold text-slate-900">{loading ? '…' : value}</p>
            </div>
          </div>
        ))}
      </div>

      <FilterToolbar search={{ value: search, onChange: setSearch, placeholder: 'Search schedule, report, person…' }} onReset={search ? () => setSearch('') : null} />

      <DataTable columns={columns} data={shown} loading={loading} error={loadError} keyExtractor={(s) => s.id}
        emptyTitle="No report schedules yet" emptyDescription={data.schedules.length ? 'Change the search.' : 'Add the first schedule to have a report emailed on time.'} />

      <Modal
        isOpen={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size="lg"
        title={editing ? 'Edit report schedule' : 'Add report schedule'}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="report-schedule-editor" loading={saving}>{editing ? 'Save changes' : 'Add schedule'}</Button>
          </div>
        )}
      >
        {form && (
          <form id="report-schedule-editor" onSubmit={save} className="space-y-4" noValidate>
            {formMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}
            <Input label="Name" required maxLength={120} value={form.name} placeholder="e.g. Daily attendance to HoDs" error={errors.name} onChange={(e) => set('name', e.target.value)} />
            <div>
              <Select label="Report" required value={form.reportKey} searchable placeholder="Select report" error={errors.reportKey} onChange={(v: string) => set('reportKey', v)}
                options={data.reports.map((r) => ({ label: r.label, value: r.key }))} />
              {chosenReport && <p className="text-[11px] text-slate-500 mt-1.5">{chosenReport.description} {chosenReport.snapshot ? 'Shows the position on the day it is sent.' : 'Covers the day, the 7 days or the month before it is sent.'}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="How often" required value={form.frequency} searchable={false} error={errors.frequency} onChange={(v: string) => set('frequency', v as ScheduleInput['frequency'])} options={FREQUENCIES} />
              {form.frequency === 'weekly' && (
                <Select label="Day of the week" required value={String(form.weekday ?? '')} searchable={false} error={errors.weekday} onChange={(v: string) => set('weekday', Number(v))}
                  options={WEEKDAYS.map((d, i) => ({ label: d, value: String(i + 1) }))} />
              )}
              {form.frequency === 'monthly' && (
                <Select label="Day of the month" required value={String(form.monthDay ?? '')} searchable={false} error={errors.monthDay} onChange={(v: string) => set('monthDay', Number(v))}
                  options={Array.from({ length: 28 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }))} />
              )}
              <div>
                <AppTimePicker label="Time (IST)" required value={form.sendTime} placeholder="HH:mm" onChange={(v: string) => set('sendTime', v)} className="w-full" />
                {errors.sendTime && <p className="text-[11px] font-semibold text-error mt-1.5">{errors.sendTime}</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">File <span className="text-error">*</span></p>
              <div className="flex items-center gap-5">
                <Checkbox label="PDF" checked={form.formats.includes('pdf')} onChange={() => toggleFormat('pdf')} />
                <Checkbox label="CSV (Excel)" checked={form.formats.includes('csv')} onChange={() => toggleFormat('csv')} />
              </div>
              {errors.formats && <p className="text-[11px] font-semibold text-error mt-1.5">{errors.formats}</p>}
            </div>
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <Select label="Send to roles" isMulti value={form.roles} placeholder="Everyone who holds the role" onChange={(v: string[]) => set('roles', v)} options={data.roles.map((r) => ({ label: r.label, value: r.id }))} />
              <Select label="Send to people" isMulti value={form.userIds} placeholder="Select people" onChange={(v: string[]) => set('userIds', v)}
                options={data.people.map((p) => ({ label: `${p.name} (${p.biometricId})${p.designation ? ` · ${p.designation}` : ''}`, value: p.id }))} />
              {errors.recipients && <p className="text-[11px] font-semibold text-error">{errors.recipients}</p>}
            </div>
            <Select label="Status" required value={form.status} searchable={false} error={errors.status} onChange={(v: string) => set('status', v as 'active' | 'paused')}
              options={[{ label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' }]} />
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(history)} onClose={() => setHistory(null)} size="lg" icon={<Clock className="w-5 h-5 text-blue-300" />} title="Send history" subtitle={history ? `${history.name} · last 20 sends` : undefined}>
        {runsError && <p role="alert" className="text-xs text-error">{runsError}</p>}
        {!runsError && runs === null && <p className="text-xs text-slate-500">Loading…</p>}
        {runs && (runs.length === 0 ? <p className="text-xs text-slate-500">Nothing has been sent yet.</p> : (
          <ul className="divide-y divide-slate-100 text-xs">
            {runs.map((r) => (
              <li key={r.id} className="py-2.5 flex items-start gap-3">
                <span className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold shrink-0 ${RESULT[r.status]?.pill ?? ''}`}>{RESULT[r.status]?.label ?? r.status}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{formatDateTime(r.ranAt)} · {r.trigger === 'manual' ? 'Sent now' : 'Scheduled'} · {r.sentCount} {r.sentCount === 1 ? 'person' : 'people'}</div>
                  <div className="text-slate-500">{r.periodFrom ? (r.periodFrom === r.periodTo ? `For ${formatDay(r.periodFrom)}` : `For ${formatDay(r.periodFrom)} to ${formatDay(r.periodTo)}`) : ''}{r.message ? ` · ${r.message}` : ''}</div>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        busy={deleteBusy}
        error={deleteError}
        title="Delete report schedule?"
        confirmLabel="Delete"
        message={<>“{deleting?.name}” will stop being sent and its send history will be removed. Pause it instead to keep it.</>}
        onConfirm={(reason) => void remove(reason)}
        onCancel={() => !deleteBusy && setDeleting(null)}
      />
    </div>
  );
};
