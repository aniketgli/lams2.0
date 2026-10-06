import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  EmploymentType,
  AttendanceRecord,
  OutdoorDutyRequest,
  LeaveRequest,
  LeaveType,
  LeavePolicyRule,
  JoiningReport,
  SlackConfig,
  SlackNotification,
  UserTransferLog,
  ManualAttendanceRegularizationRequest,
  OrgBranding,
  UserProjectHistory,
  Shift,
  ShiftTimingCalculation,
  evaluateAttendanceByShift,
  UserModuleRoles,
  EnterpriseModuleId,
  getUserModuleRoles,
  EmailConfig,
  EmailNotificationLog,
  EmailDeliveryStatus,
  EmailCategory
} from '../types';
import { INITIAL_USERS, INITIAL_SLACK_CONFIG } from '../shared/data/coreUsersSeedData';
import {
  INITIAL_SHIFTS,
  INITIAL_LEAVE_POLICIES,
  INITIAL_OD_REQUESTS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_MANUAL_ATTENDANCE_REQUESTS,
  generateSeedAttendance,
  generateTodayAttendanceRecords
} from '../modules/hrms/data/hrmsSeedData';
import { INITIAL_PROJECT_HISTORIES } from '../modules/hrms/profile/data/projectHistoryData';
import { INITIAL_HOLIDAYS, HolidayItem } from '../modules/hrms/holidays/data/holidayData';
import { sendSlackNotification, buildLeaveSlackBlock, buildODSlackBlock } from '../shared/services/slackService';
import {
  DEFAULT_EMAIL_CONFIG,
  INITIAL_EMAIL_LOGS,
  dispatchSystemEmail,
  buildUserWelcomeEmail,
  buildSupervisorNewReporteeEmail,
  buildLeaveAppliedEmail,
  buildLeaveForwardedL2Email,
  buildLeaveApprovedEmail,
  buildLeaveRejectedEmail,
  buildManualAttendanceAppliedEmail,
  buildManualAttendanceApprovedEmail,
  buildManualAttendanceRejectedEmail,
  buildODAppliedEmail,
  buildODApprovedEmail,
  buildODRejectedEmail,
  buildTransferOrderEmail,
  buildManagerMigrationEmail,
  buildRelievingManagerNoticeEmail,
  buildReporteeManagerTransitionEmail,
  buildPasswordResetEmail,
  wrapOfficialEmailHtml
} from '../shared/services/emailService';

interface AppContextType {
  currentUser: User;
  users: User[];
  isAuthenticated: boolean;
  login: (email: string, password?: string) => { success: boolean; message: string };
  loginAsUser: (userId: string) => void;
  logout: () => void;
  setCurrentUserId: (id: string) => void;
  switchRoleOverride: (role: UserRole) => void;
  attendanceRecords: AttendanceRecord[];
  manualAttendanceRequests: ManualAttendanceRegularizationRequest[];
  odRequests: OutdoorDutyRequest[];
  leaveRequests: LeaveRequest[];
  leavePolicies: LeavePolicyRule[];
  updateLeavePolicy: (type: LeaveType, updated: Partial<LeavePolicyRule>) => { success: boolean; message: string };
  addLeavePolicy: (policy: LeavePolicyRule) => { success: boolean; message: string };
  deleteLeavePolicy: (type: LeaveType) => { success: boolean; message: string };
  toggleEmployeeTypeForLeave: (leaveType: LeaveType, empType: EmploymentType) => void;
  resetLeavePoliciesToDefault: () => void;
  slackConfig: SlackConfig;
  slackLogs: SlackNotification[];

  // Shift Management & Dynamic Attendance Calculation
  shifts: Shift[];
  addShift: (data: Omit<Shift, 'id'>) => { success: boolean; message: string; shift?: Shift };
  updateShift: (id: string, data: Partial<Shift>) => { success: boolean; message: string };
  deleteShift: (id: string) => { success: boolean; message: string };
  setDefaultShift: (id: string) => { success: boolean; message: string };
  assignUserShift: (userId: string, shiftId: string) => { success: boolean; message: string };
  bulkAssignUserShift: (userIds: string[], shiftId: string) => { success: boolean; message: string };
  getUserShift: (userId: string) => Shift;
  calculateShiftTiming: (clockIn?: string, clockOut?: string, shift?: Shift, workMode?: AttendanceRecord['workMode']) => ShiftTimingCalculation;

  // Attendance Actions
  clockInToday: (mode: AttendanceRecord['workMode'], location?: string) => void;
  clockOutToday: () => void;
  getVisibleAttendanceRecords: () => AttendanceRecord[];

  // Manual Attendance Actions
  applyManualAttendance: (data: {
    date: string;
    inTime: string;
    outTime: string;
    reason: string;
    reasonCategory?: string;
    targetUserId?: string;
    originalInTime?: string;
    originalOutTime?: string;
  }) => { success: boolean; message: string };
  editManualAttendance: (
    id: string,
    data: {
      date: string;
      inTime: string;
      outTime: string;
      reason: string;
      reasonCategory?: string;
      originalInTime?: string;
      originalOutTime?: string;
    }
  ) => { success: boolean; message: string };
  deleteManualAttendance: (id: string) => { success: boolean; message: string };
  approveRejectManualAttendance: (id: string, action: 'approve' | 'reject', comments?: string) => { success: boolean; message: string };
  cancelApprovedManualAttendance: (id: string, reason?: string) => { success: boolean; message: string };

  // OD Actions
  applyOutdoorDuty: (data: {
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    odType?: 'Domestic' | 'International';
    location: string;
    estimatedFunds?: number;
    fundingSource?: string;
    purpose: string;
    targetUserId?: string;
  }) => { success: boolean; message: string };
  editOutdoorDuty: (
    id: string,
    data: {
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      odType?: 'Domestic' | 'International';
      location: string;
      estimatedFunds?: number;
      fundingSource?: string;
      purpose: string;
    }
  ) => { success: boolean; message: string };
  deleteOutdoorDuty: (id: string) => { success: boolean; message: string };
  approveOutdoorDuty: (id: string, comments?: string) => { success: boolean; message: string };
  rejectOutdoorDuty: (id: string, comments?: string) => { success: boolean; message: string };
  cancelApprovedOutdoorDuty: (id: string, reason?: string) => { success: boolean; message: string };

  // Leave Actions
  applyLeave: (data: {
    leaveType: any;
    startDate: string;
    endDate: string;
    reason: string;
    targetUserId?: string;
    ltcType?: 'none' | 'ltc' | 'ex_india';
    stationAddress?: string;
    encashLtc?: boolean;
    encashDays?: number;
    isCommuted?: boolean;
    prescriptionUrl?: string;
    prescriptionFileName?: string;
  }) => { success: boolean; message: string };
  editLeave: (id: string, data: { startDate: string; endDate: string; reason: string }) => { success: boolean; message: string };
  deleteLeave: (id: string) => { success: boolean; message: string };
  approveLeaveLevel1: (id: string, comments?: string) => { success: boolean; message: string };
  rejectLeaveLevel1: (id: string, comments?: string) => { success: boolean; message: string };
  approveLeaveLevel2: (id: string, comments?: string) => { success: boolean; message: string };
  rejectLeaveLevel2: (id: string, comments?: string) => { success: boolean; message: string };
  submitJoiningReport: (
    leaveId: string,
    reportData: {
      joiningDate: string;
      joiningSession: 'FN' | 'AN';
      stationReturned: boolean;
      remarks?: string;
      fitnessCertificateAttached?: boolean;
      fitnessCertificateName?: string;
      fitnessCertificateUrl?: string;
    }
  ) => { success: boolean; message: string };
  forwardJoiningReport: (
    leaveId: string,
    remarks?: string
  ) => { success: boolean; message: string };
  verifyJoiningReport: (
    leaveId: string,
    status: 'accepted' | 'rejected',
    remarks?: string
  ) => { success: boolean; message: string };
  updateUserLeaveBalance: (
    userId: string,
    leaveType: string,
    total: number,
    used: number,
    pending: number,
    year?: string,
    carryForward?: number
  ) => { success: boolean; message: string };
  bulkImportLeaveBalances: (
    records: Array<{
      userId: string;
      leaveType: string;
      total: number;
      used: number;
      pending: number;
      year: string;
      carryForward?: number;
    }>
  ) => { success: boolean; updatedCount: number; message: string };
  batchUpdateLeaveBalances: (
    records: Array<{
      userId: string;
      year: string;
      leaveType: string;
      total: number;
      used: number;
      pending: number;
      carryForward?: number;
    }>
  ) => { success: boolean; updatedCount: number; message: string };
  reconcileLeaveBalances: (
    targetYear?: string
  ) => { success: boolean; reconciledUsers: number; discrepanciesFixed: number; message: string };
  runYearEndLeaveRoll: (
    fromYear: string,
    toYear: string
  ) => { success: boolean; processedCount: number; message: string };

  // Admin / Profile Actions
  updateUserProfile: (userId: string, updatedFields: Partial<User>) => void;
  addUserProfile: (newUser: Omit<User, 'id' | 'leaveBalances'>) => User;
  updateUserRoleAndHierarchy: (
    userId: string,
    role: UserRole,
    employmentType: EmploymentType,
    reportingManagerId?: string,
    reviewingManagerId?: string,
    roles?: UserRole[]
  ) => void;
  toggleUserStatus: (userId: string, reason?: string, effectiveDate?: string) => void;
  deleteUser: (userId: string) => void;
  resetUserPassword: (userId: string, customPass?: string, reason?: string) => string;
  transferUser: (
    userId: string,
    data: {
      newDept: string;
      newReportingManagerId?: string;
      newReviewingManagerId?: string;
      newLocation?: string;
      effectiveDate: string;
      notes: string;
    }
  ) => void;
  bulkTransferUsers: (
    userIds: string[],
    data: {
      newDept?: string;
      newReportingManagerId?: string;
      newReviewingManagerId?: string;
      newLocation?: string;
      effectiveDate: string;
      notes: string;
    }
  ) => { success: boolean; count: number; message: string };
  bulkReassignManager: (data: {
    outgoingManagerId: string;
    incomingManagerId: string;
    reassignType: 'reporting' | 'reviewing' | 'both';
    selectedUserIds?: string[];
    effectiveDate: string;
    notes: string;
  }) => { success: boolean; count: number; message: string };
  transferLogs: UserTransferLog[];
  updateSlackConfig: (newConfig: SlackConfig) => void;
  resetAllData: () => void;

  // Holiday Management Actions (Admin)
  holidays: HolidayItem[];
  addHoliday: (data: Omit<HolidayItem, 'id' | 'year' | 'month' | 'dayOfWeek'> & Partial<Pick<HolidayItem, 'year' | 'month' | 'dayOfWeek' | 'isLongWeekend'>>) => { success: boolean; message: string; holiday?: HolidayItem };
  updateHoliday: (id: string, updatedFields: Partial<HolidayItem>) => { success: boolean; message: string };
  deleteHoliday: (id: string) => { success: boolean; message: string };
  resetHolidays: () => void;

  // Organization Branding & Logo Management
  orgBranding: OrgBranding;
  updateOrgBranding: (branding: Partial<OrgBranding>) => void;
  resetOrgBranding: () => void;

  // Logo Viewer Modal State
  isLogoViewerOpen: boolean;
  setIsLogoViewerOpen: (open: boolean) => void;

  // User Project & Career History Actions
  projectHistories: UserProjectHistory[];
  addProjectHistory: (data: Omit<UserProjectHistory, 'id'>) => { success: boolean; message: string };
  updateProjectHistory: (id: string, data: Partial<UserProjectHistory>) => { success: boolean; message: string };
  deleteProjectHistory: (id: string) => { success: boolean; message: string };
  getUserProjectHistories: (userId: string) => UserProjectHistory[];

  // Multi-Module Role Controls
  updateUserModuleRoles: (userId: string, moduleRoles: UserModuleRoles) => { success: boolean; message: string };
  toggleUserModuleRole: (userId: string, moduleId: EnterpriseModuleId, roleId: string) => { success: boolean; message: string };
  bulkAssignModuleRole: (userIds: string[], moduleId: EnterpriseModuleId, roleId: string) => { success: boolean; message: string };

  // Automated System-Wide Email Notifications & Outbox Audit
  emailConfig: EmailConfig;
  updateEmailConfig: (newConfig: EmailConfig) => void;
  emailLogs: EmailNotificationLog[];
  addEmailLog: (log: EmailNotificationLog) => void;
  clearEmailLogs: () => void;
  resendEmail: (logId: string) => Promise<{ success: boolean; message: string }>;
  latestEmailToast: { id: string; to: string; subject: string; status: EmailDeliveryStatus } | null;
  dismissEmailToast: () => void;
  sendCustomEmail: (to: string, toName: string, subject: string, message: string) => Promise<{ success: boolean; message: string }>;
  testSmtpConnection: (config: EmailConfig) => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Version key to ensure updated rich seed data is refreshed
  const SEED_VERSION_KEY = 'la_hub_seed_v11_el_joining_test';

  // Load initial states from localStorage or use updated rich seed data
  const [users, setUsers] = useState<User[]>(() => {
    const isLatestSeed = localStorage.getItem(SEED_VERSION_KEY);
    if (!isLatestSeed) {
      localStorage.setItem(SEED_VERSION_KEY, 'true');
      return INITIAL_USERS;
    }
    const saved = localStorage.getItem('la_hub_users');
    return saved && JSON.parse(saved).length >= INITIAL_USERS.length ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('la_hub_current_user_id') || 'usr-1'; // Default Dr. Rajesh Sharma (Admin)
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedAuth = localStorage.getItem('la_hub_is_authenticated');
    return savedAuth !== null ? savedAuth === 'true' : false;
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const isLatestSeed = localStorage.getItem(SEED_VERSION_KEY);
    const todayStr = new Date().toISOString().split('T')[0];
    const initialRecords = generateSeedAttendance();
    if (!isLatestSeed) return initialRecords;
    const saved = localStorage.getItem('la_hub_attendance');
    if (saved) {
      try {
        const parsed: AttendanceRecord[] = JSON.parse(saved);
        if (parsed.length >= 100) {
          if (!parsed.some((r) => r.date === todayStr)) {
            const todayRecords = generateTodayAttendanceRecords(INITIAL_USERS, todayStr);
            const merged = [...parsed, ...todayRecords];
            localStorage.setItem('la_hub_attendance', JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      } catch {
        // Fall back to initial records
      }
    }
    return initialRecords;
  });

  const [manualAttendanceRequests, setManualAttendanceRequests] = useState<ManualAttendanceRegularizationRequest[]>(() => {
    const isLatestSeed = localStorage.getItem(SEED_VERSION_KEY);
    if (!isLatestSeed) return INITIAL_MANUAL_ATTENDANCE_REQUESTS;
    const saved = localStorage.getItem('la_hub_manual_attendance_requests');
    return saved && JSON.parse(saved).length >= INITIAL_MANUAL_ATTENDANCE_REQUESTS.length ? JSON.parse(saved) : INITIAL_MANUAL_ATTENDANCE_REQUESTS;
  });

  const [odRequests, setOdRequests] = useState<OutdoorDutyRequest[]>(() => {
    const isLatestSeed = localStorage.getItem(SEED_VERSION_KEY);
    if (!isLatestSeed) return INITIAL_OD_REQUESTS;
    const saved = localStorage.getItem('la_hub_od_requests');
    return saved && JSON.parse(saved).length >= INITIAL_OD_REQUESTS.length ? JSON.parse(saved) : INITIAL_OD_REQUESTS;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const isLatestSeed = localStorage.getItem(SEED_VERSION_KEY);
    if (!isLatestSeed) return INITIAL_LEAVE_REQUESTS;
    const saved = localStorage.getItem('la_hub_leave_requests');
    return saved && JSON.parse(saved).length >= INITIAL_LEAVE_REQUESTS.length ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
  });

  const [leavePolicies, setLeavePolicies] = useState<LeavePolicyRule[]>(() => {
    const isLatestSeed = localStorage.getItem(SEED_VERSION_KEY);
    if (!isLatestSeed) return INITIAL_LEAVE_POLICIES;
    const saved = localStorage.getItem('la_hub_leave_policies_v3');
    return saved ? JSON.parse(saved) : INITIAL_LEAVE_POLICIES;
  });

  useEffect(() => {
    localStorage.setItem('la_hub_leave_policies_v3', JSON.stringify(leavePolicies));
  }, [leavePolicies]);

  const updateLeavePolicy = (type: LeaveType, updated: Partial<LeavePolicyRule>) => {
    if (currentUser.role !== 'administrator') {
      return { success: false, message: 'Only Administrators can configure Leave Policies.' };
    }
    setLeavePolicies((prev) =>
      prev.map((p) => (p.type === type ? { ...p, ...updated } : p))
    );
    return { success: true, message: `Leave policy for ${type} updated successfully.` };
  };

  const addLeavePolicy = (policy: LeavePolicyRule) => {
    if (currentUser.role !== 'administrator') {
      return { success: false, message: 'Only Administrators can configure Leave Policies.' };
    }
    if (leavePolicies.some((p) => p.type === policy.type)) {
      return { success: false, message: `A leave policy for '${policy.type}' already exists.` };
    }
    setLeavePolicies((prev) => [...prev, policy]);
    return { success: true, message: `New leave policy '${policy.name}' created successfully.` };
  };

  const deleteLeavePolicy = (type: LeaveType) => {
    if (currentUser.role !== 'administrator') {
      return { success: false, message: 'Only Administrators can delete Leave Policies.' };
    }
    if (['casual', 'earned', 'half_pay', 'restricted', 'station'].includes(type)) {
      return { success: false, message: 'Core statutory leave types cannot be deleted. You can restrict their quota or eligible roles instead.' };
    }
    setLeavePolicies((prev) => prev.filter((p) => p.type !== type));
    return { success: true, message: 'Leave policy deleted successfully.' };
  };

  const toggleEmployeeTypeForLeave = (leaveType: LeaveType, empType: EmploymentType) => {
    if (currentUser.role !== 'administrator') return;
    setLeavePolicies((prev) =>
      prev.map((pol) => {
        if (pol.type !== leaveType) return pol;
        const exists = pol.allowedEmploymentTypes.includes(empType);
        const updatedTypes = exists
          ? pol.allowedEmploymentTypes.filter((t) => t !== empType)
          : [...pol.allowedEmploymentTypes, empType];
        return {
          ...pol,
          allowedEmploymentTypes: updatedTypes
        };
      })
    );
  };

  const resetLeavePoliciesToDefault = () => {
    if (currentUser.role !== 'administrator') return;
    setLeavePolicies(INITIAL_LEAVE_POLICIES);
    localStorage.removeItem('la_hub_leave_policies_v3');
  };

  const [shifts, setShifts] = useState<Shift[]>(() => {
    const isLatestSeed = localStorage.getItem(SEED_VERSION_KEY);
    if (!isLatestSeed) return INITIAL_SHIFTS;
    const saved = localStorage.getItem('la_hub_shifts_v2');
    return saved ? JSON.parse(saved) : INITIAL_SHIFTS;
  });

  useEffect(() => {
    localStorage.setItem('la_hub_shifts_v2', JSON.stringify(shifts));
  }, [shifts]);

  const [slackConfig, setSlackConfig] = useState<SlackConfig>(() => {
    const saved = localStorage.getItem('la_hub_slack_config');
    return saved ? JSON.parse(saved) : INITIAL_SLACK_CONFIG;
  });

  const [slackLogs, setSlackLogs] = useState<SlackNotification[]>(() => {
    const saved = localStorage.getItem('la_hub_slack_logs');
    return saved ? JSON.parse(saved) : [
      {
        id: 'slk-init-1',
        timestamp: '09:00:00',
        channel: '#leave-and-attendance-logs',
        sender: 'System Bot',
        title: '🔔 Slack Integration Operational',
        message: 'Leave & Biometric Attendance Automation Bot is online and syncing with Biometric Terminals BIO-GATE-01 to 04.',
        type: 'system',
        deliveredStatus: 'simulated'
      },
      {
        id: 'slk-init-2',
        timestamp: '10:15:30',
        channel: '#leave-and-attendance-logs',
        sender: 'Anita Roy',
        title: '✅ OD Approved: Priya Verma',
        message: 'Requisition #OD-102 for State Biodiversity Board HQ, New Delhi approved. Duration: 2 Days.',
        type: 'od',
        deliveredStatus: 'sent'
      },
      {
        id: 'slk-init-3',
        timestamp: '11:45:10',
        channel: '#leave-and-attendance-logs',
        sender: 'Dr. Rajesh Sharma',
        title: '📋 Leave Sanctioned: Dr. Sunita Rao',
        message: 'Commuted Leave (5 Days) approved on medical certificate per CCS Leave Rule 30.',
        type: 'leave',
        deliveredStatus: 'sent'
      },
      {
        id: 'slk-init-4',
        timestamp: '14:30:00',
        channel: '#leave-and-attendance-logs',
        sender: 'Biometric Daemon',
        title: '⚠️ Biometric Anomaly Detected',
        message: 'Terminal #BIO-GATE-02 recorded 3 consecutive facial timeout errors due to optical glare during rain.',
        type: 'attendance',
        deliveredStatus: 'sent'
      }
    ];
  });

  const [projectHistories, setProjectHistories] = useState<UserProjectHistory[]>(() => {
    const saved = localStorage.getItem('la_hub_project_histories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_PROJECT_HISTORIES;
  });

  useEffect(() => {
    localStorage.setItem('la_hub_project_histories', JSON.stringify(projectHistories));
  }, [projectHistories]);
  const [transferLogs, setTransferLogs] = useState<UserTransferLog[]>(() => {
    const saved = localStorage.getItem('la_hub_transfer_logs');
    return saved ? JSON.parse(saved) : [
      {
        id: 'trf-101',
        userId: 'usr-3',
        userName: 'Vikram Singh',
        previousDept: 'Ecology & Biodiversity',
        newDept: 'Research & Development',
        previousManagerName: 'Dr. Rajesh Sharma',
        newManagerName: 'Dr. Rajesh Sharma',
        effectiveDate: '2026-08-01',
        notes: 'Promoted to Director of Research & statutory R&D portfolio reallocation.',
        transferredBy: 'Dr. Rajesh Sharma (Admin)',
        timestamp: '2026-08-01 10:30'
      },
      {
        id: 'trf-102',
        userId: 'usr-10',
        userName: 'Neha Joshi',
        previousDept: 'Wildlife Ecology & Research',
        newDept: 'Climate Change & Spatial Ecology',
        previousManagerName: 'Anita Roy',
        newManagerName: 'Dr. Sunita Rao',
        effectiveDate: '2026-07-15',
        notes: 'Deputed to National Mission on Himalayan Studies (NMHS) specialized research group.',
        transferredBy: 'Dr. Rajesh Sharma (Admin)',
        timestamp: '2026-07-15 14:15'
      },
      {
        id: 'trf-103',
        userId: 'usr-12',
        userName: 'Kavita Deshmukh',
        previousDept: 'Administration Section',
        newDept: 'Ecodevelopment & Community',
        previousManagerName: 'Dr. Rajesh Sharma',
        newManagerName: 'Dr. Sunita Rao',
        effectiveDate: '2026-07-01',
        notes: 'Project associate transfer to community forest outreach initiative.',
        transferredBy: 'Dr. Rajesh Sharma (Admin)',
        timestamp: '2026-07-01 11:00'
      }
    ];
  });

  // Organization Branding State
  const DEFAULT_ORG_BRANDING: OrgBranding = {
    orgName: 'Wildlife Institute of India',
    logoUrl: '',
    address: 'Chandrabani, Dehradun - 248001, Uttarakhand, India',
    copyrightText: '© 2026 Wildlife Institute of India • Integrated Enterprise Suite',
    appName: 'LAMS 2.0 Enterprise Portal',
    orgHindiName: '',
    badgeText: 'HUB',
    logoType: 'custom',
    themePrimaryColor: '#701618',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Administrator'
  };

  const [orgBranding, setOrgBranding] = useState<OrgBranding>(() => {
    const saved = localStorage.getItem('la_hub_org_branding');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_ORG_BRANDING, ...parsed };
      } catch (e) {
        return DEFAULT_ORG_BRANDING;
      }
    }
    return DEFAULT_ORG_BRANDING;
  });

  const [isLogoViewerOpen, setIsLogoViewerOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('la_hub_org_branding', JSON.stringify(orgBranding));
  }, [orgBranding]);

  const updateOrgBranding = (branding: Partial<OrgBranding>) => {
    setOrgBranding((prev) => ({
      ...prev,
      ...branding,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser ? currentUser.name : 'Administrator'
    }));
  };

  const resetOrgBranding = () => {
    setOrgBranding(DEFAULT_ORG_BRANDING);
    localStorage.removeItem('la_hub_org_branding');
  };

  // --- AUTOMATED EMAIL NOTIFICATION SYSTEM STATE & CONFIG ---
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() => {
    const saved = localStorage.getItem('la_hub_email_config_v2');
    return saved ? { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(saved) } : DEFAULT_EMAIL_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('la_hub_email_config_v2', JSON.stringify(emailConfig));
  }, [emailConfig]);

  const updateEmailConfig = (newConfig: EmailConfig) => {
    setEmailConfig(newConfig);
  };

  const [emailLogs, setEmailLogs] = useState<EmailNotificationLog[]>(() => {
    const saved = localStorage.getItem('la_hub_email_logs_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_EMAIL_LOGS;
  });

  useEffect(() => {
    localStorage.setItem('la_hub_email_logs_v2', JSON.stringify(emailLogs));
  }, [emailLogs]);

  const [latestEmailToast, setLatestEmailToast] = useState<{ id: string; to: string; subject: string; status: EmailDeliveryStatus } | null>(null);

  const addEmailLog = (log: EmailNotificationLog) => {
    setEmailLogs((prev) => [log, ...prev]);
  };

  const clearEmailLogs = () => {
    setEmailLogs([]);
    localStorage.removeItem('la_hub_email_logs_v2');
  };

  const dismissEmailToast = () => {
    setLatestEmailToast(null);
  };

  // Internal dispatch helper used across workflows
  const triggerEmailDispatch = async (payload: {
    to: string;
    toName: string;
    toRole?: string;
    cc?: string[];
    subject: string;
    category: EmailCategory;
    eventType: string;
    bodyHtml: string;
    bodyText: string;
    referenceId?: string;
    referenceType?: 'leave' | 'od' | 'manual_attendance' | 'user' | 'transfer';
    meta?: Record<string, any>;
  }) => {
    if (!emailConfig.enableEmailNotifications) {
      return;
    }
    try {
      await dispatchSystemEmail(
        payload,
        emailConfig,
        (newLog) => {
          setEmailLogs((prev) => [newLog, ...prev]);
        },
        (toastInfo) => {
          setLatestEmailToast({
            id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            to: toastInfo.to,
            subject: toastInfo.subject,
            status: toastInfo.status
          });
          setTimeout(() => {
            setLatestEmailToast((curr) => (curr?.to === toastInfo.to ? null : curr));
          }, 6000);
        }
      );
    } catch (err) {
      console.warn('System email notification trigger caught error:', err);
    }
  };

  const resendEmail = async (logId: string): Promise<{ success: boolean; message: string }> => {
    const target = emailLogs.find((l) => l.id === logId);
    if (!target) return { success: false, message: 'Email log record not found.' };

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: target.to,
          toName: target.toName,
          subject: `[Resent] ${target.subject}`,
          html: target.bodyHtml,
          text: target.bodyText,
          category: target.category,
          eventType: `RESENT_${target.eventType}`,
          referenceId: target.referenceId,
          referenceType: target.referenceType,
          smtpConfig: emailConfig.smtpHost ? emailConfig : undefined
        })
      });
      const data = await res.json();
      
      const updatedLog: EmailNotificationLog = {
        ...target,
        id: `mail-resend-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        status: data.delivered ? 'delivered' : 'sent',
        errorMessage: data.warning || undefined,
        retryCount: (target.retryCount || 0) + 1
      };
      setEmailLogs((prev) => [updatedLog, ...prev]);

      setLatestEmailToast({
        id: `toast-resend-${Date.now()}`,
        to: target.to,
        subject: target.subject,
        status: updatedLog.status
      });

      return {
        success: true,
        message: data.delivered ? `Email re-dispatched successfully to ${target.to}` : `Email queued in simulated mode (${data.warning || 'Logged in Outbox'})`
      };
    } catch (err: any) {
      return { success: false, message: `Failed to re-send email: ${err.message}` };
    }
  };

  const sendCustomEmail = async (to: string, toName: string, subject: string, message: string): Promise<{ success: boolean; message: string }> => {
    if (!to || !to.includes('@')) {
      return { success: false, message: 'Invalid recipient email address.' };
    }

    const htmlContent = wrapOfficialEmailHtml({
      title: subject,
      badgeText: 'Official Communication',
      badgeBg: '#701618',
      recipientName: toName || 'Colleague',
      leadParagraph: message,
      detailsTable: [
        { label: 'Sender', value: `${currentUser.name} (${currentUser.designation})` },
        { label: 'Dispatched At', value: new Date().toLocaleString() }
      ],
      remarksBox: {
        title: 'Institutional Memorandum',
        text: 'This is an official administrative transmission issued via WII ERP Suite.',
        alertType: 'info'
      }
    });

    try {
      await triggerEmailDispatch({
        to,
        toName: toName || to,
        toRole: 'Recipient',
        cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
        subject: subject || 'Notification from Wildlife Institute of India',
        category: 'general_notice',
        eventType: 'CUSTOM_EMAIL_DISPATCH',
        bodyHtml: htmlContent,
        bodyText: message
      });
      return { success: true, message: `Email dispatched to ${to}` };
    } catch (err: any) {
      return { success: false, message: `Error sending email: ${err.message}` };
    }
  };

  const testSmtpConnection = async (testConfig: EmailConfig): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/email/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig)
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, message: `SMTP connection failed: ${err.message}` };
    }
  };

  useEffect(() => {
    localStorage.setItem('la_hub_transfer_logs', JSON.stringify(transferLogs));
  }, [transferLogs]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('la_hub_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('la_hub_current_user_id', currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem('la_hub_is_authenticated', String(isAuthenticated));
  }, [isAuthenticated]);

  const login = (email: string, _password?: string) => {
    const matchedUser = users.find(
      (u) => u.email.toLowerCase().trim() === email.toLowerCase().trim()
    );
    if (matchedUser) {
      if (matchedUser.status === 'deactivated') {
        return { success: false, message: 'This account has been deactivated by the Administrator.' };
      }
      setCurrentUserId(matchedUser.id);
      setIsAuthenticated(true);
      return { success: true, message: `Welcome back, ${matchedUser.name}!` };
    }
    return { success: false, message: 'Invalid credentials. No user registered with this email.' };
  };

  const loginAsUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUserId(target.id);
      setIsAuthenticated(true);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  useEffect(() => {
    localStorage.setItem('la_hub_attendance', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('la_hub_manual_attendance_requests', JSON.stringify(manualAttendanceRequests));
  }, [manualAttendanceRequests]);

  useEffect(() => {
    localStorage.setItem('la_hub_od_requests', JSON.stringify(odRequests));
  }, [odRequests]);

  useEffect(() => {
    localStorage.setItem('la_hub_leave_requests', JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    localStorage.setItem('la_hub_slack_config', JSON.stringify(slackConfig));
  }, [slackConfig]);

  useEffect(() => {
    localStorage.setItem('la_hub_slack_logs', JSON.stringify(slackLogs));
  }, [slackLogs]);

  // Derived active user
  const currentUser = users.find((u) => u.id === currentUserId) || users[0];

  // Role Override for quick role switching without changing person
  const switchRoleOverride = (newRole: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, role: newRole } : u))
    );
  };

  const addSlackLog = (log: SlackNotification) => {
    setSlackLogs((prev) => [log, ...prev]);
  };

  // Helper for date calculation
  const getDaysBetween = (startStr: string, endStr: string): number => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(diffDays) || diffDays < 1 ? 1 : diffDays;
  };

  // --- SHIFT MANAGEMENT & DYNAMIC TIMING LOGIC ---
  const getUserShift = (userId: string): Shift => {
    const user = users.find((u) => u.id === userId);
    if (user?.shiftId) {
      const match = shifts.find((s) => s.id === user.shiftId);
      if (match) return match;
    }
    const defaultShift = shifts.find((s) => s.isDefault) || shifts[0] || INITIAL_SHIFTS[0];
    return defaultShift;
  };

  const calculateShiftTiming = (
    clockIn?: string,
    clockOut?: string,
    shift?: Shift,
    workMode?: AttendanceRecord['workMode']
  ): ShiftTimingCalculation => {
    const effectiveShift = shift || shifts.find((s) => s.isDefault) || INITIAL_SHIFTS[0];
    return evaluateAttendanceByShift(clockIn, clockOut, effectiveShift, workMode);
  };

  const addShift = (data: Omit<Shift, 'id'>): { success: boolean; message: string; shift?: Shift } => {
    if (!data.name || !data.code || !data.startTime || !data.endTime) {
      return { success: false, message: 'Shift Name, Code, Start Time, and End Time are required.' };
    }

    const codeExists = shifts.some((s) => s.code.toLowerCase() === data.code.trim().toLowerCase());
    if (codeExists) {
      return { success: false, message: `Shift code '${data.code}' already exists.` };
    }

    const id = `shift-${Date.now().toString(36)}`;
    const newShift: Shift = {
      ...data,
      id,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim()
    };

    if (newShift.isDefault) {
      setShifts((prev) => [newShift, ...prev.map((s) => ({ ...s, isDefault: false }))]);
    } else {
      setShifts((prev) => [...prev, newShift]);
    }

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🕒 New Work Shift Configured: ${newShift.name}`,
        message: `Admin *${currentUser.name}* created shift *${newShift.code}* (${newShift.startTime} - ${newShift.endTime}, Grace: ${newShift.gracePeriodMins}m, Half-day: ${newShift.halfDayHours}h).`,
        type: 'system'
      },
      addSlackLog
    );

    return { success: true, message: `Shift ${newShift.code} (${newShift.name}) configured successfully.`, shift: newShift };
  };

  const updateShift = (id: string, data: Partial<Shift>): { success: boolean; message: string } => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, ...data };
        }
        if (data.isDefault) {
          return { ...s, isDefault: false };
        }
        return s;
      })
    );

    return { success: true, message: 'Shift timings & rules updated successfully.' };
  };

  const deleteShift = (id: string): { success: boolean; message: string } => {
    if (shifts.length <= 1) {
      return { success: false, message: 'At least one work shift must remain in the system.' };
    }
    const target = shifts.find((s) => s.id === id);
    if (target?.isDefault) {
      return { success: false, message: 'Cannot delete the designated default shift. Set another shift as default first.' };
    }

    const fallbackShift = shifts.find((s) => s.id !== id && s.isDefault) || shifts.find((s) => s.id !== id)!;
    // Re-assign users using this shift to the fallback shift
    setUsers((prev) =>
      prev.map((u) => (u.shiftId === id ? { ...u, shiftId: fallbackShift.id } : u))
    );

    setShifts((prev) => prev.filter((s) => s.id !== id));
    return {
      success: true,
      message: `Shift ${target?.code || id} deleted. Assigned staff transferred to default shift (${fallbackShift.code}).`
    };
  };

  const setDefaultShift = (id: string): { success: boolean; message: string } => {
    setShifts((prev) =>
      prev.map((s) => ({
        ...s,
        isDefault: s.id === id
      }))
    );
    return { success: true, message: 'Default shift set successfully.' };
  };

  const assignUserShift = (userId: string, shiftId: string): { success: boolean; message: string } => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return { success: false, message: 'Specified shift not found.' };

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, shiftId } : u))
    );

    // Update today's attendance record shiftCode if present
    const todayStr = new Date().toISOString().split('T')[0];
    setAttendanceRecords((prev) =>
      prev.map((rec) => {
        if (rec.userId === userId && rec.date === todayStr) {
          const timing = evaluateAttendanceByShift(rec.clockIn, rec.clockOut, shift, rec.workMode);
          return {
            ...rec,
            shiftCode: `${shift.code} (${shift.startTime} - ${shift.endTime})`,
            status:
              rec.workMode === 'field_od'
                ? 'od'
                : timing.calculatedStatus === 'PP'
                ? timing.isLate
                  ? 'late'
                  : 'present'
                : timing.calculatedStatus === 'PA'
                ? 'half_day'
                : rec.status
          };
        }
        return rec;
      })
    );

    return { success: true, message: `Assigned shift ${shift.code} (${shift.name}) to employee.` };
  };

  const bulkAssignUserShift = (userIds: string[], shiftId: string): { success: boolean; message: string } => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return { success: false, message: 'Specified shift not found.' };

    setUsers((prev) =>
      prev.map((u) => (userIds.includes(u.id) ? { ...u, shiftId } : u))
    );
    return { success: true, message: `Assigned shift ${shift.code} to ${userIds.length} employee(s).` };
  };

  // --- ATTENDANCE ACTIONS ---
  const clockInToday = (mode: AttendanceRecord['workMode'], location: string = 'Main Campus') => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const userShift = getUserShift(currentUser.id);
    const timingCalc = evaluateAttendanceByShift(nowTimeStr, undefined, userShift, mode);
    const shiftCode = `${userShift.code} (${userShift.startTime} - ${userShift.endTime})`;
    const status: AttendanceRecord['status'] = mode === 'field_od' ? 'od' : timingCalc.isLate ? 'late' : 'present';
    const remark = timingCalc.isLate
      ? `Late Punch IN by ${timingCalc.lateMinutes} mins against ${userShift.code} (${userShift.startTime}). Grace period: ${userShift.gracePeriodMins}m.`
      : `Punched in on-time for ${userShift.name} [${userShift.code}].`;

    setAttendanceRecords((prev) => {
      const existingIdx = prev.findIndex((a) => a.userId === currentUser.id && a.date === todayStr);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          clockIn: nowTimeStr,
          workMode: mode,
          status,
          shiftCode,
          remark: `${updated[existingIdx].remark ? updated[existingIdx].remark + ' • ' : ''}${remark}`,
          location
        };
        return updated;
      } else {
        const newRecord: AttendanceRecord = {
          id: `att-${currentUser.id}-${todayStr}`,
          userId: currentUser.id,
          date: todayStr,
          clockIn: nowTimeStr,
          clockOut: '-',
          shiftCode,
          workMode: mode,
          status,
          totalHours: 0,
          location,
          remark
        };
        return [newRecord, ...prev];
      }
    });

    sendSlackNotification(
      slackConfig,
      {
        channel: '#attendance-alerts',
        sender: currentUser.name,
        title: `⏱️ Attendance Clock-In: ${currentUser.name}`,
        message: `${currentUser.name} (${currentUser.designation}) clocked in at *${nowTimeStr}* [Shift: *${userShift.code}*, Mode: ${mode.toUpperCase()}].${timingCalc.isLate ? ` ⚠️ *Late by ${timingCalc.lateMinutes} mins*` : ''}`,
        type: 'attendance'
      },
      addSlackLog
    );
  };

  const clockOutToday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const userShift = getUserShift(currentUser.id);

    setAttendanceRecords((prev) => {
      return prev.map((rec) => {
        if (rec.userId === currentUser.id && rec.date === todayStr) {
          const timingCalc = evaluateAttendanceByShift(rec.clockIn, nowTimeStr, userShift, rec.workMode);
          let newStatus: AttendanceRecord['status'] = rec.workMode === 'field_od' ? 'od' : 'present';
          if (rec.workMode !== 'field_od') {
            if (timingCalc.calculatedStatus === 'AA') newStatus = 'absent';
            else if (timingCalc.calculatedStatus === 'PA') newStatus = 'half_day';
            else if (timingCalc.isLate) newStatus = 'late';
            else newStatus = 'present';
          }
          const outRemark = timingCalc.isEarlyDeparture
            ? `Early punch-out by ${timingCalc.earlyMinutes} mins before shift end (${userShift.endTime}). Total worked: ${timingCalc.totalHours} hrs.`
            : `Shift finished successfully (${timingCalc.totalHours} hrs worked).`;

          return {
            ...rec,
            clockOut: nowTimeStr,
            totalHours: timingCalc.totalHours,
            status: newStatus,
            remark: `${rec.remark ? rec.remark + ' • ' : ''}${outRemark}`
          };
        }
        return rec;
      });
    });

    sendSlackNotification(
      slackConfig,
      {
        channel: '#attendance-alerts',
        sender: currentUser.name,
        title: `🏁 Attendance Clock-Out: ${currentUser.name}`,
        message: `${currentUser.name} completed workday and clocked out at *${nowTimeStr}* [Shift: *${userShift.code}*].`,
        type: 'attendance'
      },
      addSlackLog
    );
  };

  // Get attendance visible based on Role Rules:
  // Admin: ALL
  // Reporting / Reviewing Mgr: Team members reporting to them or in sub-team + themselves
  // General Staff: Own attendance
  const getVisibleAttendanceRecords = (): AttendanceRecord[] => {
    if (currentUser.role === 'administrator') {
      return attendanceRecords;
    }

    if (currentUser.role === 'reporting_manager' || currentUser.role === 'reviewing_manager') {
      const myTeamIds = users
        .filter(
          (u) =>
            u.id === currentUser.id ||
            u.reportingManagerId === currentUser.id ||
            u.reviewingManagerId === currentUser.id
        )
        .map((u) => u.id);
      return attendanceRecords.filter((rec) => myTeamIds.includes(rec.userId));
    }

    // General staff
    return attendanceRecords.filter((rec) => rec.userId === currentUser.id);
  };

  // --- OUTDOOR DUTY (OD) ACTIONS ---
  // Rules:
  // - User can Apply for self. Can Edit & Delete ONLY before approval AND before start date.
  // - Reporting Manager can Approve & Reject ONLY before approval AND before start date.
  // - Reviewing Manager: Only View (cannot approve, reject, edit, or delete).
  // - Admin (except apply for others) can do anything at any time.
  const applyOutdoorDuty = (data: {
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    odType?: 'Domestic' | 'International';
    location: string;
    estimatedFunds?: number;
    fundingSource?: string;
    purpose: string;
    targetUserId?: string;
  }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const daysCount = getDaysBetween(data.startDate, data.endDate);

    const appliedForUser = (data.targetUserId ? users.find((u) => u.id === data.targetUserId) : null) || currentUser;

    const reportingManager =
      users.find((u) => u.id === appliedForUser.reportingManagerId) ||
      users.find((u) => u.role === 'reporting_manager') ||
      users[0];

    const newOd: OutdoorDutyRequest = {
      id: `od-${Date.now()}`,
      userId: appliedForUser.id,
      userName: appliedForUser.name,
      userEmail: appliedForUser.email,
      department: appliedForUser.department || 'N/A',
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime || '09:00',
      endTime: data.endTime || '17:30',
      daysCount,
      odType: data.odType || 'Domestic',
      location: data.location,
      estimatedFunds: data.estimatedFunds || 0,
      fundingSource: data.fundingSource || 'N/A',
      purpose: data.purpose,
      status: 'pending',
      appliedDate: todayStr,
      reportingManagerId: reportingManager.id
    };

    setOdRequests((prev) => [newOd, ...prev]);

    // Send Slack Notification
    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `📍 Outdoor Duty (${data.odType || 'Domestic'}) Application Submitted`,
        message: `*${appliedForUser.name}* requested Outdoor Duty (${data.odType || 'Domestic'}) for *${data.location}* from *${data.startDate} (${data.startTime || '09:00'})* to *${data.endDate} (${data.endTime || '17:30'})* (${daysCount} days).\n_Funds:_ ₹${data.estimatedFunds || 0} (${data.fundingSource || 'N/A'})\n_Purpose:_ ${data.purpose}`,
        type: 'od',
        actionableId: newOd.id,
        actionType: 'od'
      },
      addSlackLog
    );

    // Send Automated Email Notification to Concerning Parties
    if (emailConfig.notifyOnOutdoorDuty) {
      const applicantEmail = appliedForUser.email;
      const managerEmail = reportingManager.email;

      // Email to Applicant
      const appMail = buildODAppliedEmail(newOd, appliedForUser.name, reportingManager.name, false);
      triggerEmailDispatch({
        to: applicantEmail,
        toName: appliedForUser.name,
        toRole: 'Applicant',
        cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
        subject: appMail.subject,
        category: 'outdoor_duty',
        eventType: 'OD_SUBMITTED_APPLICANT',
        bodyHtml: appMail.html,
        bodyText: appMail.text,
        referenceId: newOd.id,
        referenceType: 'od'
      });

      // Email to Reporting Manager
      if (managerEmail && managerEmail !== applicantEmail) {
        const mgrMail = buildODAppliedEmail(newOd, appliedForUser.name, reportingManager.name, true);
        triggerEmailDispatch({
          to: managerEmail,
          toName: reportingManager.name,
          toRole: 'Reporting Officer',
          subject: mgrMail.subject,
          category: 'outdoor_duty',
          eventType: 'OD_SUBMITTED_MANAGER',
          bodyHtml: mgrMail.html,
          bodyText: mgrMail.text,
          referenceId: newOd.id,
          referenceType: 'od'
        });
      }
    }

    return {
      success: true,
      message: `Outdoor Duty request submitted successfully for ${appliedForUser.name} and dispatched to manager.`
    };
  };

  const editOutdoorDuty = (
    id: string,
    data: {
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      odType?: 'Domestic' | 'International';
      location: string;
      estimatedFunds?: number;
      fundingSource?: string;
      purpose: string;
    }
  ) => {
    const target = odRequests.find((o) => o.id === id);
    if (!target) return { success: false, message: 'Outdoor Duty request not found.' };

    // Role check: Reporting & Reviewing Managers cannot edit
    if (currentUser.role === 'reporting_manager' || currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Managers are not authorized to edit staff outdoor duty applications.' };
    }

    if (currentUser.role !== 'administrator') {
      if (target.userId !== currentUser.id) {
        return { success: false, message: 'You are only authorized to edit your own outdoor duty requests.' };
      }
      if (target.status !== 'pending') {
        return { success: false, message: 'Cannot edit OD request after it has been approved or rejected.' };
      }
    }

    const daysCount = getDaysBetween(data.startDate, data.endDate);

    setOdRequests((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              startDate: data.startDate,
              endDate: data.endDate,
              startTime: data.startTime || o.startTime,
              endTime: data.endTime || o.endTime,
              daysCount,
              odType: data.odType || o.odType,
              location: data.location,
              estimatedFunds: data.estimatedFunds !== undefined ? data.estimatedFunds : o.estimatedFunds,
              fundingSource: data.fundingSource || o.fundingSource,
              purpose: data.purpose
            }
          : o
      )
    );

    return { success: true, message: 'Outdoor Duty request updated successfully.' };
  };

  const deleteOutdoorDuty = (id: string) => {
    const target = odRequests.find((o) => o.id === id);
    if (!target) return { success: false, message: 'Outdoor Duty request not found.' };

    // Role check: Reporting & Reviewing Managers cannot delete
    if (currentUser.role === 'reporting_manager' || currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Managers are not authorized to delete staff outdoor duty applications.' };
    }

    if (currentUser.role !== 'administrator') {
      if (target.userId !== currentUser.id) {
        return { success: false, message: 'You are only authorized to delete your own outdoor duty requests.' };
      }
      if (target.status !== 'pending') {
        return { success: false, message: 'Cannot delete OD request after approval/rejection.' };
      }
    }

    setOdRequests((prev) => prev.filter((o) => o.id !== id));
    return { success: true, message: 'Outdoor Duty request deleted successfully.' };
  };

  const approveOutdoorDuty = (id: string, comments: string = 'Approved for official tour.') => {
    const target = odRequests.find((o) => o.id === id);
    if (!target) return { success: false, message: 'Outdoor Duty request not found.' };

    // Reviewing Manager cannot approve
    if (currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Reviewing Managers have view-only access for Outdoor Duty.' };
    }

    // Regular employee cannot approve
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Employees are not authorized to approve Outdoor Duty.' };
    }

    // Reporting Manager rule
    if (currentUser.role === 'reporting_manager') {
      if (target.reportingManagerId !== currentUser.id && target.userId === currentUser.id) {
        return { success: false, message: 'You cannot approve your own outdoor duty request.' };
      }
      if (target.reportingManagerId !== currentUser.id) {
        return { success: false, message: 'You are only authorized to approve requests assigned to you.' };
      }
    }

    if (currentUser.role !== 'administrator' && target.status !== 'pending') {
      return { success: false, message: 'This OD request is no longer pending.' };
    }

    const nowStr = new Date().toLocaleString();

    setOdRequests((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: 'approved',
              approverComments: comments,
              actionBy: currentUser.name,
              actionAt: nowStr
            }
          : o
      )
    );

    // Auto update/sync Attendance record for OD dates!
    setAttendanceRecords((prev) => {
      const updated = [...prev];
      const start = new Date(target.startDate);
      const end = new Date(target.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const idx = updated.findIndex((a) => a.userId === target.userId && a.date === dateStr);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            workMode: 'field_od',
            status: 'od',
            notes: `Approved ${target.odType} OD: ${target.purpose} (${target.location})`
          };
        } else {
          updated.push({
            id: `att-${target.userId}-${dateStr}`,
            userId: target.userId,
            date: dateStr,
            clockIn: target.startTime || '09:00',
            clockOut: target.endTime || '17:30',
            workMode: 'field_od',
            status: 'od',
            totalHours: 8.5,
            location: target.location,
            notes: `Approved ${target.odType} OD: ${target.purpose}`
          });
        }
      }
      return updated;
    });

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `✅ Outdoor Duty Approved: ${target.userName}`,
        message: `Outdoor duty (${target.odType}) for *${target.userName}* (${target.location}) was *APPROVED* by ${currentUser.name}.\n_Comments:_ ${comments}`,
        type: 'od'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnOutdoorDuty) {
      const applicant = users.find((u) => u.id === target.userId);
      const recipientEmail = target.userEmail || applicant?.email;
      if (recipientEmail) {
        const approvedMail = buildODApprovedEmail(
          { ...target, status: 'approved', approverComments: comments, actionBy: currentUser.name, actionAt: nowStr },
          target.userName,
          currentUser.name,
          comments
        );
        triggerEmailDispatch({
          to: recipientEmail,
          toName: target.userName,
          toRole: 'Applicant',
          cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
          subject: approvedMail.subject,
          category: 'outdoor_duty',
          eventType: 'OD_SANCTION_ORDER',
          bodyHtml: approvedMail.html,
          bodyText: approvedMail.text,
          referenceId: target.id,
          referenceType: 'od'
        });
      }
    }

    return { success: true, message: `Outdoor Duty for ${target.userName} approved successfully.` };
  };

  const rejectOutdoorDuty = (id: string, comments: string = 'Rejected by manager.') => {
    const target = odRequests.find((o) => o.id === id);
    if (!target) return { success: false, message: 'Outdoor Duty request not found.' };

    // Reviewing Manager cannot reject
    if (currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Reviewing Managers have view-only access for Outdoor Duty.' };
    }

    // Regular employee cannot reject
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Employees are not authorized to reject Outdoor Duty.' };
    }

    // Reporting Manager rule
    if (currentUser.role === 'reporting_manager') {
      if (target.reportingManagerId !== currentUser.id && target.userId === currentUser.id) {
        return { success: false, message: 'You cannot reject your own outdoor duty request.' };
      }
      if (target.reportingManagerId !== currentUser.id) {
        return { success: false, message: 'You are only authorized to reject requests assigned to you.' };
      }
    }

    if (currentUser.role !== 'administrator' && target.status !== 'pending') {
      return { success: false, message: 'This OD request is no longer pending.' };
    }

    const nowStr = new Date().toLocaleString();

    setOdRequests((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: 'rejected',
              approverComments: comments,
              actionBy: currentUser.name,
              actionAt: nowStr
            }
          : o
      )
    );

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `❌ Outdoor Duty Rejected: ${target.userName}`,
        message: `Outdoor duty request for *${target.userName}* was *REJECTED* by ${currentUser.name}.\n_Reason:_ ${comments}`,
        type: 'od'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnOutdoorDuty) {
      const applicant = users.find((u) => u.id === target.userId);
      const recipientEmail = target.userEmail || applicant?.email;
      if (recipientEmail) {
        const rejectedMail = buildODRejectedEmail(
          { ...target, status: 'rejected', approverComments: comments, actionBy: currentUser.name, actionAt: nowStr },
          target.userName,
          currentUser.name,
          comments
        );
        triggerEmailDispatch({
          to: recipientEmail,
          toName: target.userName,
          toRole: 'Applicant',
          subject: rejectedMail.subject,
          category: 'outdoor_duty',
          eventType: 'OD_REJECTION_NOTICE',
          bodyHtml: rejectedMail.html,
          bodyText: rejectedMail.text,
          referenceId: target.id,
          referenceType: 'od'
        });
      }
    }

    return { success: true, message: `Outdoor Duty for ${target.userName} rejected.` };
  };

  const cancelApprovedOutdoorDuty = (id: string, reason?: string) => {
    const target = odRequests.find((o) => o.id === id);
    if (!target) {
      return { success: false, message: 'Outdoor Duty request not found.' };
    }

    // Role check: Reviewing Manager cannot cancel
    if (currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Reviewing Managers have view-only access for Outdoor Duty.' };
    }

    // Role check: Regular employee cannot cancel
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Employees are not authorized to cancel approved Outdoor Duty.' };
    }

    // Role check: Reporting Manager can only cancel their subordinates' requests
    if (currentUser.role === 'reporting_manager') {
      if (target.reportingManagerId !== currentUser.id && target.userId === currentUser.id) {
        return { success: false, message: 'You cannot cancel your own Outdoor Duty approval.' };
      }
      if (target.reportingManagerId !== currentUser.id) {
        return { success: false, message: 'You are only authorized to manage requests assigned to you.' };
      }
    }

    if (target.status !== 'approved') {
      return { success: false, message: 'Only approved Outdoor Duty records can be cancelled.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const cancellationRemark = reason?.trim() ? `Approval Cancelled: ${reason.trim()}` : 'Approval cancelled by Reporting Officer';

    setOdRequests((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: 'rejected',
              actionAt: todayStr,
              actionBy: currentUser.name,
              approverComments: cancellationRemark
            }
          : o
      )
    );

    // Revert attendance records for OD dates
    setAttendanceRecords((prev) => {
      const updated = [...prev];
      const start = new Date(target.startDate);
      const end = new Date(target.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const idx = updated.findIndex((a) => a.userId === target.userId && a.date === dateStr);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            workMode: 'in_office',
            status: 'absent',
            clockIn: '--:--',
            clockOut: '--:--',
            remark: `Outdoor Duty approval revoked by ${currentUser.name} on ${todayStr}.`
          };
        }
      }
      return updated;
    });

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `⚠️ Outdoor Duty Approval Revoked: ${target.userName}`,
        message: `Approved Outdoor Duty for *${target.userName}* (${target.startDate} to ${target.endDate}) was *CANCELLED / REVOKED* by ${currentUser.name}.\n${reason ? `_Remarks:_ ${reason}` : ''}`,
        type: 'od'
      },
      addSlackLog
    );

    return {
      success: true,
      message: `Outdoor Duty approval for ${target.userName} has been cancelled.`
    };
  };

  // --- MANUAL ATTENDANCE REGULARIZATION ACTIONS ---
  const applyManualAttendance = (data: {
    date: string;
    inTime: string;
    outTime: string;
    reason: string;
    reasonCategory?: string;
    targetUserId?: string;
    originalInTime?: string;
    originalOutTime?: string;
  }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(data.date + 'T00:00:00');

    if (selectedDate >= today) {
      return {
        success: false,
        message: 'Manual attendance can only be applied for past forgotten attendance dates (prior to today).'
      };
    }

    const appliedForUser = (data.targetUserId ? users.find((u) => u.id === data.targetUserId) : null) || currentUser;

    // Check if already requested for this date
    const existing = manualAttendanceRequests.find(
      (r) => r.userId === appliedForUser.id && r.date === data.date && r.status !== 'rejected'
    );
    if (existing) {
      return {
        success: false,
        message: `${appliedForUser.name} already has a ${existing.status} manual attendance request for ${data.date}.`
      };
    }

    const reportingManager =
      users.find((u) => u.id === appliedForUser.reportingManagerId) ||
      users.find((u) => u.role === 'reporting_manager') ||
      users[0];

    const newReq: ManualAttendanceRegularizationRequest = {
      id: `man_att_${Date.now()}`,
      userId: appliedForUser.id,
      userName: appliedForUser.name,
      userDesignation: appliedForUser.designation,
      userDepartment: appliedForUser.department,
      date: data.date,
      requestedInTime: data.inTime,
      requestedOutTime: data.outTime,
      originalInTime: data.originalInTime,
      originalOutTime: data.originalOutTime,
      reasonCategory: data.reasonCategory || 'Forget to punch',
      reason: data.reason,
      reportingManagerId: reportingManager.id,
      reportingManagerName: reportingManager.name,
      status: 'pending',
      appliedAt: new Date().toISOString().split('T')[0]
    };

    setManualAttendanceRequests((prev) => [newReq, ...prev]);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `📝 New Manual Attendance Request: ${appliedForUser.name}`,
        message: `*${appliedForUser.name}* requested manual punch entry for *${data.date}* (${data.inTime} - ${data.outTime}).\n_Category:_ ${data.reasonCategory || 'Forget to punch'}\n_Reason:_ ${data.reason}\n_Assigned Approver:_ ${reportingManager.name}`,
        type: 'attendance'
      },
      addSlackLog
    );

    // Send Automated Email Notification to Concerning Parties
    if (emailConfig.notifyOnAttendanceRegularization) {
      const applicantEmail = appliedForUser.email;
      const managerEmail = reportingManager.email;

      // Email to Applicant (Confirmation)
      const appMail = buildManualAttendanceAppliedEmail(newReq, appliedForUser.name, reportingManager.name, false);
      triggerEmailDispatch({
        to: applicantEmail,
        toName: appliedForUser.name,
        toRole: 'Applicant',
        cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
        subject: appMail.subject,
        category: 'manual_attendance',
        eventType: 'ATTENDANCE_REGULARIZATION_SUBMITTED',
        bodyHtml: appMail.html,
        bodyText: appMail.text,
        referenceId: newReq.id,
        referenceType: 'manual_attendance'
      });

      // Email to Reporting Manager (Action Required)
      if (managerEmail && managerEmail !== applicantEmail) {
        const mgrMail = buildManualAttendanceAppliedEmail(newReq, appliedForUser.name, reportingManager.name, true);
        triggerEmailDispatch({
          to: managerEmail,
          toName: reportingManager.name,
          toRole: 'Reporting Officer',
          subject: mgrMail.subject,
          category: 'manual_attendance',
          eventType: 'ATTENDANCE_REGULARIZATION_MANAGER_ACTION',
          bodyHtml: mgrMail.html,
          bodyText: mgrMail.text,
          referenceId: newReq.id,
          referenceType: 'manual_attendance'
        });
      }
    }

    return {
      success: true,
      message: `Manual attendance request for ${data.date} submitted successfully to ${reportingManager.name} for approval.`
    };
  };

  const editManualAttendance = (
    id: string,
    data: {
      date: string;
      inTime: string;
      outTime: string;
      reason: string;
      reasonCategory?: string;
      originalInTime?: string;
      originalOutTime?: string;
    }
  ) => {
    const target = manualAttendanceRequests.find((r) => r.id === id);
    if (!target) {
      return { success: false, message: 'Manual attendance request not found.' };
    }

    if (currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Reviewing Managers have view-only access.' };
    }

    if (currentUser.role === 'reporting_manager') {
      return { success: false, message: 'Reporting Managers cannot edit manual attendance applications.' };
    }

    if (currentUser.role !== 'administrator') {
      if (target.userId !== currentUser.id) {
        return { success: false, message: 'You can only edit your own manual attendance requests.' };
      }
      if (target.status !== 'pending') {
        return { success: false, message: 'Cannot edit manual attendance request after it has been approved or rejected.' };
      }
    }

    setManualAttendanceRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              date: data.date,
              requestedInTime: data.inTime,
              requestedOutTime: data.outTime,
              originalInTime: data.originalInTime || r.originalInTime,
              originalOutTime: data.originalOutTime || r.originalOutTime,
              reasonCategory: data.reasonCategory || r.reasonCategory,
              reason: data.reason
            }
          : r
      )
    );

    return { success: true, message: 'Manual attendance request updated successfully.' };
  };

  const deleteManualAttendance = (id: string) => {
    const target = manualAttendanceRequests.find((r) => r.id === id);
    if (!target) {
      return { success: false, message: 'Manual attendance request not found.' };
    }

    if (currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Reviewing Managers have view-only access.' };
    }

    if (currentUser.role === 'reporting_manager') {
      return { success: false, message: 'Reporting Managers cannot delete manual attendance applications.' };
    }

    if (currentUser.role !== 'administrator') {
      if (target.userId !== currentUser.id) {
        return { success: false, message: 'You can only delete your own manual attendance requests.' };
      }
      if (target.status !== 'pending') {
        return { success: false, message: 'Cannot delete manual attendance request after it has been processed.' };
      }
    }

    setManualAttendanceRequests((prev) => prev.filter((r) => r.id !== id));
    return { success: true, message: 'Manual attendance request deleted successfully.' };
  };

  const approveRejectManualAttendance = (id: string, action: 'approve' | 'reject', comments?: string) => {
    const target = manualAttendanceRequests.find((r) => r.id === id);
    if (!target) {
      return { success: false, message: 'Request not found.' };
    }

    // Role check: Reviewing Manager cannot approve/reject
    if (currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Reviewing Managers have view-only access for Manual Attendance.' };
    }

    // Role check: Regular employee cannot approve
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Employees are not authorized to approve manual attendance.' };
    }

    // Role check: Reporting Manager can approve/reject staff requests
    if (currentUser.role === 'reporting_manager') {
      if (target.userId === currentUser.id) {
        return { success: false, message: 'You cannot approve your own manual attendance request.' };
      }
    }

    if (currentUser.role !== 'administrator' && target.status !== 'pending') {
      return { success: false, message: 'This request is no longer pending.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];

    setManualAttendanceRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: action === 'approve' ? 'approved' : 'rejected',
              actionDate: todayStr,
              actionBy: currentUser.name,
              managerComment: comments || (action === 'approve' ? 'Approved by Reporting Officer' : 'Rejected by Reporting Officer')
            }
          : r
      )
    );

    if (action === 'approve') {
      // Calculate hours
      const [inH, inM] = target.requestedInTime.split(':').map(Number);
      const [outH, outM] = target.requestedOutTime.split(':').map(Number);
      const diffHours = Number(((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(2));
      const inFormatted = `${inH.toString().padStart(2, '0')}:${inM.toString().padStart(2, '0')}`;
      const outFormatted = `${outH.toString().padStart(2, '0')}:${outM.toString().padStart(2, '0')}`;

      // Update or insert in attendanceRecords
      setAttendanceRecords((prev) => {
        const existingIndex = prev.findIndex((a) => a.userId === target.userId && a.date === target.date);
        const updatedRecord: AttendanceRecord = {
          id: existingIndex >= 0 ? prev[existingIndex].id : `att-${target.userId}-${target.date}`,
          userId: target.userId,
          date: target.date,
          clockIn: inFormatted,
          clockOut: outFormatted,
          shiftCode: 'GEN-01 (09:30 - 17:30)',
          workMode: 'in_office',
          status: 'present',
          totalHours: Math.max(diffHours, 0),
          location: 'Main Campus HQ (Manual Attendance)',
          remark: `Manual Attendance approved by ${currentUser.name}. Reason: ${target.reasonCategory || ''} - ${target.reason}`
        };

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = updatedRecord;
          return next;
        } else {
          return [updatedRecord, ...prev];
        }
      });
    }

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `${action === 'approve' ? '✅ Manual Attendance Approved' : '❌ Manual Attendance Rejected'}: ${target.userName}`,
        message: `Manual attendance request for *${target.userName}* (${target.date}) was *${action.toUpperCase()}* by ${currentUser.name}.\n${comments ? `_Comments:_ ${comments}` : ''}`,
        type: 'attendance'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnAttendanceRegularization) {
      const applicant = users.find((u) => u.id === target.userId);
      const recipientEmail = applicant?.email;
      if (recipientEmail) {
        if (action === 'approve') {
          const approvedMail = buildManualAttendanceApprovedEmail(
            { ...target, status: 'approved', actionDate: todayStr, actionBy: currentUser.name, managerComment: comments || 'Approved' },
            target.userName,
            currentUser.name,
            comments
          );
          triggerEmailDispatch({
            to: recipientEmail,
            toName: target.userName,
            toRole: 'Applicant',
            cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
            subject: approvedMail.subject,
            category: 'manual_attendance',
            eventType: 'ATTENDANCE_REGULARIZED_SANCTION',
            bodyHtml: approvedMail.html,
            bodyText: approvedMail.text,
            referenceId: target.id,
            referenceType: 'manual_attendance'
          });
        } else {
          const rejectedMail = buildManualAttendanceRejectedEmail(
            { ...target, status: 'rejected', actionDate: todayStr, actionBy: currentUser.name, managerComment: comments || 'Rejected' },
            target.userName,
            currentUser.name,
            comments
          );
          triggerEmailDispatch({
            to: recipientEmail,
            toName: target.userName,
            toRole: 'Applicant',
            subject: rejectedMail.subject,
            category: 'manual_attendance',
            eventType: 'ATTENDANCE_REGULARIZATION_REJECTED',
            bodyHtml: rejectedMail.html,
            bodyText: rejectedMail.text,
            referenceId: target.id,
            referenceType: 'manual_attendance'
          });
        }
      }
    }

    return {
      success: true,
      message: `Manual attendance request for ${target.userName} has been ${action === 'approve' ? 'approved and regularized' : 'rejected'}.`
    };
  };

  const cancelApprovedManualAttendance = (id: string, reason?: string) => {
    const target = manualAttendanceRequests.find((r) => r.id === id);
    if (!target) {
      return { success: false, message: 'Request not found.' };
    }

    // Role check: Reviewing Manager cannot cancel
    if (currentUser.role === 'reviewing_manager') {
      return { success: false, message: 'Reviewing Managers have view-only access for Manual Attendance.' };
    }

    // Role check: Regular employee cannot cancel
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Employees are not authorized to cancel approved attendance.' };
    }

    // Role check: Reporting Manager can only cancel their subordinates' requests
    if (currentUser.role === 'reporting_manager') {
      if (target.reportingManagerId !== currentUser.id && target.userId === currentUser.id) {
        return { success: false, message: 'You cannot cancel your own manual attendance approval.' };
      }
      if (target.reportingManagerId !== currentUser.id) {
        return { success: false, message: 'You are only authorized to manage requests assigned to you.' };
      }
    }

    if (target.status !== 'approved') {
      return { success: false, message: 'Only approved manual attendance records can be cancelled.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const cancellationRemark = reason?.trim() ? `Approval Cancelled: ${reason.trim()}` : 'Approval cancelled by Reporting Officer';

    setManualAttendanceRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'rejected',
              actionDate: todayStr,
              actionBy: currentUser.name,
              managerComment: cancellationRemark
            }
          : r
      )
    );

    // Revert attendance record in attendance records list
    setAttendanceRecords((prev) => {
      const existingIndex = prev.findIndex((a) => a.userId === target.userId && a.date === target.date);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          status: target.originalInTime || target.originalOutTime ? 'present' : 'absent',
          clockIn: target.originalInTime || '--:--',
          clockOut: target.originalOutTime || '--:--',
          remark: `Manual Attendance approval revoked by ${currentUser.name} on ${todayStr}.`
        };
        return next;
      }
      return prev;
    });

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `⚠️ Manual Attendance Approval Revoked: ${target.userName}`,
        message: `Approved manual attendance for *${target.userName}* (${target.date}) was *CANCELLED / REVOKED* by ${currentUser.name}.\n${reason ? `_Remarks:_ ${reason}` : ''}`,
        type: 'attendance'
      },
      addSlackLog
    );

    return {
      success: true,
      message: `Manual attendance approval for ${target.userName} has been cancelled.`
    };
  };

  // --- LEAVE ACTIONS & MULTI-LEVEL WORKFLOW ---
  const applyLeave = (data: {
    leaveType: any;
    startDate: string;
    endDate: string;
    reason: string;
    targetUserId?: string;
    ltcType?: 'none' | 'ltc' | 'ex_india';
    stationAddress?: string;
    encashLtc?: boolean;
    encashDays?: number;
    isCommuted?: boolean;
    prescriptionUrl?: string;
    prescriptionFileName?: string;
    customDaysCount?: number;
  }) => {
    const applicantUser = (data.targetUserId ? users.find((u) => u.id === data.targetUserId) : null) || currentUser;
    const rawDays = getDaysBetween(data.startDate, data.endDate);
    const isCommutedLeave = (data.leaveType === 'half_pay' && data.isCommuted) || data.leaveType === 'commuted';
    const daysCount = data.customDaysCount !== undefined ? data.customDaysCount : (isCommutedLeave ? rawDays * 2 : rawDays);
    const todayStr = new Date().toISOString().split('T')[0];

    // CCS Leave Rules Validations
    if (data.leaveType === 'restricted') {
      // Rule: Max 2 Restricted Holidays in a calendar year
      const appliedRHCount = leaveRequests.filter(
        (l) => l.userId === applicantUser.id && l.leaveType === 'restricted' && l.status !== 'rejected' && l.status !== 'cancelled'
      ).reduce((sum, l) => sum + l.daysCount, 0);
      if (appliedRHCount + daysCount > 2) {
        return {
          success: false,
          message: 'CCS Leave Rules: A maximum of two (2) Restricted Holidays (RH) can be availed in a calendar year.'
        };
      }
    }

    if (data.leaveType === 'earned' && daysCount > 180) {
      return {
        success: false,
        message: 'CCS Rule 26: Earned Leave (EL) sanctioned at any one time cannot exceed 180 days.'
      };
    }

    if (data.leaveType === 'paternity' && daysCount > 15) {
      return {
        success: false,
        message: 'CCS Rule 43-A: Paternity Leave is limited to a maximum of 15 days.'
      };
    }

    if (data.leaveType === 'maternity' && daysCount > 180) {
      return {
        success: false,
        message: 'CCS Rule 43: Maternity Leave is limited to 180 days for child birth/adoption.'
      };
    }

    // Check policy rule requirement for level 2 approval
    const policy = leavePolicies.find((p) => p.type === data.leaveType);

    const requiresLevel2 = policy ? daysCount > policy.requiresLevel2ForDaysMoreThan : daysCount > 2;

    const reportingManager = users.find((u) => u.id === applicantUser.reportingManagerId) || users.find((u) => u.role === 'reporting_manager') || users[0];
    const reviewingManager = users.find((u) => u.id === applicantUser.reviewingManagerId) || users.find((u) => u.role === 'reviewing_manager');

    const newLeave: LeaveRequest = {
      id: `lv-${Date.now()}`,
      userId: applicantUser.id,
      userName: applicantUser.name,
      userEmail: applicantUser.email,
      employmentType: applicantUser.employmentType,
      department: applicantUser.department,
      leaveType: data.leaveType,
      leaveTypeName: policy ? policy.name : `${String(data.leaveType).replace('_', ' ').toUpperCase()} Leave`,
      startDate: data.startDate,
      endDate: data.endDate,
      daysCount,
      reason: data.reason,
      status: 'pending_level_1',
      requiresLevel2,
      reportingManagerId: reportingManager.id,
      reviewingManagerId: reviewingManager?.id,
      appliedDate: todayStr,
      ltcType: data.ltcType || 'none',
      stationAddress: data.stationAddress || '',
      encashLtc: data.encashLtc,
      encashDays: data.encashDays,
      isCommuted: data.isCommuted,
      prescriptionUrl: data.prescriptionUrl,
      prescriptionFileName: data.prescriptionFileName
    };

    setLeaveRequests((prev) => [newLeave, ...prev]);

    // Update user pending balance in the year of the leave's startDate
    const leaveYear = data.startDate ? data.startDate.slice(0, 4) : new Date().getFullYear().toString();
    const curYearStr = new Date().getFullYear().toString();

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === applicantUser.id) {
          const userYearly = u.yearlyLeaveBalances || {};
          const yearBalObj = userYearly[leaveYear] || u.leaveBalances || {};
          const currentBal = yearBalObj[data.leaveType] || { total: 10, used: 0, pending: 0 };

          const updatedYearBal = {
            ...yearBalObj,
            [data.leaveType]: {
              ...currentBal,
              pending: currentBal.pending + daysCount
            }
          };

          const isCurrentYear = leaveYear === curYearStr;
          const updatedCurrentBal = isCurrentYear
            ? {
                ...u.leaveBalances,
                [data.leaveType]: {
                  ...(u.leaveBalances[data.leaveType] || currentBal),
                  pending: (u.leaveBalances[data.leaveType]?.pending || currentBal.pending) + daysCount
                }
              }
            : u.leaveBalances;

          return {
            ...u,
            leaveBalances: updatedCurrentBal,
            yearlyLeaveBalances: {
              ...userYearly,
              [leaveYear]: updatedYearBal
            }
          };
        }
        return u;
      })
    );

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🌴 New Leave Application (${newLeave.leaveTypeName})`,
        message: `*${applicantUser.name}* requested ${daysCount} day(s) of *${newLeave.leaveTypeName}* (${data.startDate} to ${data.endDate}).\n_Workflow:_ ${requiresLevel2 ? 'Requires 2-Level Approval (Reporting + HoD)' : 'Requires Level-1 Approval'}\n_Reason:_ ${data.reason}`,
        type: 'leave',
        actionableId: newLeave.id,
        actionType: 'leave'
      },
      addSlackLog
    );

    // Send Automated Email Notification to Concerning Parties
    if (emailConfig.notifyOnLeaveApplication) {
      const applicantEmail = applicantUser.email;
      const managerEmail = reportingManager.email;

      // Email to Applicant (Confirmation)
      const appMail = buildLeaveAppliedEmail(newLeave, applicantUser.name, reportingManager.name, false);
      triggerEmailDispatch({
        to: applicantEmail,
        toName: applicantUser.name,
        toRole: 'Applicant',
        cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
        subject: appMail.subject,
        category: 'leave',
        eventType: 'LEAVE_APPLICATION_SUBMITTED',
        bodyHtml: appMail.html,
        bodyText: appMail.text,
        referenceId: newLeave.id,
        referenceType: 'leave'
      });

      // Email to Reporting Manager (Approval Required)
      if (managerEmail && managerEmail !== applicantEmail) {
        const mgrMail = buildLeaveAppliedEmail(newLeave, applicantUser.name, reportingManager.name, true);
        triggerEmailDispatch({
          to: managerEmail,
          toName: reportingManager.name,
          toRole: 'Reporting Officer',
          subject: mgrMail.subject,
          category: 'leave',
          eventType: 'LEAVE_APPLICATION_ACTION_REQUIRED',
          bodyHtml: mgrMail.html,
          bodyText: mgrMail.text,
          referenceId: newLeave.id,
          referenceType: 'leave'
        });
      }
    }

    return {
      success: true,
      message: `Leave application submitted for ${applicantUser.name}. Sent to ${reportingManager.name} for Level-1 approval.`
    };
  };

  const editLeave = (id: string, data: { startDate: string; endDate: string; reason: string }) => {
    const target = leaveRequests.find((l) => l.id === id);
    if (!target) return { success: false, message: 'Leave request not found.' };

    const todayStr = new Date().toISOString().split('T')[0];

    // Non-admin check: General Staff can edit before start date or if pending
    if (currentUser.role !== 'administrator') {
      if (target.userId !== currentUser.id) {
        return { success: false, message: 'You can only edit your own leave requests.' };
      }
      if (target.status !== 'pending_level_1' && target.startDate <= todayStr) {
        return { success: false, message: 'Cannot edit leave request after approval/forwarding or past start date.' };
      }
    }

    const daysCount = getDaysBetween(data.startDate, data.endDate);

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              startDate: data.startDate,
              endDate: data.endDate,
              daysCount,
              reason: data.reason
            }
          : l
      )
    );

    return { success: true, message: 'Leave request updated successfully.' };
  };

  const deleteLeave = (id: string) => {
    const target = leaveRequests.find((l) => l.id === id);
    if (!target) return { success: false, message: 'Leave request not found.' };

    const todayStr = new Date().toISOString().split('T')[0];

    if (currentUser.role !== 'administrator') {
      if (target.userId !== currentUser.id) {
        return { success: false, message: 'You can only delete your own leave requests.' };
      }
      if (target.status !== 'pending_level_1' && target.startDate <= todayStr) {
        return { success: false, message: 'Cannot delete leave request after approval/forwarding or past start date.' };
      }
    }

    // Revert pending balance if pending
    if (target.status.startsWith('pending')) {
      revertPendingLeave(target.userId, target.leaveType, target.daysCount, target.startDate);
    }

    setLeaveRequests((prev) => prev.filter((l) => l.id !== id));
    return { success: true, message: 'Leave request deleted successfully.' };
  };

  const updateUserLeaveBalance = (
    userId: string,
    leaveType: string,
    total: number,
    used: number,
    pending: number,
    year: string = new Date().getFullYear().toString(),
    carryForward: number = 0
  ) => {
    if (currentUser.role !== 'administrator') {
      return { success: false, message: 'Only Administrators can update leave balances.' };
    }

    const curYearStr = new Date().getFullYear().toString();

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const userYearly = u.yearlyLeaveBalances || {};
          const yearBalObj = userYearly[year] || u.leaveBalances || {};

          const updatedYearBal = {
            ...yearBalObj,
            [leaveType]: {
              total,
              used,
              pending,
              carryForward
            }
          };

          const isCurrentYear = year === curYearStr;
          const updatedCurrentBal = isCurrentYear
            ? {
                ...u.leaveBalances,
                [leaveType]: { total, used, pending, carryForward }
              }
            : u.leaveBalances;

          return {
            ...u,
            leaveBalances: updatedCurrentBal,
            yearlyLeaveBalances: {
              ...userYearly,
              [year]: updatedYearBal
            }
          };
        }
        return u;
      })
    );

    return { success: true, message: `Leave balance updated successfully for Year ${year}.` };
  };

  const bulkImportLeaveBalances = (
    records: Array<{
      userId: string;
      leaveType: string;
      total: number;
      used: number;
      pending: number;
      year: string;
      carryForward?: number;
    }>
  ) => {
    if (currentUser.role !== 'administrator') {
      return { success: false, updatedCount: 0, message: 'Only Administrators can bulk import leave balances.' };
    }

    if (!records || records.length === 0) {
      return { success: false, updatedCount: 0, message: 'No records provided for import.' };
    }

    const curYearStr = new Date().getFullYear().toString();
    let updatedCount = 0;

    setUsers((prev) => {
      const updatedUsers = [...prev];

      records.forEach((rec) => {
        const idx = updatedUsers.findIndex((u) => u.id === rec.userId);
        if (idx >= 0) {
          const user = updatedUsers[idx];
          const yr = rec.year || curYearStr;
          const userYearly = user.yearlyLeaveBalances || {};
          const yearBalObj = userYearly[yr] || user.leaveBalances || {};

          const updatedYearBal = {
            ...yearBalObj,
            [rec.leaveType]: {
              total: rec.total,
              used: rec.used,
              pending: rec.pending,
              carryForward: rec.carryForward || 0
            }
          };

          const isCurrentYear = yr === curYearStr;
          const updatedCurrentBal = isCurrentYear
            ? {
                ...user.leaveBalances,
                [rec.leaveType]: {
                  total: rec.total,
                  used: rec.used,
                  pending: rec.pending,
                  carryForward: rec.carryForward || 0
                }
              }
            : user.leaveBalances;

          updatedUsers[idx] = {
            ...user,
            leaveBalances: updatedCurrentBal,
            yearlyLeaveBalances: {
              ...userYearly,
              [yr]: updatedYearBal
            }
          };
          updatedCount++;
        }
      });

      return updatedUsers;
    });

    return { success: true, updatedCount, message: `Successfully imported leave balances for ${updatedCount} record(s).` };
  };

  const batchUpdateLeaveBalances = (
    records: Array<{
      userId: string;
      year: string;
      leaveType: string;
      total: number;
      used: number;
      pending: number;
      carryForward?: number;
    }>
  ) => {
    if (currentUser.role !== 'administrator') {
      return { success: false, updatedCount: 0, message: 'Only Administrators can batch update leave balances.' };
    }

    const curYearStr = new Date().getFullYear().toString();
    let updatedCount = 0;

    setUsers((prev) => {
      const nextUsers = [...prev];

      records.forEach((rec) => {
        const uIdx = nextUsers.findIndex((u) => u.id === rec.userId);
        if (uIdx >= 0) {
          const u = nextUsers[uIdx];
          const userYearly = u.yearlyLeaveBalances || {};
          const yearBal = userYearly[rec.year] || u.leaveBalances || {};

          const updatedYearBal = {
            ...yearBal,
            [rec.leaveType]: {
              total: rec.total,
              used: rec.used,
              pending: rec.pending,
              carryForward: rec.carryForward || 0
            }
          };

          const isCurrentYear = rec.year === curYearStr;
          const updatedCurrentBal = isCurrentYear ? updatedYearBal : u.leaveBalances;

          nextUsers[uIdx] = {
            ...u,
            leaveBalances: updatedCurrentBal,
            yearlyLeaveBalances: {
              ...userYearly,
              [rec.year]: updatedYearBal
            }
          };
          updatedCount++;
        }
      });

      return nextUsers;
    });

    return {
      success: true,
      updatedCount,
      message: `Successfully updated ${updatedCount} leave balance entry/entries.`
    };
  };

  const reconcileLeaveBalances = (targetYear?: string) => {
    if (currentUser.role !== 'administrator') {
      return {
        success: false,
        reconciledUsers: 0,
        discrepanciesFixed: 0,
        message: 'Only Administrators can reconcile leave balances.'
      };
    }

    const yearStr = targetYear || new Date().getFullYear().toString();
    let discrepanciesFixed = 0;
    let reconciledUsers = 0;

    setUsers((prevUsers) => {
      return prevUsers.map((user) => {
        reconciledUsers++;
        const userYearly = user.yearlyLeaveBalances || {};
        const yearBalObj = userYearly[yearStr] || user.leaveBalances || {};
        const newYearBalObj = { ...yearBalObj };

        // Scan all approved & pending leave requests for this user in yearStr
        const userLeavesInYear = leaveRequests.filter((l) => {
          if (l.userId !== user.id) return false;
          const ly = l.startDate ? l.startDate.slice(0, 4) : yearStr;
          return ly === yearStr;
        });

        // Group by leaveType
        const approvedDaysByType: Record<string, number> = {};
        const pendingDaysByType: Record<string, number> = {};

        userLeavesInYear.forEach((l) => {
          if (l.status === 'approved') {
            approvedDaysByType[l.leaveType] = (approvedDaysByType[l.leaveType] || 0) + l.daysCount;
          } else if (l.status === 'pending_level_1' || l.status === 'pending_level_2') {
            pendingDaysByType[l.leaveType] = (pendingDaysByType[l.leaveType] || 0) + l.daysCount;
          }
        });

        leavePolicies.forEach((pol) => {
          if (!pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(user.employmentType)) {
            const currentBal = newYearBalObj[pol.type] || { total: pol.defaultQuota, used: 0, pending: 0, carryForward: 0 };
            const actualApprovedUsed = approvedDaysByType[pol.type] || 0;
            const actualPending = pendingDaysByType[pol.type] || 0;

            if (currentBal.used !== actualApprovedUsed || currentBal.pending !== actualPending) {
              discrepanciesFixed++;
              newYearBalObj[pol.type] = {
                ...currentBal,
                used: actualApprovedUsed,
                pending: actualPending
              };
            }
          }
        });

        const curYearStr = new Date().getFullYear().toString();
        const updatedCurrent = yearStr === curYearStr ? newYearBalObj : user.leaveBalances;

        return {
          ...user,
          leaveBalances: updatedCurrent,
          yearlyLeaveBalances: {
            ...userYearly,
            [yearStr]: newYearBalObj
          }
        };
      });
    });

    return {
      success: true,
      reconciledUsers,
      discrepanciesFixed,
      message: `Leave reconciliation completed for Year ${yearStr}. Audited ${reconciledUsers} employees, fixed ${discrepanciesFixed} balance discrepancy/discrepancies.`
    };
  };

  const runYearEndLeaveRoll = (fromYear: string, toYear: string) => {
    if (currentUser.role !== 'administrator') {
      return { success: false, processedCount: 0, message: 'Only Administrators can execute year-end leave rolls.' };
    }

    let processedCount = 0;

    setUsers((prev) => {
      return prev.map((user) => {
        const userYearly = user.yearlyLeaveBalances || {};
        const fromBalObj = userYearly[fromYear] || user.leaveBalances || {};
        const toBalObj: Record<string, { total: number; used: number; pending: number; carryForward?: number }> = {};

        leavePolicies.forEach((pol) => {
          if (!pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(user.employmentType)) {
            const prevBal = fromBalObj[pol.type] || { total: pol.defaultQuota, used: 0, pending: 0, carryForward: 0 };
            const unused = Math.max(0, prevBal.total - prevBal.used);

            let carriedForwardDays = 0;
            if (pol.carryForward) {
              const maxAllowed = pol.maxCarryForwardDays || pol.maxAccumulation || 300;
              carriedForwardDays = Math.min(unused, maxAllowed);
            }

            const newTotal = pol.defaultQuota + carriedForwardDays;

            toBalObj[pol.type] = {
              total: newTotal,
              used: 0,
              pending: 0,
              carryForward: carriedForwardDays
            };
          }
        });

        const updatedYearly = {
          ...userYearly,
          [toYear]: toBalObj
        };

        const curYearStr = new Date().getFullYear().toString();
        const updatedCurrent = toYear === curYearStr ? toBalObj : user.leaveBalances;

        processedCount++;

        return {
          ...user,
          leaveBalances: updatedCurrent,
          yearlyLeaveBalances: updatedYearly
        };
      });
    });

    return {
      success: true,
      processedCount,
      message: `Year-end transition from ${fromYear} to ${toYear} executed for ${processedCount} employee(s) based on leave policies.`
    };
  };

  const approveLeaveLevel1 = (id: string, comments: string = 'Level-1 approval granted.') => {
    const target = leaveRequests.find((l) => l.id === id);
    if (!target) return { success: false, message: 'Leave request not found.' };

    const nowStr = new Date().toLocaleString();
    const nextStatus = target.requiresLevel2 ? 'pending_level_2' : 'approved';

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: nextStatus,
              level1Approval: {
                approverId: currentUser.id,
                approverName: currentUser.name,
                status: 'approved',
                comments,
                actionAt: nowStr
              }
            }
          : l
      )
    );

    // If fully approved now (no level 2 needed)
    if (nextStatus === 'approved') {
      finalizeLeaveApproval(target);
    }

    const nextApprover = users.find((u) => u.id === target.reviewingManagerId)?.name || 'Reviewing Manager';

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `✅ Leave Level-1 Approved: ${target.userName}`,
        message: `Level-1 Approval granted for *${target.userName}* by ${currentUser.name}.\n${
          nextStatus === 'pending_level_2'
            ? `➡️ Forwarded to *${nextApprover}* for Level-2 final approval.`
            : '🎉 Leave fully APPROVED!'
        }`,
        type: 'leave'
      },
      addSlackLog
    );

    // Send Automated Email Notification to Concerning Parties
    if (emailConfig.notifyOnLeaveApproval) {
      const applicant = users.find((u) => u.id === target.userId);
      const recipientEmail = target.userEmail || applicant?.email;

      if (nextStatus === 'approved') {
        // Sanction Order to Employee
        if (recipientEmail) {
          const approvedMail = buildLeaveApprovedEmail(
            { ...target, status: 'approved' },
            target.userName,
            currentUser.name,
            comments,
            'Level-1 Approving Authority'
          );
          triggerEmailDispatch({
            to: recipientEmail,
            toName: target.userName,
            toRole: 'Applicant',
            cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
            subject: approvedMail.subject,
            category: 'leave',
            eventType: 'LEAVE_SANCTION_ORDER',
            bodyHtml: approvedMail.html,
            bodyText: approvedMail.text,
            referenceId: target.id,
            referenceType: 'leave'
          });
        }
      } else {
        // Forwarded to Level 2
        const reviewingManager = users.find((u) => u.id === target.reviewingManagerId);
        if (reviewingManager?.email) {
          const l2Mail = buildLeaveForwardedL2Email(target, target.userName, currentUser.name, reviewingManager.name);
          triggerEmailDispatch({
            to: reviewingManager.email,
            toName: reviewingManager.name,
            toRole: 'Reviewing Officer / HoD',
            subject: l2Mail.subject,
            category: 'leave',
            eventType: 'LEAVE_FORWARDED_L2',
            bodyHtml: l2Mail.html,
            bodyText: l2Mail.text,
            referenceId: target.id,
            referenceType: 'leave'
          });
        }
      }
    }

    return {
      success: true,
      message: nextStatus === 'approved' ? 'Leave fully approved!' : `Level-1 approval done. Forwarded to Level-2 approver.`
    };
  };

  const rejectLeaveLevel1 = (id: string, comments: string = 'Rejected at Level-1 review.') => {
    const target = leaveRequests.find((l) => l.id === id);
    if (!target) return { success: false, message: 'Leave request not found.' };

    const nowStr = new Date().toLocaleString();

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'rejected',
              level1Approval: {
                approverId: currentUser.id,
                approverName: currentUser.name,
                status: 'rejected',
                comments,
                actionAt: nowStr
              }
            }
          : l
      )
    );

    // Revert pending balance
    revertPendingLeave(target.userId, target.leaveType, target.daysCount, target.startDate);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `❌ Leave Application Rejected (Level-1): ${target.userName}`,
        message: `Leave request for *${target.userName}* was *REJECTED* by Level-1 Approver ${currentUser.name}.\n_Reason:_ ${comments}`,
        type: 'leave'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnLeaveApproval) {
      const applicant = users.find((u) => u.id === target.userId);
      const recipientEmail = target.userEmail || applicant?.email;
      if (recipientEmail) {
        const rejectedMail = buildLeaveRejectedEmail(
          { ...target, status: 'rejected' },
          target.userName,
          currentUser.name,
          comments,
          'Level-1 Review'
        );
        triggerEmailDispatch({
          to: recipientEmail,
          toName: target.userName,
          toRole: 'Applicant',
          subject: rejectedMail.subject,
          category: 'leave',
          eventType: 'LEAVE_REJECTION_NOTICE',
          bodyHtml: rejectedMail.html,
          bodyText: rejectedMail.text,
          referenceId: target.id,
          referenceType: 'leave'
        });
      }
    }

    return { success: true, message: 'Leave request rejected.' };
  };

  const approveLeaveLevel2 = (id: string, comments: string = 'Level-2 final approval granted.') => {
    const target = leaveRequests.find((l) => l.id === id);
    if (!target) return { success: false, message: 'Leave request not found.' };

    const nowStr = new Date().toLocaleString();

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'approved',
              level2Approval: {
                approverId: currentUser.id,
                approverName: currentUser.name,
                status: 'approved',
                comments,
                actionAt: nowStr
              }
            }
          : l
      )
    );

    finalizeLeaveApproval(target);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🎉 Leave Final Approved (Level-2): ${target.userName}`,
        message: `Level-2 Final Approval granted for *${target.userName}* by Reviewing Manager ${currentUser.name}.\nLeave status updated to *APPROVED*.`,
        type: 'leave'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnLeaveApproval) {
      const applicant = users.find((u) => u.id === target.userId);
      const recipientEmail = target.userEmail || applicant?.email;
      if (recipientEmail) {
        const approvedMail = buildLeaveApprovedEmail(
          { ...target, status: 'approved' },
          target.userName,
          currentUser.name,
          comments,
          'Reviewing Authority / HoD (Level-2)'
        );
        triggerEmailDispatch({
          to: recipientEmail,
          toName: target.userName,
          toRole: 'Applicant',
          cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
          subject: approvedMail.subject,
          category: 'leave',
          eventType: 'LEAVE_SANCTION_ORDER_L2',
          bodyHtml: approvedMail.html,
          bodyText: approvedMail.text,
          referenceId: target.id,
          referenceType: 'leave'
        });
      }
    }

    return { success: true, message: 'Leave request fully approved at Level-2!' };
  };

  const rejectLeaveLevel2 = (id: string, comments: string = 'Rejected at Level-2 review.') => {
    const target = leaveRequests.find((l) => l.id === id);
    if (!target) return { success: false, message: 'Leave request not found.' };

    const nowStr = new Date().toLocaleString();

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'rejected',
              level2Approval: {
                approverId: currentUser.id,
                approverName: currentUser.name,
                status: 'rejected',
                comments,
                actionAt: nowStr
              }
            }
          : l
      )
    );

    revertPendingLeave(target.userId, target.leaveType, target.daysCount, target.startDate);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `❌ Leave Application Rejected (Level-2): ${target.userName}`,
        message: `Leave request for *${target.userName}* was *REJECTED* at Level-2 by ${currentUser.name}.\n_Reason:_ ${comments}`,
        type: 'leave'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnLeaveApproval) {
      const applicant = users.find((u) => u.id === target.userId);
      const recipientEmail = target.userEmail || applicant?.email;
      if (recipientEmail) {
        const rejectedMail = buildLeaveRejectedEmail(
          { ...target, status: 'rejected' },
          target.userName,
          currentUser.name,
          comments,
          'Level-2 Review (Reviewing Manager)'
        );
        triggerEmailDispatch({
          to: recipientEmail,
          toName: target.userName,
          toRole: 'Applicant',
          subject: rejectedMail.subject,
          category: 'leave',
          eventType: 'LEAVE_REJECTION_NOTICE_L2',
          bodyHtml: rejectedMail.html,
          bodyText: rejectedMail.text,
          referenceId: target.id,
          referenceType: 'leave'
        });
      }
    }

    return { success: true, message: 'Leave request rejected at Level-2.' };
  };

  const submitJoiningReport = (
    leaveId: string,
    reportData: {
      joiningDate: string;
      joiningSession: 'FN' | 'AN';
      stationReturned: boolean;
      remarks?: string;
      fitnessCertificateAttached?: boolean;
      fitnessCertificateName?: string;
      fitnessCertificateUrl?: string;
    }
  ) => {
    const target = leaveRequests.find((l) => l.id === leaveId);
    if (!target) return { success: false, message: 'Leave request not found.' };

    // 1. Requirement: Joining form is ONLY required/applicable for leaves with HoD approval
    const requiresHod = Boolean(target.requiresLevel2 || target.level2Approval || target.reviewingManagerId);
    if (!requiresHod) {
      return {
        success: false,
        message: 'Post-leave Joining Report is only required for leaves approved by HoD.'
      };
    }

    // 2. Requirement: Only the employee (user) who availed the leave can apply/submit
    if (target.userId !== currentUser.id && currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
      return {
        success: false,
        message: 'Only the employee who availed the leave can apply and submit their joining report.'
      };
    }

    const joiningReportId = `jr-${Date.now()}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Calculate expected regular resumption date (day after leave ends)
    const parts = target.endDate.split('-').map(Number);
    let expectedJoiningDate = target.endDate;
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      expectedJoiningDate = `${y}-${m}-${day}`;
    }

    const calculatedJoiningStatus: 'early' | 'on_time' | 'delayed' =
      reportData.joiningDate > expectedJoiningDate
        ? 'delayed'
        : reportData.joiningDate < expectedJoiningDate
        ? 'early'
        : 'on_time';

    const joiningReport: JoiningReport = {
      id: joiningReportId,
      leaveId: target.id,
      userId: target.userId,
      userName: target.userName,
      designation: target.designation,
      department: target.department,
      joiningDate: reportData.joiningDate,
      joiningSession: reportData.joiningSession,
      stationReturned: reportData.stationReturned,
      remarks: reportData.remarks,
      fitnessCertificateAttached: reportData.fitnessCertificateAttached,
      fitnessCertificateName: reportData.fitnessCertificateName,
      fitnessCertificateUrl: reportData.fitnessCertificateUrl,
      joiningStatus: calculatedJoiningStatus,
      submittedAt: nowStr,
      status: 'submitted'
    };

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === leaveId
          ? {
              ...l,
              joiningReport
            }
          : l
      )
    );

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: target.userName,
        title: `📋 Joining Report Submitted: ${target.userName}`,
        message: `Employee *${target.userName}* has submitted post-leave Joining Report for *${target.leaveTypeName}* (${target.startDate} to ${target.endDate}).\nReported Joining Date: *${reportData.joiningDate}* (${reportData.joiningSession === 'FN' ? 'Forenoon' : 'Afternoon'}).\nStatus: *Awaiting Reporting Manager Recommendation & Forwarding to HoD*.`,
        type: 'leave'
      },
      addSlackLog
    );

    return { success: true, message: 'Joining Report submitted successfully! Sent to Reporting Manager for forwarding.' };
  };

  const forwardJoiningReport = (
    leaveId: string,
    remarks: string = ''
  ) => {
    const target = leaveRequests.find((l) => l.id === leaveId);
    if (!target || !target.joiningReport) {
      return { success: false, message: 'Joining report not found for this leave request.' };
    }

    // Check authority: Reporting Manager or Admin
    const isReportingMgr =
      currentUser.id === target.reportingManagerId ||
      currentUser.role === 'admin' ||
      currentUser.role === 'administrator' ||
      currentUser.role === 'super_admin';

    if (!isReportingMgr) {
      return {
        success: false,
        message: 'Only the designated Reporting Manager can forward this joining report to the HoD.'
      };
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === leaveId && l.joiningReport
          ? {
              ...l,
              joiningReport: {
                ...l.joiningReport,
                status: 'forwarded',
                forwardedBy: currentUser.id,
                forwardedByName: currentUser.name,
                forwardedAt: nowStr,
                forwardRemarks: remarks
              }
            }
          : l
      )
    );

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `➡️ Joining Report Forwarded to HoD: ${target.userName}`,
        message: `Reporting Manager *${currentUser.name}* has recommended and forwarded the post-leave Joining Report of *${target.userName}* to the HoD for final acceptance.\nRemarks: ${remarks || 'Recommended for HoD acceptance.'}`,
        type: 'leave'
      },
      addSlackLog
    );

    return {
      success: true,
      message: 'Joining Report has been successfully forwarded to HoD for final approval.'
    };
  };

  const verifyJoiningReport = (
    leaveId: string,
    status: 'accepted' | 'rejected',
    remarks: string = ''
  ) => {
    const target = leaveRequests.find((l) => l.id === leaveId);
    if (!target || !target.joiningReport) {
      return { success: false, message: 'Joining report not found for this leave request.' };
    }

    // Check authority: HoD / Reviewing Authority or Admin
    const isHod =
      currentUser.id === target.reviewingManagerId ||
      currentUser.role === 'admin' ||
      currentUser.role === 'administrator' ||
      currentUser.role === 'super_admin' ||
      currentUser.role === 'director' ||
      currentUser.role === 'registrar' ||
      currentUser.roles?.includes('reviewing_manager') ||
      currentUser.roles?.includes('administrator');

    if (!isHod) {
      return {
        success: false,
        message: 'Only the HoD / Reviewing Authority can approve this joining report.'
      };
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === leaveId && l.joiningReport
          ? {
              ...l,
              joiningReport: {
                ...l.joiningReport,
                status,
                verifiedBy: currentUser.id,
                verifiedByName: currentUser.name,
                verifiedAt: nowStr,
                verificationRemarks: remarks
              }
            }
          : l
      )
    );

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `✅ Joining Report ${status === 'accepted' ? 'Accepted & Verified by HoD' : 'Rejected'}: ${target.userName}`,
        message: `Post-leave Joining Report for *${target.userName}* was *${status === 'accepted' ? 'APPROVED & ACCEPTED' : 'RETURNED'}* by HoD *${currentUser.name}*.\nRemarks: ${remarks || 'None'}`,
        type: 'leave'
      },
      addSlackLog
    );

    return {
      success: true,
      message: `Joining Report has been ${status === 'accepted' ? 'approved & accepted by HoD' : 'returned/rejected'}.`
    };
  };

  const finalizeLeaveApproval = (target: LeaveRequest) => {
    // 1. Update balances for the year of target.startDate (move pending to used)
    const leaveYear = target.startDate ? target.startDate.slice(0, 4) : new Date().getFullYear().toString();
    const curYearStr = new Date().getFullYear().toString();

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === target.userId) {
          const userYearly = u.yearlyLeaveBalances || {};
          const yearBalObj = userYearly[leaveYear] || u.leaveBalances || {};
          const currentBal = yearBalObj[target.leaveType] || { total: 10, used: 0, pending: 0 };

          const updatedYearBal = {
            ...yearBalObj,
            [target.leaveType]: {
              ...currentBal,
              used: currentBal.used + target.daysCount,
              pending: Math.max(0, currentBal.pending - target.daysCount)
            }
          };

          const isCurrentYear = leaveYear === curYearStr;
          const updatedCurrentBal = isCurrentYear
            ? {
                ...u.leaveBalances,
                [target.leaveType]: {
                  ...(u.leaveBalances[target.leaveType] || currentBal),
                  used: (u.leaveBalances[target.leaveType]?.used || 0) + target.daysCount,
                  pending: Math.max(0, (u.leaveBalances[target.leaveType]?.pending || 0) - target.daysCount)
                }
              }
            : u.leaveBalances;

          return {
            ...u,
            leaveBalances: updatedCurrentBal,
            yearlyLeaveBalances: {
              ...userYearly,
              [leaveYear]: updatedYearBal
            }
          };
        }
        return u;
      })
    );

    // 2. Sync attendance calendar for leave dates
    setAttendanceRecords((prev) => {
      const updated = [...prev];
      const start = new Date(target.startDate);
      const end = new Date(target.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const idx = updated.findIndex((a) => a.userId === target.userId && a.date === dateStr);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            workMode: 'on_leave',
            status: 'leave',
            notes: `Approved Leave: ${target.leaveTypeName}`
          };
        } else {
          updated.push({
            id: `att-${target.userId}-${dateStr}`,
            userId: target.userId,
            date: dateStr,
            clockIn: '-',
            clockOut: '-',
            workMode: 'on_leave',
            status: 'leave',
            totalHours: 0,
            notes: `Approved Leave: ${target.leaveTypeName}`
          });
        }
      }
      return updated;
    });
  };

  const revertPendingLeave = (userId: string, leaveType: string, daysCount: number, startDate?: string) => {
    const leaveYear = startDate ? startDate.slice(0, 4) : new Date().getFullYear().toString();
    const curYearStr = new Date().getFullYear().toString();

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const userYearly = u.yearlyLeaveBalances || {};
          const yearBalObj = userYearly[leaveYear] || u.leaveBalances || {};
          const currentBal = yearBalObj[leaveType] || { total: 10, used: 0, pending: 0 };

          const updatedYearBal = {
            ...yearBalObj,
            [leaveType]: {
              ...currentBal,
              pending: Math.max(0, currentBal.pending - daysCount)
            }
          };

          const isCurrentYear = leaveYear === curYearStr;
          const updatedCurrentBal = isCurrentYear
            ? {
                ...u.leaveBalances,
                [leaveType]: {
                  ...(u.leaveBalances[leaveType] || currentBal),
                  pending: Math.max(0, (u.leaveBalances[leaveType]?.pending || 0) - daysCount)
                }
              }
            : u.leaveBalances;

          return {
            ...u,
            leaveBalances: updatedCurrentBal,
            yearlyLeaveBalances: {
              ...userYearly,
              [leaveYear]: updatedYearBal
            }
          };
        }
        return u;
      })
    );
  };

  // --- PROFILE ACTIONS ---
  const updateUserProfile = (userId: string, updatedFields: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            ...updatedFields
          };
        }
        return u;
      })
    );
  };

  const addUserProfile = (newUser: Omit<User, 'id' | 'leaveBalances'>): User => {
    const newId = `usr-${Date.now().toString().slice(-4)}`;
    
    let defaultBalances = {
      casual: { total: 12, used: 0, pending: 0 },
      earned: { total: 30, used: 0, pending: 0 },
      half_pay: { total: 20, used: 0, pending: 0 },
      restricted: { total: 2, used: 0, pending: 0 }
    };

    if (newUser.employmentType === 'contractual') {
      defaultBalances = {
        casual: { total: 8, used: 0, pending: 0 },
        sick: { total: 6, used: 0, pending: 0 }
      } as any;
    } else if (newUser.employmentType === 'researcher') {
      defaultBalances = {
        casual: { total: 10, used: 0, pending: 0 },
        field_work: { total: 30, used: 0, pending: 0 },
        academic: { total: 15, used: 0, pending: 0 }
      } as any;
    } else if (
      newUser.employmentType === 'diploma_trainee' ||
      newUser.employmentType === 'intern' ||
      newUser.employmentType === 'bsc_msc_student' ||
      newUser.employmentType === 'phd_student'
    ) {
      defaultBalances = {
        stipend_off: { total: 6, used: 0, pending: 0 },
        contingency: { total: 5, used: 0, pending: 0 }
      } as any;
    }

    const createdUser: User = {
      ...newUser,
      id: newId,
      baseRole: newUser.role,
      leaveBalances: defaultBalances
    };

    setUsers((prev) => [...prev, createdUser]);

    // Send Automated Email Notification to Concerning Parties (New User & Supervisor)
    if (emailConfig.notifyOnUserCreation && createdUser.email) {
      const reportingMgr = users.find((u) => u.id === createdUser.reportingManagerId);
      const welcomeMail = buildUserWelcomeEmail({
        name: createdUser.name,
        email: createdUser.email,
        designation: createdUser.designation,
        department: createdUser.department,
        biometricId: createdUser.biometricId,
        reportingManagerName: reportingMgr?.name
      });
      triggerEmailDispatch({
        to: createdUser.email,
        toName: createdUser.name,
        toRole: 'New Appointee',
        cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
        subject: welcomeMail.subject,
        category: 'user_management',
        eventType: 'USER_ONBOARDING_WELCOME',
        bodyHtml: welcomeMail.html,
        bodyText: welcomeMail.text,
        referenceId: createdUser.id,
        referenceType: 'user'
      });

      if (reportingMgr?.email) {
        const mgrMail = buildSupervisorNewReporteeEmail({
          managerName: reportingMgr.name,
          employeeName: createdUser.name,
          employeeEmail: createdUser.email,
          designation: createdUser.designation,
          department: createdUser.department,
          employmentType: createdUser.employmentType
        });
        triggerEmailDispatch({
          to: reportingMgr.email,
          toName: reportingMgr.name,
          toRole: 'Reporting Officer',
          subject: mgrMail.subject,
          category: 'user_management',
          eventType: 'SUPERVISOR_NEW_REPORTEE_NOTICE',
          bodyHtml: mgrMail.html,
          bodyText: mgrMail.text,
          referenceId: createdUser.id,
          referenceType: 'user'
        });
      }
    }

    return createdUser;
  };

  // --- ADMIN ACTIONS ---
  const updateUserRoleAndHierarchy = (
    userId: string,
    role: UserRole,
    employmentType: EmploymentType,
    reportingManagerId?: string,
    reviewingManagerId?: string,
    roles?: UserRole[]
  ) => {
    const assignedRoles = roles && roles.length > 0 ? roles : [role];
    const primaryRole = assignedRoles[0] || role;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            role: primaryRole,
            roles: assignedRoles,
            baseRole: primaryRole,
            employmentType,
            reportingManagerId,
            reviewingManagerId
          };
        }
        return u;
      })
    );

    const targetUser = users.find((u) => u.id === userId);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `⚙️ Role Hierarchy Updated by Admin`,
        message: `Admin *${currentUser.name}* updated roles for *${targetUser?.name || userId}*:\n*Roles:* \`${assignedRoles.join(', ').toUpperCase()}\` | *Employment:* \`${employmentType.toUpperCase()}\``,
        type: 'role_change'
      },
      addSlackLog
    );
  };

  const toggleUserStatus = (userId: string, reason?: string, effectiveDate?: string) => {
    let targetUser: User | undefined;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          targetUser = u;
          const newStatus = u.status === 'deactivated' ? 'active' : 'deactivated';
          return { ...u, status: newStatus };
        }
        return u;
      })
    );

    if (targetUser) {
      const isActivating = targetUser.status === 'deactivated';
      const actionTitle = isActivating ? '🟢 User Account Reactivated' : '🔴 User Account Deactivated';
      sendSlackNotification(
        slackConfig,
        {
          channel: '#leave-and-attendance-logs',
          sender: currentUser.name,
          title: actionTitle,
          message: `Admin *${currentUser.name}* ${isActivating ? 'reactivated' : 'deactivated'} account for *${targetUser.name}* (${targetUser.email}).${reason ? `\n*Reason/Remarks:* ${reason}` : ''}${effectiveDate ? ` | *Effective:* ${effectiveDate}` : ''}`,
          type: 'system'
        },
        addSlackLog
      );
    }
  };

  const deleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // --- MULTI-MODULE ROLES ACTIONS ---
  const updateUserModuleRoles = (userId: string, moduleRoles: UserModuleRoles) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            moduleRoles
          };
        }
        return u;
      })
    );
    const target = users.find((u) => u.id === userId);
    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🛡️ Multi-Module Roles Reconfigured`,
        message: `Admin *${currentUser.name}* updated cross-module permissions for *${target?.name || userId}* across 5 Institutional Modules.`,
        type: 'role_change'
      },
      addSlackLog
    );
    return { success: true, message: 'Updated cross-module roles successfully.' };
  };

  const toggleUserModuleRole = (userId: string, moduleId: EnterpriseModuleId, roleId: string) => {
    let updatedModuleRoles: UserModuleRoles = {};
    let isNowAssigned = false;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const currentModuleRoles = u.moduleRoles || {};
          const currentRolesInModule = currentModuleRoles[moduleId] || getUserModuleRoles(u, moduleId);
          const hasRole = currentRolesInModule.includes(roleId);
          isNowAssigned = !hasRole;

          const newRolesInModule = hasRole
            ? currentRolesInModule.filter((r) => r !== roleId)
            : [...currentRolesInModule, roleId];

          updatedModuleRoles = {
            ...currentModuleRoles,
            [moduleId]: newRolesInModule
          };

          return {
            ...u,
            moduleRoles: updatedModuleRoles
          };
        }
        return u;
      })
    );

    return { 
      success: true, 
      message: `${isNowAssigned ? 'Assigned' : 'Revoked'} role '${roleId}' in module ${moduleId.toUpperCase()}.` 
    };
  };

  const bulkAssignModuleRole = (userIds: string[], moduleId: EnterpriseModuleId, roleId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (userIds.includes(u.id)) {
          const currentModuleRoles = u.moduleRoles || {};
          const currentRolesInModule = currentModuleRoles[moduleId] || getUserModuleRoles(u, moduleId);
          if (!currentRolesInModule.includes(roleId)) {
            return {
              ...u,
              moduleRoles: {
                ...currentModuleRoles,
                [moduleId]: [...currentRolesInModule, roleId]
              }
            };
          }
        }
        return u;
      })
    );
    return { success: true, message: `Assigned role ${roleId} to ${userIds.length} users in ${moduleId.toUpperCase()}.` };
  };

  const resetUserPassword = (userId: string, customPass?: string, reason?: string): string => {
    const tempPass = customPass && customPass.trim() ? customPass.trim() : `WII#${Math.floor(100000 + Math.random() * 900000)}`;
    const targetUser = users.find((u) => u.id === userId);
    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🔑 Password Reset Initiated`,
        message: `Admin *${currentUser.name}* reset password for *${targetUser?.name || userId}*. Credentials dispatched.${reason ? `\n*Reason:* ${reason}` : ''}`,
        type: 'system'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnPasswordReset && targetUser?.email) {
      const pwdMail = buildPasswordResetEmail({
        name: targetUser.name,
        email: targetUser.email,
        tempPass,
        adminName: currentUser.name,
        reason
      });
      triggerEmailDispatch({
        to: targetUser.email,
        toName: targetUser.name,
        toRole: 'Employee',
        cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
        subject: pwdMail.subject,
        category: 'user_management',
        eventType: 'SECURITY_PASSWORD_RESET',
        bodyHtml: pwdMail.html,
        bodyText: pwdMail.text,
        referenceId: targetUser.id,
        referenceType: 'user'
      });
    }

    return tempPass;
  };

  const transferUser = (
    userId: string,
    data: {
      newDept: string;
      newReportingManagerId?: string;
      newReviewingManagerId?: string;
      newLocation?: string;
      effectiveDate: string;
      notes: string;
    }
  ) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const oldDept = targetUser.department;
    const oldReportingMgr = users.find((u) => u.id === targetUser.reportingManagerId)?.name || 'None';
    const newReportingMgr = users.find((u) => u.id === data.newReportingManagerId)?.name || 'None';

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            department: data.newDept,
            reportingManagerId: data.newReportingManagerId || u.reportingManagerId,
            reviewingManagerId: data.newReviewingManagerId || u.reviewingManagerId,
            officeLocation: data.newLocation || u.officeLocation
          };
        }
        return u;
      })
    );

    const newLog: UserTransferLog = {
      id: `trf-${Date.now()}`,
      userId,
      userName: targetUser.name,
      previousDept: oldDept,
      newDept: data.newDept,
      previousManagerName: oldReportingMgr,
      newManagerName: newReportingMgr,
      effectiveDate: data.effectiveDate,
      notes: data.notes || 'Inter-departmental posting/transfer',
      transferredBy: currentUser.name,
      timestamp: new Date().toLocaleString()
    };

    setTransferLogs((prev) => [newLog, ...prev]);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🔄 Employee Transfer Executed`,
        message: `*${targetUser.name}* transferred from *${oldDept}* to *${data.newDept}* (Manager: ${newReportingMgr}). Effective date: ${data.effectiveDate}.`,
        type: 'role_change'
      },
      addSlackLog
    );

    // Send Automated Email Notification to Transferred Employee, Incoming Manager & Relieving Manager
    if (emailConfig.notifyOnTransfer) {
      const outgoingMgrObj = users.find((u) => u.id === targetUser.reportingManagerId);
      const incomingMgrObj = data.newReportingManagerId ? users.find((u) => u.id === data.newReportingManagerId) : undefined;
      const orderRef = `WII/EST/TRF/${new Date().getFullYear()}/${newLog.id.slice(-4)}`;

      // 1. Email to Employee
      if (targetUser.email) {
        const empMail = buildTransferOrderEmail(
          {
            orderNumber: orderRef,
            employeeName: targetUser.name,
            employeeEmail: targetUser.email,
            designation: targetUser.designation,
            previousDepartment: oldDept,
            newDepartment: data.newDept,
            previousManagerName: oldReportingMgr,
            newManagerName: newReportingMgr,
            effectiveDate: data.effectiveDate,
            stationLocation: data.newLocation || targetUser.officeLocation || 'Main Campus',
            remarks: data.notes || 'Inter-departmental transfer order',
            issuingAuthority: currentUser.name
          },
          'employee'
        );
        triggerEmailDispatch({
          to: targetUser.email,
          toName: targetUser.name,
          toRole: 'Transferred Official',
          cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
          subject: empMail.subject,
          category: 'transfer',
          eventType: 'EMPLOYEE_TRANSFER_ORDER',
          bodyHtml: empMail.html,
          bodyText: empMail.text,
          referenceId: newLog.id,
          referenceType: 'transfer'
        });
      }

      // 2. Email to Incoming Manager
      if (incomingMgrObj?.email && incomingMgrObj.id !== targetUser.id) {
        const inMgrMail = buildTransferOrderEmail(
          {
            orderNumber: orderRef,
            employeeName: targetUser.name,
            employeeEmail: targetUser.email,
            designation: targetUser.designation,
            previousDepartment: oldDept,
            newDepartment: data.newDept,
            previousManagerName: oldReportingMgr,
            newManagerName: newReportingMgr,
            effectiveDate: data.effectiveDate,
            stationLocation: data.newLocation || targetUser.officeLocation || 'Main Campus',
            remarks: data.notes || 'Inter-departmental transfer order',
            issuingAuthority: currentUser.name
          },
          'incoming_manager'
        );
        triggerEmailDispatch({
          to: incomingMgrObj.email,
          toName: incomingMgrObj.name,
          toRole: 'Incoming Reporting Officer',
          subject: inMgrMail.subject,
          category: 'transfer',
          eventType: 'TRANSFER_INCOMING_MANAGER_NOTICE',
          bodyHtml: inMgrMail.html,
          bodyText: inMgrMail.text,
          referenceId: newLog.id,
          referenceType: 'transfer'
        });
      }

      // 3. Email to Outgoing Manager (Relieving Notice)
      if (outgoingMgrObj?.email && outgoingMgrObj.id !== incomingMgrObj?.id && outgoingMgrObj.id !== targetUser.id) {
        const outMgrMail = buildTransferOrderEmail(
          {
            orderNumber: orderRef,
            employeeName: targetUser.name,
            employeeEmail: targetUser.email,
            designation: targetUser.designation,
            previousDepartment: oldDept,
            newDepartment: data.newDept,
            previousManagerName: oldReportingMgr,
            newManagerName: newReportingMgr,
            effectiveDate: data.effectiveDate,
            stationLocation: data.newLocation || targetUser.officeLocation || 'Main Campus',
            remarks: data.notes || 'Inter-departmental transfer order',
            issuingAuthority: currentUser.name
          },
          'outgoing_manager'
        );
        triggerEmailDispatch({
          to: outgoingMgrObj.email,
          toName: outgoingMgrObj.name,
          toRole: 'Relieving Officer',
          subject: outMgrMail.subject,
          category: 'transfer',
          eventType: 'TRANSFER_RELIEVING_ORDER',
          bodyHtml: outMgrMail.html,
          bodyText: outMgrMail.text,
          referenceId: newLog.id,
          referenceType: 'transfer'
        });
      }
    }
  };

  const bulkTransferUsers = (
    userIds: string[],
    data: {
      newDept?: string;
      newReportingManagerId?: string;
      newReviewingManagerId?: string;
      newLocation?: string;
      effectiveDate: string;
      notes: string;
    }
  ) => {
    if (!userIds || userIds.length === 0) {
      return { success: false, count: 0, message: 'No employees selected for transfer.' };
    }

    const newLogs: UserTransferLog[] = [];
    const newReportingMgrObj = data.newReportingManagerId ? users.find((u) => u.id === data.newReportingManagerId) : undefined;
    const newReportingMgrName = newReportingMgrObj ? newReportingMgrObj.name : 'Unchanged / Direct';

    setUsers((prev) =>
      prev.map((u) => {
        if (userIds.includes(u.id)) {
          const oldDept = u.department;
          const oldReportingMgr = users.find((m) => m.id === u.reportingManagerId)?.name || 'None';
          const targetDept = data.newDept && data.newDept.trim() ? data.newDept.trim() : u.department;

          newLogs.push({
            id: `trf-${Date.now()}-${u.id}`,
            userId: u.id,
            userName: u.name,
            previousDept: oldDept,
            newDept: targetDept,
            previousManagerName: oldReportingMgr,
            newManagerName: newReportingMgrObj ? newReportingMgrObj.name : oldReportingMgr,
            effectiveDate: data.effectiveDate,
            notes: data.notes ? `[Bulk Transfer] ${data.notes}` : 'Bulk departmental transfer',
            transferredBy: currentUser.name,
            timestamp: new Date().toLocaleString()
          });

          return {
            ...u,
            department: targetDept,
            reportingManagerId: data.newReportingManagerId || u.reportingManagerId,
            reviewingManagerId: data.newReviewingManagerId || u.reviewingManagerId,
            officeLocation: data.newLocation || u.officeLocation
          };
        }
        return u;
      })
    );

    setTransferLogs((prev) => [...newLogs, ...prev]);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🔄 Bulk Employee Transfer Executed (${userIds.length} Staff)`,
        message: `Admin *${currentUser.name}* transferred *${userIds.length} employee(s)*.${data.newDept ? ` New Dept: *${data.newDept}*` : ''}${newReportingMgrObj ? ` | New Reporting Manager: *${newReportingMgrName}*` : ''}. Effective: ${data.effectiveDate}.`,
        type: 'role_change'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnTransfer) {
      newLogs.forEach((log) => {
        const transferredUser = users.find((u) => u.id === log.userId);
        if (transferredUser?.email) {
          const empMail = buildTransferOrderEmail(
            {
              orderNumber: `WII/EST/TRF/${new Date().getFullYear()}/${log.id.slice(-4)}`,
              employeeName: transferredUser.name,
              employeeEmail: transferredUser.email,
              designation: transferredUser.designation,
              previousDepartment: log.previousDept,
              newDepartment: log.newDept,
              previousManagerName: log.previousManagerName,
              newManagerName: log.newManagerName,
              effectiveDate: log.effectiveDate,
              stationLocation: data.newLocation || transferredUser.officeLocation || 'Main Campus',
              remarks: log.notes,
              issuingAuthority: currentUser.name
            },
            'employee'
          );
          triggerEmailDispatch({
            to: transferredUser.email,
            toName: transferredUser.name,
            toRole: 'Transferred Official',
            cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
            subject: empMail.subject,
            category: 'transfer',
            eventType: 'EMPLOYEE_TRANSFER_ORDER',
            bodyHtml: empMail.html,
            bodyText: empMail.text,
            referenceId: log.id,
            referenceType: 'transfer'
          });
        }
      });

      if (newReportingMgrObj?.email) {
        const mgrMail = buildTransferOrderEmail(
          {
            orderNumber: `WII/EST/BULK-TRF/${new Date().getFullYear()}`,
            employeeName: `${userIds.length} Appointed Staff Members`,
            employeeEmail: newReportingMgrObj.email,
            designation: 'Various Appointees',
            previousDepartment: 'Various Divisions',
            newDepartment: data.newDept || 'Assigned Division',
            previousManagerName: 'Outgoing Supervisors',
            newManagerName: newReportingMgrName,
            effectiveDate: data.effectiveDate,
            stationLocation: data.newLocation || 'Main Campus',
            remarks: `Bulk transfer assignment of ${userIds.length} officers under your supervisory reporting line.`,
            issuingAuthority: currentUser.name
          },
          'incoming_manager'
        );
        triggerEmailDispatch({
          to: newReportingMgrObj.email,
          toName: newReportingMgrObj.name,
          toRole: 'Incoming Reporting Officer',
          subject: mgrMail.subject,
          category: 'transfer',
          eventType: 'TRANSFER_INCOMING_MANAGER_NOTICE',
          bodyHtml: mgrMail.html,
          bodyText: mgrMail.text,
          referenceId: `bulk-trf-${Date.now()}`,
          referenceType: 'transfer'
        });
      }
    }

    return {
      success: true,
      count: userIds.length,
      message: `Successfully transferred ${userIds.length} employee(s) with updated hierarchy records.`
    };
  };

  const bulkReassignManager = (data: {
    outgoingManagerId: string;
    incomingManagerId: string;
    reassignType: 'reporting' | 'reviewing' | 'both';
    selectedUserIds?: string[];
    effectiveDate: string;
    notes: string;
  }) => {
    const outgoingMgr = users.find((u) => u.id === data.outgoingManagerId);
    const incomingMgr = users.find((u) => u.id === data.incomingManagerId);

    if (!outgoingMgr || !incomingMgr) {
      return { success: false, count: 0, message: 'Invalid manager selection.' };
    }

    if (data.outgoingManagerId === data.incomingManagerId) {
      return { success: false, count: 0, message: 'Outgoing and Incoming managers must be different.' };
    }

    const newLogs: UserTransferLog[] = [];
    let affectedCount = 0;

    setUsers((prev) =>
      prev.map((u) => {
        // Skip if specifically filtering reportees and user is not in selected list
        if (data.selectedUserIds && data.selectedUserIds.length > 0 && !data.selectedUserIds.includes(u.id)) {
          return u;
        }

        let isMatchesReporting = u.reportingManagerId === data.outgoingManagerId;
        let isMatchesReviewing = u.reviewingManagerId === data.outgoingManagerId || u.hodName === outgoingMgr.name;

        if (data.reassignType === 'reporting') isMatchesReviewing = false;
        if (data.reassignType === 'reviewing') isMatchesReporting = false;

        if (isMatchesReporting || isMatchesReviewing) {
          affectedCount++;
          const prevL1 = users.find((m) => m.id === u.reportingManagerId)?.name || 'None';

          newLogs.push({
            id: `trf-mgr-${Date.now()}-${u.id}`,
            userId: u.id,
            userName: u.name,
            previousDept: u.department,
            newDept: u.department,
            previousManagerName: outgoingMgr.name,
            newManagerName: incomingMgr.name,
            effectiveDate: data.effectiveDate,
            notes: data.notes ? `[Manager Re-mapping] ${data.notes}` : `Bulk Manager Transition from ${outgoingMgr.name} to ${incomingMgr.name}`,
            transferredBy: currentUser.name,
            timestamp: new Date().toLocaleString()
          });

          return {
            ...u,
            reportingManagerId: isMatchesReporting || data.reassignType === 'both' ? incomingMgr.id : u.reportingManagerId,
            reviewingManagerId: isMatchesReviewing || data.reassignType === 'both' ? incomingMgr.id : u.reviewingManagerId,
            hodName: isMatchesReviewing || data.reassignType === 'both' ? incomingMgr.name : u.hodName
          };
        }
        return u;
      })
    );

    if (affectedCount === 0) {
      return { success: false, count: 0, message: `No direct reportees found under ${outgoingMgr.name} for the selected transition type.` };
    }

    setTransferLogs((prev) => [...newLogs, ...prev]);

    sendSlackNotification(
      slackConfig,
      {
        channel: '#leave-and-attendance-logs',
        sender: currentUser.name,
        title: `🔀 Manager Hierarchy Re-assigned (${affectedCount} Direct Reportees)`,
        message: `Admin *${currentUser.name}* executed bulk manager migration: All reportees under *${outgoingMgr.name}* (${outgoingMgr.designation}) have been re-assigned to *${incomingMgr.name}* (${incomingMgr.designation}). Effective: ${data.effectiveDate}.`,
        type: 'role_change'
      },
      addSlackLog
    );

    if (emailConfig.notifyOnTransfer) {
      // 1. Email to Incoming Manager
      if (incomingMgr.email) {
        const incMail = buildManagerMigrationEmail({
          incomingManagerName: incomingMgr.name,
          outgoingManagerName: outgoingMgr.name,
          effectiveDate: data.effectiveDate,
          reassignType: data.reassignType,
          reporteesCount: affectedCount,
          reporteeNames: newLogs.map((l) => l.userName),
          adminName: currentUser.name,
          notes: data.notes
        });
        triggerEmailDispatch({
          to: incomingMgr.email,
          toName: incomingMgr.name,
          toRole: 'Incoming Manager',
          cc: emailConfig.adminCcEmail ? [emailConfig.adminCcEmail] : undefined,
          subject: incMail.subject,
          category: 'transfer',
          eventType: 'MANAGER_MIGRATION_INCOMING',
          bodyHtml: incMail.html,
          bodyText: incMail.text,
          referenceId: `mgr-reassign-${Date.now()}`,
          referenceType: 'transfer'
        });
      }

      // 2. Email to Outgoing Manager
      if (outgoingMgr.email) {
        const outMail = buildRelievingManagerNoticeEmail({
          outgoingManagerName: outgoingMgr.name,
          incomingManagerName: incomingMgr.name,
          effectiveDate: data.effectiveDate,
          reassignType: data.reassignType,
          reporteesCount: affectedCount,
          reporteeNames: newLogs.map((l) => l.userName),
          adminName: currentUser.name,
          notes: data.notes
        });
        triggerEmailDispatch({
          to: outgoingMgr.email,
          toName: outgoingMgr.name,
          toRole: 'Relieved Manager',
          subject: outMail.subject,
          category: 'transfer',
          eventType: 'MANAGER_MIGRATION_OUTGOING',
          bodyHtml: outMail.html,
          bodyText: outMail.text,
          referenceId: `mgr-reassign-${Date.now()}`,
          referenceType: 'transfer'
        });
      }

      // 3. Notification to Affected Reportees
      newLogs.forEach((log) => {
        const reportee = users.find((u) => u.id === log.userId);
        if (reportee?.email) {
          const reporteeMail = buildReporteeManagerTransitionEmail({
            employeeName: reportee.name,
            outgoingManagerName: outgoingMgr.name,
            incomingManagerName: incomingMgr.name,
            effectiveDate: data.effectiveDate,
            reassignType: data.reassignType,
            notes: data.notes
          });
          triggerEmailDispatch({
            to: reportee.email,
            toName: reportee.name,
            toRole: 'Employee',
            subject: reporteeMail.subject,
            category: 'transfer',
            eventType: 'REPORTEE_MANAGER_TRANSITION',
            bodyHtml: reporteeMail.html,
            bodyText: reporteeMail.text,
            referenceId: log.id,
            referenceType: 'transfer'
          });
        }
      });
    }

    return {
      success: true,
      count: affectedCount,
      message: `Successfully re-assigned ${affectedCount} reportees from ${outgoingMgr.name} to ${incomingMgr.name}.`
    };
  };

  const updateSlackConfig = (newConfig: SlackConfig) => {
    setSlackConfig(newConfig);
    sendSlackNotification(
      newConfig,
      {
        channel: newConfig.defaultChannel,
        sender: currentUser.name,
        title: `⚙️ Slack Webhook Settings Updated`,
        message: `Slack Integration configuration updated by *${currentUser.name}*. Webhooks active: *${newConfig.enableSlackNotifications}*.`,
        type: 'system'
      },
      addSlackLog
    );
  };

  const [holidays, setHolidays] = useState<HolidayItem[]>(() => {
    const saved = localStorage.getItem('la_hub_holidays');
    return saved ? JSON.parse(saved) : INITIAL_HOLIDAYS;
  });

  useEffect(() => {
    localStorage.setItem('la_hub_holidays', JSON.stringify(holidays));
  }, [holidays]);

  const addHoliday = (data: Omit<HolidayItem, 'id' | 'year' | 'month' | 'dayOfWeek'> & Partial<Pick<HolidayItem, 'year' | 'month' | 'dayOfWeek' | 'isLongWeekend'>>) => {
    if (!data.name || !data.date) {
      return { success: false, message: 'Holiday name and date are required.' };
    }

    const dateObj = new Date(data.date + 'T00:00:00');
    const year = data.year || dateObj.getFullYear();
    const month = data.month || (dateObj.getMonth() + 1);
    const dayOfWeek = data.dayOfWeek || dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const isLongWeekend = data.isLongWeekend !== undefined 
      ? data.isLongWeekend 
      : (dayOfWeek === 'Friday' || dayOfWeek === 'Monday' || dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday');

    const prefix = data.type === 'gazetted' ? 'gh' : data.type === 'restricted' ? 'rh' : 'lh';
    const newHoliday: HolidayItem = {
      id: `${prefix}-${year}-${Date.now().toString(36)}`,
      name: data.name.trim(),
      hindiName: data.hindiName?.trim() || undefined,
      date: data.date,
      dayOfWeek,
      type: data.type,
      category: data.category,
      description: data.description?.trim() || `${data.name} (${dayOfWeek})`,
      year,
      month,
      isLongWeekend
    };

    setHolidays((prev) => [...prev, newHoliday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

    return { 
      success: true, 
      message: `Holiday "${newHoliday.name}" (${newHoliday.date}) added successfully.`,
      holiday: newHoliday 
    };
  };

  const updateHoliday = (id: string, updatedFields: Partial<HolidayItem>) => {
    const existing = holidays.find((h) => h.id === id);
    if (!existing) {
      return { success: false, message: 'Holiday not found.' };
    }

    let updatedDayOfWeek = updatedFields.dayOfWeek || existing.dayOfWeek;
    let updatedYear = updatedFields.year || existing.year;
    let updatedMonth = updatedFields.month || existing.month;
    let updatedIsLongWeekend = updatedFields.isLongWeekend !== undefined ? updatedFields.isLongWeekend : existing.isLongWeekend;

    if (updatedFields.date && updatedFields.date !== existing.date) {
      const dateObj = new Date(updatedFields.date + 'T00:00:00');
      updatedYear = dateObj.getFullYear();
      updatedMonth = dateObj.getMonth() + 1;
      updatedDayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      if (updatedFields.isLongWeekend === undefined) {
        updatedIsLongWeekend = (updatedDayOfWeek === 'Friday' || updatedDayOfWeek === 'Monday' || updatedDayOfWeek === 'Saturday' || updatedDayOfWeek === 'Sunday');
      }
    }

    setHolidays((prev) =>
      prev.map((h) => {
        if (h.id === id) {
          return {
            ...h,
            ...updatedFields,
            date: updatedFields.date || h.date,
            dayOfWeek: updatedDayOfWeek,
            year: updatedYear,
            month: updatedMonth,
            isLongWeekend: updatedIsLongWeekend
          };
        }
        return h;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );

    return { success: true, message: `Holiday "${updatedFields.name || existing.name}" updated successfully.` };
  };

  const deleteHoliday = (id: string) => {
    const target = holidays.find((h) => h.id === id);
    if (!target) {
      return { success: false, message: 'Holiday not found.' };
    }

    setHolidays((prev) => prev.filter((h) => h.id !== id));
    return { success: true, message: `Holiday "${target.name}" deleted successfully.` };
  };

  const resetHolidays = () => {
    setHolidays(INITIAL_HOLIDAYS);
    localStorage.removeItem('la_hub_holidays');
  };

  const addProjectHistory = (data: Omit<UserProjectHistory, 'id'>) => {
    const newEntry: UserProjectHistory = {
      ...data,
      id: `proj-hist-${Date.now()}`
    };
    setProjectHistories((prev) => [newEntry, ...prev]);
    return { success: true, message: `Project assignment entry "${data.projectName}" recorded successfully.` };
  };

  const updateProjectHistory = (id: string, data: Partial<UserProjectHistory>) => {
    setProjectHistories((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...data } : item))
    );
    return { success: true, message: 'Project history record updated successfully.' };
  };

  const deleteProjectHistory = (id: string) => {
    setProjectHistories((prev) => prev.filter((item) => item.id !== id));
    return { success: true, message: 'Project history record removed.' };
  };

  const getUserProjectHistories = (userId: string) => {
    return projectHistories.filter((item) => item.userId === userId);
  };

  const resetAllData = () => {
    localStorage.clear();
    setUsers(INITIAL_USERS);
    setCurrentUserId('usr-1');
    setAttendanceRecords(generateSeedAttendance());
    setOdRequests(INITIAL_OD_REQUESTS);
    setManualAttendanceRequests(INITIAL_MANUAL_ATTENDANCE_REQUESTS);
    setLeaveRequests(INITIAL_LEAVE_REQUESTS);
    setSlackConfig(INITIAL_SLACK_CONFIG);
    setHolidays(INITIAL_HOLIDAYS);
    setShifts(INITIAL_SHIFTS);
    setProjectHistories(INITIAL_PROJECT_HISTORIES);
    setSlackLogs([
      {
        id: 'slk-init-reset',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        channel: '#leave-and-attendance-logs',
        sender: 'System Admin',
        title: '🔄 Data Reset to Seed Defaults',
        message: 'All attendance, leave, and OD demo records restored to default baseline.',
        type: 'system',
        deliveredStatus: 'simulated'
      }
    ]);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        isAuthenticated,
        login,
        loginAsUser,
        logout,
        setCurrentUserId,
        switchRoleOverride,
        attendanceRecords,
        manualAttendanceRequests,
        odRequests,
        leaveRequests,
        leavePolicies,
        updateLeavePolicy,
        addLeavePolicy,
        deleteLeavePolicy,
        toggleEmployeeTypeForLeave,
        resetLeavePoliciesToDefault,
        slackConfig,
        slackLogs,
        shifts,
        addShift,
        updateShift,
        deleteShift,
        setDefaultShift,
        assignUserShift,
        bulkAssignUserShift,
        getUserShift,
        calculateShiftTiming,
        clockInToday,
        clockOutToday,
        getVisibleAttendanceRecords,
        applyManualAttendance,
        editManualAttendance,
        deleteManualAttendance,
        approveRejectManualAttendance,
        cancelApprovedManualAttendance,
        applyOutdoorDuty,
        editOutdoorDuty,
        deleteOutdoorDuty,
        approveOutdoorDuty,
        rejectOutdoorDuty,
        cancelApprovedOutdoorDuty,
        applyLeave,
        editLeave,
        deleteLeave,
        approveLeaveLevel1,
        rejectLeaveLevel1,
        approveLeaveLevel2,
        rejectLeaveLevel2,
        submitJoiningReport,
        forwardJoiningReport,
        verifyJoiningReport,
        updateUserLeaveBalance,
        bulkImportLeaveBalances,
        batchUpdateLeaveBalances,
        reconcileLeaveBalances,
        runYearEndLeaveRoll,
        updateUserProfile,
        addUserProfile,
        updateUserRoleAndHierarchy,
        toggleUserStatus,
        deleteUser,
        resetUserPassword,
        transferUser,
        bulkTransferUsers,
        bulkReassignManager,
        transferLogs,
        updateSlackConfig,
        resetAllData,
        holidays,
        addHoliday,
        updateHoliday,
        deleteHoliday,
        resetHolidays,
        orgBranding,
        updateOrgBranding,
        resetOrgBranding,
        isLogoViewerOpen,
        setIsLogoViewerOpen,
        projectHistories,
        addProjectHistory,
        updateProjectHistory,
        deleteProjectHistory,
        getUserProjectHistories,
        updateUserModuleRoles,
        toggleUserModuleRole,
        bulkAssignModuleRole,
        emailConfig,
        updateEmailConfig,
        emailLogs,
        addEmailLog,
        clearEmailLogs,
        resendEmail,
        latestEmailToast,
        dismissEmailToast,
        sendCustomEmail,
        testSmtpConnection
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
