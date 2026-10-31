import React from 'react';
import { Clock, FileText, Layers, MapPin } from 'lucide-react';
import { useSession } from '../../../../auth/SessionContext';
import { DataTable, type ColumnDef } from '../../../../shared/components';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import type { BalanceLine, DashboardData } from '../dashboardApi';
import { QueueCard } from './QueueCard';
import { QuickActions } from './QuickActions';

const BALANCE_COLUMNS: ColumnDef<BalanceLine>[] = [
  { key: 'name', header: 'Leave type', sortValue: (b) => b.name, render: (b) => <span className="font-semibold text-slate-900">{b.name} <span className="font-mono text-[11px] text-slate-500">({b.code})</span></span> },
  { key: 'total', header: 'Total quota', align: 'center', sortValue: (b) => b.total, render: (b) => b.total },
  { key: 'used', header: 'Days used', align: 'center', sortValue: (b) => b.used, render: (b) => b.used },
  { key: 'pending', header: 'Pending', align: 'center', sortValue: (b) => b.pending, render: (b) => b.pending },
  { key: 'available', header: 'Balance', align: 'right', sortValue: (b) => b.available, render: (b) => <span className="font-bold text-slate-900">{b.available}</span> },
];

/** General staff: own punch today, leave balances and own pending requests, all from the server. */
export const StaffDashboard: React.FC<{ data: DashboardData; onNavigate: (tab: string) => void }> = ({ data, onNavigate }) => {
  const { session } = useSession();
  const user = session?.user;
  const me = data.me;
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={user?.name} src={user?.photoUrl} className="w-14 h-14 rounded-full ring-2 ring-slate-200" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">Welcome, {user?.name}</h1>
            <p className="text-slate-500 text-xs mt-1">Biometric ID: {user?.biometricId}</p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 flex items-center justify-between gap-4 shadow-2xs w-full sm:w-80 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider whitespace-nowrap">Punch Today</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 whitespace-nowrap">
            <span className="text-slate-400">IN</span>
            <span className="text-slate-900 font-mono font-black">{me?.punchIn ?? '--:--'}</span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-400">OUT</span>
            <span className="text-slate-900 font-mono font-black">{me?.punchOut ?? '--:--'}</span>
          </div>
        </div>
      </div>

      <QuickActions onNavigate={onNavigate} />

      <div>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-blue-600" />Leave Balance</h2>
        <DataTable columns={BALANCE_COLUMNS} data={me?.balances ?? []} keyExtractor={(b) => b.code}
          emptyTitle="No leave balance" emptyDescription="No leave type is available to you yet." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <QueueCard title="My Manual Attendance" icon={Clock} tone="amber" queue={data.manual} showPerson={false}
          emptyText="No pending manual attendance." onViewAll={() => onNavigate('manual_attendance')} />
        <QueueCard title="My Outdoor Duty" icon={MapPin} tone="amber" queue={data.od} showPerson={false}
          emptyText="No pending outdoor duty." onViewAll={() => onNavigate('od')} />
        <QueueCard title="My Leave" icon={FileText} tone="amber" queue={data.leave} showPerson={false}
          emptyText="No pending leave." onViewAll={() => onNavigate('leave')} />
      </div>
    </div>
  );
};
