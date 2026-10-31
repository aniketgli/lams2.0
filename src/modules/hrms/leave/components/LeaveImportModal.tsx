import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, FileText, Minus, Plus, RefreshCw, Upload } from 'lucide-react';
import { Button, DataTable, Modal } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { downloadCsvText, toCsvText } from '../../../../shared/services/printTable';
import { ImportReview, ImportRow, ImportStrategy, leaveApi } from '../leaveApi';

/**
 * Import leave quotas from a CSV (Biometric_ID, Leave_Year, Leave_Code, Total_Quota).
 * Step 1 picks a template / strategy and the file; step 2 shows what the server found in every
 * row (nothing is written yet); importing writes all rows, or none when one has a problem.
 * The template is made by the server from the database, so nothing here is hard-coded.
 */

const MAX_BYTES = 1024 * 1024;
const HEADERS = ['Biometric_ID', 'Leave_Year', 'Leave_Code', 'Total_Quota'];
const TEMPLATES = [
  { cycle: 'CY' as const, label: 'Regular (CY)', tone: 'text-blue-700 border-blue-200 bg-blue-50' },
  { cycle: 'FY' as const, label: 'Project (FY)', tone: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
];
const STRATEGIES: { value: ImportStrategy; label: string; icon: React.ElementType; note: string }[] = [
  { value: 'set', label: 'Set Quota', icon: RefreshCw, note: 'Total_Quota becomes the new total' },
  { value: 'add', label: 'Add (+)', icon: Plus, note: 'Total_Quota is added to the current total' },
  { value: 'deduct', label: 'Deduct (-)', icon: Minus, note: 'Total_Quota is taken off the current total' },
];
const days = (n: number | null) => (n === null ? '—' : String(Math.round(n * 10) / 10));

interface Props {
  open: boolean;
  year: number;
  onClose: () => void;
  onImported: (message: string) => void;
}

export const LeaveImportModal: React.FC<Props> = ({ open, year, onClose, onImported }) => {
  const [strategy, setStrategy] = useState<ImportStrategy>('set');
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ImportReview | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setStrategy('set'); setFileName(''); setCsv(''); setBusy(false); setError(null); setReview(null); };
  const close = () => { if (busy) return; reset(); onClose(); };

  // ---- Template, made by the server from the database -------------------------------------------
  const download = async (cycle: 'CY' | 'FY') => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const t = await leaveApi.importTemplate(year, cycle);
      if (t.rows.length === 0) { setError('There are no employees and leave types to put in the template for this selection.'); return; }
      downloadCsvText(toCsvText(t.headers, t.rows), `WII_Leave_Balance_Template_${cycle}_${year}`);
    } catch (e) { fail(e, 'The template could not be made. Please try again.'); } finally { setBusy(false); }
  };

  // ---- File ------------------------------------------------------------------------------------
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) { setError('Choose a .csv, .tsv or .txt file.'); return; }
    if (file.size > MAX_BYTES) { setError('The file is larger than 1 MB.'); return; }
    setCsv(await file.text());
    setFileName(file.name);
  };

  function fail(e: unknown, fallback: string) {
    if (e instanceof ApiError) setError(e.details?.csv || e.message); else setError(fallback);
  }
  const doReview = async () => {
    if (!csv || busy) return;
    setBusy(true); setError(null);
    try { setReview(await leaveApi.reviewImport({ strategy, csv })); } catch (e) { fail(e, 'The file could not be checked. Please try again.'); } finally { setBusy(false); }
  };
  const doImport = async () => {
    if (!review || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await leaveApi.applyImport({ strategy, csv });
      reset(); onImported(result.message);
    } catch (e) {
      fail(e, 'The import failed. Nothing was changed.');
      try { setReview(await leaveApi.reviewImport({ strategy, csv })); } catch { /* keep the old review */ }
    } finally { setBusy(false); }
  };

  const columns: ColumnDef<ImportRow>[] = [
    { key: 'line', header: 'Line', width: '7%', sortValue: (r) => r.line, render: (r) => <span className="text-slate-500">{r.line}</span> },
    {
      key: 'employee', header: 'Employee', sortValue: (r) => r.employee || r.biometricId,
      render: (r) => <div className="leading-tight"><div className="font-semibold text-slate-900">{r.employee || '—'}</div><div className="text-[11px] text-slate-500">B.I. {r.biometricId || '—'}</div></div>,
    },
    { key: 'cycle', header: 'Leave year', align: 'center', sortValue: (r) => r.cycle, render: (r) => r.cycle || '—' },
    { key: 'leave', header: 'Leave', render: (r) => <div className="leading-tight"><div className="font-semibold">{r.leaveCode || '—'}</div>{r.leaveType && <div className="text-[11px] text-slate-500">{r.leaveType}</div>}</div> },
    { key: 'value', header: 'Total_Quota', align: 'center', render: (r) => r.value || '—' },
    { key: 'change', header: 'Total days', align: 'center', render: (r) => (r.before === null ? '—' : <span className="whitespace-nowrap">{days(r.before)} → <b>{days(r.after)}</b></span>) },
    {
      key: 'status', header: 'Result', width: '30%', sortValue: (r) => r.status,
      render: (r) => r.status === 'error'
        ? <span className="text-error text-xs whitespace-normal leading-snug">{r.error}</span>
        : <span className={`inline-flex items-center gap-1 text-xs font-bold ${r.status === 'ok' ? 'text-emerald-700' : 'text-slate-500'}`}><CheckCircle2 className="w-3.5 h-3.5" />{r.status === 'ok' ? 'Will change' : 'No change'}</span>,
    },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={close}
      size={review ? '2xl' : 'lg'}
      icon={Upload}
      title="Import Leave Balance"
      footer={review ? (
        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft} onClick={() => { setReview(null); setError(null); }} disabled={busy}>Back</Button>
          <Button variant="primary" size="sm" onClick={() => void doImport()} loading={busy} disabled={review.summary.errors > 0 || review.summary.ok === 0}>
            {review.summary.ok ? `Import ${review.summary.ok} change${review.summary.ok === 1 ? '' : 's'}` : 'Nothing to import'}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={close} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" rightIcon={ArrowRight} onClick={() => void doReview()} loading={busy} disabled={!csv}>Review &amp; Verify</Button>
        </div>
      )}
    >
      {error && <p role="alert" className="mb-4 rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{error}</p>}

      {review ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700">{review.summary.rows} rows · {STRATEGIES.find((s) => s.value === review.strategy)?.label}</span>
            <span className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">{review.summary.ok} will change</span>
            {review.summary.unchanged > 0 && <span className="px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600">{review.summary.unchanged} no change</span>}
            {review.summary.errors > 0 && <span className="px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700">{review.summary.errors} with problems</span>}
          </div>
          {review.summary.errors > 0 && (
            <p className="flex items-start gap-2 text-xs text-error"><AlertCircle className="w-4 h-4 shrink-0" />Nothing is imported while a row has a problem. Fix the file and choose it again.</p>
          )}
          <DataTable columns={columns} data={review.rows} keyExtractor={(r) => String(r.line)} emptyTitle="No rows" />
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-bold text-slate-700 mb-2">Download Template</h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(({ cycle, label, tone }) => (
                <button key={cycle} type="button" onClick={() => void download(cycle)} disabled={busy}
                  className={`h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 hover:brightness-95 ${tone}`}>
                  <FileText className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-700 mb-2">Choose Import Strategy</h3>
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {STRATEGIES.map(({ value, label, icon: Icon, note }) => (
                <button key={value} type="button" role="radio" aria-checked={strategy === value} title={note} onClick={() => setStrategy(value)}
                  className={`h-10 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${strategy === value ? 'bg-blue-600 border-blue-600 text-white shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-700 mb-2">Provide CSV Data</h3>
            <div
              role="button" tabIndex={0} aria-label="Choose a CSV file"
              onClick={() => input.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); void readFile(e.dataTransfer.files[0]); }}
              className={`rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${drag ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'}`}>
              <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">{fileName ? <FileSpreadsheet className="w-5 h-5 text-blue-600" /> : <Upload className="w-5 h-5 text-blue-600" />}</div>
              <p className="text-sm font-bold text-slate-900">{fileName || 'Click to upload or drag & drop CSV file'}</p>
              <p className="text-[11px] text-slate-500 mt-1">{fileName ? 'Click to choose another file' : 'Accepts standard CSV or Tab-delimited files (.csv, .tsv, .txt)'}</p>
              <p className="inline-block mt-3 text-[11px] text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-white">Required Headers: {HEADERS.join(', ')}</p>
              <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
};
