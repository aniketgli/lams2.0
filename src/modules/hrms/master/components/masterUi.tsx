import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, XCircle } from 'lucide-react';
import { Button, Modal, Textarea } from '../../../../shared/components';

/**
 * Small building blocks shared by every Master Settings panel, so all
 * masters look and behave the same.
 */

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** White panel with a title row and optional actions on the right. */
export const PanelCard: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, count, actions, children }) => (
  <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          {title}
          {count !== undefined && <span className="text-xs font-semibold text-slate-500">({count})</span>}
        </h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

export const StatusPill: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-success-subtle text-success border-success-border' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-success' : 'bg-slate-400'}`} aria-hidden="true" />
    {active ? 'Active' : 'Inactive'}
  </span>
);

/** Tab strip used both for the Master Settings sections and for sub-masters. */
export function TabStrip<T extends string>({ tabs, value, onChange, size = 'md' }: {
  tabs: { id: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (id: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={`flex flex-wrap gap-1 ${size === 'md' ? 'bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs' : ''}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg font-semibold transition-colors cursor-pointer ${size === 'md' ? 'px-3.5 py-2 text-xs' : 'px-3 py-1.5 text-[11px]'} ${
              active ? 'bg-primary text-white shadow-xs' : size === 'md' ? 'text-slate-600 hover:bg-slate-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export const ReadOnlyNotice: React.FC = () => (
  <div className="flex items-center gap-2 rounded-xl border border-primary-border bg-primary-subtle px-4 py-2.5 text-xs text-primary">
    <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
    <span><strong>Read-only view.</strong> You are viewing master settings as Auditor. Every change made by administrators is listed under Audit Trail.</span>
  </div>
);

// ---- Notices (success / error banner) -------------------------------------------

export interface Notice { kind: 'success' | 'error'; text: string }

export function useNotice(): [Notice | null, (kind: Notice['kind'], text: string) => void, () => void] {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const clear = useCallback(() => setNotice(null), []);
  const show = useCallback((kind: Notice['kind'], text: string) => {
    window.clearTimeout(timer.current);
    setNotice({ kind, text });
    if (kind === 'success') timer.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [notice, show, clear];
}

export const NoticeBar: React.FC<{ notice: Notice | null; onClose: () => void }> = ({ notice, onClose }) => {
  if (!notice) return null;
  const ok = notice.kind === 'success';
  return (
    <div role={ok ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium ${ok ? 'bg-success-subtle border-success-border text-success' : 'bg-error-subtle border-error-border text-error'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" /> : <XCircle className="w-4 h-4 shrink-0 mt-px" />}
      <span className="flex-1">{notice.text}</span>
      <button type="button" onClick={onClose} className="font-bold opacity-70 hover:opacity-100 cursor-pointer" aria-label="Dismiss">×</button>
    </div>
  );
};

// ---- Confirmation with optional reason (kept in the audit trail) -----------------

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel, danger, busy, error, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      size="sm"
      title={title}
      icon={<AlertTriangle className={`w-5 h-5 ${danger ? 'text-error' : 'text-warning'}`} />}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" loading={busy} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-slate-700 leading-relaxed">{message}</div>
        <Textarea
          label="Reason (optional, saved in the audit trail)"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
      </div>
    </Modal>
  );
};

/** Turns the server's field errors ({ "fields.type": "..." }) into a lookup. */
export function fieldErrors(details?: Record<string, string>): Record<string, string> {
  return details ?? {};
}
