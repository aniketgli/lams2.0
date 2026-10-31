import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, ChevronsRight, Clock, Eye, FileText, Pencil, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { DataTable, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { Textarea } from '../../../../shared/components/forms/Textarea';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { ApiError } from '../../../../shared/services/api';
import { downloadCsvText, downloadTablePdf, printedAt, toCsvText } from '../../../../shared/services/printTable';
import { ConfirmDialog, NoticeBar, useNotice } from '../../master/components/masterUi';
import { LeaveInput, LeaveList, LeavePreview, LeaveRequest, LeaveStatus, leaveApi } from '../leaveApi';

/**
 * Leave requests. The server decides everything (days, balance, who may do what); this page only shows it.
 *   User              applies for themselves; edits / deletes until the reporting manager has looked at it
 *   Reporting Manager approves, or forwards to the HoD for a two-stage leave; rejects; undoes once
 *   HoD               approves / rejects what was forwarded; undoes once
 *   Administrator     applies for anyone, decides at any stage, undoes any time
 *   Auditor           sees everything (the activity log is a separate tab)
 */

const STATUS_META: Record<LeaveStatus, { label: string; pill: string }> = {
  pending_l1: { label: 'Pending', pill: 'bg-amber-50 text-amber-800 border-amber-200' },
  pending_l2: { label: 'With HoD', pill: 'bg-sky-50 text-sky-700 border-sky-200' },
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', pill: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const STATUSES = Object.keys(STATUS_META) as LeaveStatus[];
const PAGE_SIZES = [25, 50, 100];

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
const duration = (r: LeaveRequest) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`);
const halves = (r: LeaveRequest) => [r.startSession === 'second_half' ? 'starts after lunch' : '', r.endSession === 'first_half' ? 'ends before lunch' : ''].filter(Boolean).join(', ');
const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

const StatusPill: React.FC<{ status: LeaveStatus }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${STATUS_META[status].pill}`}>{STATUS_META[status].label}</span>
);

/** Who the status line names: the person it waits for, or who decided. */
const statusBy = (r: LeaveRequest) =>
  r.status === 'pending_l1' ? `with ${r.managerName ?? 'Administrator'}`
    : r.status === 'pending_l2' ? `with ${r.reviewerName ?? 'HoD'}`
    : `by ${r.actionByName ?? '—'}`;

const EMPTY_FORM: LeaveInput = { userId: '', leaveTypeId: '', startDate: '', endDate: '', startSession: 'full', endSession: 'full', reason: '', certificate: false };

export const LeaveRequestsView: React.FC<{ applySignal: number }> = ({ applySignal }) => {
  const { currentUser, users } = useApp();
  const role = currentUser.role;
  const isAdmin = role === 'administrator';
  const isAudit = role === 'audit';
  const isManager = role === 'reporting_manager' || role === 'reviewing_manager';
  const canApply = isAdmin || role === 'general_staff';
  const teamView = isAdmin || isAudit || isManager;

  // ---- Data -----------------------------------------------------------------------------
  const today = localDate();
  const defaultFrom = localDate(-90);
  const defaultTo = localDate(90);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<LeaveList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useNotice();

  const load = useCallback(async (silent = false) => {
    if (from > to) { setData(null); setError('The From date must be on or before the To date.'); return; }
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await leaveApi.list(from, to));
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

  // ---- Filters ------------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>(['all']);
  const [leaveTypes, setLeaveTypes] = useState<string[]>(['all']);
  const [employees, setEmployees] = useState<string[]>(['all']);
  const [departments, setDepartments] = useState<string[]>(['all']);
  const distinct = (pick: (r: LeaveRequest) => string) => [...new Set(requests.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const opt = (values: string[]) => values.map((v) => ({ label: v, value: v }));
  const filtered = Boolean(search.trim()) || [statuses, leaveTypes, employees, departments].some((f) => !f.includes('all')) || from !== defaultFrom || to !== defaultTo;
  const resetAll = () => {
    setSearch(''); [setStatuses, setLeaveTypes, setEmployees, setDepartments].forEach((set) => set(['all']));
    setFrom(defaultFrom); setTo(defaultTo);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) =>
      matchesMultiSelect(statuses, r.status) && matchesMultiSelect(leaveTypes, r.leaveTypeId) &&
      (!teamView || (matchesMultiSelect(employees, r.userId) && matchesMultiSelect(departments, r.department))) &&
      (!q || [r.name, r.biometricId, r.department, r.designation, r.leaveTypeName, r.leaveTypeCode, r.reason, formatDate(r.startDate), formatDate(r.endDate), r.comment, r.managerName, r.reviewerName, STATUS_META[r.status].label]
        .some((v) => (v || '').toLowerCase().includes(q))));
  }, [requests, search, statuses, leaveTypes, employees, departments, teamView]);

  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  useEffect(() => setPage(1), [visible.length, pageSize, sort]);

  const range = `${formatDate(from)} – ${formatDate(to)}`;
  const stats = useMemo(() => ({
    approved: visible.filter((r) => r.status === 'approved').length,
    pending: visible.filter((r) => r.status === 'pending_l1' || r.status === 'pending_l2').length,
    rejected: visible.filter((r) => r.status === 'rejected').length,
    days: visible.filter((r) => r.status === 'approved').reduce((n, r) => n + r.daysCount, 0),
  }), [visible]);
  const statCards = [
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Pending', value: stats.pending, icon: Clock, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: 'Leave days (approved)', value: stats.days, icon: CalendarDays, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  ];

  // ---- Apply / edit ---------------------------------------------------------------------------------
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const [form, setForm] = useState<LeaveInput>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const setField = <K extends keyof LeaveInput>(key: K, value: LeaveInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };
  const openApply = () => { setEditing(null); setForm(EMPTY_FORM); setFormErrors({}); setFormMessage(null); setPreview(null); setFormOpen(true); };
  useEffect(() => { if (applySignal > 0 && canApply) openApply(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [applySignal]);
  const openEdit = (r: LeaveRequest) => {
    setEditing(r);
    setForm({ userId: r.userId, leaveTypeId: r.leaveTypeId, startDate: r.startDate, endDate: r.endDate, startSession: r.startSession, endSession: r.endSession, reason: r.reason, certificate: r.certificate });
    setFormErrors({}); setFormMessage(null); setPreview(null); setFormOpen(true);
  };

  const type = data?.types.find((t) => t.id === form.leaveTypeId) ?? null;

  // The server works out the days and the balance while the form is filled.
  useEffect(() => {
    if (!formOpen || !form.leaveTypeId || !form.startDate || !form.endDate || (isAdmin && !form.userId)) { setPreview(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      leaveApi.preview(form).then((p) => { if (!cancelled) setPreview(p); }).catch(() => { if (!cancelled) setPreview(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formOpen, isAdmin, form.userId, form.leaveTypeId, form.startDate, form.endDate, form.startSession, form.endSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsCertificate = Boolean(type && type.medicalCertDays > 0 && preview && preview.days > type.medicalCertDays);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setFormMessage(null);
    try {
      const result = editing ? await leaveApi.update(editing.id, form) : await leaveApi.create(form);
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

  // ---- Approve / forward / reject / undo / delete -----------------------------------------------------
  const [deciding, setDeciding] = useState<{ request: LeaveRequest; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [decideBusy, setDecideBusy] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const openDecide = (request: LeaveRequest, action: 'approve' | 'reject') => { setDeciding({ request, action }); setComment(''); setDecideError(null); };
  const forwarding = Boolean(deciding && deciding.action === 'approve' && deciding.request.decideStep === 'forward');
  const confirmDecide = async () => {
    if (!deciding || decideBusy) return;
    if (deciding.action === 'reject' && comment.trim().length < 3) { setDecideError('Say why the request is rejected.'); return; }
    setDecideBusy(true); setDecideError(null);
    try {
      const result = await leaveApi.decide(deciding.request.id, deciding.action, comment.trim());
      setDeciding(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setDecideError(error instanceof ApiError ? [error.message, ...Object.values(error.details ?? {})].filter(Boolean).join(' ') : 'The decision could not be saved.');
    } finally {
      setDecideBusy(false);
    }
  };

  const [undoing, setUndoing] = useState<LeaveRequest | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const confirmUndo = async (reason: string) => {
    if (!undoing) return;
    setUndoBusy(true); setUndoError(null);
    try {
      const result = await leaveApi.undo(undoing.id, reason);
      setUndoing(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : 'The step could not be undone.');
    } finally {
      setUndoBusy(false);
    }
  };

  const [deleting, setDeleting] = useState<LeaveRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmDelete = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      const result = await leaveApi.remove(deleting.id, reason);
      setDeleting(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The request could not be deleted.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const [viewing, setViewing] = useState<LeaveRequest | null>(null);

  // ---- Table ---------------------------------------------------------------------------------------------
  const iconBtn = 'w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer shrink-0';
  const columns: ColumnDef<LeaveRequest>[] = [
    ...(teamView ? [{
      key: 'employee', header: 'Employee', width: '16%', sortValue: (r: LeaveRequest) => r.name,
      render: (r: LeaveRequest) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar name={r.name} src={(userById.get(r.userId) as { avatar?: string } | undefined)?.avatar || null} className="w-8 h-8 rounded-full shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-slate-900 truncate">{r.name}</div>
            <div className="text-[11px] text-slate-500 truncate">B.I. {r.biometricId}{r.designation ? ` · ${r.designation}` : ''}</div>
          </div>
        </div>
      ),
    } as ColumnDef<LeaveRequest>] : []),
    {
      key: 'type', header: 'Leave type', width: teamView ? '12%' : '15%', sortValue: (r) => r.leaveTypeName,
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-900">{r.leaveTypeName}</div>
          <div className="font-mono text-[11px] text-slate-500">{r.leaveTypeCode}</div>
        </div>
      ),
    },
    {
      key: 'date', header: 'Duration', width: teamView ? '15%' : '18%', sortValue: (r) => r.startDate,
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-900 whitespace-nowrap">{duration(r)}</div>
          <div className="text-[11px] text-slate-500 whitespace-normal">{daysText(r.daysCount)}{halves(r) ? ` · ${halves(r)}` : ''}</div>
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
    { key: 'reason', header: 'Reason', width: teamView ? '17%' : '22%', sortValue: (r) => r.reason, render: (r) => <div className="whitespace-normal leading-snug min-w-[120px] text-slate-700 line-clamp-2" title={r.reason}>{r.reason}</div> },
    {
      key: 'status', header: 'Status', width: teamView ? '12%' : '14%', sortValue: (r) => r.status,
      render: (r) => (
        <div className="leading-tight space-y-1">
          <StatusPill status={r.status} />
          <div className="text-[11px] text-slate-500 truncate" title={statusBy(r)}>{statusBy(r)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions', width: teamView ? '16%' : '14%', align: 'center',
      render: (r: LeaveRequest) => (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => setViewing(r)} title="View" aria-label={`View leave of ${r.name}`}
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
              <button type="button" onClick={() => openDecide(r, 'approve')} title={r.decideStep === 'forward' ? 'Forward to HoD' : 'Approve'} aria-label={`${r.decideStep === 'forward' ? 'Forward' : 'Approve'} ${r.name}`}
                className={`${iconBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>{r.decideStep === 'forward' ? <ChevronsRight className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}</button>
              <button type="button" onClick={() => openDecide(r, 'reject')} title="Reject" aria-label={`Reject ${r.name}`}
                className={`${iconBtn} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}><X className="w-3.5 h-3.5" /></button>
            </>
          )}
          {r.canUndo && (
            <button type="button" onClick={() => { setUndoing(r); setUndoError(null); }} title="Undo the last step" aria-label={`Undo the last step on ${r.name}`}
              className={`${iconBtn} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}><RotateCcw className="w-3.5 h-3.5" /></button>
          )}
        </div>
      ),
    },
  ];

  const sorted = useMemo(() => {
    const value = columns.find((c) => c.key === sort.key)?.sortValue ?? ((r: LeaveRequest) => r.startDate);
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

  // ---- Downloads --------------------------------------------------------------------------------------------
  const exportHeaders = [...(teamView ? ['Biometric ID', 'Employee', 'Department'] : []), 'Leave type', 'Start date', 'End date', 'Days', 'Reason', 'Applied on', 'Status', 'With / decided by', 'Comment'];
  const exportRows = () => sorted.map((r) => [
    ...(teamView ? [r.biometricId, r.name, r.department] : []),
    `${r.leaveTypeName} (${r.leaveTypeCode})`, formatDate(r.startDate), formatDate(r.endDate), r.daysCount, r.reason, formatDate(r.appliedAt.slice(0, 10)),
    STATUS_META[r.status].label, statusBy(r).replace(/^(by|with) /, ''), r.comment ?? '',
  ]);
  const fileName = `WII_Leave_${from}_to_${to}`;
  const downloadCsv = () => downloadCsvText(toCsvText(exportHeaders, exportRows()), fileName);
  const downloadPdf = () => downloadTablePdf({
    title: 'Leave requests',
    subtitle: [`${range} · Generated ${printedAt(new Date().toISOString())}`, teamView ? 'All requests shown' : currentUser.name],
    headers: exportHeaders,
    rows: exportRows(),
    fileName,
    columnWidths: teamView ? [6, 9, 9, 10, 8, 8, 4, 16, 8, 7, 7, 8] : [12, 9, 9, 4, 20, 9, 9, 10, 10],
  });

  const employeeOptions = [...new Map(requests.map((r) => [r.userId, `${r.name} (${r.biometricId})`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value }));

  const dateRange = (
    <div className="flex items-center gap-1.5">
      <div className="w-36"><AppDatePicker size="sm" placeholder="From date" value={from} onChange={setFrom} /></div>
      <span className="text-slate-300 font-bold">—</span>
      <div className="w-36"><AppDatePicker size="sm" placeholder="To date" value={to} onChange={setTo} isRightColumn /></div>
    </div>
  );

  const sessionOptions = {
    start: [{ label: 'Full day', value: 'full' }, { label: 'Second half only (after lunch)', value: 'second_half' }],
    end: [{ label: 'Full day', value: 'full' }, { label: 'First half only (before lunch)', value: 'first_half' }],
  };

  return (
    <div className="space-y-5">
      <NoticeBar notice={notice} onClose={clearNotice} />

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
        start={dateRange}
        exports={{
          onCsv: downloadCsv, onPdf: downloadPdf, disabled: sorted.length === 0,
          csvTitle: 'Download the requests shown below as CSV', pdfTitle: 'Download the requests shown below as PDF',
        }}
        search={{ value: search, onChange: setSearch, placeholder: teamView ? 'Search employee, leave type, reason…' : 'Search leave type, reason…' }}
        onReset={filtered ? resetAll : null}
        filters={[
          teamView && <MultiSelectFilter key="emp" label="Employee" options={employeeOptions} selectedValues={employees} onChange={setEmployees} />,
          teamView && <MultiSelectFilter key="dept" label="Department" options={opt(distinct((r) => r.department))} selectedValues={departments} onChange={setDepartments} />,
          <MultiSelectFilter key="type" label="Leave type" options={[...new Map(requests.map((r) => [r.leaveTypeId, `${r.leaveTypeName} (${r.leaveTypeCode})`])).entries()].map(([value, label]) => ({ label, value }))}
            selectedValues={leaveTypes} onChange={setLeaveTypes} />,
          <MultiSelectFilter key="status" label="Status" options={STATUSES.map((s) => ({ label: STATUS_META[s].label, value: s }))} selectedValues={statuses} onChange={setStatuses} />,
        ].filter(Boolean) as React.ReactNode[]}
      />

      <DataTable
        columns={columns}
        data={pageRows}
        loading={loading}
        keyExtractor={(r) => r.id}
        className={teamView ? 'min-w-[1200px]' : 'min-w-[950px]'}
        sortColumn={sort.key}
        sortDirection={sort.dir}
        onSort={(key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
        emptyTitle={requests.length ? 'No requests match these filters' : 'No leave requests'}
        emptyDescription={requests.length ? 'Change the filters or search.' : canApply ? 'Choose other dates, or apply for leave.' : 'Choose other dates.'}
        pagination={{
          currentPage: page, totalPages, totalItems: sorted.length, pageSize,
          onPageChange: setPage, onPageSizeChange: setPageSize, pageSizeOptions: PAGE_SIZES,
        }}
      />

      {canApply && (
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          size="lg"
          title={editing ? 'Edit leave' : 'Apply for leave'}
          subtitle={editing ? `${editing.name} · ${duration(editing)}` : undefined}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" form="leave-form" disabled={saving} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Submit'}
              </button>
            </div>
          )}
        >
          <form id="leave-form" onSubmit={save} noValidate className="space-y-4">
            {formMessage && <NoticeBar notice={{ kind: 'error', text: formMessage }} onClose={() => setFormMessage(null)} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isAdmin && (
                <div className="sm:col-span-2">
                  <Select label="Employee" required value={form.userId} disabled={Boolean(editing)} searchable placeholder="Select employee" error={Boolean(formErrors.userId)}
                    onChange={(v: string) => setField('userId', v)}
                    options={(data?.employees ?? []).map((e) => ({ label: `${e.name} (${e.biometricId})${e.designation ? ` · ${e.designation}` : ''}`, value: e.id }))} />
                </div>
              )}
              <div className="sm:col-span-2" title={formErrors.leaveTypeId || undefined}>
                <Select label="Leave type" required value={form.leaveTypeId} searchable placeholder="Select leave type" error={Boolean(formErrors.leaveTypeId)}
                  onChange={(v: string) => setField('leaveTypeId', v)}
                  options={(data?.types ?? []).map((t) => ({ label: `${t.name} (${t.code})`, value: t.id }))} />
                {formErrors.leaveTypeId && <p className="text-xs text-error mt-1">{formErrors.leaveTypeId}</p>}
              </div>
              <div className={formErrors.startDate ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.startDate || undefined}>
                <AppDatePicker label="Start Date *" value={form.startDate} placeholder="Select date" minDate={isAdmin ? localDate(-60) : localDate(-7)}
                  onChange={(v) => { setField('startDate', v); if (!form.endDate || form.endDate < v) setField('endDate', v); }} className="w-full" />
              </div>
              <div className={formErrors.endDate ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.endDate || undefined}>
                <AppDatePicker label="End Date *" value={form.endDate} placeholder="Select date" minDate={form.startDate || undefined}
                  onChange={(v) => setField('endDate', v)} className="w-full" />
              </div>
              {type?.halfDayAllowed && (
                <>
                  <Select label="First day" value={form.startSession} searchable={false} onChange={(v: string) => setField('startSession', v as LeaveInput['startSession'])} options={sessionOptions.start} />
                  <Select label="Last day" value={form.endSession} searchable={false} onChange={(v: string) => setField('endSession', v as LeaveInput['endSession'])} options={sessionOptions.end} />
                </>
              )}
            </div>

            {(preview || formErrors.endDate || formErrors.startDate) && (
              <div className={`rounded-xl border px-3 py-2 text-xs ${preview?.error ? 'border-error-border bg-error-subtle text-error' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
                {preview?.error
                  ? preview.error
                  : preview && (
                    <>
                      <strong>{daysText(preview.days)}</strong> of leave
                      {preview.balance && type?.isDebited ? <> · balance for {preview.cycle}: <strong>{preview.balance.available}</strong> days available (total {preview.balance.total + preview.balance.carryForward}, used {preview.balance.used}, pending {preview.balance.pending})</> : null}
                    </>
                  )}
              </div>
            )}

            {needsCertificate && (
              <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.certificate} onChange={(e) => setField('certificate', e.target.checked)} className="w-4 h-4 mt-0.5 accent-[var(--ds-primary)]" />
                <span>I will submit a medical certificate (needed for more than {type?.medicalCertDays} days){formErrors.certificate ? <span className="block text-error font-normal mt-0.5">{formErrors.certificate}</span> : null}</span>
              </label>
            )}

            <Textarea label="Reason *" rows={3} maxLength={1000} value={form.reason} error={Boolean(formErrors.reason)}
              onChange={(e) => setField('reason', e.target.value)} />
          </form>
        </Modal>
      )}

      <Modal
        isOpen={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        size="sm"
        title={deciding?.action === 'reject' ? 'Reject leave' : forwarding ? 'Forward leave to the HoD' : 'Approve leave'}
        subtitle={deciding ? `${deciding.request.name} · ${duration(deciding.request)}` : undefined}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeciding(null)} disabled={decideBusy} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button type="button" onClick={() => void confirmDecide()} disabled={decideBusy}
              className={`h-9 px-4 rounded-xl text-white text-xs font-bold cursor-pointer disabled:opacity-60 ${deciding?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {decideBusy ? 'Saving…' : deciding?.action === 'reject' ? 'Reject' : forwarding ? 'Forward' : 'Approve'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          {deciding && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {deciding.request.leaveTypeName} · {daysText(deciding.request.daysCount)}{halves(deciding.request) ? ` (${halves(deciding.request)})` : ''}. {deciding.request.reason}
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
        title="Leave request"
        subtitle={viewing ? `${viewing.name} · ${duration(viewing)}` : undefined}
        footer={<div className="flex justify-end"><button type="button" onClick={() => setViewing(null)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Close</button></div>}
      >
        {viewing && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            {([
              ['Employee', `${viewing.name} (B.I. ${viewing.biometricId})`],
              ['Designation / department', [viewing.designation, viewing.department].filter(Boolean).join(' · ') || '—'],
              ['Leave type', `${viewing.leaveTypeName} (${viewing.leaveTypeCode})`],
              ['Days', `${viewing.daysCount}${halves(viewing) ? ` (${halves(viewing)})` : ''}`],
              ['From', formatDate(viewing.startDate)],
              ['To', formatDate(viewing.endDate)],
              ['Approval', viewing.stages === 2 ? 'Reporting Manager, then HoD' : 'Reporting Manager'],
              ['Applied', `${formatStamp(viewing.appliedAt)} by ${viewing.appliedByName || viewing.name}`],
              ['Reporting manager', viewing.managerName ?? '—'],
              ['HoD', viewing.reviewerName ?? '—'],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="font-semibold text-slate-500">{k}</dt><dd className="text-slate-900 font-medium">{v}</dd></div>
            ))}
            <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Reason</dt><dd className="text-slate-900 font-medium whitespace-pre-wrap">{viewing.reason}</dd></div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Status</dt>
              <dd className="space-y-1 mt-0.5">
                <StatusPill status={viewing.status} />
                {viewing.forwardedByName && <div className="text-slate-700">Forwarded by {viewing.forwardedByName} · {formatStamp(viewing.forwardedAt)}{viewing.forwardComment ? ` · “${viewing.forwardComment}”` : ''}</div>}
                <div className="text-slate-700">
                  {viewing.status === 'pending_l1' ? `Waiting for ${viewing.managerName ?? 'an administrator'}`
                    : viewing.status === 'pending_l2' ? `Waiting for ${viewing.reviewerName ?? 'the HoD'}`
                    : `${viewing.status === 'approved' ? 'Approved' : 'Rejected'} by ${viewing.actionByName ?? '—'} · ${formatStamp(viewing.actionAt)}`}
                </div>
                {viewing.comment && <div className="text-slate-600">“{viewing.comment}”</div>}
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(undoing)}
        title="Undo the last step"
        message={undoing ? <>Take back the last step on the leave of <strong>{undoing.name}</strong> ({duration(undoing)})? It goes back one stage.{role === 'reporting_manager' || role === 'reviewing_manager' ? ' You can undo a step only once.' : ''} This is recorded in the audit log.</> : ''}
        confirmLabel="Undo"
        busy={undoBusy}
        error={undoError}
        onConfirm={(reason) => void confirmUndo(reason)}
        onCancel={() => setUndoing(null)}
      />

      {canApply && (
        <ConfirmDialog
          open={Boolean(deleting)}
          title="Delete request"
          message={deleting ? <>Delete the leave of <strong>{deleting.name}</strong> ({duration(deleting)})? This is recorded in the audit log.</> : ''}
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
