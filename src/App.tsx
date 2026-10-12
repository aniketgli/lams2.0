import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
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

const AppContent: React.FC = () => {
  const [activeModule, setActiveModule] = useState<'lobby' | 'lams' | 'pms' | 'sims' | 'fms' | 'finance'>('lobby');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSlackModalOpen, setIsSlackModalOpen] = useState<boolean>(false);
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const {
    currentUser,
    isAuthenticated,
    isLogoViewerOpen,
    setIsLogoViewerOpen,
    logout
  } = useApp();

  if (!isAuthenticated || !currentUser) {
    return <LoginPage />;
  }

  const handleRoleChangedGoDashboard = () => {
    setActiveTab('dashboard');
  };

  const handleSelectModuleFromLobby = (modId: EnterpriseModuleId) => {
    setActiveModule(modId);
    if (modId === 'lams') {
      setActiveTab('dashboard');
    }
  };

  // When on Lobby, render clean standalone portal layout matching Pic 1
  if (activeModule === 'lobby') {
    return (
      <LobbyPage
        onSelectModule={handleSelectModuleFromLobby}
        onLogout={logout}
      />
    );
  }

  return (
    <>
      <AppLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        onRoleChangedGoDashboard={handleRoleChangedGoDashboard}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
      >
        {/* 1. Leave & Attendance Management (LAMS 2.0) */}
        {activeModule === 'lams' && (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                onNavigate={setActiveTab}
                onOpenSlackModal={() => setIsSlackModalOpen(true)}
              />
            )}
            {(activeTab === 'attendance' || activeTab === 'manual_attendance' || activeTab === 'od' || activeTab === 'attendance_management') && (
              <AttendanceManagementPage initialTab={activeTab} />
            )}
            {(activeTab === 'leave' || activeTab === 'leave_matrix' || activeTab === 'leave_balance') && (
              <LeaveManagementPage onNavigate={setActiveTab} initialTab={activeTab} />
            )}
            {activeTab === 'holiday_calendar' && <HolidayCalendarPage onNavigate={setActiveTab} />}
            {(activeTab === 'profile' || activeTab === 'roles' || activeTab === 'user_controls' || activeTab === 'transfers') && (
              <EmployeeProfilePage
                initialTab={
                  activeTab === 'roles' || activeTab === 'user_controls'
                    ? 'user_controls'
                    : activeTab === 'transfers'
                    ? 'transfers'
                    : 'profile'
                }
              />
            )}
            {activeTab === 'master' && currentUser.role === 'administrator' && <MasterSettingsPage />}
          </>
        )}

        {/* 2. Project Management System (WII-PMS) */}
        {activeModule === 'pms' && (
          <PMSView onReturnToLobby={() => setActiveModule('lobby')} />
        )}

        {/* 3. Stock & Inventory Management (WII-SIMS) */}
        {activeModule === 'sims' && (
          <InventoryView onReturnToLobby={() => setActiveModule('lobby')} />
        )}

        {/* 4. Facility & Campus Management (WII-FMS) */}
        {activeModule === 'fms' && (
          <FMSView onReturnToLobby={() => setActiveModule('lobby')} />
        )}

        {/* 5. Finance & TA/DA Claims (WII-FinPay) */}
        {activeModule === 'finance' && (
          <FinanceView onReturnToLobby={() => setActiveModule('lobby')} />
        )}
      </AppLayout>

      {/* Slack Integration Hub Modal */}
      <SlackHubModal isOpen={isSlackModalOpen} onClose={() => setIsSlackModalOpen(false)} />

      {/* Real-time Email Dispatch Toast Banner */}
      <EmailToast />

      {/* Organization Logo & Brand Viewer Modal */}
      <LogoViewerModal
        isOpen={isLogoViewerOpen}
        onClose={() => setIsLogoViewerOpen(false)}
        onOpenMasterBranding={() => {
          setActiveModule('lams');
          setActiveTab('master');
        }}
      />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
