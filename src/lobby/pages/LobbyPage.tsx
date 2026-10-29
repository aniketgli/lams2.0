import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSession } from '../../auth/SessionContext';
import { ServerModuleId, toUiModule } from '../../auth/access';
import { ApiError } from '../../shared/services/api';
import { formatOrgAddress } from '../../types';
import { WIILogo } from '../../shared/components/WIILogo';
import { Alert } from '../../shared/components';
import { navigate } from '../../shared/router';
import { Users, Package, IndianRupee, Building2, FolderKanban, LogOut, MapPin, Loader2, KeyRound } from 'lucide-react';

interface ModuleCard {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
}

/** Presentation only. Which modules appear is decided by the server. */
const MODULE_CARDS: Record<ServerModuleId, ModuleCard> = {
  hrms: { title: 'HRMS', subtitle: 'Human Resource Management System', icon: Users, iconBg: 'bg-blue-600' },
  stock: { title: 'Stock Inventory', subtitle: 'Inventory & Supply Chain Management', icon: Package, iconBg: 'bg-emerald-600' },
  finance: { title: 'Finance Management', subtitle: 'Financial Planning & Accounting', icon: IndianRupee, iconBg: 'bg-purple-600' },
  facility: { title: 'Facility Management', subtitle: 'Facilities & Asset Management', icon: Building2, iconBg: 'bg-orange-600' },
  pms: { title: 'Project Management', subtitle: 'Projects & Task Tracking', icon: FolderKanban, iconBg: 'bg-teal-600' },
};

export const LobbyPage: React.FC = () => {
  const { orgBranding } = useApp();
  const { session, enterModule, logout } = useSession();
  const [opening, setOpening] = useState<ServerModuleId | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;
  const modules = session.modules;

  const open = async (moduleId: ServerModuleId) => {
    if (opening) return;
    setError(null);
    setOpening(moduleId);
    try {
      await enterModule(toUiModule(moduleId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to open this module.');
      setOpening(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col justify-between">
      <header className="w-full px-6 sm:px-10 lg:px-12 py-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <WIILogo variant="horizontal" size="md" />
        </div>
        <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/change-password')}
          className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-slate-200 hover:border-primary/40 hover:bg-primary/5 text-slate-700 hover:text-primary text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Change password</span>
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-slate-200 hover:border-brand/40 hover:bg-brand/5 text-slate-700 hover:text-brand text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-10 lg:px-12 py-10 lg:py-16 flex flex-col justify-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-8 sm:mb-10">
          Welcome back, {session.user.name}
        </h1>

        {error && (
          <div className="mb-6 max-w-xl">
            <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>
          </div>
        )}

        {modules.length === 0 ? (
          <div className="max-w-xl bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
            No modules are assigned to your account yet. Please contact the administrator.
          </div>
        ) : (
          <div className="flex flex-wrap items-stretch justify-center gap-4 sm:gap-5 xl:gap-6 w-full">
            {modules.map(({ moduleId }) => {
              const card = MODULE_CARDS[moduleId];
              if (!card) return null;
              const Icon = card.icon;
              const isOpening = opening === moduleId;
              return (
                <button
                  key={moduleId}
                  type="button"
                  onClick={() => void open(moduleId)}
                  disabled={opening !== null}
                  className="group bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 flex flex-col items-center text-center transition-all duration-200 w-full max-w-[340px] sm:max-w-none sm:w-[calc(33.333%-14px)] lg:w-[calc(20%-16px)] hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 disabled:hover:translate-y-0 disabled:opacity-70 cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-5 ${card.iconBg}`}>
                    {isOpening ? <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" /> : <Icon className="w-8 h-8 stroke-[2.2]" />}
                  </span>
                  <span className="font-bold text-slate-900 text-base tracking-tight mb-1.5">{card.title}</span>
                  <span className="text-xs text-slate-500 leading-relaxed max-w-[190px]">{card.subtitle}</span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <footer className="w-full px-6 sm:px-10 lg:px-12 py-5 bg-white border-t border-slate-200 text-xs text-slate-500 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>{orgBranding?.copyrightText || `© ${new Date().getFullYear()} ${orgBranding?.orgName || 'Wildlife Institute of India'}`}</p>
          {formatOrgAddress(orgBranding) && (
            <p className="flex items-center gap-1.5 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden="true" />
              <span>{formatOrgAddress(orgBranding)}</span>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
};

export const LobbyView = LobbyPage;
