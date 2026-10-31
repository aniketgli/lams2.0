import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, CalendarDays, Check, CheckCircle2, Clock, Eye, Globe, MapPin, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { DataTable, Input, Modal, Select } from '../../../../shared/components';
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
import { OdInput, OdList, OdRequest, OdStatus, OdType, odApi } from '../odApi';

/**
 * Outdoor Duty (OD): official work away from the institute.
 *
 *   User                       : applies for themselves; edits / deletes before a decision and before the start date
 *   Reporting Manager          : approves / rejects the OD of the people who report to them (up to the start date), undoes once
 *   HoD (reviewing manager)    : sees the OD of the people under them
 *   Administrator              : applies for anyone, edits / deletes before a decision, approves / rejects, undoes any time
 *   Auditor                    : sees every request, plus the activity log (who did what, when)
 * An approved OD shows as "OD" on the Attendance page. The server checks every rule.
 */

const STATUS_META: Record<OdStatus, { label: string; pill: string }> = {
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-800 border-amber-200' },
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', pill: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const STATUSES = Object.keys(STATUS_META) as OdStatus[];
const OD_TYPES: OdType[] = ['Domestic', 'International'];
const PAGE_SIZES = [25, 50, 100];

const OD_ACTIVITY: ActivitySource = {
  title: 'Outdoor duty activity log',
  recordLabel: 'Request',
  searchPlaceholder: 'Employee, location, done by, reason…',
  areas: [{ value: 'outdoor_duty', label: 'Outdoor duty' }, { value: 'outdoor_duty_export', label: 'Log download' }],
  actions: ['CREATE', 'UPDATE', 'STATUS', 'DELETE', 'EXPORT'],
  actionLabels: { CREATE: 'Applied', UPDATE: 'Edited', STATUS: 'Approved / rejected', DELETE: 'Deleted', EXPORT: 'Downloaded' },
  ...activityEndpoints('/hrms/outdoor-duty/activity', 'WII_Outdoor_Duty_Activity.csv'),
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
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const duration = (r: OdRequest) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`);

const StatusPill: React.FC<{ status: OdStatus }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${STATUS_META[status].pill}`}>{STATUS_META[status].label}</span>
);

const EMPTY_FORM: OdInput = {
  userId: '', startDate: '', endDate: '', startTime: '09:00', endTime: '17:30', odType: 'Domestic', location: '', estimatedFunds: '', fundingSource: '', purpose: '',
};

export const OutdoorDutyView: React.FC = () => {
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
  const defaultTo = localDate(60);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<OdList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useNotice();
  const [auditorView, setAuditorView] = useState<'records' | 'activity'>('records');

  const load = useCallback(async (silent = false) => {
    if (from > to) { setData(null); setError('The From date must be on or before the To date.'); return; }
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await odApi.list(from, to));
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
  const [types, setTypes] = useState<string[]>(['all']);
  const [employees, setEmployees] = useState<string[]>(['all']);
  const [departments, setDepartments] = useState<string[]>(['all']);
  const distinct = (pick: (r: OdRequest) => string) => [...new Set(requests.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const opt = (values: string[]) => values.map((v) => ({ label: v, value: v }));
  const filtered = Boolean(search.trim()) || [statuses, types, employees, departments].some((f) => !f.includes('all')) || from !== defaultFrom || to !== defaultTo;
  const resetAll = () => {
    setSearch(''); [setStatuses, setTypes, setEmployees, setDepartments].forEach((set) => set(['all']));
    setFrom(defaultFrom); setTo(defaultTo);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) =>
      matchesMultiSelect(statuses, r.status) && matchesMultiSelect(types, r.odType) &&
      (!teamView || (matchesMultiSelect(employees, r.userId) && matchesMultiSelect(departments, r.department))) &&
      (!q || [r.name, r.biometricId, r.department, r.designation, r.location, r.purpose, r.fundingSource, r.odType, formatDate(r.startDate), formatDate(r.endDate), r.comment, r.managerName, STATUS_META[r.status].label]
        .some((v) => (v || '').toLowerCase().includes(q))));
  }, [requests, search, statuses, types, employees, departments, teamView]);

  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  useEffect(() => setPage(1), [visible.length, pageSize, sort]);

  const range = `${formatDate(from)} – ${formatDate(to)}`;
  const stats = useMemo(() => ({
    approved: visible.filter((r) => r.status === 'approved').length,
    pending: visible.filter((r) => r.status === 'pending').length,
    days: visible.filter((r) => r.status === 'approved').reduce((n, r) => n + r.daysCount, 0),
  }), [visible]);
  const statCards = [
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Pending', value: stats.pending, icon: Clock, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Total applied', value: visible.length, icon: MapPin, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
    { label: 'OD days (approved)', value: stats.days, icon: CalendarDays, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  ];

  // ---- Apply / edit ------------------------------------------------------------------
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OdRequest | null>(null);
  const [form, setForm] = useState<OdInput>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setField = <K extends keyof OdInput>(key: K, value: OdInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };
  const openApply = () => { setEditing(null); setForm(EMPTY_FORM); setFormErrors({}); setFormMessage(null); setFormOpen(true); };
  const openEdit = (r: OdRequest) => {
    setEditing(r);
    setForm({
      userId: r.userId, startDate: r.startDate, endDate: r.endDate, startTime: r.startTime, endTime: r.endTime, odType: r.odType, location: r.location,
      estimatedFunds: r.estimatedFunds ? String(r.estimatedFunds) : '', fundingSource: r.fundingSource ?? '', purpose: r.purpose,
    });
    setFormErrors({}); setFormMessage(null); setFormOpen(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setFormMessage(null);
    try {
      const result = editing ? await odApi.update(editing.id, form) : await odApi.create(form);
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

  // ---- Approve / reject / undo / delete ---------------------------------------------------------
  const [deciding, setDeciding] = useState<{ request: OdRequest; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [decideBusy, setDecideBusy] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const openDecide = (request: OdRequest, action: 'approve' | 'reject') => { setDeciding({ request, action }); setComment(''); setDecideError(null); };
  const confirmDecide = async () => {
    if (!deciding || decideBusy) return;
    if (deciding.action === 'reject' && comment.trim().length < 3) { setDecideError('Say why the request is rejected.'); return; }
    setDecideBusy(true); setDecideError(null);
    try {
      const result = await odApi.decide(deciding.request.id, deciding.action, comment.trim());
      setDeciding(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setDecideError(error instanceof ApiError ? [error.message, ...Object.values(error.details ?? {})].filter(Boolean).join(' ') : 'The decision could not be saved.');
    } finally {
      setDecideBusy(false);
    }
  };

  const [undoing, setUndoing] = useState<OdRequest | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const confirmUndo = async (reason: string) => {
    if (!undoing) return;
    setUndoBusy(true); setUndoError(null);
    try {
      const result = await odApi.undo(undoing.id, reason);
      setUndoing(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : 'The decision could not be undone.');
    } finally {
      setUndoBusy(false);
    }
  };

  const [deleting, setDeleting] = useState<OdRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmDelete = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      const result = await odApi.remove(deleting.id, reason);
      setDeleting(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The request could not be deleted.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const [viewing, setViewing] = useState<OdRequest | null>(null);

  // ---- Table ---------------------------------------------------------------------------------
  const iconBtn = 'w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer shrink-0';
  const statusBy = (r: OdRequest) => (r.status === 'pending' ? `by ${r.managerName ?? 'Administrator'}` : `by ${r.actionByName ?? '—'}`);
  const columns: ColumnDef<OdRequest>[] = [
    ...(teamView ? [{
      key: 'employee', header: 'Employee', width: '15%', sortValue: (r: OdRequest) => r.name,
      render: (r: OdRequest) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar name={r.name} src={(userById.get(r.userId) as { avatar?: string } | undefined)?.avatar || null} className="w-8 h-8 rounded-full shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-slate-900 truncate">{r.name}</div>
            <div className="text-[11px] text-slate-500 truncate">B.I. {r.biometricId}{r.designation ? ` · ${r.designation}` : ''}</div>
          </div>
        </div>
      ),
    } as ColumnDef<OdRequest>] : []),
    {
      key: 'date', header: 'Duration', width: teamView ? '14%' : '16%', sortValue: (r) => r.startDate,
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-900 whitespace-nowrap">{duration(r)}</div>
          <div className="text-[11px] text-slate-500 whitespace-nowrap">{r.startTime} – {r.endTime} · {r.daysCount} {r.daysCount === 1 ? 'day' : 'days'}</div>
        </div>
      ),
    },
    {
      key: 'applied', header: 'Applied date', width: teamView ? '9%' : '11%', sortValue: (r) => r.appliedAt,
      render: (r) => (
        <div className="leading-tight">
          <div className="text-slate-800 whitespace-nowrap">{formatDate(r.appliedAt.slice(0, 10))}</div>
          <div className="text-[11px] text-slate-500 whitespace-nowrap">{new Date(r.appliedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', width: '8%', sortValue: (r) => r.odType, render: (r) => <span className="font-semibold text-slate-800">{r.odType}</span> },
    { key: 'location', header: 'Location', width: teamView ? '12%' : '15%', sortValue: (r) => r.location, render: (r) => <div className="whitespace-normal leading-snug min-w-[110px] text-slate-800 line-clamp-2" title={r.location}>{r.location}</div> },
    {
      key: 'funds', header: 'Funds', width: teamView ? '9%' : '10%', sortValue: (r) => r.estimatedFunds,
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-800 whitespace-nowrap">{rupees(r.estimatedFunds)}</div>
          {r.fundingSource && <div className="text-[11px] text-slate-500 truncate max-w-[130px]" title={r.fundingSource}>{r.fundingSource}</div>}
        </div>
      ),
    },
    { key: 'purpose', header: 'Purpose', width: teamView ? '13%' : '16%', sortValue: (r) => r.purpose, render: (r) => <div className="whitespace-normal leading-snug min-w-[120px] text-slate-700 line-clamp-2" title={r.purpose}>{r.purpose}</div> },
    {
      key: 'status', header: 'Status', width: teamView ? '11%' : '13%', sortValue: (r) => r.status,
      render: (r) => (
        <div className="leading-tight space-y-1">
          <StatusPill status={r.status} />
          <div className="text-[11px] text-slate-500 truncate" title={statusBy(r)}>{statusBy(r)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions', width: teamView ? '16%' : '14%', align: 'center',
      render: (r: OdRequest) => (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => setViewing(r)} title="View" aria-label={`View outdoor duty of ${r.name}`}
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
    const value = columns.find((c) => c.key === sort.key)?.sortValue ?? ((r: OdRequest) => r.startDate);
    const dir = sort.dir === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    return [...visible].sort((a, b) => {
      const x = value(a), y = value(b);
      const primary = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x ?? ''), String(y ?? ''));
      return primary * dir || b.startDate.localeCompare(a.startDate) || Number(b.id) - Number(a.id);
    });
    // columns are rebuilt each render; their sort values depend only on the row
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  // ---- Downloads -------------------------------------------------------------------------------
  const exportHeaders = [...(teamView ? ['Biometric ID', 'Employee', 'Department'] : []), 'Type', 'Start date', 'End date', 'Start time', 'End time', 'Days', 'Location', 'Estimated funds', 'Budget head', 'Purpose', 'Applied on', 'Status', 'Decided / pending with', 'Comment'];
  const exportRows = () => sorted.map((r) => [
    ...(teamView ? [r.biometricId, r.name, r.department] : []),
    r.odType, formatDate(r.startDate), formatDate(r.endDate), r.startTime, r.endTime, r.daysCount, r.location, r.estimatedFunds, r.fundingSource ?? '', r.purpose,
    formatDate(r.appliedAt.slice(0, 10)), STATUS_META[r.status].label, statusBy(r).replace(/^by /, ''), r.comment ?? '',
  ]);
  const fileName = `WII_Outdoor_Duty_${from}_to_${to}`;
  const downloadCsv = () => downloadCsvText(toCsvText(exportHeaders, exportRows()), fileName);
  const downloadPdf = () => downloadTablePdf({
    title: 'Outdoor Duty',
    subtitle: [`${range} · Generated ${printedAt(new Date().toISOString())}`, teamView ? 'All requests shown' : currentUser.name],
    headers: exportHeaders,
    rows: exportRows(),
    fileName,
    columnWidths: teamView ? [5, 9, 9, 6, 6, 6, 4, 4, 3, 10, 5, 7, 13, 6, 6, 5, 5] : [6, 7, 7, 4, 4, 3, 12, 6, 8, 18, 7, 6, 6, 6],
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

  const subtitle = isAdmin ? 'Apply, edit, approve and reject outdoor duty of all employees'
    : isAudit ? 'All outdoor duty requests, and the log of who did what'
    : role === 'reporting_manager' ? 'Your outdoor duty, and your team’s requests to approve or reject'
    : role === 'reviewing_manager' ? 'Your outdoor duty, and the requests of the people under you'
    : 'Apply for outdoor duty and follow the status of your requests';

  const dateRange = (
    <div className="flex items-center gap-1.5">
      <div className="w-36"><AppDatePicker size="sm" placeholder="From date" value={from} onChange={setFrom} /></div>
      <span className="text-slate-300 font-bold">—</span>
      <div className="w-36"><AppDatePicker size="sm" placeholder="To date" value={to} onChange={setTo} isRightColumn /></div>
    </div>
  );

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={Globe}
        title="Outdoor Duty (OD)"
        subtitle={subtitle}
        rightAction={canApply ? (
          <button type="button" onClick={openApply}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-2xs cursor-pointer">
            <Plus className="w-4 h-4" /> Apply OD
          </button>
        ) : undefined}
      />

      <NoticeBar notice={notice} onClose={clearNotice} />

      {isAudit && auditorView === 'activity' ? (
        <ActivityLogPanel source={OD_ACTIVITY} toolbarStart={auditorSwitch} />
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

          {error && <div role="alert" className="px-4 py-3 rounded-2xl border text-xs font-semibold bg-error-subtle border-error-border text-error">{error}</div>}

          <FilterToolbar
            start={auditorSwitch ?? dateRange}
            exports={{
              onCsv: downloadCsv, onPdf: downloadPdf, disabled: sorted.length === 0,
              csvTitle: 'Download the requests shown below as CSV', pdfTitle: 'Download the requests shown below as PDF',
            }}
            search={{ value: search, onChange: setSearch, placeholder: teamView ? 'Search employee, location, purpose, funding…' : 'Search location, purpose, funding…' }}
            onReset={filtered ? resetAll : null}
            filters={[
              isAudit && <div key="range">{dateRange}</div>,
              teamView && <MultiSelectFilter key="emp" label="Employee" options={employeeOptions} selectedValues={employees} onChange={setEmployees} />,
              teamView && <MultiSelectFilter key="dept" label="Department" options={opt(distinct((r) => r.department))} selectedValues={departments} onChange={setDepartments} />,
              <MultiSelectFilter key="type" label="OD type" options={opt(data?.types ?? OD_TYPES)} selectedValues={types} onChange={setTypes} />,
              <MultiSelectFilter key="status" label="Status" options={STATUSES.map((s) => ({ label: STATUS_META[s].label, value: s }))} selectedValues={statuses} onChange={setStatuses} />,
            ].filter(Boolean) as React.ReactNode[]}
          />

          <DataTable
            columns={columns}
            data={pageRows}
            loading={loading}
            keyExtractor={(r) => r.id}
            className={teamView ? 'min-w-[1300px]' : 'min-w-[1000px]'}
            sortColumn={sort.key}
            sortDirection={sort.dir}
            onSort={(key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
            emptyTitle={requests.length ? 'No requests match these filters' : 'No outdoor duty requests'}
            emptyDescription={requests.length ? 'Change the filters or search.' : canApply ? 'Choose other dates, or apply for outdoor duty.' : 'Choose other dates.'}
            pagination={{
              currentPage: page, totalPages, totalItems: sorted.length, pageSize,
              onPageChange: setPage, onPageSizeChange: setPageSize, pageSizeOptions: PAGE_SIZES,
            }}
          />
        </>
      )}

      {canApply && (
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          size="lg"
          title={editing ? 'Edit outdoor duty' : 'Apply for Outdoor Duty (OD)'}
          subtitle={editing ? `${editing.name} · ${duration(editing)}` : isAdmin ? 'Dates up to 60 days back can be entered' : 'Start date from today'}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" form="od-form" disabled={saving} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Submit'}
              </button>
            </div>
          )}
        >
          <form id="od-form" onSubmit={save} noValidate className="space-y-4">
            {formMessage && <NoticeBar notice={{ kind: 'error', text: formMessage }} onClose={() => setFormMessage(null)} />}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="OD type">
              {OD_TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={form.odType === t} onClick={() => setField('odType', t)}
                  className={`h-9 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${form.odType === t ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                  {t === 'Domestic' ? <Briefcase className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}{t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isAdmin && (
                <div className="sm:col-span-2" title={formErrors.userId || undefined}>
                  <Select label="Employee" required value={form.userId} disabled={Boolean(editing)} searchable placeholder="Select employee" error={Boolean(formErrors.userId)}
                    onChange={(v: string) => setField('userId', v)}
                    options={(data?.employees ?? []).map((e) => ({ label: `${e.name} (${e.biometricId})${e.designation ? ` · ${e.designation}` : ''}`, value: e.id }))} />
                </div>
              )}
              <div className={formErrors.startDate ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.startDate || undefined}>
                <AppDatePicker label="Start Date *" value={form.startDate} placeholder="Select date" minDate={isAdmin ? localDate(-60) : today}
                  onChange={(v) => { setField('startDate', v); if (!form.endDate || form.endDate < v) setField('endDate', v); }} className="w-full" />
              </div>
              <div className={formErrors.endDate ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.endDate || undefined}>
                <AppDatePicker label="End Date *" value={form.endDate} placeholder="Select date" minDate={form.startDate || undefined}
                  onChange={(v) => setField('endDate', v)} className="w-full" />
              </div>
              <div className={formErrors.startTime ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.startTime || undefined}>
                <AppTimePicker label="Start Time" required value={form.startTime} placeholder="HH:mm" onChange={(v) => setField('startTime', v)} className="w-full" />
              </div>
              <div className={formErrors.endTime ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.endTime || undefined}>
                <AppTimePicker label="End Time" required value={form.endTime} placeholder="HH:mm" align="right" onChange={(v) => setField('endTime', v)} className="w-full" />
              </div>
              <div className="sm:col-span-2">
                <Input label="Location" required maxLength={200} value={form.location} error={Boolean(formErrors.location)} title={formErrors.location || undefined}
                  placeholder="e.g. Regional Field Lab, Dehradun / Stakeholder HQ, New Delhi" onChange={(e) => setField('location', e.target.value)} />
              </div>
              <Input label="Estimated Funds (₹)" type="number" min={0} step="0.01" value={form.estimatedFunds} error={Boolean(formErrors.estimatedFunds)} title={formErrors.estimatedFunds || undefined}
                onChange={(e) => setField('estimatedFunds', e.target.value)} />
              <Input label="Budget Head" maxLength={100} value={form.fundingSource} error={Boolean(formErrors.fundingSource)} title={formErrors.fundingSource || undefined}
                placeholder="e.g. Institutional Travel Fund" onChange={(e) => setField('fundingSource', e.target.value)} />
            </div>
            <Textarea label="Official Purpose & Agenda *" rows={3} maxLength={1000} value={form.purpose} error={Boolean(formErrors.purpose)}
              placeholder="Detail the scientific, administrative or project purpose of this outdoor duty…" onChange={(e) => setField('purpose', e.target.value)} />
          </form>
        </Modal>
      )}

      <Modal
        isOpen={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        size="sm"
        title={deciding?.action === 'approve' ? 'Approve outdoor duty' : 'Reject outdoor duty'}
        subtitle={deciding ? `${deciding.request.name} · ${duration(deciding.request)}` : undefined}
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
              {deciding.request.odType} OD to {deciding.request.location} · {rupees(deciding.request.estimatedFunds)}{deciding.request.fundingSource ? ` (${deciding.request.fundingSource})` : ''}. {deciding.request.purpose}
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
        title="Outdoor duty request"
        subtitle={viewing ? `${viewing.name} · ${duration(viewing)}` : undefined}
        footer={<div className="flex justify-end"><button type="button" onClick={() => setViewing(null)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Close</button></div>}
      >
        {viewing && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            {([
              ['Employee', `${viewing.name} (B.I. ${viewing.biometricId})`],
              ['Designation / department', [viewing.designation, viewing.department].filter(Boolean).join(' · ') || '—'],
              ['Type', viewing.odType],
              ['Location', viewing.location],
              ['From', `${formatDate(viewing.startDate)}, ${viewing.startTime}`],
              ['To', `${formatDate(viewing.endDate)}, ${viewing.endTime}`],
              ['Days', String(viewing.daysCount)],
              ['Estimated funds', `${rupees(viewing.estimatedFunds)}${viewing.fundingSource ? ` · ${viewing.fundingSource}` : ''}`],
              ['Applied', `${formatStamp(viewing.appliedAt)} by ${viewing.appliedByName || viewing.name}`],
              ['Reporting manager', viewing.managerName ?? '—'],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="font-semibold text-slate-500">{k}</dt><dd className="text-slate-900 font-medium">{v}</dd></div>
            ))}
            <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Official purpose & agenda</dt><dd className="text-slate-900 font-medium whitespace-pre-wrap">{viewing.purpose}</dd></div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Status</dt>
              <dd className="space-y-1 mt-0.5">
                <StatusPill status={viewing.status} />
                <div className="text-slate-700">{viewing.status === 'pending' ? `Waiting for ${viewing.managerName ?? 'an administrator'}` : `${viewing.status === 'approved' ? 'Approved' : 'Rejected'} by ${viewing.actionByName ?? '—'} · ${formatStamp(viewing.actionAt)}`}</div>
                {viewing.comment && <div className="text-slate-600">“{viewing.comment}”</div>}
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(undoing)}
        title="Undo decision"
        message={undoing ? <>Take back the {undoing.status} decision on the outdoor duty of <strong>{undoing.name}</strong> ({duration(undoing)})? It goes back to pending.{role === 'reporting_manager' ? ' You can undo a decision only once.' : ''} This is recorded in the audit log.</> : ''}
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
          message={deleting ? <>Delete the outdoor duty of <strong>{deleting.name}</strong> ({duration(deleting)})? This is recorded in the audit log.</> : ''}
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
