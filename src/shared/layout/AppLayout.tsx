import { formatOrgAddress, formatOrgCopyright } from '../types/branding.types';
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PageHeader, BreadcrumbItem } from '../components/PageHeader';
import { MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface AppLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeModule: 'lobby' | 'lams' | 'pms' | 'sims' | 'fms' | 'finance';
  setActiveModule: (module: 'lobby' | 'lams' | 'pms' | 'sims' | 'fms' | 'finance') => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  onRoleChangedGoDashboard: () => void;
  pageHeader?: {
    title: string;
    breadcrumb?: BreadcrumbItem[];
    badge?: string | { text: string; variant?: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral' };
    actions?: React.ReactNode;
    icon?: any;
  };
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  setActiveTab,
  activeModule,
  setActiveModule,
  isOpenMobile,
  setIsOpenMobile,
  onRoleChangedGoDashboard,
  pageHeader,
  children
}) => {
  const { orgBranding } = useApp();

  // Same footer as the login page and the Organization details preview (Master Settings → Organization).
  const address = formatOrgAddress(orgBranding);

  return (
    <div className="h-[100dvh] w-full min-w-0 bg-slate-50 text-slate-900 font-sans flex overflow-hidden">
      {/* 1. Standard Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      {/* Main Viewport Shell */}
      <div className="flex-1 flex flex-col h-[100dvh] min-w-0 overflow-hidden">
        {/* 2. Standard Header / Navbar */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isOpenMobile={isOpenMobile}
          setIsOpenMobile={setIsOpenMobile}
          onRoleChangedGoDashboard={onRoleChangedGoDashboard}
        />

        {/* 3. Scrollable Main Content Shell */}
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col">
          <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 w-full max-w-[1700px] mx-auto space-y-5 sm:space-y-6">
            {/* 4. Page Header if provided */}
            {pageHeader && (
              <PageHeader
                title={pageHeader.title}
                breadcrumb={pageHeader.breadcrumb}
                badge={pageHeader.badge}
                actions={pageHeader.actions}
                icon={pageHeader.icon}
              />
            )}

            {/* 5. Main Page Content */}
            {children}
          </main>

          {/* 6. Standard Institutional Footer */}
          <footer className="py-2.5 sm:py-0 min-h-[52px] sm:h-14 bg-white border-t border-slate-200 text-slate-500 text-xs mt-auto px-4 sm:px-6 shrink-0 flex items-center">
            <div className="w-full max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
              <p className="font-medium text-slate-600">{formatOrgCopyright(orgBranding)}</p>
              {address && (
                <div className="flex items-center space-x-1.5 text-slate-600 font-medium text-[11px] sm:text-xs">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{address}</span>
                </div>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
