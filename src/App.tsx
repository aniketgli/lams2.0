import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './shared/layout/Sidebar';
import { Header } from './shared/layout/Header';
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
import { EnterpriseModuleId, formatOrgAddress } from './types';
import { MapPin } from 'lucide-react';

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
    logout,
    orgBranding
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
    <div className="h-screen w-full bg-slate-50 text-slate-900 font-sans flex overflow-hidden">
      {/* Side Navbar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Header Bar (Fixed) */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isOpenMobile={isOpenMobile}
          setIsOpenMobile={setIsOpenMobile}
          onRoleChangedGoDashboard={handleRoleChangedGoDashboard}
        />

        {/* Scrollable View Content Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full max-w-[1700px] mx-auto">
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

            {/* 3. Project Management System (WII-PMS) */}
            {activeModule === 'pms' && (
              <PMSView onReturnToLobby={() => setActiveModule('lobby')} />
            )}

            {/* 4. Stock & Inventory Management (WII-SIMS) */}
            {activeModule === 'sims' && (
              <InventoryView onReturnToLobby={() => setActiveModule('lobby')} />
            )}

            {/* 5. Facility & Campus Management (WII-FMS) */}
            {activeModule === 'fms' && (
              <FMSView onReturnToLobby={() => setActiveModule('lobby')} />
            )}

            {/* 6. Finance & TA/DA Claims (WII-FinPay) */}
            {activeModule === 'finance' && (
              <FinanceView onReturnToLobby={() => setActiveModule('lobby')} />
            )}
          </main>

          {/* Footer */}
          <footer className="py-2.5 sm:py-0 min-h-[52px] sm:h-14 bg-white border-t border-slate-200 text-slate-500 text-xs mt-auto px-4 sm:px-6 shrink-0 flex items-center">
            <div className="w-full max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
              <p className="font-medium text-slate-600">
                {orgBranding?.copyrightText || `© ${new Date().getFullYear()} ${orgBranding?.orgName || 'Wildlife Institute of India'} • Integrated Enterprise Suite (WII-ERP)`}
              </p>
              <div className="flex items-center space-x-1.5 text-slate-600 font-medium text-[11px] sm:text-xs">
                <MapPin className="w-3.5 h-3.5 text-[#701618] shrink-0" />
                <span>{formatOrgAddress(orgBranding)}</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

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
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
