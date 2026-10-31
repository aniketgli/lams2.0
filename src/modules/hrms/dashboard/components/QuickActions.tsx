import React from 'react';
import { CalendarCheck, Clock, MapPin } from 'lucide-react';

const ACTIONS = [
  { tab: 'manual_attendance', label: 'Manual', icon: Clock, cls: 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border-indigo-200/80', iconCls: 'text-indigo-600' },
  { tab: 'od', label: 'OD', icon: MapPin, cls: 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border-emerald-200/80', iconCls: 'text-emerald-600' },
  { tab: 'leave', label: 'Leave', icon: CalendarCheck, cls: 'bg-blue-50/80 hover:bg-blue-100 text-blue-900 border-blue-200/80', iconCls: 'text-blue-600' },
  { tab: 'holiday_calendar', label: 'Calendar', icon: CalendarCheck, cls: 'bg-purple-50/80 hover:bg-purple-100 text-purple-900 border-purple-200/80', iconCls: 'text-purple-600' },
];

export const QuickActions: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => (
  <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ACTIONS.map(({ tab, label, icon: Icon, cls, iconCls }) => (
        <button key={tab} type="button" onClick={() => onNavigate(tab)}
          className={`p-3.5 border rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 text-center ${cls}`}>
          <Icon className={`w-5 h-5 shrink-0 ${iconCls}`} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  </div>
);
