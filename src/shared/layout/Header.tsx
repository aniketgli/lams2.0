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
          <div className="relative sm:w-60" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              aria-label={`${displayName}, ${activeRoleLabel}. Open role menu`}
              className="group w-full flex items-center gap-2.5 px-1 sm:px-2 py-1.5 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#204088] cursor-pointer"
            >
              <UserAvatar name={currentUser.name} src={currentUser.avatar} className="w-8 h-8 rounded-full border border-slate-200" />
              <span className="hidden sm:block min-w-0 flex-1 text-left">
                <span className="block text-xs font-bold text-slate-900 leading-tight truncate">{displayName}</span>
                <span className="block text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
                  B.I. {biometricId}
                  <span className="mx-1 text-slate-300" aria-hidden="true">·</span>
                  <span className="font-semibold text-[#204088]">{activeRoleLabel}</span>
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-700 transition-transform ${isUserMenuOpen ? 'rotate-180 text-slate-700' : ''}`} aria-hidden="true" />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 w-60 sm:w-full max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-100">
                {/* Small screens hide the name in the header, so show it here only there. */}
                <div className="sm:hidden px-3 py-2.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                  <p className="text-[11px] text-slate-500 truncate">B.I. {biometricId}</p>
                </div>

                {rolesList.length > 1 && (
                  <div className="p-1.5">
                    <div className="space-y-0.5" role="group" aria-label="Switch role">
                      {rolesList.map((role) => (
                        <button key={role} type="button" role="menuitemradio" aria-checked={role === activeRole} disabled={roleSwitchBusy || role === activeRole}
                          onClick={() => void handleRoleSwitch(role)}
                          aria-current={role === activeRole ? 'true' : undefined}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all text-left ${role === activeRole ? 'bg-[#204088]/10 text-[#204088] font-bold cursor-default' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer disabled:opacity-50'}`}>
                          <span>{ROLE_LABELS[role]}</span>
                          {role === activeRole && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                    {roleSwitchError && <p role="alert" className="px-3 pt-1.5 pb-1 text-[11px] text-rose-600">{roleSwitchError}</p>}
                  </div>
                )}

                {/* Inside a module the only exit is back to the lobby; signing out happens there. */}
                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExitModule}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
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
