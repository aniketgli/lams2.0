import React, { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { PageHeader, PageHeaderButton } from '../../../../shared/components/PageHeader';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { SegmentedControl } from '../../../../shared/components/SegmentedControl';
import { PAGE_ICONS } from '../../hrmsPages';
import { ActivityLogPanel, ActivitySource } from '../../../../shared/components/ActivityLogPanel';
import { activityEndpoints } from '../../../../shared/services/activityApi';
import { LeaveRequestsView } from '../components/LeaveRequestsView';
import { LeaveBalancesView } from '../components/LeaveBalancesView';
import { LeavePolicyMaster } from '../../master/components/LeavePolicyMaster';

/**
 * Leave Management. "Leaves" shows the requests and "Leave Balance" the balances, each as its own
 * page; the auditor can also switch the Leaves page to the activity log.
 * Everything is read from and written to the server, which decides who may do what.
 */

const LEAVE_ACTIVITY: ActivitySource = {
  title: 'Leave activity log',
  recordLabel: 'Request / balance',
  searchPlaceholder: 'Employee, leave type, done by, reason…',
  areas: [{ value: 'leave_request', label: 'Leave request' }, { value: 'leave_balance', label: 'Leave balance' }, { value: 'leave_joining', label: 'Joining report' }, { value: 'leave_data_export', label: 'Data download' }, { value: 'leave_export', label: 'Log download' }],
  actions: ['CREATE', 'UPDATE', 'STATUS', 'DELETE', 'EXPORT'],
  actionLabels: { CREATE: 'Applied / set', UPDATE: 'Edited', STATUS: 'Approved / forwarded / rejected', DELETE: 'Deleted', EXPORT: 'Downloaded' },
  ...activityEndpoints('/hrms/leave/activity', 'WII_Leave_Activity.csv'),
};

const BALANCE_ACTIVITY: ActivitySource = {
  ...LEAVE_ACTIVITY,
  title: 'Leave balance activity log',
  recordLabel: 'Employee / leave type',
  searchPlaceholder: 'Employee, leave type, done by, reason…',
  areas: [{ value: 'leave_balance', label: 'Leave balance' }, { value: 'leave_balance_data_export', label: 'Balance download' }],
  actions: ['CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
  limitToAreas: true,
};

type LeaveView = 'requests' | 'types' | 'activity';

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
  // Administrator and Leave Balance Manager set balances on the Leave Balance page.
  const managesBalances = isAdmin || role === 'leave_balance_manager';
  const [view, setView] = useState<LeaveView>('requests');
  const [balanceView, setBalanceView] = useState<'balances' | 'activity'>('balances');
  const balanceSwitch = isAudit
    ? <SegmentedControl ariaLabel="Leave balance views" value={balanceView} onChange={setBalanceView} options={[{ value: 'balances', label: 'Leave balance' }, { value: 'activity', label: 'Activity log' }]} />
    : null;
  const viewTabs: Array<readonly [LeaveView, string]> = isAdmin ? [['requests', 'Requests'], ['types', 'Leave Types']]
    : isAudit ? [['requests', 'Requests'], ['types', 'Leave Types'], ['activity', 'Activity log']] : [['requests', 'Requests']];
  const viewSwitch = viewTabs.length > 1
    ? <SegmentedControl ariaLabel="Leave views" value={view} onChange={setView} options={viewTabs.map(([value, label]) => ({ value, label }))} />
    : null;
  const [applySignal, setApplySignal] = useState(0);
  const [importSignal, setImportSignal] = useState(0);

  const subtitle = balances
    ? (managesBalances ? 'Leave balance of every employee for the leave year; set or adjust a balance'
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
        icon={balances ? PAGE_ICONS.leave_balance : PAGE_ICONS.leave}
        title={balances ? 'Leave Balance' : 'Leave Management'}
        subtitle={subtitle}
        rightAction={balances && managesBalances ? (
          <PageHeaderButton icon={Upload} onClick={() => setImportSignal((n) => n + 1)}>Import leave</PageHeaderButton>
        ) : canApply && !balances && view === 'requests' ? (
          <PageHeaderButton icon={Plus} onClick={() => setApplySignal((n) => n + 1)}>Apply leave</PageHeaderButton>
        ) : undefined}
      />

      {balances ? (isAudit && balanceView === 'activity'
        ? <ActivityLogPanel source={BALANCE_ACTIVITY} toolbarStart={balanceSwitch} />
        : <LeaveBalancesView importSignal={importSignal} toolbarStart={balanceSwitch} />) : (
        <>
          {view === 'types' && (isAdmin || isAudit) ? (
            <>
              {viewSwitch && <FilterToolbar start={viewSwitch} />}
              <LeavePolicyMaster readOnly={!isAdmin} />
            </>
          )
            : isAudit && view === 'activity' ? <ActivityLogPanel source={LEAVE_ACTIVITY} toolbarStart={viewSwitch} />
            : <LeaveRequestsView applySignal={applySignal} toolbarStart={viewSwitch} />}
        </>
      )}
    </div>
  );
};
