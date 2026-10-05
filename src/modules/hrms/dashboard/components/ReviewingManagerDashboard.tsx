import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Award,
  Layers,
  ChevronRight
} from 'lucide-react';

interface ReviewingManagerDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ReviewingManagerDashboard: React.FC<ReviewingManagerDashboardProps> = ({ onNavigate }) => {
  const {
    currentUser,
    users,
    leaveRequests,
    attendanceRecords,
    slackLogs,
    approveLeaveLevel2,
    rejectLeaveLevel2
  } = useApp();

  const [level2Comments, setLevel2Comments] = useState<{ [id: string]: string }>({});

  // Sub-team members reporting to reviewing manager
  const subTeam = users.filter((u) => u.reviewingManagerId === currentUser.id || u.reportingManagerId === currentUser.id);

  // Pending Level-2 Leave Requests
  const pendingLevel2 = leaveRequests.filter(
    (l) => l.reviewingManagerId === currentUser.id && l.status === 'pending_level_2'
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const presentCount = subTeam.filter((m) => {
    const rec = attendanceRecords.find((a) => a.userId === m.id && a.date === todayStr);
    return rec?.status === 'present' || rec?.status === 'od';
  }).length;

  const attendanceRate = subTeam.length > 0 ? Math.round((presentCount / subTeam.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Quick Actions Shortcuts Bar for HoD / Reviewing Manager */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-purple-600" />
            <span>Head of Department (HoD) Quick Actions</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">Departmental oversight shortcuts</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <button
            onClick={() => onNavigate('leave')}
            className="p-3 bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <FileText className="w-5 h-5 text-amber-600 shrink-0" />
            <span>L2 Sanctions Queue ({pendingLevel2.length})</span>
          </button>
          <button
            onClick={() => onNavigate('attendance')}
            className="p-3 bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Users className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Department Register</span>
          </button>
          <button
            onClick={() => onNavigate('leave_matrix')}
            className="p-3 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Staff Leave Matrix</span>
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className="p-3 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Users className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Department Staff ({subTeam.length})</span>
          </button>
          <button
            onClick={() => onNavigate('od')}
            className="p-3 bg-purple-50/80 hover:bg-purple-100 text-purple-900 border border-purple-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <ShieldAlert className="w-5 h-5 text-purple-600 shrink-0" />
            <span>OD Requisitions</span>
          </button>
          <button
            onClick={() => onNavigate('holiday_calendar')}
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/90 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Award className="w-5 h-5 text-slate-600 shrink-0" />
            <span>Holidays 2026</span>
          </button>
        </div>
      </div>
      {/* 4 Stat Cards Grid matching Attendance theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Department Attendance */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Dept. Attendance</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{attendanceRate}%</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {presentCount} of {subTeam.length} active personnel
          </div>
        </div>

        {/* 2. Level-2 Approvals Pending */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">L2 Pending</p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{pendingLevel2.length}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {pendingLevel2.length > 0 ? 'Escalated Level-2 applications' : 'All requests cleared'}
          </div>
        </div>

        {/* 3. Department Head Jurisdiction */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">Jurisdiction</p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">{subTeam.length}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Users className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Reporting &amp; Reviewing members
          </div>
        </div>

        {/* 4. Compliance Rate */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">Compliance Rate</p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">98.5%</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Award className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Level-1 &amp; Level-2 policy adherence
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Level-2 Clearance & Slack Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Level-2 Actionable Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Pending Level-2 Final Leave Clearance</span>
              </h3>
              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded">
                {pendingLevel2.length} Action(s)
              </span>
            </div>

            {pendingLevel2.length === 0 ? (
              <div className="text-center py-6 text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200 text-xs">
                All escalated Level-2 leave requests are cleared!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {pendingLevel2.map((lv) => (
                  <div key={lv.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{lv.userName}</span>
                        <span className="text-slate-400 text-[11px] ml-2 uppercase">({lv.employmentType.replace('_', ' ')})</span>
                      </div>
                      <span className="text-[10px] bg-amber-100 text-amber-800 uppercase font-semibold px-2 py-0.5 rounded border border-amber-200">
                        Level-2 Clearance Needed
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 space-y-1">
                      <p>🌴 <strong>Type:</strong> {lv.leaveTypeName} ({lv.daysCount} days)</p>
                      <p>🗓️ <strong>Dates:</strong> {lv.startDate} to {lv.endDate}</p>
                      <p className="italic text-slate-600">"{lv.reason}"</p>
                      {lv.level1Approval && (
                        <p className="text-[10px] text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 mt-1 font-medium">
                          ✅ Level-1 Approved by {lv.level1Approval.approverName}: "{lv.level1Approval.comments}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        placeholder="HoD clearance comments..."
                        value={level2Comments[lv.id] || ''}
                        onChange={(e) => setLevel2Comments({ ...level2Comments, [lv.id]: e.target.value })}
                        className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => approveLeaveLevel2(lv.id, level2Comments[lv.id])}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors"
                      >
                        Grant Approval
                      </button>
                      <button
                        onClick={() => rejectLeaveLevel2(lv.id, level2Comments[lv.id])}
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

          {/* Sub-team Department Roster */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-600" />
                <span>Department Personnel Directory</span>
              </h3>
              <button
                onClick={() => onNavigate('attendance')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View Full Attendance →
              </button>
            </div>

            <div className="w-full overflow-hidden">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr className="h-10">
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[32%]">Staff Member</th>
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[18%]">Role</th>
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[18%]">Type</th>
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[18%]">Department</th>
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[14%]">Slack Handle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subTeam.map((member) => (
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
                      <td className="px-4 py-2.5 font-semibold text-slate-700 capitalize align-middle truncate">{member.role.replace('_', ' ')}</td>
                      <td className="px-4 py-2.5 capitalize text-slate-600 align-middle truncate">{member.employmentType.replace('_', ' ')}</td>
                      <td className="px-4 py-2.5 text-slate-600 align-middle truncate">{member.department}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-700 font-medium align-middle truncate">{member.slackHandle || '@user'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Slack Feed */}
        <div className="bg-slate-50 border border-slate-300 border-dashed rounded-lg p-4 h-fit space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <span className="bg-slate-900 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">SLACK</span>
              <span>Approval Logs</span>
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Active</span>
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {slackLogs.length === 0 ? (
              <div className="text-slate-400 text-center py-6 text-xs">No active Slack broadcasts.</div>
            ) : (
              slackLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="bg-white p-2.5 rounded border-l-3 border-blue-600 shadow-xs space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-blue-700 uppercase">WORKFLOW</span>
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
    </div>
  );
};
