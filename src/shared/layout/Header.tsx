import React, { useState } from 'react';
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
  setActiveModule,
  setIsOpenMobile,
  onRoleChangedGoDashboard
}) => {
  const {
    currentUser,
    switchRoleOverride,
    logout
  } = useApp();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'administrator':
        return 'Administrator';
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
    { role: 'reporting_manager', label: 'Reporting Manager' },
    { role: 'reviewing_manager', label: 'HoD' },
    { role: 'general_staff', label: 'User' }
  ];

  const rolesList = allRolesList.filter((item) => {
    if (isAdminUser) return true;
    return userRoles.includes(item.role);
  });

  const handleSelectRole = (role: UserRole) => {
    switchRoleOverride(role);
    setIsUserMenuOpen(false);
    setActiveTab('dashboard');
    onRoleChangedGoDashboard();
  };

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
                  {getRoleLabel(currentUser.role)}
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
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-medium text-slate-500">{currentUser.department}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeStyle(currentUser.role)}`}>
                      {getRoleLabel(currentUser.role)}
                    </span>
                  </div>
                </div>

                {/* Integrated Role Switcher */}
                <div className="p-2">
                  <p className="text-[10px] font-bold text-slate-400 px-2 my-1 uppercase tracking-wider flex items-center justify-between">
                    <span>Switch Role View</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2563eb]" />
                  </p>
                  <div className="space-y-1">
                    {rolesList.map((item) => {
                      const isActive = currentUser.role === item.role;
                      return (
                        <button
                          key={item.role}
                          onClick={() => handleSelectRole(item.role)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-[#eff6ff] text-[#2563eb] font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{item.label}</span>
                          {isActive && <Check className="w-3.5 h-3.5 text-[#2563eb]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
