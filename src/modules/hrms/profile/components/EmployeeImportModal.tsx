import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, FileText, ListChecks, Upload } from 'lucide-react';
import { Button, Checkbox, DataTable, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { downloadCsvText, toCsvText } from '../../../../shared/services/printTable';
import { EmployeeImportReview, EmployeeImportRow, EmployeeImportType, employeeImportApi } from '../employeeApi';

/**
 * Bulk import of new employees, one employee type per file.
 * Step 1: choose the type, download its template (and the values each column accepts), choose the filled file.
 * Step 2: the server tries every row with all the checks of "New employee" and shows the result; nothing is kept.
 * Import: all rows, or none when one has a problem.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (message: string) => void;
}

export const EmployeeImportModal: React.FC<Props> = ({ open, onClose, onImported }) => {
  const [types, setTypes] = useState<EmployeeImportType[]>([]);
  const [type, setType] = useState('');
  const [sendWelcome, setSendWelcome] = useState(true);
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<EmployeeImportReview | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    employeeImportApi.types().then((r) => setTypes(r.types)).catch(() => setError('The employee types could not be loaded.'));
  }, [open]);
  useEffect(() => {
    // The template's columns, to show which ones the chosen type needs.
    setHeaders([]);
    if (!type) return;
    employeeImportApi.template(type).then((t) => setHeaders(t.headers)).catch(() => undefined);
  }, [type]);

  const typeName = types.find((t) => t.code === type)?.name ?? '';
  const reset = () => { setType(''); setSendWelcome(true); setFileName(''); setCsv(''); setBusy(false); setError(null); setReview(null); };
  const close = () => { if (busy) return; reset(); onClose(); };
  const fail = (e: unknown, fallback: string) => setError(e instanceof ApiError ? e.details?.csv || e.message : fallback);
  const slug = typeName.replace(/[^A-Za-z0-9]+/g, '_');

  const downloadTemplate = async () => {
    if (!type || busy) return;
    setBusy(true); setError(null);
    try {
      const t = await employeeImportApi.template(type);
      // Line 2 starts with # and is skipped on import: what each column wants.
      downloadCsvText(toCsvText(t.headers, [t.hints]), `WII_Employee_Import_${slug}`);
    } catch (e) { fail(e, 'The template could not be made.'); } finally { setBusy(false); }
  };
  const downloadValues = async () => {
    if (!type || busy) return;
    setBusy(true); setError(null);
    try {
      const t = await employeeImportApi.template(type);
      const cols = Object.keys(t.values);
      const longest = Math.max(0, ...cols.map((c) => t.values[c].length));
      const rows = Array.from({ length: longest }, (_, i) => cols.map((c) => t.values[c][i] ?? ''));
      downloadCsvText(toCsvText(cols, rows), `WII_Employee_Import_${slug}_allowed_values`);
    } catch (e) { fail(e, 'The list could not be made.'); } finally { setBusy(false); }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setCsv(await file.text());
    setFileName(file.name);
  };
  const body = () => ({ employmentType: type, csv, sendWelcome });
  const doReview = async () => {
    if (!type || !csv || busy) return;
    setBusy(true); setError(null);
    try { setReview(await employeeImportApi.review(body())); } catch (e) { fail(e, 'The file could not be checked.'); } finally { setBusy(false); }
  };
  const doImport = async () => {
    if (!review || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await employeeImportApi.apply(body());
      reset(); onImported(result.message);
    } catch (e) {
      fail(e, 'The import failed. Nothing was added.');
      try { setReview(await employeeImportApi.review(body())); } catch { /* keep the old review */ }
    } finally { setBusy(false); }
  };

  const columns: ColumnDef<EmployeeImportRow>[] = [
    { key: 'line', header: 'Line', width: '4.5rem', sortValue: (r) => r.line, render: (r) => <span className="text-slate-500">{r.line}</span> },
    {
      key: 'employee', header: 'Employee', width: '16rem', sortValue: (r) => r.name,
      render: (r) => <div className="leading-tight"><div className="font-semibold text-slate-900">{r.name || '—'}</div><div className="text-[11px] text-slate-500">B.I. {r.biometricId || '—'}</div></div>,
    },
    {
      key: 'status', header: 'Result', sortValue: (r) => r.status,
      render: (r) => r.status === 'error'
        ? <span className="text-error text-xs whitespace-normal leading-snug">{r.error}</span>
        : <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Will be added</span>,
    },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={close}
      size={review ? '2xl' : 'lg'}
      icon={Upload}
      title={review ? `Import employees · ${review.type.name}` : 'Import employees'}
      footer={review ? (
        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft} onClick={() => { setReview(null); setError(null); }} disabled={busy}>Back</Button>
          <Button variant="primary" size="sm" onClick={() => void doImport()} loading={busy} disabled={review.summary.errors > 0 || review.summary.ok === 0}>
            {`Add ${review.summary.ok} employee${review.summary.ok === 1 ? '' : 's'}`}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={close} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" rightIcon={ArrowRight} onClick={() => void doReview()} loading={busy} disabled={!type || !csv}>Review &amp; Verify</Button>
        </div>
      )}
    >
      {error && <p role="alert" className="mb-4 rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error whitespace-pre-line">{error}</p>}

      {review ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700">{review.summary.rows} rows</span>
            <span className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">{review.summary.ok} ready</span>
            {review.summary.errors > 0 && <span className="px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700">{review.summary.errors} with problems</span>}
            <span className="px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600">{sendWelcome ? 'Welcome email with a temporary password' : 'No email: default password'}</span>
          </div>
          {review.summary.errors > 0 && (
            <p className="flex items-start gap-2 text-xs text-error"><AlertCircle className="w-4 h-4 shrink-0" />Nothing is added while a row has a problem. Fix the file and choose it again.</p>
          )}
          <DataTable columns={columns} data={review.rows} keyExtractor={(r) => String(r.line)} emptyTitle="No rows" />
        </div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-3">
            <Select label="Employee type" required value={type} placeholder="Select the type of all employees in the file" onChange={(v: string) => { setType(v); setReview(null); }}
              options={types.map((t) => ({ value: t.code, label: t.name }))} />
            <p className="text-[11px] text-slate-500">One file has employees of one type only: the type decides the columns, as on the "New employee" form.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => void downloadTemplate()} disabled={!type || busy}
                className="h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 text-blue-700 border-blue-200 bg-blue-50">
                <FileText className="w-3.5 h-3.5" />Download template
              </button>
              <button type="button" onClick={() => void downloadValues()} disabled={!type || busy}
                className="h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 text-emerald-700 border-emerald-200 bg-emerald-50">
                <ListChecks className="w-3.5 h-3.5" />Allowed values (masters)
              </button>
            </div>
          </section>

          <section>
            <div
              role="button" tabIndex={0} aria-label="Choose a CSV file"
              onClick={() => input.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); void readFile(e.dataTransfer.files[0]); }}
              className={`rounded-2xl border-2 border-dashed px-6 py-7 text-center cursor-pointer transition-colors ${drag ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'}`}>
              <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">{fileName ? <FileSpreadsheet className="w-5 h-5 text-blue-600" /> : <Upload className="w-5 h-5 text-blue-600" />}</div>
              <p className="text-sm font-bold text-slate-900">{fileName || 'Click to upload or drag & drop the filled CSV file'}</p>
              <p className="text-[11px] text-slate-500 mt-1">{fileName ? 'Click to choose another file' : 'Save the template from Excel as "CSV UTF-8". Up to 300 employees per file.'}</p>
              {headers.length > 0 && <p className="mt-3 text-[11px] text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-white text-left leading-relaxed">Columns for {typeName}: {headers.join(', ')}</p>}
              <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <Checkbox label="Email each new employee a welcome mail with their login ID and a temporary password" checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />
            <p className="text-[11px] text-slate-500 mt-1.5 ml-6">{sendWelcome
              ? 'Sent one by one after the import (about one every 2 seconds).'
              : 'No email. Everyone signs in with the default password of Master Settings → Organization and must change it.'}</p>
          </section>
        </div>
      )}
    </Modal>
  );
};
