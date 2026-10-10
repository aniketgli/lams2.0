import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { ShieldAlert, Check, RefreshCw } from 'lucide-react';

interface RoleSwitcherBarProps {
  onRoleChangedGoDashboard: () => void;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({ onRoleChangedGoDashboard }) => {
  const { currentUser, switchRoleOverride, resetAllData } = useApp();

  const handleRoleChange = (role: UserRole) => {
    switchRoleOverride(role);
    onRoleChangedGoDashboard();
  };

  const roleButtons: { role: UserRole; label: string; desc: string }[] = [
    { role: 'administrator', label: 'Administrator', desc: 'Full System & Role Master' },
    { role: 'reporting_manager', label: 'Reporting Manager', desc: 'Team OD & Level-1 Leave Approval' },
    { role: 'reviewing_manager', label: 'HoD', desc: 'Department & Level-2 Leave Approval' },
    { role: 'general_staff', label: 'Staff User', desc: 'View Attendance, Apply OD & Leaves' }
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Active Context Banner */}
        <div className="flex items-center space-x-2 text-slate-600">
          <ShieldAlert className="w-4 h-4 text-[#2563eb] shrink-0" />
          <span>
            <strong className="text-slate-900 font-semibold">Active Persona:</strong> Testing permissions for{' '}
            <strong className="text-[#2563eb] font-semibold">{currentUser.name}</strong>
          </span>
        </div>

        {/* Role Switcher Pill Group */}
        <div className="flex items-center flex-wrap gap-1.5">
          {roleButtons.map((rb) => {
            const isActive = currentUser.role === rb.role;
            return (
              <button
                key={rb.role}
                onClick={() => handleRoleChange(rb.role)}
                className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all flex items-center space-x-1 border cursor-pointer ${
                  isActive
                    ? 'bg-[#2563eb] text-white border-[#2563eb] font-semibold shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={rb.desc}
              >
                {isActive && <Check className="w-3 h-3 text-white" />}
                <span>{rb.label}</span>
              </button>
            );
          })}

          <button
            onClick={resetAllData}
            className="p-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 ml-1.5 transition-colors flex items-center space-x-1"
            title="Reset to default seed data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px] font-medium">Reset Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};

