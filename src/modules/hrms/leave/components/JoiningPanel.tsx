import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsRight, ClipboardCheck, Fingerprint, Paperclip, Pencil, Send, X } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { Modal } from '../../../../shared/components';
import { Textarea } from '../../../../shared/components/forms/Textarea';
import { ApiError } from '../../../../shared/services/api';
import { JoiningFile, JoiningItem, leaveApi } from '../leaveApi';

/**
 * Joining report after a 2-stage leave, shown on the leave's own row. The server works out the joining day (the first
 * working day after the leave), makes the form from the application and the biometric punch, and decides who may submit
 * and decide; this only shows it. The employee checks the form and submits; the reporting manager forwards; the HoD
 * approves or rejects.
 */

type Shown = 'due' | 'pending_l1' | 'pending_l2' | 'approved' | 'rejected';
const META: Record<Shown, { label: string; text: string }> = {
  due: { label: 'Joining form due', text: 'text-violet-700' },
  pending_l1: { label: 'Joining pending', text: 'text-amber-700' },
  pending_l2: { label: 'Joining with HoD', text: 'text-sky-700' },
  approved: { label: 'Joining approved', text: 'text-emerald-700' },
  rejected: { label: 'Joining rejected', text: 'text-rose-700' },
};
const shown = (i: JoiningItem): Shown => i.report?.status ?? 'due';

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
const formatStamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const duration = (i: JoiningItem) => (i.startDate === i.endDate ? formatDate(i.startDate) : `${formatDate(i.startDate)} – ${formatDate(i.endDate)}`);
const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const punchText = (inn: string | null, out: string | null) => (inn || out ? `In ${inn ?? '—'} · Out ${out ?? '—'}` : 'No punch');

/** Who the joining status line names: the person it waits for, or who decided. */
const statusBy = (i: JoiningItem) => {
  const r = i.report;
  if (!r) return '';
  return r.status === 'pending_l1' ? `by ${r.managerName ?? 'Administrator'} (${r.managerName ? 'R.M.' : 'Admin'})`
    : r.status === 'pending_l2' ? `by ${r.reviewerName ?? 'HoD'} (HoD)`
    : `by ${r.actionByName ?? '—'}${r.actionByRole ? ` (${r.actionByRole})` : ''}`;
};

const Detail: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? 'sm:col-span-2' : undefined}><dt className="font-semibold text-slate-500">{label}</dt><dd className="text-slate-900 font-medium whitespace-pre-wrap">{children}</dd></div>
);

/** The joining line under a leave's status: what stage the joining report is at, and who has it. */
export const JoiningStatusLine: React.FC<{ item: JoiningItem | undefined }> = ({ item }) => {
  if (!item) return null;
  const by = statusBy(item);
  return (
    <div className={`text-[11px] font-semibold leading-tight ${META[shown(item)].text}`} title={`${META[shown(item)].label} ${by}`}>
      {META[shown(item)].label}{by ? <span className="font-normal text-slate-500"> {by}</span> : null}
    </div>
  );
};

/** The joining report inside the leave's details. */
export const JoiningDetails: React.FC<{ item: JoiningItem }> = ({ item }) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const r = item.report;
  return (
    <div className="sm:col-span-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-1.5">
      <dt className="font-semibold text-violet-800">Joining report</dt>
      <dd className="space-y-1 text-slate-700">
        <div>Joining date: <strong className="text-slate-900">{formatDate(item.joiningDate)}</strong>{r ? ` · ${punchText(r.punchIn, r.punchOut)}` : ''}</div>
        <div className={`font-semibold ${META[shown(item)].text}`}>{META[shown(item)].label} <span className="font-normal text-slate-500">{statusBy(item)}</span></div>
        {r?.submittedAt && <div>Submitted by {r.submittedByName} · {formatStamp(r.submittedAt)}</div>}
        {r?.forwardedByName && <div>Forwarded by {r.forwardedByName} · {formatStamp(r.forwardedAt)}{r.forwardComment ? ` · “${r.forwardComment}”` : ''}</div>}
        {r && (r.status === 'approved' || r.status === 'rejected') && <div>{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.actionByName ?? '—'} · {formatStamp(r.actionAt)}</div>}
        {r?.comment && <div className="text-slate-600">“{r.comment}”</div>}
        {r?.fitnessName && (
          <div>
            <button type="button" onClick={() => { setFileError(null); leaveApi.downloadFitness(item.requestId).catch((e) => setFileError(e instanceof Error ? e.message : 'The certificate could not be downloaded.')); }}
              className="inline-flex items-center gap-1.5 text-primary font-bold cursor-pointer hover:underline"><Paperclip className="w-3.5 h-3.5" />{r.fitnessName}</button>
            {fileError ? <div className="text-error text-[11px] mt-1">{fileError}</div> : null}
          </div>
        )}
      </dd>
    </div>
  );
};

const iconBtn = 'w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer shrink-0';
const cancelBtn = 'h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer';

export function useJoining(onDone: (message: string) => void) {
  const { currentUser } = useApp();
  const role = currentUser.role;

  // ---- Data: the joining report of every 2-stage leave the viewer can see ---------------------------
  const [items, setItems] = useState<JoiningItem[]>([]);
  const reload = useCallback(async () => {
    try {
      setItems((await leaveApi.joining()).items);
    } catch {
      setItems([]); // the leave list still works without it
    }
  }, []);
  useEffect(() => { void reload(); }, [reload, role]);
  const byRequest = useMemo(() => new Map(items.map((i) => [i.requestId, i])), [items]);

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
      onDone(result.message);
      await reload();
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
      onDone(result.message);
      await reload();
    } catch (e) {
      setDecideError(e instanceof ApiError ? [e.message, ...Object.values(e.details ?? {})].filter(Boolean).join(' ') : 'The decision could not be saved.');
    } finally {
      setDecideBusy(false);
    }
  };

  /** The joining buttons of a leave's row. */
  const actions = (item: JoiningItem | undefined) => item && (
    <>
      {(item.canSubmit || item.canEdit) && (
        <button type="button" onClick={() => void openForm(item)} title={item.report ? 'Check the joining form and submit again' : 'Fill joining form'} aria-label={`Joining form of ${item.name}`}
          className={`${iconBtn} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`}>{item.report ? <Pencil className="w-3.5 h-3.5" /> : <ClipboardCheck className="w-3.5 h-3.5" />}</button>
      )}
      {item.canDecide && (
        <>
          <button type="button" onClick={() => { setDeciding({ item, action: 'approve' }); setComment(''); setDecideError(null); }} title={item.decideStep === 'forward' ? 'Forward joining report to HoD' : 'Approve joining report'}
            aria-label={`${item.decideStep === 'forward' ? 'Forward' : 'Approve'} joining report of ${item.name}`} className={`${iconBtn} border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200`}>
            {item.decideStep === 'forward' ? <ChevronsRight className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={() => { setDeciding({ item, action: 'reject' }); setComment(''); setDecideError(null); }} title="Reject joining report" aria-label={`Reject joining report of ${item.name}`}
            className={`${iconBtn} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}><X className="w-3.5 h-3.5" /></button>
        </>
      )}
    </>
  );

  const modals = (
    <>
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

    </>
  );

  return { byRequest, reload, actions, modals };
}
