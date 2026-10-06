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
  ChevronRight,
  Calendar,
  Clock,
  MapPin
} from 'lucide-react';

interface ReviewingManagerDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ReviewingManagerDashboard: React.FC<ReviewingManagerDashboardProps> = ({ onNavigate }) => {
  const {
    currentUser,
    leaveRequests,
    approveLeaveLevel2,
    rejectLeaveLevel2
  } = useApp();

  const [level2Comments, setLevel2Comments] = useState<{ [id: string]: string }>({});

  // Pending Level-2 Leave Requests
  const pendingLevel2 = leaveRequests.filter(
    (l) => l.reviewingManagerId === currentUser.id && l.status === 'pending_level_2'
  );

  return (
    <div className="space-y-6">
      {/* Quick Actions Shortcuts Bar (4 Essential Buttons) */}
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

      {/* Leave Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 min-w-0">
            <FileText className="w-4.5 h-4.5 text-blue-600 shrink-0" />
            <span className="truncate">Leave</span>
          </h3>
          <button
            onClick={() => onNavigate('leave')}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1 border border-blue-200/80 shrink-0 ml-2 whitespace-nowrap"
          >
            <span>View All ({pendingLevel2.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {pendingLevel2.length === 0 ? (
          <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">
            No active leave records.
          </div>
        ) : (
          <div className="space-y-3 text-xs mt-4">
            {pendingLevel2.slice(0, 3).map((lv) => (
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
                  {lv.level1Approval && (
                    <p className="text-[10px] text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 mt-1 font-medium">
                      ✅ Level-1 Approved by {lv.level1Approval.approverName}: "{lv.level1Approval.comments}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
