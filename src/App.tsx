import React, { useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SessionProvider, useSession } from './auth/SessionContext';
import { SessionTimeoutGuard } from './auth/SessionTimeoutGuard';
import { toUiModule } from './auth/access';
import { resolveRoute } from './auth/resolveRoute';
import { navigate, usePath } from './shared/router';
import { homePageFor, hrmsPath } from './modules/hrms/hrmsPages';
import { AppLayout } from './shared/layout';
import { DashboardPage } from './modules/hrms/dashboard/pages/DashboardPage';
import { AttendanceManagementPage } from './modules/hrms/attendance/pages/AttendanceManagementPage';
import { LeaveManagementPage } from './modules/hrms/leave/pages/LeaveManagementPage';
import { HolidayCalendarPage } from './modules/hrms/holidays/pages/HolidayCalendarPage';
import { MasterSettingsPage } from './modules/hrms/master/pages/MasterSettingsPage';
import { ReportsPage } from './modules/hrms/reports/pages/ReportsPage';
import { EmployeeProfilePage } from './modules/hrms/profile/pages/EmployeeProfilePage';
import { EmailToast } from './shared/components/EmailToast';
import { LogoViewerModal } from './shared/modals/LogoViewerModal';
import { LoginPage } from './auth/pages/LoginPage';
import { LobbyPage } from './lobby/pages/LobbyPage';
import { ChangePasswordPage } from './auth/pages/ChangePasswordPage';
import { ProjectsPage } from './modules/pms/ProjectsPage';
import { PmsMasterSettingsPage } from './modules/pms/PmsMasterSettingsPage';
import { ProjectSummaryStrip } from './modules/pms/components/ProjectSummaryStrip';
import { pmsHomeFor, pmsPath } from './modules/pms/pmsPages';
import { InventoryView } from './modules/inventory/InventoryView';
import { FMSView } from './modules/fms/FMSView';
import { FinanceView } from './modules/finance/FinanceView';
import { EnterpriseModuleId } from './types';
import { LoadingScreen } from './shared/components/LoadingScreen';
import { setExportContext } from './shared/services/printTable';
import { roleLabel } from './auth/access';

const AppContent: React.FC = () => {
  const { status, session, enterModule, exitModule } = useSession();
  const { currentUser, isLogoViewerOpen, setIsLogoViewerOpen, orgBranding } = useApp();
  const rawPath = usePath();

  // Report header of every PDF / CSV download: who downloads it, in which role, and for which organization.
  useEffect(() => {
    const user = session?.user;
    const role = session?.activeRole ? roleLabel(session.activeRole, session.activeModule) : null;
    setExportContext({
      organization: orgBranding?.orgName || 'Wildlife Institute of India',
      generatedBy: user ? `${user.name} (${user.biometricId})${role ? ` · ${role}` : ''}` : null,
    });
  }, [session?.user, session?.activeRole, orgBranding?.orgName]);
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
      navigate(hrmsPath(homePageFor(activeRole)), { replace: true });
    }
    if (before && activeRole && before !== activeRole && session?.activeModule === 'pms') {
      navigate(pmsPath(pmsHomeFor(activeRole)), { replace: true });
    }
  }, [activeRole, session?.activeModule]);

  if (screen.kind === 'loading') return <LoadingScreen />;
  if (screen.kind === 'login' || !currentUser) return <LoginPage />;
  if (screen.kind === 'changePassword') {
    return (
      <>
        <ChangePasswordPage first={screen.first} />
        <SessionTimeoutGuard />
      </>
    );
  }

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

  const activeModule: EnterpriseModuleId = screen.kind === 'hrms' ? 'lams' : screen.kind === 'pms' ? 'pms' : screen.module;
  const tab = screen.kind === 'hrms' || screen.kind === 'pms' ? screen.page : homePageFor(activeRole);
  const goTo = (pageId: string) => navigate(screen.kind === 'pms' ? pmsPath(pageId) : hrmsPath(pageId));
  const home = screen.kind === 'pms' ? pmsHomeFor(activeRole) : homePageFor(activeRole);

  return (
    <>
      <AppLayout
        activeTab={tab}
        setActiveTab={goTo}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        onRoleChangedGoDashboard={() => goTo(home)}
      >
        {screen.kind === 'hrms' && (
          // Keyed by role so every page remounts with fresh state after a role switch.
          <React.Fragment key={activeRole ?? 'none'}>
            {tab === 'dashboard' && <DashboardPage onNavigate={goTo} />}
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
            {tab === 'reports' && <ReportsPage />}
          </React.Fragment>
        )}

        {screen.kind === 'pms' && (
          // PMS: the HRMS screens with the same rules (the server limits them to PMS employees), and Projects.
          <React.Fragment key={activeRole ?? 'none'}>
            {tab === 'dashboard' && (
              <div className="space-y-5">
                <ProjectSummaryStrip onOpen={() => goTo('projects')} />
                <DashboardPage onNavigate={goTo} />
              </div>
            )}
            {(tab === 'attendance' || tab === 'manual_attendance' || tab === 'od') && (
              <AttendanceManagementPage key={`pms-${tab}`} initialTab={tab} />
            )}
            {(tab === 'leave' || tab === 'leave_balance') && (
              <LeaveManagementPage key={`pms-${tab}`} onNavigate={goTo} initialTab={tab} />
            )}
            {tab === 'holiday_calendar' && <HolidayCalendarPage onNavigate={goTo} />}
            {tab === 'profile' && <EmployeeProfilePage key="pms-profile" initialTab="profile" />}
            {tab === 'projects' && <ProjectsPage />}
            {tab === 'master' && <PmsMasterSettingsPage />}
          </React.Fragment>
        )}
        {screen.kind === 'module' && screen.module === 'sims' && <InventoryView onReturnToLobby={() => setActiveModule('lobby')} />}
        {screen.kind === 'module' && screen.module === 'fms' && <FMSView onReturnToLobby={() => setActiveModule('lobby')} />}
        {screen.kind === 'module' && screen.module === 'finance' && <FinanceView onReturnToLobby={() => setActiveModule('lobby')} />}
      </AppLayout>

      <SessionTimeoutGuard />
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
