import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { getNormalizedStatusCode, ATTENDANCE_STATUS_MAP, formatTo24H } from '../../attendance/utils/attendanceUtils';
import {
  Users,
  CheckCircle,
  CheckCircle2,
  XCircle,
  MapPin,
  FileText,
  Clock,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';

interface ReportingManagerDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ReportingManagerDashboard: React.FC<ReportingManagerDashboardProps> = ({ onNavigate }) => {
  const {
    currentUser,
    users,
    odRequests,
    leaveRequests,
    manualAttendanceRequests,
    attendanceRecords,
    slackLogs,
    approveOutdoorDuty,
    rejectOutdoorDuty,
    approveLeaveLevel1,
    rejectLeaveLevel1,
    approveRejectManualAttendance
  } = useApp();

  const [odComments, setOdComments] = useState<{ [id: string]: string }>({});
  const [leaveComments, setLeaveComments] = useState<{ [id: string]: string }>({});
  const [manualComments, setManualComments] = useState<{ [id: string]: string }>({});

  // My reporting team members
  const myTeam = users.filter((u) => u.reportingManagerId === currentUser.id);
  const myTeamIds = myTeam.map((u) => u.id);

  // Pending OD Requests for my team
  const pendingODs = odRequests.filter((o) => myTeamIds.includes(o.userId) && o.status === 'pending');

  // Pending Level-1 Leave Requests for my team
  const pendingLeaves = leaveRequests.filter(
    (l) => l.reportingManagerId === currentUser.id && l.status === 'pending_level_1'
  );

  // Pending Manual Attendance Regularizations for my team
  const pendingManuals = manualAttendanceRequests.filter(
    (m) => (myTeamIds.includes(m.userId) || m.reportingManagerId === currentUser.id) && m.status === 'pending'
  );

  // Today's team attendance status
  const todayStr = new Date().toISOString().split('T')[0];
  const teamTodayAttendance = myTeam.map((member) => {
    const record = attendanceRecords.find((a) => a.userId === member.id && a.date === todayStr);
    return {
      member,
      status: record?.status || 'absent',
      workMode: record?.workMode || 'in_office',
      clockIn: record?.clockIn || '-'
    };
  });

  const presentCount = teamTodayAttendance.filter((t) => t.status === 'present' || t.status === 'late').length;
  const odCount = teamTodayAttendance.filter((t) => t.status === 'od').length;
  const totalPending = pendingODs.length + pendingLeaves.length + pendingManuals.length;
  const attendanceRate = myTeam.length > 0 ? Math.round((presentCount / myTeam.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Quick Actions Shortcuts Bar for Reporting Manager */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Reporting Officer Quick Actions</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">Team management shortcuts</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <button
            onClick={() => onNavigate('attendance')}
            className="p-3 bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Users className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Team Attendance</span>
          </button>
          <button
            onClick={() => onNavigate('leave_matrix')}
            className="p-3 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <CalendarCheck className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Leave Balances</span>
          </button>
          <button
            onClick={() => onNavigate('leave')}
            className="p-3 bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <FileText className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Review Applications ({totalPending})</span>
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className="p-3 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Users className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Reportees Roster ({myTeam.length})</span>
          </button>
          <button
            onClick={() => onNavigate('od')}
            className="p-3 bg-purple-50/80 hover:bg-purple-100 text-purple-900 border border-purple-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <MapPin className="w-5 h-5 text-purple-600 shrink-0" />
            <span>OD Requisitions</span>
          </button>
          <button
            onClick={() => onNavigate('holiday_calendar')}
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/90 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Clock className="w-5 h-5 text-slate-600 shrink-0" />
            <span>Holidays 2026</span>
          </button>
        </div>
      </div>
      {/* 4 Stat Cards Grid matching Attendance theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Team Attendance Rate */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Team Attendance</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{attendanceRate}%</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {presentCount} of {myTeam.length} present today
          </div>
        </div>

        {/* 2. Pending Approvals */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">Pending Approvals</p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{totalPending}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {totalPending > 0 ? 'Requires action by EOD' : 'Queue up to date'}
          </div>
        </div>

        {/* 3. Outdoor (OD) Duty */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">Outdoor (OD) Duty</p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">{odCount.toString().padStart(2, '0')}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <MapPin className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Employees at client site / field
          </div>
        </div>

        {/* 4. Leave Coverage */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">Leave Coverage</p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">
                {Math.max(0, 100 - Math.round((pendingLeaves.length / (myTeam.length || 1)) * 100))}%
              </p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            No critical gaps identified
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid: Approvals Table & Slack Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Pending Requests Queue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending OD Requests */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Pending Outdoor Duty (OD) Requests</span>
              </h3>
              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded">
                {pendingODs.length} Action(s)
              </span>
            </div>

            {pendingODs.length === 0 ? (
              <div className="text-center py-6 text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200 text-xs">
                No pending Outdoor Duty requests.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {pendingODs.map((od) => (
                  <div key={od.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{od.userName}</span>
                        <span className="text-slate-400 text-[11px] ml-2">({od.department})</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-700 uppercase font-semibold px-2 py-0.5 rounded tracking-wider">
                        Outdoor Duty
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 space-y-1">
                      <p>📍 <strong>Location:</strong> {od.location} ({od.startDate} to {od.endDate})</p>
                      <p className="italic text-slate-600">"{od.purpose}"</p>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        placeholder="Remarks..."
                        value={odComments[od.id] || ''}
                        onChange={(e) => setOdComments({ ...odComments, [od.id]: e.target.value })}
                        className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => approveOutdoorDuty(od.id, odComments[od.id])}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectOutdoorDuty(od.id, odComments[od.id])}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Leave Requests */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Pending Level-1 Leave Applications</span>
              </h3>
              <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded border border-indigo-100">
                {pendingLeaves.length} Request(s)
              </span>
            </div>

            {pendingLeaves.length === 0 ? (
              <div className="text-center py-6 text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200 text-xs">
                No pending Level-1 leave requests.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {pendingLeaves.map((lv) => (
                  <div key={lv.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{lv.userName}</span>
                        <span className="text-slate-400 text-[11px] ml-2 uppercase">({lv.employmentType.replace('_', ' ')})</span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-800 uppercase font-semibold px-2 py-0.5 rounded border border-indigo-100">
                        {lv.leaveTypeName}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 space-y-1">
                      <p>🗓️ <strong>Duration:</strong> {lv.startDate} to {lv.endDate} ({lv.daysCount} days)</p>
                      <p className="italic text-slate-600">"{lv.reason}"</p>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        placeholder="Level-1 remarks..."
                        value={leaveComments[lv.id] || ''}
                        onChange={(e) => setLeaveComments({ ...leaveComments, [lv.id]: e.target.value })}
                        className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => approveLeaveLevel1(lv.id, leaveComments[lv.id])}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectLeaveLevel1(lv.id, leaveComments[lv.id])}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Manual Attendance Requests */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Pending Manual Attendance</span>
              </h3>
              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded">
                {pendingManuals.length} Action(s)
              </span>
            </div>

            {pendingManuals.length === 0 ? (
              <div className="text-center py-6 text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200 text-xs">
                No pending manual attendance requests.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {pendingManuals.map((man) => (
                  <div key={man.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{man.userName}</span>
                        <span className="text-slate-400 text-[11px] ml-2">({man.userDepartment})</span>
                      </div>
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-100">
                        {man.reasonCategory || 'Forgotten Punch'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 space-y-1">
                      <p>⏰ <strong>Forgotten Date:</strong> {man.date} | <strong>Timings:</strong> {man.requestedInTime} - {man.requestedOutTime}</p>
                      <p className="italic text-slate-600">"{man.reason}"</p>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        placeholder="Manager remarks..."
                        value={manualComments[man.id] || ''}
                        onChange={(e) => setManualComments({ ...manualComments, [man.id]: e.target.value })}
                        className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => approveRejectManualAttendance(man.id, 'approve', manualComments[man.id])}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => approveRejectManualAttendance(man.id, 'reject', manualComments[man.id])}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col): Slack Activity Stream - Clean Minimalism */}
        <div className="bg-slate-50 border border-slate-300 border-dashed rounded-lg p-4 h-fit space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <span className="bg-slate-900 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">SLACK</span>
              <span>Activity Stream</span>
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Synced</span>
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {slackLogs.length === 0 ? (
              <div className="text-slate-400 text-center py-6 text-xs">No active Slack broadcasts.</div>
            ) : (
              slackLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="bg-white p-2.5 rounded border-l-3 border-blue-600 shadow-xs space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-blue-700 uppercase">AUTOMATION</span>
                    <span className="text-slate-400 font-mono">{log.timestamp.split(' ')[1] || log.timestamp}</span>
                  </div>
                  <div className="text-slate-800 text-xs font-medium leading-snug">{log.title}</div>
                  <div className="text-slate-500 text-[11px] line-clamp-2">{log.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Direct Reporting Team Attendance */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Direct Reporting Team Roster</span>
          </h3>
          <button
            onClick={() => onNavigate('attendance')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View Full Matrix →
          </button>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr className="h-10">
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[32%]">Employee</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[24%]">Type</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[16%]">Status</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[14%]">Mode</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[14%]">Clock In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamTodayAttendance.map(({ member, status, workMode, clockIn }) => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex items-center space-x-2 min-w-0">
                      <img src={member.avatar} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block truncate">{member.name}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{member.designation}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 capitalize text-slate-600 font-medium align-middle truncate">
                    {member.employmentType.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                    {(() => {
                      const code = getNormalizedStatusCode(status);
                      const def = ATTENDANCE_STATUS_MAP[code] || ATTENDANCE_STATUS_MAP.PP;
                      return (
                        <span
                          title={`${code} - ${def.label}`}
                          className={`px-2 py-0.5 rounded font-mono font-black uppercase text-[10px] border ${def.badgeStyle}`}
                        >
                          {code}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 uppercase font-medium align-middle whitespace-nowrap">{workMode}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 align-middle whitespace-nowrap">{formatTo24H(clockIn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
