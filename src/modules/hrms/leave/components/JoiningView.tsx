import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsRight, ClipboardCheck, Clock, Eye, FileCheck2, Fingerprint, Paperclip, Pencil, Send, X, XCircle } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { DataTable, Modal } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { Textarea } from '../../../../shared/components/forms/Textarea';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { ApiError } from '../../../../shared/services/api';
import { NoticeBar, useNotice } from '../../master/components/masterUi';
import { JoiningFile, JoiningItem, leaveApi } from '../leaveApi';

/**
 * Joining reports after a 2-stage leave. The server works out the joining day (the first working day after the leave),
 * makes the form from the application and the biometric punch, and decides who may submit and decide; this page only
 * shows it. The employee checks the form and submits; the reporting manager forwards; the HoD approves or rejects.
 */

type Shown = 'due' | 'pending_l1' | 'pending_l2' | 'approved' | 'rejected';
const META: Record<Shown, { label: string; pill: string }> = {
  due: { label: 'To submit', pill: 'bg-violet-50 text-violet-700 border-violet-200' },
  pending_l1: { label: 'Pending', pill: 'bg-amber-50 text-amber-800 border-amber-200' },
  pending_l2: { label: 'With HoD', pill: 'bg-sky-50 text-sky-700 border-sky-200' },
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', pill: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const SHOWN = Object.keys(META) as Shown[];
const PAGE_SIZES = [25, 50, 100];
const shown = (i: JoiningItem): Shown => i.report?.status ?? 'due';

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
const formatStamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const duration = (i: JoiningItem) => (i.startDate === i.endDate ? formatDate(i.startDate) : `${formatDate(i.startDate)} – ${formatDate(i.endDate)}`);
const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const punchText = (inn: string | null, out: string | null) => (inn || out ? `In ${inn ?? '—'} · Out ${out ?? '—'}` : 'No punch');

/** Who the status line names: the person it waits for, or who decided. */
const statusBy = (i: JoiningItem) => {
  const r = i.report;
  if (!r) return i.name ? `by ${i.name} (Employee)` : '';
  return r.status === 'pending_l1' ? `by ${r.managerName ?? 'Administrator'} (${r.managerName ? 'R.M.' : 'Admin'})`
    : r.status === 'pending_l2' ? `by ${r.reviewerName ?? 'HoD'} (HoD)`
    : `by ${r.actionByName ?? '—'}${r.actionByRole ? ` (${r.actionByRole})` : ''}`;
};

const StatusPill: React.FC<{ item: JoiningItem }> = ({ item }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${META[shown(item)].pill}`}>{META[shown(item)].label}</span>
);

const Detail: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? 'sm:col-span-2' : undefined}><dt className="font-semibold text-slate-500">{label}</dt><dd className="text-slate-900 font-medium whitespace-pre-wrap">{children}</dd></div>
);

export const JoiningView: React.FC = () => {
  const { currentUser, users } = useApp();
  const role = currentUser.role;
  const teamView = role === 'administrator' || role === 'audit' || role === 'reporting_manager' || role === 'reviewing_manager';
  const [notice, showNotice, clearNotice] = useNotice();

  // ---- Data -------------------------------------------------------------------------------
  const [items, setItems] = useState<JoiningItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setItems((await leaveApi.joining()).items);
    } catch (e) {
      setItems([]);
      setError(e instanceof ApiError ? e.message : 'Joining reports could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load, role]);
  const userById = useMemo(() => new Map(users.map((u) => [String(u.id), u])), [users]);

  // ---- Filters --------------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>(['all']);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => matchesMultiSelect(statuses, shown(i)) &&
      (!q || [i.name, i.biometricId, i.department, i.leaveTypeName, i.leaveTypeCode, formatDate(i.joiningDate), META[shown(i)].label].some((v) => (v || '').toLowerCase().includes(q))));
  }, [items, search, statuses]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  useEffect(() => setPage(1), [visible.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice((page - 1) * pageSize, page * pageSize);
  const stats = useMemo(() => ({
    due: items.filter((i) => shown(i) === 'due').length,
    pending: items.filter((i) => shown(i) === 'pending_l1' || shown(i) === 'pending_l2').length,
    approved: items.filter((i) => shown(i) === 'approved').length,
    rejected: items.filter((i) => shown(i) === 'rejected').length,
  }), [items]);
  const statCards = [
    { label: 'To submit', value: stats.due, icon: ClipboardCheck, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
    { label: 'Pending', value: stats.pending, icon: Clock, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Approved', value: stats.approved, icon: FileCheck2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  // ---- The form: details from the application, the punch from the biometric log -----------------
  const [filling, setFilling] = useState<JoiningItem | null>(null);
  const [punch, setPunch] = useState<{ in: string | null; out: string | null } | null>(null);
  const [fitness, setFitness] = useState<JoiningFile | null>(null);
  const [removeFitness, setRemoveFitness] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fitnessError, setFitnessError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const openForm = async (item: JoiningItem) => {
    setFilling(item); setPunch(null); setFitness(null); setRemoveFitness(false); setFormError(null); setFitnessError(null);
    try {
      const prepared = await leaveApi.joiningPrepare(item.requestId);
      setFilling(prepared.item);
      setPunch(prepared.punch);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'The form could not be prepared.');
    }
  };
  const pickFitness = (file: File | undefined) => {
    if (!file) return;
    // Type and size are enforced by the server; this only stops a huge file being read into the page.
    if (file.size > 1024 * 1024) { setFitnessError('Use a fitness certificate smaller than 1 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setFitness({ name: file.name, data: String(reader.result) }); setRemoveFitness(false); setFitnessError(null); };
    reader.onerror = () => setFitnessError('The file could not be read.');
    reader.readAsDataURL(file);
  };
  const submit = async () => {
    if (!filling || saving) return;
    setSaving(true); setFormError(null); setFitnessError(null);
    try {
      const result = filling.report ? await leaveApi.joiningCorrect(filling.requestId, fitness, removeFitness) : await leaveApi.joiningSubmit(filling.requestId, fitness);
      setFilling(null);
      showNotice('success', result.message);
      await load(true);
    } catch (e) {
      if (e instanceof ApiError) {
        setFitnessError(e.details?.certificate ?? null);
        setFormError(e.details?.requestId || (e.details?.certificate ? null : e.message));
      } else {
        setFormError('The joining report could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Forward / approve / reject -------------------------------------------------------------------
  const [deciding, setDeciding] = useState<{ item: JoiningItem; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [decideBusy, setDecideBusy] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const forwarding = Boolean(deciding && deciding.action === 'approve' && deciding.item.decideStep === 'forward');
  const confirmDecide = async () => {
    if (!deciding || decideBusy) return;
    if (deciding.action === 'reject' && comment.trim().length < 3) { setDecideError('Say why the report is rejected.'); return; }
    setDecideBusy(true); setDecideError(null);
    try {
      const result = await leaveApi.joiningDecide(deciding.item.requestId, deciding.action, comment.trim());
      setDeciding(null);
      showNotice('success', result.message);
      await load(true);
    } catch (e) {
      setDecideError(e instanceof ApiError ? [e.message, ...Object.values(e.details ?? {})].filter(Boolean).join(' ') : 'The decision could not be saved.');
    } finally {
      setDecideBusy(false);
    }
  };

  const [viewing, setViewing] = useState<JoiningItem | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const downloadFitness = async (id: string) => {
    setFileError(null);
    try { await leaveApi.downloadFitness(id); } catch (e) { setFileError(e instanceof Error ? e.message : 'The certificate could not be downloaded.'); }
  };

  // ---- Table ------------------------------------------------------------------------------------------
  const iconBtn = 'w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer shrink-0';
  const columns: ColumnDef<JoiningItem>[] = [
    ...(teamView ? [{
      key: 'employee', header: 'Employee', width: '18%',
      render: (i: JoiningItem) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar name={i.name} src={(userById.get(i.userId) as { avatar?: string } | undefined)?.avatar || null} className="w-8 h-8 rounded-full shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-slate-900 truncate">{i.name}</div>
            <div className="text-[11px] text-slate-500 truncate">B.I. {i.biometricId}{i.designation ? ` · ${i.designation}` : ''}</div>
          </div>
        </div>
      ),
    } as ColumnDef<JoiningItem>] : []),
    {
      key: 'leave', header: 'Leave', width: teamView ? '22%' : '28%',
      render: (i) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-900">{i.leaveTypeName} <span className="font-mono text-[11px] text-slate-500">{i.leaveTypeCode}</span></div>
          <div className="text-[11px] text-slate-500 whitespace-nowrap">{duration(i)} · {daysText(i.days)}</div>
        </div>
      ),
    },
    { key: 'joining', header: 'Joining date', width: '11%', render: (i) => <span className="font-semibold text-slate-900 whitespace-nowrap">{formatDate(i.joiningDate)}</span> },
    {
      key: 'punch', header: 'Biometric punch', width: '14%',
      render: (i) => <span className="text-slate-700 text-xs whitespace-nowrap">{i.report ? punchText(i.report.punchIn, i.report.punchOut) : '—'}</span>,
    },
    {
      key: 'status', header: 'Status', width: '15%',
      render: (i) => (
        <div className="leading-tight space-y-1">
          <StatusPill item={i} />
          <div className="text-[11px] text-slate-500 truncate" title={statusBy(i)}>{statusBy(i)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions', width: '14%', align: 'center',
      render: (i: JoiningItem) => (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => { setFileError(null); setViewing(i); }} title="View" aria-label={`View joining report of ${i.name}`}
            className={`${iconBtn} border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50`}><Eye className="w-3.5 h-3.5" /></button>
          {i.canSubmit && (
            <button type="button" onClick={() => void openForm(i)} title="Fill joining form" aria-label={`Fill joining form of ${i.name}`}
              className={`${iconBtn} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`}><ClipboardCheck className="w-3.5 h-3.5" /></button>
          )}
          {i.canEdit && (
            <button type="button" onClick={() => void openForm(i)} title="Check and submit again" aria-label={`Submit joining report of ${i.name} again`}
              className={`${iconBtn} border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50`}><Pencil className="w-3.5 h-3.5" /></button>
          )}
          {i.canDecide && (
            <>
              <button type="button" onClick={() => { setDeciding({ item: i, action: 'approve' }); setComment(''); setDecideError(null); }} title={i.decideStep === 'forward' ? 'Forward to HoD' : 'Approve'}
                aria-label={`${i.decideStep === 'forward' ? 'Forward' : 'Approve'} joining report of ${i.name}`} className={`${iconBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                {i.decideStep === 'forward' ? <ChevronsRight className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => { setDeciding({ item: i, action: 'reject' }); setComment(''); setDecideError(null); }} title="Reject" aria-label={`Reject joining report of ${i.name}`}
                className={`${iconBtn} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}><X className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  const cancelBtn = 'h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer';

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
            </div>
          </div>
        ))}
      </div>

      {error && <div role="alert" className="px-4 py-3 rounded-2xl border text-xs font-semibold bg-error-subtle border-error-border text-error">{error}</div>}

      <FilterToolbar
        search={{ value: search, onChange: setSearch, placeholder: teamView ? 'Search employee, leave type…' : 'Search leave type…' }}
        onReset={search.trim() || !statuses.includes('all') ? () => { setSearch(''); setStatuses(['all']); } : null}
        filters={[<MultiSelectFilter key="status" label="Status" options={SHOWN.map((s) => ({ label: META[s].label, value: s }))} selectedValues={statuses} onChange={setStatuses} />]}
      />

      <DataTable
        columns={columns}
        data={pageRows}
        loading={loading}
        keyExtractor={(i) => i.requestId}
        className={teamView ? 'min-w-[1100px]' : 'min-w-[850px]'}
        emptyTitle={items.length ? 'No joining reports match these filters' : 'No joining reports'}
        emptyDescription={items.length ? 'Change the filters or search.' : 'A joining report appears here from the first working day after a 2-stage leave.'}
        pagination={{ currentPage: page, totalPages, totalItems: visible.length, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize, pageSizeOptions: PAGE_SIZES }}
      />

      <Modal
        isOpen={Boolean(filling)}
        onClose={() => setFilling(null)}
        size="lg"
        icon={<ClipboardCheck className="w-5 h-5 text-blue-300" />}
        title="Joining form"
        subtitle={filling ? `${filling.name} · ${filling.leaveTypeName} ${duration(filling)}` : undefined}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFilling(null)} className={cancelBtn}>Cancel</button>
            <button type="button" onClick={() => void submit()} disabled={saving || !filling || !punch}
              className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60">
              {saving ? 'Saving…' : <span className="inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />{filling?.report ? 'Submit again' : 'Submit'}</span>}
            </button>
          </div>
        )}
      >
        {filling && (
          <div className="space-y-4">
            {formError && <div role="alert" className="px-3 py-2 rounded-xl border text-xs font-semibold bg-error-subtle border-error-border text-error">{formError}</div>}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <Detail label="Employee">{filling.name} (B.I. {filling.biometricId})</Detail>
              <Detail label="Designation / department">{[filling.designation, filling.department].filter(Boolean).join(' · ') || '—'}</Detail>
              <Detail label="Leave type">{filling.leaveTypeName} ({filling.leaveTypeCode})</Detail>
              <Detail label="Days">{daysText(filling.days)}</Detail>
              <Detail label="Leave from">{formatDate(filling.startDate)}</Detail>
              <Detail label="Leave to">{formatDate(filling.endDate)}</Detail>
              {filling.prefixFrom && <Detail label="Prefix holidays">{formatDate(filling.prefixFrom)} to {formatDate(filling.prefixTo ?? filling.prefixFrom)}</Detail>}
              {filling.suffixFrom && <Detail label="Suffix holidays">{formatDate(filling.suffixFrom)} to {formatDate(filling.suffixTo ?? filling.suffixFrom)}</Detail>}
              <Detail label="Station permission">{filling.stationLeave ? 'Station leave' : 'Not required (HQ)'}</Detail>
              {filling.ltcType !== 'none' && <Detail label="LTC / Ex-India">{filling.ltcType === 'ltc' ? 'Availing LTC' : 'Ex-India'}</Detail>}
              {filling.contactAddress && <Detail label="Contact address" wide>{filling.contactAddress}</Detail>}
              <Detail label="Reason" wide>{filling.reason}</Detail>
            </dl>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2"><Fingerprint className="w-4 h-4 text-slate-500" />Joining on {formatDate(filling.joiningDate)} · biometric punch</div>
              {punch === null && !formError ? <p className="text-xs text-slate-500">Checking the biometric log…</p> : punch && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">In</p><p className="font-extrabold text-slate-900">{punch.in ?? '—'}</p></div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">Out</p><p className="font-extrabold text-slate-900">{punch.out ?? '—'}</p></div>
                </div>
              )}
              {punch && !punch.in && !punch.out && <p className="text-xs font-semibold text-rose-600 mt-2">No punch is recorded for the joining day. Apply for manual attendance first.</p>}
            </div>

            {filling.fitnessAllowed && (
              <div>
                <div className="text-xs font-semibold text-slate-700 select-none mb-1.5">Fitness medical certificate (PDF)</div>
                <input ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { pickFitness(e.target.files?.[0]); e.target.value = ''; }} />
                <div className={`flex items-center gap-2 rounded-xl border px-3 h-9 text-xs ${fitnessError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'}`}>
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-slate-700">{fitness?.name || (!removeFitness && filling.report?.fitnessName) || 'No file chosen'}</span>
                  {fitness && <button type="button" onClick={() => setFitness(null)} className="text-slate-500 hover:text-error font-semibold cursor-pointer">Remove</button>}
                  {!fitness && !removeFitness && filling.report?.fitnessName && <button type="button" onClick={() => setRemoveFitness(true)} className="text-slate-500 hover:text-error font-semibold cursor-pointer">Remove</button>}
                  <button type="button" onClick={() => fileInput.current?.click()} className="text-primary font-bold cursor-pointer">{fitness || (!removeFitness && filling.report?.fitnessName) ? 'Replace' : 'Choose file'}</button>
                </div>
                {fitnessError && <div className="text-[11px] font-semibold text-rose-600 leading-tight mt-1.5">{fitnessError}</div>}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        size="sm"
        title={deciding?.action === 'reject' ? 'Reject joining report' : forwarding ? 'Forward joining report to the HoD' : 'Approve joining report'}
        subtitle={deciding ? `${deciding.item.name} · ${duration(deciding.item)}` : undefined}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeciding(null)} disabled={decideBusy} className={cancelBtn}>Cancel</button>
            <button type="button" onClick={() => void confirmDecide()} disabled={decideBusy}
              className={`h-9 px-4 rounded-xl text-white text-xs font-bold cursor-pointer disabled:opacity-60 ${deciding?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {decideBusy ? 'Saving…' : deciding?.action === 'reject' ? 'Reject' : forwarding ? 'Forward' : 'Approve'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          {deciding?.item.report && <p className="text-xs text-slate-600 leading-relaxed">Joined {formatDate(deciding.item.joiningDate)} · {punchText(deciding.item.report.punchIn, deciding.item.report.punchOut)}</p>}
          <Textarea label={deciding?.action === 'reject' ? 'Reason for rejecting *' : 'Comment (optional)'} rows={3} maxLength={500} value={comment}
            error={Boolean(decideError)} onChange={(e) => { setComment(e.target.value); setDecideError(null); }} />
          {decideError && <p role="alert" className="text-xs text-error">{decideError}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="md"
        title="Joining report"
        subtitle={viewing ? `${viewing.name} · ${viewing.leaveTypeName} ${duration(viewing)}` : undefined}
        footer={<div className="flex justify-end"><button type="button" onClick={() => setViewing(null)} className={cancelBtn}>Close</button></div>}
      >
        {viewing && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            <Detail label="Employee">{viewing.name} (B.I. {viewing.biometricId})</Detail>
            <Detail label="Designation / department">{[viewing.designation, viewing.department].filter(Boolean).join(' · ') || '—'}</Detail>
            <Detail label="Leave type">{viewing.leaveTypeName} ({viewing.leaveTypeCode})</Detail>
            <Detail label="Days">{daysText(viewing.days)}</Detail>
            <Detail label="Leave from">{formatDate(viewing.startDate)}</Detail>
            <Detail label="Leave to">{formatDate(viewing.endDate)}</Detail>
            <Detail label="Joining date">{formatDate(viewing.joiningDate)}</Detail>
            <Detail label="Biometric punch">{viewing.report ? punchText(viewing.report.punchIn, viewing.report.punchOut) : '—'}</Detail>
            {viewing.contactAddress && <Detail label="Contact address" wide>{viewing.contactAddress}</Detail>}
            <Detail label="Reason" wide>{viewing.reason}</Detail>
            {viewing.report?.fitnessName && (
              <div className="sm:col-span-2">
                <dt className="font-semibold text-slate-500">Fitness medical certificate</dt>
                <dd>
                  <button type="button" onClick={() => void downloadFitness(viewing.requestId)} className="inline-flex items-center gap-1.5 text-primary font-bold cursor-pointer hover:underline">
                    <Paperclip className="w-3.5 h-3.5" />{viewing.report.fitnessName}
                  </button>
                  {fileError ? <div className="text-error text-[11px] mt-1">{fileError}</div> : null}
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Status</dt>
              <dd className="space-y-1 mt-0.5">
                <StatusPill item={viewing} />
                {viewing.report?.submittedAt && <div className="text-slate-700">Submitted by {viewing.report.submittedByName} · {formatStamp(viewing.report.submittedAt)}</div>}
                {viewing.report?.forwardedByName && <div className="text-slate-700">Forwarded by {viewing.report.forwardedByName} · {formatStamp(viewing.report.forwardedAt)}{viewing.report.forwardComment ? ` · “${viewing.report.forwardComment}”` : ''}</div>}
                <div className="text-slate-700">
                  {!viewing.report ? 'The employee has not submitted it yet'
                    : viewing.report.status === 'pending_l1' ? `Waiting for ${viewing.report.managerName ?? 'an administrator'}`
                    : viewing.report.status === 'pending_l2' ? `Waiting for ${viewing.report.reviewerName ?? 'the HoD'}`
                    : `${viewing.report.status === 'approved' ? 'Approved' : 'Rejected'} by ${viewing.report.actionByName ?? '—'} · ${formatStamp(viewing.report.actionAt)}`}
                </div>
                {viewing.report?.comment && <div className="text-slate-600">“{viewing.report.comment}”</div>}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
};
