import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { useSession } from '../../auth/SessionContext';
import { ROLE_LABELS, ROLE_ORDER } from '../../auth/access';
import { WIILogo } from '../components/WIILogo';
import { UserAvatar } from '../components/UserAvatar';
import {
  Menu,
  LogOut,
  ArrowLeft,
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
  setActiveModule,
  setIsOpenMobile,
  onRoleChangedGoDashboard
}) => {
  const { currentUser } = useApp();
  const { session, switchRole } = useSession();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [roleSwitchBusy, setRoleSwitchBusy] = useState(false);
  const [roleSwitchError, setRoleSwitchError] = useState('');

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsUserMenuOpen(false); };
    document.addEventListener('click', closeMenu, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('click', closeMenu, true); document.removeEventListener('keydown', closeOnEscape); };
  }, [isUserMenuOpen]);

  // Roles come from the server session: only active grants in the active module.
  const assignedRoles = session?.modules.find((m) => m.moduleId === session.activeModule)?.roles ?? [];
  const rolesList = ROLE_ORDER.filter((role) => assignedRoles.includes(role));
  const activeRole = session?.activeRole ?? null;
  const activeRoleLabel = activeRole ? ROLE_LABELS[activeRole] : '';
  // Identity and salutation come from the server (users + employee_profiles.suffix).
  const name = session?.user.name ?? currentUser.name;
  const displayName = session?.user.salutation ? `${session.user.salutation} ${name}` : name;
  const biometricId = session?.user.biometricId ?? currentUser.biometricId ?? '—';
  const email = session?.user.email ?? currentUser.email;

  const handleRoleSwitch = async (role: UserRole) => {
    if (role === activeRole || roleSwitchBusy) return;
    setRoleSwitchError('');
    setRoleSwitchBusy(true);
    try {
      await switchRole(role);
      setIsUserMenuOpen(false);
      onRoleChangedGoDashboard();
    } catch (error) {
      setRoleSwitchError(error instanceof Error ? error.message : 'Unable to switch role.');
    } finally {
      setRoleSwitchBusy(false);
    }
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
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-300 transition-all text-left focus:outline-none cursor-pointer"
            >
              <UserAvatar name={currentUser.name} src={currentUser.avatar} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-200" />
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
              <div className="absolute right-0 mt-1.5 w-72 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-100">
                {/* Current Profile Summary */}
                <div className="p-3 bg-slate-50/80">
                  <div className="flex items-center space-x-3">
                    <UserAvatar name={currentUser.name} src={currentUser.avatar} className="w-10 h-10 rounded-full border border-slate-200" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5" title={`B.I. ${biometricId} · ${email}`}>
                        <span className="font-semibold text-slate-600">B.I. {biometricId}</span>
                        <span className="mx-1.5 text-slate-300" aria-hidden="true">|</span>
                        <span>{email}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {rolesList.length > 1 && (
                  <div className="p-3 border-b border-slate-100">
                    <div className="space-y-1" role="group" aria-label="Switch role">
                      {rolesList.map((role) => (
                        <button key={role} type="button" disabled={roleSwitchBusy || role === activeRole}
                          onClick={() => void handleRoleSwitch(role)}
                          aria-current={role === activeRole ? 'true' : undefined}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all text-left ${role === activeRole ? 'bg-[#204088]/10 text-[#204088] font-bold cursor-default' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer disabled:opacity-50'}`}>
                          <span>{ROLE_LABELS[role]}</span>
                          {role === activeRole && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                    {roleSwitchError && <p role="alert" className="text-[11px] text-rose-600 mt-2">{roleSwitchError}</p>}
                  </div>
                )}

                {/* Inside a module the only exit is back to the lobby; signing out happens there. */}
                <div className="p-2 space-y-1">
                  <button
                    onClick={handleExitModule}
                    className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer font-semibold"
                  >
                    <ArrowLeft className="w-4 h-4 text-rose-600" />
                    <span>Back to lobby</span>
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
