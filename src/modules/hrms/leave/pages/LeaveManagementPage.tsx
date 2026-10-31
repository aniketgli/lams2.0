import React, { useState } from 'react';
import { CalendarCheck, Plus } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { ActivityLogPanel, ActivitySource } from '../../../../shared/components/ActivityLogPanel';
import { activityEndpoints } from '../../../../shared/services/activityApi';
import { LeaveRequestsView } from '../components/LeaveRequestsView';
import { LeaveBalancesView } from '../components/LeaveBalancesView';

/**
 * Leave Management. "Leaves" shows the requests and "Leave Balance" the balances, each as its own
 * page; the auditor can also switch the Leaves page to the activity log.
 * Everything is read from and written to the server, which decides who may do what.
 */

const LEAVE_ACTIVITY: ActivitySource = {
  title: 'Leave activity log',
  recordLabel: 'Request / balance',
  searchPlaceholder: 'Employee, leave type, done by, reason…',
  areas: [{ value: 'leave_request', label: 'Leave request' }, { value: 'leave_balance', label: 'Leave balance' }, { value: 'leave_export', label: 'Log download' }],
  actions: ['CREATE', 'UPDATE', 'STATUS', 'DELETE', 'EXPORT'],
  actionLabels: { CREATE: 'Applied / set', UPDATE: 'Edited', STATUS: 'Approved / forwarded / rejected', DELETE: 'Deleted', EXPORT: 'Downloaded' },
  ...activityEndpoints('/hrms/leave/activity', 'WII_Leave_Activity.csv'),
};

type AuditorView = 'requests' | 'activity';

interface LeaveManagementPageProps {
  onNavigate?: (tab: string) => void;
  initialTab?: string;
}

export const LeaveManagementPage: React.FC<LeaveManagementPageProps> = ({ initialTab }) => {
  const { currentUser } = useApp();
  const role = currentUser.role;
  const isAdmin = role === 'administrator';
  const isAudit = role === 'audit';
  const canApply = isAdmin || role === 'general_staff';
  const balances = initialTab === 'leave_balance';
  const [auditorView, setAuditorView] = useState<AuditorView>('requests');
  const [applySignal, setApplySignal] = useState(0);

  const subtitle = balances
    ? (isAdmin ? 'Leave balance of every employee for the leave year; set or adjust a balance'
      : isAudit ? 'Leave balance of every employee for the leave year'
      : role === 'general_staff' ? 'Your leave balance for the leave year' : 'Your leave balance, and your team’s for the leave year')
    : isAdmin ? 'Apply, approve and reject leave of all employees, and set balances'
    : isAudit ? 'All leave requests and balances, and the log of who did what'
    : role === 'reporting_manager' ? 'Your leave, and your team’s requests to approve, forward or reject'
    : role === 'reviewing_manager' ? 'Your leave, and the requests forwarded to you for approval'
    : 'Apply for leave and follow the status of your requests';

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={CalendarCheck}
        title={balances ? 'Leave Balance' : 'Leave Management'}
        subtitle={subtitle}
        rightAction={canApply && !balances && auditorView === 'requests' ? (
          <button type="button" onClick={() => setApplySignal((n) => n + 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-2xs cursor-pointer">
            <Plus className="w-4 h-4" /> Apply leave
          </button>
        ) : undefined}
      />

      {balances ? <LeaveBalancesView /> : (
        <>
          {isAudit && (
            <div role="tablist" aria-label="Leave views" className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 border border-slate-200">
              {([['requests', 'Requests'], ['activity', 'Activity log']] as const).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={auditorView === key} onClick={() => setAuditorView(key)}
                  className={`h-7 px-3.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${auditorView === key ? 'bg-white text-primary shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {isAudit && auditorView === 'activity' ? <ActivityLogPanel source={LEAVE_ACTIVITY} /> : <LeaveRequestsView applySignal={applySignal} />}
        </>
      )}
    </div>
  );
};
