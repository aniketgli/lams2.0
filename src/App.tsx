import React, { useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SessionProvider, useSession } from './auth/SessionContext';
import { SessionTimeoutGuard } from './auth/SessionTimeoutGuard';
import { toUiModule } from './auth/access';
import { resolveRoute } from './auth/resolveRoute';
import { navigate, usePath } from './shared/router';
import { HRMS_HOME, hrmsPath } from './modules/hrms/hrmsPages';
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

const AppContent: React.FC = () => {
  const { status, session, enterModule, exitModule } = useSession();
  const { currentUser, isLogoViewerOpen, setIsLogoViewerOpen } = useApp();
  const rawPath = usePath();
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const { screen, path } = resolveRoute(rawPath, status, session);

  // Keep the address bar honest: replace any URL the session does not allow.
  useEffect(() => {
    if (path && path !== rawPath) navigate(path, { replace: true });
  }, [path, rawPath]);

  // A role change (here or in another tab) always lands on that role's dashboard.
  const activeRole = session?.activeRole ?? null;
  // Only a change from one real role to another counts; loading the session on
  // a page refresh (no role → role) must keep the page the user was on.
  const previousRole = useRef(activeRole);
  useEffect(() => {
    const before = previousRole.current;
    previousRole.current = activeRole;
    if (before && activeRole && before !== activeRole && session?.activeModule === 'hrms') {
      navigate(hrmsPath(HRMS_HOME), { replace: true });
    }
  }, [activeRole, session?.activeModule]);

  if (screen.kind === 'loading') return <LoadingScreen />;
  if (screen.kind === 'login' || !currentUser) return <LoginPage />;

  const setActiveModule = (module: 'lobby' | EnterpriseModuleId) => {
    const current = session?.activeModule ? toUiModule(session.activeModule) : 'lobby';
    if (module === current) return;
    const action = module === 'lobby' ? exitModule() : enterModule(module);
    action.catch((error) => console.error('Module change failed:', error));
  };

  if (screen.kind === 'lobby') {
    return (
      <>
        <LobbyPage />
        <SessionTimeoutGuard />
      </>
    );
  }

  const activeModule: EnterpriseModuleId = screen.kind === 'hrms' ? 'lams' : screen.module;
  const tab = screen.kind === 'hrms' ? screen.page : HRMS_HOME;
  const goTo = (pageId: string) => navigate(hrmsPath(pageId));

  return (
    <>
      <AppLayout
        activeTab={tab}
        setActiveTab={goTo}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        onRoleChangedGoDashboard={() => goTo(HRMS_HOME)}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
      >
        {screen.kind === 'hrms' && (
          // Keyed by role so every page remounts with fresh state after a role switch.
          <React.Fragment key={activeRole ?? 'none'}>
            {tab === 'dashboard' && <DashboardPage onNavigate={goTo} onOpenSlackModal={() => setIsSlackModalOpen(true)} />}
            {(tab === 'attendance' || tab === 'manual_attendance' || tab === 'od') && (
              <AttendanceManagementPage key={tab} initialTab={tab} />
            )}
            {(tab === 'leave' || tab === 'leave_balance') && (
              <LeaveManagementPage key={tab} onNavigate={goTo} initialTab={tab} />
            )}
            {tab === 'holiday_calendar' && <HolidayCalendarPage onNavigate={goTo} />}
            {(tab === 'profile' || tab === 'user_controls' || tab === 'transfers') && (
              <EmployeeProfilePage key={tab} initialTab={tab as 'profile' | 'user_controls' | 'transfers'} />
            )}
            {tab === 'master' && <MasterSettingsPage />}
          </React.Fragment>
        )}

        {screen.kind === 'module' && screen.module === 'pms' && <PMSView onReturnToLobby={() => setActiveModule('lobby')} />}
        {screen.kind === 'module' && screen.module === 'sims' && <InventoryView onReturnToLobby={() => setActiveModule('lobby')} />}
        {screen.kind === 'module' && screen.module === 'fms' && <FMSView onReturnToLobby={() => setActiveModule('lobby')} />}
        {screen.kind === 'module' && screen.module === 'finance' && <FinanceView onReturnToLobby={() => setActiveModule('lobby')} />}
      </AppLayout>

      <SessionTimeoutGuard />
      <SlackHubModal isOpen={isSlackModalOpen} onClose={() => setIsSlackModalOpen(false)} />
      <EmailToast />
      <LogoViewerModal
        isOpen={isLogoViewerOpen}
        onClose={() => setIsLogoViewerOpen(false)}
        onOpenMasterBranding={() => {
          if (screen.kind === 'hrms') goTo('master');
        }}
      />
    </>
  );
};

/**
 * Everything below is rebuilt when the signed-in user changes, so no data
 * held in memory for one user can ever be shown to the next one in this browser.
 */
const SessionScopedApp: React.FC = () => {
  const { session } = useSession();
  return (
    <AppProvider key={session?.user.id ?? 'signed-out'}>
      <AppContent />
    </AppProvider>
  );
};

export default function App() {
  return (
    <SessionProvider>
      <SessionScopedApp />
    </SessionProvider>
  );
}
