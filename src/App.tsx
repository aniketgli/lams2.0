import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SessionProvider, useSession } from './auth/SessionContext';
import { toUiModule } from './auth/access';
import { AppLayout } from './shared/layout';
import { DashboardPage } from './modules/hrms/dashboard/pages/DashboardPage';
import { AttendanceManagementPage } from './modules/hrms/attendance/pages/AttendanceManagementPage';
import { LeaveManagementPage } from './modules/hrms/leave/pages/LeaveManagementPage';
import { HolidayCalendarPage } from './modules/hrms/holidays/pages/HolidayCalendarPage';
import { MasterSettingsPage } from './modules/hrms/master/pages/MasterSettingsPage';
import { EmployeeProfilePage } from './modules/hrms/profile/pages/EmployeeProfilePage';
import { SlackHubModal } from './shared/modals/SlackHubModal';
import { EmailToast } from './shared/components/EmailToast';
import { LogoViewerModal } from './shared/modals/LogoViewerModal';
import { LoginPage } from './auth/pages/LoginPage';
import { LobbyPage } from './lobby/pages/LobbyPage';
import { PMSView } from './modules/pms/PMSView';
import { InventoryView } from './modules/inventory/InventoryView';
import { FMSView } from './modules/fms/FMSView';
import { FinanceView } from './modules/finance/FinanceView';
import { EnterpriseModuleId } from './types';
import { LoadingScreen } from './shared/components/LoadingScreen';

type UiModule = 'lobby' | EnterpriseModuleId;

/** Tabs each HRMS role may open. Anything else falls back to the dashboard. */
const ADMIN_ONLY_TABS = new Set(['master']);

const AppContent: React.FC = () => {
  const { status, session, enterModule, exitModule } = useSession();
  const { currentUser, isLogoViewerOpen, setIsLogoViewerOpen } = useApp();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const activeModule: UiModule = session?.activeModule ? toUiModule(session.activeModule) : 'lobby';
  const activeRole = session?.activeRole ?? null;

  // Entering a module or changing role always lands on that role's dashboard.
  useEffect(() => {
    setActiveTab('dashboard');
  }, [activeModule, activeRole]);

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signedOut' || !session || !currentUser) return <LoginPage />;

  const setActiveModule = (module: UiModule) => {
    if (module === activeModule) return;
    const action = module === 'lobby' ? exitModule() : enterModule(module);
    action.catch((error) => console.error('Module change failed:', error));
  };

  if (activeModule === 'lobby') return <LobbyPage />;

  const canOpen = (tab: string) => !ADMIN_ONLY_TABS.has(tab) || activeRole === 'administrator' || activeRole === 'audit';
  const tab = canOpen(activeTab) ? activeTab : 'dashboard';

  return (
    <>
      <AppLayout
        activeTab={tab}
        setActiveTab={setActiveTab}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        onRoleChangedGoDashboard={() => setActiveTab('dashboard')}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
      >
        {activeModule === 'lams' && (
          // Keyed by role so every page remounts with fresh state after a role switch.
          <React.Fragment key={activeRole ?? 'none'}>
            {tab === 'dashboard' && (
              <DashboardPage onNavigate={setActiveTab} onOpenSlackModal={() => setIsSlackModalOpen(true)} />
            )}
            {(tab === 'attendance' || tab === 'manual_attendance' || tab === 'od' || tab === 'attendance_management') && (
              <AttendanceManagementPage initialTab={tab} />
            )}
            {(tab === 'leave' || tab === 'leave_matrix' || tab === 'leave_balance') && (
              <LeaveManagementPage onNavigate={setActiveTab} initialTab={tab} />
            )}
            {tab === 'holiday_calendar' && <HolidayCalendarPage onNavigate={setActiveTab} />}
            {(tab === 'profile' || tab === 'roles' || tab === 'user_controls' || tab === 'transfers') && (
              <EmployeeProfilePage
                initialTab={tab === 'roles' || tab === 'user_controls' ? 'user_controls' : tab === 'transfers' ? 'transfers' : 'profile'}
              />
            )}
            {tab === 'master' && <MasterSettingsPage />}
          </React.Fragment>
        )}

        {activeModule === 'pms' && <PMSView onReturnToLobby={() => setActiveModule('lobby')} />}
        {activeModule === 'sims' && <InventoryView onReturnToLobby={() => setActiveModule('lobby')} />}
        {activeModule === 'fms' && <FMSView onReturnToLobby={() => setActiveModule('lobby')} />}
        {activeModule === 'finance' && <FinanceView onReturnToLobby={() => setActiveModule('lobby')} />}
      </AppLayout>

      <SlackHubModal isOpen={isSlackModalOpen} onClose={() => setIsSlackModalOpen(false)} />
      <EmailToast />
      <LogoViewerModal
        isOpen={isLogoViewerOpen}
        onClose={() => setIsLogoViewerOpen(false)}
        onOpenMasterBranding={() => {
          if (activeModule !== 'lams') setActiveModule('lams');
          setActiveTab('master');
        }}
      />
    </>
  );
};

export default function App() {
  return (
    <SessionProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SessionProvider>
  );
}
