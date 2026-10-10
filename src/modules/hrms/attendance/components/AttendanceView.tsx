import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { AttendanceRecord, AttendanceStatus, Shift } from '../../../../types';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { TablePagination } from '../../../../shared/components/TablePagination';
import { generateTodayAttendanceRecords } from '../../data/hrmsSeedData';
import {
  getNormalizedStatusCode,
  getStatusLabel,
  ATTENDANCE_STATUS_MAP,
  ALL_STATUS_CODES,
  formatTo24H
} from '../utils/attendanceUtils';
import {
  Clock,
  Calendar,
  Search,
  Filter,
  Download,
  FileText,
  Building,
  Briefcase,
  Layers,
  GraduationCap,
  User as UserIcon,
  UserCheck,
  Eye,
  X,
  XCircle,
  CheckCircle2,
  AlertCircle,
  MapPin,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const AttendanceView: React.FC = () => {
  const {
    currentUser,
    users,
    attendanceRecords,
    shifts,
    getUserShift,
    odRequests,
    leaveRequests,
    manualAttendanceRequests
  } = useApp();

  // Role Checks
  const isAdmin = currentUser.role === 'administrator';
  const isReportingManager = currentUser.role === 'reporting_manager';
  const isReviewingManager = currentUser.role === 'reviewing_manager';
  const isManager = isReportingManager || isReviewingManager;

  // Accessible Users list based on Role
  // Admin: All users
  // Manager: Team members reporting/reviewing under currentUser + currentUser
  // Employee: Only currentUser
  const accessibleUsers = React.useMemo(() => {
    if (isAdmin) {
      return users;
    }
    if (isManager) {
      return users.filter(
        (u) =>
          u.id === currentUser.id ||
          u.reportingManagerId === currentUser.id ||
          u.reviewingManagerId === currentUser.id
      );
    }
    return users.filter((u) => u.id === currentUser.id);
  }, [currentUser, users, isAdmin, isManager]);

  const accessibleUserIds = React.useMemo(() => accessibleUsers.map((u) => u.id), [accessibleUsers]);

  // Display View Mode: 'table' (Row View) or 'grid' (Calendar/Grid Card View)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Current date (today) YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Default Dates:
  // For Reporting Manager, HoD (Reviewing Manager), and Administrator: by default show current date's attendance
  // For General Staff: default to full month range
  const isManagerOrAdmin = isAdmin || isReportingManager || isReviewingManager;
  const DEFAULT_START_DATE = isManagerOrAdmin ? todayStr : '2026-08-01';
  const DEFAULT_END_DATE = isManagerOrAdmin ? todayStr : '2026-09-30';

  const [startDate, setStartDate] = useState<string>(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState<string>(DEFAULT_END_DATE);

  // Role Visibility Matrix Flags (per specification table)
  // 1. General (Staff): Status filter only
  // 2. Reporting Manager / PI (if non-permanent): Employee, Designation, Department, Type, Status
  // 3. Reviewing Manager & Admin: Employee, Designation, Department, Reporting Manager, Type, Status
  const isNonPermanentPI = currentUser.employmentType !== 'permanent' && (Boolean(currentUser.piName) || accessibleUsers.length > 1);
  const isReportingManagerOrPI = isReportingManager || isNonPermanentPI;

  const canSeeReportingManagerFilter = isAdmin || isReviewingManager;
  const canSeeTeamFilters = isAdmin || isReviewingManager || isReportingManagerOrPI;

  // User (General Staff) role check: Shift column is removed ONLY for user role
  const isUserRole = currentUser.role === 'general_staff';
  const showShiftColumn = !isUserRole;

  // Search & Filter States (Multi-select supported)
  const [selectedUserFilter, setSelectedUserFilter] = useState<string[]>(['all']);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string[]>(['all']);
  const [selectedPostFilter, setSelectedPostFilter] = useState<string[]>(['all']);
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string[]>(['all']);
  const [selectedRepManagerFilter, setSelectedRepManagerFilter] = useState<string[]>(['all']);
  const [selectedEmpTypeFilter, setSelectedEmpTypeFilter] = useState<string[]>(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string[]>(['all']);

  // Check if any filter or search query is currently active
  const hasActiveFilters = Boolean(
    searchTerm.trim() !== '' ||
    startDate !== DEFAULT_START_DATE ||
    endDate !== DEFAULT_END_DATE ||
    (!selectedStatusFilter.includes('all') && selectedStatusFilter.length > 0) ||
    (!selectedShiftFilter.includes('all') && selectedShiftFilter.length > 0) ||
    (!selectedUserFilter.includes('all') && selectedUserFilter.length > 0) ||
    (!selectedDeptFilter.includes('all') && selectedDeptFilter.length > 0) ||
    (!selectedPostFilter.includes('all') && selectedPostFilter.length > 0) ||
    (!selectedRepManagerFilter.includes('all') && selectedRepManagerFilter.length > 0) ||
    (!selectedEmpTypeFilter.includes('all') && selectedEmpTypeFilter.length > 0)
  );

  // Derived Filter Dropdown Option Lists
  const departmentList = React.useMemo(() => {
    const depts = new Set<string>();
    accessibleUsers.forEach((u) => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts).sort();
  }, [accessibleUsers]);

  const designationList = React.useMemo(() => {
    const posts = new Set<string>();
    accessibleUsers.forEach((u) => {
      if (u.designation) posts.add(u.designation);
    });
    return Array.from(posts).sort();
  }, [accessibleUsers]);

  const reportingManagerList = React.useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.role === 'reporting_manager' || u.role === 'reviewing_manager' || u.role === 'administrator') {
        map.set(u.id, u.name);
      }
    });
    users.forEach((u) => {
      if (u.reportingManagerId) {
        const mgr = users.find((m) => m.id === u.reportingManagerId);
        if (mgr) {
          map.set(mgr.id, mgr.name);
        }
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Remark Modal
  const [activeRemarkModal, setActiveRemarkModal] = useState<{
    dateAndDay: string;
    employeeName: string;
    remark: string;
  } | null>(null);

  // Shift Inspector Modal
  const [activeShiftModal, setActiveShiftModal] = useState<{
    dateAndDay: string;
    employeeName: string;
    employeeDesignation?: string;
    employeeDept?: string;
    shift: Shift;
    clockIn?: string;
    clockOut?: string;
    totalHours?: number;
    status: string;
    remark?: string;
  } | null>(null);

  // Quick Preset Handlers
  const handlePresetCurrentMonth = () => {
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
  };

  const handleResetFilters = () => {
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
    setSearchTerm('');
    setSelectedStatusFilter(['all']);
    setSelectedShiftFilter(['all']);
    setSelectedUserFilter(['all']);
    setSelectedDeptFilter(['all']);
    setSelectedPostFilter(['all']);
    setSelectedRepManagerFilter(['all']);
    setSelectedEmpTypeFilter(['all']);
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

  // Ensure attendance records exist for todayStr for all users so managers/admins immediately see their staff logs
  const effectiveAttendanceRecords = useMemo(() => {
    if (attendanceRecords.some((r) => r.date === todayStr)) {
      return attendanceRecords;
    }
    const todayRecords = generateTodayAttendanceRecords(users as any, todayStr);
    return [...attendanceRecords, ...todayRecords];
  }, [attendanceRecords, todayStr, users]);

  // Apply Role Scope, Employee, Department, Designation, Reporting Manager, Type & Status Filters
  const filteredRecords = effectiveAttendanceRecords.filter((rec) => {
    // 1. Accessibility Check based on Role
    if (!accessibleUserIds.includes(rec.userId)) return false;

    const userObj = users.find((u) => u.id === rec.userId);

    // Team Filters apply if user is Reporting Manager / PI, Reviewing Manager, or Admin
    if (canSeeTeamFilters) {
      // 2. Employee Specific Filter
      if (!matchesMultiSelect(selectedUserFilter, rec.userId)) return false;

      // 3. Department Filter
      if (!matchesMultiSelect(selectedDeptFilter, userObj?.department)) return false;

      // 4. Post / Designation Filter
      if (!matchesMultiSelect(selectedPostFilter, userObj?.designation)) return false;

      // 5. Employment Type Filter
      if (!matchesMultiSelect(selectedEmpTypeFilter, userObj?.employmentType)) return false;
    }

    // 6. Reporting Manager Filter (Exclusively for Reviewing Manager & Admin)
    if (canSeeReportingManagerFilter) {
      if (!matchesMultiSelect(selectedRepManagerFilter, userObj?.reportingManagerId)) return false;
    }

    // 7. Date Range Match (blank startDate/endDate means no date restriction)
    const inDateRange = (!startDate || rec.date >= startDate) && (!endDate || rec.date <= endDate);
    if (!inDateRange) return false;

    // 8. Search Keyword Match
    const dateFormatted = formatDateAndDay(rec.date);
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      userObj?.name.toLowerCase().includes(searchLower) ||
      userObj?.department?.toLowerCase().includes(searchLower) ||
      userObj?.designation?.toLowerCase().includes(searchLower) ||
      rec.date.includes(searchLower) ||
      dateFormatted.toLowerCase().includes(searchLower) ||
      (rec.remark && rec.remark.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    // 9. Status Filter (For ALL roles, including General)
    const statusCode = getNormalizedStatusCode(rec.status);
    const matchesStatus =
      matchesMultiSelect(selectedStatusFilter, statusCode) ||
      matchesMultiSelect(selectedStatusFilter, rec.status);

    if (!matchesStatus) return false;

    // 10. Shift Filter
    const userShift = shifts.find((s) => s.code === rec.shiftCode) || getUserShift(rec.userId);
    const assignedShiftCode = rec.shiftCode || userShift?.code || 'GEN-01';
    const matchesShift = matchesMultiSelect(selectedShiftFilter, assignedShiftCode);

    return matchesShift;
  });

  // Table Column Sort State
  const [sortField, setSortField] = useState<'date' | 'employee' | 'reportingManager' | 'shift' | 'in' | 'out' | 'hours' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'date' | 'employee' | 'reportingManager' | 'shift' | 'in' | 'out' | 'hours' | 'status') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sort records dynamically by active sort field and order
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'date') {
      cmp = a.date.localeCompare(b.date);
    } else if (sortField === 'employee') {
      const userA = users.find((u) => u.id === a.userId)?.name || '';
      const userB = users.find((u) => u.id === b.userId)?.name || '';
      cmp = userA.localeCompare(userB);
    } else if (sortField === 'reportingManager') {
      const uA = users.find((u) => u.id === a.userId);
      const uB = users.find((u) => u.id === b.userId);
      const mgrA = uA?.reportingManagerId ? (users.find((m) => m.id === uA.reportingManagerId)?.name || '') : '';
      const mgrB = uB?.reportingManagerId ? (users.find((m) => m.id === uB.reportingManagerId)?.name || '') : '';
      cmp = mgrA.localeCompare(mgrB);
    } else if (sortField === 'shift') {
      cmp = (a.shiftCode || '').localeCompare(b.shiftCode || '');
    } else if (sortField === 'in') {
      cmp = (a.inTime || '').localeCompare(b.inTime || '');
    } else if (sortField === 'out') {
      cmp = (a.outTime || '').localeCompare(b.outTime || '');
    } else if (sortField === 'hours') {
      cmp = (a.totalHours || 0) - (b.totalHours || 0);
    } else if (sortField === 'status') {
      cmp = (a.status || '').localeCompare(b.status || '');
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const [attPage, setAttPage] = useState(1);
  const [attPageSize, setAttPageSize] = useState(25);

  const paginatedRecords = useMemo(() => {
    const start = (attPage - 1) * attPageSize;
    return sortedRecords.slice(start, start + attPageSize);
  }, [sortedRecords, attPage, attPageSize]);

  // Summary Metrics based on normalized codes
  const presentCount = sortedRecords.filter((r) => {
    const c = getNormalizedStatusCode(r.status);
    return c === 'PP' || c === 'PA' || c === 'AP';
  }).length;
  const absentCount = sortedRecords.filter((r) => getNormalizedStatusCode(r.status) === 'AA').length;
  const odCount = sortedRecords.filter((r) => getNormalizedStatusCode(r.status) === 'OD').length;
  const leaveCount = sortedRecords.filter((r) => getNormalizedStatusCode(r.status) === 'ST').length;

  // Resolves attendance status code, styling, and application tracking per specifications:
  // a. Present to green + PP
  // b. Half day / absent to red + AP / PA / AA
  // c. Weekend / holiday to Blue + WW / GH / approved RH
  // Application status: code + Yellow if pending, Red if rejected, Green/Blue if approved
  const resolveRecordStatusDisplay = (rec: AttendanceRecord) => {
    const matchingOD = odRequests.find(
      (od) => od.userId === rec.userId && rec.date >= od.startDate && rec.date <= od.endDate
    );
    const matchingManual = manualAttendanceRequests.find(
      (m) => m.userId === rec.userId && m.date === rec.date
    );
    const matchingLeave = leaveRequests.find(
      (lv) =>
        lv.userId === rec.userId &&
        rec.date >= lv.startDate &&
        rec.date <= lv.endDate &&
        lv.status !== 'cancelled'
    );

    // 1. Leave application present
    if (matchingLeave) {
      let code = 'LV';
      let typeLabel = 'Leave';
      const lt = matchingLeave.leaveType?.toLowerCase() || '';
      const ltName = matchingLeave.leaveTypeName?.toLowerCase() || '';

      if (lt === 'restricted' || ltName.includes('restricted')) {
        code = 'RH';
        typeLabel = 'RH';
      } else if (lt === 'station' || ltName.includes('station')) {
        code = 'ST';
        typeLabel = 'Station';
      } else if (lt === 'casual') {
        code = 'CL';
        typeLabel = 'Casual';
      } else if (lt === 'earned') {
        code = 'EL';
        typeLabel = 'Earned';
      } else if (lt === 'medical') {
        code = 'ML';
        typeLabel = 'Medical';
      } else if (lt === 'paternity') {
        code = 'PL';
        typeLabel = 'Paternity';
      } else if (lt === 'maternity') {
        code = 'MAT';
        typeLabel = 'Maternity';
      } else if (lt === 'lwp' || lt.includes('without')) {
        code = 'LW';
        typeLabel = 'LWP';
      } else {
        code = matchingLeave.leaveType?.toUpperCase() || 'LV';
        typeLabel = matchingLeave.leaveTypeName || 'Leave';
      }

      const isPending = matchingLeave.status?.startsWith('pending');
      const isRejected = matchingLeave.status === 'rejected';
      const isApproved = matchingLeave.status === 'approved';

      let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300';
      let tagStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';

      if (isPending) {
        badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300 font-black';
        tagStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      } else if (isRejected) {
        badgeStyle = 'bg-rose-50 text-rose-700 border-rose-300 font-black';
        tagStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      } else if (isApproved && code === 'RH') {
        badgeStyle = 'bg-blue-50 text-blue-700 border-blue-300 font-black';
        tagStyle = 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
      }

      const statusText = isPending ? 'Pending' : isRejected ? 'Rejected' : 'Approved';

      return {
        code,
        label: `${typeLabel} (${statusText})`,
        badgeStyle,
        appTag: {
          text: `${typeLabel}: ${statusText}`,
          style: tagStyle
        }
      };
    }

    // 2. OD application present
    if (matchingOD) {
      const isPending = matchingOD.status?.startsWith('pending');
      const isRejected = matchingOD.status === 'rejected';

      let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300';
      let tagStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';

      if (isPending) {
        badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300 font-black';
        tagStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      } else if (isRejected) {
        badgeStyle = 'bg-rose-50 text-rose-700 border-rose-300 font-black';
        tagStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      }

      const statusText = isPending ? 'Pending' : isRejected ? 'Rejected' : 'Approved';

      return {
        code: 'OD',
        label: `Outdoor Duty (${statusText})`,
        badgeStyle,
        appTag: {
          text: `OD: ${statusText}`,
          style: tagStyle
        }
      };
    }

    // 3. Manual attendance application present
    if (matchingManual) {
      const isPending = matchingManual.status?.startsWith('pending');
      const isRejected = matchingManual.status === 'rejected';

      let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300';
      let tagStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';

      if (isPending) {
        badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300 font-black';
        tagStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      } else if (isRejected) {
        badgeStyle = 'bg-rose-50 text-rose-700 border-rose-300 font-black';
        tagStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      }

      const statusText = isPending ? 'Pending' : isRejected ? 'Rejected' : 'Approved';

      return {
        code: 'PP',
        label: `Manual Attendance (${statusText})`,
        badgeStyle,
        appTag: {
          text: `Manual: ${statusText}`,
          style: tagStyle
        }
      };
    }

    // 4. Regular attendance records without application
    // a. Present -> Green + PP
    // b. Half day / Absent -> Red + AP / PA / AA
    // c. Weekend / Holiday -> Blue + WW / GH / approved RH
    const code = getNormalizedStatusCode(rec.status);
    const def = ATTENDANCE_STATUS_MAP[code] || ATTENDANCE_STATUS_MAP.PP;

    let badgeStyle = def.badgeStyle;
    if (code === 'PP') {
      badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    } else if (code === 'AP' || code === 'PA' || code === 'AA' || code === 'LW') {
      badgeStyle = 'bg-rose-50 text-rose-700 border-rose-300';
    } else if (code === 'WW' || code === 'WW#' || code === 'GH' || code === 'HH' || code === 'HH#' || code === 'RH') {
      badgeStyle = 'bg-blue-50 text-blue-700 border-blue-300';
    }

    return {
      code,
      label: def.label,
      badgeStyle,
      appTag: null
    };
  };

  // Status Badge Component: Strictly displays 2-character / short code
  const renderStatusBadge = (status: AttendanceStatus | string) => {
    const code = getNormalizedStatusCode(status);
    const def = ATTENDANCE_STATUS_MAP[code] || ATTENDANCE_STATUS_MAP.PP;

    let badgeStyle = def.badgeStyle;
    if (code === 'PP') {
      badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    } else if (code === 'AP' || code === 'PA' || code === 'AA' || code === 'LW') {
      badgeStyle = 'bg-rose-50 text-rose-700 border-rose-300';
    } else if (code === 'WW' || code === 'WW#' || code === 'GH' || code === 'HH' || code === 'HH#' || code === 'RH') {
      badgeStyle = 'bg-blue-50 text-blue-700 border-blue-300';
    }

    return (
      <span
        title={`${code} - ${def.label}`}
        className={`inline-flex items-center justify-center font-mono font-black px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border shadow-2xs min-w-[38px] text-center ${badgeStyle}`}
      >
        {code}
      </span>
    );
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      'S.No',
      'Date & Day',
      'Employee ID',
      'Employee Name',
      'Department',
      'Shift Code',
      'Shift Timings',
      'In Time (Biometric)',
      'Out Time (Biometric)',
      'Total Work Hours',
      'Attendance Status Code',
      'Status Description',
      'Biometric Terminal Remark / Notes'
    ];

    const rows = sortedRecords.map((rec, index) => {
      const u = users.find((usr) => usr.id === rec.userId);
      const userShift = shifts.find((s) => s.code === rec.shiftCode) || getUserShift(rec.userId);
      const dateAndDay = formatDateAndDay(rec.date);
      const code = getNormalizedStatusCode(rec.status);
      const label = getStatusLabel(code);
      return [
        index + 1,
        `"${dateAndDay}"`,
        `"${u?.id || ''}"`,
        `"${u?.name || rec.userId}"`,
        `"${u?.department || ''}"`,
        `"${rec.shiftCode || userShift?.code || 'GEN-01'}"`,
        `"${userShift ? `${userShift.startTime} - ${userShift.endTime}` : '-'}"`,
        `"${formatTo24H(rec.clockIn)}"`,
        `"${formatTo24H(rec.clockOut)}"`,
        rec.totalHours ? `${rec.totalHours} hrs` : '0 hrs',
        `"${code}"`,
        `"${label}"`,
        `"${(rec.remark || rec.notes || '-').replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Biometric_Attendance_${currentUser.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export Handler
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Title Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAMS 2.0 - Official Biometric Attendance Register', 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${new Date().toLocaleString()} | Source: Biometric Gate Sync Node`, 14, 18);

    // Meta Box
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 28, 269, 16, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 28, 269, 16, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Employee: ${currentUser.name} (${currentUser.designation})`, 18, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`Department: ${currentUser.department} | Emp ID: ${currentUser.id}`, 18, 40);

    doc.setFont('helvetica', 'bold');
    doc.text(`Report Period: ${formatDateAndDay(startDate)} to ${formatDateAndDay(endDate)}`, 160, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Records: ${sortedRecords.length} Days (Present: ${presentCount}, Absent: ${absentCount}, OD: ${odCount}, Station Leave: ${leaveCount})`, 160, 40);

    // Table
    const tableHead = [
      ['#', 'Date', 'Name', 'Shift', 'Timings', 'In Time', 'Out Time', 'Hours', 'Status', 'Biometric Remark']
    ];

    const tableData = sortedRecords.map((rec, index) => {
      const u = users.find((usr) => usr.id === rec.userId);
      const userShift = shifts.find((s) => s.code === rec.shiftCode) || getUserShift(rec.userId);
      const code = getNormalizedStatusCode(rec.status);
      return [
        index + 1,
        formatDateAndDay(rec.date),
        u?.name || rec.userId,
        rec.shiftCode || userShift?.code || 'GEN-01',
        userShift ? `${userShift.startTime}-${userShift.endTime}` : '-',
        formatTo24H(rec.clockIn),
        formatTo24H(rec.clockOut),
        rec.totalHours ? `${rec.totalHours} h` : '-',
        code,
        rec.remark || rec.notes || '-'
      ];
    });

    autoTable(doc, {
      startY: 48,
      head: tableHead,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 38 },
        2: { cellWidth: 38 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 18 },
        6: { cellWidth: 24 },
        7: { cellWidth: 'auto' }
      }
    });

    doc.save(`Attendance_Register_${currentUser.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="w-full min-w-0 space-y-6 pb-6">
      {/* Page Header Banner */}
      <PageHeader
        icon={Clock}
        title="Biometric Attendance Register"
        subtitle={
          isAdmin
            ? "Organization-wide biometric machine attendance records & employee log console"
            : isManager
            ? "Team biometric machine punch records & department attendance register"
            : "My daily biometric machine punch records & attendance logs"
        }
      />

      {/* Attendance Summary Stat Cards: Original 4 Cards placed immediately below PageHeader */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Present */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Present</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{presentCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {startDate === endDate ? `Today (${formatDateAndDay(startDate)})` : `${startDate.split('-').reverse().join('/')} - ${endDate.split('-').reverse().join('/')}`}
          </div>
        </div>

        {/* 2. Absent */}
        <div className="bg-rose-50/70 border border-rose-200/90 rounded-xl p-3.5 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 truncate">Absent</p>
              <p className="text-xl sm:text-2xl font-black text-rose-900 mt-0.5">{absentCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 border border-rose-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <XCircle className="w-4 h-4 text-rose-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-rose-200/60 text-[10px] sm:text-[11px] font-semibold text-rose-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {startDate === endDate ? `Today (${formatDateAndDay(startDate)})` : `${startDate.split('-').reverse().join('/')} - ${endDate.split('-').reverse().join('/')}`}
          </div>
        </div>

        {/* 3. Outdoor */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">Outdoor</p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">{odCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Building className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {startDate === endDate ? `Today (${formatDateAndDay(startDate)})` : `${startDate.split('-').reverse().join('/')} - ${endDate.split('-').reverse().join('/')}`}
          </div>
        </div>

        {/* 4. On Leave */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">On Leave</p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">{leaveCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {startDate === endDate ? `Today (${formatDateAndDay(startDate)})` : `${startDate.split('-').reverse().join('/')} - ${endDate.split('-').reverse().join('/')}`}
          </div>
        </div>
      </div>

      {/* Professional Date Range & Related Filters Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Top Bar: Clean Themed Date Pickers & Presets & Export Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3.5 border-b border-slate-100 pb-3">
          {/* Row 1 on mobile (Left on tab/desktop): Date Pickers & Presets */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5 flex-1 sm:flex-initial min-w-0">
              <div className="flex-1 sm:flex-initial min-w-0">
                <AppDatePicker
                  size="sm"
                  placeholder="From Date"
                  value={startDate}
                  onChange={(dStr) => setStartDate(dStr)}
                />
              </div>

              <span className="text-slate-300 font-bold shrink-0">—</span>

              <div className="flex-1 sm:flex-initial min-w-0">
                <AppDatePicker
                  size="sm"
                  placeholder="To Date"
                  value={endDate}
                  onChange={(dStr) => setEndDate(dStr)}
                  isRightColumn={true}
                />
              </div>
            </div>
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
                placeholder="Search employee, designation, date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full pl-9 pr-8 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
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
              {/* 1. Employee Dropdown (Reporting Manager / PI, Reviewing Manager, Admin) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Employee"
                    icon={<UserIcon className="w-3.5 h-3.5" />}
                    selectedValues={selectedUserFilter}
                    onChange={setSelectedUserFilter}
                    options={accessibleUsers.map((u) => ({ label: u.name, value: u.id }))}
                  />
                </div>
              )}

              {/* 2. Designation Filter (Reporting Manager / PI, Reviewing Manager, Admin) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Designation"
                    icon={<Briefcase className="w-3.5 h-3.5" />}
                    selectedValues={selectedPostFilter}
                    onChange={setSelectedPostFilter}
                    options={designationList.map((post) => ({ label: post, value: post }))}
                  />
                </div>
              )}

              {/* 3. Department Filter (Reporting Manager / PI, Reviewing Manager, Admin) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Department"
                    icon={<Building className="w-3.5 h-3.5" />}
                    selectedValues={selectedDeptFilter}
                    onChange={setSelectedDeptFilter}
                    options={departmentList.map((dept) => ({ label: dept, value: dept }))}
                  />
                </div>
              )}

              {/* 4. Shift Filter (Team/Manager/Admin Roles) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[95px] max-w-[125px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Shift"
                    icon={<Clock className="w-3.5 h-3.5" />}
                    selectedValues={selectedShiftFilter}
                    onChange={setSelectedShiftFilter}
                    options={shifts.map((s) => ({ label: s.code, value: s.code }))}
                  />
                </div>
              )}

              {/* 5. Reporting Manager Filter (Reviewing Manager & Administrator) */}
              {canSeeReportingManagerFilter && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Reporting Manager"
                    icon={<UserCheck className="w-3.5 h-3.5" />}
                    selectedValues={selectedRepManagerFilter}
                    onChange={setSelectedRepManagerFilter}
                    options={reportingManagerList.map((mgr) => ({ label: mgr.name, value: mgr.id }))}
                  />
                </div>
              )}

              {/* 6. Type (Employment Type) Filter (Reporting Manager / PI, Reviewing Manager, Admin) */}
              {canSeeTeamFilters && (
                <div className="flex-1 min-w-[125px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Employment Type"
                    icon={<Layers className="w-3.5 h-3.5" />}
                    selectedValues={selectedEmpTypeFilter}
                    onChange={setSelectedEmpTypeFilter}
                    options={[
                      { label: 'Permanent', value: 'permanent' },
                      { label: 'Contractual', value: 'contractual' },
                      { label: 'Researcher', value: 'researcher' },
                      { label: 'Trainee / Student', value: 'trainee_student' }
                    ]}
                  />
                </div>
              )}

              {/* 7. Status Filter (Available for ALL Roles) */}
              <div className="flex-1 min-w-[105px] max-w-[135px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="Status"
                  icon={<Filter className="w-3.5 h-3.5" />}
                  selectedValues={selectedStatusFilter}
                  onChange={setSelectedStatusFilter}
                  options={ALL_STATUS_CODES.map((item) => ({ label: `${item.code} - ${item.label}`, value: item.code }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Data Display (Table View vs Grid View) */}
      <div className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl shadow-2xs relative">
        {/* Table Title Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-3 min-h-[50px]">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Attendance Records ({sortedRecords.length})
            </span>
          </div>
        </div>

        {/* VIEW 1: ROW TABLE VIEW (Theme aligned layout) */}
        {viewMode === 'table' ? (
          <div className="w-full min-w-0 overflow-x-auto custom-table-scrollbar pb-1">
            <table className={`w-full text-left text-xs border-collapse ${canSeeTeamFilters ? 'min-w-[1080px]' : 'min-w-[640px]'}`}>
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px] shadow-2xs">
                <tr className="h-10">
                  <th
                    onClick={() => handleSort('date')}
                    className="py-3 px-4 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle min-w-[140px]"
                    title="Click to sort by Date"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date (Day)</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Employee Column - Shown ONLY for Team / Manager / Admin Views */}
                  {canSeeTeamFilters && (
                    <th
                      onClick={() => handleSort('employee')}
                      className="py-3 px-4 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle min-w-[210px]"
                      title="Click to sort by Employee"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Employee</span>
                        {sortField === 'employee' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* Shift Column - Shown for Manager / Admin / HoD, removed ONLY for User role */}
                  {showShiftColumn && (
                    <th
                      onClick={() => handleSort('shift')}
                      className="py-3 px-4 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle min-w-[130px]"
                      title="Click to sort by Shift"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Shift</span>
                        {sortField === 'shift' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0" />
                        )}
                      </div>
                    </th>
                  )}
                  <th
                    onClick={() => handleSort('in')}
                    className="py-3 px-3.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle min-w-[85px]"
                    title="Click to sort by In Time"
                  >
                    <div className="flex items-center space-x-1">
                      <span>In</span>
                      {sortField === 'in' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('out')}
                    className="py-3 px-3.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle min-w-[85px]"
                    title="Click to sort by Out Time"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Out</span>
                      {sortField === 'out' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('hours')}
                    className="py-3 px-3.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle min-w-[85px]"
                    title="Click to sort by Hours"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Hours</span>
                      {sortField === 'hours' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="py-3 px-4 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle min-w-[115px]"
                    title="Click to sort by Status"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {sortField === 'status' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap align-middle w-[200px] min-w-[200px] max-w-[200px]">
                    Remark
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5 + (canSeeTeamFilters ? 1 : 0) + (showShiftColumn ? 1 : 0)} className="text-center py-10 text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Clock className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">No attendance logs found for this date range.</p>
                        <button
                          onClick={handleResetFilters}
                          className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Reset filters to {isManagerOrAdmin ? 'today' : 'current month'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((rec) => {
                    const u = users.find((usr) => usr.id === rec.userId);
                    const dateAndDayFormatted = formatDateAndDay(rec.date);
                    const remarkText = rec.remark || rec.notes || '-';
                    const isLongRemark = remarkText.length > 35;

                    return (
                      <tr key={rec.id} className="hover:bg-indigo-50/40 transition-colors">
                        {/* 1. Date */}
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap text-xs min-w-[140px]">
                          {dateAndDayFormatted}
                        </td>

                        {/* 2. Employee Details (Only in Team/Manager/Admin views, hidden for General Staff) */}
                        {canSeeTeamFilters && (
                          <td className="py-3 px-4 min-w-[210px]">
                            <div className="flex items-start space-x-2.5 min-w-0">
                              <img src={u?.avatar} alt={u?.name} className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 mt-0.5 shadow-2xs" />
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-slate-900 block leading-tight truncate text-xs">{u?.name || rec.userId}</span>
                                <span className="text-[11px] text-slate-500 font-medium block leading-tight truncate mt-0.5">
                                  {u?.designation || 'Staff'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono tracking-tight block leading-tight mt-0.5">
                                  {u?.biometricId ? `Bio ID: ${u.biometricId}` : (rec.userId ? `Bio ID: ${rec.userId}` : 'Bio ID: N/A')}
                                </span>
                              </div>
                            </div>
                          </td>
                        )}

                        {/* 3. Shift Code & Timings (Removed ONLY for User role, visible for Manager/Admin/HoD - No tags/badges) */}
                        {showShiftColumn && (
                          <td className="py-3 px-4 whitespace-nowrap min-w-[130px]">
                            {(() => {
                              const userShift = shifts.find((s) => s.code === rec.shiftCode) || getUserShift(rec.userId);
                              const rawCode = rec.shiftCode || userShift.code || 'GEN-01';
                              const cleanCode = rawCode.split('(')[0].trim();
                              const formattedCode = cleanCode.includes('-') && !cleanCode.includes(' - ')
                                ? cleanCode.replace('-', ' - ')
                                : cleanCode;
                              return (
                                <div className="flex flex-col items-start text-left space-y-0.5">
                                  <span className="font-mono text-[11px] font-extrabold text-slate-800">
                                    {formattedCode}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono font-medium">
                                    {userShift.startTime} - {userShift.endTime}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                        )}

                        {/* 4. In */}
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap text-xs min-w-[85px]">
                          {formatTo24H(rec.clockIn)}
                        </td>

                        {/* 5. Out */}
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap text-xs min-w-[85px]">
                          {formatTo24H(rec.clockOut)}
                        </td>

                        {/* 6. Hours */}
                        <td className="py-3 px-3.5 font-mono text-slate-800 font-bold whitespace-nowrap text-xs min-w-[85px]">
                          {rec.totalHours ? `${rec.totalHours} hrs` : '-'}
                        </td>

                        {/* 7. Status Column (Role-based status rules & application code tracking) */}
                        <td className="py-3 px-4 whitespace-nowrap min-w-[115px]">
                          {(() => {
                            const statusInfo = resolveRecordStatusDisplay(rec);

                            return (
                              <div className="flex flex-col items-start space-y-1">
                                <span
                                  title={`${statusInfo.code} - ${statusInfo.label}`}
                                  className={`inline-flex items-center justify-center font-mono font-black px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border shadow-2xs min-w-[38px] text-center ${statusInfo.badgeStyle}`}
                                >
                                  {statusInfo.code}
                                </span>

                                {statusInfo.appTag && (
                                  <span
                                    className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded border leading-none tracking-tight font-extrabold ${statusInfo.appTag.style}`}
                                  >
                                    {statusInfo.appTag.text}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* 8. Remark Column - Perfectly uniform width across all rows */}
                        <td className="py-3 px-4 text-slate-700 text-xs w-[200px] min-w-[200px] max-w-[200px]">
                          <div className="w-[170px] max-w-[170px] flex items-center justify-between gap-1.5">
                            <span className="truncate text-xs text-slate-700 font-medium flex-1 min-w-0" title={remarkText}>
                              {remarkText}
                            </span>
                            {isLongRemark && (
                              <button
                                onClick={() =>
                                  setActiveRemarkModal({
                                    dateAndDay: dateAndDayFormatted,
                                    employeeName: u?.name || rec.userId,
                                    remark: remarkText
                                  })
                                }
                                className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center space-x-0.5 cursor-pointer shrink-0 ml-0.5 text-[10px] hover:underline"
                                title="View full remark"
                              >
                                <span>More</span>
                                <Eye className="w-2.5 h-2.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* VIEW 2: GRID / CALENDAR CARD VIEW (Minimal cards layout) */
          <div className="p-4 bg-slate-50/50">
            {sortedRecords.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No attendance logs found for this date range.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sortedRecords.map((rec) => {
                  const u = users.find((usr) => usr.id === rec.userId);
                  const dateAndDayFormatted = formatDateAndDay(rec.date);
                  const remarkText = rec.remark || rec.notes || '-';
                  const isLongRemark = remarkText.length > 35;

                  return (
                    <div
                      key={rec.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-2.5"
                    >
                      {/* Top: Date & Status */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-900 text-xs mt-0.5">{dateAndDayFormatted}</span>
                        {(() => {
                          const statusInfo = resolveRecordStatusDisplay(rec);

                          return (
                            <div className="flex flex-col items-end space-y-1">
                              <span
                                title={`${statusInfo.code} - ${statusInfo.label}`}
                                className={`inline-flex items-center justify-center font-mono font-black px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border shadow-2xs min-w-[38px] text-center ${statusInfo.badgeStyle}`}
                              >
                                {statusInfo.code}
                              </span>

                              {statusInfo.appTag && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded border leading-none tracking-tight font-extrabold ${statusInfo.appTag.style}`}
                                >
                                  {statusInfo.appTag.text}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Middle: Minimal Punch Time Info */}
                      <div className="space-y-1 text-xs">
                        {(isAdmin || isManager) && (
                          <div className="flex items-start space-x-1.5 text-slate-700 font-semibold mb-1 pb-1 border-b border-slate-100">
                            <img src={u?.avatar} alt={u?.name} className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <span className="truncate text-[11px] font-bold text-slate-900 block leading-tight">{u?.name}</span>
                              {u?.designation && (
                                <span className="text-[10px] text-slate-500 font-normal block leading-tight truncate">
                                  {u.designation}
                                </span>
                              )}
                              {u?.reportingManagerId && (
                                <span className="text-[10px] text-indigo-600 font-semibold block leading-tight truncate">
                                  RM: {users.find((m) => m.id === u.reportingManagerId)?.name}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {showShiftColumn && (() => {
                          const userShift = shifts.find((s) => s.code === rec.shiftCode) || getUserShift(rec.userId);
                          const rawCode = rec.shiftCode || userShift.code || 'GEN-01';
                          const cleanCode = rawCode.split('(')[0].trim();
                          const formattedCode = cleanCode.includes('-') && !cleanCode.includes(' - ') ? cleanCode.replace('-', ' - ') : cleanCode;
                          return (
                            <div className="flex justify-between items-center text-slate-600 text-[11px]">
                              <span>Shift:</span>
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                                {formattedCode}
                              </span>
                            </div>
                          );
                        })()}

                        <div className="flex justify-between items-center text-slate-600 text-[11px]">
                          <span>In / Out:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatTo24H(rec.clockIn)} - {formatTo24H(rec.clockOut)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-slate-600 text-[11px]">
                          <span>Duration:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {rec.totalHours ? `${rec.totalHours} hrs` : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom: Minimal Remark - uniform width across cards */}
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-1.5 w-full">
                        <span className="font-semibold text-slate-400 shrink-0">Remark:</span>
                        <div className="flex-1 min-w-0 flex items-center justify-end gap-1">
                          <span className="truncate text-right text-slate-700 font-medium text-[11px] flex-1 min-w-0" title={remarkText}>
                            {remarkText}
                          </span>
                          {isLongRemark && (
                            <button
                              onClick={() =>
                                setActiveRemarkModal({
                                  dateAndDay: dateAndDayFormatted,
                                  employeeName: u?.name || rec.userId,
                                  remark: remarkText
                                })
                              }
                              className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center space-x-0.5 ml-0.5 cursor-pointer shrink-0 text-[10px] hover:underline"
                              title="View full remark"
                            >
                              <span>More</span>
                              <Eye className="w-2.5 h-2.5 shrink-0" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stable Full-Width Footer & Pagination (Fixed at bottom of card, outside horizontal scroll) */}
        <div className="w-full border-t border-slate-200/90 bg-white rounded-b-2xl">
          <TablePagination
            currentPage={attPage}
            totalPages={Math.ceil(sortedRecords.length / attPageSize)}
            totalItems={sortedRecords.length}
            pageSize={attPageSize}
            onPageChange={setAttPage}
            onPageSizeChange={setAttPageSize}
          />
        </div>
      </div>

      {/* Remark Modal for Reading Full Long Remarks */}
      {activeRemarkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <FileText className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">Full Biometric Punch Remark</h3>
              </div>
              <button
                onClick={() => setActiveRemarkModal(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-800 leading-relaxed font-sans">
              {activeRemarkModal.remark}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveRemarkModal(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Shift Inspector Modal */}
      {activeShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <Clock className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Shift Timing &amp; Attendance Evaluation
                </h3>
              </div>
              <button
                onClick={() => setActiveShiftModal(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">

            {/* Shift Rules Definition */}
            <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-black bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded">
                    {activeShiftModal.shift.code}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {activeShiftModal.shift.name}
                  </span>
                </div>
                {activeShiftModal.shift.isDefault && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Default Shift
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Shift Hours</span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeShiftModal.shift.startTime} - {activeShiftModal.shift.endTime}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Grace Window</span>
                  <span className="font-mono font-bold text-amber-700">
                    +{activeShiftModal.shift.gracePeriodMins} mins
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Half-Day Cutoff</span>
                  <span className="font-mono font-bold text-rose-700">
                    {activeShiftModal.shift.halfDayCutoffTime}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Min Hours</span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeShiftModal.shift.fullDayHours ?? activeShiftModal.shift.minFullDayHours ?? 7.5}h / {activeShiftModal.shift.halfDayHours ?? activeShiftModal.shift.minHalfDayHours ?? 4.0}h
                  </span>
                </div>
              </div>

              {activeShiftModal.shift.description && (
                <p className="text-[11px] text-slate-500 italic">
                  {activeShiftModal.shift.description}
                </p>
              )}
            </div>

            {/* Daily Biometric Punch Record */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Biometric Punch Record & Calculated Outcome
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Biometric In</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatTo24H(activeShiftModal.clockIn)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Biometric Out</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatTo24H(activeShiftModal.clockOut)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Work Hours</span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeShiftModal.totalHours ? `${activeShiftModal.totalHours} hrs` : '-'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Evaluated Status</span>
                  <span className="mt-0.5 inline-block">
                    {renderStatusBadge(activeShiftModal.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* Shift Audit Remark */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Biometric Audit Log & Rules Compliance Note
              </h4>
              <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3.5 text-xs text-blue-950 leading-relaxed font-sans">
                {activeShiftModal.remark || 'Regular attendance logged according to shift schedule.'}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveShiftModal(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-2xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

