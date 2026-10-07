import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../../../context/AppContext';
import { LeaveType, LeaveRequest } from '../../../../types';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { TablePagination } from '../../../../shared/components/TablePagination';
import { AppSelect } from '../../../../shared/components/AppSelect';
import {
  FileText,
  PlusCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Layers,
  AlertTriangle,
  AlertCircle,
  Clock,
  Send,
  User,
  X,
  Check,
  BookOpen,
  Info,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  HelpCircle,
  Search,
  Download,
  Filter,
  LayoutGrid,
  List,
  Eye,
  Table as TableIcon,
  RotateCcw,
  Building2,
  MapPin,
  Edit2,
  Edit3,
  Trash2,
  Paperclip,
  Upload,
  ExternalLink,
  FileCheck,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { CCSLeaveRulesModal } from '../components/CCSLeaveRulesModal';
import { LeaveQuotaImportModal } from '../components/LeaveQuotaImportModal';
import { JoiningReportModal } from '../components/JoiningReportModal';
import { LeaveCycleDropdown } from '../components/LeaveCycleDropdown';
import { MultiUserLeaveBalanceMatrix } from '../components/MultiUserLeaveBalanceMatrix';
import {
  isCalendarYearCadre,
  getCadreCycleType,
  getUserLeaveCycleType,
  getAccountingCycleLabel,
  getAccountingCycleMeta,
  matchesCycleFilter,
  LEAVE_CYCLE_OPTIONS
} from '../utils/leaveCycleUtils';
import { INITIAL_HOLIDAYS } from '../../holidays/data/holidayData';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { formatTo24H } from '../../attendance/utils/attendanceUtils';

// Legacy StationLeaveDatePicker wrapper using unified AppDatePicker
const StationLeaveDatePicker: React.FC<{
  label: string;
  value: string;
  minDate?: string;
  onChange: (dateStr: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  isRightColumn?: boolean;
}> = (props) => {
  return <AppDatePicker {...props} restrictToStationLeave={true} holidays={INITIAL_HOLIDAYS} />;
};

interface LeaveManagementPageProps {
  onNavigate?: (tab: string) => void;
  initialTab?: string;
}

export const LeaveManagementPage: React.FC<LeaveManagementPageProps> = ({ onNavigate, initialTab }) => {
  const {
    currentUser,
    users,
    attendanceRecords,
    leaveRequests,
    leavePolicies,
    applyLeave,
    editLeave,
    deleteLeave,
    approveLeaveLevel1,
    rejectLeaveLevel1,
    approveLeaveLevel2,
    rejectLeaveLevel2,
    updateUserLeaveBalance,
    bulkImportLeaveBalances,
    batchUpdateLeaveBalances,
    reconcileLeaveBalances,
    runYearEndLeaveRoll
  } = useApp();

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [detailModalLeave, setDetailModalLeave] = useState<LeaveRequest | null>(null);
  const [selectedJoiningLeave, setSelectedJoiningLeave] = useState<LeaveRequest | null>(null);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType>('casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [activeStationPicker, setActiveStationPicker] = useState<'from' | 'to' | null>(null);
  const [ltcType, setLtcType] = useState<'none' | 'ltc' | 'ex_india'>('none');
  const [stationAddress, setStationAddress] = useState('');
  const [encashLtc, setEncashLtc] = useState(false);
  const [encashDays, setEncashDays] = useState<number>(10);
  const [isCommuted, setIsCommuted] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState('');
  const [prescriptionFileName, setPrescriptionFileName] = useState('');
  const [applyTargetUserId, setApplyTargetUserId] = useState(currentUser.id);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [activeReasonModal, setActiveReasonModal] = useState<{
    employeeName: string;
    leaveType: string;
    dates: string;
    reason: string;
  } | null>(null);

  // Casual Leave session states for From Date & To Date
  const [startSession, setStartSession] = useState<'first_half' | 'second_half'>('first_half');
  const [endSession, setEndSession] = useState<'first_half' | 'second_half'>('second_half');
  const [requiresHqPermission, setRequiresHqPermission] = useState<boolean>(false);

  // Restricted Holiday (RH) selection
  const restrictedHolidaysList = useMemo(() => {
    return INITIAL_HOLIDAYS.filter((h) => h.type === 'restricted').sort((a, b) => a.date.localeCompare(b.date));
  }, []);
  const [selectedRhId, setSelectedRhId] = useState<string>('');
  const [isRhDropdownOpen, setIsRhDropdownOpen] = useState(false);
  const [rhSearchQuery, setRhSearchQuery] = useState('');

  // Custom Popover Leave Type Selection states
  const [isLeaveTypeDropdownOpen, setIsLeaveTypeDropdownOpen] = useState(false);
  const [leaveTypeSearchQuery, setLeaveTypeSearchQuery] = useState('');

  // Prefix & Suffix Holiday States (for 2-stage leaves)
  const [availPrefix, setAvailPrefix] = useState<boolean>(false);
  const [prefixFrom, setPrefixFrom] = useState<string>('');
  const [prefixTo, setPrefixTo] = useState<string>('');

  const [availSuffix, setAvailSuffix] = useState<boolean>(false);
  const [suffixFrom, setSuffixFrom] = useState<string>('');
  const [suffixTo, setSuffixTo] = useState<string>('');

  // Station Leave Date Validator Helper (Only Gazetted Holidays & Weekends allowed)
  const isStationLeaveEligibleDate = (dateStr: string) => {
    if (!dateStr) return { eligible: false, reason: 'Please select a date' };
    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return { eligible: false, reason: 'Invalid date format' };

    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const ghMatch = INITIAL_HOLIDAYS.find((h) => h.date === dateStr && h.type === 'gazetted');

    if (isWeekend) {
      return { eligible: true, reason: dayOfWeek === 0 ? 'Sunday (Weekend)' : 'Saturday (Weekend)' };
    }
    if (ghMatch) {
      return { eligible: true, reason: `Gazetted Holiday (${ghMatch.name})` };
    }
    return { eligible: false, reason: 'Working Weekday' };
  };

  const checkStationLeaveRange = (sDate: string, eDate: string) => {
    if (!sDate || !eDate) return { valid: false, invalidDates: [] };
    const start = new Date(`${sDate}T12:00:00`);
    const end = new Date(`${eDate}T12:00:00`);
    if (end < start) return { valid: false, invalidDates: [] };

    const invalidDates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      const yr = curr.getFullYear();
      const mo = String(curr.getMonth() + 1).padStart(2, '0');
      const dy = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${dy}`;

      const check = isStationLeaveEligibleDate(dateStr);
      if (!check.eligible) {
        invalidDates.push(dateStr);
      }
      curr.setDate(curr.getDate() + 1);
    }
    return { valid: invalidDates.length === 0, invalidDates };
  };

  const filteredRhList = useMemo(() => {
    if (!rhSearchQuery.trim()) return restrictedHolidaysList;
    const q = rhSearchQuery.toLowerCase();
    return restrictedHolidaysList.filter(
      (rh) =>
        rh.name.toLowerCase().includes(q) ||
        (rh.hindiName && rh.hindiName.toLowerCase().includes(q)) ||
        rh.date.includes(q) ||
        rh.dayOfWeek.toLowerCase().includes(q) ||
        rh.category.toLowerCase().includes(q)
    );
  }, [restrictedHolidaysList, rhSearchQuery]);

  useEffect(() => {
    if (selectedLeaveType === 'restricted') {
      const rh = restrictedHolidaysList.find((h) => h.id === selectedRhId) || restrictedHolidaysList[0];
      if (rh) {
        if (selectedRhId !== rh.id) {
          setSelectedRhId(rh.id);
        }
        setStartDate(rh.date);
        setEndDate(rh.date);
      }
    } else if (selectedLeaveType === 'station') {
      setRequiresHqPermission(true);
      if (stationAddress === 'Dehradun HQ') setStationAddress('');
    }
  }, [selectedLeaveType, selectedRhId, restrictedHolidaysList]);

  const handleRhChange = (rhId: string) => {
    setSelectedRhId(rhId);
    const rh = restrictedHolidaysList.find((h) => h.id === rhId);
    if (rh) {
      setStartDate(rh.date);
      setEndDate(rh.date);
    }
  };

  // Compensatory Off (C-Off) worked days on weekends/holidays with full IN/OUT punches
  const compOffEligibleList = useMemo(() => {
    const isUserAdmin = currentUser.role === 'administrator';
    const targetUid = isUserAdmin && applyTargetUserId ? applyTargetUserId : currentUser.id;
    const userAtt = (attendanceRecords || []).filter((a) => a.userId === targetUid);
    const holidayDates = new Set(INITIAL_HOLIDAYS.map((h) => h.date));

    const workedOnOffDays = userAtt.filter((rec) => {
      if (!rec.date) return false;
      const dateObj = new Date(`${rec.date}T10:00:00`);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const isHoliday = holidayDates.has(rec.date);
      const hasIn = rec.clockIn && rec.clockIn !== '-';
      const hasOut = rec.clockOut && rec.clockOut !== '-';
      const isFullDuration = (rec.totalHours || 0) >= 6 || (hasIn && hasOut);
      return (isWeekend || isHoliday) && hasIn && hasOut && isFullDuration;
    });

    const mapped = workedOnOffDays.map((rec) => {
      const hol = INITIAL_HOLIDAYS.find((h) => h.date === rec.date);
      const dObj = new Date(`${rec.date}T10:00:00`);
      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
      const label = hol ? hol.name : `${dayName} Duty`;
      return {
        id: rec.id || `coff-${rec.date}`,
        date: rec.date,
        dayOfWeek: dayName,
        label,
        clockIn: rec.clockIn ? formatTo24H(rec.clockIn) : '09:00',
        clockOut: rec.clockOut ? formatTo24H(rec.clockOut) : '17:30',
        totalHours: rec.totalHours || 8.5,
        isHoliday: !!hol,
        holidayCategory: hol ? hol.category : 'Weekend Work'
      };
    });

    const defaultSeedOffDays = [
      {
        id: `coff-seed-1-${targetUid}`,
        date: '2026-08-08',
        dayOfWeek: 'Saturday',
        label: 'Saturday Full Duty',
        clockIn: '09:15',
        clockOut: '17:45',
        totalHours: 8.5,
        isHoliday: false,
        holidayCategory: 'Weekend Work'
      },
      {
        id: `coff-seed-2-${targetUid}`,
        date: '2026-08-09',
        dayOfWeek: 'Sunday',
        label: 'Sunday Campus Duty',
        clockIn: '09:00',
        clockOut: '17:30',
        totalHours: 8.5,
        isHoliday: false,
        holidayCategory: 'Weekend Work'
      },
      {
        id: `coff-seed-3-${targetUid}`,
        date: '2026-08-15',
        dayOfWeek: 'Saturday',
        label: 'Independence Day Duty',
        clockIn: '08:45',
        clockOut: '17:30',
        totalHours: 8.75,
        isHoliday: true,
        holidayCategory: 'Gazetted Holiday'
      },
      {
        id: `coff-seed-4-${targetUid}`,
        date: '2026-08-02',
        dayOfWeek: 'Sunday',
        label: 'Sunday Project Duty',
        clockIn: '09:30',
        clockOut: '17:30',
        totalHours: 8.0,
        isHoliday: false,
        holidayCategory: 'Weekend Work'
      }
    ];

    const existingDates = new Set(mapped.map((m) => m.date));
    const extraSeed = defaultSeedOffDays.filter((s) => !existingDates.has(s.date));
    return [...mapped, ...extraSeed].sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, currentUser.id, currentUser.role, applyTargetUserId]);

  const [selectedCoffId, setSelectedCoffId] = useState<string>('');
  const [isCoffDropdownOpen, setIsCoffDropdownOpen] = useState(false);
  const [coffSearchQuery, setCoffSearchQuery] = useState('');

  const filteredCoffList = useMemo(() => {
    if (!coffSearchQuery.trim()) return compOffEligibleList;
    const q = coffSearchQuery.toLowerCase();
    return compOffEligibleList.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.date.includes(q) ||
        c.dayOfWeek.toLowerCase().includes(q) ||
        c.clockIn.toLowerCase().includes(q) ||
        c.clockOut.toLowerCase().includes(q)
    );
  }, [compOffEligibleList, coffSearchQuery]);

  useEffect(() => {
    if (selectedLeaveType === 'compensatory_off') {
      const coff = compOffEligibleList.find((c) => c.id === selectedCoffId) || compOffEligibleList[0];
      if (coff && selectedCoffId !== coff.id) {
        setSelectedCoffId(coff.id);
      }
    }
  }, [selectedLeaveType, selectedCoffId, compOffEligibleList]);

  const handleCoffChange = (coffId: string) => {
    setSelectedCoffId(coffId);
  };

  const rawCalculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  // CL Working days excluding weekends and gazetted holidays
  const clBaseWorkingDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;

    const holidaySet = new Set(INITIAL_HOLIDAYS.map((h) => h.date));
    let count = 0;
    const curr = new Date(s);
    while (curr <= e) {
      const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
      const dateStr = curr.toISOString().split('T')[0];
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidaySet.has(dateStr);
      if (!isWeekend && !isHoliday) {
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  }, [startDate, endDate]);

  const calculatedDays = useMemo(() => {
    if (selectedLeaveType === 'restricted' || selectedLeaveType === 'compensatory_off') {
      return startDate && endDate ? 1 : 0;
    }
    if (selectedLeaveType === 'casual') {
      if (clBaseWorkingDays <= 0) return 0;
      if (startDate === endDate) {
        if (startSession === 'first_half' && endSession === 'second_half') {
          return 1;
        }
        return 0.5;
      }
      let total = clBaseWorkingDays;
      if (startSession === 'second_half') total -= 0.5;
      if (endSession === 'first_half') total -= 0.5;
      return Math.max(0.5, total);
    }
    if (rawCalculatedDays <= 0) return 0;
    if ((selectedLeaveType === 'half_pay' && isCommuted) || selectedLeaveType === 'commuted') {
      return rawCalculatedDays * 2;
    }
    return rawCalculatedDays;
  }, [rawCalculatedDays, selectedLeaveType, isCommuted, clBaseWorkingDays, startDate, endDate, startSession, endSession]);

  const [showAllPolicies, setShowAllPolicies] = useState(false);

  const getLeaveTypeCode = (typeStr: string) => {
    const codeMap: Record<string, string> = {
      earned: 'EL',
      casual: 'CL',
      half_pay: 'HPL',
      restricted: 'RH',
      compensatory_off: 'C-OFF',
      commuted: 'COMM',
      maternity: 'ML',
      paternity: 'PL',
      child_care: 'CCL',
      sick: 'SL',
      extra_ordinary: 'EOL',
      study: 'ST',
      special_casual: 'SCL',
      field_work: 'FWL',
      academic: 'AL',
      contingency: 'CO',
      stipend_off: 'SO',
      leave_not_due: 'LND',
      station: 'STN'
    };
    return codeMap[typeStr] || 'LV';
  };

  const getDealingPerson = (lv: LeaveRequest) => {
    if (lv.level2Approval?.approverName) return lv.level2Approval.approverName;
    if (lv.level1Approval?.approverName) return lv.level1Approval.approverName;
    const mgr = users.find((u) => u.id === lv.reportingManagerId);
    return mgr ? mgr.name : 'Estt. Dealing Assistant';
  };

  // Check if an approved leave is eligible for post-leave joining report:
  // Strictly ONLY for leaves requiring HoD approval per rules
  // If suffix is availed, report is eligible starting the day after suffixTo
  const isJoiningReportEligible = (lv: LeaveRequest) => {
    if (lv.status !== 'approved') return false;
    const requiresHod = Boolean(lv.requiresLevel2 || lv.level2Approval || lv.reviewingManagerId);
    if (!requiresHod) return false;
    if (lv.joiningReport) return true;
    const today = new Date().toISOString().split('T')[0];
    const effectiveEnd = lv.suffixTo || lv.endDate;
    return Boolean(effectiveEnd && today >= effectiveEnd);
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0');

  const initialMonthStart = `${year}-${month}-01`;
  const initialMonthEnd = `${year}-${month}-${lastDay}`;

  const initialYearStart = `${year}-01-01`;
  const initialYearEnd = `${year}-12-31`;

  // Primary leave types requested: EL, CL, HPL, RH, Comp Off (Max 5 initial entries)
  const PRIMARY_LEAVE_TYPES: LeaveType[] = ['earned', 'casual', 'half_pay', 'restricted', 'compensatory_off'];

  // Filter States (Multi-select supported)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReason, setFilterReason] = useState<string[]>(['all']);
  const [filterStatus, setFilterStatus] = useState<string[]>(['all']);
  const [filterEmployee, setFilterEmployee] = useState<string[]>(['all']);
  const [filterDesignation, setFilterDesignation] = useState<string[]>(['all']);
  const [filterDepartment, setFilterDepartment] = useState<string[]>(['all']);
  const [filterReportingManager, setFilterReportingManager] = useState<string[]>(['all']);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [balanceViewMode, setBalanceViewMode] = useState<'table' | 'grid'>('table');

  // Format date helper
  const formatDateAndDay = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year} (${days[d.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  // Edit Leave Request Modal State
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReason, setEditReason] = useState('');

  // Selected Active Leave Accounting Cycle or Year (User cadre dependent: CY / FY / empty for all)
  const [selectedActiveYear, setSelectedActiveYear] = useState<string>('CY-2026');

  // Standalone Leave Quota CSV Import Modal
  const [showQuotaImportModal, setShowQuotaImportModal] = useState<boolean>(false);
  const [quotaImportSuccessMsg, setQuotaImportSuccessMsg] = useState<string>('');

  // Admin Import / Edit Balance Modal State
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceModalTab, setBalanceModalTab] = useState<'single' | 'batch_grid' | 'bulk' | 'year_roll' | 'reconcile'>('single');
  const [selectedBalanceUserId, setSelectedBalanceUserId] = useState(currentUser.id);
  const [selectedBalanceType, setSelectedBalanceType] = useState('casual');
  const [selectedBalanceYear, setSelectedBalanceYear] = useState<string>(new Date().getFullYear().toString());
  const [balQuotaInput, setBalQuotaInput] = useState(12);
  const [balUsedInput, setBalUsedInput] = useState(0);
  const [balPendingInput, setBalPendingInput] = useState(0);
  const [balCarryForwardInput, setBalCarryForwardInput] = useState(0);

  // Multi-User Batch Grid Editor States
  const [batchYear, setBatchYear] = useState<string>(new Date().getFullYear().toString());
  const [batchEmpType, setBatchEmpType] = useState<string>('all');
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>('');
  const [batchGridData, setBatchGridData] = useState<Record<string, { total: number; used: number; pending: number; carryForward: number }>>({});
  const [batchSaveMsg, setBatchSaveMsg] = useState<string>('');

  // Reconciliation & Audit Tool States
  const [reconcileYear, setReconcileYear] = useState<string>(new Date().getFullYear().toString());
  const [reconcileReport, setReconcileReport] = useState<Array<{
    userId: string;
    userName: string;
    department: string;
    employmentType: string;
    leaveType: string;
    leaveTypeName: string;
    storedUsed: number;
    actualApprovedUsed: number;
    storedPending: number;
    actualPending: number;
    hasDiscrepancy: boolean;
  }>>([]);
  const [reconcileSuccessMsg, setReconcileSuccessMsg] = useState<string>('');
  const [isAuditRunning, setIsAuditRunning] = useState<boolean>(false);

  // Bulk CSV Upload & Import States
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<
    Array<{
      biometricId: string;
      employeeName: string;
      userId: string;
      leaveTypeCode: string;
      leaveType: string;
      leaveTypeName: string;
      year: string;
      total: number;
      used: number;
      pending: number;
      carryForward: number;
      status: 'valid' | 'warning' | 'error';
      message: string;
      employmentType?: string;
    }>
  >([]);
  const [csvImportSuccessMsg, setCsvImportSuccessMsg] = useState('');
  const [csvImportErrorMsg, setCsvImportErrorMsg] = useState('');

  // Year-End Roll States
  const [yearRollFrom, setYearRollFrom] = useState('2025');
  const [yearRollTo, setYearRollTo] = useState('2026');
  const [yearRollMsg, setYearRollMsg] = useState('');

  // Manager Approval Comments
  const [level1Comments, setLevel1Comments] = useState<{ [id: string]: string }>({});
  const [level2Comments, setLevel2Comments] = useState<{ [id: string]: string }>({});

  const todayStr = new Date().toISOString().split('T')[0];

  const isAdmin = currentUser.role === 'administrator';
  const isReportingManager = currentUser.role === 'reporting_manager';
  const isReviewingManager = currentUser.role === 'reviewing_manager';
  const isGeneralStaff = currentUser.role === 'general_staff';
  const isUserView = isGeneralStaff || (!isAdmin && !isReportingManager && !isReviewingManager);

  const canApplyLeave = true;
  // Leave Balances table is only visible for regular staff (general_staff / user view).
  // Removed from Administrator role as requested ("administrator role se bhi ye table remove kar do").
  const isManagerOrHod =
    !isAdmin &&
    !isUserView &&
    !isGeneralStaff &&
    (currentUser.role === 'reporting_manager' || currentUser.role === 'reviewing_manager');

  // Leave Balances table is explicitly hidden for Administrator, and only shown for regular employees
  const showBalanceSection = !isAdmin && (isUserView || isGeneralStaff);

  // Target user for employee-specific leave cycles and balance inspection
  const targetEmployeeUser = useMemo(() => {
    if (isAdmin && !isUserView && !filterEmployee.includes('all') && filterEmployee.length === 1) {
      return users.find((u) => u.id === filterEmployee[0]) || currentUser;
    }
    return currentUser;
  }, [isAdmin, isUserView, filterEmployee, users, currentUser]);

  const userCycle = useMemo(() => {
    return getUserLeaveCycleType(targetEmployeeUser);
  }, [targetEmployeeUser]);

  const defaultActiveCycle = userCycle === 'CY' ? 'CY-2026' : 'FY-2026-27';

  const isInstitutionalView = Boolean(
    (isAdmin || isReviewingManager) &&
    !isUserView &&
    (filterEmployee.includes('all') || filterEmployee.length !== 1)
  );

  // Synchronize active year selection if employee cadre changes
  useEffect(() => {
    if (selectedActiveYear && selectedActiveYear !== 'all') {
      if (userCycle === 'CY' && selectedActiveYear.startsWith('FY-')) {
        setSelectedActiveYear('CY-2026');
      } else if (userCycle === 'FY' && selectedActiveYear.startsWith('CY-')) {
        setSelectedActiveYear('FY-2026-27');
      }
    }
  }, [userCycle, targetEmployeeUser.id]);

  const activeCycleLabel = useMemo(() => {
    if (!selectedActiveYear || selectedActiveYear === 'all') {
      return 'All Years';
    }
    return selectedActiveYear.replace(/^(CY-|FY-)/, '');
  }, [selectedActiveYear]);

  // Accessible Users for filters and actions based on user role
  const accessibleUsers = useMemo(() => {
    if (isAdmin || isReviewingManager) return users;
    if (isReportingManager) {
      return users.filter(
        (u) =>
          u.id === currentUser.id ||
          u.reportingManagerId === currentUser.id ||
          (u.piName && u.piName === currentUser.name)
      );
    }
    return [currentUser];
  }, [currentUser, users, isAdmin, isReportingManager, isReviewingManager]);

  // Dropdown options lists for filters
  const designationsList = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.designation).filter(Boolean)));
  }, [users]);

  const departmentsList = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.department).filter(Boolean)));
  }, [users]);

  const reportingManagersList = useMemo(() => {
    return users.filter(
      (u) => u.role === 'reporting_manager' || u.role === 'administrator' || u.role === 'reviewing_manager'
    );
  }, [users]);

  // Policies available for current user's employment type
  const availablePolicies = leavePolicies.filter(
    (p) => p.allowedEmploymentTypes.includes(currentUser.employmentType) && p.type !== 'commuted'
  );

  const filteredPoliciesList = useMemo(() => {
    if (!leaveTypeSearchQuery.trim()) return availablePolicies;
    const q = leaveTypeSearchQuery.toLowerCase();
    return availablePolicies.filter(
      (pol) =>
        pol.name.toLowerCase().includes(q) ||
        pol.description.toLowerCase().includes(q) ||
        getLeaveTypeCode(pol.type).toLowerCase().includes(q)
    );
  }, [availablePolicies, leaveTypeSearchQuery]);

  // Compute 5 Primary Policies (EL, CL, HPL, RH, Comp Off) - Initially Max 5 entries
  const primaryPolicies = useMemo(() => {
    const primary = availablePolicies.filter((p) => PRIMARY_LEAVE_TYPES.includes(p.type));
    primary.sort((a, b) => PRIMARY_LEAVE_TYPES.indexOf(a.type) - PRIMARY_LEAVE_TYPES.indexOf(b.type));
    const others = availablePolicies.filter((p) => !PRIMARY_LEAVE_TYPES.includes(p.type));
    const combined = [...primary, ...others];
    return combined.slice(0, 5);
  }, [availablePolicies]);

  const displayedPolicies = showAllPolicies ? availablePolicies : primaryPolicies;

  // Selected policy details
  const selectedPolicy = availablePolicies.find((p) => p.type === selectedLeaveType) || availablePolicies[0];

  // 2-Stage Leave Eligibility Check:
  // CCS Leave Rules & Workflow: Includes all statutory long leaves (EL, HPL, Commuted, ML, PL, CCL, Study, EOL)
  // OR any leave whose duration exceeds the Level-2 approval threshold
  const isTwoStageLeave = useMemo(() => {
    const threshold = selectedPolicy?.requiresLevel2ForDaysMoreThan ?? 2;
    const reqL2 = calculatedDays > threshold;
    const isFormalLeave = [
      'earned',
      'half_pay',
      'commuted',
      'maternity',
      'paternity',
      'child_care',
      'study',
      'extraordinary',
      'special_disability',
      'hospital'
    ].includes(selectedLeaveType);

    return reqL2 || isFormalLeave;
  }, [selectedPolicy, calculatedDays, selectedLeaveType]);

  // Contiguous Eligible Prefix Dates (immediately preceding startDate)
  // Must be Weekends or Gazetted Holidays ending on day before startDate
  const eligiblePrefixDates = useMemo(() => {
    if (!startDate) return [];
    const list: Array<{ date: string; reason: string; dayName: string }> = [];
    const start = new Date(`${startDate}T12:00:00`);
    if (isNaN(start.getTime())) return [];

    const curr = new Date(start);
    curr.setDate(curr.getDate() - 1);

    while (true) {
      const yr = curr.getFullYear();
      const mo = String(curr.getMonth() + 1).padStart(2, '0');
      const dy = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${dy}`;

      const check = isStationLeaveEligibleDate(dateStr);
      if (!check.eligible) {
        break; // Stop at first non-weekend non-GH working day
      }
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      list.push({
        date: dateStr,
        reason: check.reason,
        dayName: dayNames[curr.getDay()]
      });
      curr.setDate(curr.getDate() - 1);
      if (list.length >= 14) break;
    }
    return list.reverse();
  }, [startDate]);

  // Contiguous Eligible Suffix Dates (immediately succeeding endDate)
  // Must be Weekends or Gazetted Holidays starting on day after endDate
  const eligibleSuffixDates = useMemo(() => {
    if (!endDate) return [];
    const list: Array<{ date: string; reason: string; dayName: string }> = [];
    const end = new Date(`${endDate}T12:00:00`);
    if (isNaN(end.getTime())) return [];

    const curr = new Date(end);
    curr.setDate(curr.getDate() + 1);

    while (true) {
      const yr = curr.getFullYear();
      const mo = String(curr.getMonth() + 1).padStart(2, '0');
      const dy = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${dy}`;

      const check = isStationLeaveEligibleDate(dateStr);
      if (!check.eligible) {
        break; // Stop at first non-weekend non-GH working day
      }
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      list.push({
        date: dateStr,
        reason: check.reason,
        dayName: dayNames[curr.getDay()]
      });
      curr.setDate(curr.getDate() + 1);
      if (list.length >= 14) break;
    }
    return list;
  }, [endDate]);

  // Sync prefix/suffix state if dates change
  useEffect(() => {
    if (eligiblePrefixDates.length === 0) {
      if (availPrefix) {
        setAvailPrefix(false);
        setPrefixFrom('');
        setPrefixTo('');
      }
    } else if (availPrefix) {
      if (!prefixFrom || !prefixTo || !eligiblePrefixDates.some((p) => p.date === prefixFrom)) {
        setPrefixFrom(eligiblePrefixDates[0].date);
        setPrefixTo(eligiblePrefixDates[eligiblePrefixDates.length - 1].date);
      }
    }
  }, [eligiblePrefixDates, availPrefix]);

  useEffect(() => {
    if (eligibleSuffixDates.length === 0) {
      if (availSuffix) {
        setAvailSuffix(false);
        setSuffixFrom('');
        setSuffixTo('');
      }
    } else if (availSuffix) {
      if (!suffixFrom || !suffixTo || !eligibleSuffixDates.some((s) => s.date === suffixTo)) {
        setSuffixFrom(eligibleSuffixDates[0].date);
        setSuffixTo(eligibleSuffixDates[eligibleSuffixDates.length - 1].date);
      }
    }
  }, [eligibleSuffixDates, availSuffix]);

  // Helper to find the next official working day (skipping weekends & Gazetted Holidays)
  const getNextWorkingDay = (afterDateStr: string) => {
    if (!afterDateStr) return '';
    const parts = afterDateStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return afterDateStr;
    }
    const curr = new Date(parts[0], parts[1] - 1, parts[2] + 1);

    for (let i = 0; i < 30; i++) {
      const yr = curr.getFullYear();
      const mo = String(curr.getMonth() + 1).padStart(2, '0');
      const dy = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${dy}`;

      const check = isStationLeaveEligibleDate(dateStr);
      // isStationLeaveEligibleDate returns eligible: true for weekends & GH, false for working days
      if (!check.eligible) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${dateStr} (${dayNames[curr.getDay()]})`;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return '';
  };

  // Expected Duty Resumption (Joining) Date:
  // Must always be on the next official working day (skips intervening weekends and Gazetted Holidays)
  const expectedJoiningDate = useMemo(() => {
    if (!endDate) return '';
    const effectiveEnd = availSuffix && suffixTo ? suffixTo : endDate;
    return getNextWorkingDay(effectiveEnd);
  }, [endDate, availSuffix, suffixTo]);

  const handleResetFilters = () => {
    setSelectedActiveYear(defaultActiveCycle);
    setSearchQuery('');
    setFilterReason(['all']);
    setFilterStatus(['all']);
    setFilterEmployee(['all']);
    setFilterDesignation(['all']);
    setFilterDepartment(['all']);
    setFilterReportingManager(['all']);
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() !== '' ||
    selectedActiveYear !== defaultActiveCycle ||
    (!filterReason.includes('all') && filterReason.length > 0) ||
    (!filterStatus.includes('all') && filterStatus.length > 0) ||
    (!filterEmployee.includes('all') && filterEmployee.length > 0) ||
    (!filterDesignation.includes('all') && filterDesignation.length > 0) ||
    (!filterDepartment.includes('all') && filterDepartment.length > 0) ||
    (!filterReportingManager.includes('all') && filterReportingManager.length > 0)
  );

  // Filtered Leave Applications per RBAC rules matrix
  const filteredLeaves = useMemo(() => {
    let baseList = leaveRequests;
    if (isGeneralStaff) {
      // User role: ONLY self records
      baseList = leaveRequests.filter((l) => l.userId === currentUser.id);
    } else if (isReportingManager) {
      // Reporting Manager role: exclude self records (user must switch to User role for self records)
      baseList = leaveRequests.filter(
        (l) =>
          l.userId !== currentUser.id &&
          (l.reportingManagerId === currentUser.id ||
            users.some((u) => u.id === l.userId && u.reportingManagerId === currentUser.id))
      );
    } else if (isReviewingManager) {
      // HoD / Reviewing Manager role: exclude self records
      baseList = leaveRequests.filter(
        (l) =>
          l.userId !== currentUser.id &&
          (l.reviewingManagerId === currentUser.id || l.department === currentUser.department)
      );
    } else if (isAdmin) {
      // Administrator role: exclude self records
      baseList = leaveRequests.filter((l) => l.userId !== currentUser.id);
    }

    return baseList.filter((l) => {
      if (!matchesMultiSelect(filterStatus, l.status)) return false;
      if (!matchesMultiSelect(filterReason, l.leaveType)) return false;

      // Filter by selected year or cadre cycle (CY / FY)
      if (selectedActiveYear && selectedActiveYear !== 'all') {
        const u = users.find((usr) => usr.id === l.userId);
        if (!matchesCycleFilter(l.startDate, l.endDate, selectedActiveYear, u?.employmentType)) {
          return false;
        }
      }

      if (!matchesMultiSelect(filterEmployee, l.userId)) return false;

      if (!filterDesignation.includes('all')) {
        const u = users.find((usr) => usr.id === l.userId);
        if (!u || !matchesMultiSelect(filterDesignation, u.designation)) return false;
      }

      if (!matchesMultiSelect(filterDepartment, l.department)) return false;

      if (!matchesMultiSelect(filterReportingManager, l.reportingManagerId)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = l.userName.toLowerCase().includes(q);
        const matchesDept = l.department.toLowerCase().includes(q);
        const matchesType = l.leaveTypeName.toLowerCase().includes(q);
        const matchesReason = l.reason.toLowerCase().includes(q);
        const matchesDate = l.startDate.includes(q) || l.endDate.includes(q) || l.appliedDate.includes(q);
        if (!matchesName && !matchesDept && !matchesType && !matchesReason && !matchesDate) {
          return false;
        }
      }

      return true;
    });
  }, [
    leaveRequests,
    currentUser.id,
    currentUser.department,
    isGeneralStaff,
    isReportingManager,
    isReviewingManager,
    filterStatus,
    filterReason,
    selectedActiveYear,
    filterEmployee,
    filterDesignation,
    filterDepartment,
    filterReportingManager,
    searchQuery,
    users
  ]);

  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  type LeaveSortField = 'employee' | 'leaveType' | 'dates' | 'appliedDate' | 'reason' | 'status';
  const [sortField, setSortField] = useState<LeaveSortField>('appliedDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: LeaveSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedLeaves = useMemo(() => {
    const list = [...filteredLeaves];
    list.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      switch (sortField) {
        case 'employee':
          aVal = (a.userName || '').toLowerCase();
          bVal = (b.userName || '').toLowerCase();
          break;
        case 'leaveType':
          aVal = (a.leaveTypeName || a.leaveType || '').toLowerCase();
          bVal = (b.leaveTypeName || b.leaveType || '').toLowerCase();
          break;
        case 'dates':
          aVal = a.startDate || '';
          bVal = b.startDate || '';
          break;
        case 'appliedDate':
          aVal = a.appliedDate || a.createdAt || '';
          bVal = b.appliedDate || b.createdAt || '';
          break;
        case 'reason':
          aVal = (a.reason || '').toLowerCase();
          bVal = (b.reason || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLeaves, sortField, sortOrder]);

  const paginatedLeaves = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return sortedLeaves.slice(start, start + tablePageSize);
  }, [sortedLeaves, tablePage, tablePageSize]);

  const isBeforeOrOnApplicableDate = (dateStr: string) => {
    if (!dateStr) return true;
    return dateStr >= todayStr;
  };

  // Status action user helper
  const getActionByName = (lv: LeaveRequest) => {
    const rawLv = lv as any;
    if (lv.status === 'approved') {
      return lv.level2Approval?.approverName || lv.level1Approval?.approverName || rawLv.actionBy || 'HoD';
    }
    if (lv.status === 'rejected') {
      return lv.level2Approval?.approverName || lv.level1Approval?.approverName || rawLv.actionBy || 'Reporting Officer';
    }
    if (lv.status === 'cancelled') {
      return rawLv.cancelledByName || rawLv.actionBy || lv.userName;
    }
    return rawLv.actionBy || lv.userName;
  };

  // Button Style Helpers per Role & Status
  const getSeeButtonStyle = (status: string) => {
    if (status === 'approved') {
      return 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200';
    }
    if (status === 'rejected') {
      return 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200';
    }
    // Pending -> Gray
    return 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200';
  };

  const getJoiningButtonStyle = (reportStatus?: string) => {
    if (reportStatus === 'accepted') {
      return 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border-emerald-300';
    }
    if (reportStatus === 'rejected') {
      return 'text-rose-800 bg-rose-100 hover:bg-rose-200 border-rose-300';
    }
    if (reportStatus === 'submitted' || reportStatus === 'forwarded') {
      return 'text-amber-800 bg-amber-100 hover:bg-amber-200 border-amber-300';
    }
    // Not applied -> Grey
    return 'text-slate-600 bg-slate-100 hover:bg-slate-200 border-slate-200';
  };

  // 1. User Can Edit/Delete: Allowed for applicant before approval/forwarding & applicable date (future pending), or Admin anytime.
  const canUserModify = (lv: LeaveRequest) => {
    if (isAdmin) return true; // Administration role: any time
    if (lv.userId !== currentUser.id) return false;
    if (lv.status !== 'pending_level_1' && lv.status !== 'pending_level_2') return false; // Future pending only
    if (!isBeforeOrOnApplicableDate(lv.startDate)) return false; // Before/on applicable date
    return true;
  };

  // 2. Manager Can Approve / Reject / Forward
  const canManagerAction = (lv: LeaveRequest) => {
    if (isAdmin) {
      return lv.status === 'pending_level_1' || lv.status === 'pending_level_2';
    }
    // Level-1 (Reporting Manager)
    if (lv.status === 'pending_level_1') {
      if (lv.userId === currentUser.id) return false; // Cannot approve own request
      return (
        isReportingManager ||
        currentUser.role === 'reporting_manager' ||
        lv.reportingManagerId === currentUser.id ||
        users.some((u) => u.id === lv.userId && u.reportingManagerId === currentUser.id)
      );
    }
    // Level-2 (Reviewing Manager / HoD)
    if (lv.status === 'pending_level_2') {
      if (lv.userId === currentUser.id) return false; // Cannot approve own request
      return (
        isReviewingManager ||
        currentUser.role === 'reviewing_manager' ||
        lv.reviewingManagerId === currentUser.id
      );
    }
    return false;
  };

  // 3. Manager/Admin Can Cancel Approved Leave Record
  const canManagerCancelApproval = (lv: LeaveRequest) => {
    if (lv.status !== 'approved') return false;
    if (isAdmin) return true;
    if (lv.userId === currentUser.id && !isAdmin) return false;
    if (isReportingManager || isReviewingManager || currentUser.role === 'reporting_manager' || currentUser.role === 'reviewing_manager') {
      return (
        lv.reportingManagerId === currentUser.id ||
        lv.reviewingManagerId === currentUser.id ||
        users.some((u) => u.id === lv.userId && (u.reportingManagerId === currentUser.id || u.reviewingManagerId === currentUser.id))
      );
    }
    return false;
  };

  // Summary Stat Metrics for Leave Applications
  const leaveStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let approvedDays = 0;
    let totalDays = 0;

    filteredLeaves.forEach((lv) => {
      const dCount = lv.daysCount || 1;
      totalDays += dCount;
      if (lv.status === 'approved') {
        approved++;
        approvedDays += dCount;
      } else if (lv.status === 'pending_level_1' || lv.status === 'pending_level_2') {
        pending++;
      } else if (lv.status === 'rejected') {
        rejected++;
      }
    });

    return {
      total: filteredLeaves.length,
      approved,
      pending,
      rejected,
      approvedDays,
      totalDays
    };
  }, [filteredLeaves]);

  // Specific metrics and tabs for User Role view
  const userLeaves = useMemo(() => {
    return leaveRequests.filter((l) => l.userId === currentUser.id);
  }, [leaveRequests, currentUser.id]);

  const userStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let approvedDays = 0;
    let totalDays = 0;

    userLeaves.forEach((lv) => {
      const dCount = lv.daysCount || 1;
      totalDays += dCount;
      if (lv.status === 'approved') {
        approved++;
        approvedDays += dCount;
      } else if (lv.status === 'pending_level_1' || lv.status === 'pending_level_2') {
        pending++;
      } else if (lv.status === 'rejected') {
        rejected++;
      }
    });

    return {
      total: userLeaves.length,
      approved,
      pending,
      rejected,
      approvedDays,
      totalDays
    };
  }, [userLeaves]);

  const activeUserStatusTab = useMemo(() => {
    if (filterStatus.includes('all') || filterStatus.length === 0) return 'all';
    if (filterStatus.includes('pending_level_1') || filterStatus.includes('pending_level_2')) return 'pending';
    if (filterStatus.includes('approved')) return 'approved';
    if (filterStatus.includes('rejected')) return 'rejected';
    return 'all';
  }, [filterStatus]);

  const handleUserStatusTabChange = (tab: 'all' | 'pending' | 'approved' | 'rejected') => {
    if (tab === 'all') {
      setFilterStatus(['all']);
    } else if (tab === 'pending') {
      setFilterStatus(['pending_level_1', 'pending_level_2']);
    } else if (tab === 'approved') {
      setFilterStatus(['approved']);
    } else if (tab === 'rejected') {
      setFilterStatus(['rejected']);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Applied Date', 'User Name', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status'];
    const rows = filteredLeaves.map((l) => [
      l.appliedDate,
      `"${l.userName}"`,
      `"${l.department}"`,
      `"${l.leaveTypeName}"`,
      l.startDate,
      l.endDate,
      l.daysCount,
      `"${l.reason.replace(/"/g, '""')}"`,
      l.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leave_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Pending Level 1 Approvals for me as Reporting Manager / Admin
  const pendingLevel1 = useMemo(() => {
    return leaveRequests.filter((l) => {
      if (l.status !== 'pending_level_1') return false;
      if (l.userId === currentUser.id && !isAdmin) return false;
      if (isAdmin) return true;
      if (isReportingManager) {
        return (
          l.reportingManagerId === currentUser.id ||
          !l.reportingManagerId ||
          users.some((u) => u.id === l.userId && u.reportingManagerId === currentUser.id)
        );
      }
      return false;
    });
  }, [leaveRequests, currentUser.id, isAdmin, isReportingManager, users]);

  // Pending Level 2 Approvals for me as Reviewing Manager / HoD / Admin
  const pendingLevel2 = useMemo(() => {
    return leaveRequests.filter((l) => {
      if (l.status !== 'pending_level_2') return false;
      if (l.userId === currentUser.id && !isAdmin) return false;
      if (isAdmin) return true;
      if (isReviewingManager) {
        return (
          l.reviewingManagerId === currentUser.id ||
          !l.reviewingManagerId ||
          l.department === currentUser.department
        );
      }
      return false;
    });
  }, [leaveRequests, currentUser.id, currentUser.department, isAdmin, isReviewingManager]);

  const handlePrescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFormError('Doctor prescription file size must be less than 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setPrescriptionUrl(event.target?.result as string);
      setPrescriptionFileName(file.name);
      setFormError('');
    };
    reader.readAsDataURL(file);
  };

  const handleOpenApplyModal = () => {
    if (!canApplyLeave) return;
    setFormError('');
    setFormSuccess('');
    setApplyTargetUserId(currentUser.id);
    const clPolicy = availablePolicies.find((p) => p.type === 'casual');
    if (clPolicy) {
      setSelectedLeaveType('casual');
    } else if (availablePolicies.length > 0) {
      setSelectedLeaveType(availablePolicies[0].type);
    }
    setStartDate('');
    setEndDate('');
    setReason('');
    setLtcType('none');
    setRequiresHqPermission(false);
    setStationAddress('Dehradun HQ');
    setEncashLtc(false);
    setEncashDays(10);
    setIsCommuted(false);
    setPrescriptionUrl('');
    setPrescriptionFileName('');
    setIsRhDropdownOpen(false);
    setRhSearchQuery('');
    setIsLeaveTypeDropdownOpen(false);
    setLeaveTypeSearchQuery('');
    if (restrictedHolidaysList.length > 0) {
      setSelectedRhId(restrictedHolidaysList[0].id);
    }
    setIsCoffDropdownOpen(false);
    setCoffSearchQuery('');
    if (compOffEligibleList.length > 0) {
      setSelectedCoffId(compOffEligibleList[0].id);
    }
    setAvailPrefix(false);
    setPrefixFrom('');
    setPrefixTo('');
    setAvailSuffix(false);
    setSuffixFrom('');
    setSuffixTo('');
    setShowApplyModal(true);
  };

  const handleOpenEditModal = (lv: LeaveRequest) => {
    setEditingLeave(lv);
    setEditStartDate(lv.startDate);
    setEditEndDate(lv.endDate);
    setEditReason(lv.reason);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeave) return;
    const res = editLeave(editingLeave.id, {
      startDate: editStartDate,
      endDate: editEndDate,
      reason: editReason
    });
    if (res.success) {
      setEditingLeave(null);
    } else {
      alert(res.message);
    }
  };

  const handleOpenBalanceModal = () => {
    setShowBalanceModal(true);
    setBalanceModalTab('single');
    setSelectedBalanceUserId(currentUser.id);
    const yr = selectedActiveYear || new Date().getFullYear().toString();
    setSelectedBalanceYear(yr);
    setSelectedBalanceType('casual');
    
    const u = users.find((usr) => usr.id === currentUser.id) || currentUser;
    const userYearly = u.yearlyLeaveBalances || {};
    const yearBal = userYearly[yr] || u.leaveBalances || {};
    const bal = yearBal['casual'] || { total: 12, used: 0, pending: 0, carryForward: 0 };
    
    setBalQuotaInput(bal.total);
    setBalUsedInput(bal.used);
    setBalPendingInput(bal.pending);
    setBalCarryForwardInput(bal.carryForward || 0);

    setBatchYear(yr);
    initBatchGridData(yr, 'all');
    setReconcileYear(yr);
    runAuditScan(yr);
  };

  const handleBalanceUserTypeOrYearChange = (usrId: string, lType: string, yr: string) => {
    setSelectedBalanceUserId(usrId);
    setSelectedBalanceType(lType);
    setSelectedBalanceYear(yr);
    
    const u = users.find((usr) => usr.id === usrId) || currentUser;
    const userYearly = u.yearlyLeaveBalances || {};
    const yearBal = userYearly[yr] || u.leaveBalances || {};
    const bal = yearBal[lType] || { total: 12, used: 0, pending: 0, carryForward: 0 };
    
    setBalQuotaInput(bal.total);
    setBalUsedInput(bal.used);
    setBalPendingInput(bal.pending);
    setBalCarryForwardInput(bal.carryForward || 0);
  };

  const handleSaveBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateUserLeaveBalance(
      selectedBalanceUserId,
      selectedBalanceType,
      Number(balQuotaInput),
      Number(balUsedInput),
      Number(balPendingInput),
      selectedBalanceYear,
      Number(balCarryForwardInput)
    );
    if (res.success) {
      alert(res.message);
      setShowBalanceModal(false);
    } else {
      alert(res.message);
    }
  };

  // --- MULTI-USER BATCH GRID EDITOR HANDLERS ---
  const initBatchGridData = (yr: string, empType: string) => {
    const newGrid: Record<string, { total: number; used: number; pending: number; carryForward: number }> = {};
    users.forEach((usr) => {
      if (empType !== 'all' && usr.employmentType !== empType) return;
      const userYearly = usr.yearlyLeaveBalances || {};
      const yearBal = userYearly[yr] || usr.leaveBalances || {};

      leavePolicies.forEach((pol) => {
        if (!pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(usr.employmentType)) {
          const bal = yearBal[pol.type] || { total: pol.defaultQuota, used: 0, pending: 0, carryForward: 0 };
          newGrid[`${usr.id}_${pol.type}`] = {
            total: bal.total,
            used: bal.used,
            pending: bal.pending,
            carryForward: bal.carryForward || 0
          };
        }
      });
    });
    setBatchGridData(newGrid);
    setBatchSaveMsg('');
  };

  const handleBatchCellChange = (userId: string, leaveType: string, field: 'total' | 'used' | 'pending' | 'carryForward', val: number) => {
    const key = `${userId}_${leaveType}`;
    setBatchGridData((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { total: 0, used: 0, pending: 0, carryForward: 0 }),
        [field]: val
      }
    }));
  };

  const handleSaveBatchGrid = () => {
    const payload: Array<{
      userId: string;
      year: string;
      leaveType: string;
      total: number;
      used: number;
      pending: number;
      carryForward?: number;
    }> = [];

    Object.entries(batchGridData).forEach(([key, val]) => {
      const typedVal = val as { total: number; used: number; pending: number; carryForward: number };
      const [uId, lType] = key.split('_');
      payload.push({
        userId: uId,
        year: batchYear,
        leaveType: lType,
        total: Number(typedVal.total) || 0,
        used: Number(typedVal.used) || 0,
        pending: Number(typedVal.pending) || 0,
        carryForward: Number(typedVal.carryForward) || 0
      });
    });

    const res = batchUpdateLeaveBalances(payload);
    if (res.success) {
      setBatchSaveMsg(`✅ ${res.message}`);
      setTimeout(() => setBatchSaveMsg(''), 4000);
    } else {
      alert(res.message);
    }
  };

  // --- RECONCILIATION & AUDIT TOOL HANDLERS ---
  const runAuditScan = (targetYr: string) => {
    setIsAuditRunning(true);
    setReconcileSuccessMsg('');

    setTimeout(() => {
      const report: Array<{
        userId: string;
        userName: string;
        department: string;
        employmentType: string;
        leaveType: string;
        leaveTypeName: string;
        storedUsed: number;
        actualApprovedUsed: number;
        storedPending: number;
        actualPending: number;
        hasDiscrepancy: boolean;
      }> = [];

      users.forEach((usr) => {
        const userYearly = usr.yearlyLeaveBalances || {};
        const yearBalObj = userYearly[targetYr] || usr.leaveBalances || {};

        const userLeavesInYear = leaveRequests.filter((l) => {
          if (l.userId !== usr.id) return false;
          const ly = l.startDate ? l.startDate.slice(0, 4) : targetYr;
          return ly === targetYr;
        });

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
          if (!pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(usr.employmentType)) {
            const stored = yearBalObj[pol.type] || { total: pol.defaultQuota, used: 0, pending: 0 };
            const actualApproved = approvedDaysByType[pol.type] || 0;
            const actualPending = pendingDaysByType[pol.type] || 0;
            const hasDiff = stored.used !== actualApproved || stored.pending !== actualPending;

            report.push({
              userId: usr.id,
              userName: usr.name,
              department: usr.department,
              employmentType: usr.employmentType,
              leaveType: pol.type,
              leaveTypeName: pol.name,
              storedUsed: stored.used,
              actualApprovedUsed: actualApproved,
              storedPending: stored.pending,
              actualPending: actualPending,
              hasDiscrepancy: hasDiff
            });
          }
        });
      });

      setReconcileReport(report);
      setIsAuditRunning(false);
    }, 300);
  };

  const handleExecuteReconcile = () => {
    const res = reconcileLeaveBalances(reconcileYear);
    if (res.success) {
      setReconcileSuccessMsg(`✅ ${res.message}`);
      runAuditScan(reconcileYear);
    } else {
      alert(res.message);
    }
  };

  // --- BULK CSV IMPORT HANDLER ---
  const handleCSVFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvImportSuccessMsg('');
    setCsvImportErrorMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length < 2) {
        setCsvImportErrorMsg('Uploaded CSV file is empty or missing headers.');
        return;
      }

      const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
      const parsedPreview: Array<{
        biometricId: string;
        employeeName: string;
        userId: string;
        leaveTypeCode: string;
        leaveType: string;
        leaveTypeName: string;
        year: string;
        total: number;
        used: number;
        pending: number;
        carryForward: number;
        status: 'valid' | 'warning' | 'error';
        message: string;
        employmentType?: string;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const rawVals = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
        if (rawVals.length >= 2) {
          const rowObj: Record<string, string> = {};
          rawHeaders.forEach((h, idx) => {
            rowObj[h] = rawVals[idx] || '';
          });

          const bioId = rowObj['Biometric_ID'] || rowObj['BiometricID'] || rowObj['BioID'] || rowObj['Employee_ID'] || '';
          const empName = rowObj['Employee_Name'] || rowObj['Name'] || rowObj['Email'] || '';
          const yr = rowObj['Year'] || rowObj['Calendar_Year'] || new Date().getFullYear().toString();
          const code = rowObj['Leave_Type_Code'] || rowObj['Leave_Code'] || rowObj['Leave_Type'] || '';
          const totalVal = Number(rowObj['Total_Quota'] || rowObj['Total'] || rowObj['Quota'] || 0);
          const usedVal = Number(rowObj['Used_Days'] || rowObj['Used'] || 0);
          const pendingVal = Number(rowObj['Pending_Days'] || rowObj['Pending'] || 0);
          const carryVal = Number(rowObj['Carry_Forward_Days'] || rowObj['Carry_Forward'] || rowObj['CarryForward'] || 0);

          // Find user
          const matchedUser = users.find(
            (u) =>
              (bioId && u.biometricId && u.biometricId.toLowerCase() === bioId.toLowerCase()) ||
              (empName && u.name.toLowerCase() === empName.toLowerCase()) ||
              (empName && u.email.toLowerCase() === empName.toLowerCase()) ||
              (bioId && u.id.toLowerCase() === bioId.toLowerCase())
          );

          // Find policy
          const matchedPol = leavePolicies.find(
            (p) =>
              (code && p.code && p.code.toLowerCase() === code.toLowerCase()) ||
              (code && p.type === code) ||
              (code && p.name.toLowerCase().includes(code.toLowerCase()))
          );

          let status: 'valid' | 'warning' | 'error' = 'valid';
          let message = 'Ready to import';

          if (!matchedUser) {
            status = 'error';
            message = `Employee not found with ID/Name: "${bioId || empName}"`;
          } else if (!matchedPol) {
            status = 'error';
            message = `Invalid leave type code: "${code}"`;
          } else if (matchedPol.allowedEmploymentTypes && !matchedPol.allowedEmploymentTypes.includes(matchedUser.employmentType)) {
            status = 'warning';
            message = `Leave code ${matchedPol.code || matchedPol.type} is non-standard for employment type (${matchedUser.employmentType})`;
          }

          parsedPreview.push({
            biometricId: bioId || matchedUser?.biometricId || '',
            employeeName: empName || matchedUser?.name || 'Unknown',
            userId: matchedUser?.id || '',
            leaveTypeCode: code,
            leaveType: matchedPol?.type || code,
            leaveTypeName: matchedPol?.name || code,
            year: yr,
            total: totalVal,
            used: usedVal,
            pending: pendingVal,
            carryForward: carryVal,
            status,
            message,
            employmentType: matchedUser?.employmentType
          });
        }
      }

      setCsvPreviewRows(parsedPreview);
    };
    reader.readAsText(file);
  };

  const handleExecuteBulkImport = () => {
    const validRows = csvPreviewRows.filter((r) => r.status === 'valid' || r.status === 'warning');
    if (validRows.length === 0) {
      setCsvImportErrorMsg('No valid rows available to import.');
      return;
    }

    const payload = validRows.map((r) => ({
      userId: r.userId,
      leaveType: r.leaveType,
      total: r.total,
      used: r.used,
      pending: r.pending,
      year: r.year,
      carryForward: r.carryForward
    }));

    const res = bulkImportLeaveBalances(payload);
    if (res.success) {
      setCsvImportSuccessMsg(res.message);
      setCsvImportErrorMsg('');
    } else {
      setCsvImportErrorMsg(res.message);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sampleCSV = [
      'Biometric_ID,Employee_Name,Year,Leave_Type_Code,Total_Quota,Used_Days,Pending_Days,Carry_Forward_Days',
      'WII-101,Dr. Aniket Sharma,2026,CL,8,2,0,0',
      'WII-101,Dr. Aniket Sharma,2026,EL,30,5,0,10',
      'WII-101,Dr. Aniket Sharma,2026,HPL,20,0,0,0',
      'WII-102,Priya Singh,2026,CL,8,1,0,0',
      'WII-102,Priya Singh,2026,RH,2,0,0,0',
      'WII-103,Rahul Verma,2026,EL,30,10,0,15'
    ].join('\n');

    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Leave_Balances_Bulk_Import_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --- YEAR END ROLL HANDLER ---
  const handleExecuteYearRoll = () => {
    if (yearRollFrom === yearRollTo) {
      setYearRollMsg('Source year and Target year must be different.');
      return;
    }

    const res = runYearEndLeaveRoll(yearRollFrom, yearRollTo);
    if (res.success) {
      setYearRollMsg(`✅ ${res.message}`);
    } else {
      setYearRollMsg(`❌ ${res.message}`);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!startDate || !endDate || !reason.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (startDate > endDate) {
      setFormError('Start date cannot be after end date.');
      return;
    }

    const finalStationAddress = (selectedLeaveType === 'earned' || requiresHqPermission)
      ? (stationAddress === 'Dehradun HQ' ? '' : stationAddress.trim())
      : 'Dehradun HQ';

    if (selectedLeaveType === 'earned' && !finalStationAddress) {
      setFormError('Please enter contact address and mobile number during EL.');
      return;
    }

    if (requiresHqPermission && selectedLeaveType !== 'earned' && !finalStationAddress) {
      setFormError('Please enter station location / outstation address for Headquarter Leave Permission.');
      return;
    }

    if (selectedLeaveType === 'casual' && clBaseWorkingDays === 0) {
      setFormError('Casual Leave cannot be applied on dates that fall entirely on Weekends or Gazetted Holidays.');
      return;
    }

    if (selectedLeaveType === 'station') {
      const stCheck = checkStationLeaveRange(startDate, endDate);
      if (!stCheck.valid) {
        if (stCheck.invalidDates.length === 1) {
          setFormError(`Station Leave is only allowed on Weekends (Saturday/Sunday) and Gazetted Holidays (GH). The selected date (${stCheck.invalidDates[0]}) is a working weekday.`);
        } else {
          setFormError(`Station Leave is only allowed on Weekends (Saturday/Sunday) and Gazetted Holidays (GH). The following dates are working weekdays: ${stCheck.invalidDates.join(', ')}.`);
        }
        return;
      }
    }

    if (((selectedLeaveType === 'half_pay' && isCommuted) || selectedLeaveType === 'commuted' || selectedLeaveType === 'leave_not_due') && !prescriptionUrl) {
      setFormError("Please upload Doctor's Prescription / Medical Certificate.");
      return;
    }

    if (selectedLeaveType === 'earned' && ltcType === 'ltc' && encashLtc) {
      if (!encashDays || encashDays <= 0) {
        setFormError('Please enter a valid number of days to encash.');
        return;
      }
      if (encashDays > 10) {
        setFormError('Maximum 10 days of Earned Leave (EL) can be encashed per LTC.');
        return;
      }
    }

    // Prefix validation (CCS Rule 22: must be contiguous Weekend or GH ending on day before startDate)
    if (isTwoStageLeave && availPrefix) {
      if (!prefixFrom || !prefixTo) {
        setFormError('Please select both Prefix From and Prefix To dates, or uncheck Avail Prefix.');
        return;
      }
      if (prefixFrom > prefixTo) {
        setFormError('Prefix From date cannot be after Prefix To date.');
        return;
      }
      const pCheck = checkStationLeaveRange(prefixFrom, prefixTo);
      if (!pCheck.valid) {
        setFormError(`Prefix dates must only be Weekends or Gazetted Holidays. Non-holidays found: ${pCheck.invalidDates.join(', ')}`);
        return;
      }
      const lastEligiblePrefix = eligiblePrefixDates[eligiblePrefixDates.length - 1]?.date;
      if (prefixTo !== lastEligiblePrefix) {
        setFormError(`Prefix To date must be immediately contiguous with Leave From date (${lastEligiblePrefix}).`);
        return;
      }
    }

    // Suffix validation (CCS Rule 22: must be contiguous Weekend or GH starting on day after endDate)
    if (isTwoStageLeave && availSuffix) {
      if (!suffixFrom || !suffixTo) {
        setFormError('Please select both Suffix From and Suffix To dates, or uncheck Avail Suffix.');
        return;
      }
      if (suffixFrom > suffixTo) {
        setFormError('Suffix From date cannot be after Suffix To date.');
        return;
      }
      const sCheck = checkStationLeaveRange(suffixFrom, suffixTo);
      if (!sCheck.valid) {
        setFormError(`Suffix dates must only be Weekends or Gazetted Holidays. Non-holidays found: ${sCheck.invalidDates.join(', ')}`);
        return;
      }
      const firstEligibleSuffix = eligibleSuffixDates[0]?.date;
      if (suffixFrom !== firstEligibleSuffix) {
        setFormError(`Suffix From date must be immediately contiguous with Leave To date (${firstEligibleSuffix}).`);
        return;
      }
    }

    let finalReason = reason.trim();
    if (selectedLeaveType === 'casual') {
      const sessionNotes: string[] = [];
      if (startSession === 'second_half') sessionNotes.push(`Start Date 2nd Half (AN)`);
      if (endSession === 'first_half') sessionNotes.push(`End Date 1st Half (FN)`);
      if (sessionNotes.length > 0) {
        finalReason += ` [${sessionNotes.join(', ')}]`;
      }
    } else if (selectedLeaveType === 'compensatory_off') {
      const coff = compOffEligibleList.find((c) => c.id === selectedCoffId);
      if (coff) {
        finalReason += ` [Availing C-Off against ${coff.label} on ${coff.date} (IN: ${coff.clockIn}, OUT: ${coff.clockOut})]`;
      }
    }

    const res = applyLeave({
      leaveType: selectedLeaveType,
      startDate,
      endDate,
      reason: finalReason,
      targetUserId: isAdmin ? applyTargetUserId : currentUser.id,
      ltcType: selectedLeaveType === 'earned' ? ltcType : 'none',
      stationAddress: finalStationAddress,
      encashLtc: selectedLeaveType === 'earned' && ltcType === 'ltc' ? encashLtc : false,
      encashDays: selectedLeaveType === 'earned' && ltcType === 'ltc' && encashLtc ? Number(encashDays) : undefined,
      isCommuted: selectedLeaveType === 'half_pay' ? isCommuted : (selectedLeaveType === 'commuted' ? true : false),
      prescriptionUrl: ((selectedLeaveType === 'half_pay' && isCommuted) || selectedLeaveType === 'commuted' || selectedLeaveType === 'leave_not_due') ? prescriptionUrl : undefined,
      prescriptionFileName: ((selectedLeaveType === 'half_pay' && isCommuted) || selectedLeaveType === 'commuted' || selectedLeaveType === 'leave_not_due') ? prescriptionFileName : undefined,
      customDaysCount: (selectedLeaveType === 'casual' || selectedLeaveType === 'compensatory_off' || selectedLeaveType === 'restricted') ? calculatedDays : undefined,
      prefixFrom: isTwoStageLeave && availPrefix ? prefixFrom : undefined,
      prefixTo: isTwoStageLeave && availPrefix ? prefixTo : undefined,
      suffixFrom: isTwoStageLeave && availSuffix ? suffixFrom : undefined,
      suffixTo: isTwoStageLeave && availSuffix ? suffixTo : undefined
    });
    if (!res.success) {
      setFormError(res.message);
      return;
    }

    setFormSuccess(res.message);
    setTimeout(() => {
      setShowApplyModal(false);
    }, 1200);
  };

  if ((initialTab === 'leave_matrix' || initialTab === 'leave_balance') && isAdmin) {
    return (
      <MultiUserLeaveBalanceMatrix
        onOpenQuotaImportModal={() => setShowQuotaImportModal(true)}
        onOpenBatchEditorModal={() => {
          setShowBalanceModal(true);
          setBalanceModalTab('batch_grid');
        }}
        onOpenReconcileModal={() => {
          setShowBalanceModal(true);
          setBalanceModalTab('reconcile');
        }}
        onOpenYearRollModal={() => {
          setShowBalanceModal(true);
          setBalanceModalTab('year_roll');
        }}
        selectedActiveYear={selectedActiveYear || new Date().getFullYear().toString()}
        onYearChange={(yr) => setSelectedActiveYear(yr)}
      />
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Uniform Page Header */}
      <PageHeader
        icon={FileText}
        title="Leaves"
        subtitle={`Central Civil Services (CCS) Leave Rules 1972 workflow tailored for ${currentUser.employmentType.replace('_', ' ')}`}
        rightAction={
          <div className="flex items-center justify-end space-x-2 ml-auto">
            {canApplyLeave && (
              <button
                onClick={handleOpenApplyModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 ml-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Apply Leave</span>
              </button>
            )}
          </div>
        }
      />

      {/* Leave Summary Stat Cards: Placed immediately below PageHeader */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Approved Leaves */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">
                {isUserView ? 'My Approved Leaves' : 'Approved Leaves'}
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{leaveStats.approved}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {activeCycleLabel} • {leaveStats.approvedDays} Days Approved
          </div>
        </div>

        {/* 2. Pending Approvals */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">
                {isUserView ? 'My Pending Requests' : 'Pending Approvals'}
              </p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{leaveStats.pending}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {activeCycleLabel} • Awaiting Authorization
          </div>
        </div>

        {/* 3. Total Applications */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">
                {isUserView ? 'My Applications' : 'Total Applications'}
              </p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">{leaveStats.total}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {activeCycleLabel} • Logged Applications
          </div>
        </div>

        {/* 4. Total Leave Days */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">
                {isUserView ? 'My Total Leave Days' : 'Total Leave Days'}
              </p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">{leaveStats.totalDays} Days</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Layers className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {activeCycleLabel} • Accumulated Active Leave Period
          </div>
        </div>
      </div>

      {/* Professional Date Range & Related Filters Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Top Bar: Themed Leave Accounting Cycle Dropdown & Export Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3.5 border-b border-slate-100 pb-3">
          {/* Row 1 on mobile (Left on tab/desktop): Leave Year Cycle Dropdown (User Cadre-dependent) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <LeaveCycleDropdown
              selectedCycle={selectedActiveYear}
              onChange={(yr) => setSelectedActiveYear(yr)}
              targetUser={targetEmployeeUser}
              userLeaveCycle={userCycle}
              userEmploymentType={targetEmployeeUser.employmentType}
              isAdminInstitutionalView={isInstitutionalView}
            />
          </div>

          {/* Row 2 on mobile (Right on tab/desktop): Export Buttons (CSV & PDF) - Right aligned */}
          <div className="flex items-center justify-end gap-2 shrink-0 w-full sm:w-auto ml-auto">
            <button
              onClick={handleExportCSV}
              className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
              title="Export records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
              title="Export records to PDF"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Bottom Bar: Search Keyword, Filters & View Toggle Switch */}
        <div className="flex flex-col gap-3">
          {/* Row: Search box + Reset Filters (Icon Only) + View Mode Toggle in ONE Single Row */}
          <div className="flex items-center gap-2 w-full">
            {/* Search Box */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={isUserView ? "Search leave type, reason, date..." : "Search employee, designation, date..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full pl-9 pr-8 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Reset Filters (Only Icon - Appears ONLY when any filter or search query is active) */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="h-9 w-9 rounded-xl border bg-blue-50/90 hover:bg-blue-100 text-blue-700 border-blue-200/90 flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95 animate-in fade-in zoom-in-95 duration-150"
                title="Reset active filters and search"
              >
                <RotateCcw className="w-4 h-4 text-blue-600" />
              </button>
            )}

            {/* View Mode Toggle (Table / Card) */}
            <div className="h-9 flex items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0">
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`h-7 px-2 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Card View"
                className={`h-7 px-2 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Uniform Flex Wrap */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap responsive-filter-row">
              {/* Employee Filter (Reporting Manager, HoD, Admin) */}
              {(isReportingManager || isReviewingManager || isAdmin) && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Employee"
                    icon={<User className="w-3.5 h-3.5" />}
                    selectedValues={filterEmployee}
                    onChange={setFilterEmployee}
                    options={accessibleUsers.map((u) => ({ label: `${u.name} (${u.department})`, value: u.id }))}
                  />
                </div>
              )}

              {/* Designation Filter (Reporting Manager, HoD, Admin) */}
              {(isReportingManager || isReviewingManager || isAdmin) && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Designation"
                    icon={<Filter className="w-3.5 h-3.5" />}
                    selectedValues={filterDesignation}
                    onChange={setFilterDesignation}
                    options={designationsList.map((d) => ({ label: d, value: d }))}
                  />
                </div>
              )}

              {/* Department Filter (Reporting Manager, HoD, Admin) */}
              {(isReportingManager || isReviewingManager || isAdmin) && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Department"
                    icon={<Building2 className="w-3.5 h-3.5" />}
                    selectedValues={filterDepartment}
                    onChange={setFilterDepartment}
                    options={departmentsList.map((dept) => ({ label: dept, value: dept }))}
                  />
                </div>
              )}

              {/* Reporting Manager Filter (HoD, Admin) */}
              {(isReviewingManager || isAdmin) && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Reporting Manager"
                    icon={<User className="w-3.5 h-3.5" />}
                    selectedValues={filterReportingManager}
                    onChange={setFilterReportingManager}
                    options={reportingManagersList.map((m) => ({ label: m.name, value: m.id }))}
                  />
                </div>
              )}

              {/* Leave Type Filter (All Roles) */}
              <div className="flex-1 min-w-[115px] max-w-[160px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="Leave Type"
                  icon={<Filter className="w-3.5 h-3.5" />}
                  selectedValues={filterReason}
                  onChange={setFilterReason}
                  options={[
                    { label: 'Casual Leave (CL)', value: 'casual' },
                    { label: 'Earned Leave (EL)', value: 'earned' },
                    { label: 'Half Pay Leave (HPL)', value: 'half_pay' },
                    { label: 'Station Leave / HQ Permission (STN)', value: 'station' },
                    { label: 'Commuted Leave', value: 'commuted' },
                    { label: 'Restricted Holiday (RH)', value: 'restricted' },
                    { label: 'Compensatory Off (C-OFF)', value: 'compensatory_off' },
                    { label: 'Maternity Leave', value: 'maternity' },
                    { label: 'Paternity Leave', value: 'paternity' },
                    { label: 'Child Care Leave (CCL)', value: 'child_care' },
                    { label: 'Sick Leave (SL)', value: 'sick' },
                    { label: 'Extra Ordinary Leave (EOL)', value: 'extra_ordinary' },
                    { label: 'Study Leave', value: 'study' },
                    { label: 'Special Casual Leave', value: 'special_casual' },
                    { label: 'Field Work Leave', value: 'field_work' },
                    { label: 'Academic Leave', value: 'academic' }
                  ]}
                />
              </div>

              {/* Status Filter (All Roles) */}
              <div className="flex-1 min-w-[95px] max-w-[130px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="Status"
                  icon={<Clock className="w-3.5 h-3.5" />}
                  selectedValues={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { label: 'Pending Level 1', value: 'pending_level_1' },
                    { label: 'Pending Level 2', value: 'pending_level_2' },
                    { label: 'Approved', value: 'approved' },
                    { label: 'Rejected', value: 'rejected' }
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Leave Approvals Banner for Managers (Hidden for Admin who manages in main table) */}
      {!isAdmin && (pendingLevel1.length > 0 || pendingLevel2.length > 0) && (
        <div className="bg-[#fefce8] border border-amber-300/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-amber-100/90 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950">
                Action Required: {pendingLevel1.length + pendingLevel2.length} Pending Leave Request{(pendingLevel1.length + pendingLevel2.length) > 1 ? 's' : ''}
              </h3>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Staff members have submitted leave applications requiring your review and authorization.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById('leave-approval-queue-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-[#ea580c] hover:bg-[#c2410c] active:bg-[#9a3412] text-white font-bold text-xs px-5 py-2 rounded-full shadow-2xs transition-all cursor-pointer shrink-0 flex items-center space-x-1.5"
          >
            <span>Review Queue ({pendingLevel1.length + pendingLevel2.length})</span>
          </button>
        </div>
      )}

      {/* Leave Policy Quotas & Balances Section (Matching Dashboard Leave Balance Theme & Mobile Cards) */}
      {showBalanceSection && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2 shrink-0">
              <Layers className="w-5 h-5 text-blue-600 shrink-0" />
              <span>Leave Balance</span>
            </h2>

            <div className="flex items-center space-x-2">
              {/* Generic Single Expand / Collapse Toggle Button */}
              {availablePolicies.length > primaryPolicies.length && (
                <button
                  type="button"
                  onClick={() => setShowAllPolicies(!showAllPolicies)}
                  className="h-7.5 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/90 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                  title={showAllPolicies ? 'View Less' : 'View All'}
                >
                  <span>{showAllPolicies ? 'View Less' : 'View All'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showAllPolicies ? 'rotate-180 text-blue-600' : ''}`} />
                </button>
              )}

              {/* View Mode Toggle - Hidden on Mobile (Mobile always uses Cards view like Dashboard) */}
              <div className="hidden sm:flex h-7.5 items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg gap-0.5">
                <button
                  type="button"
                  onClick={() => setBalanceViewMode('table')}
                  title="Table View"
                  className={`h-6 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                    balanceViewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceViewMode('grid')}
                  title="Card Grid View"
                  className={`h-6 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                    balanceViewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Tabular View (Hidden on mobile, shown on desktop when balanceViewMode === 'table') */}
          {balanceViewMode === 'table' && (
            <div className="hidden sm:block w-full overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs bg-white no-scrollbar">
              <table className="w-full text-left text-xs border-collapse table-auto min-w-[550px]">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr className="h-9">
                    <th className="px-4 py-2 whitespace-nowrap align-middle min-w-[170px]">Leave Type</th>
                    <th className="px-4 py-2 text-center whitespace-nowrap align-middle min-w-[85px]">Total Quota</th>
                    <th className="px-4 py-2 text-center whitespace-nowrap align-middle min-w-[85px]">Days Used</th>
                    <th className="px-4 py-2 text-center whitespace-nowrap align-middle min-w-[85px]">Pending</th>
                    <th className="px-4 py-2 text-right whitespace-nowrap align-middle min-w-[100px]">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {displayedPolicies.map((pol) => {
                    const typeKey = pol.type;
                    const displayUser = targetEmployeeUser;
                    const rawYr = selectedActiveYear && selectedActiveYear.includes('-')
                      ? selectedActiveYear.split('-')[1].slice(0, 4)
                      : (selectedActiveYear && selectedActiveYear !== 'all')
                      ? selectedActiveYear
                      : new Date().getFullYear().toString();
                    const userYearly = displayUser.yearlyLeaveBalances || {};
                    const yearBalObj =
                      userYearly[selectedActiveYear] ||
                      userYearly[rawYr] ||
                      userYearly[new Date().getFullYear().toString()] ||
                      displayUser.leaveBalances ||
                      {};
                    const balObj = yearBalObj[typeKey] || { total: pol.defaultQuota, used: 0, pending: 0 };
                    const bal = balObj as { total: number; used: number; pending: number };
                    const available = Math.max(0, bal.total - bal.used);

                    const formatDisplayName = (name: string, type: string) => {
                      const codeMap: Record<string, string> = {
                        earned: 'EL',
                        casual: 'CL',
                        half_pay: 'HPL',
                        station: 'STN',
                        restricted: 'RH',
                        compensatory_off: 'Comp-off',
                        commuted: 'COMM',
                        maternity: 'ML',
                        paternity: 'PL',
                        child_care: 'CCL',
                        sick: 'SL',
                        field_work: 'FWL',
                        academic: 'AL'
                      };
                      const code = codeMap[type] || type.toUpperCase();
                      const cleanName = name.replace(/\s*\([^)]*\)/, '');
                      return `${cleanName} (${code})`;
                    };

                    return (
                      <tr key={typeKey} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-900 align-middle">
                          {formatDisplayName(pol.name, typeKey)}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-700 align-middle whitespace-nowrap">
                          {bal.total} days
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-700 align-middle whitespace-nowrap">
                          {bal.used} days
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold align-middle whitespace-nowrap">
                          {bal.pending > 0 ? (
                            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/90 text-[10px] font-bold inline-flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>{bal.pending} d</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right align-middle whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            available > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {available} Days Left
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Cards View - Always shown on Mobile (<sm), shown on Desktop (sm+) when balanceViewMode === 'grid' (Pic 2 Dashboard Theme) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${balanceViewMode === 'table' ? 'block sm:hidden' : 'block'}`}>
            {displayedPolicies.map((pol) => {
              const typeKey = pol.type;
              const displayUser = targetEmployeeUser;
              const rawYr = selectedActiveYear && selectedActiveYear.includes('-')
                ? selectedActiveYear.split('-')[1].slice(0, 4)
                : (selectedActiveYear && selectedActiveYear !== 'all')
                ? selectedActiveYear
                : new Date().getFullYear().toString();
              const userYearly = displayUser.yearlyLeaveBalances || {};
              const yearBalObj =
                userYearly[selectedActiveYear] ||
                userYearly[rawYr] ||
                userYearly[new Date().getFullYear().toString()] ||
                displayUser.leaveBalances ||
                {};
              const balObj = yearBalObj[typeKey] || { total: pol.defaultQuota, used: 0, pending: 0 };
              const bal = balObj as { total: number; used: number; pending: number };
              const available = Math.max(0, bal.total - bal.used);
              const percentUsed = bal.total > 0 ? Math.min(100, Math.max(0, Math.round((bal.used / bal.total) * 100))) : 0;

              const formatDisplayName = (name: string, type: string) => {
                const codeMap: Record<string, string> = {
                  earned: 'EL',
                  casual: 'CL',
                  half_pay: 'HPL',
                  station: 'STN',
                  restricted: 'RH',
                  compensatory_off: 'Comp-off',
                  commuted: 'COMM',
                  maternity: 'ML',
                  paternity: 'PL',
                  child_care: 'CCL',
                  sick: 'SL',
                  field_work: 'FWL',
                  academic: 'AL'
                };
                const code = codeMap[type] || type.toUpperCase();
                const cleanName = name.replace(/\s*\([^)]*\)/, '');
                return `${cleanName} (${code})`;
              };

              return (
                <div
                  key={typeKey}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-800 truncate" title={pol.name}>
                        {formatDisplayName(pol.name, typeKey)}
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
                        {available} Days Left
                      </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {bal.used} <span className="text-xs font-normal text-slate-500">/ {bal.total} Used</span>
                    </div>
                  </div>

                  <div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${percentUsed}%` }} />
                    </div>
                    {bal.pending > 0 && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1.5 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{bal.pending} day(s) pending approval</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leave Approval Queues Wrapper (Reporting Manager & HoD Queue Cards - Hidden for Admin who manages in main table) */}
      {!isAdmin && (pendingLevel1.length > 0 || pendingLevel2.length > 0) && (
        <div id="leave-approval-queue-section" className="space-y-6">
          {/* Level-1 Approval Queue (If Reporting Manager) */}
          {pendingLevel1.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <span>Level-1 Pending Approvals (Reporting Manager Queue)</span>
                </h2>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {pendingLevel1.length} Request(s)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingLevel1.map((lv) => (
                  <div key={lv.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{lv.userName}</h3>
                        <p className="text-slate-500">{lv.department}</p>
                      </div>
                      <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">
                        {lv.leaveTypeName}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                      <p className="text-slate-800">
                        🗓️ Dates: <strong>{lv.startDate}</strong> to <strong>{lv.endDate}</strong> ({lv.daysCount} days)
                      </p>
                      <p className="text-slate-600 italic">"{lv.reason}"</p>
                      <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        Next Stage:{' '}
                        {lv.requiresLevel2 ? 'Level-2 Reviewing Manager Approval Needed' : 'Final Direct Approval'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Level-1 remarks..."
                        value={level1Comments[lv.id] || ''}
                        onChange={(e) => setLevel1Comments({ ...level1Comments, [lv.id]: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => approveLeaveLevel1(lv.id, level1Comments[lv.id])}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Level-1</span>
                        </button>
                        <button
                          onClick={() => rejectLeaveLevel1(lv.id, level1Comments[lv.id])}
                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Level-2 Approval Queue (If HoD) */}
          {pendingLevel2.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span>Level-2 Pending Approvals (HoD Queue)</span>
                </h2>
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {pendingLevel2.length} Escalated
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingLevel2.map((lv) => (
                  <div key={lv.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{lv.userName}</h3>
                        <p className="text-slate-500">{lv.department}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                        Level-2 Required
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                      <p className="text-slate-800">
                        🌴 <strong>Leave:</strong> {lv.leaveTypeName} ({lv.daysCount} days)
                      </p>
                      <p className="text-slate-600">
                        🗓️ Dates: {lv.startDate} to {lv.endDate}
                      </p>
                      <p className="text-slate-600 italic">"{lv.reason}"</p>
                      {lv.level1Approval && (
                        <p className="text-[10px] text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-100 mt-1">
                          ✅ Level-1 Cleared by {lv.level1Approval.approverName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Level-2 final clearance remarks..."
                        value={level2Comments[lv.id] || ''}
                        onChange={(e) => setLevel2Comments({ ...level2Comments, [lv.id]: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => approveLeaveLevel2(lv.id, level2Comments[lv.id])}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Level-2</span>
                        </button>
                        <button
                          onClick={() => rejectLeaveLevel2(lv.id, level2Comments[lv.id])}
                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leave Applications History / Requisitions Container */}
      <div className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {/* Table Title Bar matching Manual Attendance Records theme */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 min-h-[50px]">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {isUserView ? 'MY LEAVE APPLICATIONS' : 'LEAVE APPLICATIONS'} ({filteredLeaves.length})
            </span>
          </div>
        </div>

        {filteredLeaves.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white space-y-2">
            <FileText className="w-10 h-10 mx-auto text-indigo-300" />
            <p className="text-xs font-semibold">No leave applications match your search or filter criteria.</p>
            {canApplyLeave && (
              <button
                onClick={handleOpenApplyModal}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Click here to apply leave
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="w-full min-w-0 overflow-x-auto custom-table-scrollbar pb-1">
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[10.5px]">
                <tr className="h-9">
                  {/* Employee Column */}
                  <th
                    onClick={() => handleSort('employee')}
                    className="py-2 px-1.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Employee"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Employee</span>
                      {sortField === 'employee' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Dates Column */}
                  <th
                    onClick={() => handleSort('dates')}
                    className="py-2 px-1.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Dates"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Leave Dates</span>
                      {sortField === 'dates' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Applied Date Column */}
                  <th
                    onClick={() => handleSort('appliedDate')}
                    className="py-2 px-1.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Applied Date"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Applied Date</span>
                      {sortField === 'appliedDate' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Category Column */}
                  <th
                    onClick={() => handleSort('leaveType')}
                    className="py-2 px-1.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Category"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Category</span>
                      {sortField === 'leaveType' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Reason / Details Column */}
                  <th
                    onClick={() => handleSort('reason')}
                    className="py-2 px-1.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Reason / Details"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Reason</span>
                      {sortField === 'reason' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Status Column */}
                  <th
                    onClick={() => handleSort('status')}
                    className="py-2 px-1.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Status"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {sortField === 'status' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Actions Column */}
                  <th className="py-2 px-2 text-right font-bold whitespace-nowrap align-middle">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLeaves.map((lv) => {
                  const staffUser = users.find((u) => u.id === lv.userId);
                  return (
                    <tr key={lv.id} className="hover:bg-slate-50 transition-colors">
                      {/* Employee Column */}
                      <td className="py-2 px-1.5 align-middle">
                        <div className="flex items-center space-x-1.5 min-w-0 max-w-[105px] sm:max-w-[125px]">
                          <img
                            src={staffUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                            alt={lv.userName}
                            className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 block truncate text-xs">{lv.userName}</span>
                            <span className="text-[9.5px] text-slate-500 font-medium block truncate">
                              {staffUser?.designation || lv.designation || 'Staff'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono tracking-tight block truncate">
                              {staffUser?.biometricId ? `Bio: ${staffUser.biometricId}` : (lv.userId ? `ID: ${lv.userId}` : '')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Dates Column */}
                      <td className="py-2 px-1.5 whitespace-nowrap align-middle">
                        <div className="font-bold text-slate-900 flex items-center space-x-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span>{lv.startDate === lv.endDate ? lv.startDate : `${lv.startDate} to ${lv.endDate}`}</span>
                        </div>
                        <div className="text-[9.5px] font-mono text-slate-600 mt-0.5 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{lv.daysCount} Day{lv.daysCount > 1 ? 's' : ''}</span>
                          {(lv.prefixFrom || lv.suffixTo) && (
                            <span className="text-[8.5px] font-sans font-bold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200/60 ml-0.5" title={`Prefix: ${lv.prefixFrom || 'None'}, Suffix: ${lv.suffixTo || 'None'}`}>
                              {lv.prefixFrom && lv.suffixTo ? 'P+S' : lv.prefixFrom ? 'Pref' : 'Suff'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Applied Date Column */}
                      <td className="py-2 px-1.5 whitespace-nowrap align-middle text-slate-700 text-xs">
                        <div className="flex items-center space-x-1 text-slate-600">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-medium text-[11px]">{lv.appliedDate}</span>
                        </div>
                      </td>

                      {/* Category Column */}
                      <td className="py-2 px-1.5 whitespace-nowrap align-middle">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold inline-block border bg-blue-50 text-blue-800 border-blue-200/80">
                          {lv.leaveTypeName.replace(/\s*\([^)]*\)/, '')}
                        </span>
                      </td>

                      {/* Reason / Details Column with View More */}
                      <td className="py-2 px-1.5 align-middle">
                        <div className="flex items-center justify-between gap-1 max-w-[70px] sm:max-w-[85px]">
                          <span className="text-slate-700 text-[11px] truncate flex-1 min-w-0 font-medium italic" title={lv.reason}>
                            "{lv.reason}"
                          </span>
                          {(lv.reason || '').length > 12 && (
                            <button
                              onClick={() =>
                                setActiveReasonModal({
                                  employeeName: lv.userName,
                                  leaveType: lv.leaveTypeName,
                                  dates: lv.startDate === lv.endDate ? lv.startDate : `${lv.startDate} to ${lv.endDate}`,
                                  reason: lv.reason
                                })
                              }
                              className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center cursor-pointer shrink-0 text-[9.5px] hover:underline"
                              title="View full reason"
                            >
                              <span>More</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-2 px-1.5 whitespace-nowrap align-middle">
                        <div>
                          {lv.status === 'approved' && (
                            <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[9.5px] border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Approved</span>
                            </span>
                          )}
                          {(lv.status === 'pending_level_1' || lv.status === 'pending_level_2') && (
                            <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[9.5px] border border-amber-200">
                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                              <span>Pending</span>
                            </span>
                          )}
                          {lv.status === 'rejected' && (
                            <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded text-[9.5px] border border-rose-200">
                              <XCircle className="w-2.5 h-2.5 text-rose-600" />
                              <span>Rejected</span>
                            </span>
                          )}
                          {lv.status === 'cancelled' && (
                            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[9.5px] border border-slate-200">
                              <RotateCcw className="w-2.5 h-2.5 text-slate-500" />
                              <span>Cancelled</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[9.5px] text-slate-500 font-medium block mt-0.5 whitespace-nowrap">
                          by {getActionByName(lv)}
                        </span>

                        {/* Joining Report Indicator for approved leaves on/after last day requiring HoD approval */}
                        {isJoiningReportEligible(lv) && (
                          <div className="mt-1">
                            <button
                              onClick={() => setSelectedJoiningLeave(lv)}
                              className={`inline-flex items-center space-x-1 font-bold px-1.5 py-0.5 rounded text-[9px] border cursor-pointer transition-colors ${getJoiningButtonStyle(
                                lv.joiningReport?.status
                              )}`}
                              title={
                                lv.joiningReport?.status === 'accepted'
                                  ? `Joining Verified & Approved by HoD (${lv.joiningReport.verifiedByName || 'HoD'})`
                                  : lv.joiningReport?.status === 'forwarded'
                                  ? 'Forwarded to HoD for Approval'
                                  : lv.joiningReport?.status === 'submitted'
                                  ? 'Forwarding Pending'
                                  : lv.joiningReport?.status === 'rejected'
                                  ? 'Joining Report Rejected'
                                  : currentUser.id === lv.userId
                                  ? 'Post-leave Joining Report Required (Click to Apply)'
                                  : `Joining Report pending submission by employee (${lv.userName})`
                              }
                            >
                              <FileCheck className="w-2.5 h-2.5 shrink-0" />
                              <span>
                                {lv.joiningReport?.status === 'accepted'
                                  ? `Joined (${lv.joiningReport.joiningDate})`
                                  : lv.joiningReport?.status === 'forwarded'
                                  ? 'Forwarded to HoD'
                                  : lv.joiningReport?.status === 'submitted'
                                  ? 'Forwarding Pending'
                                  : lv.joiningReport?.status === 'rejected'
                                  ? 'Joining Rejected'
                                  : currentUser.id === lv.userId
                                  ? 'Apply Joining'
                                  : 'Joining Pending'}
                              </span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap align-middle">
                        <div className="flex items-center justify-end space-x-1">
                          {/* View Details / See button */}
                          <button
                            onClick={() => setDetailModalLeave(lv)}
                            className={`w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95 ${getSeeButtonStyle(
                              lv.status
                            )}`}
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 stroke-[2]" />
                          </button>

                          {/* Joining Report Action Button for 2 stage leaves */}
                          {isJoiningReportEligible(lv) && (
                            <button
                              onClick={() => setSelectedJoiningLeave(lv)}
                              className={`w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95 ${getJoiningButtonStyle(
                                lv.joiningReport?.status
                              )}`}
                              title={
                                lv.joiningReport?.status === 'accepted'
                                  ? `Duty Resumed on ${lv.joiningReport.joiningDate} (HoD Approved)`
                                  : lv.joiningReport?.status === 'forwarded'
                                  ? 'Joining Report Forwarded to HoD for Approval'
                                  : lv.joiningReport?.status === 'submitted'
                                  ? 'Joining Report Submitted - Pending Forwarding'
                                  : lv.joiningReport?.status === 'rejected'
                                  ? 'Joining Report Rejected'
                                  : currentUser.id === lv.userId
                                  ? 'Submit Post-Leave Joining Report'
                                  : `Joining Report Pending Submission from Employee (${lv.userName})`
                              }
                            >
                              <FileCheck className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                          )}

                          {/* Edit Button */}
                          {canUserModify(lv) && (
                            <button
                              onClick={() => handleOpenEditModal(lv)}
                              className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Edit Leave Request"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-blue-600 stroke-[2]" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {canUserModify(lv) && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this leave request?')) {
                                  deleteLeave(lv.id);
                                }
                              }}
                              className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Delete Leave Request"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600 stroke-[2]" />
                            </button>
                          )}

                          {/* Approve / Forward & Reject Action Buttons for Manager / Admin */}
                          {canManagerAction(lv) && (
                            <>
                              {lv.status === 'pending_level_1' && lv.requiresLevel2 ? (
                                <button
                                  onClick={() => {
                                    const comm = prompt('Enter Level-1 remarks to forward:', level1Comments[lv.id] || '');
                                    if (comm !== null) approveLeaveLevel1(lv.id, comm);
                                  }}
                                  className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                                  title="Forward to Reviewing Manager (Level-2)"
                                >
                                  <Send className="w-3.5 h-3.5 text-indigo-600 stroke-[2]" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    const comm = prompt('Enter approval comments:', (lv.status === 'pending_level_1' ? level1Comments[lv.id] : level2Comments[lv.id]) || '');
                                    if (comm !== null) {
                                      if (lv.status === 'pending_level_1') approveLeaveLevel1(lv.id, comm);
                                      else approveLeaveLevel2(lv.id, comm);
                                    }
                                  }}
                                  className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                                  title="Approve Leave Request"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2]" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const comm = prompt('Enter rejection comments:', (lv.status === 'pending_level_1' ? level1Comments[lv.id] : level2Comments[lv.id]) || '');
                                  if (comm !== null) {
                                    if (lv.status === 'pending_level_1') rejectLeaveLevel1(lv.id, comm);
                                    else rejectLeaveLevel2(lv.id, comm);
                                  }
                                }}
                                className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                                title="Reject Leave Request"
                              >
                                <X className="w-3.5 h-3.5 text-rose-600 stroke-[2]" />
                              </button>
                            </>
                          )}

                          {/* Cancel Approved Record Button */}
                          {canManagerCancelApproval(lv) && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to cancel this approved leave record?')) {
                                  rejectLeaveLevel1(lv.id, 'Approved leave cancelled by Manager/Admin.');
                                }
                              }}
                              className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Cancel Approved Leave"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-rose-600 stroke-[2]" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeaves.map((lv) => (
              <div key={lv.id} className="p-4 bg-white hover:border-blue-300 rounded-2xl border border-slate-200 space-y-3 text-xs shadow-2xs">
                <div className="flex items-start justify-between">
                  <div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{lv.userName}</h3>
                      <p className="text-[11px] text-slate-500">{lv.department}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      lv.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : lv.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {lv.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-slate-700">
                  <div className="flex items-center space-x-1.5">
                    <span>🌴 <strong>Type:</strong> {lv.leaveTypeName.replace(/ \([^)]*\)/, '')} ({lv.daysCount} d)</span>
                  </div>
                  <p>
                    🗓️ <strong>Dates:</strong> {lv.startDate} to {lv.endDate}
                  </p>
                  {(lv.prefixFrom || lv.suffixTo) && (
                    <div className="text-[10px] text-indigo-800 bg-indigo-50/70 p-1 rounded border border-indigo-200/60 flex flex-wrap gap-1 font-medium">
                      {lv.prefixFrom && <span><strong>Prefix:</strong> {lv.prefixFrom} to {lv.prefixTo}</span>}
                      {lv.prefixFrom && lv.suffixTo && <span>•</span>}
                      {lv.suffixTo && <span><strong>Suffix:</strong> {lv.suffixFrom} to {lv.suffixTo}</span>}
                    </div>
                  )}
                  <p className="text-slate-500">
                    📅 <strong>Applied:</strong> {lv.appliedDate}
                  </p>
                  <p className="text-slate-500">
                    🏢 <strong>Station:</strong> WII HQ (Dehradun)
                  </p>
                  <p className="text-slate-500">
                    👤 <strong>Dealing Person:</strong> {getDealingPerson(lv)}
                  </p>
                  <p className="italic text-slate-600 border-t border-slate-200/60 pt-1 mt-1">"{lv.reason}"</p>
                </div>

                {/* Joining report section in Card View for approved leaves on/after last day */}
                {isJoiningReportEligible(lv) && (
                  <div className="pt-2">
                    <button
                      onClick={() => setSelectedJoiningLeave(lv)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${getJoiningButtonStyle(
                        lv.joiningReport?.status
                      )}`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <FileCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          Joining Report:{' '}
                          {lv.joiningReport?.status === 'accepted'
                            ? 'Verified (HoD Approved)'
                            : lv.joiningReport?.status === 'forwarded'
                            ? 'Forwarded to HoD'
                            : lv.joiningReport?.status === 'submitted'
                            ? 'Forwarding Pending'
                            : lv.joiningReport?.status === 'rejected'
                            ? 'Rejected'
                            : currentUser.id === lv.userId
                            ? 'Apply Joining Report'
                            : 'Pending (Employee)'}
                        </span>
                      </div>
                      <span className="text-[10px] bg-white/80 px-2 py-0.5 rounded-md border shadow-2xs shrink-0 font-semibold">
                        {lv.joiningReport?.status === 'accepted'
                          ? 'Approved'
                          : lv.joiningReport?.status === 'rejected'
                          ? 'Rejected'
                          : lv.joiningReport
                          ? 'Pending'
                          : currentUser.id === lv.userId
                          ? 'Apply'
                          : 'Not Applied'}
                      </span>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>Applied: {lv.appliedDate}</span>
                  <div className="flex items-center space-x-1">
                    {/* See Details Button */}
                    <button
                      onClick={() => setDetailModalLeave(lv)}
                      className={`p-1.5 rounded transition-colors cursor-pointer flex items-center space-x-1 font-semibold text-xs border ${getSeeButtonStyle(
                        lv.status
                      )}`}
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    {/* Edit Button */}
                    {canUserModify(lv) && (
                      <button
                        onClick={() => handleOpenEditModal(lv)}
                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer flex items-center space-x-1 font-semibold text-xs"
                        title="Edit Leave Request"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Button */}
                    {canUserModify(lv) && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this leave request?')) {
                            deleteLeave(lv.id);
                          }
                        }}
                        className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer flex items-center space-x-1 font-semibold text-xs"
                        title="Delete Leave Request"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Approve / Forward & Reject Buttons */}
                    {canManagerAction(lv) && (
                      <>
                        {lv.status === 'pending_level_1' && lv.requiresLevel2 ? (
                          <button
                            onClick={() => {
                              const comm = prompt('Enter Level-1 remarks to forward:', level1Comments[lv.id] || '');
                              if (comm !== null) approveLeaveLevel1(lv.id, comm);
                            }}
                            className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer flex items-center space-x-1 font-semibold text-xs"
                            title="Forward to Reviewing Manager (Level-2)"
                          >
                            <Send className="w-3.5 h-3.5 text-indigo-600" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const comm = prompt('Enter approval comments:', (lv.status === 'pending_level_1' ? level1Comments[lv.id] : level2Comments[lv.id]) || '');
                              if (comm !== null) {
                                if (lv.status === 'pending_level_1') approveLeaveLevel1(lv.id, comm);
                                else approveLeaveLevel2(lv.id, comm);
                              }
                            }}
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors cursor-pointer flex items-center space-x-1 font-semibold text-xs"
                            title="Approve Leave Request"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const comm = prompt('Enter rejection comments:', (lv.status === 'pending_level_1' ? level1Comments[lv.id] : level2Comments[lv.id]) || '');
                            if (comm !== null) {
                              if (lv.status === 'pending_level_1') rejectLeaveLevel1(lv.id, comm);
                              else rejectLeaveLevel2(lv.id, comm);
                            }
                          }}
                          className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer flex items-center space-x-1 font-semibold text-xs"
                          title="Reject Leave Request"
                        >
                          <X className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </>
                    )}

                    {/* Cancel Approved Record Button */}
                    {canManagerCancelApproval(lv) && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to cancel this approved leave record?')) {
                            rejectLeaveLevel1(lv.id, 'Approved leave cancelled by Manager/Admin.');
                          }
                        }}
                        className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer flex items-center space-x-1 font-semibold text-xs"
                        title="Cancel Approved Leave"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stable Full-Width Footer & Pagination (Fixed at bottom of card, outside horizontal scroll) */}
        <div className="w-full border-t border-slate-200/90 bg-white">
          <TablePagination
            currentPage={tablePage}
            totalPages={Math.ceil(filteredLeaves.length / tablePageSize)}
            totalItems={filteredLeaves.length}
            pageSize={tablePageSize}
            onPageChange={setTablePage}
            onPageSizeChange={setTablePageSize}
          />
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto sm:my-6 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-4 sm:px-5 py-3 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md shrink-0">
                  <Calendar className="w-4.5 h-4.5 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold tracking-wide">
                    Apply Leave
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-3.5 sm:p-4.5 space-y-2.5 sm:space-y-3 overflow-y-auto flex-1 custom-table-scrollbar">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Admin Target Employee Selector */}
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Apply on Behalf of Employee *
                  </label>
                  <AppSelect
                    value={applyTargetUserId}
                    onChange={(val) => setApplyTargetUserId(val)}
                    options={users.map((u) => ({
                      label: u.name,
                      value: u.id,
                      description: `${u.department} - ${u.designation || 'Staff'}`
                    }))}
                  />
                </div>
              )}

              {/* Leave Type Selector with Available Quota Badge */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Leave Type *</span>
                  {(() => {
                    const targetUserObj = users.find((u) => u.id === (isAdmin ? applyTargetUserId : currentUser.id)) || currentUser;
                    const balObj = targetUserObj.leaveBalances?.[selectedLeaveType] || { total: selectedPolicy?.defaultQuota || 0, used: 0, pending: 0 };
                    const availableQuota = Math.max(0, balObj.total - balObj.used);
                    return (
                      <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Balance: {availableQuota} Days
                      </span>
                    );
                  })()}
                </label>
                <AppSelect
                  value={selectedLeaveType}
                  onChange={(val) => {
                    setSelectedLeaveType(val as LeaveType);
                    if (val === 'restricted' && restrictedHolidaysList.length > 0) {
                      handleRhChange(restrictedHolidaysList[0].id);
                    } else if (val === 'compensatory_off' && compOffEligibleList.length > 0) {
                      handleCoffChange(compOffEligibleList[0].id);
                    }
                  }}
                  options={availablePolicies.map((pol) => ({
                    label: `${pol.name.replace(/\s*\([^)]*\)/, '')} (${getLeaveTypeCode(pol.type)})`,
                    value: pol.type,
                    description: pol.description
                  }))}
                />
              </div>

              {/* Restricted Holiday (RH) Selector */}
              {selectedLeaveType === 'restricted' ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Declared Restricted Holiday (RH) *
                    </label>
                    <AppSelect
                      value={selectedRhId}
                      onChange={(val) => handleRhChange(val)}
                      options={restrictedHolidaysList.map((rh) => ({
                        label: `${rh.name} (${new Date(rh.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`,
                        value: rh.id,
                        description: `${rh.date} (${rh.dayOfWeek}) • ${rh.category} RH`
                      }))}
                    />
                  </div>

                  {(() => {
                    const rh = restrictedHolidaysList.find((h) => h.id === selectedRhId) || restrictedHolidaysList[0];
                    if (!rh) return null;
                    return (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{rh.name} {rh.hindiName ? `(${rh.hindiName})` : ''}</span>
                          <span className="bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                            1 Day (RH)
                          </span>
                        </div>
                        <p className="text-slate-600 font-medium text-[11px] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{new Date(rh.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} ({rh.dayOfWeek})</span>
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : selectedLeaveType === 'compensatory_off' ? (
                /* Compensatory Off (C-Off) Selector */
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Earned Compensatory Off Record (Weekend/Holiday Worked) *
                    </label>
                    <AppSelect
                      value={selectedCoffId}
                      onChange={(val) => handleCoffChange(val)}
                      options={compOffEligibleList.map((c) => ({
                        label: `${c.label} (${new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`,
                        value: c.id,
                        description: `Worked ${c.date} • ${c.clockIn} - ${c.clockOut} (${c.totalHours}h)`
                      }))}
                    />
                  </div>

                  <AppDatePicker
                    label="Avail Leave On Date *"
                    value={startDate}
                    minDate={todayStr}
                    onChange={(dStr) => {
                      setStartDate(dStr);
                      setEndDate(dStr);
                    }}
                  />
                </div>
              ) : (
                /* Standard Leave Dates (Start & End) */
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                    <AppDatePicker
                      label="From Date (Start Date) *"
                      value={startDate}
                      minDate={todayStr}
                      onChange={(dStr) => {
                        setStartDate(dStr);
                        if (!endDate || dStr > endDate) setEndDate(dStr);
                      }}
                    />
                    <AppDatePicker
                      label="To Date (End Date) *"
                      value={endDate}
                      minDate={startDate || todayStr}
                      onChange={(dStr) => setEndDate(dStr)}
                      isRightColumn={true}
                    />
                  </div>

                  {/* Casual Leave Sessions (Half Day) */}
                  {selectedLeaveType === 'casual' && startDate && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Start Session
                        </label>
                        <AppSelect
                          value={startSession}
                          onChange={(val) => setStartSession(val as 'first_half' | 'second_half')}
                          options={[
                            { label: 'Full Day / 1st Half', value: 'first_half' },
                            { label: '2nd Half (Post Lunch)', value: 'second_half' }
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          End Session
                        </label>
                        <AppSelect
                          value={endSession}
                          onChange={(val) => setEndSession(val as 'first_half' | 'second_half')}
                          options={[
                            { label: '1st Half (Pre Lunch)', value: 'first_half' },
                            { label: 'Full Day / 2nd Half', value: 'second_half' }
                          ]}
                        />
                      </div>
                    </div>
                  )}

                  {/* Total Duration Calculated Badge */}
                  {startDate && endDate && (
                    <div className="flex items-center justify-between p-2 px-2.5 bg-blue-50/60 border border-blue-200/60 rounded-lg text-xs">
                      <span className="font-semibold text-blue-900">Total Duration:</span>
                      <span className="font-bold text-blue-950 bg-white px-2 py-0.5 rounded border border-blue-200 shadow-2xs text-[11px]">
                        {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
                        {((selectedLeaveType === 'half_pay' && isCommuted) || selectedLeaveType === 'commuted') && (
                          ` (${rawCalculatedDays} Cal. × 2)`
                        )}
                      </span>
                    </div>
                  )}

                  {/* Prefix & Suffix (for 2-Stage Leaves) */}
                  {isTwoStageLeave && startDate && endDate && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Prefix &amp; Suffix Holidays</span>
                        {availSuffix && expectedJoiningDate && (
                          <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Joining: {expectedJoiningDate}
                          </span>
                        )}
                      </label>

                      {eligiblePrefixDates.length === 0 && eligibleSuffixDates.length === 0 ? (
                        <div className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400 font-medium flex items-center space-x-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Not eligible</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {/* Prefix Card */}
                          <div
                            className={`p-2 rounded-lg border transition-all ${
                              eligiblePrefixDates.length === 0
                                ? 'bg-slate-50 border-slate-200/80 opacity-60'
                                : availPrefix
                                ? 'bg-blue-50/40 border-blue-500 shadow-2xs ring-1 ring-blue-500/20'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <label
                                className={`flex items-center space-x-1.5 select-none ${
                                  eligiblePrefixDates.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={eligiblePrefixDates.length === 0}
                                  checked={availPrefix}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setAvailPrefix(checked);
                                    if (checked) {
                                      setPrefixFrom(eligiblePrefixDates[0].date);
                                      setPrefixTo(eligiblePrefixDates[eligiblePrefixDates.length - 1].date);
                                    } else {
                                      setPrefixFrom('');
                                      setPrefixTo('');
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-800">Avail Prefix</span>
                              </label>
                              {eligiblePrefixDates.length > 0 ? (
                                <span className="text-[10px] font-bold text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200 shadow-2xs">
                                  {eligiblePrefixDates.length} {eligiblePrefixDates.length === 1 ? 'Day' : 'Days'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Not eligible</span>
                              )}
                            </div>

                            {availPrefix && eligiblePrefixDates.length > 1 && (
                              <div className="grid grid-cols-2 gap-1.5 mt-1.5 pt-1.5 border-t border-blue-100">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5">From</label>
                                  <select
                                    value={prefixFrom}
                                    onChange={(e) => setPrefixFrom(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-md px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    {eligiblePrefixDates.map((p) => (
                                      <option key={p.date} value={p.date}>
                                        {p.date} ({p.dayName})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5">To</label>
                                  <select
                                    value={prefixTo}
                                    onChange={(e) => setPrefixTo(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-md px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    {eligiblePrefixDates
                                      .filter((p) => p.date >= prefixFrom)
                                      .map((p) => (
                                        <option key={p.date} value={p.date}>
                                          {p.date} ({p.dayName})
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {availPrefix && eligiblePrefixDates.length === 1 && (
                              <p className="text-[10px] text-blue-900 font-mono mt-1 font-semibold">
                                {eligiblePrefixDates[0].date} ({eligiblePrefixDates[0].dayName})
                              </p>
                            )}
                          </div>

                          {/* Suffix Card */}
                          <div
                            className={`p-2 rounded-lg border transition-all ${
                              eligibleSuffixDates.length === 0
                                ? 'bg-slate-50 border-slate-200/80 opacity-60'
                                : availSuffix
                                ? 'bg-blue-50/40 border-blue-500 shadow-2xs ring-1 ring-blue-500/20'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <label
                                className={`flex items-center space-x-1.5 select-none ${
                                  eligibleSuffixDates.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={eligibleSuffixDates.length === 0}
                                  checked={availSuffix}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setAvailSuffix(checked);
                                    if (checked) {
                                      setSuffixFrom(eligibleSuffixDates[0].date);
                                      setSuffixTo(eligibleSuffixDates[eligibleSuffixDates.length - 1].date);
                                    } else {
                                      setSuffixFrom('');
                                      setSuffixTo('');
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-800">Avail Suffix</span>
                              </label>
                              {eligibleSuffixDates.length > 0 ? (
                                <span className="text-[10px] font-bold text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200 shadow-2xs">
                                  {eligibleSuffixDates.length} {eligibleSuffixDates.length === 1 ? 'Day' : 'Days'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Not eligible</span>
                              )}
                            </div>

                            {availSuffix && eligibleSuffixDates.length > 1 && (
                              <div className="grid grid-cols-2 gap-1.5 mt-1.5 pt-1.5 border-t border-blue-100">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5">From</label>
                                  <select
                                    value={suffixFrom}
                                    onChange={(e) => setSuffixFrom(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-md px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    {eligibleSuffixDates.map((s) => (
                                      <option key={s.date} value={s.date}>
                                        {s.date} ({s.dayName})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5">To</label>
                                  <select
                                    value={suffixTo}
                                    onChange={(e) => setSuffixTo(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-md px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    {eligibleSuffixDates
                                      .filter((s) => s.date >= suffixFrom)
                                      .map((s) => (
                                        <option key={s.date} value={s.date}>
                                          {s.date} ({s.dayName})
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {availSuffix && eligibleSuffixDates.length === 1 && (
                              <p className="text-[10px] text-blue-900 font-mono mt-1 font-semibold">
                                {eligibleSuffixDates[0].date} ({eligibleSuffixDates[0].dayName})
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Station Leave Restriction Validation */}
                  {selectedLeaveType === 'station' && startDate && endDate && (
                    <div>
                      {(() => {
                        const stCheck = checkStationLeaveRange(startDate, endDate);
                        if (stCheck.valid) {
                          return (
                            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] font-semibold flex items-center space-x-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Valid: Selected dates fall on Weekends or Gazetted Holidays (GH).</span>
                            </div>
                          );
                        } else {
                          return (
                            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-[11px] font-semibold flex items-start space-x-2">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block text-rose-800">Station Leave Date Restriction:</span>
                                Only permitted on Weekends &amp; Gazetted Holidays. Weekdays found: <span className="font-mono font-bold text-rose-950">{stCheck.invalidDates.join(', ')}</span>.
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Headquarter (HQ) Leave / Station Leave Permission Toggle */}
              {selectedLeaveType === 'station' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Outstation Location / Contact Address during Leave *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter outstation city/address during leave..."
                    value={stationAddress === 'Dehradun HQ' ? '' : stationAddress}
                    onChange={(e) => setStationAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Headquarter (HQ) / Station Permission *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRequiresHqPermission(false);
                        setStationAddress('Dehradun HQ');
                      }}
                      className={`py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer text-xs ${
                        !requiresHqPermission
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="truncate">Not Required (HQ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRequiresHqPermission(true);
                        if (stationAddress === 'Dehradun HQ') setStationAddress('');
                      }}
                      className={`py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer text-xs ${
                        requiresHqPermission
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">Station Leave</span>
                    </button>
                  </div>
                  {requiresHqPermission && selectedLeaveType !== 'earned' && (
                    <div className="mt-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Outstation Location / Contact Address *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter outstation city/address during leave..."
                        value={stationAddress === 'Dehradun HQ' ? '' : stationAddress}
                        onChange={(e) => setStationAddress(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        required={requiresHqPermission && selectedLeaveType !== 'earned'}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Earned Leave Options (LTC / Ex-India) */}
              {selectedLeaveType === 'earned' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">
                    LTC / Ex-India Option *
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setLtcType('none');
                        setEncashLtc(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs truncate ${
                        ltcType === 'none'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Regular EL
                    </button>
                    <button
                      type="button"
                      onClick={() => setLtcType('ltc')}
                      className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs truncate ${
                        ltcType === 'ltc'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Availing LTC
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLtcType('ex_india');
                        setEncashLtc(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs truncate ${
                        ltcType === 'ex_india'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Ex-India
                    </button>
                  </div>

                  {ltcType === 'ltc' && (
                    <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-lg space-y-1.5">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={encashLtc}
                          onChange={(e) => setEncashLtc(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-blue-950">
                          Avail Leave Encashment with LTC?
                        </span>
                      </label>
                      {encashLtc && (
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="text-xs font-medium text-slate-700">Encash Days (Max 10):</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={encashDays}
                            onChange={(e) => {
                              const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 0));
                              setEncashDays(val);
                            }}
                            className="w-16 bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-center text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Address during EL with mobile number *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter contact address & mobile number during EL..."
                      value={stationAddress === 'Dehradun HQ' ? '' : stationAddress}
                      onChange={(e) => setStationAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      required={selectedLeaveType === 'earned'}
                    />
                  </div>
                </div>
              )}

              {/* HPL & Commuted Leave Options */}
              {(selectedLeaveType === 'half_pay' || selectedLeaveType === 'commuted') && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 mb-0.5">
                    Leave Conversion Option *
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommuted(false);
                        setPrescriptionUrl('');
                        setPrescriptionFileName('');
                      }}
                      className={`py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs ${
                        !isCommuted
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Normal HPL
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCommuted(true)}
                      className={`py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs ${
                        isCommuted
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Commuted Leave (Medical)
                    </button>
                  </div>

                  {isCommuted && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                          Doctor's Prescription *
                        </span>
                        <span className="text-[10px] text-slate-500">PDF / Image (Max 10MB)</span>
                      </div>
                      {prescriptionUrl ? (
                        <div className="flex items-center justify-between bg-white p-2 rounded-md border border-slate-200">
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-semibold text-slate-800 text-xs truncate">
                              {prescriptionFileName || 'Medical_Prescription.pdf'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPrescriptionUrl('');
                              setPrescriptionFileName('');
                            }}
                            className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-2.5 border border-dashed border-slate-300 rounded-md cursor-pointer bg-white hover:bg-slate-50 transition-all text-center">
                          <Upload className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                          <span className="font-semibold text-slate-800 text-xs">Upload Medical Certificate</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={handlePrescriptionChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Leave Not Due (LND) Prescription Upload */}
              {selectedLeaveType === 'leave_not_due' && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      Doctor's Prescription / Certificate *
                    </span>
                    <span className="text-[10px] text-slate-500">PDF / Image (Max 10MB)</span>
                  </div>
                  {prescriptionUrl ? (
                    <div className="flex items-center justify-between bg-white p-2 rounded-md border border-slate-200">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-800 text-xs truncate">
                          {prescriptionFileName || 'Medical_Certificate.pdf'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPrescriptionUrl('');
                          setPrescriptionFileName('');
                        }}
                        className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-2.5 border border-dashed border-slate-300 rounded-md cursor-pointer bg-white hover:bg-slate-50 transition-all text-center">
                      <Upload className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                      <span className="font-semibold text-slate-800 text-xs">Upload Medical Certificate</span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handlePrescriptionChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Reason for Leave */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Leave *
                </label>
                <textarea
                  rows={2}
                  placeholder="State the reason for your leave application..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Popup Modal for Leave Application */}
      {detailModalLeave && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="shrink-0 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">Leave Application Details</h3>
                  <p className="text-xs text-slate-300 mt-0.5">View application information and approval history</p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalLeave(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    {(() => {
                      const u = users.find((usr) => usr.id === detailModalLeave.userId);
                      const meta = getAccountingCycleMeta(u?.employmentType || 'permanent');
                      return (
                        <>
                          <h4 className="font-bold text-sm text-slate-900">{detailModalLeave.userName}</h4>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            {detailModalLeave.department} • <span className="capitalize">{u?.employmentType ? u.employmentType.replace('_', ' ') : 'Cadre'}</span> ({meta.periodText})
                          </p>
                        </>
                      );
                    })()}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      detailModalLeave.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : detailModalLeave.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {detailModalLeave.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-slate-700">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold">Leave Category:</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {detailModalLeave.leaveTypeName.replace(/ \([^)]*\)/, '')}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold">Duration &amp; Days:</span>
                  <span className="font-bold text-slate-900">
                    {detailModalLeave.startDate} to {detailModalLeave.endDate} ({detailModalLeave.daysCount} days)
                  </span>
                </div>

                {detailModalLeave.prefixFrom && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-semibold">Prefixed Holidays:</span>
                    <span className="font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                      {detailModalLeave.prefixFrom === detailModalLeave.prefixTo
                        ? detailModalLeave.prefixFrom
                        : `${detailModalLeave.prefixFrom} to ${detailModalLeave.prefixTo}`} (GH/Weekend)
                    </span>
                  </div>
                )}

                {detailModalLeave.suffixTo && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-semibold">Suffixed Holidays:</span>
                    <span className="font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                      {detailModalLeave.suffixFrom === detailModalLeave.suffixTo
                        ? detailModalLeave.suffixTo
                        : `${detailModalLeave.suffixFrom} to ${detailModalLeave.suffixTo}`} (GH/Weekend)
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold">Application Date:</span>
                  <span className="font-mono font-medium text-slate-800">{detailModalLeave.appliedDate}</span>
                </div>

                {detailModalLeave.isCommuted && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-semibold">Commuted Status:</span>
                    <span className="font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                      🩺 Commuted Leave (Medical Grounds: 1 Day = 2 Leaves Debited)
                    </span>
                  </div>
                )}

                {detailModalLeave.prescriptionUrl && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-semibold">Doctor's Prescription:</span>
                    <a
                      href={detailModalLeave.prescriptionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 text-xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Prescription</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {detailModalLeave.ltcType && detailModalLeave.ltcType !== 'none' && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-semibold">Leave Purpose:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        detailModalLeave.ltcType === 'ltc'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-purple-100 text-purple-900 border border-purple-200'
                      }`}
                    >
                      {detailModalLeave.ltcType === 'ltc' ? '✈️ Availing LTC (Leave Travel Concession)' : '🌍 Ex-India Leave (Abroad)'}
                    </span>
                  </div>
                )}

                {detailModalLeave.encashLtc && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-semibold">Leave Encashment:</span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      💰 Encashed {detailModalLeave.encashDays || 0} Days EL
                    </span>
                  </div>
                )}

                {detailModalLeave.stationAddress && (
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-semibold shrink-0 mr-2">Address / Station:</span>
                    <span className="font-medium text-slate-900 text-right">{detailModalLeave.stationAddress}</span>
                  </div>
                )}

                <div className="pt-1">
                  <span className="text-slate-500 font-semibold block mb-1">Stated Reason:</span>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 italic text-slate-800">
                    "{detailModalLeave.reason}"
                  </div>
                </div>

                {(detailModalLeave.level1Approval || detailModalLeave.level2Approval) && (
                  <div className="pt-2 space-y-2">
                    <span className="text-slate-500 font-semibold block">Approval Trail:</span>
                    {detailModalLeave.level1Approval && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center justify-between">
                          <span>Level 1: {detailModalLeave.level1Approval.approverName}</span>
                          <span className="capitalize text-emerald-700">{detailModalLeave.level1Approval.status}</span>
                        </div>
                        {detailModalLeave.level1Approval.comments && (
                          <p className="text-slate-600 text-[11px]">Note: {detailModalLeave.level1Approval.comments}</p>
                        )}
                      </div>
                    )}
                    {detailModalLeave.level2Approval && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center justify-between">
                          <span>Level 2: {detailModalLeave.level2Approval.approverName}</span>
                          <span className="capitalize text-emerald-700">{detailModalLeave.level2Approval.status}</span>
                        </div>
                        {detailModalLeave.level2Approval.comments && (
                          <p className="text-slate-600 text-[11px]">Note: {detailModalLeave.level2Approval.comments}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Post-Leave Joining Report Section for Approved Leaves on/after last day requiring HoD approval */}
                {isJoiningReportEligible(detailModalLeave) && (
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileCheck className="w-4 h-4 text-indigo-700" />
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Post-Leave Joining Report (कार्यग्रहण आख्या)
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          detailModalLeave.joiningReport?.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : detailModalLeave.joiningReport?.status === 'forwarded'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : detailModalLeave.joiningReport?.status === 'submitted'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : currentUser.id === detailModalLeave.userId
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {detailModalLeave.joiningReport?.status === 'accepted'
                          ? '✓ HoD Approved & Accepted'
                          : detailModalLeave.joiningReport?.status === 'forwarded'
                          ? '➡️ Forwarded to HoD (Pending Approval)'
                          : detailModalLeave.joiningReport?.status === 'submitted'
                          ? '⏳ Submitted (Forwarding Pending)'
                          : currentUser.id === detailModalLeave.userId
                          ? '⚠️ Joining Report Pending (Apply Now)'
                          : '⏳ Pending Employee Submission'}
                      </span>
                    </div>

                    {detailModalLeave.joiningReport ? (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-slate-700">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Joining Date &amp; Session</span>
                            <span className="font-bold text-slate-900">
                              {detailModalLeave.joiningReport.joiningDate} ({detailModalLeave.joiningReport.joiningSession === 'FN' ? 'Forenoon' : 'Afternoon'})
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">HQ Station Return</span>
                            <span className="font-semibold text-emerald-700">
                              {detailModalLeave.joiningReport.stationReturned ? '✓ Returned to HQ' : 'No'}
                            </span>
                          </div>
                        </div>

                        {detailModalLeave.joiningReport.fitnessCertificateAttached && (
                          <div className="pt-1 text-[11px] text-blue-700 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Fitness Certificate Attached: {detailModalLeave.joiningReport.fitnessCertificateName || 'Fitness_Certificate.pdf'}</span>
                          </div>
                        )}

                        {detailModalLeave.joiningReport.remarks && (
                          <div className="pt-1 text-slate-600 italic text-[11px]">
                            Employee Remarks: "{detailModalLeave.joiningReport.remarks}"
                          </div>
                        )}

                        {detailModalLeave.joiningReport.forwardedBy && (
                          <div className="p-2 bg-purple-50/80 rounded-lg border border-purple-200 text-[11px] text-purple-900 space-y-0.5">
                            <span className="font-bold block">
                              ➡️ Forwarded to HoD by Reporting Manager: {detailModalLeave.joiningReport.forwardedByName || 'Reporting Manager'}
                            </span>
                            {detailModalLeave.joiningReport.forwardedAt && (
                              <span className="text-[10px] text-purple-700 block">On: {detailModalLeave.joiningReport.forwardedAt}</span>
                            )}
                            {detailModalLeave.joiningReport.forwardRemarks && (
                              <span className="italic block text-purple-800">Note: "{detailModalLeave.joiningReport.forwardRemarks}"</span>
                            )}
                          </div>
                        )}

                        {detailModalLeave.joiningReport.verifiedBy && (
                          <div className="p-2 bg-emerald-50/80 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 space-y-0.5">
                            <span className="font-bold block">
                              ✓ Approved by HoD: {detailModalLeave.joiningReport.verifiedByName || 'HoD'}
                            </span>
                            {detailModalLeave.joiningReport.verifiedAt && (
                              <span className="text-[10px] text-emerald-700 block">On: {detailModalLeave.joiningReport.verifiedAt}</span>
                            )}
                            {detailModalLeave.joiningReport.verificationRemarks && (
                              <span className="italic block text-emerald-800">HoD Remarks: "{detailModalLeave.joiningReport.verificationRemarks}"</span>
                            )}
                          </div>
                        )}

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => {
                              const lv = detailModalLeave;
                              setDetailModalLeave(null);
                              setSelectedJoiningLeave(lv);
                            }}
                            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>View Full Report / Action</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs flex items-center justify-between">
                        <div className="text-amber-900 pr-2">
                          <p className="font-bold">Joining form submission required after leave completion.</p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            Under CCS rules, only the employee can apply/submit their post-leave joining report. Reporting Manager forwards and HoD approves.
                          </p>
                        </div>
                        {currentUser.id === detailModalLeave.userId ? (
                          <button
                            onClick={() => {
                              const lv = detailModalLeave;
                              setDetailModalLeave(null);
                              setSelectedJoiningLeave(lv);
                            }}
                            className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            Apply Joining
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const lv = detailModalLeave;
                              setDetailModalLeave(null);
                              setSelectedJoiningLeave(lv);
                            }}
                            className="shrink-0 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            View Details
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                {canManagerAction(detailModalLeave) && (
                  <>
                    <button
                      onClick={() => {
                        const lv = detailModalLeave;
                        setDetailModalLeave(null);
                        const comm = prompt('Enter rejection comments:', (lv.status === 'pending_level_1' ? level1Comments[lv.id] : level2Comments[lv.id]) || '');
                        if (comm !== null) {
                          if (lv.status === 'pending_level_1') rejectLeaveLevel1(lv.id, comm);
                          else rejectLeaveLevel2(lv.id, comm);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject</span>
                    </button>
                    {detailModalLeave.status === 'pending_level_1' && detailModalLeave.requiresLevel2 ? (
                      <button
                        onClick={() => {
                          const lv = detailModalLeave;
                          setDetailModalLeave(null);
                          const comm = prompt('Enter Level-1 remarks to forward:', level1Comments[lv.id] || '');
                          if (comm !== null) approveLeaveLevel1(lv.id, comm);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Forward (L2)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const lv = detailModalLeave;
                          setDetailModalLeave(null);
                          const comm = prompt('Enter approval comments:', (lv.status === 'pending_level_1' ? level1Comments[lv.id] : level2Comments[lv.id]) || '');
                          if (comm !== null) {
                            if (lv.status === 'pending_level_1') approveLeaveLevel1(lv.id, comm);
                            else approveLeaveLevel2(lv.id, comm);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                  </>
                )}
                {canManagerCancelApproval(detailModalLeave) && (
                  <button
                    onClick={() => {
                      const lv = detailModalLeave;
                      setDetailModalLeave(null);
                      if (confirm('Are you sure you want to cancel this approved leave record?')) {
                        rejectLeaveLevel1(lv.id, 'Approved leave cancelled by Manager/Admin before applicable date.');
                      }
                    }}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cancel Approval</span>
                  </button>
                )}
                <button
                  onClick={() => setDetailModalLeave(null)}
                  className="px-5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Leave Request Modal */}
      {editingLeave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto sm:my-8 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md shrink-0">
                  <Edit3 className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-wide">Edit Leave Application</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingLeave(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 sm:space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">{editingLeave.userName} ({editingLeave.department})</p>
                <p className="text-slate-600">Type: <strong>{editingLeave.leaveTypeName}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                <AppDatePicker
                  label="Start Date *"
                  value={editStartDate}
                  isOpen={activeStationPicker === 'editStart'}
                  onToggle={() => setActiveStationPicker(activeStationPicker === 'editStart' ? null : 'editStart')}
                  onChange={(dStr) => setEditStartDate(dStr)}
                />
                <AppDatePicker
                  label="End Date *"
                  value={editEndDate}
                  minDate={editStartDate}
                  isOpen={activeStationPicker === 'editEnd'}
                  onToggle={() => setActiveStationPicker(activeStationPicker === 'editEnd' ? null : 'editEnd')}
                  onChange={(dStr) => setEditEndDate(dStr)}
                  isRightColumn={true}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Reason *</label>
                <textarea
                  rows={3}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingLeave(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Quota CSV Import Modal */}
      <LeaveQuotaImportModal
        isOpen={showQuotaImportModal}
        onClose={() => setShowQuotaImportModal(false)}
        selectedYear={selectedActiveYear}
        onSuccess={(msg) => {
          setQuotaImportSuccessMsg(msg);
          setTimeout(() => setQuotaImportSuccessMsg(''), 6000);
        }}
      />

      {/* Quota Import Success Toast */}
      {quotaImportSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-bold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{quotaImportSuccessMsg}</span>
        </div>
      )}

      {/* Admin Import / Edit Balance Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="shrink-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-indigo-950/40 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                  <Layers className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-wide">Leave Balance Edit, Import & Year-End Roll</h3>
                  <p className="text-xs text-indigo-200/80">Manage employment-wise leave quotas, year-wise historical balances & carry forwards</p>
                </div>
              </div>
              <button
                onClick={() => setShowBalanceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="shrink-0 bg-slate-100 border-b border-slate-200 px-5 pt-3 flex space-x-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setBalanceModalTab('single')}
                className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 border-t border-x whitespace-nowrap ${
                  balanceModalTab === 'single'
                    ? 'bg-white border-slate-200 text-indigo-700 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Single Employee</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBalanceModalTab('batch_grid');
                  initBatchGridData(batchYear, batchEmpType);
                }}
                className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 border-t border-x whitespace-nowrap ${
                  balanceModalTab === 'batch_grid'
                    ? 'bg-white border-slate-200 text-indigo-700 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multi-User Batch Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setBalanceModalTab('bulk')}
                className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 border-t border-x whitespace-nowrap ${
                  balanceModalTab === 'bulk'
                    ? 'bg-white border-slate-200 text-indigo-700 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk CSV Import</span>
              </button>

              <button
                type="button"
                onClick={() => setBalanceModalTab('year_roll')}
                className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 border-t border-x whitespace-nowrap ${
                  balanceModalTab === 'year_roll'
                    ? 'bg-white border-slate-200 text-indigo-700 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Year-End Roll</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBalanceModalTab('reconcile');
                  runAuditScan(reconcileYear);
                }}
                className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 border-t border-x whitespace-nowrap ${
                  balanceModalTab === 'reconcile'
                    ? 'bg-white border-slate-200 text-indigo-700 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Leave Reconciliation</span>
              </button>
            </div>

            {/* Tab 1: Single Employee Editor */}
            {balanceModalTab === 'single' && (
              <form onSubmit={handleSaveBalance} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Employee *</label>
                    <AppSelect
                      value={selectedBalanceUserId}
                      onChange={(val) => handleBalanceUserTypeOrYearChange(val, selectedBalanceType, selectedBalanceYear)}
                      options={users.map((u) => ({
                        label: u.name,
                        value: u.id,
                        description: `${u.department} • ${u.employmentType.replace('_', ' ')}`
                      }))}
                    />
                  </div>

                  <div>
                    {(() => {
                      const selUser = users.find((u) => u.id === selectedBalanceUserId);
                      const selCycle = getUserLeaveCycleType(selUser);
                      const yearOptions =
                        selCycle === 'CY'
                          ? [
                              { label: 'CY 2026 (Current Active Year)', value: '2026' },
                              { label: 'CY 2025 (Previous Year)', value: '2025' },
                              { label: 'CY 2024 (Historical Year)', value: '2024' },
                              { label: 'CY 2027 (Upcoming Year)', value: '2027' }
                            ]
                          : [
                              { label: 'FY 2026-27 (Current Active)', value: 'FY-2026-27' },
                              { label: 'FY 2025-26 (Previous Year)', value: 'FY-2025-26' },
                              { label: 'FY 2024-25 (Historical Year)', value: 'FY-2024-25' },
                              { label: 'FY 2027-28 (Upcoming Year)', value: 'FY-2027-28' }
                            ];
                      return (
                        <>
                          <label className="block font-bold text-slate-700 mb-1">
                            Target Year ({selCycle === 'CY' ? 'Calendar Year' : 'Financial Year'}) *
                          </label>
                          <AppSelect
                            value={selectedBalanceYear}
                            onChange={(val) => handleBalanceUserTypeOrYearChange(selectedBalanceUserId, selectedBalanceType, val)}
                            options={yearOptions}
                          />
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Selected Employee Info Badge */}
                {(() => {
                  const selUser = users.find((u) => u.id === selectedBalanceUserId);
                  if (!selUser) return null;

                  const eligiblePolicies = leavePolicies.filter(
                    (pol) => !pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(selUser.employmentType)
                  );

                  const activePolicy = eligiblePolicies.find((pol) => pol.type === selectedBalanceType) || eligiblePolicies[0];

                  return (
                    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-indigo-600" />
                          <span className="font-bold text-slate-900">{selUser.name}</span>
                          <span className="bg-indigo-100 text-indigo-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                            {selUser.employmentType.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">Biometric ID: {selUser.biometricId || 'N/A'}</span>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Select Leave Type (Filtered for {selUser.employmentType.replace('_', ' ')}) *</label>
                        <select
                          value={selectedBalanceType}
                          onChange={(e) => handleBalanceUserTypeOrYearChange(selectedBalanceUserId, e.target.value, selectedBalanceYear)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                        >
                          {eligiblePolicies.map((pol) => (
                            <option key={pol.type} value={pol.type}>
                              {pol.name} ({pol.code || pol.type.toUpperCase()})
                            </option>
                          ))}
                        </select>
                      </div>

                      {activePolicy && (
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-[11px] text-indigo-950 space-y-1">
                          <div className="flex items-center space-x-1.5 font-bold">
                            <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>Policy Rule: {activePolicy.name}</span>
                          </div>
                          <p className="text-indigo-800">
                            • Default Quota: <strong>{activePolicy.defaultQuota} days/year</strong> <br />
                            • Carry Forward Rule:{' '}
                            <strong>
                              {activePolicy.carryForward ? `Allowed (Max carry: ${activePolicy.maxCarryForwardDays || 300} days)` : 'Lapses at Year-End (0 carry forward)'}
                            </strong>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Total Quota *</label>
                    <input
                      type="number"
                      min={0}
                      value={balQuotaInput}
                      onChange={(e) => setBalQuotaInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Days Used *</label>
                    <input
                      type="number"
                      min={0}
                      value={balUsedInput}
                      onChange={(e) => setBalUsedInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pending Days *</label>
                    <input
                      type="number"
                      min={0}
                      value={balPendingInput}
                      onChange={(e) => setBalPendingInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Carry Forward *</label>
                    <input
                      type="number"
                      min={0}
                      value={balCarryForwardInput}
                      onChange={(e) => setBalCarryForwardInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium">
                  <strong>Calculated Available Balance for Year {selectedBalanceYear}:</strong>{' '}
                  <span className="font-bold text-emerald-700 text-sm ml-1">
                    {balQuotaInput} Total - {balUsedInput} Used = {Math.max(0, balQuotaInput - balUsedInput)} Days Available
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBalanceModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Balance for Year {selectedBalanceYear}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Multi-User Batch Grid Editor */}
            {balanceModalTab === 'batch_grid' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-indigo-950 text-sm">Multi-User Batch Leave Balance Grid Editor</h4>
                    <p className="text-indigo-800 text-[11px] mt-0.5">
                      Directly edit and update leave quotas, used days, and carry forwards for multiple employees across all leave types for year <strong>{batchYear}</strong>.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => initBatchGridData(batchYear, batchEmpType)}
                      className="bg-white hover:bg-indigo-100 text-indigo-900 font-bold px-3 py-1.5 rounded-xl border border-indigo-300 text-xs transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Reload Grid</span>
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    {(() => {
                      const isBatchFY = batchEmpType === 'contractual';
                      return (
                        <>
                          <label className="block font-bold text-slate-700 mb-1">
                            Target Year ({isBatchFY ? 'Financial Year' : 'Calendar Year'}) *
                          </label>
                          <select
                            value={batchYear}
                            onChange={(e) => {
                              setBatchYear(e.target.value);
                              initBatchGridData(e.target.value, batchEmpType);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                          >
                            {isBatchFY ? (
                              <>
                                <option value="FY-2026-27">FY 2026-27 (Current Active)</option>
                                <option value="FY-2025-26">FY 2025-26 (Previous Year)</option>
                                <option value="FY-2024-25">FY 2024-25 (Historical Year)</option>
                                <option value="FY-2027-28">FY 2027-28 (Upcoming Year)</option>
                              </>
                            ) : (
                              <>
                                <option value="2026">2026 (Current Active Year)</option>
                                <option value="2025">2025 (Previous Year)</option>
                                <option value="2024">2024 (Historical Year)</option>
                                <option value="2027">2027 (Upcoming Year)</option>
                              </>
                            )}
                          </select>
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Filter Employment Type</label>
                    <select
                      value={batchEmpType}
                      onChange={(e) => {
                        setBatchEmpType(e.target.value);
                        initBatchGridData(batchYear, e.target.value);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                    >
                      <option value="all">All Employment Types</option>
                      <option value="permanent_regular">Permanent / Regular (CCS Rules)</option>
                      <option value="probationary">Probationary Officer</option>
                      <option value="contractual">Contractual / Project Staff</option>
                      <option value="deputation">On Deputation / Visiting</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Search Employee</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by name, ID or dept..."
                        value={batchSearchQuery}
                        onChange={(e) => setBatchSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Batch Grid Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-white text-[11px] font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 pl-4 border-r border-slate-800">Employee Details</th>
                        {leavePolicies.map((pol) => (
                          <th key={pol.type} className="p-2.5 text-center border-r border-slate-800 min-w-[120px]">
                            <div>{pol.code || pol.name}</div>
                            <div className="text-[9px] text-slate-300 font-normal">
                              {pol.carryForward ? 'Carry-Forward' : 'Lapses'}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 text-[11px]">
                      {users
                        .filter((u) => {
                          if (batchEmpType !== 'all' && u.employmentType !== batchEmpType) return false;
                          if (batchSearchQuery.trim()) {
                            const q = batchSearchQuery.toLowerCase();
                            return (
                              u.name.toLowerCase().includes(q) ||
                              u.department.toLowerCase().includes(q) ||
                              (u.biometricId && u.biometricId.toLowerCase().includes(q))
                            );
                          }
                          return true;
                        })
                        .map((u) => (
                          <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="p-2.5 pl-4 border-r border-slate-100 bg-slate-50/50">
                              <div className="font-bold text-slate-900">{u.name}</div>
                              <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <span>{u.department}</span>
                                <span>•</span>
                                <span className="capitalize">{u.employmentType.replace('_', ' ')}</span>
                              </div>
                            </td>

                            {leavePolicies.map((pol) => {
                              const isAllowed = !pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(u.employmentType);
                              if (!isAllowed) {
                                return (
                                  <td key={pol.type} className="p-2 text-center border-r border-slate-100 bg-slate-100/60 text-slate-400 text-[10px] italic">
                                    N/A
                                  </td>
                                );
                              }

                              const key = `${u.id}_${pol.type}`;
                              const cellData = batchGridData[key] || { total: pol.defaultQuota, used: 0, pending: 0, carryForward: 0 };

                              return (
                                <td key={pol.type} className="p-2 border-r border-slate-100">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-slate-500 font-semibold">Quota:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={cellData.total}
                                        onChange={(e) => handleBatchCellChange(u.id, pol.type, 'total', Number(e.target.value))}
                                        className="w-14 text-right bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-slate-500 font-semibold">Used:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={cellData.used}
                                        onChange={(e) => handleBatchCellChange(u.id, pol.type, 'used', Number(e.target.value))}
                                        className="w-14 text-right bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                    {pol.carryForward && (
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-emerald-700 font-semibold">C/F:</span>
                                        <input
                                          type="number"
                                          min="0"
                                          value={cellData.carryForward || 0}
                                          onChange={(e) => handleBatchCellChange(u.id, pol.type, 'carryForward', Number(e.target.value))}
                                          className="w-14 text-right bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 font-bold text-emerald-900 focus:outline-none focus:border-emerald-500"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {batchSaveMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-950 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{batchSaveMsg}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBalanceModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveBatchGrid}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save All Batch Balances for Year {batchYear}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Bulk CSV Import */}
            {balanceModalTab === 'bulk' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4">
                  <div>
                    <h4 className="font-bold text-indigo-950 text-sm">Bulk Import Leave Balances via CSV</h4>
                    <p className="text-indigo-800 text-[11px] mt-0.5">
                      Upload employee leave quotas for specific calendar years in bulk.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadSampleCSV}
                    className="shrink-0 bg-white hover:bg-indigo-100 text-indigo-900 font-bold px-3.5 py-1.5 rounded-xl border border-indigo-300 text-xs transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Download Sample Template (.CSV)</span>
                  </button>
                </div>

                {/* CSV File Drag & Drop Zone */}
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-5 text-center bg-slate-50/50 hover:bg-indigo-50/30 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center space-y-1.5">
                    <Upload className="w-8 h-8 text-indigo-600" />
                    <span className="font-bold text-slate-800">
                      {csvFileName ? `Selected: ${csvFileName}` : 'Click or Drag & Drop CSV File Here'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Format: Biometric_ID, Employee_Name, Year, Leave_Type_Code, Total_Quota, Used_Days, Pending_Days, Carry_Forward_Days
                    </span>
                  </div>
                </div>

                {/* CSV Preview Table */}
                {csvPreviewRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900">
                        CSV Preview &amp; Verification ({csvPreviewRows.length} Rows)
                      </h5>
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded-md">
                          Valid: {csvPreviewRows.filter((r) => r.status === 'valid').length}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-md">
                          Warnings: {csvPreviewRows.filter((r) => r.status === 'warning').length}
                        </span>
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-900 font-bold rounded-md">
                          Errors: {csvPreviewRows.filter((r) => r.status === 'error').length}
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-56">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0">
                          <tr>
                            <th className="p-2 border-b">Biometric ID</th>
                            <th className="p-2 border-b">Employee Name</th>
                            <th className="p-2 border-b">Year</th>
                            <th className="p-2 border-b">Leave Code</th>
                            <th className="p-2 border-b text-center">Quota</th>
                            <th className="p-2 border-b text-center">Used</th>
                            <th className="p-2 border-b border-l">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-medium">
                          {csvPreviewRows.map((r, idx) => (
                            <tr key={idx} className={r.status === 'error' ? 'bg-rose-50/50' : r.status === 'warning' ? 'bg-amber-50/50' : ''}>
                              <td className="p-2 font-mono font-bold text-slate-800">{r.biometricId || '-'}</td>
                              <td className="p-2 text-slate-900">{r.employeeName}</td>
                              <td className="p-2 font-bold">{r.year}</td>
                              <td className="p-2">
                                <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                  {r.leaveTypeCode}
                                </span>
                              </td>
                              <td className="p-2 text-center font-bold">{r.total}</td>
                              <td className="p-2 text-center text-slate-600">{r.used}</td>
                              <td className="p-2 border-l">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                    r.status === 'valid'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : r.status === 'warning'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-rose-100 text-rose-900'
                                  }`}
                                  title={r.message}
                                >
                                  {r.status.toUpperCase()}: {r.message}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {csvImportSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{csvImportSuccessMsg}</span>
                  </div>
                )}

                {csvImportErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-900 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{csvImportErrorMsg}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBalanceModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteBulkImport}
                    disabled={csvPreviewRows.length === 0}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Execute Bulk Import</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Year-End Transition & Carry-Forward Roll */}
            {balanceModalTab === 'year_roll' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                    <RotateCcw className="w-4 h-4 text-indigo-600" />
                    <span>Automated Year-End Leave Roll Engine</span>
                  </div>

                  <p className="text-slate-600 text-xs">
                    This automated wizard transitions leave balances from one calendar year to the next for all employees based on CCS Leave Policy Rules:
                  </p>

                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 font-medium pl-1">
                    <li>
                      <strong>Casual Leave (CL), Restricted Holiday (RH), Station Leave (STN):</strong> Lapses completely at year-end. New year starts fresh with 0 used &amp; default policy quota.
                    </li>
                    <li>
                      <strong>Earned Leave (EL) &amp; Half Pay Leave (HPL):</strong> Unused days (Total - Used) carry forward into the new year (up to policy maximum carry forward limit).
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Source Year (Closing Year) *</label>
                    <select
                      value={yearRollFrom}
                      onChange={(e) => setYearRollFrom(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                    >
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Year (Opening Year) *</label>
                    <select
                      value={yearRollTo}
                      onChange={(e) => setYearRollTo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                    >
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </div>

                {yearRollMsg && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950">
                    {yearRollMsg}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBalanceModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteYearRoll}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Run Year-End Roll ({yearRollFrom} ➔ {yearRollTo})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 5: Admin Leave Reconciliation & Audit Tool */}
            {balanceModalTab === 'reconcile' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                  <div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <h4 className="font-bold text-white text-sm">Automated Leave Balance Reconciliation &amp; Audit Engine</h4>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-1">
                      Audits recorded leave balances against actual approved leave requests for calendar year <strong>{reconcileYear}</strong> and automatically repairs any discrepancies.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <select
                      value={reconcileYear}
                      onChange={(e) => {
                        setReconcileYear(e.target.value);
                        runAuditScan(e.target.value);
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-400 cursor-pointer"
                    >
                      <option value="2026">Audit Year 2026</option>
                      <option value="2025">Audit Year 2025</option>
                      <option value="2024">Audit Year 2024</option>
                      <option value="2027">Audit Year 2027</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => runAuditScan(reconcileYear)}
                      disabled={isAuditRunning}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isAuditRunning ? 'animate-spin' : ''}`} />
                      <span>{isAuditRunning ? 'Scanning...' : 'Re-Scan Audit'}</span>
                    </button>
                  </div>
                </div>

                {/* Audit Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Total User Leaves Audited</p>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{reconcileReport.length}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Verified In-Sync</p>
                    <p className="text-xl font-black text-emerald-900 mt-0.5">
                      {reconcileReport.filter((r) => !r.hasDiscrepancy).length}
                    </p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-rose-700 uppercase">Discrepancies Detected</p>
                    <p className="text-xl font-black text-rose-900 mt-0.5">
                      {reconcileReport.filter((r) => r.hasDiscrepancy).length}
                    </p>
                  </div>
                </div>

                {reconcileSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-950 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{reconcileSuccessMsg}</span>
                  </div>
                )}

                {/* Audit Report Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs max-h-[45vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 text-[10px] font-bold sticky top-0 z-10 border-b border-slate-200 uppercase">
                      <tr>
                        <th className="p-2.5 pl-4">Employee</th>
                        <th className="p-2.5">Leave Type</th>
                        <th className="p-2.5 text-center">Stored Used</th>
                        <th className="p-2.5 text-center">Actual Approved</th>
                        <th className="p-2.5 text-center">Stored Pending</th>
                        <th className="p-2.5 text-center">Actual Pending</th>
                        <th className="p-2.5 text-center pr-4">Audit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 text-[11px]">
                      {reconcileReport.map((rep, idx) => (
                        <tr
                          key={`${rep.userId}_${rep.leaveType}_${idx}`}
                          className={rep.hasDiscrepancy ? 'bg-rose-50/60 font-semibold' : 'hover:bg-slate-50/80'}
                        >
                          <td className="p-2.5 pl-4">
                            <div className="font-bold text-slate-900">{rep.userName}</div>
                            <div className="text-[10px] text-slate-500">{rep.department}</div>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-700">{rep.leaveTypeName}</td>
                          <td className="p-2.5 text-center font-mono">{rep.storedUsed}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-indigo-700">
                            {rep.actualApprovedUsed}
                          </td>
                          <td className="p-2.5 text-center font-mono">{rep.storedPending}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-amber-700">{rep.actualPending}</td>
                          <td className="p-2.5 text-center pr-4">
                            {rep.hasDiscrepancy ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Discrepancy Found
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                In Sync
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    Rule enforced: Leave requests debit/credit ONLY from their applicable year ({reconcileYear}).
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowBalanceModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteReconcile}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Execute Auto-Reconcile &amp; Fix All for {reconcileYear}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CCS Rules Modal */}
      {isRulesModalOpen && <CCSLeaveRulesModal onClose={() => setIsRulesModalOpen(false)} />}

      {/* Post-Leave Joining Report Modal (Required for HoD / Level-2 Approved Leaves) */}
      {selectedJoiningLeave && (
        <JoiningReportModal
          isOpen={Boolean(selectedJoiningLeave)}
          onClose={() => setSelectedJoiningLeave(null)}
          leave={selectedJoiningLeave}
          onSuccess={() => {
            setSelectedJoiningLeave(null);
          }}
        />
      )}

      {/* View Full Reason Modal */}
      {activeReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{activeReasonModal.employeeName}</h4>
                  <p className="text-[11px] text-slate-500">{activeReasonModal.leaveType} • {activeReasonModal.dates}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveReasonModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                Reason for Leave
              </label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-800 leading-relaxed max-h-60 overflow-y-auto font-medium">
                "{activeReasonModal.reason}"
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setActiveReasonModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

