import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { WorkMode } from '../../../../types';
import {
  Clock,
  MapPin,
  Calendar,
  CheckCircle,
  FileText,
  AlertCircle,
  Send,
  Building,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRight,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';

interface StaffDashboardProps {
  onNavigate: (tab: string) => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({ onNavigate }) => {
  const { currentUser, attendanceRecords, clockInToday, clockOutToday, odRequests, leaveRequests } = useApp();

  const [selectedWorkMode, setSelectedWorkMode] = useState<WorkMode>('in_office');
  const [workLocation, setWorkLocation] = useState('Main Campus HQ');
  const [leaveViewMode, setLeaveViewMode] = useState<'grid' | 'table'>('table');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceRecords.find((a) => a.userId === currentUser.id && a.date === todayStr);

  const myPendingODs = odRequests.filter((o) => o.userId === currentUser.id && o.status === 'pending');
  const myPendingLeaves = leaveRequests.filter((l) => l.userId === currentUser.id && l.status.startsWith('pending'));

  const getEmploymentLabel = (type: string) => {
    switch (type) {
      case 'permanent':
        return 'Permanent Employee';
      case 'contractual':
        return 'Contractual Staff';
      case 'researcher':
        return 'Research Fellow';
      case 'trainee_student':
        return 'Trainee / Student';
      default:
        return 'Standard Staff';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Clock In Header - Clean Minimalism */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-200"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Welcome, {currentUser.name}</h1>
              <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full border border-indigo-100 font-semibold">
                {getEmploymentLabel(currentUser.employmentType)}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {currentUser.designation} • {currentUser.department}
            </p>
          </div>
        </div>

        {/* Biometric Today's Attendance Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 md:w-80 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Biometric Punch Today</span>
            </span>
            {todayRecord?.clockIn ? (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                PUNCH IN ({todayRecord.clockIn})
              </span>
            ) : (
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                NO PUNCH YET
              </span>
            )}
          </div>

          <div className="text-xs space-y-1 mt-2 bg-white p-2.5 rounded border border-slate-200">
            {todayRecord?.clockIn ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Shift:</span>
                  <strong className="text-slate-900">{todayRecord.shiftCode || 'GEN-01'}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>In Time:</span>
                  <strong className="text-emerald-700 font-mono">{todayRecord.clockIn}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Out Time:</span>
                  <strong className="text-slate-900 font-mono">{todayRecord.clockOut || 'In Progress'}</strong>
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Biometric machines automatically capture check-in and check-out logs upon terminal facial/finger scan.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Shortcuts Grid */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Quick Actions &amp; Shortcuts</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">Frequently used workforce actions</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <button
            onClick={() => onNavigate('leave')}
            className="p-3 bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Apply Leave</span>
          </button>
          <button
            onClick={() => onNavigate('manual_attendance')}
            className="p-3 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Regularize Punch</span>
          </button>
          <button
            onClick={() => onNavigate('od')}
            className="p-3 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Outdoor Duty (OD)</span>
          </button>
          <button
            onClick={() => onNavigate('holiday_calendar')}
            className="p-3 bg-purple-50/80 hover:bg-purple-100 text-purple-900 border border-purple-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Calendar className="w-5 h-5 text-purple-600 shrink-0" />
            <span>Holidays 2026</span>
          </button>
          <button
            onClick={() => onNavigate('leave_balance')}
            className="p-3 bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <FileText className="w-5 h-5 text-amber-600 shrink-0" />
            <span>My Leave Balance</span>
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/90 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Building className="w-5 h-5 text-slate-600 shrink-0" />
            <span>My Profile</span>
          </button>
        </div>
      </div>

      {/* Leave Balances Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Leave Quotas &amp; Policy Balances</span>
          </h2>
          <div className="flex items-center space-x-2.5 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="h-7.5 flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg gap-0.5">
              <button
                type="button"
                onClick={() => setLeaveViewMode('table')}
                title="Table View (तालिका दृश्य)"
                className={`h-6 px-2 flex items-center justify-center rounded-md transition-all cursor-pointer text-xs font-semibold ${
                  leaveViewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5 mr-1" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setLeaveViewMode('grid')}
                title="Card Grid View (कार्ड दृश्य)"
                className={`h-6 px-2 flex items-center justify-center rounded-md transition-all cursor-pointer text-xs font-semibold ${
                  leaveViewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                <span>Cards</span>
              </button>
            </div>

            <button
              onClick={() => onNavigate('leave')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>Apply for Leave</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {leaveViewMode === 'table' ? (
          <div className="w-full overflow-hidden rounded-xl border border-slate-200/80 shadow-2xs bg-white">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr className="h-9">
                  <th className="px-4 py-2 whitespace-nowrap align-middle w-[36%]">Leave Type</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap align-middle w-[16%]">Total Quota</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap align-middle w-[16%]">Days Used</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap align-middle w-[16%]">Pending</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap align-middle w-[16%]">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {Object.entries(currentUser.leaveBalances || {}).map(([typeKey, balObj]) => {
                  const bal = balObj as { total: number; used: number; pending: number };
                  const available = Math.max(0, bal.total - bal.used);

                  const formatLeaveName = (key: string) => {
                    switch (key) {
                      case 'casual':
                        return 'Casual Leave (CL)';
                      case 'earned':
                        return 'Earned Leave (EL)';
                      case 'half_pay':
                        return 'Half Pay / Sick (HPL)';
                      case 'sick':
                        return 'Sick Leave (SL)';
                      case 'restricted':
                        return 'Restricted Holiday (RH)';
                      case 'field_work':
                        return 'Field Work Leave (FWL)';
                      case 'academic':
                        return 'Academic Leave (AL)';
                      case 'stipend_off':
                        return 'Stipend Off';
                      case 'contingency':
                        return 'Contingency Off';
                      default:
                        return key.toUpperCase();
                    }
                  };

                  return (
                    <tr key={typeKey} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-slate-900 align-middle">
                        {formatLeaveName(typeKey)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-700 align-middle whitespace-nowrap">
                        {bal.total} days
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-700 align-middle whitespace-nowrap">
                        {bal.used} days
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold align-middle whitespace-nowrap">
                        {bal.pending > 0 ? (
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/90 text-[10px] font-bold inline-flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>{bal.pending} d</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                          available > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {available} Days Left
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(currentUser.leaveBalances).map(([typeKey, balObj]) => {
              const bal = balObj as { total: number; used: number; pending: number };
              const available = bal.total - bal.used;
              const percentUsed = Math.round((bal.used / bal.total) * 100) || 0;

              const formatLeaveName = (key: string) => {
                switch (key) {
                  case 'casual':
                    return 'Casual Leave (CL)';
                  case 'earned':
                    return 'Earned Leave (EL)';
                  case 'half_pay':
                    return 'Half Pay / Sick (HPL)';
                  case 'sick':
                    return 'Sick Leave (SL)';
                  case 'restricted':
                    return 'Restricted Holiday';
                  case 'field_work':
                    return 'Field Work Leave (FWL)';
                  case 'academic':
                    return 'Academic Leave (AL)';
                  case 'stipend_off':
                    return 'Stipend Off';
                  case 'contingency':
                    return 'Contingency Off';
                  default:
                    return key.toUpperCase();
                }
              };

              return (
                <div
                  key={typeKey}
                  className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">{formatLeaveName(typeKey)}</span>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {available} Days Left
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {bal.used} <span className="text-xs font-normal text-slate-500">/ {bal.total} Used</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${percentUsed}%` }} />
                    </div>
                    {bal.pending > 0 && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1.5 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{bal.pending} day(s) pending approval</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action Workflows: Outdoor Duty & Pending Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Outdoor Duty Applications */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>My Outdoor Duty (OD) Log</span>
            </h3>
            <button
              onClick={() => onNavigate('od')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
            >
              Apply New OD
            </button>
          </div>

          {myPendingODs.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded border border-dashed border-slate-200 text-xs text-slate-400">
              No pending Outdoor Duty applications.
            </div>
          ) : (
            <div className="space-y-2.5">
              {myPendingODs.map((od) => (
                <div key={od.id} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{od.location}</span>
                    <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                      Pending Review
                    </span>
                  </div>
                  <p className="text-slate-500">
                    {od.startDate} to {od.endDate} ({od.daysCount} days)
                  </p>
                  <p className="text-slate-600 italic">"{od.purpose}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Leave Requests */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>My Leave Applications</span>
            </h3>
            <button
              onClick={() => onNavigate('leave')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View All Leaves
            </button>
          </div>

          {myPendingLeaves.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded border border-dashed border-slate-200 text-xs text-slate-400">
              No active leave applications pending review.
            </div>
          ) : (
            <div className="space-y-2.5">
              {myPendingLeaves.map((lv) => (
                <div key={lv.id} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{lv.leaveTypeName}</span>
                    <span className="text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold text-[10px]">
                      {lv.status === 'pending_level_1'
                        ? 'Pending Level-1 Review'
                        : 'Level-1 Approved (Level-2 Pending)'}
                    </span>
                  </div>
                  <p className="text-slate-500">
                    {lv.startDate} to {lv.endDate} ({lv.daysCount} days)
                  </p>
                  <p className="text-slate-600 italic">"{lv.reason}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
