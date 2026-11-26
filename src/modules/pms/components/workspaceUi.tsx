import React, { useState } from 'react';
import { AppDatePicker } from '../../../shared/components/AppDatePicker';

/** Small pieces shared by the project workspace tabs. */

export const Field: React.FC<{ label: string; required?: boolean; error?: string; wide?: boolean; children: React.ReactNode }> = ({ label, required, error, wide, children }) => (
  <div className={wide ? 'md:col-span-2' : ''}>
    <label className="block text-slate-700 font-bold mb-1 text-xs">{label}{required && <span className="text-blue-600 font-bold ml-0.5">*</span>}</label>
    {children}
    {error && <p className="mt-1 text-[11px] font-semibold text-error">{error}</p>}
  </div>
);

/** A date field (YYYY-MM-DD) with its own open / close state. */
export const DateField: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; minDate?: string }> = ({ value, onChange, placeholder, minDate }) => {
  const [open, setOpen] = useState(false);
  return (
    <AppDatePicker value={value} minDate={minDate} isOpen={open} onToggle={() => setOpen((o) => !o)}
      onChange={(d) => { onChange(d); setOpen(false); }} placeholder={placeholder ?? 'Choose a date'} />
  );
};

export const Panel: React.FC<{ title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="bg-white border border-slate-200 rounded-2xl shadow-xs">
    <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {action}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

export const ErrorLine: React.FC<{ text: string | null }> = ({ text }) => (text
  ? <div role="alert" className="px-3 py-2 rounded-xl border bg-error-subtle border-error-border text-error text-xs font-semibold">{text}</div>
  : null);

export const RowActions: React.FC<{ onEdit?: () => void; onDelete?: () => void }> = ({ onEdit, onDelete }) => (
  <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
    {onEdit && <button type="button" onClick={onEdit} className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Edit</button>}
    {onDelete && <button type="button" onClick={onDelete} className="px-2 py-1 rounded-lg border border-error-border text-[11px] font-semibold text-error hover:bg-error-subtle">Remove</button>}
  </div>
);
