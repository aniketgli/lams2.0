import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CalendarDays, MapPin, Send, Check, Paperclip, CheckCircle2, ChevronsRight, Clock, Eye, Pencil, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { DataTable, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { Textarea } from '../../../../shared/components/forms/Textarea';
import { Checkbox } from '../../../../shared/components/forms/Checkbox';
import { Input } from '../../../../shared/components/forms/Input';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { ApiError } from '../../../../shared/services/api';
import { downloadCsvText, downloadTablePdf, printedAt, toCsvText } from '../../../../shared/services/printTable';
import { logThenDownload } from '../../../../shared/services/downloadAudit';
import { ConfirmDialog, NoticeBar, useNotice } from '../../master/components/masterUi';
import { CompOffCredit, JoiningItem, LeaveBalance, LeaveInput, LeaveList, LeavePreview, LeaveRequest, LeaveStatus, leaveApi } from '../leaveApi';
import { JoiningDetails, JoiningStatusLine, useJoining } from './JoiningPanel';
import { actionBtn } from '../../../../shared/components/actionStyles';
import { decidedBy, pendingAt, pendingAtManager, statusPerson } from '../../../../shared/services/statusLine';
import { KeepDates } from '../../../../shared/components/KeepDates';
import { earliestViewable, yearEnd, yearStart } from '../../../../shared/services/dateWindow';

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

/** Status line: who it is waiting for ("at R.M. Harendra Kumar"), or who decided ("by HoD Ravi Sharma"). */
const statusBy = (r: LeaveRequest) =>
  r.status === 'pending_l1' ? pendingAtManager(r.managerName)
    : r.status === 'pending_l2' ? pendingAt('HoD', r.reviewerName)
    : decidedBy(r.actionByRole, r.actionByName);

const EMPTY_FORM: LeaveInput = { userId: '', leaveTypeId: '', startDate: '', endDate: '', startSession: 'full', endSession: 'full', reason: '', stationLeave: false,
  ltcType: 'none', encashLtc: false, encashDays: 10, contactAddress: '', compOffDates: [], availPrefix: false, prefixFrom: '', prefixTo: '', availSuffix: false, suffixFrom: '', suffixTo: '', certificateFile: null,
  purpose: '', childEvent: '', childEventDate: '', childBirthDate: '', survivingChildren: '', childOrder: '', childDisabled: false, singleParent: false };

/** Paternity Leave (code PAT): taken from 15 days before up to 6 months after the date of delivery, or up to 6 months after the date of adoption. */
const PATERNITY_CODE = 'PAT';
const PATERNITY_DAYS = 15;
/** Maternity Leave (code MAT): 180 days in one go for a birth / adoption; up to 45 days for abortion / miscarriage. Child Care Leave: code CCL. */
const MATERNITY_CODE = 'MAT';
const MATERNITY_DAYS = 180;
const MATERNITY_LOSS_DAYS = 45;
const CHILD_CARE_CODE = 'CCL';
const NO_CHILD = { childEvent: '' as const, childEventDate: '', childBirthDate: '', survivingChildren: '', childOrder: '', childDisabled: false, singleParent: false };
function plusMonths(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  first.setUTCDate(Math.min(d, new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()));
  return first.toISOString().slice(0, 10);
}
function plusDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const shiftDate = (iso: string, days: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export const LeaveRequestsView: React.FC<{ applySignal: number; toolbarStart?: React.ReactNode }> = ({ applySignal, toolbarStart }) => {
  const { currentUser, users } = useApp();
  const role = currentUser.role;
  const isAdmin = role === 'administrator';
  const isAudit = role === 'audit';
  const isManager = role === 'reporting_manager' || role === 'reviewing_manager';
  const canApply = isAdmin || role === 'general_staff';
  const teamView = isAdmin || isAudit || isManager;

  // ---- Data -----------------------------------------------------------------------------
  // Opens on this year; only an administrator may look further back than 1 January of last year.
  const defaultFrom = yearStart(localDate());
  const defaultTo = yearEnd(localDate());
  const earliest = earliestViewable(role, localDate());
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<LeaveList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useNotice();
  const joining = useJoining((message) => { showNotice('success', message); void load(true); });

  const load = useCallback(async (silent = false) => {
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
  // A ref is updated at once, so a fast double-click cannot send the same form twice before `saving` re-renders.
  const submitting = useRef(false);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const setField = <K extends keyof LeaveInput>(key: K, value: LeaveInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };
  const openApply = () => { setEditing(null); setForm(EMPTY_FORM); setFormErrors({}); setFormMessage(null); setPreview(null); setFormOpen(true); };
  useEffect(() => { if (applySignal > 0 && canApply) openApply(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [applySignal]);
  const openEdit = (r: LeaveRequest) => {
    setEditing(r);
    setForm({ userId: r.userId, leaveTypeId: r.leaveTypeId, startDate: r.startDate, endDate: r.endDate, startSession: r.startSession, endSession: r.endSession, reason: r.reason, stationLeave: r.stationLeave,
      ltcType: r.ltcType, encashLtc: r.encashDays > 0, encashDays: r.encashDays || 10, contactAddress: r.contactAddress, compOffDates: r.compOffDates,
      availPrefix: Boolean(r.prefixFrom), prefixFrom: r.prefixFrom ?? '', prefixTo: r.prefixTo ?? '', availSuffix: Boolean(r.suffixFrom), suffixFrom: r.suffixFrom ?? '', suffixTo: r.suffixTo ?? '', certificateFile: null,
      purpose: r.purpose ?? '', childEvent: r.childEvent ?? '', childEventDate: r.childEventDate ?? '', childBirthDate: r.childBirthDate ?? '', survivingChildren: r.survivingChildren === null ? '' : String(r.survivingChildren),
      childOrder: r.childOrder ? String(r.childOrder) : '', childDisabled: r.childDisabled, singleParent: r.singleParent });
    setFormErrors({}); setFormMessage(null); setPreview(null); setFormOpen(true);
  };

  const type = data?.types.find((t) => t.id === form.leaveTypeId) ?? null;
  // A leave type that takes its days from another type (Commuted from Half Pay) is a conversion option of that type.
  const baseType = type?.debitFromTypeId ? data?.types.find((t) => t.id === type.debitFromTypeId) ?? type : type;
  const variants = baseType ? (data?.types ?? []).filter((t) => t.debitFromTypeId === baseType.id) : [];
  const charge = type?.debitFromTypeId ? type.debitFactor : 1;

  // Days of the calendar that already hold a leave (and days that cannot be joined with one), coloured and blocked in the pickers.
  const [occupied, setOccupied] = useState<{ days: { date: string; status: 'pending' | 'approved' | 'rejected' }[]; joined: string[]; workdays: string[] } | null>(null);
  useEffect(() => {
    if (!formOpen || (isAdmin && !form.userId)) { setOccupied(null); return; }
    let cancelled = false;
    leaveApi.occupied({ userId: form.userId, leaveTypeId: form.leaveTypeId, exceptId: editing?.id ?? '' })
      .then((o) => { if (!cancelled) setOccupied(o); }).catch(() => { if (!cancelled) setOccupied(null); });
    return () => { cancelled = true; };
  }, [formOpen, isAdmin, form.userId, form.leaveTypeId, editing]);
  // A station leave is one continuous stretch of weekly offs / holidays: the end date stays inside the stretch of the start date.
  const lastOffDay = useMemo(() => {
    if (!type?.offDaysOnly || !form.startDate || !occupied?.workdays.length) return undefined;
    const next = occupied.workdays.find((d) => d > form.startDate);
    return next ? shiftDate(next, -1) : undefined;
  }, [type, form.startDate, occupied]);
  const marks = useMemo(() => {
    const out: Record<string, { tone: 'yellow' | 'green' | 'red' | 'blue' | 'slate'; blocked: boolean; label: string }> = {};
    for (const d of occupied?.workdays ?? []) out[d] = { tone: 'slate', blocked: true, label: 'Only weekly offs and holidays' };
    for (const d of occupied?.joined ?? []) out[d] = { tone: 'blue', blocked: true, label: 'Cannot be joined with a leave of the other kind' };
    for (const { date, status } of occupied?.days ?? []) {
      out[date] = status === 'approved' ? { tone: 'green', blocked: true, label: 'Approved leave' }
        : status === 'pending' ? { tone: 'yellow', blocked: true, label: 'Pending leave' }
        : { tone: 'red', blocked: false, label: 'Rejected leave' };
    }
    return out;
  }, [occupied]);

  // The balance of the chosen leave type, shown as soon as it is chosen (and for the leave year of the start date).
  const [balanceBadge, setBalanceBadge] = useState<{ balance: LeaveBalance | null; cycle: string } | null>(null);
  useEffect(() => {
    if (!formOpen || !form.leaveTypeId || (isAdmin && !form.userId)) { setBalanceBadge(null); return; }
    let cancelled = false;
    leaveApi.balancePreview({ userId: form.userId, leaveTypeId: form.leaveTypeId, date: form.startDate })
      .then((b) => { if (!cancelled) setBalanceBadge(b); }).catch(() => { if (!cancelled) setBalanceBadge(null); });
    return () => { cancelled = true; };
  }, [formOpen, isAdmin, form.userId, form.leaveTypeId, form.startDate]);

  // Compensatory off: the days worked on a weekly off / holiday (biometric punches) that can still be taken.
  const isCompOff = type?.code === 'C-OFF';
  const [credits, setCredits] = useState<CompOffCredit[]>([]);
  useEffect(() => {
    if (!formOpen || !isCompOff || (isAdmin && !form.userId)) { setCredits([]); return; }
    let cancelled = false;
    leaveApi.compOff({ userId: form.userId, exceptId: editing?.id })
      .then((r) => { if (!cancelled) setCredits(r.credits); }).catch(() => { if (!cancelled) setCredits([]); });
    return () => { cancelled = true; };
  }, [formOpen, isCompOff, isAdmin, form.userId, editing?.id]);

  // Paternity Leave: the From date must fall in the time it can be taken; To is always From + 14 days.
  const isPat = type?.code === PATERNITY_CODE;
  const patWindow = isPat && form.childEventDate ? (() => {
    const from = form.childEvent === 'adoption' ? form.childEventDate : plusDays(form.childEventDate, -15);
    const to = plusMonths(form.childEventDate, 6);
    return { from, to, lastStart: plusDays(to, -(PATERNITY_DAYS - 1)) };
  })() : null;

  // Maternity Leave: birth / adoption is 180 days in one go (To worked out); abortion / miscarriage up to 45 days.
  const isMat = type?.code === MATERNITY_CODE;
  const matFixed = isMat && (form.childEvent === 'delivery' || form.childEvent === 'adoption');
  // Child Care Leave: which of the two eldest children; it cannot start today or earlier (prior approval).
  const isCcl = type?.code === CHILD_CARE_CODE;

  // Restricted holiday: one day chosen from the restricted holidays added in the Holiday Calendar.
  const isRh = type?.code === 'RH';
  const [rhList, setRhList] = useState<Array<{ date: string; name: string }>>([]);
  useEffect(() => {
    if (!formOpen || !isRh || (isAdmin && !form.userId)) { setRhList([]); return; }
    let cancelled = false;
    leaveApi.restrictedHolidays({ userId: form.userId, exceptId: editing?.id })
      .then((r) => { if (!cancelled) setRhList(r.holidays); }).catch(() => { if (!cancelled) setRhList([]); });
    return () => { cancelled = true; };
  }, [formOpen, isRh, isAdmin, form.userId, editing?.id]);

  // The server works out the days and the balance while the form is filled.
  useEffect(() => {
    if (!formOpen || !form.leaveTypeId || !form.startDate || !form.endDate || (isAdmin && !form.userId)) { setPreview(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      leaveApi.preview({ ...form, exceptId: editing?.id }).then((p) => { if (!cancelled) setPreview(p); }).catch(() => { if (!cancelled) setPreview(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formOpen, isAdmin, editing?.id, form.userId, form.leaveTypeId, form.startDate, form.endDate, form.startSession, form.endSession, form.compOffDates.join(','), form.childEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  // The server moves the dates off weekly offs / holidays at the start or end of the leave; those days become the prefix / suffix.
  useEffect(() => {
    if (!preview || preview.requestedStart !== form.startDate || preview.requestedEnd !== form.endDate) return;
    if (preview.startDate === form.startDate && preview.endDate === form.endDate) return;
    setForm((f) => ({
      ...f, startDate: preview.startDate, endDate: preview.endDate,
      startSession: preview.startDate !== f.startDate ? 'full' : f.startSession, endSession: preview.endDate !== f.endDate ? 'full' : f.endSession,
      ...(preview.startDate !== f.startDate ? { availPrefix: true, prefixFrom: f.startDate, prefixTo: shiftDate(preview.startDate, -1), stationLeave: true } : {}),
      ...(preview.endDate !== f.endDate ? { availSuffix: true, suffixFrom: shiftDate(preview.endDate, 1), suffixTo: f.endDate, stationLeave: true } : {}),
    }));
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps

  // A prefix / suffix that no longer exists for the chosen dates is dropped.
  useEffect(() => {
    if (!preview) return;
    setForm((f) => {
      const dropPrefix = f.availPrefix && (!preview.prefix || f.prefixFrom < preview.prefix.from || f.prefixTo > preview.prefix.to);
      const dropSuffix = f.availSuffix && (!preview.suffix || f.suffixFrom < preview.suffix.from || f.suffixTo > preview.suffix.to);
      if (!dropPrefix && !dropSuffix) return f;
      return { ...f, ...(dropPrefix ? { availPrefix: false, prefixFrom: '', prefixTo: '' } : {}), ...(dropSuffix ? { availSuffix: false, suffixFrom: '', suffixTo: '' } : {}) };
    });
  }, [preview]);

  // Station permission is only for a leave that is continuous with a weekend or holiday.
  useEffect(() => {
    if (preview && !preview.stationOk) setForm((f) => (f.stationLeave ? { ...f, stationLeave: false } : f));
  }, [preview]);

  const encashing = form.ltcType === 'ltc' && form.encashLtc && Number.isInteger(form.encashDays) && form.encashDays > 0 ? form.encashDays : 0;
  const needsCertificate = Boolean(type && (type.certificateRequired || (type.medicalCertDays > 0 && preview && preview.days > type.medicalCertDays)
    || (type.code === MATERNITY_CODE && form.childEvent === 'loss')
    // Leave Not Due: on a medical certificate, except after a Maternity Leave; EOL: medical / sanatorium / studies grounds.
    || (type.code === 'LND' && form.purpose !== '' && !/maternity/i.test(form.purpose))
    || (type.code === 'EOL' && /medical certificate|sanatorium|studies/i.test(form.purpose))));
  const certInput = React.useRef<HTMLInputElement>(null);
  const pickCertificate = (file: File | undefined) => {
    if (!file) return;
    // Type and size are enforced by the server; this only stops a huge file being read into the page.
    if (file.size > 1024 * 1024) { setFormErrors((e) => ({ ...e, certificate: 'Use a medical certificate smaller than 1 MB.' })); return; }
    const reader = new FileReader();
    reader.onload = () => { setField('certificateFile', { name: file.name, data: String(reader.result) }); setFormErrors((e) => ({ ...e, certificate: '' })); };
    reader.onerror = () => setFormErrors((e) => ({ ...e, certificate: 'The medical certificate could not be read.' }));
    reader.readAsDataURL(file);
  };
  const [certError, setCertError] = useState<string | null>(null);
  const downloadCertificate = async (id: string) => {
    setCertError(null);
    try { await leaveApi.downloadCertificate(id); } catch (error) { setCertError(error instanceof Error ? error.message : 'The certificate could not be downloaded.'); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || submitting.current) return;
    submitting.current = true;
    setSaving(true); setFormMessage(null);
    try {
      const result = editing ? await leaveApi.update(editing.id, form) : await leaveApi.create(form);
      setFormOpen(false);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormErrors(error.details ?? {});
        setFormMessage(error.message); // the details are shown under their own fields
      } else {
        setFormMessage('The request could not be saved.');
      }
    } finally {
      submitting.current = false;
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
          <div className="font-semibold text-slate-900"><KeepDates text={duration(r)} /></div>
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
          <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{statusBy(r)}</div>
          <JoiningStatusLine item={joining.byRequest.get(r.id)} />
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions', width: teamView ? '16%' : '14%', align: 'center',
      render: (r: LeaveRequest) => (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => setViewing(r)} title="View" aria-label={`View leave of ${r.name}`}
            className={actionBtn('neutral')}><Eye className="w-3.5 h-3.5" /></button>
          {joining.actions(joining.byRequest.get(r.id))}
          {r.canEdit && (
            <button type="button" onClick={() => openEdit(r)} title="Edit" aria-label={`Edit ${r.name}`}
              className={actionBtn('neutral')}><Pencil className="w-3.5 h-3.5" /></button>
          )}
          {r.canDelete && (
            <button type="button" onClick={() => { setDeleting(r); setDeleteError(null); }} title="Delete" aria-label={`Delete ${r.name}`}
              className={actionBtn('danger')}><Trash2 className="w-3.5 h-3.5" /></button>
          )}
          {r.canDecide && (
            <>
              <button type="button" onClick={() => openDecide(r, 'approve')} title={r.decideStep === 'forward' ? 'Forward to HoD' : 'Approve'} aria-label={`${r.decideStep === 'forward' ? 'Forward' : 'Approve'} ${r.name}`}
                className={actionBtn('success')}>{r.decideStep === 'forward' ? <ChevronsRight className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}</button>
              <button type="button" onClick={() => openDecide(r, 'reject')} title="Reject" aria-label={`Reject ${r.name}`}
                className={actionBtn('danger')}><X className="w-3.5 h-3.5" /></button>
            </>
          )}
          {r.canUndo && (
            <button type="button" onClick={() => { setUndoing(r); setUndoError(null); }} title="Undo the last step" aria-label={`Undo the last step on ${r.name}`}
              className={actionBtn('warning')}><RotateCcw className="w-3.5 h-3.5" /></button>
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
    STATUS_META[r.status].label, statusPerson(statusBy(r)), r.comment ?? '',
  ]);
  const fileName = `WII_Leave_${from}_to_${to}`;
  const downloadCsv = () => void logThenDownload('leave_requests', 'csv', sorted.length, range, () => downloadCsvText(toCsvText(exportHeaders, exportRows()), fileName), setError);
  const downloadPdf = () => void logThenDownload('leave_requests', 'pdf', sorted.length, range, () => buildPdf(), setError);
  const buildPdf = () => downloadTablePdf({
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
      <div className="w-36"><AppDatePicker size="sm" placeholder="From date" value={from} minDate={earliest} maxDate={to || undefined} onChange={(v) => setFrom(v || defaultFrom)} /></div>
      <span className="text-slate-300 font-bold">—</span>
      <div className="w-36"><AppDatePicker size="sm" placeholder="To date" value={to} minDate={from || earliest} onChange={(v) => setTo(v || defaultTo)} isRightColumn /></div>
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
        start={<>{toolbarStart}{dateRange}</>}
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
          icon={<CalendarDays className="w-5 h-5 text-blue-300" />}
          title={editing ? 'Edit Leave' : 'Apply for Leave'}
          subtitle={editing ? `${editing.name} · ${duration(editing)}` : undefined}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" form="leave-form" disabled={saving} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Save changes' : <span className="inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Submit</span>}
              </button>
            </div>
          )}
        >
          <form id="leave-form" onSubmit={save} noValidate className="space-y-4">
            {formMessage && <p role="alert" className="text-[11px] font-semibold text-rose-600 leading-tight">{Object.keys(formErrors).some((k) => formErrors[k]) ? 'Please check the highlighted fields.' : formMessage}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isAdmin && (
                <div className="sm:col-span-2">
                  <Select label="Employee" required value={form.userId} disabled={Boolean(editing)} searchable placeholder="Select employee" error={formErrors.userId}
                    onChange={(v: string) => {
                      setField('userId', v);
                      // Special leave for persons with disability does not carry over to an employee who is not one.
                      if (type?.pwdOnly && !data?.employees.find((e) => e.id === v)?.isPwd) setField('leaveTypeId', '');
                    }}
                    options={(data?.employees ?? []).map((e) => ({ label: `${e.name} (${e.biometricId})${e.designation ? ` · ${e.designation}` : ''}`, value: e.id }))} />
                </div>
              )}
              <div className="sm:col-span-2 relative">
                <Select label="Leave type" required value={baseType?.id ?? ''} searchable placeholder="Select leave type" error={formErrors.leaveTypeId}
                  onChange={(v: string) => {
                    setForm((f) => ({ ...f, leaveTypeId: v, ltcType: 'none', encashLtc: false, availPrefix: false, availSuffix: false, stationLeave: false, compOffDates: [], purpose: '', ...NO_CHILD, ...(data?.types.find((t) => t.id === v)?.code === CHILD_CARE_CODE ? { childEvent: 'care' as const } : {}), ...(isRh || data?.types.find((t) => t.id === v)?.code === 'RH' ? { startDate: '', endDate: '' } : {}) }));
                    setFormErrors({});
                    setFormMessage(null);
                  }}
                  options={(data?.types ?? []).filter((t) => !t.debitFromTypeId && (!t.pwdOnly || !isAdmin || Boolean(data?.employees.find((e) => e.id === form.userId)?.isPwd))).map((t) => ({ label: `${t.name} (${t.code})`, value: t.id }))} />
                {balanceBadge?.balance && !type?.offDaysOnly && (
                  <span className={`absolute right-0 top-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${balanceBadge.balance.available > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    Balance: {balanceBadge.balance.available} {balanceBadge.balance.available === 1 ? 'Day' : 'Days'}
                  </span>
                )}
              </div>
              {isCompOff && (
                <div className="sm:col-span-2">
                  <Select label="Worked weekly off / holiday" required value={form.compOffDates[0] ?? ''} searchable={false} placeholder="Select the day you worked" error={formErrors.compOffDates}
                    onChange={(v: string) => setField('compOffDates', v ? [v] : [])}
                    options={credits.map((c) => ({ value: c.date, label: `${c.reason} (${formatDate(c.date)})`, description: `Worked ${c.in} – ${c.out} (${c.hours}h) · valid up to ${formatDate(c.validUntil)}` }))} />
                </div>
              )}
              {isRh ? (
                <div className="sm:col-span-2">
                  <Select label="Restricted holiday" required value={form.startDate} placeholder="Select the restricted holiday" error={formErrors.startDate}
                    onChange={(v: string) => setForm((f) => ({ ...f, startDate: v, endDate: v }))}
                    options={rhList.map((h) => ({ value: h.date, label: `${h.name} (${formatDate(h.date)})` }))} />
                </div>
              ) : isCompOff ? (
                <div className="sm:col-span-2">
                  <AppDatePicker label="Date of compensatory off" required error={formErrors.startDate || formErrors.endDate} value={form.startDate} placeholder="Select date" minDate={localDate(-15)} marks={marks}
                    onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: v }))} className="w-full" />
                </div>
              ) : isPat ? (
                <>
                  {/* Row 2: the birth / adoption and surviving children; row 3: From, and To worked out from it. */}
                  <div>
                    <AppDatePicker label={form.childEvent === 'adoption' ? 'Date of adoption' : 'Date of delivery (expected date if not yet)'} required error={formErrors.childEventDate || formErrors.childEvent}
                      value={form.childEventDate} placeholder="Select date" onChange={(v) => setForm((f) => ({ ...f, childEventDate: v, childEvent: f.childEvent || 'delivery' }))} className="w-full" />
                    <div className="mt-1.5">
                      <Checkbox label="Adoption of a child less than one year old" checked={form.childEvent === 'adoption'}
                        onChange={(e) => setForm((f) => ({ ...f, childEvent: e.target.checked ? 'adoption' : 'delivery', childBirthDate: e.target.checked ? f.childBirthDate : '' }))} />
                    </div>
                  </div>
                  <div>
                    <Select label="Surviving children (before this child)" required value={form.survivingChildren} searchable={false} placeholder="Select" error={formErrors.survivingChildren}
                      onChange={(v: string) => setField('survivingChildren', v)} options={[{ value: '0', label: 'None' }, { value: '1', label: 'One' }, { value: '2', label: 'Two or more' }]} />
                  </div>
                  {form.childEvent === 'adoption' && (
                    <div>
                      <AppDatePicker label="Child's date of birth" required error={formErrors.childBirthDate} value={form.childBirthDate} placeholder="Select date"
                        maxDate={form.childEventDate || undefined} onChange={(v) => setField('childBirthDate', v)} className="w-full" />
                    </div>
                  )}
                  {form.childEvent === 'adoption' && <div className="hidden sm:block" />}
                  <div>
                    <AppDatePicker label="From date (start date)" required error={formErrors.startDate} value={form.startDate} placeholder={patWindow ? 'Select date' : 'Choose the date of delivery first'}
                      minDate={patWindow?.from} maxDate={patWindow?.lastStart} marks={marks}
                      onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: v ? plusDays(v, PATERNITY_DAYS - 1) : '', startSession: 'full', endSession: 'full' }))} className="w-full" />
                  </div>
                  <div>
                    <Input label={`To date (${PATERNITY_DAYS} days, worked out)`} value={form.endDate ? formatDate(form.endDate) : ''} placeholder="Set by the From date" disabled readOnly error={formErrors.endDate} />
                  </div>
                </>
              ) : isMat ? (
                <>
                  {/* Row 2: what the leave is for; then its date and the surviving children; then From and To. */}
                  <div className="sm:col-span-2">
                    <Select label="Maternity Leave for" required value={form.childEvent} searchable={false} placeholder="Select" error={formErrors.childEvent}
                      onChange={(v: string) => setForm((f) => ({ ...f, ...NO_CHILD, childEvent: v as LeaveInput['childEvent'], startDate: '', endDate: '', startSession: 'full', endSession: 'full' }))}
                      options={[
                        { value: 'delivery', label: `Birth of a child (${MATERNITY_DAYS} days)` },
                        { value: 'adoption', label: `Adoption of a child below one year (${MATERNITY_DAYS} days)` },
                        { value: 'loss', label: `Abortion / miscarriage (up to ${MATERNITY_LOSS_DAYS} days, once in service, medical certificate)` },
                      ]} />
                  </div>
                  {form.childEvent && (
                    <div>
                      <AppDatePicker label={form.childEvent === 'adoption' ? 'Date of adoption' : form.childEvent === 'loss' ? 'Date of abortion / miscarriage' : 'Date of delivery (expected date if not yet)'} required
                        error={formErrors.childEventDate} value={form.childEventDate} placeholder="Select date" maxDate={form.childEvent === 'loss' ? localDate(0) : undefined}
                        onChange={(v) => setForm((f) => ({ ...f, childEventDate: v, ...(f.childEvent === 'adoption' && v ? { startDate: v, endDate: plusDays(v, MATERNITY_DAYS - 1) } : {}) }))} className="w-full" />
                    </div>
                  )}
                  {(form.childEvent === 'delivery' || form.childEvent === 'adoption') && (
                    <div>
                      <Select label="Surviving children (before this child)" required value={form.survivingChildren} searchable={false} placeholder="Select" error={formErrors.survivingChildren}
                        onChange={(v: string) => setField('survivingChildren', v)} options={[{ value: '0', label: 'None' }, { value: '1', label: 'One' }, { value: '2', label: 'Two or more' }]} />
                    </div>
                  )}
                  {form.childEvent === 'loss' && <div className="hidden sm:block" />}
                  {form.childEvent === 'adoption' && (
                    <>
                      <div>
                        <AppDatePicker label="Child's date of birth" required error={formErrors.childBirthDate} value={form.childBirthDate} placeholder="Select date"
                          maxDate={form.childEventDate || undefined} onChange={(v) => setField('childBirthDate', v)} className="w-full" />
                      </div>
                      <div className="hidden sm:block" />
                    </>
                  )}
                  {form.childEvent && (
                    matFixed ? (
                      <>
                        <div>
                          <AppDatePicker label="From date (start date)" required error={formErrors.startDate} value={form.startDate} marks={marks}
                            placeholder={form.childEvent === 'adoption' ? 'The date of adoption' : 'Select date'} disabled={form.childEvent === 'adoption'}
                            onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: v ? plusDays(v, MATERNITY_DAYS - 1) : '', startSession: 'full', endSession: 'full' }))} className="w-full" />
                        </div>
                        <div>
                          <Input label={`To date (${MATERNITY_DAYS} days, worked out)`} value={form.endDate ? formatDate(form.endDate) : ''} placeholder="Set by the From date" disabled readOnly error={formErrors.endDate} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <AppDatePicker label="From date (start date)" required error={formErrors.startDate} value={form.startDate} placeholder="Select date"
                            minDate={form.childEventDate || undefined} marks={marks}
                            onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: !f.endDate || f.endDate < v ? v : f.endDate }))} className="w-full" />
                        </div>
                        <div>
                          <AppDatePicker label={`To date (at most ${MATERNITY_LOSS_DAYS} days)`} required error={formErrors.endDate} value={form.endDate} placeholder="Select date"
                            minDate={form.startDate || undefined} maxDate={form.startDate ? plusDays(form.startDate, MATERNITY_LOSS_DAYS - 1) : undefined} marks={marks}
                            onChange={(v) => setField('endDate', v)} className="w-full" />
                        </div>
                      </>
                    )
                  )}
                </>
              ) : isCcl ? (
                <>
                  {/* Row 2: the child; row 3: From and To (it cannot start today or earlier). */}
                  <div>
                    <Select label="For which child" required value={form.childOrder} searchable={false} placeholder="Select" error={formErrors.childOrder}
                      onChange={(v: string) => setForm((f) => ({ ...f, childOrder: v, childEvent: 'care' }))}
                      options={[{ value: '1', label: 'Eldest surviving child' }, { value: '2', label: 'Second eldest surviving child' }]} />
                  </div>
                  <div>
                    <AppDatePicker label="Child's date of birth" required error={formErrors.childBirthDate} value={form.childBirthDate} placeholder="Select date" maxDate={localDate(0)}
                      onChange={(v) => setForm((f) => ({ ...f, childBirthDate: v, childEvent: 'care' }))} className="w-full" />
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <Checkbox label="The child has a disability (no age limit)" checked={form.childDisabled} onChange={(e) => setForm((f) => ({ ...f, childDisabled: e.target.checked, childEvent: 'care' }))} />
                    <Checkbox label="I am a single mother (6 spells a year)" checked={form.singleParent} onChange={(e) => setForm((f) => ({ ...f, singleParent: e.target.checked, childEvent: 'care' }))} />
                  </div>
                  <div>
                    <AppDatePicker label="From date (start date)" required error={formErrors.startDate} value={form.startDate} placeholder="Select date" minDate={isAdmin ? undefined : localDate(1)} marks={marks}
                      onChange={(v) => { setField('startDate', v); if (!form.endDate || form.endDate < v) setField('endDate', v); }} className="w-full" />
                  </div>
                  <div>
                    <AppDatePicker label="To date (end date)" required error={formErrors.endDate} value={form.endDate} placeholder="Select date" minDate={form.startDate || undefined} marks={marks}
                      onChange={(v) => setField('endDate', v)} className="w-full" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <AppDatePicker label="From date (start date)" required error={formErrors.startDate} value={form.startDate} placeholder="Select date" minDate={localDate(-15)} marks={marks}
                      onChange={(v) => { setField('startDate', v); if (!form.endDate || form.endDate < v) setField('endDate', v); }} className="w-full" />
                  </div>
                  <div>
                    <AppDatePicker label="To date (end date)" required error={formErrors.endDate} value={form.endDate} placeholder="Select date" minDate={form.startDate || undefined} maxDate={lastOffDay} marks={marks}
                      onChange={(v) => setField('endDate', v)} className="w-full" />
                  </div>
                </>
              )}
              {type?.halfDayAllowed && !isCompOff && !isRh && (
                <>
                  <Select label="Start day" error={formErrors.startSession} value={form.startSession} searchable={false} onChange={(v: string) => setField('startSession', v as LeaveInput['startSession'])} options={sessionOptions.start} />
                  <Select label="End day" error={formErrors.endSession} value={form.endSession} searchable={false} onChange={(v: string) => setField('endSession', v as LeaveInput['endSession'])} options={sessionOptions.end} />
                </>
              )}
              {type && type.purposes.length > 0 && (
                <div className="sm:col-span-2">
                  <Select label={type.code === 'LND' || type.code === 'EOL' ? `Ground for ${type.name}` : `Purpose of ${type.code}`} required value={form.purpose} searchable={false} placeholder={type.code === 'LND' || type.code === 'EOL' ? 'Select the ground' : 'Select the purpose'} error={formErrors.purpose}
                    onChange={(v: string) => setField('purpose', v)} options={type.purposes.map((p) => ({ value: p, label: p }))} />
                </div>
              )}
            </div>

            {preview && !preview.error && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><p className="text-[11px] font-semibold text-slate-500">Total duration</p><p className="font-extrabold text-slate-900">{daysText(preview.days)}{charge !== 1 ? ` (uses ${daysText(preview.days * charge)})` : ''}</p></div>
                <div><p className="text-[11px] font-semibold text-slate-500">Leave year</p><p className="font-extrabold text-slate-900">{preview.cycle}</p></div>
                {preview.balance && type?.isDebited && (
                  <>
                    <div><p className="text-[11px] font-semibold text-slate-500">Available</p><p className="font-extrabold text-slate-900">{preview.balance.available}</p></div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">After this leave</p>
                      <p className={`font-extrabold ${preview.balance.available - preview.days * charge - encashing < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{Math.round((preview.balance.available - preview.days * charge - encashing) * 10) / 10}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {preview && !preview.error && !type?.offDaysOnly && (
              <div>
                <div className="text-xs font-semibold text-slate-700 select-none mb-1.5">Prefix &amp; Suffix holidays</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([['Prefix', 'availPrefix', 'prefixFrom', 'prefixTo', preview.prefix], ['Suffix', 'availSuffix', 'suffixFrom', 'suffixTo', preview.suffix]] as const).map(([name, flag, fromKey, toKey, block]) => (
                    <div key={name} className={`rounded-xl border p-3 space-y-2 ${block ? 'border-slate-300 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Checkbox label={`Avail ${name.toLowerCase()}`} disabled={!block} checked={Boolean(block) && form[flag]}
                          onChange={(e) => {
                            if (!block) return;
                            const on = e.target.checked;
                            setForm((f) => ({ ...f, [flag]: on, [fromKey]: on ? block.from : '', [toKey]: on ? block.to : '', ...(on ? { stationLeave: true } : {}) }));
                          }} />
                        <span className="text-[11px] font-semibold text-slate-500">{block ? `${block.days} ${block.days === 1 ? 'Day' : 'Days'}` : 'Not eligible'}</span>
                      </div>
                      {block && form[flag] && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <AppDatePicker label={`${name} from`} error={formErrors[fromKey]} value={form[fromKey]} placeholder="Select date" minDate={block.from} maxDate={block.to} onChange={(v) => setField(fromKey, v)} className="w-full" />
                          </div>
                          <div>
                            <AppDatePicker label={`${name} to`} error={formErrors[toKey]} value={form[toKey]} placeholder="Select date" minDate={block.from} maxDate={block.to} onChange={(v) => setField(toKey, v)} className="w-full" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {type && !type.offDaysOnly && (
              <div>
                <div className="text-xs font-semibold text-slate-700 select-none mb-1.5">Headquarter (HQ) / Station permission<span className="text-rose-500 ml-0.5">*</span></div>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Headquarter / Station permission">
                  {([[false, 'Not required (HQ)', Building2], [true, 'Station leave', MapPin]] as const).map(([value, label, Icon]) => (
                    <button key={label} type="button" role="radio" aria-checked={form.stationLeave === value} disabled={value ? Boolean(preview) && !preview?.stationOk : form.availPrefix || form.availSuffix} onClick={() => setField('stationLeave', value)}
                      className={`h-9 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        form.stationLeave === value ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}>
                      <Icon className="w-4 h-4" />{label}
                    </button>
                  ))}
                </div>
                {formErrors.stationLeave && <p className="text-[11px] font-semibold text-rose-600 leading-tight mt-1.5">{formErrors.stationLeave}</p>}
              </div>
            )}

            {variants.length > 0 && baseType && (
              <div>
                <div className="text-xs font-semibold text-slate-700 select-none mb-1.5">Leave conversion option<span className="text-rose-500 ml-0.5">*</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Leave conversion option">
                  {[{ id: baseType.id, label: `Normal ${baseType.code}` }, ...variants.map((v) => ({ id: v.id, label: v.name }))].map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={form.leaveTypeId === o.id}
                      onClick={() => { setForm((f) => ({ ...f, leaveTypeId: o.id, startSession: 'full', endSession: 'full' })); setFormErrors({}); setFormMessage(null); }}
                      className={`h-9 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${form.leaveTypeId === o.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type?.ltcAllowed && (
              <div>
                <div className="text-xs font-semibold text-slate-700 select-none mb-1.5">LTC / Ex-India option<span className="text-rose-500 ml-0.5">*</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="LTC / Ex-India option">
                  {([['none', `Regular ${type.code}`], ['ltc', 'Availing LTC'], ['ex_india', 'Ex-India']] as const).map(([value, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={form.ltcType === value}
                      onClick={() => { setField('ltcType', value); if (value !== 'ltc') setField('encashLtc', false); }}
                      className={`h-9 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${form.ltcType === value ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {formErrors.ltcType && <p className="text-[11px] font-semibold text-rose-600 leading-tight mt-1.5">{formErrors.ltcType}</p>}
                {form.ltcType === 'ltc' && (
                  <div className="mt-3 rounded-xl border border-slate-300 bg-white p-3 space-y-3">
                    <Checkbox label="Avail leave encashment with LTC" checked={form.encashLtc} onChange={(e) => setField('encashLtc', e.target.checked)} />
                    {form.encashLtc && (
                      <Input label="Encashment days" type="number" min={1} max={10} step={1} value={String(form.encashDays)} error={formErrors.encashDays}
                        placeholder="1 to 10" onChange={(e) => setField('encashDays', Number(e.target.value))} containerClassName="sm:w-1/2" />
                    )}
                  </div>
                )}
              </div>
            )}

            {type && (type.needsContact || type.offDaysOnly || form.stationLeave) && (
              <div>
                <Textarea label={`Contact address during ${type.code} with mobile number`} required rows={2} maxLength={300} placeholder={`Enter contact address & mobile number during ${type.code}...`}
                  value={form.contactAddress} error={formErrors.contactAddress} onChange={(e) => setField('contactAddress', e.target.value)} />
              </div>
            )}

            {(needsCertificate || form.certificateFile || editing?.certificateName) && (
              <div>
                <div className="text-xs font-semibold text-slate-700 select-none mb-1.5">Medical certificate{needsCertificate && <span className="text-rose-500 ml-0.5">*</span>}</div>
                <input ref={certInput} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden"
                  onChange={(e) => { pickCertificate(e.target.files?.[0]); e.target.value = ''; }} />
                <div className={`flex items-center gap-2 rounded-xl border px-3 h-9 text-xs ${formErrors.certificate ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'}`}>
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-slate-700">{form.certificateFile?.name ?? editing?.certificateName ?? 'No file chosen'}</span>
                  {form.certificateFile && <button type="button" onClick={() => setField('certificateFile', null)} className="text-slate-500 hover:text-error font-semibold cursor-pointer">Remove</button>}
                  <button type="button" onClick={() => certInput.current?.click()} className="text-primary font-bold cursor-pointer">
                    {form.certificateFile || editing?.certificateName ? 'Replace' : 'Choose file'}
                  </button>
                </div>
                {formErrors.certificate ? <div className="text-[11px] font-semibold text-rose-600 leading-tight mt-1.5">{formErrors.certificate}</div> : null}
              </div>
            )}

            <div>
              <Textarea label="Reason for leave" required rows={3} maxLength={1000} placeholder="State the reason for your leave application..." value={form.reason} error={formErrors.reason}
                onChange={(e) => setField('reason', e.target.value)} />
            </div>
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
            {viewing.purpose && <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Purpose</dt><dd className="text-slate-900 font-medium">{viewing.purpose}</dd></div>}
            {viewing.childEvent && (
              <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">{viewing.leaveTypeCode === MATERNITY_CODE ? 'Maternity Leave for' : viewing.childEvent === 'care' ? 'Child Care Leave for' : 'Paternity Leave for'}</dt><dd className="text-slate-900 font-medium">
                {viewing.childEvent === 'care'
                  ? `${viewing.childOrder === 2 ? 'Second eldest' : 'Eldest'} surviving child${viewing.childBirthDate ? ` · born ${formatDate(viewing.childBirthDate)}` : ''}${viewing.childDisabled ? ' · with a disability' : ''}${viewing.singleParent ? ' · single mother' : ''}`
                  : viewing.childEvent === 'loss'
                    ? `Abortion / miscarriage${viewing.childEventDate ? ` on ${formatDate(viewing.childEventDate)}` : ''}`
                    : <>
                      {viewing.childEvent === 'delivery' ? 'Birth of a child' : 'Adoption of a child'}
                      {viewing.childEventDate ? ` · ${viewing.childEvent === 'delivery' ? 'date of delivery' : 'date of adoption'} ${formatDate(viewing.childEventDate)}` : ''}
                      {viewing.childBirthDate ? ` · child born ${formatDate(viewing.childBirthDate)}` : ''}
                      {viewing.survivingChildren !== null ? ` · surviving children before: ${viewing.survivingChildren}` : ''}
                    </>}
              </dd></div>
            )}
            <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Reason</dt><dd className="text-slate-900 font-medium whitespace-pre-wrap">{viewing.reason}</dd></div>
            {viewing.compOffDates.length > 0 && <div><dt className="font-semibold text-slate-500">Worked days used</dt><dd className="text-slate-900 font-medium">{viewing.compOffDates.map(formatDate).join(', ')}</dd></div>}
            <div><dt className="font-semibold text-slate-500">Station permission</dt><dd className="text-slate-900 font-medium">{viewing.stationLeave ? 'Station leave' : 'Not required (HQ)'}</dd></div>
            {viewing.ltcType !== 'none' && <div><dt className="font-semibold text-slate-500">LTC / Ex-India</dt><dd className="text-slate-900 font-medium">{viewing.ltcType === 'ltc' ? `Availing LTC${viewing.encashDays ? ` · encashment ${viewing.encashDays} days` : ''}` : 'Ex-India'}</dd></div>}
            {viewing.prefixFrom && <div><dt className="font-semibold text-slate-500">Prefix holidays</dt><dd className="text-slate-900 font-medium">{formatDate(viewing.prefixFrom)} to {formatDate(viewing.prefixTo ?? viewing.prefixFrom)}</dd></div>}
            {viewing.suffixFrom && <div><dt className="font-semibold text-slate-500">Suffix holidays</dt><dd className="text-slate-900 font-medium">{formatDate(viewing.suffixFrom)} to {formatDate(viewing.suffixTo ?? viewing.suffixFrom)}</dd></div>}
            {viewing.contactAddress && <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Contact address</dt><dd className="text-slate-900 font-medium whitespace-pre-wrap">{viewing.contactAddress}</dd></div>}
            {viewing.certificateName && (
              <div className="sm:col-span-2">
                <dt className="font-semibold text-slate-500">Medical certificate</dt>
                <dd>
                  <button type="button" onClick={() => void downloadCertificate(viewing.id)} className="inline-flex items-center gap-1.5 text-primary font-bold cursor-pointer hover:underline">
                    <Paperclip className="w-3.5 h-3.5" />{viewing.certificateName}
                  </button>
                  {certError ? <div className="text-error text-[11px] mt-1">{certError}</div> : null}
                </dd>
              </div>
            )}
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
            {joining.byRequest.get(viewing.id) && <JoiningDetails item={joining.byRequest.get(viewing.id) as JoiningItem} />}
          </dl>
        )}
      </Modal>
      {joining.modals}

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
