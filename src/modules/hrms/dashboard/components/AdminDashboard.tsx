import React from 'react';
import { useApp } from '../../../../context/AppContext';
import {
  ShieldCheck,
  Users,
  Building,
  Layers,
  Settings,
  Sliders,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenSlackModal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onOpenSlackModal }) => {
  const {
    users,
    leavePolicies,
    attendanceRecords,
    slackConfig
  } = useApp();

  const totalUsers = users.length;
  const permanentCount = users.filter((u) => u.employmentType === 'permanent').length;
  const contractualCount = users.filter((u) => u.employmentType === 'contractual').length;
  const researchersCount = users.filter((u) => u.employmentType === 'researcher').length;
  const traineesCount = users.filter((u) => u.employmentType === 'trainee_student').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendanceRecords.filter((a) => a.date === todayStr);
  const presentCount = todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const odCount = todayAttendance.filter((a) => a.status === 'od').length;
  const leaveCount = todayAttendance.filter((a) => a.status === 'leave').length;

  return (
    <div className="space-y-6">
      {/* Quick Actions Shortcuts Bar for Administrator */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>Administrator Control Center Quick Actions</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">System management shortcuts</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <button
            onClick={() => onNavigate('user_controls')}
            className="p-3 bg-purple-50/80 hover:bg-purple-100 text-purple-900 border border-purple-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Users className="w-5 h-5 text-purple-600 shrink-0" />
            <span>User Controls ({totalUsers})</span>
          </button>
          <button
            onClick={() => onNavigate('attendance')}
            className="p-3 bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Clock className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Master Attendance</span>
          </button>
          <button
            onClick={() => onNavigate('master')}
            className="p-3 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Settings className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Master Settings</span>
          </button>
          <button
            onClick={() => onNavigate('leave_matrix')}
            className="p-3 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Layers className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Leave Matrix</span>
          </button>
          <button
            onClick={() => onNavigate('transfers')}
            className="p-3 bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <Sliders className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Transfers &amp; Mapping</span>
          </button>
          <button
            onClick={() => onNavigate('holiday_calendar')}
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/90 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <CheckCircle2 className="w-5 h-5 text-slate-600 shrink-0" />
            <span>Holidays 2026</span>
          </button>
        </div>
      </div>
      {/* 4 Stat Cards Grid matching Attendance theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Permanent Staff */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Permanent Staff</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{permanentCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            CL (12), EL (30), HPL (20), RH (2)
          </div>
        </div>

        {/* 2. Contractual Personnel */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">Contractual Personnel</p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{contractualCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Building className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Casual (8), Sick Leave (6)
          </div>
        </div>

        {/* 3. Research Fellows */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">Research Fellows</p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">{researchersCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Users className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Field Work (30), Academic (15)
          </div>
        </div>

        {/* 4. Trainees & Students */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">Trainees &amp; Students</p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">{traineesCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Layers className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Stipend Off (6), Contingency (5)
          </div>
        </div>
      </div>

      {/* Main Grid: Attendance Overview, Slack Webhook, Email Dispatch & Admin Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Company Attendance Today */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Company Attendance</span>
            </h3>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Master Log
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-100">
              <span className="font-semibold text-emerald-900">In-Office / WFH</span>
              <strong className="text-emerald-700 font-bold">{presentCount}</strong>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-100">
              <span className="font-semibold text-blue-900">Outdoor Duty (OD)</span>
              <strong className="text-blue-700 font-bold">{odCount}</strong>
            </div>
            <div className="flex items-center justify-between p-2 bg-purple-50 rounded border border-purple-100">
              <span className="font-semibold text-purple-900">Approved Leave</span>
              <strong className="text-purple-700 font-bold">{leaveCount}</strong>
            </div>
          </div>
        </div>

        {/* Slack Integration Engine Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="bg-slate-900 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">SLACK</span>
                <h3 className="font-bold text-sm text-slate-900">Webhook Engine</h3>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Real-time webhook broadcasts for all workflow requests &amp; multi-tier approvals.
            </p>
          </div>

          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs font-mono">
            <p className="text-slate-400 text-[10px]">DEFAULT CHANNEL:</p>
            <p className="text-blue-700 font-bold">{slackConfig.defaultChannel}</p>
          </div>

          <button
            onClick={onOpenSlackModal}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 rounded text-xs transition-all flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <span>Slack Automation Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Master Actions */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2.5">
          <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-purple-600" />
            <span>Administrative Controls</span>
          </h3>

          <button
            onClick={() => onNavigate('roles')}
            className="w-full text-left p-2.5 rounded bg-purple-50 hover:bg-purple-100/80 border border-purple-200 transition-colors flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-bold text-purple-900">Role Allocation Master</p>
              <p className="text-[11px] text-purple-700">Assign reporting &amp; reviewing managers</p>
            </div>
            <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('leave')}
            className="w-full text-left p-2.5 rounded bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 transition-colors flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-bold text-indigo-900">Leave Workflow Master</p>
              <p className="text-[11px] text-indigo-700">Multi-level approval queues across company</p>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Employment Type Leave Policy Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-purple-600" />
          <span>Configured Policy Rules Matrix by Employment Category</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {leavePolicies.map((pol, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{pol.name}</span>
                <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                  {pol.defaultQuota} Days
                </span>
              </div>
              <p className="text-slate-600 text-[11px]">{pol.description}</p>
              <div className="text-[10px] text-indigo-700 pt-1 border-t border-slate-200 font-medium">
                Level-2 required if &gt; {pol.requiresLevel2ForDaysMoreThan} days
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
