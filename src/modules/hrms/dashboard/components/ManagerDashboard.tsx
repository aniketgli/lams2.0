import React from 'react';
import { CalendarCheck, Clock, FileText, MapPin } from 'lucide-react';
import type { DashboardData } from '../dashboardApi';
import { QueueTable } from './QueueCard';
import { StatCards, TONE } from './StatCards';

/**
 * Administrator, auditor and reporting manager: Manual / OD / Leave queues.
 * HoD: only the leave waiting for their approval. The server has already
 * filtered each queue to what this role may see.
 */
export const ManagerDashboard: React.FC<{ data: DashboardData; onNavigate: (tab: string) => void }> = ({ data, onNavigate }) => {
  const hod = data.role === 'reviewing_manager';
  const audit = data.role === 'audit';
  const waiting = audit ? 'Pending' : 'Awaiting you';
  const stats = [
    ...(hod ? [] : [
      { label: 'Manual attendance', value: data.manual.total, note: waiting, icon: Clock, tone: TONE.indigo, onClick: () => onNavigate('manual_attendance') },
      { label: 'Outdoor duty', value: data.od.total, note: waiting, icon: MapPin, tone: TONE.emerald, onClick: () => onNavigate('od') },
    ]),
    { label: 'Leave', value: data.leave.total, note: hod ? 'Awaiting your approval' : waiting, icon: FileText, tone: TONE.blue, onClick: () => onNavigate('leave') },
    { label: 'Holiday calendar', value: 'Open', note: 'Holidays of the year', icon: CalendarCheck, tone: TONE.amber, onClick: () => onNavigate('holiday_calendar') },
  ];
  return (
    <div className="space-y-5">
      <StatCards stats={stats} />
      {!hod && <QueueTable title="Manual Attendance" icon={Clock} queue={data.manual} emptyTitle="No manual attendance requests" onViewAll={() => onNavigate('manual_attendance')} />}
      {!hod && <QueueTable title="Outdoor Duty (OD)" icon={MapPin} queue={data.od} emptyTitle="No outdoor duty requests" onViewAll={() => onNavigate('od')} />}
      <QueueTable title={hod ? 'Leave awaiting your approval' : 'Leave'} icon={FileText} queue={data.leave}
        emptyTitle={hod ? 'No leave waiting for your approval' : 'No pending leave requests'} onViewAll={() => onNavigate('leave')} />
    </div>
  );
};
