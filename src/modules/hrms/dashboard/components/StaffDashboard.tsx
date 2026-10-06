import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { WorkMode } from '../../../../types';
import { formatTo24H } from '../../attendance/utils/attendanceUtils';
import {
  Clock,
  MapPin,
  Calendar,
  CheckCircle,
  CheckCircle2,
  FileText,
  AlertCircle,
  Send,
  Building,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';

interface StaffDashboardProps {
  onNavigate: (tab: string) => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({ onNavigate }) => {
  const { currentUser, attendanceRecords, clockInToday, clockOutToday, odRequests, leaveRequests, manualAttendanceRequests } = useApp();

  const [selectedWorkMode, setSelectedWorkMode] = useState<WorkMode>('in_office');
  const [workLocation, setWorkLocation] = useState('Main Campus HQ');
  const [leaveViewMode, setLeaveViewMode] = useState<'grid' | 'table'>('table');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceRecords.find((a) => a.userId === currentUser.id && a.date === todayStr);

  const myPendingManuals = (manualAttendanceRequests || []).filter((m) => m.userId === currentUser.id && m.status === 'pending');
  const myPendingODs = odRequests.filter((o) => o.userId === currentUser.id && o.status === 'pending');
  const myPendingLeaves = leaveRequests.filter((l) => l.userId === currentUser.id && l.status.startsWith('pending'));

  const currentMonthStr = todayStr.substring(0, 7);
  const myMonthAttendance = attendanceRecords.filter((a) => a.userId === currentUser.id && a.date.startsWith(currentMonthStr));
  const myPresentCount = myMonthAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;

  const totalLeaveBalance = Object.values(currentUser.leaveBalances || {}).reduce<number>(
    (acc, b) => acc + Math.max(0, (b as { total: number; used: number }).total - (b as { total: number; used: number }).used),
    0
  );

  const totalPendingRequests = myPendingODs.length + myPendingLeaves.length;

  const myApprovedODs = odRequests.filter((o) => o.userId === currentUser.id && o.status === 'approved');
  const totalODDays = myApprovedODs.reduce((acc, o) => acc + (o.daysCount || 1), 0);

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
            </div>
            <p className="text-slate-500 text-[10px] sm:text-xs mt-1 whitespace-nowrap truncate max-w-[220px] sm:max-w-none">
              Biometric ID: {currentUser.biometricId || currentUser.id.replace('usr-', '')} • {currentUser.designation}
            </p>
          </div>
        </div>

        {/* Compact Biometric Status Pill */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 sm:px-3.5 flex items-center justify-between gap-2.5 sm:gap-4 shadow-2xs w-full sm:w-80 shrink-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 uppercase tracking-wider whitespace-nowrap">Punch Today</span>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2 text-[11px] sm:text-xs font-bold bg-white px-2 sm:px-2.5 py-1 rounded-lg border border-slate-200/80 shrink-0 whitespace-nowrap">
            <span className="text-slate-400 font-bold whitespace-nowrap">IN</span>
            <span className="text-slate-900 font-mono font-black whitespace-nowrap">{formatTo24H(todayRecord?.clockIn)}</span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-400 font-bold whitespace-nowrap">OUT</span>
            <span className="text-slate-900 font-mono font-black whitespace-nowrap">{formatTo24H(todayRecord?.clockOut)}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Shortcuts Grid: 4 Essential Buttons */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('manual_attendance')}
            className="p-3.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Manual</span>
          </button>
          <button
            onClick={() => onNavigate('od')}
            className="p-3.5 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>OD</span>
          </button>
          <button
            onClick={() => onNavigate('leave')}
            className="p-3.5 bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Leave</span>
          </button>
          <button
            onClick={() => onNavigate('holiday_calendar')}
            className="p-3.5 bg-purple-50/80 hover:bg-purple-100 text-purple-900 border border-purple-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Calendar className="w-5 h-5 text-purple-600 shrink-0" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* Leave Balances Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Leave Balance</span>
          </h2>
          <div className="flex items-center space-x-2.5 self-end sm:self-auto">
            {/* View Mode Toggle - Icon-only & Desktop-only */}
            <div className="hidden sm:flex h-7.5 items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg gap-0.5">
              <button
                type="button"
                onClick={() => setLeaveViewMode('table')}
                title="Table View"
                className={`h-6 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                  leaveViewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLeaveViewMode('grid')}
                title="Card Grid View"
                className={`h-6 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                  leaveViewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table View - Shown on Desktop only when selected */}
        {leaveViewMode === 'table' && (
          <div className="hidden sm:block w-full overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs bg-white no-scrollbar">
            <table className="w-full text-left text-xs border-collapse table-auto min-w-[550px]">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr className="h-9">
                  <th className="px-4 py-2 whitespace-nowrap align-middle min-w-[170px]">Leave Type</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap align-middle min-w-[85px]">Total Quota</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap align-middle min-w-[85px]">Days Used</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap align-middle min-w-[85px]">Pending</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap align-middle min-w-[100px]">Balance</th>
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
        )}

        {/* Card Grid View - Always shown on Mobile, shown on Desktop when selected */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${leaveViewMode === 'table' ? 'block sm:hidden' : 'block'}`}>
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
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow"
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
        </div>

      {/* Quick Workflows Section: Manual Attendance, Outdoor Duty & Leave in 1 Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Manual Attendance */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 min-w-0">
                <Clock className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                <span className="truncate">Manual Attendance</span>
              </h3>
              <button
                onClick={() => onNavigate('manual_attendance')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1 border border-indigo-200/80 shrink-0 ml-2 whitespace-nowrap"
              >
                <span>View All ({myPendingManuals.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myPendingManuals.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">
                No manual attendance records.
              </div>
            ) : (
              <div className="space-y-3 text-xs mt-4">
                {myPendingManuals.slice(0, 3).map((man) => (
                  <div key={man.id} className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900 text-xs truncate">{man.reasonCategory || 'Forgotten Punch'}</span>
                      <span className="text-[10px] bg-amber-50 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-200 shrink-0">
                        Pending
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-800">⏰ {man.date} ({man.requestedInTime} - {man.requestedOutTime})</p>
                      <p className="italic text-slate-600 break-words">"{man.reason}"</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Outdoor Duty (OD) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 min-w-0">
                <MapPin className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span className="truncate">Outdoor Duty (OD)</span>
              </h3>
              <button
                onClick={() => onNavigate('od')}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1 border border-emerald-200/80 shrink-0 ml-2 whitespace-nowrap"
              >
                <span>View All ({myPendingODs.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myPendingODs.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">
                No Outdoor Duty records.
              </div>
            ) : (
              <div className="space-y-3 text-xs mt-4">
                {myPendingODs.slice(0, 3).map((od) => (
                  <div key={od.id} className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900 text-xs truncate">{od.location}</span>
                      <span className="text-[10px] bg-amber-50 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-200 shrink-0">
                        Pending
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-800">📍 {od.startDate} to {od.endDate} ({od.daysCount} days)</p>
                      <p className="italic text-slate-600 break-words">"{od.purpose}"</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Leave */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 min-w-0">
                <FileText className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                <span className="truncate">Leave</span>
              </h3>
              <button
                onClick={() => onNavigate('leave')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1 border border-blue-200/80 shrink-0 ml-2 whitespace-nowrap"
              >
                <span>View All ({myPendingLeaves.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myPendingLeaves.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">
                No active leave records.
              </div>
            ) : (
              <div className="space-y-3 text-xs mt-4">
                {myPendingLeaves.slice(0, 3).map((lv) => (
                  <div key={lv.id} className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900 text-xs truncate">{lv.leaveTypeName}</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-800 font-extrabold px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                        {lv.status === 'pending_level_1' ? 'Level-1 Pending' : 'Level-2 Pending'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-800">🗓️ {lv.startDate} to {lv.endDate} ({lv.daysCount} days)</p>
                      <p className="italic text-slate-600 break-words">"{lv.reason}"</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
