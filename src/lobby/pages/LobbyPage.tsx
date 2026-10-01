import React from 'react';
import { useApp } from '../../context/AppContext';
import { EnterpriseModuleId, UserRole, formatOrgAddress } from '../../types';
import { WIILogo } from '../../shared/components/WIILogo';
import {
  Users,
  Package,
  IndianRupee,
  Building2,
  FolderKanban,
  LogOut,
  Lock,
  ArrowUpRight,
  MapPin
} from 'lucide-react';

export interface LobbyPageProps {
  onSelectModule: (moduleId: EnterpriseModuleId) => void;
  onLogout?: () => void;
}

export type LobbyViewProps = LobbyPageProps;

interface LobbyCardItem {
  id: EnterpriseModuleId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  allowedRoles: UserRole[];
}

const LOBBY_MODULES: LobbyCardItem[] = [
  {
    id: 'lams',
    title: 'HRMS',
    subtitle: 'Human Resource Management System',
    icon: Users,
    iconBg: 'bg-blue-600',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff']
  },
  {
    id: 'sims',
    title: 'Stock Inventory',
    subtitle: 'Inventory & Supply Chain Management',
    icon: Package,
    iconBg: 'bg-emerald-600',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff']
  },
  {
    id: 'finance',
    title: 'Finance Management',
    subtitle: 'Financial Planning & Accounting',
    icon: IndianRupee,
    iconBg: 'bg-purple-600',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff']
  },
  {
    id: 'fms',
    title: 'Facility Management',
    subtitle: 'Facilities & Asset Management',
    icon: Building2,
    iconBg: 'bg-orange-600',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff']
  },
  {
    id: 'pms',
    title: 'Project Management',
    subtitle: 'Projects & Task Tracking',
    icon: FolderKanban,
    iconBg: 'bg-teal-600',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff']
  }
];

export const LobbyPage: React.FC<LobbyPageProps> = ({ onSelectModule, onLogout }) => {
  const { currentUser, logout, orgBranding } = useApp();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };

  const isModuleAllowed = (card: LobbyCardItem) => {
    if (currentUser.role === 'administrator') return true;
    return card.allowedRoles.includes(currentUser.role);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Top Navigation Bar with Logo and Logout */}
      <header className="w-full px-6 sm:px-10 lg:px-12 py-5 flex items-center justify-between">
        {/* WII Brand Mark */}
        <div className="flex items-center space-x-3">
          <WIILogo variant="horizontal" size="md" />
        </div>

        {/* Right Actions: Logout Button */}
        <div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Sign out of WII Enterprise Portal"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-10 lg:px-12 py-10 lg:py-16 flex flex-col justify-center">
        {/* Welcome Headline (matching Pic 1) */}
        <div className="mb-10 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {currentUser.name}!
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Wildlife Institute of India Enterprise Suite. Select a module below to launch your authorized workspace.
          </p>
        </div>

        {/* 5 Cards Row - Responsive: Mobile 1 card, Tab max 3 cards (centered), Display max 5 cards */}
        <div className="flex flex-wrap items-stretch justify-center gap-4 sm:gap-5 lg:gap-5 xl:gap-6 w-full max-w-7xl mx-auto">
          {LOBBY_MODULES.map((mod) => {
            const Icon = mod.icon;
            const allowed = isModuleAllowed(mod);

            return (
              <div
                key={mod.id}
                onClick={() => allowed && onSelectModule(mod.id)}
                className={`group relative bg-white border rounded-2xl p-6 sm:p-7 flex flex-col items-center text-center transition-all duration-200 select-none w-full max-w-[340px] sm:max-w-none sm:w-[calc(33.333%-14px)] md:w-[calc(33.333%-18px)] lg:w-[calc(20%-16px)] xl:w-[calc(20%-20px)] shrink-0 ${
                  allowed
                    ? 'border-slate-200/90 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer'
                    : 'border-slate-200 opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Module Icon Box */}
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-5 shadow-2xs transition-transform duration-200 ${
                    allowed ? 'group-hover:scale-105' : ''
                  } ${mod.iconBg}`}
                >
                  <Icon className="w-8 h-8 stroke-[2.2]" />
                </div>

                {/* Module Title */}
                <h3 className="font-bold text-slate-900 text-base tracking-tight mb-1.5 group-hover:text-blue-900 transition-colors">
                  {mod.title}
                </h3>

                {/* Subtitle / Description */}
                <p className="text-xs text-slate-500 font-normal leading-relaxed max-w-[190px]">
                  {mod.subtitle}
                </p>

                {/* Hover affordance indicator */}
                {allowed ? (
                  <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                    <span>Open Module</span>
                    <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-center gap-1 text-[11px] font-medium text-amber-700">
                    <Lock className="w-3 h-3" />
                    <span>Restricted</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Subtle Footer with Copyright on one side and Address on the other side */}
      <footer className="w-full px-6 sm:px-10 lg:px-12 py-5 bg-white border-t border-slate-200 text-xs text-slate-500 font-medium shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>{orgBranding?.copyrightText || `© ${new Date().getFullYear()} ${orgBranding?.orgName || 'Wildlife Institute of India'} • Integrated Enterprise Portal`}</p>
          <div className="flex items-center space-x-1.5 text-slate-600 text-[11px] sm:text-xs">
            <MapPin className="w-3.5 h-3.5 text-[#701618] shrink-0" />
            <span>{formatOrgAddress(orgBranding)}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const LobbyView = LobbyPage;
