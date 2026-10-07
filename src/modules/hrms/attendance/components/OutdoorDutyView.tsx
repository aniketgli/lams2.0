import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { OutdoorDutyRequest } from '../../../../types';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { TablePagination } from '../../../../shared/components/TablePagination';
import { AppSelect } from '../../../../shared/components/AppSelect';
import { AppTimePicker } from '../../../../shared/components/AppTimePicker';
import {
  MapPin,
  PlusCircle,
  Calendar,
  Clock,
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
  Globe,
  IndianRupee,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  CheckCheck
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const OutdoorDutyView: React.FC = () => {
  const {
    currentUser,
    users,
    odRequests,
    applyOutdoorDuty,
    editOutdoorDuty,
    deleteOutdoorDuty,
    approveOutdoorDuty,
    rejectOutdoorDuty,
    cancelApprovedOutdoorDuty
  } = useApp();

  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];
  const currentYear = todayObj.getFullYear();
  const currentMonthStr = (todayObj.getMonth() + 1).toString().padStart(2, '0');
  const firstDayOfCurrentMonthStr = `${currentYear}-${currentMonthStr}-01`;
  const lastDayOfCurrentMonthObj = new Date(currentYear, todayObj.getMonth() + 1, 0);
  const lastDayOfCurrentMonthStr = `${currentYear}-${currentMonthStr}-${lastDayOfCurrentMonthObj.getDate().toString().padStart(2, '0')}`;

  // Role Checks
  const isAdmin = currentUser.role === 'administrator';
  const isReportingManager = currentUser.role === 'reporting_manager';
  const isReviewingManager = currentUser.role === 'reviewing_manager';
  const isNonPermanentPI =
    currentUser.employmentType !== 'permanent' &&
    (Boolean(currentUser.piName) || users.some((u) => u.reportingManagerId === currentUser.id));
  const isReportingManagerOrPI = isReportingManager || isNonPermanentPI;

  const canSeeReportingManagerFilter = isAdmin || isReviewingManager;
  const canSeeTeamFilters = isAdmin || isReviewingManager || isReportingManagerOrPI;
  // Apply permission: User can apply for self; Admin can apply on behalf of others; RM & HoD CANNOT apply.
  const canApplyOd = isAdmin || (!isReportingManager && !isReviewingManager);

  // Success / Alert Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --- MODAL STATES ---
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [editingOd, setEditingOd] = useState<OutdoorDutyRequest | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Field States
  const [formUserId, setFormUserId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('17:30');
  const [formOdType, setFormOdType] = useState<'Domestic' | 'International'>('Domestic');
  const [formLocation, setFormLocation] = useState('');
  const [formEstimatedFunds, setFormEstimatedFunds] = useState<number>(0);
  const [formFundingSource, setFormFundingSource] = useState('Institutional Travel Fund');
  const [formPurpose, setFormPurpose] = useState('');
  const [formError, setFormError] = useState('');

  // View Details Modal
  const [detailModalOd, setDetailModalOd] = useState<OutdoorDutyRequest | null>(null);

  // Review & Action Modal Popup (Approve / Reject)
  const [actionModalOd, setActionModalOd] = useState<OutdoorDutyRequest | null>(null);
  const [actionComments, setActionComments] = useState<string>('');

  // Cancel Approved OD Modal Popup
  const [cancelModalOd, setCancelModalOd] = useState<OutdoorDutyRequest | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // View Mode ('table' | 'grid') - Default Table
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Sorting State ('employee' | 'dates' | 'appliedDate' | 'type' | 'location' | 'funds' | 'purpose' | 'status')
  type SortField = 'employee' | 'dates' | 'appliedDate' | 'type' | 'location' | 'funds' | 'purpose' | 'status';
  type SortOrder = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('dates');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // --- REQUISITION FILTERS (Multi-select supported) ---
  const DEFAULT_START_DATE = '2026-08-01';
  const DEFAULT_END_DATE = lastDayOfCurrentMonthStr;
  const [filterStatus, setFilterStatus] = useState<string[]>(['all']);
  const [filterOdType, setFilterOdType] = useState<string[]>(['all']);
  const [filterDept, setFilterDept] = useState<string[]>(['all']);
  const [filterUser, setFilterUser] = useState<string[]>(['all']);
  const [filterDesignation, setFilterDesignation] = useState<string[]>(['all']);
  const [filterReportingManager, setFilterReportingManager] = useState<string[]>(['all']);
  const [filterStartDate, setFilterStartDate] = useState<string>(DEFAULT_START_DATE);
  const [filterEndDate, setFilterEndDate] = useState<string>(DEFAULT_END_DATE);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [activePurposeModal, setActivePurposeModal] = useState<{
    employeeName: string;
    duration: string;
    location: string;
    purpose: string;
  } | null>(null);

  const hasActiveFilters = Boolean(
    searchTerm.trim() !== '' ||
    (!filterStatus.includes('all') && filterStatus.length > 0) ||
    (!filterOdType.includes('all') && filterOdType.length > 0) ||
    (!filterDept.includes('all') && filterDept.length > 0) ||
    (!filterUser.includes('all') && filterUser.length > 0) ||
    (!filterDesignation.includes('all') && filterDesignation.length > 0) ||
    (!filterReportingManager.includes('all') && filterReportingManager.length > 0) ||
    filterStartDate !== DEFAULT_START_DATE ||
    filterEndDate !== DEFAULT_END_DATE
  );

  const handleResetFilters = () => {
    setFilterStatus(['all']);
    setFilterOdType(['all']);
    setFilterDept(['all']);
    setFilterUser(['all']);
    setFilterDesignation(['all']);
    setFilterReportingManager(['all']);
    setFilterStartDate(DEFAULT_START_DATE);
    setFilterEndDate(DEFAULT_END_DATE);
    setSearchTerm('');
  };

  const handlePresetCurrentMonth = () => {
    setFilterStartDate(DEFAULT_START_DATE);
    setFilterEndDate(DEFAULT_END_DATE);
  };

  // Date & Day Formatter e.g. "11/08/2026 (Tue)"
  const formatDateAndDay = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStr = parts[2].padStart(2, '0');
      const monthStr = parts[1].padStart(2, '0');
      return `${dayStr}/${monthStr}/${year} (${dayName})`;
    } catch {
      return dateStr;
    }
  };

  // Accessible Scope for User List
  const accessibleUsers = useMemo(() => {
    if (isAdmin || currentUser.baseRole === 'administrator' || isReviewingManager) return users;
    if (isReportingManagerOrPI || currentUser.role === 'reporting_manager') {
      return users.filter(
        (u) =>
          u.id === currentUser.id ||
          u.reportingManagerId === currentUser.id ||
          (u.piName && u.piName === currentUser.name) ||
          (u.hodName && u.hodName === currentUser.name)
      );
    }
    return [currentUser];
  }, [currentUser, users, isAdmin, isReportingManagerOrPI, isReviewingManager]);

  const accessibleUserIds = useMemo(() => accessibleUsers.map((u) => u.id), [accessibleUsers]);

  // Quick Map of Users
  const usersMap = useMemo(() => {
    const map = new Map<string, typeof users[0]>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  // Filtered OD Requisitions List
  const filteredReportODs = useMemo(() => {
    return odRequests.filter((o) => {
      // Exclude self records for Manager, HoD, and Admin roles unless explicitly selected in user filter
      const isFilteringSelf = filterUser.includes(currentUser.id);
      if (isReportingManager || isReviewingManager || isAdmin) {
        if (o.userId === currentUser.id && !isFilteringSelf) return false;
      } else {
        if (o.userId !== currentUser.id) return false;
      }

      if (!isAdmin && currentUser.baseRole !== 'administrator' && !accessibleUserIds.includes(o.userId)) return false;
      if (!matchesMultiSelect(filterStatus, o.status)) return false;
      if (!matchesMultiSelect(filterOdType, o.odType)) return false;
      if (!matchesMultiSelect(filterUser, o.userId)) return false;

      const reqUser = usersMap.get(o.userId);
      if (!matchesMultiSelect(filterDesignation, reqUser?.designation)) return false;
      if (!matchesMultiSelect(filterDept, o.department) && !matchesMultiSelect(filterDept, reqUser?.department)) return false;

      const mgrId = o.reportingManagerId || reqUser?.reportingManagerId;
      if (!matchesMultiSelect(filterReportingManager, mgrId)) return false;

      if (filterStartDate && o.endDate < filterStartDate) return false;
      if (filterEndDate && o.startDate > filterEndDate) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = (o.userName || '').toLowerCase().includes(term);
        const matchesLoc = (o.location || '').toLowerCase().includes(term);
        const matchesPurpose = (o.purpose || '').toLowerCase().includes(term);
        const matchesDept = (o.department || '').toLowerCase().includes(term);
        const matchesDesig = (reqUser?.designation || '').toLowerCase().includes(term);
        const matchesSource = (o.fundingSource || '').toLowerCase().includes(term);
        if (!matchesName && !matchesLoc && !matchesPurpose && !matchesDept && !matchesDesig && !matchesSource) {
          return false;
        }
      }

      return true;
    });
  }, [
    odRequests,
    isAdmin,
    currentUser.baseRole,
    accessibleUserIds,
    usersMap,
    filterStatus,
    filterOdType,
    filterUser,
    filterDesignation,
    filterDept,
    filterReportingManager,
    filterStartDate,
    filterEndDate,
    searchTerm
  ]);

  // Sorted Requests Memoized
  const sortedODs = useMemo(() => {
    const list = [...filteredReportODs];
    return list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'employee':
          comparison = (a.userName || '').localeCompare(b.userName || '');
          break;
        case 'dates': {
          const dateA = `${a.startDate}_${a.startTime || '00:00'}`;
          const dateB = `${b.startDate}_${b.startTime || '00:00'}`;
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case 'appliedDate':
          comparison = (a.appliedDate || a.startDate).localeCompare(b.appliedDate || b.startDate);
          break;
        case 'type':
          comparison = (a.odType || 'Domestic').localeCompare(b.odType || 'Domestic');
          break;
        case 'location':
          comparison = (a.location || '').localeCompare(b.location || '');
          break;
        case 'funds':
          comparison = (a.estimatedFunds || 0) - (b.estimatedFunds || 0);
          break;
        case 'purpose':
          comparison = (a.purpose || '').localeCompare(b.purpose || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredReportODs, sortField, sortOrder]);

  const [odPage, setOdPage] = useState(1);
  const [odPageSize, setOdPageSize] = useState(25);

  const paginatedODs = useMemo(() => {
    const start = (odPage - 1) * odPageSize;
    return sortedODs.slice(start, start + odPageSize);
  }, [sortedODs, odPage, odPageSize]);

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

  // Summary Stat Metrics for Outdoor Duty (Uniform 4 Cards)
  const odStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let totalFunds = 0;
    let totalDays = 0;

    filteredReportODs.forEach((od) => {
      if (od.status === 'approved') {
        approved++;
      } else if (od.status === 'pending') {
        pending++;
      } else if (od.status === 'rejected') {
        rejected++;
      }
      totalFunds += od.estimatedFunds || 0;
      totalDays += (od.daysCount || 1);
    });

    return {
      total: filteredReportODs.length,
      approved,
      pending,
      rejected,
      totalFunds,
      totalDays
    };
  }, [filteredReportODs]);

  // Pending Manager Queue for Outdoor Duty Requisitions
  const pendingManagerQueue = useMemo(() => {
    if (!isReportingManager && !isAdmin) return [];
    return odRequests.filter((od) => {
      if (od.status !== 'pending') return false;
      if (isAdmin) return true;
      if (isReportingManager) {
        if (od.userId === currentUser.id) return false;
        const reqUser = usersMap.get(od.userId);
        const mgrId = od.reportingManagerId || reqUser?.reportingManagerId;
        return mgrId === currentUser.id;
      }
      return false;
    });
  }, [odRequests, isReportingManager, isAdmin, currentUser.id, usersMap]);

  const formatCompactDateRange = (startStr: string, endStr: string): string => {
    if (!startStr || !endStr) return `${startStr} - ${endStr}`;
    const sParts = startStr.split('-');
    const eParts = endStr.split('-');
    if (sParts.length !== 3 || eParts.length !== 3) return `${startStr} to ${endStr}`;
    const sDay = sParts[2];
    const sMonth = sParts[1];
    const eDay = eParts[2];
    const eMonth = eParts[1];
    const sYr = sParts[0].slice(2);
    if (sMonth === eMonth && sParts[0] === eParts[0]) {
      return `${sDay}/${sMonth} - ${eDay}/${eMonth}/${sYr}`;
    }
    return `${sDay}/${sMonth}/${sYr} - ${eDay}/${eMonth}/${sYr}`;
  };

  const isBeforeOrOnApplicableDate = (dateStr: string) => {
    if (!dateStr) return true;
    return dateStr >= todayStr;
  };

  const getSeeButtonStyle = (status: string) => {
    if (status === 'approved') {
      return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300';
    }
    if (status === 'rejected') {
      return 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300';
    }
    return 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300';
  };

  // Helper Rules Checkers:
  // 1. User Can Edit/Delete: Allowed for applicant when pending and before applicable date, or Admin anytime
  const canUserModify = (od: OutdoorDutyRequest) => {
    if (isAdmin) return true;
    if (od.status !== 'pending') return false;
    if (od.userId !== currentUser.id) return false;
    if (!isBeforeOrOnApplicableDate(od.startDate)) return false; // Only before applicable date
    return true;
  };

  // 2. Manager Can Approve / Reject: Admin (any pending), or Reporting Manager (for subordinates / assigned pending requests)
  const canManagerAction = (od: OutdoorDutyRequest) => {
    if (od.status !== 'pending') return false;
    if (isReviewingManager) return false; // Reviewing Manager is strictly view-only
    if (isAdmin || currentUser.baseRole === 'administrator') {
      if (od.userId === currentUser.id && currentUser.role !== 'administrator') return false; // Cannot approve own request
      return true;
    }
    if (isReportingManager || isReportingManagerOrPI || currentUser.role === 'reporting_manager') {
      if (od.userId === currentUser.id) return false; // Cannot approve own request
      const reqUser = usersMap.get(od.userId);
      const mgrId = od.reportingManagerId || reqUser?.reportingManagerId;
      return (
        mgrId === currentUser.id ||
        !mgrId ||
        reqUser?.piName === currentUser.name ||
        reqUser?.hodName === currentUser.name ||
        users.some((u) => u.id === od.userId && u.reportingManagerId === currentUser.id) ||
        accessibleUserIds.includes(od.userId)
      );
    }
    return false;
  };

  // 3. Manager Can Cancel Approved Record: Reporting Manager or Admin can revoke/cancel approved OD before applicable date
  const canManagerCancelApproval = (od: OutdoorDutyRequest) => {
    if (od.status !== 'approved') return false;
    if (isReviewingManager) return false; // Reviewing Manager view-only
    if (isAdmin || currentUser.baseRole === 'administrator') {
      if (od.userId === currentUser.id && currentUser.role !== 'administrator') return false;
      return true;
    }
    if (!isBeforeOrOnApplicableDate(od.startDate)) return false; // Approved record can be cancelled before applicable date
    if (isReportingManager || isReportingManagerOrPI || currentUser.role === 'reporting_manager') {
      if (od.userId === currentUser.id) return false;
      const reqUser = usersMap.get(od.userId);
      const mgrId = od.reportingManagerId || reqUser?.reportingManagerId;
      return (
        mgrId === currentUser.id ||
        !mgrId ||
        reqUser?.piName === currentUser.name ||
        reqUser?.hodName === currentUser.name ||
        users.some((u) => u.id === od.userId && u.reportingManagerId === currentUser.id) ||
        accessibleUserIds.includes(od.userId)
      );
    }
    return false;
  };

  // Open Form Modal
  const handleOpenApplyModal = (odToEdit?: OutdoorDutyRequest) => {
    if (!canApplyOd && !odToEdit && !isAdmin) return;
    setFormError('');
    if (odToEdit) {
      setEditingOd(odToEdit);
      setFormUserId(odToEdit.userId);
      setFormStartDate(odToEdit.startDate);
      setFormEndDate(odToEdit.endDate);
      setFormStartTime(odToEdit.startTime || '09:00');
      setFormEndTime(odToEdit.endTime || '17:30');
      setFormOdType(odToEdit.odType || 'Domestic');
      setFormLocation(odToEdit.location);
      setFormEstimatedFunds(odToEdit.estimatedFunds || 0);
      setFormFundingSource(odToEdit.fundingSource || 'Institutional Travel Fund');
      setFormPurpose(odToEdit.purpose);
    } else {
      setEditingOd(null);
      setFormUserId(isAdmin ? '' : currentUser.id);
      setFormStartDate('');
      setFormEndDate('');
      setFormStartTime('09:00');
      setFormEndTime('17:30');
      setFormOdType('Domestic');
      setFormLocation('');
      setFormEstimatedFunds(0);
      setFormFundingSource('Institutional Travel Fund');
      setFormPurpose('');
    }
    setShowApplyModal(true);
  };

  // Submit Form
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (isAdmin && !formUserId) {
      setFormError('Please select an employee.');
      return;
    }

    if (!formStartDate || !formEndDate || !formLocation.trim() || !formPurpose.trim()) {
      setFormError('Please fill in all mandatory fields marked with *');
      return;
    }

    if (formStartDate > formEndDate) {
      setFormError('Start date cannot be later than end date.');
      return;
    }

    if (formStartDate === formEndDate && formStartTime >= formEndTime) {
      setFormError('End time must be later than start time for single-day OD.');
      return;
    }

    const targetUid = isAdmin ? formUserId : currentUser.id;
    const overlappingOd = odRequests.find((od) => {
      if (od.userId !== targetUid) return false;
      if (editingOd && od.id === editingOd.id) return false;
      if (od.status !== 'pending' && od.status !== 'approved') return false;
      return formStartDate <= od.endDate && formEndDate >= od.startDate;
    });
    if (overlappingOd) {
      setFormError('Outdoor Duty request already pending or approved for these dates. Only unapplied or rejected dates can be applied.');
      return;
    }

    if (editingOd) {
      const res = editOutdoorDuty(editingOd.id, {
        startDate: formStartDate,
        endDate: formEndDate,
        startTime: formStartTime,
        endTime: formEndTime,
        odType: formOdType,
        location: formLocation,
        estimatedFunds: Number(formEstimatedFunds) || 0,
        fundingSource: formFundingSource,
        purpose: formPurpose
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      showToast(res.message, 'success');
    } else {
      const res = applyOutdoorDuty({
        startDate: formStartDate,
        endDate: formEndDate,
        startTime: formStartTime,
        endTime: formEndTime,
        odType: formOdType,
        location: formLocation,
        estimatedFunds: Number(formEstimatedFunds) || 0,
        fundingSource: formFundingSource,
        purpose: formPurpose,
        targetUserId: isAdmin ? formUserId : currentUser.id
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      showToast(res.message, 'success');

      // Ensure newly created OD is visible within the date filter window
      if (formStartDate && formStartDate < filterStartDate) {
        setFilterStartDate(formStartDate);
      }
      if (formEndDate && formEndDate > filterEndDate) {
        setFilterEndDate(formEndDate);
      }
    }

    setShowApplyModal(false);
  };

  // Handle Delete Confirmation
  const confirmDeleteOD = () => {
    if (!deleteConfirmId) return;
    const res = deleteOutdoorDuty(deleteConfirmId);
    if (!res.success) {
      showToast(res.message, 'error');
    } else {
      showToast(res.message, 'success');
    }
    setDeleteConfirmId(null);
  };

  // Handle Manager Review Action (Approve / Reject)
  const handleManagerDecision = (action: 'approve' | 'reject') => {
    if (!actionModalOd) return;
    const comment = actionComments.trim() || (action === 'approve' ? 'Approved for official tour.' : 'Regret, OD request rejected.');
    const res = action === 'approve' ? approveOutdoorDuty(actionModalOd.id, comment) : rejectOutdoorDuty(actionModalOd.id, comment);

    if (res.success) {
      showToast(res.message, 'success');
      setActionModalOd(null);
      setActionComments('');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handle Cancel Approved OD Action
  const handleConfirmCancelApproval = () => {
    if (!cancelModalOd) return;
    const res = cancelApprovedOutdoorDuty(cancelModalOd.id, cancelReason);
    if (res.success) {
      showToast(res.message, 'success');
      setCancelModalOd(null);
      setCancelReason('');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Request ID',
      'Employee Name',
      'Department',
      'OD Type',
      'Start Date',
      'End Date',
      'Start Time',
      'End Time',
      'Days Count',
      'Location / Site',
      'Estimated Funds (INR)',
      'Funding Source',
      'Purpose & Agenda',
      'Status',
      'Applied Date',
      'Approver Comments',
      'Action By',
      'Action At'
    ];

    const rows = sortedODs.map((o) => [
      o.id,
      `"${o.userName}"`,
      `"${o.department}"`,
      o.odType || 'Domestic',
      o.startDate,
      o.endDate,
      o.startTime || '09:00',
      o.endTime || '17:30',
      o.daysCount,
      `"${o.location}"`,
      o.estimatedFunds || 0,
      `"${o.fundingSource || '-'}"`,
      `"${(o.purpose || '').replace(/"/g, '""')}"`,
      (o.status || 'PENDING').toUpperCase(),
      o.appliedDate || o.startDate,
      `"${(o.approverComments || '-').replace(/"/g, '""')}"`,
      `"${o.actionBy || '-'}"`,
      o.actionAt || '-'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OD_Requisitions_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Outdoor Duty (OD) Requisitions Report', 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${sortedODs.length}`, 14, 21);
    doc.text(`Generated By: ${currentUser.name} (${currentUser.department})`, 14, 26);

    const tableHead = [[
      'Applicant Staff',
      'Type',
      'Period & Duration',
      'Timings',
      'Location / Site',
      'Est. Funds (₹)',
      'Funding Source',
      'Official Purpose',
      'Status'
    ]];

    const tableBody = sortedODs.map((o) => [
      `${o.userName}\n(${o.department})`,
      o.odType || 'Domestic',
      `${o.startDate} to ${o.endDate} (${o.daysCount} d)`,
      `${o.startTime || '09:00'} - ${o.endTime || '17:30'}`,
      o.location,
      `₹${(o.estimatedFunds || 0).toLocaleString()}`,
      o.fundingSource || 'N/A',
      o.purpose || '-',
      (o.status || 'pending').toUpperCase()
    ]);

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: 31,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`OD_Requisitions_${todayStr}.pdf`);
  };

  return (
    <div className="w-full min-w-0 space-y-6 animate-fade-in pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold animate-bounce transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        icon={Globe}
        title="Outdoor Duty (OD)"
        subtitle="Official tour, field duty & travel regularization requests"
        action={
          canApplyOd ? (
            <div className="flex items-center justify-end space-x-2 ml-auto">
              <button
                onClick={() => handleOpenApplyModal()}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ml-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Apply OD</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Summary Stat Metrics: Exactly 4 Uniform Cards matching Attendance theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Approved */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Approved</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{odStats.approved}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {filterStartDate === filterEndDate ? `Today (${formatDateAndDay(filterStartDate)})` : `${filterStartDate.split('-').reverse().join('/')} - ${filterEndDate.split('-').reverse().join('/')}`}
          </div>
        </div>

        {/* 2. Pending Approvals */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">Pending</p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{odStats.pending}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {filterStartDate === filterEndDate ? `Today (${formatDateAndDay(filterStartDate)})` : `${filterStartDate.split('-').reverse().join('/')} - ${filterEndDate.split('-').reverse().join('/')}`}
          </div>
        </div>

        {/* 3. Total OD Requisitions */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate" title="Total Requisitions">Total Applied</p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">{odStats.total}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <MapPin className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {filterStartDate === filterEndDate ? `Today (${formatDateAndDay(filterStartDate)})` : `${filterStartDate.split('-').reverse().join('/')} - ${filterEndDate.split('-').reverse().join('/')}`}
          </div>
        </div>

        {/* 4. Total OD Days */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate" title="Total OD Days">OD Days</p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">{odStats.totalDays}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {filterStartDate === filterEndDate ? `Today (${formatDateAndDay(filterStartDate)})` : `${filterStartDate.split('-').reverse().join('/')} - ${filterEndDate.split('-').reverse().join('/')}`}
          </div>
        </div>
      </div>

      {/* Main Filter & Search Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Top Bar: Clean Themed Date Pickers & Presets & Export Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3.5 border-b border-slate-100 pb-3">
          {/* Row 1 on mobile (Left on tab/desktop): Date Pickers & Presets */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
          </div>

          {/* Row 2 on mobile (Right on tab/desktop): Export Buttons (CSV & PDF) */}
          <div className="flex items-center justify-end space-x-2 shrink-0 w-full sm:w-auto ml-auto">
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

        {/* Row: Search box + Reset Filters (Icon Only) + View Mode Toggle in ONE Single Row */}
        <div className="flex items-center gap-2 w-full">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search staff, location, purpose, department, funding..."
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

          {/* Reset Filters (Only Icon - Appears ONLY when any filter or search query is active) */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/90 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Reset all search and filter selections"
            >
              <RotateCcw className="w-4 h-4 text-blue-600" />
            </button>
          )}

          {/* View Mode Toggle Switch */}
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

          {/* Third Row: Filter Dropdowns Uniform Flex Wrap */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap responsive-filter-row">
              {/* 1. Employee Filter */}
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

              {/* 2. Designation Filter */}
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

              {/* 3. Department Filter */}
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

              {/* 4. Reporting Manager Filter */}
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

              {/* 5. OD Type Filter */}
              <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="OD Type"
                  icon={<Globe className="w-3.5 h-3.5" />}
                  selectedValues={filterOdType}
                  onChange={setFilterOdType}
                  options={[
                    { label: 'Domestic', value: 'Domestic' },
                    { label: 'International', value: 'International' }
                  ]}
                />
              </div>

              {/* 6. Status Filter */}
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

      {/* Pending Manager Queue Alert Banner */}
      {(isReportingManager || isAdmin) && pendingManagerQueue.length > 0 && (
        <div className="bg-[#fefce8] border border-amber-300/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-amber-100/90 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950">
                Action Required: {pendingManagerQueue.length} Pending Outdoor Duty Requisition{pendingManagerQueue.length > 1 ? 's' : ''}
              </h3>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Staff members have submitted official tour / travel regularization requests awaiting your review and authorization.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
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
              Outdoors ({sortedODs.length})
            </span>
          </div>
        </div>

        {sortedODs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white space-y-2">
            <MapPin className="w-10 h-10 mx-auto text-indigo-300" />
            <p className="text-xs font-semibold">No Outdoor Duty requisitions match the active filters.</p>
            {canApplyOd && (
              <button
                onClick={() => handleOpenApplyModal()}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Click here to apply for Outdoor Duty
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedODs.map((od) => {
              const editable = canUserModify(od);
              const canAct = canManagerAction(od);
              const canCancel = canManagerCancelApproval(od);

              return (
                <div
                  key={od.id}
                  className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  {/* Top Header */}
                  <div className="flex items-center justify-between">
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-900 text-xs block truncate">{od.userName}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{od.department}</span>
                    </div>

                    <div className="shrink-0 text-right">
                      {od.status === 'approved' && (
                        <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Approved</span>
                        </span>
                      )}
                      {od.status === 'pending' && (
                        <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                          <span>Pending</span>
                        </span>
                      )}
                      {od.status === 'rejected' && (
                        <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Rejected</span>
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        by {od.actionBy || od.userName}
                      </span>
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="space-y-2 text-xs border-t border-slate-100 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{od.location}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                          od.odType === 'International'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        {od.odType || 'Domestic'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-600 font-medium text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {od.startDate} to {od.endDate} ({od.daysCount} d)
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-500 font-mono text-[10px]">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {od.startTime || '09:00'} - {od.endTime || '17:30'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-slate-400">Est. Funds:</span>
                      <div className="text-right">
                        <span className="font-bold font-mono text-slate-900">
                          ₹{(od.estimatedFunds || 0).toLocaleString()}
                        </span>
                        {od.fundingSource && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                            {od.fundingSource}
                          </span>
                        )}
                      </div>
                    </div>

                    {od.purpose && (
                      <p className="text-slate-600 italic text-[11px] line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100 mt-1">
                        "{od.purpose}"
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Applied: {od.appliedDate || od.startDate}</span>
                    <div className="flex items-center space-x-1.5">
                      {/* View Details / See Button */}
                      <button
                        onClick={() => setDetailModalOd(od)}
                        className={`w-8 h-8 flex items-center justify-center border rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 ${getSeeButtonStyle(od.status)}`}
                        title="View Full Details"
                      >
                        <Eye className="w-4 h-4 stroke-[2]" />
                      </button>

                      {/* Edit Button (Applicant User or Admin) */}
                      {editable && (
                        <button
                          onClick={() => handleOpenApplyModal(od)}
                          className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                          title="Edit Requisition"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600 stroke-[2]" />
                        </button>
                      )}

                      {/* Delete Button (Applicant User or Admin) */}
                      {editable && (
                        <button
                          onClick={() => setDeleteConfirmId(od.id)}
                          className="w-8 h-8 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                          title="Delete Requisition"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600 stroke-[2]" />
                        </button>
                      )}

                      {/* Approve / Reject Action Buttons for Pending (RM & Admin) */}
                      {(isReportingManager || isAdmin) && canAct && (
                        <>
                          <button
                            onClick={() => {
                              setActionModalOd(od);
                              setActionComments('');
                            }}
                            className="w-8 h-8 flex items-center justify-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="Approve Requisition"
                          >
                            <Check className="w-4 h-4 text-emerald-600 stroke-[2]" />
                          </button>
                          <button
                            onClick={() => {
                              setActionModalOd(od);
                              setActionComments('');
                            }}
                            className="w-8 h-8 flex items-center justify-center text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="Reject Requisition"
                          >
                            <X className="w-4 h-4 text-rose-600 stroke-[2]" />
                          </button>
                        </>
                      )}

                      {/* Cancel Approved OD Button (RM & Admin) */}
                      {(isReportingManager || isAdmin) && canCancel && (
                        <button
                          onClick={() => {
                            setCancelModalOd(od);
                            setCancelReason('');
                          }}
                          className="w-8 h-8 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                          title="Cancel / Revoke Approved OD"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View - Uniform Theme Width & Proportional Grid */
          <div className="w-full min-w-0 overflow-x-auto custom-table-scrollbar pb-1">
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr className="h-10">
                  {/* Employee Column - Visible for Team/Manager/Admin */}
                  {canSeeTeamFilters && (
                    <th
                      onClick={() => handleSort('employee')}
                      className="py-2 px-2.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
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
                  )}

                  {/* Duration Column */}
                  <th
                    onClick={() => handleSort('dates')}
                    className="py-2 px-2 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Duration"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Duration</span>
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
                    className="py-2 px-2 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Applied Date"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Applied</span>
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

                  {/* Location Column */}
                  <th
                    onClick={() => handleSort('location')}
                    className="py-2 px-2 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Location"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Location</span>
                      {sortField === 'location' || sortField === 'type' ? (
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

                  {/* Purpose Column */}
                  <th
                    onClick={() => handleSort('purpose')}
                    className="py-2 px-2 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
                    title="Click to sort by Purpose"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Purpose</span>
                      {sortField === 'purpose' ? (
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
                    className="py-2 px-2 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle"
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
                {paginatedODs.map((od) => {
                  const editable = canUserModify(od);
                  const canAct = canManagerAction(od);
                  const canCancel = canManagerCancelApproval(od);
                  const reqUser = usersMap.get(od.userId);
                  const rmName =
                    od.reportingManagerName ||
                    (reqUser?.reportingManagerId ? usersMap.get(reqUser.reportingManagerId)?.name : undefined) ||
                    (reqUser as any)?.reportingManagerName ||
                    (od.userId === 'usr-admin-1' ? 'Director / Admin' : undefined);
                  const isLongPurpose = (od.purpose || '').length > 22;

                  return (
                    <tr key={od.id} className="hover:bg-slate-50 transition-colors">
                      {/* Employee Column - Visible for Team/Manager/Admin */}
                      {canSeeTeamFilters && (
                        <td className="py-2 px-2 align-middle">
                          <div className="flex items-center space-x-2 min-w-0 max-w-[110px] sm:max-w-[130px]">
                            <img
                              src={reqUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                              alt={od.userName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-900 block truncate text-xs">{od.userName}</span>
                              <span className="text-[10px] text-slate-500 font-medium block truncate">
                                {reqUser?.designation || 'Staff'}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Duration */}
                      <td className="py-2 px-2 whitespace-nowrap align-middle">
                        <div className="font-bold text-slate-900 flex items-center space-x-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span>
                            {formatCompactDateRange(od.startDate, od.endDate)}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{od.startTime || '09:00'}-{od.endTime || '17:30'} ({od.daysCount}d)</span>
                        </div>
                      </td>

                      {/* Applied Date */}
                      <td className="py-2 px-2 whitespace-nowrap align-middle text-slate-700 text-[11px]">
                        <div className="flex items-center space-x-1 text-slate-600">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-medium">{od.appliedDate || od.startDate}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-2 px-2 align-middle">
                        <div className="flex items-center space-x-1 min-w-0 max-w-[85px] sm:max-w-[105px]">
                          <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-800 text-xs truncate" title={od.location}>
                            {od.location}
                          </span>
                        </div>
                        <div>
                          <span
                            className={`px-1 py-0.1 rounded text-[9px] font-bold inline-block border ${
                              od.odType === 'International'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {od.odType || 'Domestic'}
                          </span>
                        </div>
                      </td>

                      {/* Purpose with View More */}
                      <td className="py-2 px-2 align-middle">
                        <div className="flex items-center justify-between gap-0.5 max-w-[85px] sm:max-w-[105px]">
                          <span className="text-slate-700 text-xs truncate flex-1 min-w-0 font-medium italic" title={od.purpose}>
                            "{od.purpose}"
                          </span>
                          {isLongPurpose && (
                            <button
                              onClick={() =>
                                setActivePurposeModal({
                                  employeeName: reqUser?.name || od.userName || od.userId,
                                  duration: `${od.startDate} to ${od.endDate} (${od.daysCount} d)`,
                                  location: od.location,
                                  purpose: od.purpose
                                })
                              }
                              className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center cursor-pointer shrink-0 text-[9.5px] hover:underline"
                              title="View full purpose"
                            >
                              <span>More</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        {od.status === 'approved' && (
                          <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Approved</span>
                          </span>
                        )}
                        {od.status === 'pending' && (
                          <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                            <span>Pending</span>
                          </span>
                        )}
                        {od.status === 'rejected' && (
                          <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Rejected</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                          by {od.actionBy || od.userName}
                        </span>
                      </td>

                      {/* Actions: Uniform 28x28px */}
                      <td className="py-2.5 px-2.5 text-right whitespace-nowrap align-middle">
                        <div className="flex items-center justify-end space-x-1">
                          {/* See Button */}
                          <button
                            onClick={() => setDetailModalOd(od)}
                            className={`w-7 h-7 flex items-center justify-center border rounded-lg transition-all cursor-pointer shadow-2xs ${getSeeButtonStyle(od.status)}`}
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit button (Applicant User or Admin) */}
                          {editable && (
                            <button
                              onClick={() => handleOpenApplyModal(od)}
                              className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                              title="Edit Requisition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete button (Applicant User or Admin) */}
                          {editable && (
                            <button
                              onClick={() => setDeleteConfirmId(od.id)}
                              className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                              title="Delete Requisition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Approve / Reject Action Buttons for Pending (RM & Admin) */}
                          {(isReportingManager || isAdmin) && canAct && (
                            <>
                              <button
                                onClick={() => {
                                  setActionModalOd(od);
                                  setActionComments('');
                                }}
                                className="w-7 h-7 flex items-center justify-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                                title="Approve Requisition"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setActionModalOd(od);
                                  setActionComments('');
                                }}
                                className="w-7 h-7 flex items-center justify-center text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                                title="Reject Requisition"
                              >
                                <X className="w-3.5 h-3.5 text-rose-600" />
                              </button>
                            </>
                          )}

                          {/* Cancel Approval Button for Approved Record (RM & Admin) */}
                          {(isReportingManager || isAdmin) && canCancel && (
                            <button
                              onClick={() => {
                                setCancelModalOd(od);
                                setCancelReason('');
                              }}
                              className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                              title="Cancel / Revoke Approved OD"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
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
        )}

        {/* Stable Full-Width Footer & Pagination (Fixed at bottom of card, outside horizontal scroll) */}
        <div className="w-full border-t border-slate-200/90 bg-white">
          <TablePagination
            currentPage={odPage}
            totalPages={Math.ceil(sortedODs.length / odPageSize)}
            totalItems={sortedODs.length}
            pageSize={odPageSize}
            onPageChange={setOdPage}
            onPageSizeChange={setOdPageSize}
          />
        </div>
      </div>

      {/* APPLY / EDIT OD MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md shrink-0">
                  <Globe className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-wide">
                    Outdoor Duty (OD)
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-3.5 max-h-[82vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Select Staff / Employee Dropdown for Admin */}
              {isAdmin && !editingOd && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee *
                  </label>
                  <AppSelect
                    value={formUserId}
                    onChange={(val) => setFormUserId(val)}
                    placeholder="-- Select Employee --"
                    options={[
                      { label: '-- Select Employee --', value: '' },
                      ...users
                        .filter((u) => u.id !== currentUser.id)
                        .map((u) => ({
                          label: u.name,
                          value: u.id,
                          description: `${u.designation || u.department || u.role} (${u.email})`
                        }))
                    ]}
                  />
                </div>
              )}

              {/* OD Type */}
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOdType('Domestic')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer text-xs ${
                      formOdType === 'Domestic'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Domestic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormOdType('International')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer text-xs ${
                      formOdType === 'International'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>International</span>
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <AppDatePicker
                  label="Start Date *"
                  value={formStartDate}
                  onChange={(dStr) => setFormStartDate(dStr)}
                />
                <AppDatePicker
                  label="End Date *"
                  value={formEndDate}
                  minDate={formStartDate}
                  onChange={(dStr) => setFormEndDate(dStr)}
                  isRightColumn={true}
                />
              </div>

              {/* Timings */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <AppTimePicker
                  label="Start Time"
                  required={true}
                  value={formStartTime}
                  onChange={(val) => setFormStartTime(val)}
                  presets={['08:00', '09:00', '09:30', '10:00']}
                />
                <AppTimePicker
                  label="End Time"
                  required={true}
                  value={formEndTime}
                  onChange={(val) => setFormEndTime(val)}
                  presets={['17:00', '17:30', '18:00', '19:00']}
                  align="right"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regional Field Lab, Dehradun / Stakeholder HQ, New Delhi"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Funds & Source */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 truncate">
                    Estimated Funds (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formEstimatedFunds}
                    onChange={(e) => setFormEstimatedFunds(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 truncate">
                    Budget Head
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CAMPA Project / Inst. Fund"
                    value={formFundingSource}
                    onChange={(e) => setFormFundingSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Purpose &amp; Agenda *
                </label>
                <textarea
                  rows={2}
                  placeholder="Detail the scientific, administrative or project purpose of this outdoor duty..."
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                  required
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{editingOd ? 'Update' : 'Submit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW & ACTION MODAL (APPROVE / REJECT) */}
      {actionModalOd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Review Outdoor Duty Requisition</h3>
                  <p className="text-[11px] text-slate-500">Approve or Reject as Reporting Officer</p>
                </div>
              </div>
              <button
                onClick={() => setActionModalOd(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Context Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-sm">{actionModalOd.userName}</span>
                  <span className="text-[10px] text-slate-500 font-medium">{actionModalOd.department}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    actionModalOd.odType === 'International'
                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {actionModalOd.odType || 'Domestic'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Tour Dates</span>
                  <span className="font-bold text-slate-800">
                    {actionModalOd.startDate} to {actionModalOd.endDate} ({actionModalOd.daysCount} d)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Location</span>
                  <span className="font-bold text-slate-800 truncate block" title={actionModalOd.location}>
                    {actionModalOd.location}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Purpose</span>
                <p className="text-slate-700 italic text-[11px] line-clamp-2">"{actionModalOd.purpose}"</p>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                <span className="text-slate-500">Est. Funds:</span>
                <span className="font-bold font-mono text-slate-900">
                  ₹{(actionModalOd.estimatedFunds || 0).toLocaleString()} ({actionModalOd.fundingSource || 'N/A'})
                </span>
              </div>
            </div>

            {/* Manager Remarks Input */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Manager Remarks / Instructions
              </label>
              <textarea
                rows={2}
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder="Optional notes or reasons for approval / rejection..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActionModalOd(null)}
                className="px-3.5 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleManagerDecision('reject')}
                className="px-4 py-2 font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs transition-all cursor-pointer flex items-center space-x-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={() => handleManagerDecision('approve')}
                className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs shadow-2xs transition-all cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL APPROVED OD MODAL POPUP */}
      {cancelModalOd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Cancel Approved Outdoor Duty</h3>
                  <p className="text-[11px] text-slate-500">Revoke duty approval &amp; revert attendance</p>
                </div>
              </div>
              <button
                onClick={() => setCancelModalOd(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs space-y-1">
              <div className="flex items-center space-x-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Are you sure you want to cancel this approved OD?</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed pl-6">
                Cancelling this approved Outdoor Duty will set the record to Rejected and automatically revert the attendance status for the OD dates.
              </p>
            </div>

            {/* Request Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Staff Member:</span>
                <span className="font-bold text-slate-900">{cancelModalOd.userName} ({cancelModalOd.department})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">OD Dates:</span>
                <span className="font-bold text-slate-900">{cancelModalOd.startDate} to {cancelModalOd.endDate} ({cancelModalOd.daysCount} d)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="font-semibold text-slate-900">{cancelModalOd.location}</span>
              </div>
            </div>

            {/* Cancellation Reason */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Reason for Cancellation <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="State the official reason for cancelling this approved OD..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-rose-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setCancelModalOd(null)}
                className="px-3.5 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Keep Approved
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelApproval}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl text-xs shadow-2xs transition-all cursor-pointer flex items-center space-x-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Requisition</h3>
                <p className="text-[11px] text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this pending Outdoor Duty requisition?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteOD}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {detailModalOd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Outdoor Duty Overview</h3>
                <span className="text-[10px] font-mono text-slate-400">ID: {detailModalOd.id}</span>
              </div>
              <button
                onClick={() => setDetailModalOd(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-900 block text-sm">{detailModalOd.userName}</span>
                  <span className="text-[11px] text-slate-500">{detailModalOd.department}</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider ${
                    detailModalOd.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : detailModalOd.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {detailModalOd.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">OD Type</span>
                  <span className="font-bold text-slate-800">{detailModalOd.odType || 'Domestic'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Location / Site</span>
                  <span className="font-bold text-slate-800">{detailModalOd.location}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Dates</span>
                  <span className="font-bold text-slate-800">
                    {detailModalOd.startDate} to {detailModalOd.endDate} ({detailModalOd.daysCount} d)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Timings</span>
                  <span className="font-mono font-bold text-slate-800">
                    ⏰ {detailModalOd.startTime || '09:00'} - {detailModalOd.endTime || '17:30'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Est. Funds</span>
                  <span className="font-mono font-bold text-emerald-800">
                    ₹{(detailModalOd.estimatedFunds || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Budget Head</span>
                  <span className="font-semibold text-slate-800">{detailModalOd.fundingSource || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Purpose &amp; Agenda</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 italic">
                  "{detailModalOd.purpose}"
                </p>
              </div>

              {detailModalOd.approverComments && (
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3">
                  <span className="text-[10px] text-blue-700 font-bold uppercase block mb-0.5">Manager Action Notes</span>
                  <p className="text-blue-900 font-medium">"{detailModalOd.approverComments}"</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              {detailModalOd.status === 'pending' && canManagerAction(detailModalOd) && (
                <>
                  <button
                    onClick={() => {
                      const target = detailModalOd;
                      setDetailModalOd(null);
                      setActionModalOd(target);
                      setActionComments('');
                    }}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => {
                      const target = detailModalOd;
                      setDetailModalOd(null);
                      setActionModalOd(target);
                      setActionComments('');
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setDetailModalOd(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purpose Modal for Reading Full OD Purpose */}
      {activePurposeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Outdoor Duty Purpose &amp; Agenda</h3>
                <p className="text-xs text-slate-500">
                  {activePurposeModal.employeeName} • {activePurposeModal.location} • {activePurposeModal.duration}
                </p>
              </div>
              <button
                onClick={() => setActivePurposeModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
              "{activePurposeModal.purpose}"
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActivePurposeModal(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
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
