import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { Button, DataTable, Modal } from '../../../shared/components';
import type { ColumnDef } from '../../../shared/components';
import { ApiError } from '../../../shared/services/api';
import { downloadCsvText } from '../../../shared/services/printTable';
import { ProjectImportReview, projectsApi } from '../projectsApi';

/**
 * Bulk import of projects, laid out like the other imports (Leave Balance, employees): download the template,
 * provide the CSV (click or drag & drop), Review & Verify (nothing is written), then import every row or none.
 * Funding agencies and PI / Co-PI biometric IDs must already exist.
 */
interface Props { open: boolean; onClose: () => void; onImported: (message: string) => void }

type Row = ProjectImportReview['rows'][number];
const REQUIRED = ['Project_Code', 'Title'];

export const ProjectImportModal: React.FC<Props> = ({ open, onClose, onImported }) => {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [review, setReview] = useState<ProjectImportReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setCsv(null); setFileName(''); setReview(null); setError(null); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const download = async () => {
    setBusy(true); setError(null);
    try {
      const t = await projectsApi.template();
      downloadCsvText(t.csv, t.fileName);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The template could not be downloaded.');
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setReview(null);
    if (file.size > 3 * 1024 * 1024) { setError('The file is too large (at most 3 MB).'); return; }
    setCsv(await file.text());
    setFileName(file.name);
  };

  const doReview = async () => {
    if (!csv) return;
    setBusy(true); setError(null);
    try {
      setReview(await projectsApi.reviewImport(csv));
    } catch (e) {
      setError(e instanceof ApiError ? (e.details?.csv ?? e.message) : 'The file could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!csv) return;
    setBusy(true); setError(null);
    try {
      const r = await projectsApi.applyImport(csv);
      reset();
      onImported(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? (e.details?.csv ?? e.message) : 'The projects could not be imported.');
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<Row>[] = [
    { key: 'line', header: 'Line', width: '64px', sortValue: (r) => r.line, render: (r) => r.line },
    { key: 'code', header: 'Project code', sortValue: (r) => r.code, render: (r) => <span className="font-mono text-xs">{r.code || '—'}</span> },
    { key: 'title', header: 'Title', sortValue: (r) => r.title, render: (r) => <span className="text-xs">{r.title || '—'}</span> },
    {
      key: 'check', header: 'Check', sortValue: (r) => r.status,
      render: (r) => r.status === 'error'
        ? <span className="text-error text-xs whitespace-normal leading-snug">{r.error}</span>
        : <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Ready</span>,
    },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={close}
      size={review ? '2xl' : 'lg'}
      icon={Upload}
      title="Import Projects"
      footer={review ? (
        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft} onClick={() => { setReview(null); setError(null); }} disabled={busy}>Back</Button>
          <Button variant="primary" size="sm" onClick={() => void doImport()} loading={busy} disabled={review.summary.errors > 0 || review.summary.ok === 0}>
            {review.summary.ok ? `Import ${review.summary.ok} project${review.summary.ok === 1 ? '' : 's'}` : 'Nothing to import'}
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
            <span className="px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700">{review.summary.rows} rows · {fileName}</span>
            <span className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">{review.summary.ok} ready</span>
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
            <button type="button" onClick={() => void download()} disabled={busy}
              className="w-full h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 hover:brightness-95 bg-blue-50 border-blue-200 text-blue-700">
              <FileText className="w-3.5 h-3.5" />Projects template (CSV)
            </button>
            <p className="text-[11px] text-slate-500 mt-2">
              Fill one row per project below the two rows that start with #. Dates as DD-MM-YYYY; Funding_Agency by its name or code
              (Funding Agencies tab); PI and Co-PIs by biometric ID (Co-PIs separated by ;). Codes and titles must be new: existing projects are edited one by one.
            </p>
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
              <p className="inline-block mt-3 text-[11px] text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-white">Required Headers: {REQUIRED.join(', ')} · the other columns of the template are optional</p>
              <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
};
