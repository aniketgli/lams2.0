import React from 'react';
import { Clock, FileText, MapPin } from 'lucide-react';
import type { DashboardData } from '../dashboardApi';
import { QueueCard } from './QueueCard';
import { QuickActions } from './QuickActions';

/**
 * Administrator, auditor and reporting manager: Manual / OD / Leave queues.
 * HoD: only the leave waiting for their approval. The server has already
 * filtered each queue to what this role may see.
 */
export const ManagerDashboard: React.FC<{ data: DashboardData; onNavigate: (tab: string) => void }> = ({ data, onNavigate }) => {
  const hod = data.role === 'reviewing_manager';
  return (
    <div className="space-y-6">
      <QuickActions onNavigate={onNavigate} />
      <div className={`grid grid-cols-1 gap-5 ${hod ? '' : 'lg:grid-cols-3'}`}>
        {!hod && <QueueCard title="Manual Attendance" icon={Clock} tone="indigo" queue={data.manual} emptyText="No manual attendance requests." onViewAll={() => onNavigate('manual_attendance')} />}
        {!hod && <QueueCard title="Outdoor Duty (OD)" icon={MapPin} tone="emerald" queue={data.od} emptyText="No outdoor duty requests." onViewAll={() => onNavigate('od')} />}
        <QueueCard title={hod ? 'Leave awaiting your approval' : 'Leave'} icon={FileText} tone="blue" queue={data.leave}
          emptyText={hod ? 'No leave waiting for your approval.' : 'No pending leave requests.'} onViewAll={() => onNavigate('leave')} />
      </div>
    </div>
  );
};
