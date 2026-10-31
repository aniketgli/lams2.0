import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { WIILogo } from '../components/WIILogo';
import { canOpenPage } from '../../modules/hrms/hrmsPages';
import {
  LayoutDashboard,
  Clock,
  MapPin,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  User,
  Users,
  Calendar,
  Sliders,
  ArrowLeftRight,
  FileSpreadsheet
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeModule: 'lobby' | 'lams' | 'pms' | 'sims' | 'fms' | 'finance';
  setActiveModule: (module: 'lobby' | 'lams' | 'pms' | 'sims' | 'fms' | 'finance') => void;
  onOpenSlackModal: () => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeModule,
  setActiveModule,
  isOpenMobile,
  setIsOpenMobile
}) => {
  const {
    currentUser,
    users,
    orgBranding,
    setIsLogoViewerOpen
  } = useApp();
  const [expandedGroup, setExpandedGroup] = useState<'attendance' | 'leave' | 'employee' | null>(null);

  // Which links appear comes from the same page map the router enforces.
  const show = (pageId: string) => canOpenPage(pageId, currentUser.role);

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setIsOpenMobile(false);
  };

  const isAttendanceActive = activeTab === 'attendance' || activeTab === 'manual_attendance' || activeTab === 'od';
  const isLeaveActive = activeTab === 'leave' || activeTab === 'leave_balance' || activeTab === 'leave_matrix' || activeTab === 'holiday_calendar';
  const isEmployeeActive = activeTab === 'profile' || activeTab === 'user_controls' || activeTab === 'transfers' || activeTab === 'roles';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Side Navbar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 lg:z-30 w-64 h-screen bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0 transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header / Primary Branding (Fixed 64px to match Header height precisely) */}
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center min-w-0 select-none py-1 pointer-events-none">
            <WIILogo variant="horizontal" size="md" />
          </div>

          <button
            onClick={() => setIsOpenMobile(false)}
            className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
            {/* If in LAMS: show LAMS 2.0 navigation items */}
            {activeModule === 'lams' && (
              <>
              

                {/* 1. Dashboard */}
                <button
                  onClick={() => {
                    setExpandedGroup(null);
                    handleNavClick('dashboard');
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-primary' : 'text-slate-400'}`} />
                  <span>Dashboard</span>
                </button>

                {/* 2. Attendance Management Accordion */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setExpandedGroup(expandedGroup === 'attendance' ? null : 'attendance');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      isAttendanceActive
                        ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                  <div className="flex items-center space-x-3 min-w-0">
                      <Clock className={`w-4 h-4 shrink-0 ${isAttendanceActive ? 'text-primary' : 'text-slate-400'}`} />
                      <span className="block truncate">Attendance Management</span>
                    </div>
                    {expandedGroup === 'attendance' ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {expandedGroup === 'attendance' && (
                    <div className="pl-3 space-y-0.5 pt-0.5 pb-1">
                      <button
                        onClick={() => handleNavClick('attendance')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                          activeTab === 'attendance'
                            ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Clock className={`w-4 h-4 shrink-0 ${activeTab === 'attendance' ? 'text-primary' : 'text-slate-400'}`} />
                        <span>Attendance</span>
                      </button>

                      <button
                        onClick={() => handleNavClick('manual_attendance')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                          activeTab === 'manual_attendance'
                            ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${activeTab === 'manual_attendance' ? 'text-primary' : 'text-slate-400'}`} />
                        <span>Manual Attendance</span>
                      </button>

                      <button
                        onClick={() => handleNavClick('od')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                          activeTab === 'od'
                            ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <MapPin className={`w-4 h-4 shrink-0 ${activeTab === 'od' ? 'text-primary' : 'text-slate-400'}`} />
                        <span>Outdoor Duty</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Leave & Holidays Accordion */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setExpandedGroup(expandedGroup === 'leave' ? null : 'leave');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      isLeaveActive
                        ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <FileText className={`w-4 h-4 shrink-0 ${isLeaveActive ? 'text-primary' : 'text-slate-400'}`} />
                      <span className="block truncate">Leave &amp; Holidays</span>
                    </div>
                    {expandedGroup === 'leave' ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {expandedGroup === 'leave' && (
                    <div className="pl-3 space-y-0.5 pt-0.5 pb-1">
                      <button
                        onClick={() => handleNavClick('leave')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                          activeTab === 'leave'
                            ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'leave' ? 'text-primary' : 'text-slate-400'}`} />
                        <span>Leaves</span>
                      </button>

                      {show('leave_balance') && (
                        <button
                          onClick={() => handleNavClick('leave_balance')}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                            activeTab === 'leave_balance' || activeTab === 'leave_matrix'
                              ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'leave_balance' || activeTab === 'leave_matrix' ? 'text-primary' : 'text-slate-400'}`} />
                          <span>Leave Balance</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleNavClick('holiday_calendar')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                          activeTab === 'holiday_calendar'
                            ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'holiday_calendar' ? 'text-primary' : 'text-slate-400'}`} />
                        <span>Holiday Calendar</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Employee Management: a group only when it has more than one page; otherwise the one page directly */}
                {!show('user_controls') && (
                  <button
                    onClick={() => {
                      setExpandedGroup(null);
                      handleNavClick('profile');
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <User className={`w-4 h-4 shrink-0 ${activeTab === 'profile' ? 'text-primary' : 'text-slate-400'}`} />
                    <span>Profiles</span>
                  </button>
                )}
                {show('user_controls') && (
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setExpandedGroup(expandedGroup === 'employee' ? null : 'employee');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      isEmployeeActive
                        ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <Users className={`w-4 h-4 shrink-0 ${isEmployeeActive ? 'text-primary' : 'text-slate-400'}`} />
                      <span className="block truncate">Employee Management</span>
                    </div>
                    {expandedGroup === 'employee' ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {expandedGroup === 'employee' && (
                    <div className="pl-3 space-y-0.5 pt-0.5 pb-1">
                      <button
                        onClick={() => handleNavClick('profile')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                          activeTab === 'profile'
                            ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <User className={`w-4 h-4 shrink-0 ${activeTab === 'profile' ? 'text-primary' : 'text-slate-400'}`} />
                        <span>Profiles</span>
                      </button>

                      {show('user_controls') && (
                        <>
                          <button
                            onClick={() => handleNavClick('user_controls')}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                              activeTab === 'user_controls' || activeTab === 'roles'
                                ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === 'user_controls' || activeTab === 'roles' ? 'text-primary' : 'text-slate-400'}`} />
                            <span>User Controls &amp; Roles</span>
                          </button>

                          <button
                            onClick={() => handleNavClick('transfers')}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                              activeTab === 'transfers'
                                ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <ArrowLeftRight className={`w-4 h-4 shrink-0 ${activeTab === 'transfers' ? 'text-primary' : 'text-slate-400'}`} />
                            <span>Employees Mapping</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* 5. Master Settings (For Administrator & Audit) */}
                {show('master') && (
                  <button
                    onClick={() => {
                      setExpandedGroup(null);
                      handleNavClick('master');
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      activeTab === 'master'
                        ? 'bg-primary/10 text-primary font-bold border-l-3 border-primary shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className={`w-4 h-4 shrink-0 ${activeTab === 'master' ? 'text-primary' : 'text-slate-400'}`} />
                    <span>Master Settings</span>
                  </button>
                )}
              </>
            )}
          </nav>
        </div>

        {/* Bottom Section: Developed by IT Cell */}
        <div className="min-h-[52px] sm:h-14 px-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-center shrink-0">
          <p className="text-[11px] font-semibold text-slate-500 tracking-wide text-center">
            Developed by <span className="font-extrabold text-slate-800">IT Cell</span>
          </p>
        </div>
      </aside>
    </>
  );
};
