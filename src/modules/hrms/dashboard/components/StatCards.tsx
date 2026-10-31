import React from 'react';

export interface Stat {
  label: string;
  value: React.ReactNode;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind classes for the icon chip, as in the Attendance page. */
  tone: string;
  onClick?: () => void;
}

export const TONE = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

/** The row of summary cards at the top of a page (same look as Attendance). */
export const StatCards: React.FC<{ stats: Stat[] }> = ({ stats }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    {stats.map(({ label, value, note, icon: Icon, tone, onClick }) => {
      const body = (
        <>
          <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
            <p className="text-lg font-extrabold text-slate-900">{value}</p>
            <p className="text-[11px] text-slate-500 truncate" title={note}>{note}</p>
          </div>
        </>
      );
      const cls = 'bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 min-w-0';
      return onClick
        ? <button key={label} type="button" onClick={onClick} className={`${cls} cursor-pointer hover:border-primary/40 transition-colors`}>{body}</button>
        : <div key={label} className={cls}>{body}</div>;
    })}
  </div>
);
