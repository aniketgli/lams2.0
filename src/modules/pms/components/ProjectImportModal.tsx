import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button, Modal } from '../../../shared/components';
import { ApiError } from '../../../shared/services/api';
import { downloadCsvText } from '../../../shared/services/printTable';
import { ProjectImportReview, projectsApi } from '../projectsApi';

/**
 * Bulk import of projects: download the template, fill one row per project, review (nothing is written), import
 * (every row, or none when one has a problem). Funding agencies and PI / Co-PI biometric IDs must already exist.
 */
interface Props { open: boolean; onClose: () => void; onImported: (message: string) => void }

export const ProjectImportModal: React.FC<Props> = ({ open, onClose, onImported }) => {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [review, setReview] = useState<ProjectImportReview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setCsv(null); setFileName(''); setReview(null); setError(null); if (input.current) input.current.value = ''; };
  const close = () => { reset(); onClose(); };

  const template = async () => {
    setBusy('template'); setError(null);
    try {
      const t = await projectsApi.template();
      downloadCsvText(t.csv, t.fileName);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The template could not be downloaded.');
    } finally {
      setBusy(null);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setReview(null);
    const text = await file.text();
    setCsv(text); setFileName(file.name);
    setBusy('review');
    try {
      setReview(await projectsApi.reviewImport(text));
    } catch (e) {
      setError(e instanceof ApiError ? (e.details?.csv ?? e.message) : 'The file could not be checked.');
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!csv) return;
    setBusy('import'); setError(null);
    try {
      const r = await projectsApi.applyImport(csv);
      reset();
      onImported(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? (e.details?.csv ?? e.message) : 'The projects could not be imported.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={close}
      size={review ? '2xl' : 'lg'}
      icon={Upload}
      title="Import projects"
      subtitle="One row per project. Codes and titles must be new; existing projects are edited one by one."
      footer={(
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={close} disabled={busy === 'import'}>Close</Button>
          <Button variant="primary" size="sm" onClick={() => void apply()} loading={busy === 'import'} disabled={!review || review.summary.errors > 0 || review.summary.ok === 0}>
            {review ? `Import ${review.summary.ok} project${review.summary.ok === 1 ? '' : 's'}` : 'Import'}
          </Button>
        </div>
      )}
    >
      <div className="space-y-3 text-xs">
        <ol className="list-decimal pl-4 space-y-1 text-slate-600">
          <li>Download the template and fill one row per project below the two rows that start with #.</li>
          <li>Dates as DD-MM-YYYY; Funding_Agency as its name or code (Funding Agencies tab); PI / Co-PIs by biometric ID (Co-PIs separated by ;).</li>
          <li>Choose the file: every row is checked first and nothing is saved until you press Import.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => void template()} loading={busy === 'template'}>Download template</Button>
          <Button variant="secondary" size="sm" leftIcon={<Upload className="w-4 h-4" />} onClick={() => input.current?.click()} loading={busy === 'review'}>
            {fileName ? 'Choose another file' : 'Choose CSV file'}
          </Button>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
          {fileName && <span className="self-center text-slate-500">{fileName}</span>}
        </div>
        {error && <div role="alert" className="px-3 py-2 rounded-xl border bg-error-subtle border-error-border text-error font-semibold">{error}</div>}
        {review && (
          <>
            <div className={`px-3 py-2 rounded-xl border font-semibold ${review.summary.errors ? 'bg-error-subtle border-error-border text-error' : 'bg-success-subtle border-success-border text-success'}`}>
              {review.summary.rows} row(s): {review.summary.ok} ready, {review.summary.errors} with problems.
              {review.summary.errors > 0 && ' Fix the file and choose it again; nothing is imported while a row has a problem.'}
            </div>
            <div className="overflow-x-auto max-h-[50vh] border border-slate-200 rounded-xl">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 px-2">Line</th><th className="py-2 px-2">Code</th><th className="py-2 px-2">Title</th><th className="py-2 px-2">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {review.rows.map((r) => (
                    <tr key={r.line} className="border-b border-slate-100 align-top">
                      <td className="py-2 px-2">{r.line}</td><td className="py-2 px-2 font-mono">{r.code}</td><td className="py-2 px-2">{r.title}</td>
                      <td className={`py-2 px-2 font-semibold ${r.status === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{r.error ?? 'Ready'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
