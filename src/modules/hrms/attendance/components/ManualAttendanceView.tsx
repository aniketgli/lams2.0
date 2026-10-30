import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, CheckCircle2, ClipboardList, Clock, Eye, Pencil, Plus, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { DataTable, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { Textarea } from '../../../../shared/components/forms/Textarea';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { AppTimePicker } from '../../../../shared/components/AppTimePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { ActivityLogPanel, ActivitySource } from '../../../../shared/components/ActivityLogPanel';
import { ApiError } from '../../../../shared/services/api';
import { activityEndpoints } from '../../../../shared/services/activityApi';
import { downloadCsvText, downloadTablePdf, printedAt, toCsvText } from '../../../../shared/services/printTable';
import { ConfirmDialog, NoticeBar, useNotice } from '../../master/components/masterUi';
import { ManualInput, ManualList, ManualRequest, ManualStatus, PunchGap, manualAttendanceApi } from '../manualAttendanceApi';

/**
 * Manual Attendance: a request to correct a missed or wrong punch.
 *
 *   User                       : applies for themselves and follows the status of their requests
 *   Reporting Manager          : approves / rejects the requests of the people who report to them
 *   HoD (reviewing manager)    : sees the requests of the people under them
 *   Administrator              : applies / edits / deletes for anyone, approves / rejects
 *   Auditor                    : sees every request, plus the activity log (who did what, when)
 * An approved request counts as In / Out on the Attendance page. The server checks every rule.
 */

const STATUS_META: Record<ManualStatus, { label: string; pill: string }> = {
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-800 border-amber-200' },
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', pill: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const STATUSES = Object.keys(STATUS_META) as ManualStatus[];
const PAGE_SIZES = [25, 50, 100];

const MANUAL_ACTIVITY: ActivitySource = {
  title: 'Manual attendance activity log',
  recordLabel: 'Request',
  searchPlaceholder: 'Employee, done by, reason…',
  areas: [{ value: 'manual_attendance', label: 'Manual attendance' }, { value: 'manual_attendance_export', label: 'Log download' }],
  actions: ['CREATE', 'UPDATE', 'STATUS', 'DELETE', 'EXPORT'],
  actionLabels: { CREATE: 'Applied', UPDATE: 'Edited', STATUS: 'Approved / rejected', DELETE: 'Deleted', EXPORT: 'Downloaded' },
  ...activityEndpoints('/hrms/manual-attendance/activity', 'WII_Manual_Attendance_Activity.csv'),
};

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
const formatStamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const StatusPill: React.FC<{ status: ManualStatus }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${STATUS_META[status].pill}`}>{STATUS_META[status].label}</span>
);

const EMPTY_FORM: ManualInput = { userId: '', date: '', inTime: '', outTime: '', category: '', reason: '' };
const dayShort = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
const gapText = (g: PunchGap) => (!g.in && !g.out ? 'No punch' : !g.in ? 'Check-In missing' : 'Check-Out missing');

export const ManualAttendanceView: React.FC = () => {
  const { currentUser, users } = useApp();
  const role = currentUser.role;
  const isAdmin = role === 'administrator';
  const isAudit = role === 'audit';
  const isManager = role === 'reporting_manager' || role === 'reviewing_manager';
  const canApply = isAdmin || role === 'general_staff';
  const teamView = isAdmin || isAudit || isManager;

  // ---- Data ---------------------------------------------------------------------
  const today = localDate();
  const defaultFrom = localDate(-90);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ManualList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useNotice();
  const [auditorView, setAuditorView] = useState<'records' | 'activity'>('records');

  const load = useCallback(async (silent = false) => {
    if (from > to) { setData(null); setError('The From date must be on or before the To date.'); return; }
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await manualAttendanceApi.list(from, to));
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : 'Requests could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);
  useEffect(() => { void load(); }, [load, role]);

  const userById = useMemo(() => new Map(users.map((u) => [String(u.id), u])), [users]);
  const requests = data?.requests ?? [];

  // ---- Filters --------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>(['all']);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [employees, setEmployees] = useState<string[]>(['all']);
  const [departments, setDepartments] = useState<string[]>(['all']);
  const distinct = (pick: (r: ManualRequest) => string) => [...new Set(requests.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const opt = (values: string[]) => values.map((v) => ({ label: v, value: v }));
  const filtered = Boolean(search.trim()) || [statuses, categories, employees, departments].some((f) => !f.includes('all')) || from !== defaultFrom || to !== today;
  const resetAll = () => {
    setSearch(''); [setStatuses, setCategories, setEmployees, setDepartments].forEach((set) => set(['all']));
    setFrom(defaultFrom); setTo(today);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) =>
      matchesMultiSelect(statuses, r.status) && matchesMultiSelect(categories, r.category) &&
      (!teamView || (matchesMultiSelect(employees, r.userId) && matchesMultiSelect(departments, r.department))) &&
      (!q || [r.name, r.biometricId, r.department, r.designation, r.date, formatDate(r.date), r.category, r.reason, r.comment, r.managerName, STATUS_META[r.status].label]
        .some((v) => (v || '').toLowerCase().includes(q))));
  }, [requests, search, statuses, categories, employees, departments, teamView]);

  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  useEffect(() => setPage(1), [visible.length, pageSize, sort]);

  const stats = useMemo(() => ({
    approved: visible.filter((r) => r.status === 'approved').length,
    pending: visible.filter((r) => r.status === 'pending').length,
    rejected: visible.filter((r) => r.status === 'rejected').length,
  }), [visible]);
  const range = `${formatDate(from)} – ${formatDate(to)}`;
  const statCards = [
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Pending', value: stats.pending, icon: Clock, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Total requests', value: visible.length, icon: CalendarCheck, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  // ---- Apply / edit ------------------------------------------------------------------
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManualRequest | null>(null);
  const [form, setForm] = useState<ManualInput>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setField = <K extends keyof ManualInput>(key: K, value: ManualInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };
  // Dates the employee has a missing punch on (latest first). The server works them out from the biometric log.
  const [gaps, setGaps] = useState<PunchGap[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);
  useEffect(() => {
    if (!formOpen || (isAdmin && !form.userId)) { setGaps([]); return; }
    let cancelled = false;
    setGapsLoading(true); setGapsError(null);
    manualAttendanceApi.missingPunches(isAdmin ? form.userId : undefined)
      .then((res) => { if (!cancelled) setGaps(res.dates); })
      .catch((e) => { if (!cancelled) { setGaps([]); setGapsError(e instanceof ApiError ? e.message : 'Dates could not be loaded.'); } })
      .finally(() => { if (!cancelled) setGapsLoading(false); });
    return () => { cancelled = true; };
  }, [formOpen, form.userId, isAdmin]);
  // When editing, the request's own date stays selectable.
  const dateChoices = useMemo(() => {
    const own: PunchGap[] = editing && editing.userId === form.userId ? [{ date: editing.date, in: editing.originalIn, out: editing.originalOut }] : [];
    return [...own, ...gaps.filter((g) => !own.some((o) => o.date === g.date))].sort((a, b) => b.date.localeCompare(a.date));
  }, [gaps, editing, form.userId]);
  const chosen = dateChoices.find((g) => g.date === form.date) ?? null;
  const pickDate = (date: string) => {
    const g = dateChoices.find((x) => x.date === date);
    setForm((f) => ({ ...f, date, inTime: g?.in ?? '', outTime: g?.out ?? '' }));
    setFormErrors((e) => ({ ...e, date: '', inTime: '', outTime: '' }));
  };
  const openApply = () => { setEditing(null); setForm(EMPTY_FORM); setFormErrors({}); setFormMessage(null); setFormOpen(true); };
  const openEdit = (r: ManualRequest) => {
    setEditing(r);
    setForm({ userId: r.userId, date: r.date, inTime: r.inTime, outTime: r.outTime, category: r.category, reason: r.reason });
    setFormErrors({}); setFormMessage(null); setFormOpen(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setFormMessage(null);
    try {
      const result = editing ? await manualAttendanceApi.update(editing.id, form) : await manualAttendanceApi.create(form);
      setFormOpen(false);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormErrors(error.details ?? {});
        const first = Object.values(error.details ?? {}).find(Boolean);
        setFormMessage(first ? `${error.message} ${first}` : error.message);
      } else {
        setFormMessage('The request could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Approve / reject / delete ---------------------------------------------------------
  const [deciding, setDeciding] = useState<{ request: ManualRequest; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [decideBusy, setDecideBusy] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const openDecide = (request: ManualRequest, action: 'approve' | 'reject') => { setDeciding({ request, action }); setComment(''); setDecideError(null); };
  const confirmDecide = async () => {
    if (!deciding || decideBusy) return;
    if (deciding.action === 'reject' && comment.trim().length < 3) { setDecideError('Say why the request is rejected.'); return; }
    setDecideBusy(true); setDecideError(null);
    try {
      const result = await manualAttendanceApi.decide(deciding.request.id, deciding.action, comment.trim());
      setDeciding(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setDecideError(error instanceof ApiError ? [error.message, ...Object.values(error.details ?? {})].filter(Boolean).join(' ') : 'The decision could not be saved.');
    } finally {
      setDecideBusy(false);
    }
  };

  const [deleting, setDeleting] = useState<ManualRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmDelete = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      const result = await manualAttendanceApi.remove(deleting.id, reason);
      setDeleting(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The request could not be deleted.');
    } finally {
      setDeleteBusy(false);
    }
  };

  // ---- Table ---------------------------------------------------------------------------------
  const [viewing, setViewing] = useState<ManualRequest | null>(null);
  const [undoing, setUndoing] = useState<ManualRequest | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const confirmUndo = async (reason: string) => {
    if (!undoing) return;
    setUndoBusy(true); setUndoError(null);
    try {
      const result = await manualAttendanceApi.undo(undoing.id, reason);
      setUndoing(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : 'The decision could not be undone.');
    } finally {
      setUndoBusy(false);
    }
  };

  const iconBtn = 'w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer shrink-0';
  const statusBy = (r: ManualRequest) => (r.status === 'pending' ? `Applied by ${r.appliedByName || r.name}` : `by ${r.actionByName ?? '—'}`);
  // Who sees which columns: the employee column for everyone who sees other people's requests.
  const columns: ColumnDef<ManualRequest>[] = [
    ...(teamView ? [{
      key: 'employee', header: 'Employee', width: '18%', sortValue: (r: ManualRequest) => r.name,
      render: (r: ManualRequest) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar name={r.name} src={(userById.get(r.userId) as { avatar?: string } | undefined)?.avatar || null} className="w-8 h-8 rounded-full shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-slate-900 truncate">{r.name}</div>
            <div className="text-[11px] text-slate-500 truncate">B.I. {r.biometricId}{r.designation ? ` · ${r.designation}` : ''}</div>
          </div>
        </div>
      ),
    } as ColumnDef<ManualRequest>] : []),
    {
      key: 'date', header: 'Forgot date & time', width: teamView ? '13%' : '17%', sortValue: (r) => r.date,
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-900 whitespace-nowrap">{formatDate(r.date)}</div>
          <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap">{r.inTime} – {r.outTime}</div>
        </div>
      ),
    },
    {
      key: 'applied', header: 'Applied date', width: teamView ? '11%' : '15%', sortValue: (r) => r.appliedAt,
      render: (r) => (
        <div className="leading-tight">
          <div className="text-slate-800 whitespace-nowrap">{formatDate(r.appliedAt.slice(0, 10))}</div>
          <div className="text-[11px] text-slate-500 whitespace-nowrap">{new Date(r.appliedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', width: teamView ? '11%' : '14%', sortValue: (r) => r.category, render: (r) => <span className="font-semibold text-slate-800">{r.category}</span> },
    {
      key: 'reason', header: 'Reason', width: teamView ? '17%' : '24%', sortValue: (r) => r.reason,
      render: (r) => <div className="whitespace-normal leading-snug min-w-[140px] text-slate-700 line-clamp-2" title={r.reason}>{r.reason}</div>,
    },
    {
      key: 'status', header: 'Status', width: teamView ? '14%' : '16%', sortValue: (r) => r.status,
      render: (r) => (
        <div className="leading-tight space-y-1">
          <StatusPill status={r.status} />
          <div className="text-[11px] text-slate-500 truncate" title={statusBy(r)}>{statusBy(r)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions', width: teamView ? '16%' : '14%', align: 'center',
      render: (r: ManualRequest) => (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => setViewing(r)} title="View" aria-label={`View request of ${r.name} for ${formatDate(r.date)}`}
            className={`${iconBtn} border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50`}><Eye className="w-3.5 h-3.5" /></button>
          {r.canEdit && (
            <button type="button" onClick={() => openEdit(r)} title="Edit" aria-label={`Edit ${r.name}`}
              className={`${iconBtn} border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50`}><Pencil className="w-3.5 h-3.5" /></button>
          )}
          {r.canDelete && (
            <button type="button" onClick={() => { setDeleting(r); setDeleteError(null); }} title="Delete" aria-label={`Delete ${r.name}`}
              className={`${iconBtn} border-slate-200 text-slate-600 hover:text-error hover:bg-error-subtle`}><Trash2 className="w-3.5 h-3.5" /></button>
          )}
          {r.canDecide && (
            <>
              <button type="button" onClick={() => openDecide(r, 'approve')} title="Approve" aria-label={`Approve ${r.name}`}
                className={`${iconBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}><Check className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => openDecide(r, 'reject')} title="Reject" aria-label={`Reject ${r.name}`}
                className={`${iconBtn} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}><X className="w-3.5 h-3.5" /></button>
            </>
          )}
          {r.canUndo && (
            <button type="button" onClick={() => { setUndoing(r); setUndoError(null); }} title="Undo the decision" aria-label={`Undo decision on ${r.name}`}
              className={`${iconBtn} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}><RotateCcw className="w-3.5 h-3.5" /></button>
          )}
        </div>
      ),
    },
  ];

  const sorted = useMemo(() => {
    const value = columns.find((c) => c.key === sort.key)?.sortValue ?? ((r: ManualRequest) => r.date);
    const dir = sort.dir === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    return [...visible].sort((a, b) => collator.compare(String(value(a) ?? ''), String(value(b) ?? '')) * dir || b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
    // columns are rebuilt each render; their sort values depend only on the row
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  // ---- Downloads -------------------------------------------------------------------------------
  const exportHeaders = [...(teamView ? ['Biometric ID', 'Employee', 'Department'] : []), 'Date', 'Requested In', 'Requested Out', 'Biometric In', 'Biometric Out', 'Category', 'Reason', 'Status', 'Decided by', 'Comment'];
  const exportRows = () => sorted.map((r) => [
    ...(teamView ? [r.biometricId, r.name, r.department] : []),
    formatDate(r.date), r.inTime, r.outTime, r.originalIn ?? '', r.originalOut ?? '', r.category, r.reason,
    STATUS_META[r.status].label, r.actionByName ?? '', r.comment ?? '',
  ]);
  const fileName = `WII_Manual_Attendance_${from}_to_${to}`;
  const downloadCsv = () => downloadCsvText(toCsvText(exportHeaders, exportRows()), fileName);
  const downloadPdf = () => downloadTablePdf({
    title: 'Manual Attendance',
    subtitle: [`${range} · Generated ${printedAt(new Date().toISOString())}`, teamView ? 'All requests shown' : currentUser.name],
    headers: exportHeaders,
    rows: exportRows(),
    fileName,
    columnWidths: teamView ? [6, 11, 9, 8, 5, 5, 5, 5, 9, 17, 7, 7, 6] : [9, 7, 7, 7, 7, 13, 26, 9, 8, 7],
  });

  const employeeOptions = [...new Map(requests.map((r) => [r.userId, `${r.name} (${r.biometricId})`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value }));

  const auditorSwitch = isAudit ? (
    <div role="tablist" aria-label="Auditor view" className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 border border-slate-200">
      {([['records', 'Requests'], ['activity', 'Activity log']] as const).map(([key, text]) => (
        <button key={key} type="button" role="tab" aria-selected={auditorView === key} onClick={() => setAuditorView(key)}
          className={`h-7 px-3.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${auditorView === key ? 'bg-white text-primary shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}>
          {text}
        </button>
      ))}
    </div>
  ) : null;

  const subtitle = isAdmin ? 'Apply, edit, approve and reject manual attendance of all employees'
    : isAudit ? 'All manual attendance requests, and the log of who did what'
    : role === 'reporting_manager' ? 'Your requests, and your team’s requests to approve or reject'
    : role === 'reviewing_manager' ? 'Your requests, and the requests of the people under you'
    : 'Apply for a missed punch and follow the status of your requests';

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={ClipboardList}
        title="Manual Attendance"
        subtitle={subtitle}
        rightAction={canApply ? (
          <button type="button" onClick={openApply}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-2xs cursor-pointer">
            <Plus className="w-4 h-4" /> Apply manual attendance
          </button>
        ) : undefined}
      />

      <NoticeBar notice={notice} onClose={clearNotice} />

      {isAudit && auditorView === 'activity' ? (
        <ActivityLogPanel source={MANUAL_ACTIVITY} toolbarStart={auditorSwitch} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 min-w-0">
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className="text-lg font-extrabold text-slate-900">{loading ? '…' : value}</p>
                  <p className="text-[11px] text-slate-500 truncate" title={range}>{range}</p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div role="alert" className="px-4 py-3 rounded-2xl border text-xs font-semibold bg-error-subtle border-error-border text-error">{error}</div>
          )}

          <FilterToolbar
            start={auditorSwitch ?? (
              <div className="flex items-center gap-1.5">
                <div className="w-36"><AppDatePicker size="sm" placeholder="From date" value={from} onChange={setFrom} /></div>
                <span className="text-slate-300 font-bold">—</span>
                <div className="w-36"><AppDatePicker size="sm" placeholder="To date" value={to} onChange={setTo} isRightColumn /></div>
              </div>
            )}
            exports={{
              onCsv: downloadCsv, onPdf: downloadPdf, disabled: sorted.length === 0,
              csvTitle: 'Download the requests shown below as CSV', pdfTitle: 'Download the requests shown below as PDF',
            }}
            search={{ value: search, onChange: setSearch, placeholder: teamView ? 'Search employee, reason, comment…' : 'Search date, reason, comment…' }}
            onReset={filtered ? resetAll : null}
            filters={[
              isAudit && (
                <div key="range" className="flex items-center gap-1.5">
                  <div className="w-36"><AppDatePicker size="sm" placeholder="From date" value={from} onChange={setFrom} /></div>
                  <span className="text-slate-300 font-bold">—</span>
                  <div className="w-36"><AppDatePicker size="sm" placeholder="To date" value={to} onChange={setTo} isRightColumn /></div>
                </div>
              ),
              teamView && <MultiSelectFilter key="emp" label="Employee" options={employeeOptions} selectedValues={employees} onChange={setEmployees} />,
              teamView && <MultiSelectFilter key="dept" label="Department" options={opt(distinct((r) => r.department))} selectedValues={departments} onChange={setDepartments} />,
              <MultiSelectFilter key="cat" label="Category" options={opt(data?.categories ?? distinct((r) => r.category))} selectedValues={categories} onChange={setCategories} />,
              <MultiSelectFilter key="status" label="Status" options={STATUSES.map((s) => ({ label: STATUS_META[s].label, value: s }))} selectedValues={statuses} onChange={setStatuses} />,
            ].filter(Boolean) as React.ReactNode[]}
          />

          <DataTable
            columns={columns}
            data={pageRows}
            loading={loading}
            keyExtractor={(r) => r.id}
            className={teamView ? 'min-w-[1100px]' : 'min-w-[800px]'}
            sortColumn={sort.key}
            sortDirection={sort.dir}
            onSort={(key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
            emptyTitle={requests.length ? 'No requests match these filters' : 'No manual attendance requests'}
            emptyDescription={requests.length ? 'Change the filters or search.' : canApply ? 'Choose other dates, or apply for a missed punch.' : 'Choose other dates.'}
            pagination={sorted.length > PAGE_SIZES[0] ? {
              currentPage: page, totalPages, totalItems: sorted.length, pageSize,
              onPageChange: setPage, onPageSizeChange: setPageSize, pageSizeOptions: PAGE_SIZES,
            } : undefined}
          />
        </>
      )}

      {canApply && (
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          size="lg"
          title={editing ? 'Edit manual attendance' : 'Apply manual attendance'}
          subtitle={editing ? `${editing.name} · ${formatDate(editing.date)}` : 'Dates with a missing punch, latest first'}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" form="manual-form" disabled={saving} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Submit request'}
              </button>
            </div>
          )}
        >
          <form id="manual-form" onSubmit={save} noValidate className="space-y-4">
            {formMessage && <NoticeBar notice={{ kind: 'error', text: formMessage }} onClose={() => setFormMessage(null)} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isAdmin ? (
                <div className="sm:col-span-2" title={formErrors.userId || undefined}>
                  <Select label="Employee" required value={form.userId} disabled={Boolean(editing)} searchable placeholder="Select employee" error={Boolean(formErrors.userId)}
                    onChange={(v: string) => setForm((f) => ({ ...f, userId: v, date: '', inTime: '', outTime: '' }))}
                    options={(data?.employees ?? []).map((e) => ({ label: `${e.name} (${e.biometricId})${e.designation ? ` · ${e.designation}` : ''}`, value: e.id }))} />
                </div>
              ) : null}
              <div title={formErrors.date || gapsError || undefined}>
                <Select label="Date" required value={form.date} onChange={pickDate} searchable={false} error={Boolean(formErrors.date || gapsError)}
                  disabled={gapsLoading || (isAdmin && !form.userId) || dateChoices.length === 0}
                  placeholder={gapsLoading ? 'Loading dates…' : isAdmin && !form.userId ? 'Select employee first' : dateChoices.length === 0 ? 'No date with a missing punch' : 'Select date'}
                  options={dateChoices.map((g) => ({ label: `${formatDate(g.date)} (${dayShort(g.date)}) · ${gapText(g)}`, value: g.date }))} />
              </div>
              <div title={formErrors.category || undefined}>
                <Select label="Category" required value={form.category} onChange={(v: string) => setField('category', v)} searchable={false} placeholder="Select category"
                  error={Boolean(formErrors.category)} options={(data?.categories ?? []).map((c) => ({ label: c, value: c }))} />
              </div>
              <div className={formErrors.inTime ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.inTime || undefined}>
                <AppTimePicker label="Check-In" required value={form.inTime} placeholder="HH:mm" disabled={!chosen || Boolean(chosen.in)}
                  onChange={(v) => setField('inTime', v)} className="w-full" />
              </div>
              <div className={formErrors.outTime ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.outTime || undefined}>
                <AppTimePicker label="Check-Out" required value={form.outTime} placeholder="HH:mm" disabled={!chosen || Boolean(chosen.out)}
                  onChange={(v) => setField('outTime', v)} align="right" className="w-full" />
              </div>
            </div>
            <Textarea label="Reason *" rows={3} maxLength={500} value={form.reason} error={Boolean(formErrors.reason)}
              onChange={(e) => setField('reason', e.target.value)} />
          </form>
        </Modal>
      )}

      <Modal
        isOpen={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        size="sm"
        title={deciding?.action === 'approve' ? 'Approve request' : 'Reject request'}
        subtitle={deciding ? `${deciding.request.name} · ${formatDate(deciding.request.date)} · ${deciding.request.inTime} – ${deciding.request.outTime}` : undefined}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeciding(null)} disabled={decideBusy} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button type="button" onClick={() => void confirmDecide()} disabled={decideBusy}
              className={`h-9 px-4 rounded-xl text-white text-xs font-bold cursor-pointer disabled:opacity-60 ${deciding?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {decideBusy ? 'Saving…' : deciding?.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          {deciding && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {deciding.request.category}: {deciding.request.reason}
              {(deciding.request.originalIn || deciding.request.originalOut) && <> · Biometric: {deciding.request.originalIn ?? '—'} – {deciding.request.originalOut ?? '—'}</>}
            </p>
          )}
          <Textarea label={deciding?.action === 'reject' ? 'Reason for rejecting *' : 'Comment (optional)'} rows={3} maxLength={500} value={comment}
            error={Boolean(decideError)} onChange={(e) => { setComment(e.target.value); setDecideError(null); }} />
          {decideError && <p role="alert" className="text-xs text-error">{decideError}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="md"
        title="Manual attendance request"
        subtitle={viewing ? `${viewing.name} · ${formatDate(viewing.date)}` : undefined}
        footer={<div className="flex justify-end"><button type="button" onClick={() => setViewing(null)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Close</button></div>}
      >
        {viewing && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            {([
              ['Employee', `${viewing.name} (B.I. ${viewing.biometricId})`],
              ['Designation / department', [viewing.designation, viewing.department].filter(Boolean).join(' · ') || '—'],
              ['Forgot date', formatDate(viewing.date)],
              ['Requested In – Out', `${viewing.inTime} – ${viewing.outTime}`],
              ['Biometric In – Out', viewing.originalIn || viewing.originalOut ? `${viewing.originalIn ?? 'missing'} – ${viewing.originalOut ?? 'missing'}` : 'No punch'],
              ['Category', viewing.category],
              ['Applied', `${formatStamp(viewing.appliedAt)} by ${viewing.appliedByName || viewing.name}`],
              ['Reporting manager', viewing.managerName ?? '—'],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="font-semibold text-slate-500">{k}</dt><dd className="text-slate-900 font-medium">{v}</dd></div>
            ))}
            <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Reason</dt><dd className="text-slate-900 font-medium whitespace-pre-wrap">{viewing.reason}</dd></div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Status</dt>
              <dd className="space-y-1 mt-0.5">
                <StatusPill status={viewing.status} />
                <div className="text-slate-700">{viewing.status === 'pending' ? 'Waiting for a decision' : `${viewing.status === 'approved' ? 'Approved' : 'Rejected'} by ${viewing.actionByName ?? '—'} · ${formatStamp(viewing.actionAt)}`}</div>
                {viewing.comment && <div className="text-slate-600">“{viewing.comment}”</div>}
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(undoing)}
        title="Undo decision"
        message={undoing ? <>Take back the {undoing.status} decision on the request of <strong>{undoing.name}</strong> for {formatDate(undoing.date)}? It goes back to pending.{role === 'reporting_manager' ? ' You can undo a decision only once.' : ''} This is recorded in the audit log.</> : ''}
        confirmLabel="Undo decision"
        busy={undoBusy}
        error={undoError}
        onConfirm={(reason) => void confirmUndo(reason)}
        onCancel={() => setUndoing(null)}
      />

      {canApply && (
        <ConfirmDialog
          open={Boolean(deleting)}
          title="Delete request"
          message={deleting ? <>Delete the {STATUS_META[deleting.status].label.toLowerCase()} request of <strong>{deleting.name}</strong> for {formatDate(deleting.date)}?This is recorded in the audit log.</> : ''}
          confirmLabel="Delete"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={(reason) => void confirmDelete(reason)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
};
