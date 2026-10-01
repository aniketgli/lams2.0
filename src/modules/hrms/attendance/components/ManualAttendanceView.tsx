import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { ManualAttendanceRegularizationRequest, AttendanceRecord } from '../../../../types';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { TablePagination } from '../../../../shared/components/TablePagination';
import { AppSelect } from '../../../../shared/components/AppSelect';
import {
  Clock,
  PlusCircle,
  Calendar,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  User as UserIcon,
  UserCheck,
  Download,
  RotateCcw,
  Eye,
  AlertCircle,
  X,
  Check,
  FileText,
  Building,
  Briefcase,
  ShieldCheck,
  Table as TableIcon,
  LayoutGrid,
  Edit2,
  Trash2,
  ArrowRight,
  Info,
  Sparkles,
  CheckCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Standard reason options specified by user
const REASON_CATEGORIES = [
  'Forgot to Punch',
  'Biometric Issue',
  'Not Registered Yet',
  'Registration Day',
  'Urgent OD',
  'Other'
] as const;

type ReasonCategory = typeof REASON_CATEGORIES[number];

// Helper to format category with styled badges matching application theme
const formatReasonCategory = (cat?: string): { label: string; badgeClass: string } => {
  const c = (cat || 'Forgot to Punch').trim();
  const lower = c.toLowerCase();

  if (lower.includes('face') || lower.includes('fingure') || lower.includes('finger') || lower.includes('biometric')) {
    return {
      label: 'Biometric Issue',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300'
    };
  }
  if (lower.includes('urgent od') || lower.includes('field')) {
    return {
      label: 'Urgent OD',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  }
  if (lower.includes('registration day')) {
    return {
      label: 'Registration Day',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  }
  if (lower.includes('not registered')) {
    return {
      label: 'Not Registered Yet',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  }
  if (lower.includes('forget') || lower.includes('forgot')) {
    return {
      label: 'Forgot to Punch',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
    };
  }
  return {
    label: c || 'Other',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
  };
};

// Helper to format reason description text (rolls back artificial rewrites, returns clean user reason)
const getFormattedReasonText = (req: ManualAttendanceRegularizationRequest): string => {
  const rawReason = (req.reason || '').trim();
  if (rawReason) return rawReason;
  return req.reasonCategory || 'Manual attendance regularization';
};

const getDefaultReasonDescription = (cat: string): string => {
  const lower = cat.toLowerCase();
  if (lower.includes('face') || lower.includes('finger') || lower.includes('fingure')) {
    return 'Biometric facial / fingerprint scanner sensor error during gate punch.';
  }
  if (lower.includes('urgent od')) {
    return 'Urgent official field assignment outside campus perimeter.';
  }
  if (lower.includes('not registered')) {
    return 'Biometric profile enrollment under process with IT division.';
  }
  if (lower.includes('registration day')) {
    return 'Joined on registration day; biometric profile was active mid-day.';
  }
  if (lower.includes('forget') || lower.includes('forgot')) {
    return 'Missed routine biometric punch on entry / exit gate.';
  }
  return 'Regularization of past forgotten punch log.';
};

// Helper to convert time strings (e.g., "09:30 AM", "05:45 PM", "14:20") into 24-hr "HH:mm"
const parseTimeTo24H = (timeStr?: string): string | null => {
  if (!timeStr || timeStr.trim() === '' || timeStr.trim() === '--:--' || timeStr.trim() === '-') return null;
  const str = timeStr.trim();
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  const match24 = str.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  return null;
};

export const ManualAttendanceView: React.FC = () => {
  const {
    currentUser,
    users,
    attendanceRecords,
    manualAttendanceRequests,
    applyManualAttendance,
    editManualAttendance,
    deleteManualAttendance,
    approveRejectManualAttendance,
    cancelApprovedManualAttendance
  } = useApp();

  // Date boundary: strictly past dates (<= yesterday)
  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];
  const yesterdayObj = new Date(todayObj);
  yesterdayObj.setDate(todayObj.getDate() - 1);
  const maxDateStr = yesterdayObj.toISOString().split('T')[0];

  // Role Checks
  const isAdmin = currentUser.role === 'administrator';
  const isReportingManager = currentUser.role === 'reporting_manager';
  const isReviewingManager = currentUser.role === 'reviewing_manager';
  const canApplyRegularization = isAdmin || (!isReportingManager && !isReviewingManager);

  // Role Visibility Matrix Flags (per specification table)
  // 1. General (Staff): Status filter only
  // 2. Reporting Manager / PI (if user is other than Permanent): Employee, designation, department, Status
  // 3. Reviewing Manager: Employee, designation, department, Reporting Manager, Status
  // 4. Administrator: Employee, designation, department, Reporting Manager, Status
  const isNonPermanentPI =
    currentUser.employmentType !== 'permanent' &&
    (Boolean(currentUser.piName) || users.some((u) => u.reportingManagerId === currentUser.id));
  const isReportingManagerOrPI = isReportingManager || isNonPermanentPI;

  const canSeeReportingManagerFilter = isAdmin || isReviewingManager;
  const canSeeTeamFilters = isAdmin || isReviewingManager || isReportingManagerOrPI;

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --- MODAL & FORM STATES ---
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ManualAttendanceRegularizationRequest | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields
  const [formUserId, setFormUserId] = useState<string>(currentUser.id);
  const [formDate, setFormDate] = useState<string>(maxDateStr);
  const [formInTime, setFormInTime] = useState<string>('09:30');
  const [formOutTime, setFormOutTime] = useState<string>('17:30');
  const [formReasonCategory, setFormReasonCategory] = useState<ReasonCategory>('Forget to punch');
  const [formReason, setFormReason] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Detected punch state for selected employee and date
  const [detectedInPunch, setDetectedInPunch] = useState<string | null>(null);
  const [detectedOutPunch, setDetectedOutPunch] = useState<string | null>(null);

  // Approver Action Comments
  const [approverComments, setApproverComments] = useState<{ [id: string]: string }>({});

  // View Details Modal
  const [detailModalReq, setDetailModalReq] = useState<ManualAttendanceRegularizationRequest | null>(null);

  // Review & Action Modal Popup
  const [actionModalReq, setActionModalReq] = useState<ManualAttendanceRegularizationRequest | null>(null);
  const [actionComments, setActionComments] = useState<string>('');

  // Cancel Approved Manual Attendance Modal Popup
  const [cancelModalReq, setCancelModalReq] = useState<ManualAttendanceRegularizationRequest | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // View Mode ('table' | 'grid') - Default Table
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Sorting State ('employee' | 'forgottenDate' | 'appliedDate' | 'category' | 'reason' | 'status')
  type SortField = 'employee' | 'forgottenDate' | 'appliedDate' | 'category' | 'reason' | 'status';
  type SortOrder = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('forgottenDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Tab State Filter ('all' | 'my' | 'pending')
  const [tabFilter, setTabFilter] = useState<'all' | 'my' | 'pending'>('all');

  // --- FILTERS (Multi-select supported) ---
  const DEFAULT_START_DATE = '2026-08-01';
  const DEFAULT_END_DATE = '2026-09-30';
  const [filterStatus, setFilterStatus] = useState<string[]>(['all']);
  const [filterDept, setFilterDept] = useState<string[]>(['all']);
  const [filterUser, setFilterUser] = useState<string[]>(['all']);
  const [filterDesignation, setFilterDesignation] = useState<string[]>(['all']);
  const [filterReportingManager, setFilterReportingManager] = useState<string[]>(['all']);
  const [filterReasonCategory, setFilterReasonCategory] = useState<string[]>(['all']);
  const [filterStartDate, setFilterStartDate] = useState<string>(DEFAULT_START_DATE);
  const [filterEndDate, setFilterEndDate] = useState<string>(DEFAULT_END_DATE);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleResetFilters = () => {
    setFilterStatus(['all']);
    setFilterDept(['all']);
    setFilterUser(['all']);
    setFilterDesignation(['all']);
    setFilterReportingManager(['all']);
    setFilterReasonCategory(['all']);
    setFilterStartDate(DEFAULT_START_DATE);
    setFilterEndDate(DEFAULT_END_DATE);
    setSearchTerm('');
    setTabFilter('all');
  };

  // Accessible Users
  const accessibleUsers = useMemo(() => {
    if (isAdmin || isReviewingManager) return users;
    if (isReportingManagerOrPI) {
      return users.filter(
        (u) =>
          u.reportingManagerId === currentUser.id ||
          u.id === currentUser.id ||
          (u.piName && u.piName === currentUser.name)
      );
    }
    return users.filter((u) => u.id === currentUser.id);
  }, [users, currentUser, isAdmin, isReportingManagerOrPI, isReviewingManager]);

  const accessibleUserIds = useMemo(() => accessibleUsers.map((u) => u.id), [accessibleUsers]);

  // Designation List
  const designationList = useMemo(() => {
    const desigs = new Set<string>();
    accessibleUsers.forEach((u) => {
      if (u.designation) desigs.add(u.designation);
    });
    return Array.from(desigs).sort();
  }, [accessibleUsers]);

  // Department List
  const departmentList = useMemo(() => {
    const depts = new Set<string>();
    accessibleUsers.forEach((u) => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts).sort();
  }, [accessibleUsers]);

  // Reporting Manager List
  const reportingManagerList = useMemo(() => {
    const mgrs = new Map<string, string>();
    users.forEach((u) => {
      if (u.role === 'reporting_manager' || u.role === 'administrator') {
        mgrs.set(u.id, u.name);
      }
    });
    return Array.from(mgrs.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // --- CANDIDATE MISSING PUNCH DATES GENERATION ---
  // Checks past working days (excluding Sundays, up to yesterday) where punch is missing or incomplete
  const candidateMissingDates = useMemo(() => {
    const targetUserId = formUserId || currentUser.id;
    const candidates: Array<{
      date: string;
      label: string;
      description: string;
      type: 'missing_both' | 'missing_in' | 'missing_out' | 'irregular';
      existingRecord?: AttendanceRecord;
      clockIn?: string;
      clockOut?: string;
    }> = [];

    // Check past 60 days up to yesterday
    for (let i = 1; i <= 60; i++) {
      const d = new Date(todayObj);
      d.setDate(todayObj.getDate() - i);
      const dayOfWeek = d.getDay(); // 0 is Sunday
      if (dayOfWeek === 0) continue; // Skip Sunday

      const dateStr = d.toISOString().split('T')[0];
      const record = attendanceRecords.find((a) => a.userId === targetUserId && a.date === dateStr);

      const hasIn = record && record.clockIn && record.clockIn.trim() !== '' && record.clockIn.trim() !== '--:--';
      const hasOut = record && record.clockOut && record.clockOut.trim() !== '' && record.clockOut.trim() !== '--:--';

      if (!record || record.status === 'absent' || (!hasIn && !hasOut)) {
        candidates.push({
          date: dateStr,
          label: `${dateStr} • Absent / No Punch`,
          description: 'No Check-In & No Check-Out recorded on this working day',
          type: 'missing_both',
          existingRecord: record,
          clockIn: undefined,
          clockOut: undefined
        });
      } else if (hasIn && !hasOut) {
        candidates.push({
          date: dateStr,
          label: `${dateStr} • In: ${record.clockIn} (Missing Out)`,
          description: `Checked in at ${record.clockIn} but missed Out punch`,
          type: 'missing_out',
          existingRecord: record,
          clockIn: record.clockIn,
          clockOut: undefined
        });
      } else if (!hasIn && hasOut) {
        candidates.push({
          date: dateStr,
          label: `${dateStr} • Out: ${record.clockOut} (Missing In)`,
          description: `Checked out at ${record.clockOut} but missed In punch`,
          type: 'missing_in',
          existingRecord: record,
          clockIn: undefined,
          clockOut: record.clockOut
        });
      }
    }

    return candidates;
  }, [formUserId, currentUser.id, attendanceRecords, todayObj]);

  // Auto-detect punch whenever formDate or formUserId changes
  const autoDetectPunchForDate = (date: string, userId: string) => {
    const record = attendanceRecords.find((a) => a.userId === userId && a.date === date);
    const hasIn = record && record.clockIn && record.clockIn.trim() !== '' && record.clockIn.trim() !== '--:--';
    const hasOut = record && record.clockOut && record.clockOut.trim() !== '' && record.clockOut.trim() !== '--:--';

    if (hasIn && record?.clockIn) {
      setDetectedInPunch(record.clockIn);
      const parsed = parseTimeTo24H(record.clockIn);
      if (parsed) setFormInTime(parsed);
    } else {
      setDetectedInPunch(null);
      setFormInTime('09:30');
    }

    if (hasOut && record?.clockOut) {
      setDetectedOutPunch(record.clockOut);
      const parsed = parseTimeTo24H(record.clockOut);
      if (parsed) setFormOutTime(parsed);
    } else {
      setDetectedOutPunch(null);
      setFormOutTime('17:30');
    }
  };

  const isBeforeOrOnApplicableDate = (dateStr: string) => {
    if (!dateStr) return true;
    return dateStr >= todayStr;
  };

  // Helper Rules Checkers:
  // 1. User Can Edit/Delete: Allowed ONLY for applicant before approval/forwarding & applicable date, or Admin anytime.
  const canUserModify = (req: ManualAttendanceRegularizationRequest) => {
    if (isAdmin) return true;
    if (isReviewingManager || isReportingManager) return false; // Managers acting in manager capacity
    if (req.userId !== currentUser.id) return false;
    if (req.status !== 'pending') return false;
    if (!isBeforeOrOnApplicableDate(req.date)) return false; // Only before applicable date
    return true;
  };

  // 2. Manager Can Approve / Reject: Reporting Manager of the request or Admin (Reviewing Manager view-only)
  const canManagerAction = (req: ManualAttendanceRegularizationRequest) => {
    if (req.status !== 'pending') return false;
    if (isReviewingManager) return false; // Reviewing Manager is strictly view-only
    if (isAdmin || currentUser.baseRole === 'administrator') {
      if (req.userId === currentUser.id && currentUser.role !== 'administrator') return false;
      return true;
    }
    if (isReportingManager || isReportingManagerOrPI || currentUser.role === 'reporting_manager') {
      if (req.userId === currentUser.id) return false; // Cannot approve own request
      const reqUser = users.find((u) => u.id === req.userId);
      const mgrId = req.reportingManagerId || reqUser?.reportingManagerId;
      return (
        mgrId === currentUser.id ||
        !mgrId ||
        req.reportingManagerName === currentUser.name ||
        reqUser?.piName === currentUser.name ||
        reqUser?.hodName === currentUser.name ||
        users.some((u) => u.id === req.userId && u.reportingManagerId === currentUser.id) ||
        accessibleUserIds.includes(req.userId)
      );
    }
    return false;
  };

  // 3. Manager Can Cancel / Revoke Approved Attendance: Reporting Manager of the request or Admin before applicable date
  const canManagerCancelApproval = (req: ManualAttendanceRegularizationRequest) => {
    if (req.status !== 'approved') return false;
    if (isReviewingManager) return false; // Reviewing Manager is strictly view-only
    if (isAdmin || currentUser.baseRole === 'administrator') {
      if (req.userId === currentUser.id && currentUser.role !== 'administrator') return false;
      return true;
    }
    if (!isBeforeOrOnApplicableDate(req.date)) return false; // Approved record can be cancelled before applicable date
    if (isReportingManager || isReportingManagerOrPI || currentUser.role === 'reporting_manager') {
      if (req.userId === currentUser.id) return false;
      const reqUser = users.find((u) => u.id === req.userId);
      const mgrId = req.reportingManagerId || reqUser?.reportingManagerId;
      return (
        mgrId === currentUser.id ||
        !mgrId ||
        req.reportingManagerName === currentUser.name ||
        reqUser?.piName === currentUser.name ||
        reqUser?.hodName === currentUser.name ||
        users.some((u) => u.id === req.userId && u.reportingManagerId === currentUser.id) ||
        accessibleUserIds.includes(req.userId)
      );
    }
    return false;
  };

  // Pending Manager Queue for Notification Alert (Only for Reporting Manager & Administrator)
  const pendingManagerQueue = useMemo(() => {
    return manualAttendanceRequests.filter((r) => {
      if (r.status !== 'pending') return false;
      if (isAdmin) return true;
      if (isReportingManager) {
        return r.reportingManagerId === currentUser.id;
      }
      return false;
    });
  }, [manualAttendanceRequests, isAdmin, isReportingManager, currentUser.id]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return manualAttendanceRequests.filter((req) => {
      // Tab Filtering
      if (tabFilter === 'my' && req.userId !== currentUser.id) return false;
      if (tabFilter === 'pending' && req.status !== 'pending') return false;

      // Access Filter
      if (!isAdmin && !isReviewingManager) {
        if (isReportingManager) {
          if (req.userId !== currentUser.id && req.reportingManagerId !== currentUser.id) {
            return false;
          }
        } else {
          if (req.userId !== currentUser.id) return false;
        }
      }

      // User Filter
      if (!matchesMultiSelect(filterUser, req.userId)) return false;

      // Department Filter
      if (!matchesMultiSelect(filterDept, req.userDepartment)) return false;

      // Designation Filter
      const reqUser = users.find((u) => u.id === req.userId);
      if (!matchesMultiSelect(filterDesignation, reqUser?.designation)) return false;

      // Reporting Manager Filter
      if (!matchesMultiSelect(filterReportingManager, req.reportingManagerId)) return false;

      // Reason Category Filter
      if (!matchesMultiSelect(filterReasonCategory, req.reasonCategory)) return false;

      // Status Filter
      if (!matchesMultiSelect(filterStatus, req.status)) return false;

      // Date Range Filter
      if (filterStartDate && req.date < filterStartDate) return false;
      if (filterEndDate && req.date > filterEndDate) return false;

      // Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = req.userName.toLowerCase().includes(query);
        const matchesDept = req.userDepartment.toLowerCase().includes(query);
        const matchesReason = req.reason.toLowerCase().includes(query);
        const matchesCategory = (req.reasonCategory || '').toLowerCase().includes(query);
        const matchesDate = req.date.includes(query);
        const matchesManager = req.reportingManagerName.toLowerCase().includes(query);
        const matchesDesig = (req.userDesignation || '').toLowerCase().includes(query);
        if (!matchesName && !matchesDept && !matchesReason && !matchesCategory && !matchesDate && !matchesManager && !matchesDesig) {
          return false;
        }
      }

      return true;
    });
  }, [
    manualAttendanceRequests,
    tabFilter,
    currentUser,
    isAdmin,
    isReportingManager,
    isReviewingManager,
    filterUser,
    filterDept,
    filterDesignation,
    filterReportingManager,
    filterReasonCategory,
    filterStatus,
    filterStartDate,
    filterEndDate,
    searchTerm,
    users
  ]);

  // Sorted Requests based on active Sort Field and Sort Order
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'employee') {
        comparison = (a.userName || '').localeCompare(b.userName || '');
      } else if (sortField === 'forgottenDate') {
        const aVal = `${a.date} ${a.requestedInTime || ''}`;
        const bVal = `${b.date} ${b.requestedInTime || ''}`;
        comparison = aVal.localeCompare(bVal);
      } else if (sortField === 'appliedDate') {
        const aVal = a.appliedAt || a.date;
        const bVal = b.appliedAt || b.date;
        comparison = aVal.localeCompare(bVal);
      } else if (sortField === 'category') {
        const aCat = formatReasonCategory(a.reasonCategory).label;
        const bCat = formatReasonCategory(b.reasonCategory).label;
        comparison = aCat.localeCompare(bCat);
      } else if (sortField === 'reason') {
        const aText = getFormattedReasonText(a);
        const bText = getFormattedReasonText(b);
        comparison = aText.localeCompare(bText);
      } else if (sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredRequests, sortField, sortOrder]);

  const [manualPage, setManualPage] = useState(1);
  const [manualPageSize, setManualPageSize] = useState(25);

  const paginatedRequests = useMemo(() => {
    const start = (manualPage - 1) * manualPageSize;
    return sortedRequests.slice(start, start + manualPageSize);
  }, [sortedRequests, manualPage, manualPageSize]);

  // Metrics
  const stats = useMemo(() => {
    const total = filteredRequests.length;
    const pending = filteredRequests.filter((r) => r.status === 'pending').length;
    const approved = filteredRequests.filter((r) => r.status === 'approved').length;
    const rejected = filteredRequests.filter((r) => r.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [filteredRequests]);

  // Open Apply Modal
  const handleOpenApplyModal = (reqToEdit?: ManualAttendanceRegularizationRequest) => {
    if (!canApplyRegularization && !reqToEdit) return;
    setFormError('');
    if (reqToEdit) {
      setEditingRequest(reqToEdit);
      setFormUserId(reqToEdit.userId);
      setFormDate(reqToEdit.date);
      setFormInTime(reqToEdit.requestedInTime || '09:30');
      setFormOutTime(reqToEdit.requestedOutTime || '17:30');
      setFormReasonCategory((reqToEdit.reasonCategory as ReasonCategory) || 'Forgot to Punch');
      setFormReason(reqToEdit.reason || '');
      setDetectedInPunch(reqToEdit.originalInTime || null);
      setDetectedOutPunch(reqToEdit.originalOutTime || null);
    } else {
      setEditingRequest(null);
      const targetUid = currentUser.id;
      setFormUserId(targetUid);
      const initialDate = candidateMissingDates.length > 0 ? candidateMissingDates[0].date : maxDateStr;
      setFormDate(initialDate);
      setFormReasonCategory('Forgot to Punch');
      setFormReason('');
      autoDetectPunchForDate(initialDate, targetUid);
    }
    setShowApplyModal(true);
  };

  // Date selection change handler in Modal
  const handleDateChange = (newDate: string) => {
    setFormDate(newDate);
    autoDetectPunchForDate(newDate, formUserId);
  };

  // User selection change handler (for Admin)
  const handleUserChange = (newUserId: string) => {
    setFormUserId(newUserId);
    autoDetectPunchForDate(formDate, newUserId);
  };

  // Form Submit (Create or Edit)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formDate) {
      setFormError('Please select a forgotten attendance date.');
      return;
    }

    if (formDate > maxDateStr) {
      setFormError(`Manual attendance is only allowed for past dates (up to yesterday: ${maxDateStr}).`);
      return;
    }

    if (!formInTime || !formOutTime) {
      setFormError('Please specify both Check-In and Check-Out times.');
      return;
    }

    if (formInTime >= formOutTime) {
      setFormError('Check-Out time must be later than Check-In time.');
      return;
    }

    setIsSubmitting(true);

    const fullReason = formReason.trim() ? formReason.trim() : getDefaultReasonDescription(formReasonCategory);

    if (editingRequest) {
      const res = editManualAttendance(editingRequest.id, {
        date: formDate,
        inTime: formInTime,
        outTime: formOutTime,
        reasonCategory: formReasonCategory,
        reason: fullReason,
        originalInTime: detectedInPunch || undefined,
        originalOutTime: detectedOutPunch || undefined
      });
      setIsSubmitting(false);
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      showToast('Manual attendance request updated successfully.', 'success');
    } else {
      const res = applyManualAttendance({
        date: formDate,
        inTime: formInTime,
        outTime: formOutTime,
        reasonCategory: formReasonCategory,
        reason: fullReason,
        targetUserId: isAdmin ? formUserId : currentUser.id,
        originalInTime: detectedInPunch || undefined,
        originalOutTime: detectedOutPunch || undefined
      });
      setIsSubmitting(false);
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      // Auto-expand date bounds if newly applied request is outside current filter range
      if (filterStartDate && formDate < filterStartDate) {
        setFilterStartDate(formDate);
      }
      if (filterEndDate && formDate > filterEndDate) {
        setFilterEndDate(formDate);
      }
      showToast(res.message, 'success');
    }

    setShowApplyModal(false);
  };

  // Approve / Reject Handlers
  const handleApprove = (id: string, customComment?: string) => {
    const comment = customComment !== undefined ? customComment : (approverComments[id] || '');
    const res = approveRejectManualAttendance(id, 'approve', comment);
    if (res.success) {
      showToast(res.message, 'success');
      setApproverComments((prev) => ({ ...prev, [id]: '' }));
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleReject = (id: string, customComment?: string) => {
    const comment = customComment !== undefined ? customComment : (approverComments[id] || '');
    const res = approveRejectManualAttendance(id, 'reject', comment);
    if (res.success) {
      showToast(res.message, 'success');
      setApproverComments((prev) => ({ ...prev, [id]: '' }));
    } else {
      showToast(res.message, 'error');
    }
  };

  // Delete Handler
  const handleDelete = (id: string) => {
    const res = deleteManualAttendance(id);
    if (res.success) {
      showToast(res.message, 'success');
      setDeleteConfirmId(null);
    } else {
      showToast(res.message, 'error');
    }
  };

  // Cancel Approved Manual Attendance Handler
  const handleCancelApproval = (id: string, reason?: string) => {
    const res = cancelApprovedManualAttendance(id, reason);
    if (res.success) {
      showToast(res.message, 'success');
      setCancelModalReq(null);
      setCancelReason('');
    } else {
      showToast(res.message, 'error');
    }
  };

  // --- EXPORT TO CSV ---
  const handleExportCSV = () => {
    if (sortedRequests.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }
    const headers = [
      'ID',
      'Employee Name',
      'Department',
      'Designation',
      'Forgotten Date',
      'Requested In Time',
      'Requested Out Time',
      'Original In Time',
      'Original Out Time',
      'Reason Category',
      'Reason Details',
      'Reporting Manager',
      'Status',
      'Applied Date',
      'Action Date',
      'Action By',
      'Manager Comment'
    ];
    const rows = sortedRequests.map((r) => [
      r.id,
      `"${r.userName}"`,
      `"${r.userDepartment}"`,
      `"${r.userDesignation || ''}"`,
      r.date,
      r.requestedInTime,
      r.requestedOutTime,
      `"${r.originalInTime || '--'}"`,
      `"${r.originalOutTime || '--'}"`,
      `"${formatReasonCategory(r.reasonCategory).label}"`,
      `"${getFormattedReasonText(r).replace(/"/g, '""')}"`,
      `"${r.reportingManagerName}"`,
      r.status.toUpperCase(),
      r.appliedAt || r.date,
      r.actionDate || '--',
      `"${r.actionBy || '--'}"`,
      `"${(r.managerComment || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Manual_Attendance_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV report downloaded successfully.', 'success');
  };

  // --- EXPORT TO PDF ---
  const handleExportPDF = () => {
    if (sortedRequests.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Central Staff Manual Attendance Report', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Filtered Count: ${sortedRequests.length}`, 14, 21);

    const tableData = sortedRequests.map((r, i) => {
      const formattedReason = getFormattedReasonText(r);
      return [
        i + 1,
        r.userName,
        r.userDepartment,
        `${r.date} (${r.requestedInTime} - ${r.requestedOutTime})`,
        r.appliedAt || r.date,
        formatReasonCategory(r.reasonCategory).label,
        formattedReason.length > 35 ? formattedReason.slice(0, 32) + '...' : formattedReason,
        r.status.toUpperCase()
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [['#', 'Employee', 'Dept', 'Forgotten Date & Timings', 'Applied Date', 'Category', 'Reason', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 }
    });

    doc.save(`Manual_Attendance_Report_${todayStr}.pdf`);
    showToast('PDF report generated and downloaded.', 'success');
  };

  const handlePresetCurrentMonth = () => {
    setFilterStartDate(DEFAULT_START_DATE);
    setFilterEndDate(DEFAULT_END_DATE);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-xs font-bold transition-all animate-in fade-in duration-200 border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner & Header */}
      <PageHeader
        icon={Clock}
        title="Manual Attendance"
        subtitle="Apply & approve forgotten past punch corrections with automated time auto-fill and hierarchy governance"
        rightAction={
          canApplyRegularization ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleOpenApplyModal()}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Apply for Manual Attendance</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Summary Stat Metrics: Exactly 4 Uniform Cards matching standard theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Approved */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Approved Corrections</p>
            <p className="text-2xl font-black text-emerald-900 mt-1">{stats.approved}</p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Punches Regularized</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
        </div>

        {/* 2. Pending Approvals */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pending Approvals</p>
            <p className="text-2xl font-black text-amber-900 mt-1">{stats.pending}</p>
            <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Awaiting Manager Decision</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-700 animate-spin" />
          </div>
        </div>

        {/* 3. Total Applications */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Total Applications</p>
            <p className="text-2xl font-black text-blue-900 mt-1">{stats.total}</p>
            <p className="text-[10px] text-blue-700 font-semibold mt-0.5">Regularization Requests Filed</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-700" />
          </div>
        </div>

        {/* 4. Rejected / Cancelled */}
        <div className="bg-rose-50/70 border border-rose-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Rejected / Cancelled</p>
            <p className="text-2xl font-black text-rose-900 mt-1">{stats.rejected}</p>
            <p className="text-[10px] text-rose-700 font-semibold mt-0.5">Declined or Withdrawn</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300/80 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-rose-700" />
          </div>
        </div>
      </div>

      {/* Main Filter & Search Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Top Bar: Clean Themed Date Pickers & Presets & Export Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 border-b border-slate-100 pb-3.5">
          {/* Left: Date Pickers & Presets */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <AppDatePicker
                size="sm"
                placeholder="From Date"
                value={filterStartDate}
                onChange={(dStr) => setFilterStartDate(dStr)}
              />

              <span className="text-slate-300 font-bold">—</span>

              <AppDatePicker
                size="sm"
                placeholder="To Date"
                value={filterEndDate}
                onChange={(dStr) => setFilterEndDate(dStr)}
                isRightColumn={true}
              />
            </div>

            {/* Quick Preset: Current Month (Only appears when dates are modified from default) */}
            {(filterStartDate !== DEFAULT_START_DATE || filterEndDate !== DEFAULT_END_DATE) && (
              <div>
                <button
                  onClick={handlePresetCurrentMonth}
                  className="h-9 bg-slate-50/90 hover:bg-white border border-slate-200/90 rounded-xl px-3.5 text-xs font-bold text-slate-800 shadow-2xs flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer"
                  title="Reset dates to Current Month"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Current Month</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Export Buttons (CSV & PDF) */}
          <div className="flex items-center space-x-2 shrink-0 self-end lg:self-auto">
            <button
              onClick={handleExportCSV}
              className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Second Row: Search Keyword, Reset & View Toggle Switch */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee, department, reason, date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full pl-10 pr-9 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
              {(searchTerm !== '' ||
                !filterStatus.includes('all') ||
                !filterReasonCategory.includes('all') ||
                !filterUser.includes('all') ||
                !filterDesignation.includes('all') ||
                !filterDept.includes('all') ||
                !filterReportingManager.includes('all') ||
                filterStartDate !== DEFAULT_START_DATE ||
                filterEndDate !== DEFAULT_END_DATE) && (
                <button
                  onClick={handleResetFilters}
                  className="h-9 px-3.5 bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer shadow-2xs"
                  title="Reset all search and filter selections"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Reset All Filters</span>
                </button>
              )}

              {/* View Mode Toggle */}
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
                  title="Grid View"
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
          </div>

          {/* Third Row: Filter Dropdowns Uniform Flex Wrap */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                FILTERS
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap responsive-filter-row">
              {/* 1. Employee Filter (Reporting Manager / PI, Reviewing Manager, Admin) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Employee"
                    icon={<UserIcon className="w-3.5 h-3.5" />}
                    selectedValues={filterUser}
                    onChange={setFilterUser}
                    options={accessibleUsers.map((u) => ({ label: u.name, value: u.id }))}
                  />
                </div>
              )}

              {/* 2. Designation Filter (Reporting Manager / PI, Reviewing Manager, Admin) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Designation"
                    icon={<Briefcase className="w-3.5 h-3.5" />}
                    selectedValues={filterDesignation}
                    onChange={setFilterDesignation}
                    options={designationList.map((d) => ({ label: d, value: d }))}
                  />
                </div>
              )}

              {/* 3. Department Filter (Reporting Manager / PI, Reviewing Manager, Admin) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Department"
                    icon={<Building className="w-3.5 h-3.5" />}
                    selectedValues={filterDept}
                    onChange={setFilterDept}
                    options={departmentList.map((d) => ({ label: d, value: d }))}
                  />
                </div>
              )}

              {/* 4. Reporting Manager Filter (Reviewing Manager, Admin) */}
              {canSeeReportingManagerFilter && (
                <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Reporting Manager"
                    icon={<UserCheck className="w-3.5 h-3.5" />}
                    selectedValues={filterReportingManager}
                    onChange={setFilterReportingManager}
                    options={reportingManagerList.map((m) => ({ label: m.name, value: m.id }))}
                  />
                </div>
              )}

              {/* 5. Reason Category Filter */}
              <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="Reason Category"
                  icon={<Filter className="w-3.5 h-3.5" />}
                  selectedValues={filterReasonCategory}
                  onChange={setFilterReasonCategory}
                  options={REASON_CATEGORIES.map((cat) => ({ label: cat, value: cat }))}
                />
              </div>

              {/* 6. Status / Scope Filter (All Roles) */}
              <div className="flex-1 min-w-[115px] max-w-[170px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="Status"
                  icon={<Clock className="w-3.5 h-3.5" />}
                  selectedValues={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { label: 'Pending', value: 'pending' },
                    { label: 'Approved', value: 'approved' },
                    { label: 'Rejected', value: 'rejected' }
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Manager Queue Alert Banner */}
      {(isReportingManager || isAdmin) && pendingManagerQueue.length > 0 && (
        <div className="bg-[#fefce8] border border-amber-300/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-amber-100/90 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950">
                Action Required: {pendingManagerQueue.length} Pending Manual Attendance Request{pendingManagerQueue.length > 1 ? 's' : ''}
              </h3>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Staff members have submitted missing past punches requiring your review and authorization.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTabFilter('pending');
              setFilterStatus('pending');
            }}
            className="bg-[#ea580c] hover:bg-[#c2410c] active:bg-[#9a3412] text-white font-bold text-xs px-5 py-2 rounded-full shadow-2xs transition-all cursor-pointer shrink-0 flex items-center space-x-1.5"
          >
            <span>Review Queue ({pendingManagerQueue.length})</span>
          </button>
        </div>
      )}

      {/* Main Table / Grid Container */}
      <div className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {/* Table Title Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 min-h-[50px]">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Manual Attendance Records ({filteredRequests.length})
            </span>
            <span className="text-[11px] text-slate-500 font-medium bg-slate-200/60 px-2.5 py-0.5 rounded-full border border-slate-200">
              Rule: <strong className="text-slate-900">Strictly past dates (≤ {maxDateStr})</strong>
            </span>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white space-y-2">
            <Clock className="w-10 h-10 mx-auto text-indigo-300" />
            <p className="text-xs font-semibold">No manual attendance records match the active filters.</p>
            {canApplyRegularization && (
              <button
                onClick={() => handleOpenApplyModal()}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Click here to apply for manual attendance
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-auto min-w-[950px]">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr className="h-10">
                  {/* Employee Column */}
                  <th
                    onClick={() => handleSort('employee')}
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[18%]"
                    title="Click to sort by Employee Details"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Employee Details</span>
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

                  {/* Forgotten Date & Timings Column */}
                  <th
                    onClick={() => handleSort('forgottenDate')}
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[18%]"
                    title="Click to sort by Forgotten Date & Timings"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Forgotten Date &amp; Timings</span>
                      {sortField === 'forgottenDate' ? (
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
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[10%]"
                    title="Click to sort by Applied Date"
                  >
                    <div className="flex items-center space-x-1.5">
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
                    onClick={() => handleSort('category')}
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[11%]"
                    title="Click to sort by Category"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Category</span>
                      {sortField === 'category' ? (
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
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[16%]"
                    title="Click to sort by Reason / Details"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Reason / Details</span>
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
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[12%]"
                    title="Click to sort by Status"
                  >
                    <div className="flex items-center space-x-1.5">
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
                  <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap align-middle w-[17%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRequests.map((req) => {
                  const editable = canUserModify(req);
                  const canAct = canManagerAction(req);
                  const canCancel = canManagerCancelApproval(req);
                  const catInfo = formatReasonCategory(req.reasonCategory);
                  const reasonText = getFormattedReasonText(req);

                  const targetUser = users.find((u) => u.id === req.userId);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 align-middle">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <img
                            src={targetUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                            alt={req.userName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 block truncate max-w-[160px] text-xs">{req.userName}</span>
                            <span className="text-[11px] text-slate-500 font-medium block truncate max-w-[160px] mt-0.5">
                              {req.userDesignation || targetUser?.designation || 'Staff'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono tracking-tight block truncate max-w-[160px] mt-0.5">
                              {targetUser?.biometricId ? `Bio ID: ${targetUser.biometricId}` : (req.userId ? `Bio ID: ${req.userId}` : 'Bio ID: N/A')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap align-middle">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{req.date}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-600 mt-0.5 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{req.requestedInTime} - {req.requestedOutTime}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap align-middle text-slate-700 text-xs">
                        <div className="flex items-center space-x-1 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{req.appliedAt || req.date}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap align-middle">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block border ${catInfo.badgeClass}`}>
                          {catInfo.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <p className="text-slate-700 text-[11px] line-clamp-2 leading-snug max-w-[200px]" title={reasonText}>
                          {reasonText}
                        </p>
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap align-middle">
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded text-[10px] border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Approved</span>
                          </span>
                        )}
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded text-[10px] border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                            <span>Pending</span>
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded text-[10px] border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap align-middle">
                        <div className="flex items-center justify-end space-x-1">
                          {/* View details */}
                          <button
                            onClick={() => setDetailModalReq(req)}
                            className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600 stroke-[2]" />
                          </button>

                          {/* Edit button */}
                          {editable && (
                            <button
                              onClick={() => handleOpenApplyModal(req)}
                              className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Edit Application"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-blue-600 stroke-[2]" />
                            </button>
                          )}

                          {/* Delete button */}
                          {editable && (
                            <button
                              onClick={() => setDeleteConfirmId(req.id)}
                              className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Delete Application"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600 stroke-[2]" />
                            </button>
                          )}

                          {/* Approve / Reject Action Buttons for Pending */}
                          {canAct && (
                            <>
                              <button
                                onClick={() => {
                                  setActionModalReq(req);
                                  setActionComments(approverComments[req.id] || '');
                                }}
                                className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                                title="Approve Regularization"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2]" />
                              </button>
                              <button
                                onClick={() => {
                                  setActionModalReq(req);
                                  setActionComments(approverComments[req.id] || '');
                                }}
                                className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                                title="Reject Regularization"
                              >
                                <X className="w-3.5 h-3.5 text-rose-600 stroke-[2]" />
                              </button>
                            </>
                          )}

                          {/* Cancel Approval Button for Approved Record */}
                          {canCancel && (
                            <button
                              onClick={() => {
                                setCancelModalReq(req);
                                setCancelReason('');
                              }}
                              className="w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] shrink-0 inline-flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Cancel / Revoke Approved Attendance"
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
            <TablePagination
              currentPage={manualPage}
              totalPages={Math.ceil(sortedRequests.length / manualPageSize)}
              totalItems={sortedRequests.length}
              pageSize={manualPageSize}
              onPageChange={setManualPage}
              onPageSizeChange={setManualPageSize}
            />
          </div>
        ) : (
          /* Grid View */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedRequests.map((req) => {
              const editable = canUserModify(req);
              const canAct = canManagerAction(req);
              const canCancel = canManagerCancelApproval(req);
              const catInfo = formatReasonCategory(req.reasonCategory);
              const reasonText = getFormattedReasonText(req);

              return (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-900 text-xs block truncate">{req.userName}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{req.userDepartment} {req.userDesignation ? `• ${req.userDesignation}` : ''}</span>
                    </div>

                    <div className="shrink-0">
                      {req.status === 'approved' && (
                        <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Approved</span>
                        </span>
                      )}
                      {req.status === 'pending' && (
                        <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                          <span>Pending</span>
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-700 font-semibold">
                      <span className="text-slate-500 text-[11px]">Forgotten Date:</span>
                      <span className="font-bold text-slate-900 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>{req.date}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 font-semibold">
                      <span className="text-slate-500 text-[11px]">Requested Punch:</span>
                      <span className="font-bold text-blue-700">{req.requestedInTime} - {req.requestedOutTime}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 font-semibold">
                      <span className="text-slate-500 text-[11px]">Applied Date:</span>
                      <span className="font-semibold text-slate-700 text-[11px]">{req.appliedAt || req.date}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 font-semibold">
                      <span className="text-slate-500 text-[11px]">Reason Category:</span>
                      <span className={`font-bold border px-2 py-0.5 rounded text-[10px] ${catInfo.badgeClass}`}>
                        {catInfo.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 line-clamp-2 leading-relaxed" title={reasonText}>
                    "{reasonText}"
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 text-[11px]">
                      RM: <strong className="text-slate-800">{req.reportingManagerName}</strong>
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setDetailModalReq(req)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                        title="View Full Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {editable && (
                        <button
                          onClick={() => handleOpenApplyModal(req)}
                          className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                          title="Edit Application"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {editable && (
                        <button
                          onClick={() => setDeleteConfirmId(req.id)}
                          className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                          title="Delete Application"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {canAct && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <input
                        type="text"
                        placeholder="Manager note (optional)..."
                        value={approverComments[req.id] || ''}
                        onChange={(e) =>
                          setApproverComments({ ...approverComments, [req.id]: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer flex items-center justify-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer flex items-center justify-center space-x-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {canCancel && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setCancelModalReq(req);
                          setCancelReason('');
                        }}
                        className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Cancel Approved Attendance</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- APPLY / EDIT MODAL --- */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                  <Clock className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-wide">
                    {editingRequest ? 'Edit Manual Attendance Request' : 'Apply for Manual Attendance'}
                  </h2>
                  <p className="text-xs text-slate-300">
                    Regularize past forgotten punch logs with Reporting Officer approval
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Admin Target Employee Selector */}
              {isAdmin && !editingRequest && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Apply on Behalf of Employee *
                  </label>
                  <AppSelect
                    value={formUserId}
                    onChange={(val) => handleUserChange(val)}
                    options={users.map((u) => ({
                      label: u.name,
                      value: u.id,
                      description: `${u.department} - ${u.designation || 'Staff'}`
                    }))}
                  />
                </div>
              )}

              {/* Candidate Missing Punch Dates Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Select Forgotten / Incomplete Punch Date *</span>
                  </label>
                  <span className="text-[11px] font-semibold text-blue-600">
                    {candidateMissingDates.length} Missing Dates Found
                  </span>
                </div>

                {candidateMissingDates.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                    {candidateMissingDates.map((cand) => {
                      const isSelected = formDate === cand.date;
                      return (
                        <button
                          key={cand.date}
                          type="button"
                          onClick={() => handleDateChange(cand.date)}
                          className={`w-full text-left p-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white text-slate-800 hover:bg-blue-50 border border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Calendar className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                            <span>{cand.date}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                isSelected
                                  ? 'bg-blue-700 text-blue-100'
                                  : cand.type === 'missing_both'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {cand.type === 'missing_both'
                                ? 'Absent / No Punch'
                                : cand.type === 'missing_out'
                                ? `In: ${cand.clockIn}`
                                : `Out: ${cand.clockOut}`}
                            </span>
                          </div>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {isSelected ? 'Selected' : 'Pick Date'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <AppDatePicker
                      value={formDate}
                      maxDate={maxDateStr}
                      onChange={(dStr) => handleDateChange(dStr)}
                    />
                  </div>
                )}
              </div>

              {/* Timings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Regularized Check-In Time *
                  </label>
                  <input
                    type="time"
                    value={formInTime}
                    onChange={(e) => setFormInTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Regularized Check-Out Time *
                  </label>
                  <input
                    type="time"
                    value={formOutTime}
                    onChange={(e) => setFormOutTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Reason Dropdown (Standard Options) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason Category *
                </label>
                <AppSelect
                  value={formReasonCategory}
                  onChange={(val) => setFormReasonCategory(val as ReasonCategory)}
                  options={[...REASON_CATEGORIES]}
                />
              </div>

              {/* Specific Remarks / Explanation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Remarks / Explanation (Optional)
                </label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g., Biometric facial scanner hardware error during morning punch; lab specimen transfer in evening."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : editingRequest ? 'Update Request' : 'Submit Application'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Delete Manual Attendance Request?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete this pending manual attendance request? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAIL MODAL --- */}
      {detailModalReq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-blue-300" />
                <h3 className="font-bold text-sm">Manual Attendance Details</h3>
              </div>
              <button
                onClick={() => setDetailModalReq(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs text-slate-700 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Employee:</span>
                <span className="font-bold text-slate-900">{detailModalReq.userName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Department:</span>
                <span>{detailModalReq.userDepartment} {detailModalReq.userDesignation ? `• ${detailModalReq.userDesignation}` : ''}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Forgotten Date:</span>
                <span className="font-bold text-blue-900 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>{detailModalReq.date}</span>
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Reason Category:</span>
                {(() => {
                  const catInfo = formatReasonCategory(detailModalReq.reasonCategory);
                  return (
                    <span className={`font-bold px-2 py-0.5 rounded border text-[10px] ${catInfo.badgeClass}`}>
                      {catInfo.label}
                    </span>
                  );
                })()}
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Requested Punch:</span>
                <span className="font-bold text-blue-700">{detailModalReq.requestedInTime} - {detailModalReq.requestedOutTime}</span>
              </div>
              {(detailModalReq.originalInTime || detailModalReq.originalOutTime) && (
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-500">Original Punch:</span>
                  <span className="font-semibold text-slate-700">
                    In: {parseTimeTo24H(detailModalReq.originalInTime) || detailModalReq.originalInTime || 'Missing'} | Out: {parseTimeTo24H(detailModalReq.originalOutTime) || detailModalReq.originalOutTime || 'Missing'}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Reporting Boss:</span>
                <span className="font-semibold text-slate-900">{detailModalReq.reportingManagerName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Status:</span>
                <span
                  className={`font-bold uppercase text-[11px] px-2 py-0.5 rounded ${
                    detailModalReq.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : detailModalReq.status === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {detailModalReq.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500">Applied Date:</span>
                <span>{detailModalReq.appliedAt || detailModalReq.date}</span>
              </div>
              {detailModalReq.actionDate && (
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-500">Decision Date / By:</span>
                  <span>{detailModalReq.actionDate} {detailModalReq.actionBy ? `by ${detailModalReq.actionBy}` : ''}</span>
                </div>
              )}
              <div>
                <span className="font-bold text-slate-500 block mb-1">Reason Details:</span>
                <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                  {getFormattedReasonText(detailModalReq)}
                </p>
              </div>
              {detailModalReq.managerComment && (
                <div>
                  <span className="font-bold text-slate-500 block mb-1">Manager Remarks:</span>
                  <p className="bg-blue-50 p-2.5 rounded-lg border border-blue-100 text-blue-900 font-medium">
                    {detailModalReq.managerComment}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
              <button
                onClick={() => setDetailModalReq(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-xs"
              >
                Close
              </button>
              <div className="flex items-center space-x-2">
                {canManagerAction(detailModalReq) && (
                  <>
                    <button
                      onClick={() => {
                        const req = detailModalReq;
                        setDetailModalReq(null);
                        setActionModalReq(req);
                        setActionComments(approverComments[req.id] || '');
                      }}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 text-xs"
                    >
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => {
                        const req = detailModalReq;
                        setDetailModalReq(null);
                        setActionModalReq(req);
                        setActionComments(approverComments[req.id] || '');
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </>
                )}
                {canManagerCancelApproval(detailModalReq) && (
                  <button
                    onClick={() => {
                      const req = detailModalReq;
                      setDetailModalReq(null);
                      setCancelModalReq(req);
                      setCancelReason('');
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cancel Approval</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Approved Manual Attendance Modal */}
      {cancelModalReq && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 text-xs">
            {/* Header */}
            <div className="shrink-0 bg-gradient-to-r from-rose-900 via-rose-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-rose-950/40 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-400/30">
                  <RotateCcw className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-wide">Cancel Approved Attendance</h3>
                  <p className="text-[11px] text-rose-200/80">Revoke approval for manual attendance record</p>
                </div>
              </div>
              <button
                onClick={() => setCancelModalReq(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{cancelModalReq.userName}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                    Currently Approved
                  </span>
                </div>
                <div className="text-slate-700 space-y-1 pt-1 text-[11px]">
                  <p>🗓️ Date: <strong className="text-slate-900">{cancelModalReq.date}</strong></p>
                  <p>⏰ Regularized Timings: <strong className="text-slate-900">{cancelModalReq.requestedInTime} - {cancelModalReq.requestedOutTime}</strong></p>
                  <p>🏷️ Reason Category: <strong className="text-slate-900">{cancelModalReq.reasonCategory || 'Forget to punch'}</strong></p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Cancellation Reason / Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Regularized erroneously, Biometric record verified, Employee on leave..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:outline-none focus:border-rose-600 transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-end space-x-2.5">
              <button
                onClick={() => setCancelModalReq(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-xs"
              >
                Keep Approved
              </button>
              <button
                onClick={() => handleCancelApproval(cancelModalReq.id, cancelReason)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 text-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Confirm Cancel Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {actionModalReq && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 text-xs">
            {/* Header */}
            <div className="shrink-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-indigo-950/40 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-wide">Review Manual Attendance</h3>
                  <p className="text-[11px] text-indigo-200/80">Authorize or reject missing punch attendance</p>
                </div>
              </div>
              <button
                onClick={() => setActionModalReq(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Applicant Details */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{actionModalReq.userName}</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded border border-indigo-200">
                    {actionModalReq.userDepartment}
                  </span>
                </div>
                <div className="text-slate-700 space-y-1 pt-1">
                  <p>🗓️ Date: <strong className="text-slate-900">{actionModalReq.date}</strong></p>
                  <p>⏰ Requested Timings: <strong className="text-blue-700">{actionModalReq.requestedInTime} - {actionModalReq.requestedOutTime}</strong></p>
                  <p>🏷️ Reason Category: <strong className="text-slate-900">{actionModalReq.reasonCategory || 'Forget to punch'}</strong></p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700 italic">
                  "{actionModalReq.reason}"
                </div>
              </div>

              {/* Approver Comments */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Approver Remarks (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Enter approval notes or reason for rejection..."
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-end space-x-2.5">
              <button
                onClick={() => {
                  handleReject(actionModalReq.id, actionComments);
                  setActionModalReq(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5"
              >
                <X className="w-4 h-4" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => {
                  handleApprove(actionModalReq.id, actionComments);
                  setActionModalReq(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
