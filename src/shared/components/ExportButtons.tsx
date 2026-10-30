import React from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';

/**
 * The pair of export buttons used across the portal: CSV (light) and PDF (dark).
 * Pass a handler for each format you offer.
 */
export interface ExportButtonsProps {
  onCsv?: () => void;
  onPdf?: () => void;
  busy?: 'csv' | 'pdf' | null;
  disabled?: boolean;
  csvTitle?: string;
  pdfTitle?: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ onCsv, onPdf, busy = null, disabled = false, csvTitle, pdfTitle }) => (
  <div className="flex items-center gap-2 shrink-0">
    {onCsv && (
      <button
        type="button"
        onClick={onCsv}
        disabled={disabled || busy !== null}
        title={csvTitle}
        className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-600" />}
        <span>Export CSV</span>
      </button>
    )}
    {onPdf && (
      <button
        type="button"
        onClick={onPdf}
        disabled={disabled || busy !== null}
        title={pdfTitle}
        className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-rose-400" />}
        <span>Export PDF</span>
      </button>
    )}
  </div>
);
