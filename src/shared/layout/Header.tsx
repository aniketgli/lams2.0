import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole, getUserRoles } from '../../types';
import { WIILogo } from '../components/WIILogo';
import {
  Menu,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Check,
  User as UserIcon
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeModule: 'lobby' | 'lams' | 'pms' | 'sims' | 'fms' | 'finance';
  setActiveModule: (module: 'lobby' | 'lams' | 'pms' | 'sims' | 'fms' | 'finance') => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  onRoleChangedGoDashboard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeModule,
  setActiveModule,
  setIsOpenMobile,
  onRoleChangedGoDashboard
}) => {
  const {
    currentUser,
    logout,
    applyActiveSessionRole
  } = useApp();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [assignedRoleLabels, setAssignedRoleLabels] = useState<string[]>([]);
  const [roleSwitchBusy, setRoleSwitchBusy] = useState(false);
  const [roleSwitchError, setRoleSwitchError] = useState('');
  const [currentRoleLabel, setCurrentRoleLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/access/roles?moduleId=${encodeURIComponent(({ lams: 'hrms', pms: 'pms', sims: 'stock', fms: 'facility', finance: 'finance' } as Record<string, string>)[activeModule] || activeModule)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load assigned roles');
        return response.json();
      })
      .then((data) => { if (active) setAssignedRoleLabels(Array.isArray(data.roles) ? data.roles : []); })
      .catch(() => { if (active) setAssignedRoleLabels([]); });
    return () => { active = false; };
  }, [activeModule]);

  const roleToLabel: Record<string, string> = {
    administrator: 'Administrator', audit: 'Auditor', reporting_manager: 'Reporting Manager',
    reviewing_manager: 'HoD', general_staff: 'User'
  };
  const labelToRole: Record<string, UserRole> = {
    Administrator: 'administrator', Auditor: 'audit', 'Reporting Manager': 'reporting_manager',
    HoD: 'reviewing_manager', User: 'general_staff'
  };
  const handleRoleSwitch = async (label: string) => {
    setRoleSwitchError('');
    setRoleSwitchBusy(true);
    try {
      const response = await fetch('/api/access/active-role', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ role: label })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Role switch was rejected.');
      applyActiveSessionRole(label);
      setCurrentRoleLabel(label);
      onRoleChangedGoDashboard();
    } catch (error) {
      setRoleSwitchError(error instanceof Error ? error.message : 'Unable to switch role.');
    } finally {
      setRoleSwitchBusy(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'administrator':
        return 'Administrator';
      case 'audit':
        return 'Auditor';
      case 'reporting_manager':
        return 'Reporting Manager';
      case 'reviewing_manager':
        return 'HoD';
      default:
        return 'User';
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'administrator':
        return 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]';
      case 'audit':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'reporting_manager':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'reviewing_manager':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  };

  const userRoles = getUserRoles(currentUser);
  const isAdminUser = userRoles.includes('administrator') || currentUser.baseRole === 'administrator' || currentUser.role === 'administrator';

  const allRolesList: { role: UserRole; label: string }[] = [
    { role: 'administrator', label: 'Administrator' },
    { role: 'audit', label: 'Auditor' },
    { role: 'reporting_manager', label: 'Reporting Manager' },
    { role: 'reviewing_manager', label: 'HoD' },
    { role: 'general_staff', label: 'User' }
  ];

  const rolesList = allRolesList.filter((item) => assignedRoleLabels.includes(item.label));
  const activeRoleLabel = currentRoleLabel || getRoleLabel(currentUser.role);



  const handleExitModule = () => {
    setIsUserMenuOpen(false);
    setActiveModule('lobby');
  };

  return (
    <header className="relative h-16 bg-transparent border-b border-slate-200 sticky top-0 z-30 shrink-0 flex items-center text-slate-900 shadow-sm">
      <div className="relative z-10 w-full min-w-0 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        {/* Left Side: Navigation / Mobile Menu & Logo */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpenMobile(true)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Logo Title */}
          <div className="flex lg:hidden items-center pointer-events-none select-none">
            <WIILogo variant="horizontal" size="md" textColor="text-slate-900" />
          </div>
        </div>

        {/* Right Side: User Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-300 transition-all text-left focus:outline-none cursor-pointer"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
              />
              <div className="hidden sm:block text-left">
                <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[140px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight font-medium">
                  {activeRoleLabel}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-100">
                {/* Current Profile Summary */}
                <div className="p-3 bg-slate-50/80">
                  <div className="flex items-center space-x-3">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{currentUser.designation}</p>
                      <p className="text-[10px] text-[#2563eb] font-mono truncate mt-0.5">{currentUser.email}</p>
                    </div>
                  </div>
                </div>

                {rolesList.length > 1 && (
                  <div className="p-3 border-b border-slate-100">
                    
                    <div className="space-y-1">
                      {rolesList.map((item) => (
                        <button key={item.role} type="button" disabled={roleSwitchBusy || item.label === activeRoleLabel}
                          onClick={() => handleRoleSwitch(item.label)}
                          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${item.label === activeRoleLabel ? 'bg-blue-50 text-blue-800 cursor-default' : 'text-slate-700 hover:bg-slate-50 disabled:opacity-50'}`}>
                          <span>{item.label}</span>
                          {getRoleLabel(item.role) === getRoleLabel(currentUser.role) && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                    {roleSwitchError && <p role="alert" className="text-[11px] text-rose-600 mt-2">{roleSwitchError}</p>}
                  </div>
                )}

                {/* Logout / Exit Module */}
                <div className="p-2 space-y-1">
                  <button
                    onClick={handleExitModule}
                    className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer font-semibold"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Exit Module</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
