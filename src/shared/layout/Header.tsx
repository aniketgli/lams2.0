import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole, getUserRoles, getUserModuleRoles, MODULE_ROLE_DEFINITIONS, EnterpriseModuleId } from '../../types';
import { WIILogo } from '../components/WIILogo';
import {
  Menu,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Check,
  RefreshCw,
  Layers,
  Crown
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
    switchRoleOverride,
    resetAllData,
    logout,
    orgBranding,
    setIsLogoViewerOpen
  } = useApp();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const getModuleName = (mod: string) => {
    switch (mod) {
      case 'lobby':
        return 'Enterprise Suite Lobby';
      case 'lams':
        return 'LAMS 2.0';
      case 'pms':
        return 'WII-PMS';
      case 'sims':
        return 'WII-SIMS';
      case 'fms':
        return 'WII-FMS';
      case 'finance':
        return 'WII-FinPay';
      default:
        return 'WII Portal';
    }
  };

  const getTabName = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard';
      case 'attendance':
        return 'Attendance';
      case 'manual_attendance':
        return 'Manual Attendance';
      case 'od':
        return 'Outdoor Duty';
      case 'leave':
        return 'Leaves';
      case 'leave_balance':
      case 'leave_matrix':
        return 'Leave Balance';
      case 'holiday_calendar':
        return 'Holiday Calendar';
      case 'profile':
        return 'Employee Profiles';
      case 'user_controls':
      case 'roles':
        return 'User Controls & Roles';
      case 'transfers':
        return 'Transfers & Mapping';
      case 'master':
        return 'Master Settings';
      default:
        return tab ? tab.charAt(0).toUpperCase() + tab.slice(1).replace(/_/g, ' ') : '';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'administrator':
        return 'Administrator';
      case 'reporting_manager':
        return 'Reporting Manager';
      case 'reviewing_manager':
        return 'HoD';
      default:
        return 'General Staff';
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'administrator':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'reporting_manager':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'reviewing_manager':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  // Dynamic assigned roles list for current user
  const userRoles = getUserRoles(currentUser);
  const isAdminUser = userRoles.includes('administrator') || currentUser.baseRole === 'administrator' || currentUser.role === 'administrator';

  const allRolesList: { role: UserRole; label: string }[] = [
    { role: 'administrator', label: 'Administrator' },
    { role: 'reporting_manager', label: 'Reporting Manager' },
    { role: 'reviewing_manager', label: 'HoD' },
    { role: 'general_staff', label: 'General Staff' }
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

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0 flex items-center">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Left Side: Navigation / Mobile Menu & Active Module Name */}
        <div className="flex items-center space-x-3">
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
            <WIILogo variant="horizontal" size="md" />
          </div>

          {/* Active Module Name / Menu Name */}
          <div className="hidden sm:flex items-center space-x-2 text-sm sm:text-base font-black text-slate-900 tracking-tight">
            <span>{getModuleName(activeModule)}</span>
            {activeTab && activeModule !== 'lobby' && (
              <>
                <span className="text-slate-300 font-normal">/</span>
                <span className="text-slate-700 font-extrabold">{getTabName(activeTab)}</span>
              </>
            )}
          </div>
        </div>

        {/* Right Side: User Profile Dropdown */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-left focus:outline-none cursor-pointer"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-2xs"
                />
                <div className="hidden sm:block text-left">
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
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
                        <p className="text-[10px] text-blue-700 font-mono truncate mt-0.5">{currentUser.email}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-medium text-slate-500">{currentUser.department}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(currentUser.role)}`}>
                        {getRoleLabel(currentUser.role)}
                      </span>
                    </div>


                  </div>

                  {/* Integrated Role Switcher */}
                  <div className="p-2">
                    <p className="text-[10px] font-bold text-slate-400 px-2 my-1 uppercase tracking-wider flex items-center justify-between">
                      <span>Switch Role View</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    </p>
                    <div className="space-y-1">
                      {rolesList.map((item) => {
                        const isActive = currentUser.role === item.role;
                        return (
                          <button
                            key={item.role}
                            onClick={() => handleSelectRole(item.role)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                              isActive
                                ? 'bg-blue-50 text-blue-900 font-bold border border-blue-100'
                                : 'hover:bg-slate-50 text-slate-700 font-medium'
                            }`}
                          >
                            <span>{item.label}</span>
                            {isActive && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions / Exit Module */}
                  <div className="p-2 bg-slate-50/80 flex items-center justify-between gap-2">
                    <button
                      onClick={resetAllData}
                      className="text-slate-500 hover:text-slate-800 font-semibold text-[11px] flex items-center space-x-1 px-2.5 py-1.5 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3 text-slate-400" />
                      <span>Reset Data</span>
                    </button>

                    <button
                      onClick={handleExitModule}
                      className="bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 font-bold py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                      title="Exit current module and return to Enterprise Lobby"
                    >
                      <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-red-600" />
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
