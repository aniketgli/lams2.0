import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import {
  Clock,
  MapPin,
  FileText,
  CalendarCheck,
  ChevronRight
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenSlackModal?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const {
    users,
    odRequests,
    leaveRequests,
    manualAttendanceRequests,
    approveOutdoorDuty,
    rejectOutdoorDuty,
    approveLeaveLevel1,
    rejectLeaveLevel1,
    approveRejectManualAttendance
  } = useApp();

  const [odComments, setOdComments] = useState<{ [id: string]: string }>({});
  const [leaveComments, setLeaveComments] = useState<{ [id: string]: string }>({});
  const [manualComments, setManualComments] = useState<{ [id: string]: string }>({});

  // All pending requests across institution
  const pendingODs = odRequests.filter((o) => o.status === 'pending');
  const pendingLeaves = leaveRequests.filter((l) => l.status.startsWith('pending'));
  const pendingManuals = manualAttendanceRequests.filter((m) => m.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Quick Actions Shortcuts Bar for Administrator (4 Buttons in Serial Order) */}
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
            <CalendarCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Leave</span>
          </button>
          <button
            onClick={() => onNavigate('holiday_calendar')}
            className="p-3.5 bg-purple-50/80 hover:bg-purple-100 text-purple-900 border border-purple-200/80 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center"
          >
            <CalendarCheck className="w-5 h-5 text-purple-600 shrink-0" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* Staff Requests Queues Section - 3 Cards in 1 Row (Manual -> OD -> Leave) */}
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
                <span>View All ({pendingManuals.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingManuals.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">
                No manual attendance records.
              </div>
            ) : (
              <div className="space-y-3 text-xs mt-4">
                {pendingManuals.slice(0, 3).map((man) => (
                  <div key={man.id} className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs block truncate">{man.userName}</span>
                        <span className="text-slate-400 text-[11px] font-medium block truncate">({man.userDepartment})</span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded border border-indigo-200 uppercase shrink-0">
                        {man.reasonCategory || 'Forgotten Punch'}
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
                <span>View All ({pendingODs.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingODs.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">
                No Outdoor Duty records.
              </div>
            ) : (
              <div className="space-y-3 text-xs mt-4">
                {pendingODs.slice(0, 3).map((od) => (
                  <div key={od.id} className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs block truncate">{od.userName}</span>
                        <span className="text-slate-400 text-[11px] font-medium block truncate">({od.department})</span>
                      </div>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded border border-emerald-200 uppercase shrink-0">
                        Outdoor Duty
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-800">📍 {od.location} ({od.startDate} to {od.endDate})</p>
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
                <span>View All ({pendingLeaves.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingLeaves.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">
                No active leave records.
              </div>
            ) : (
              <div className="space-y-3 text-xs mt-4">
                {pendingLeaves.slice(0, 3).map((lv) => (
                  <div key={lv.id} className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs block truncate">{lv.userName}</span>
                        <span className="text-slate-400 text-[11px] font-medium block truncate">({lv.employmentType.replace('_', ' ')})</span>
                      </div>
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded border border-blue-200 uppercase shrink-0">
                        {lv.leaveTypeName}
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
