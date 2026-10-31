import React, { useState } from 'react';
import { Calendar, CalendarDays, Clock, FileText, LayoutGrid, Layers, List, MapPin } from 'lucide-react';
import { useSession } from '../../../../auth/SessionContext';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import type { BalanceLine, DashboardData } from '../dashboardApi';
import { QueueTable } from './QueueCard';

const days = (n: number) => `${Math.round(n * 10) / 10} ${n === 1 ? 'day' : 'days'}`;
const left = (n: number) => `${Math.round(n * 10) / 10} ${n === 1 ? 'Day' : 'Days'} Left`;
const badge = (b: BalanceLine) => (b.available <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');

const SHORTCUTS = [
  { label: 'Manual', page: 'manual_attendance', icon: Clock, tone: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { label: 'OD', page: 'od', icon: MapPin, tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { label: 'Leave', page: 'leave', icon: CalendarDays, tone: 'bg-sky-50 border-sky-200 text-sky-700' },
  { label: 'Calendar', page: 'holiday_calendar', icon: Calendar, tone: 'bg-purple-50 border-purple-200 text-purple-700' },
];

const BalanceTable: React.FC<{ rows: BalanceLine[] }> = ({ rows }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          <th className="text-left px-4 py-2.5">Leave type</th>
          <th className="text-center px-3 py-2.5">Total quota</th>
          <th className="text-center px-3 py-2.5">Days used</th>
          <th className="text-center px-3 py-2.5">Pending</th>
          <th className="text-right px-4 py-2.5">Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((b) => (
          <tr key={b.code}>
            <td className="px-4 py-3 font-semibold text-slate-900">{b.name}</td>
            <td className="px-3 py-3 text-center text-slate-700">{days(b.total + b.carryForward)}</td>
            <td className="px-3 py-3 text-center text-slate-700">{days(b.used)}</td>
            <td className="px-3 py-3 text-center text-slate-500">{Math.round(b.pending * 10) / 10}</td>
            <td className="px-4 py-3 text-right"><span className={`inline-block rounded-md border px-2 py-0.5 font-bold ${badge(b)}`}>{left(b.available)}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const BalanceCards: React.FC<{ rows: BalanceLine[]; className?: string }> = ({ rows, className = '' }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
    {rows.map((b) => {
      const total = b.total + b.carryForward;
      const pct = total > 0 ? Math.min(100, Math.round((b.used / total) * 100)) : 0;
      return (
        <div key={b.code} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-slate-900">{b.name}</p>
            <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold ${badge(b)}`}>{left(b.available)}</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{Math.round(b.used * 10) / 10}<span className="ml-1.5 text-xs font-medium text-slate-500">/ {Math.round(total * 10) / 10} Used</span></p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
        </div>
      );
    })}
  </div>
);

/** General staff: welcome card with today's punch, shortcuts, leave balance (table on a wide screen, cards on a phone) and own pending requests. */
export const StaffDashboard: React.FC<{ data: DashboardData; onNavigate: (tab: string) => void }> = ({ data, onNavigate }) => {
  const { session } = useSession();
  const me = data.me;
  const [view, setView] = useState<'table' | 'cards'>('table');
  const balances = me?.balances ?? [];
  const user = session?.user;
  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <UserAvatar name={user?.name} src={user?.photoUrl || null} className="w-14 h-14 rounded-full shrink-0 border border-slate-200" />
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 truncate">Welcome, {user?.name}</h2>
            <p className="text-xs text-slate-500 truncate">Biometric ID: {user?.biometricId}{me?.designation ? ` • ${me.designation}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700"><Clock className="w-4 h-4 text-primary" />Punch today</span>
          <span className="flex items-center rounded-lg border border-slate-200 bg-white text-[11px] font-bold">
            <span className="px-2.5 py-1 text-slate-500">IN <span className="text-slate-900">{me?.punchIn ?? '-'}</span></span>
            <span className="h-4 w-px bg-slate-200" />
            <span className="px-2.5 py-1 text-slate-500">OUT <span className="text-slate-900">{me?.punchOut ?? '-'}</span></span>
          </span>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SHORTCUTS.map(({ label, page, icon: Icon, tone }) => (
          <button key={page} type="button" onClick={() => onNavigate(page)}
            className={`rounded-xl border py-4 flex flex-col items-center gap-2 text-xs font-bold cursor-pointer hover:shadow-xs transition-shadow ${tone}`}>
            <Icon className="w-5 h-5" />{label}
          </button>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />Leave Balance</h3>
          <div className="hidden sm:flex h-9 items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0" role="tablist" aria-label="View">
            {([['table', 'Table view', List], ['cards', 'Card view', LayoutGrid]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="tab" aria-selected={view === value} aria-label={label} title={label} onClick={() => setView(value)}
                className={`h-7 px-2 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                  view === value ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' : 'text-slate-400 hover:text-slate-700'
                }`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
        {balances.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">No leave type is available to you yet.</div>
        ) : (
          <>
            {view === 'table' && <div className="hidden sm:block"><BalanceTable rows={balances} /></div>}
            <BalanceCards rows={balances} className={view === 'table' ? 'sm:hidden' : ''} />
          </>
        )}
      </section>

      <QueueTable title="My Manual Attendance" icon={Clock} queue={data.manual} showPerson={false} emptyTitle="No pending manual attendance" onViewAll={() => onNavigate('manual_attendance')} />
      <QueueTable title="My Outdoor Duty" icon={MapPin} queue={data.od} showPerson={false} emptyTitle="No pending outdoor duty" onViewAll={() => onNavigate('od')} />
      <QueueTable title="My Leave" icon={FileText} queue={data.leave} showPerson={false} emptyTitle="No pending leave" onViewAll={() => onNavigate('leave')} />
    </div>
  );
};
