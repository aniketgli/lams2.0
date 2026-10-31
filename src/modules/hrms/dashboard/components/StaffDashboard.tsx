import React from 'react';
import { CalendarCheck, Clock, FileText, Layers, MapPin } from 'lucide-react';
import { useSession } from '../../../../auth/SessionContext';
import { DataTable, type ColumnDef } from '../../../../shared/components';
import type { BalanceLine, DashboardData } from '../dashboardApi';
import { QueueTable } from './QueueCard';
import { StatCards, TONE } from './StatCards';

const BALANCE_COLUMNS: ColumnDef<BalanceLine>[] = [
  { key: 'name', header: 'Leave type', sortValue: (b) => b.name, render: (b) => <div><div className="font-semibold text-slate-900">{b.name}</div><div className="font-mono text-[11px] text-slate-500">{b.code}</div></div> },
  { key: 'total', header: 'Total quota', align: 'center', sortValue: (b) => b.total, render: (b) => b.total },
  { key: 'used', header: 'Days used', align: 'center', sortValue: (b) => b.used, render: (b) => b.used },
  { key: 'pending', header: 'Pending', align: 'center', sortValue: (b) => b.pending, render: (b) => b.pending },
  { key: 'available', header: 'Balance', align: 'right', sortValue: (b) => b.available, render: (b) => <span className="font-bold text-slate-900">{b.available}</span> },
];

/** General staff: own punch today, leave balances and own pending requests, all from the server. */
export const StaffDashboard: React.FC<{ data: DashboardData; onNavigate: (tab: string) => void }> = ({ data, onNavigate }) => {
  const { session } = useSession();
  const me = data.me;
  const available = (me?.balances ?? []).reduce((sum, b) => sum + b.available, 0);
  const pending = data.manual.total + data.od.total + data.leave.total;
  const stats = [
    { label: 'Punch in today', value: me?.punchIn ?? '--:--', note: `Biometric ID ${session?.user.biometricId ?? ''}`, icon: Clock, tone: TONE.emerald, onClick: () => onNavigate('attendance') },
    { label: 'Punch out today', value: me?.punchOut ?? '--:--', note: 'From the biometric machine', icon: Clock, tone: TONE.indigo, onClick: () => onNavigate('attendance') },
    { label: 'Leave balance', value: available, note: 'Days available in total', icon: Layers, tone: TONE.blue, onClick: () => onNavigate('leave') },
    { label: 'My pending requests', value: pending, note: 'Manual, OD and leave', icon: CalendarCheck, tone: TONE.amber },
  ];
  return (
    <div className="space-y-5">
      <StatCards stats={stats} />
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />Leave balance</h3>
        <DataTable columns={BALANCE_COLUMNS} data={me?.balances ?? []} keyExtractor={(b) => b.code}
          emptyTitle="No leave balance" emptyDescription="No leave type is available to you yet." />
      </section>
      <QueueTable title="My Manual Attendance" icon={Clock} queue={data.manual} showPerson={false} emptyTitle="No pending manual attendance" onViewAll={() => onNavigate('manual_attendance')} />
      <QueueTable title="My Outdoor Duty" icon={MapPin} queue={data.od} showPerson={false} emptyTitle="No pending outdoor duty" onViewAll={() => onNavigate('od')} />
      <QueueTable title="My Leave" icon={FileText} queue={data.leave} showPerson={false} emptyTitle="No pending leave" onViewAll={() => onNavigate('leave')} />
    </div>
  );
};
