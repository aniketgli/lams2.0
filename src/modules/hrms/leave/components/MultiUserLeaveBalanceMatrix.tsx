import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { User, LeaveType, LeavePolicyRule as LeavePolicy, LeaveRequest } from '../../../../types';
import { TablePagination } from '../../../../shared/components/TablePagination';
import {
  Search,
  Filter,
  Download,
  Upload,
  RotateCcw,
  Sliders,
  Eye,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  ChevronDown,
  X,
  FileSpreadsheet,
  FileText,
  User as UserIcon,
  Building2,
  Calendar,
  Check,
  Sparkles,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  FileCheck
} from 'lucide-react';
import {
  getUserLeaveCycleType,
  getAccountingCycleLabel,
  getAccountingCycleMeta,
  matchesCycleFilter,
  isCalendarYearCadre
} from '../utils/leaveCycleUtils';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { LeaveQuotaImportModal } from './LeaveQuotaImportModal';
import { LeaveCycleDropdown } from './LeaveCycleDropdown';
import { MultiSelectFilter } from '../../../../shared/components/MultiSelectFilter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MultiUserLeaveBalanceMatrixProps {
  onOpenQuotaImportModal?: () => void;
  onOpenBatchEditorModal?: () => void;
  onOpenReconcileModal?: () => void;
  onOpenYearRollModal?: () => void;
  selectedActiveYear?: string;
  onYearChange?: (year: string) => void;
}

export const MultiUserLeaveBalanceMatrix: React.FC<MultiUserLeaveBalanceMatrixProps> = ({
  onOpenQuotaImportModal,
  onOpenBatchEditorModal,
  onOpenReconcileModal,
  onOpenYearRollModal,
  selectedActiveYear,
  onYearChange
}) => {
  const {
    users,
    leavePolicies,
    leaveRequests,
    currentUser,
    updateUserLeaveBalance
  } = useApp();

  // Search & Filters matching Snap 2
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmployee, setFilterEmployee] = useState<string[]>(['all']);
  const [filterDesignation, setFilterDesignation] = useState<string[]>(['all']);
  const [filterDepartment, setFilterDepartment] = useState<string[]>(['all']);
  const [filterReportingManager, setFilterReportingManager] = useState<string[]>(['all']);
  const [filterReason, setFilterReason] = useState<string[]>(['all']);
  const [filterStatus, setFilterStatus] = useState<string[]>(['all']);
  const [selectedYear, setSelectedYear] = useState<string>(
    selectedActiveYear || 'CY-2026'
  );

  // Import Leave Balance Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importSuccessToast, setImportSuccessToast] = useState<string>('');

  // View Settings
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [densityMode, setDensityMode] = useState<'compact' | 'detailed'>('compact');
  const [showAllPolicyCols, setShowAllPolicyCols] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'department' | 'totalBalance'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'name' | 'department' | 'totalBalance') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Quick Balance Edit Modal State for Single Employee
  const [adjustingUser, setAdjustingUser] = useState<User | null>(null);
  const [adjustFormData, setAdjustFormData] = useState<
    Record<string, { total: number; used: number; pending: number; carryForward: number }>
  >({});
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState('');
  const [adjustErrorMsg, setAdjustErrorMsg] = useState('');

  // Detailed Employee Leave Ledger Drawer
  const [ledgerUser, setLedgerUser] = useState<User | null>(null);

  // Sync prop year change
  const handleYearSelect = (yr: string) => {
    setSelectedYear(yr);
    onYearChange?.(yr);
  };

  // Departments List
  const departmentsList = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.department).filter(Boolean))).sort();
  }, [users]);

  // Designations List
  const designationsList = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.designation).filter(Boolean))).sort();
  }, [users]);

  // Reporting Managers List
  const reportingManagersList = useMemo(() => {
    const mgrIds = new Set(users.map((u) => u.reportingManagerId).filter(Boolean));
    return users.filter((u) => mgrIds.has(u.id) || u.role === 'reporting_manager' || u.role === 'reviewing_manager');
  }, [users]);

  // Primary Leaves for Table Matrix columns: CL, EL, HPL, RH, C-OFF
  const primaryTypes: { type: LeaveType; code: string; label: string; badgeBg: string; border: string; text: string }[] = [
    { type: 'casual', code: 'CL', label: 'Casual Leave', badgeBg: 'bg-emerald-600', border: 'border-emerald-200', text: 'text-emerald-900' },
    { type: 'earned', code: 'EL', label: 'Earned Leave', badgeBg: 'bg-blue-600', border: 'border-blue-200', text: 'text-blue-900' },
    { type: 'half_pay', code: 'HPL', label: 'Half Pay Leave', badgeBg: 'bg-amber-600', border: 'border-amber-200', text: 'text-amber-900' },
    { type: 'restricted', code: 'RH', label: 'Restricted Holiday', badgeBg: 'bg-purple-600', border: 'border-purple-200', text: 'text-purple-900' },
    { type: 'compensatory_off', code: 'C-OFF', label: 'Compensatory Off', badgeBg: 'bg-indigo-600', border: 'border-indigo-200', text: 'text-indigo-900' }
  ];

  // Secondary/Special Leave Types
  const secondaryTypes: { type: LeaveType; code: string; label: string; badgeBg: string; border: string; text: string }[] = [
    { type: 'commuted', code: 'COMM', label: 'Commuted Leave', badgeBg: 'bg-cyan-600', border: 'border-cyan-200', text: 'text-cyan-900' },
    { type: 'maternity', code: 'ML', label: 'Maternity Leave', badgeBg: 'bg-rose-600', border: 'border-rose-200', text: 'text-rose-900' },
    { type: 'paternity', code: 'PL', label: 'Paternity Leave', badgeBg: 'bg-teal-600', border: 'border-teal-200', text: 'text-teal-900' },
    { type: 'child_care', code: 'CCL', label: 'Child Care Leave', badgeBg: 'bg-violet-600', border: 'border-violet-200', text: 'text-violet-900' },
    { type: 'special_casual', code: 'SCL', label: 'Special Casual', badgeBg: 'bg-orange-600', border: 'border-orange-200', text: 'text-orange-900' },
    { type: 'sick', code: 'SL', label: 'Sick Leave', badgeBg: 'bg-rose-600', border: 'border-rose-200', text: 'text-rose-900' }
  ];

  const activeDisplayTypes = useMemo(() => {
    const allTypes = showAllPolicyCols ? [...primaryTypes, ...secondaryTypes] : primaryTypes;
    if (filterReason.length > 0 && !filterReason.includes('all')) {
      const filtered = allTypes.filter((pt) => filterReason.includes(pt.type));
      return filtered.length > 0 ? filtered : allTypes;
    }
    return allTypes;
  }, [showAllPolicyCols, filterReason]);

  // Helper to extract balance of a user for a leave type
  const getUserBal = (user: User, lType: string, yr: string) => {
    let rawYr = yr;
    if (yr.startsWith('CY-')) {
      rawYr = yr.replace('CY-', '');
    } else if (yr.startsWith('FY-')) {
      rawYr = yr.replace('FY-', '').split('-')[0];
    } else if (yr.includes('-')) {
      rawYr = yr.split('-')[0];
    }
    const userYearly = user.yearlyLeaveBalances || {};
    const yearBal =
      userYearly[yr] ||
      userYearly[rawYr] ||
      userYearly[new Date().getFullYear().toString()] ||
      user.leaveBalances ||
      {};

    const pol = leavePolicies.find((p) => p.type === lType);
    const defQuota = pol ? pol.defaultQuota : 0;

    const balObj = yearBal[lType] || { total: defQuota, used: 0, pending: 0, carryForward: 0 };
    const total = Number(balObj.total) || 0;
    const used = Number(balObj.used) || 0;
    const pending = Number(balObj.pending) || 0;
    const carryForward = Number(balObj.carryForward) || 0;
    const available = Math.max(0, total - used);

    const isAllowed = !pol?.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(user.employmentType);

    return { total, used, pending, carryForward, available, isAllowed };
  };

  // Filtered Users List matching Snap 2 MultiSelect filters
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Employee filter
      if (filterEmployee.length > 0 && !filterEmployee.includes('all') && !filterEmployee.includes(u.id)) {
        return false;
      }
      // Department filter
      if (filterDepartment.length > 0 && !filterDepartment.includes('all') && !filterDepartment.includes(u.department)) {
        return false;
      }
      // Designation filter
      if (filterDesignation.length > 0 && !filterDesignation.includes('all') && !filterDesignation.includes(u.designation)) {
        return false;
      }
      // Reporting manager filter
      if (filterReportingManager.length > 0 && !filterReportingManager.includes('all') && !filterReportingManager.includes(u.reportingManagerId)) {
        return false;
      }
      // Cycle filter from selectedYear (CY vs FY)
      if (selectedYear && selectedYear !== 'all') {
        if (selectedYear.startsWith('CY-') && !isCalendarYearCadre(u.employmentType)) {
          return false;
        }
        if (selectedYear.startsWith('FY-') && isCalendarYearCadre(u.employmentType)) {
          return false;
        }
      }
      // Search query (Name, Biometric ID, Email, Department, Designation)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesBio = u.biometricId ? u.biometricId.toLowerCase().includes(q) : false;
        const matchesEmail = u.email ? u.email.toLowerCase().includes(q) : false;
        const matchesDept = u.department ? u.department.toLowerCase().includes(q) : false;
        const matchesDesig = u.designation ? u.designation.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesBio && !matchesEmail && !matchesDept && !matchesDesig) {
          return false;
        }
      }
      return true;
    });
  }, [users, filterEmployee, filterDepartment, filterDesignation, filterReportingManager, selectedYear, searchQuery]);

  // Sorted & Filtered users for Matrix Table
  const sortedAndFilteredUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'department') {
        cmp = (a.department || '').localeCompare(b.department || '');
      } else if (sortField === 'totalBalance') {
        let bA = 0;
        let bB = 0;
        primaryTypes.forEach((pt) => {
          const balA = getUserBal(a, pt.type, selectedYear);
          if (balA.isAllowed) bA += balA.available;
          const balB = getUserBal(b, pt.type, selectedYear);
          if (balB.isAllowed) bB += balB.available;
        });
        cmp = bA - bB;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredUsers, sortField, sortOrder, selectedYear, primaryTypes]);

  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(25);

  const paginatedUsers = useMemo(() => {
    const start = (matrixPage - 1) * matrixPageSize;
    return sortedAndFilteredUsers.slice(start, start + matrixPageSize);
  }, [sortedAndFilteredUsers, matrixPage, matrixPageSize]);

  // Leave Summary Statistics (Matching Snap 2 exactly: Approved Leaves, Pending Approvals, Total Applications, Total Leave Days)
  const leaveStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let approvedDays = 0;
    let totalDays = 0;

    const applicableLeaves = leaveRequests.filter((lv) => {
      if (selectedYear && selectedYear !== 'all') {
        const u = users.find((usr) => usr.id === lv.userId);
        if (!matchesCycleFilter(lv.startDate, lv.endDate, selectedYear, u?.employmentType)) {
          return false;
        }
      }
      if (filterEmployee.length > 0 && !filterEmployee.includes('all') && !filterEmployee.includes(lv.userId)) {
        return false;
      }
      if (filterDepartment.length > 0 && !filterDepartment.includes('all') && !filterDepartment.includes(lv.department)) {
        return false;
      }
      if (filterReason.length > 0 && !filterReason.includes('all') && !filterReason.includes(lv.leaveType)) {
        return false;
      }
      if (filterStatus.length > 0 && !filterStatus.includes('all') && !filterStatus.includes(lv.status)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = lv.userName?.toLowerCase().includes(q);
        const matchesDept = lv.department?.toLowerCase().includes(q);
        const matchesType = lv.leaveTypeName?.toLowerCase().includes(q);
        if (!matchesName && !matchesDept && !matchesType) return false;
      }
      return true;
    });

    applicableLeaves.forEach((lv) => {
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
      approved,
      approvedDays,
      pending,
      rejected,
      total: applicableLeaves.length,
      totalDays
    };
  }, [leaveRequests, selectedYear, users, filterEmployee, filterDepartment, filterReason, filterStatus, searchQuery]);

  const hasActiveFilters =
    searchQuery !== '' ||
    (selectedYear !== '' && selectedYear !== 'all') ||
    !filterEmployee.includes('all') ||
    !filterDesignation.includes('all') ||
    !filterDepartment.includes('all') ||
    !filterReportingManager.includes('all') ||
    !filterReason.includes('all') ||
    !filterStatus.includes('all');

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterEmployee(['all']);
    setFilterDesignation(['all']);
    setFilterDepartment(['all']);
    setFilterReportingManager(['all']);
    setFilterReason(['all']);
    setFilterStatus(['all']);
    setSelectedYear('');
    onYearChange?.('');
  };

  // Aggregate Organization Metrics
  const aggregateMetrics = useMemo(() => {
    let totalQuotaSum = 0;
    let totalUsedSum = 0;
    let totalAvailableSum = 0;
    let criticalCount = 0;

    users.forEach((u) => {
      primaryTypes.forEach((pt) => {
        const b = getUserBal(u, pt.type, selectedYear);
        if (b.isAllowed) {
          totalQuotaSum += b.total;
          totalUsedSum += b.used;
          totalAvailableSum += b.available;
        }
      });
      // If employee has less than or equal to 3 days remaining across CL & EL
      const clBal = getUserBal(u, 'casual', selectedYear);
      const elBal = getUserBal(u, 'earned', selectedYear);
      if ((clBal.isAllowed ? clBal.available : 0) + (elBal.isAllowed ? elBal.available : 0) <= 3) {
        criticalCount++;
      }
    });

    const utilizationRate =
      totalQuotaSum > 0 ? Math.round((totalUsedSum / totalQuotaSum) * 100) : 0;

    return {
      totalEmployees: users.length,
      filteredEmployeesCount: filteredUsers.length,
      totalQuotaSum,
      totalUsedSum,
      totalAvailableSum,
      utilizationRate,
      criticalCount
    };
  }, [users, filteredUsers, primaryTypes, selectedYear, leavePolicies]);

  // Open Adjust Modal for a user
  const handleOpenAdjustModal = (u: User) => {
    setAdjustingUser(u);
    setAdjustSuccessMsg('');
    setAdjustErrorMsg('');
    const userYearly = u.yearlyLeaveBalances || {};
    const yr = selectedYear;
    const yearBal = userYearly[yr] || u.leaveBalances || {};

    const data: Record<string, { total: number; used: number; pending: number; carryForward: number }> = {};
    leavePolicies.forEach((pol) => {
      const isAllowed = !pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(u.employmentType);
      if (isAllowed) {
        const bal = yearBal[pol.type] || { total: pol.defaultQuota, used: 0, pending: 0, carryForward: 0 };
        data[pol.type] = {
          total: Number(bal.total) || 0,
          used: Number(bal.used) || 0,
          pending: Number(bal.pending) || 0,
          carryForward: Number(bal.carryForward) || 0
        };
      }
    });
    setAdjustFormData(data);
  };

  // Save Adjusted Balances
  const handleSaveAdjustBalances = () => {
    if (!adjustingUser) return;
    try {
      Object.entries(adjustFormData).forEach(([lType, rawVals]) => {
        const vals = rawVals as { total: number; used: number; pending: number; carryForward: number };
        updateUserLeaveBalance(
          adjustingUser.id,
          lType,
          vals.total,
          vals.used,
          vals.pending,
          selectedYear,
          vals.carryForward
        );
      });
      setAdjustSuccessMsg(`Leave balances for ${adjustingUser.name} updated successfully for Year ${selectedYear}.`);
      setTimeout(() => {
        setAdjustingUser(null);
      }, 1200);
    } catch (err: any) {
      setAdjustErrorMsg(err?.message || 'Error updating balances.');
    }
  };

  // Export Matrix to CSV
  const handleExportCSV = () => {
    const headers = [
      'Biometric ID',
      'Employee Name',
      'Department',
      'Designation',
      'Employment Cadre',
      'Leave Cycle',
      'Accounting Year',
      'CL Quota',
      'CL Used',
      'CL Available',
      'EL Quota',
      'EL Used',
      'EL Available',
      'HPL Quota',
      'HPL Used',
      'HPL Available',
      'RH Available',
      'Comp-Off Available',
      'Total Net Available Days'
    ];

    const rows = filteredUsers.map((u) => {
      const cl = getUserBal(u, 'casual', selectedYear);
      const el = getUserBal(u, 'earned', selectedYear);
      const hpl = getUserBal(u, 'half_pay', selectedYear);
      const rh = getUserBal(u, 'restricted', selectedYear);
      const coff = getUserBal(u, 'compensatory_off', selectedYear);
      const totalAvail =
        (cl.isAllowed ? cl.available : 0) +
        (el.isAllowed ? el.available : 0) +
        (hpl.isAllowed ? hpl.available : 0) +
        (rh.isAllowed ? rh.available : 0) +
        (coff.isAllowed ? coff.available : 0);

      const cycle = getUserLeaveCycleType(u);

      return [
        `"${u.biometricId || '-'}"`,
        `"${u.name}"`,
        `"${u.department || '-'}"`,
        `"${u.designation || '-'}"`,
        `"${u.employmentType}"`,
        `"${cycle}"`,
        `"${selectedYear}"`,
        cl.isAllowed ? cl.total : 'N/A',
        cl.isAllowed ? cl.used : 'N/A',
        cl.isAllowed ? cl.available : 'N/A',
        el.isAllowed ? el.total : 'N/A',
        el.isAllowed ? el.used : 'N/A',
        el.isAllowed ? el.available : 'N/A',
        hpl.isAllowed ? hpl.total : 'N/A',
        hpl.isAllowed ? hpl.used : 'N/A',
        hpl.isAllowed ? hpl.available : 'N/A',
        rh.isAllowed ? rh.available : 'N/A',
        coff.isAllowed ? coff.available : 'N/A',
        totalAvail
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WII_Staff_Leave_Balances_Matrix_${selectedYear}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Matrix to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(112, 22, 24);
    doc.text('WILDLIFE INSTITUTE OF INDIA (WII)', 14, 12);

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Institutional Staff Leave Balances Register & Matrix — Year ${selectedYear}`, 14, 18);
    doc.setFontSize(8);
    doc.text(
      `Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • Total Monitored Staff: ${filteredUsers.length}`,
      14,
      23
    );

    const tableData = filteredUsers.map((u) => {
      const cl = getUserBal(u, 'casual', selectedYear);
      const el = getUserBal(u, 'earned', selectedYear);
      const hpl = getUserBal(u, 'half_pay', selectedYear);
      const rh = getUserBal(u, 'restricted', selectedYear);
      const coff = getUserBal(u, 'compensatory_off', selectedYear);
      const totalAvail =
        (cl.isAllowed ? cl.available : 0) +
        (el.isAllowed ? el.available : 0) +
        (hpl.isAllowed ? hpl.available : 0) +
        (rh.isAllowed ? rh.available : 0) +
        (coff.isAllowed ? coff.available : 0);

      const cycle = getUserLeaveCycleType(u);

      return [
        u.biometricId || '-',
        u.name,
        u.department,
        `${u.employmentType.replace('_', ' ')} (${cycle})`,
        cl.isAllowed ? `${cl.available} / ${cl.total}` : '—',
        el.isAllowed ? `${el.available} / ${el.total}` : '—',
        hpl.isAllowed ? `${hpl.available} / ${hpl.total}` : '—',
        rh.isAllowed ? `${rh.available} / ${rh.total}` : '—',
        coff.isAllowed ? `${coff.available} / ${coff.total}` : '—',
        `${totalAvail} Days`
      ];
    });

    autoTable(doc, {
      startY: 27,
      head: [
        [
          'Bio ID',
          'Employee Name',
          'Department',
          'Cadre (Cycle)',
          'CL (Avail/Tot)',
          'EL (Avail/Tot)',
          'HPL (Avail/Tot)',
          'RH (Avail/Tot)',
          'C-OFF (Avail/Tot)',
          'Net Balance'
        ]
      ],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [112, 22, 24], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`WII_Staff_Leave_Balances_Matrix_${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Uniform Page Header */}
      <PageHeader
        icon={FileSpreadsheet}
        title="Leave Balance"
        subtitle="Centralized staff leave quota administration, multi-cadre consumption matrix & real-time entitlement tracking"
        rightAction={
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Import employee leave quotas via CSV"
          >
            <Upload className="w-4 h-4" />
            <span>Import Leave</span>
          </button>
        }
      />

      {/* Success Notification Banner after CSV import */}
      {importSuccessToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-bold shadow-2xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessToast('')}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-0.5 rounded-lg hover:bg-emerald-100/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Leave Summary Stat Cards: Exact match to Attendance theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Approved Leaves */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">
                Approved Leaves
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{leaveStats.approved}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            {leaveStats.approvedDays} Total Leave Days Approved
          </div>
        </div>

        {/* 2. Pending Approvals */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">
                Pending Approvals
              </p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{leaveStats.pending}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Awaiting Manager Decision
          </div>
        </div>

        {/* 3. Total Applications */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">
                Total Applications
              </p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">{leaveStats.total}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Logged Leave Applications
          </div>
        </div>

        {/* 4. Total Leave Days */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">
                Total Leave Days
              </p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">{leaveStats.totalDays} Days</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Layers className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Accumulated Active Leave Period
          </div>
        </div>
      </div>

      {/* Date Range, Search & Filters Control Bar: Exact match to Attendance theme */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Row 1: Themed Leave Accounting Cycle Dropdown (CY / FY) & Export Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3.5 border-b border-slate-100 pb-3">
          {/* Left: Leave Accounting Cycle Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <LeaveCycleDropdown
              selectedCycle={selectedYear}
              onChange={handleYearSelect}
              isAdminInstitutionalView={true}
            />
          </div>

          {/* Right: Export Buttons (CSV & PDF) */}
          <div className="flex items-center justify-end gap-2 shrink-0 w-full sm:w-auto ml-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
              title="Export records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
              title="Export records to PDF"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search Box, Reset Button (Icon Only) & View Mode Toggle in ONE Single Row */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 w-full">
            {/* Search Box */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee, department, designation, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full pl-9 pr-8 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
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
                type="button"
                onClick={handleResetFilters}
                className="h-9 w-9 rounded-xl border bg-blue-50/90 hover:bg-blue-100 text-blue-700 border-blue-200/90 flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95 animate-in fade-in zoom-in-95 duration-150"
                title="Reset active filters and search"
              >
                <RotateCcw className="w-4 h-4 text-blue-600" />
              </button>
            )}

            {/* View Mode Toggle: Row View (Table) vs Grid View */}
            <div className="h-9 flex items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0">
              <button
                type="button"
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
                type="button"
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

        {/* Row 3: Role-Based Filter Dropdowns Uniform Flex Wrap */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap">
            {/* Employee Filter */}
            <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
              <MultiSelectFilter
                label="Employee"
                icon={<UserIcon className="w-3.5 h-3.5" />}
                selectedValues={filterEmployee}
                onChange={setFilterEmployee}
                options={users.map((u) => ({ label: `${u.name} (${u.department})`, value: u.id }))}
              />
            </div>

            {/* Designation Filter */}
            <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
              <MultiSelectFilter
                label="Designation"
                icon={<Filter className="w-3.5 h-3.5" />}
                selectedValues={filterDesignation}
                onChange={setFilterDesignation}
                options={designationsList.map((d) => ({ label: d, value: d }))}
              />
            </div>

            {/* Department Filter */}
            <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
              <MultiSelectFilter
                label="Department"
                icon={<Building2 className="w-3.5 h-3.5" />}
                selectedValues={filterDepartment}
                onChange={setFilterDepartment}
                options={departmentsList.map((dept) => ({ label: dept, value: dept }))}
              />
            </div>

            {/* Reporting Manager Filter */}
            <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
              <MultiSelectFilter
                label="Reporting Manager"
                icon={<UserIcon className="w-3.5 h-3.5" />}
                selectedValues={filterReportingManager}
                onChange={setFilterReportingManager}
                options={reportingManagersList.map((m) => ({ label: m.name, value: m.id }))}
              />
            </div>

            {/* Leave Type Filter */}
            <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
              <MultiSelectFilter
                label="Leave Type"
                icon={<Filter className="w-3.5 h-3.5" />}
                selectedValues={filterReason}
                onChange={setFilterReason}
                options={leavePolicies.map((p) => ({
                  label: `${p.name} (${p.code || p.type.toUpperCase()})`,
                  value: p.type
                }))}
              />
            </div>

            {/* Status Filter */}
            <div className="flex-1 min-w-[115px] max-w-[170px] shrink-0 sm:shrink">
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

      {/* 4. Main Matrix Table View */}
      {viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          {/* Table Title Bar */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 min-h-[50px]">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Staff Leave Balances ({sortedAndFilteredUsers.length})</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium bg-slate-200/60 px-2.5 py-0.5 rounded-full border border-slate-200">
                Cycle: <strong className="text-slate-900 font-mono">{selectedYear}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Density switcher: Compact / Detailed */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDensityMode('compact')}
                  className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    densityMode === 'compact'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setDensityMode('detailed')}
                  className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    densityMode === 'detailed'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Detailed
                </button>
              </div>

              {/* Show all policies toggle button */}
              <button
                type="button"
                onClick={() => setShowAllPolicyCols(!showAllPolicyCols)}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-lg transition-all cursor-pointer flex items-center space-x-1"
              >
                <span>{showAllPolicyCols ? 'Primary (5)' : `All Policies (${primaryTypes.length + secondaryTypes.length})`}</span>
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar">
            <table className={`w-full text-left text-xs border-collapse ${activeDisplayTypes.length <= 5 ? 'table-fixed' : 'min-w-[960px]'}`}>
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr className="h-10">
                  <th
                    onClick={() => handleSort('name')}
                    className={`py-2 px-3.5 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle ${
                      activeDisplayTypes.length <= 5 ? 'w-[22%]' : 'min-w-[175px]'
                    }`}
                    title="Click to sort by Employee Name"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Employee Details</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  {activeDisplayTypes.map((pt) => (
                    <th
                      key={pt.type}
                      className={`py-2 px-1 text-center whitespace-nowrap align-middle ${
                        activeDisplayTypes.length <= 5 ? 'w-[11%]' : 'min-w-[80px]'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span className="text-slate-900 font-black">{pt.code}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({densityMode === 'compact' ? 'Bal' : 'Tot/Use/Bal'})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium truncate max-w-[88px] mx-auto">
                        {pt.label}
                      </div>
                    </th>
                  ))}
                  <th
                    onClick={() => handleSort('totalBalance')}
                    className={`py-2 px-2 text-center whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle ${
                      activeDisplayTypes.length <= 5 ? 'w-[12%]' : 'min-w-[88px]'
                    }`}
                    title="Click to sort by Total Available Balance"
                  >
                    <div className="flex items-center justify-center space-x-1.5">
                      <span>Total Balance</span>
                      {sortField === 'totalBalance' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th className={`py-2 px-3 text-right whitespace-nowrap align-middle ${
                    activeDisplayTypes.length <= 5 ? 'w-[11%]' : 'min-w-[88px]'
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedAndFilteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={activeDisplayTypes.length + 3} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <p className="font-bold text-sm text-slate-700">No employee records match the specified filters.</p>
                        <p className="text-xs text-slate-400">Try clearing search keyword or relaxing cadre/department filters.</p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          Reset All Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const cycle = getUserLeaveCycleType(u);
                    const isCY = cycle === 'CY';

                    // Compute Balances across primary types
                    let userTotalAvail = 0;
                    let userTotalAlloc = 0;

                    primaryTypes.forEach((pt) => {
                      const b = getUserBal(u, pt.type, selectedYear);
                      if (b.isAllowed) {
                        userTotalAvail += b.available;
                        userTotalAlloc += b.total;
                      }
                    });

                    const cl = getUserBal(u, 'casual', selectedYear);
                    const el = getUserBal(u, 'earned', selectedYear);
                    const isLow = (cl.isAllowed ? cl.available : 0) + (el.isAllowed ? el.available : 0) <= 3;

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isLow ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        {/* Employee Details Column */}
                        <td className="py-2.5 px-3.5 align-middle">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                            />
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => setLedgerUser(u)}
                                className="font-bold text-xs text-slate-900 hover:text-blue-700 truncate text-left cursor-pointer transition-colors block max-w-[170px]"
                                title="Click to view detailed employee leave ledger"
                              >
                                {u.name}
                              </button>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center space-x-1.5 max-w-[170px]">
                                <span className="truncate">{u.designation || 'Staff'}</span>
                                <span
                                  className={`text-[8.5px] font-extrabold uppercase px-1 py-0.2 rounded border shrink-0 ${
                                    isCY
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : 'bg-teal-50 text-teal-800 border-teal-200'
                                  }`}
                                  title={isCY ? 'Calendar Year (Jan-Dec)' : 'Financial Year (Apr-Mar)'}
                                >
                                  {cycle}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">
                                {u.biometricId ? `Bio ID: ${u.biometricId}` : (u.id ? `Bio ID: ${u.id}` : 'Bio ID: N/A')}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Dynamic Leave Type Balance Columns */}
                        {activeDisplayTypes.map((pt) => {
                          const bal = getUserBal(u, pt.type, selectedYear);
                          if (!bal.isAllowed) {
                            return (
                              <td
                                key={pt.type}
                                className="py-3 px-2 text-center text-slate-300 font-bold text-sm align-middle"
                              >
                                —
                              </td>
                            );
                          }

                          return (
                            <td
                              key={pt.type}
                              className="py-3 px-2 text-center align-middle"
                            >
                              {densityMode === 'compact' ? (
                                <div className="inline-flex flex-col items-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-lg font-mono font-bold text-xs inline-block shadow-2xs border ${
                                      bal.available > 0
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                                        : 'bg-rose-50 text-rose-800 border-rose-200/90'
                                    }`}
                                  >
                                    {bal.available} <span className="text-[10px] font-normal text-slate-500">/ {bal.total}</span>
                                  </span>
                                  {bal.used > 0 && (
                                    <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                      {bal.used} used
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5 text-[11px] max-w-[95px] mx-auto bg-slate-50 p-1.5 rounded-lg border border-slate-200/70">
                                  <div className="flex items-center justify-between text-slate-500 font-medium">
                                    <span>Quota:</span>
                                    <strong className="text-slate-800 font-mono">{bal.total}</strong>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-500 font-medium">
                                    <span>Used:</span>
                                    <strong className="text-amber-800 font-mono">{bal.used}</strong>
                                  </div>
                                  <div className="flex items-center justify-between pt-0.5 border-t border-slate-200/80 font-bold">
                                    <span className="text-emerald-800">Avail:</span>
                                    <span className="font-mono text-emerald-900 text-xs">{bal.available}</span>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Total Balance Column */}
                        <td className="py-3 px-2 text-center align-middle">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-black text-xs sm:text-sm text-slate-900 font-mono">
                              {userTotalAvail} <span className="text-[10px] font-bold text-slate-500">Days</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              of {userTotalAlloc} Total
                            </span>
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-3 px-4 text-right align-middle whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Quick Adjust Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenAdjustModal(u)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200/80 hover:border-blue-600 rounded-lg transition-all shadow-2xs cursor-pointer"
                              title={`Adjust leave balances for ${u.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* View Ledger Button */}
                            <button
                              type="button"
                              onClick={() => setLedgerUser(u)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-900 rounded-lg transition-all shadow-2xs cursor-pointer"
                              title={`View full leave history & ledger for ${u.name}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination */}
          <div className="w-full border-t border-slate-200/90 bg-white rounded-b-2xl">
            <TablePagination
              currentPage={matrixPage}
              totalPages={Math.ceil(sortedAndFilteredUsers.length / matrixPageSize)}
              totalItems={sortedAndFilteredUsers.length}
              pageSize={matrixPageSize}
              onPageChange={setMatrixPage}
              onPageSizeChange={setMatrixPageSize}
            />
          </div>
        </div>
      ) : (
        /* 5. Card Grid View Option */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAndFilteredUsers.map((u) => {
            const cycle = getUserLeaveCycleType(u);
            const isCY = cycle === 'CY';

            return (
              <div
                key={u.id}
                className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3.5"
              >
                {/* Employee Card Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{u.name}</h4>
                      
                      <div className="flex items-center space-x-1.5 mt-1">
                        {u.biometricId && (
                          <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {u.biometricId}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                            isCY
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {cycle} {selectedYear}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenAdjustModal(u)}
                      className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Adjust Balances"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerUser(u)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-800 text-slate-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="View Ledger"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mini Progress Bars for Primary Leaves */}
                <div className="space-y-2 text-xs">
                  {primaryTypes.map((pt) => {
                    const bal = getUserBal(u, pt.type, selectedYear);
                    if (!bal.isAllowed) return null;
                    const percent = bal.total > 0 ? Math.round((bal.available / bal.total) * 100) : 0;

                    return (
                      <div key={pt.type} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-700 flex items-center space-x-1">
                            <span className={`${pt.badgeBg} text-white font-black text-[9px] px-1 py-0.2 rounded`}>
                              {pt.code}
                            </span>
                            <span>{pt.label}</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {bal.available} <span className="text-slate-400 font-normal">/ {bal.total}d left</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              bal.available > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                            } transition-all duration-300 rounded-full`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Card Footer Summary */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Employment: <strong className="text-slate-800 capitalize">{u.employmentType.replace('_', ' ')}</strong></span>
                  <button
                    type="button"
                    onClick={() => setLedgerUser(u)}
                    className="font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-0.5 cursor-pointer"
                  >
                    <span>Full Ledger</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Quick Balance Adjust Modal for Single Employee */}
      {adjustingUser && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Uniform Institutional Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white px-5 py-4 flex items-center justify-between border-b border-blue-900/60 shrink-0 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <img
                  src={adjustingUser.avatar}
                  alt={adjustingUser.name}
                  className="w-10 h-10 rounded-xl object-cover border border-blue-700/60 shadow-sm"
                />
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">
                    Adjust Leave Balances: {adjustingUser.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingUser(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">

            {/* Adjust Form */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(adjustFormData).map(([lType, rawVals]) => {
                const vals = rawVals as { total: number; used: number; pending: number; carryForward: number };
                const pol = leavePolicies.find((p) => p.type === lType);
                const code = pol?.code || lType.toUpperCase();
                const name = pol?.name || lType;

                return (
                  <div key={lType} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                        <span className="bg-slate-900 text-white font-black text-[10px] px-1.5 py-0.5 rounded">
                          {code}
                        </span>
                        <span>{name}</span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 font-mono">
                        Net Balance: {Math.max(0, vals.total - vals.used)} Days
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                          Total Quota
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={vals.total}
                          onChange={(e) =>
                            setAdjustFormData({
                              ...adjustFormData,
                              [lType]: { ...vals, total: Number(e.target.value) || 0 }
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                          Used Days
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={vals.used}
                          onChange={(e) =>
                            setAdjustFormData({
                              ...adjustFormData,
                              [lType]: { ...vals, used: Number(e.target.value) || 0 }
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                          Carry Forward
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={vals.carryForward}
                          onChange={(e) =>
                            setAdjustFormData({
                              ...adjustFormData,
                              [lType]: { ...vals, carryForward: Number(e.target.value) || 0 }
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {adjustSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{adjustSuccessMsg}</span>
              </div>
            )}

            {adjustErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-900 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{adjustErrorMsg}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdjustBalances}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Balances for {selectedYear}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 7. Employee Detailed Leave History & Ledger Drawer */}
      {ledgerUser && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Uniform Institutional Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white px-5 py-4 flex items-center justify-between border-b border-blue-900/60 shrink-0 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3.5">
                <img
                  src={ledgerUser.avatar}
                  alt={ledgerUser.name}
                  className="w-11 h-11 rounded-xl object-cover border border-blue-700/60 shadow-sm"
                />
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">{ledgerUser.name}</h3>
                  <p className="text-[11px] text-blue-200/80 font-medium mt-0.5">
                    Cycle: <strong className="text-white">{getAccountingCycleLabel(ledgerUser, selectedYear)}</strong> ({ledgerUser.employmentType.replace('_', ' ')})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLedgerUser(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Current Quota &amp; Balance Breakdown ({selectedYear})</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 border-b">Leave Type</th>
                        <th className="p-2.5 border-b text-center">Allocated Quota</th>
                        <th className="p-2.5 border-b text-center">Approved Used</th>
                        <th className="p-2.5 border-b text-center">Pending Approvals</th>
                        <th className="p-2.5 border-b text-center">Carry Forward</th>
                        <th className="p-2.5 border-b text-right font-black">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium">
                      {leavePolicies
                        .filter((p) => !p.allowedEmploymentTypes || p.allowedEmploymentTypes.includes(ledgerUser.employmentType))
                        .map((pol) => {
                          const bal = getUserBal(ledgerUser, pol.type, selectedYear);
                          return (
                            <tr key={pol.type} className="hover:bg-slate-50/60">
                              <td className="p-2.5">
                                <span className="font-bold text-slate-900">{pol.name}</span>
                                <span className="ml-1.5 text-[10px] font-black bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200">
                                  {pol.code || pol.type.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-800">{bal.total}d</td>
                              <td className="p-2.5 text-center text-amber-800 font-bold">{bal.used}d</td>
                              <td className="p-2.5 text-center text-slate-500">{bal.pending}d</td>
                              <td className="p-2.5 text-center text-emerald-700">{bal.carryForward}d</td>
                              <td className="p-2.5 text-right font-black text-emerald-800 font-mono text-sm">
                                {bal.available} Days
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Leave Applications History for this employee */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Leave History &amp; Applications ({selectedYear})</span>
                </h4>

                {(() => {
                  const empLeaves = leaveRequests.filter(
                    (lr) =>
                      lr.userId === ledgerUser.id &&
                      (lr.startDate?.startsWith(selectedYear) || lr.endDate?.startsWith(selectedYear))
                  );

                  if (empLeaves.length === 0) {
                    return (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                        No leave applications recorded for {ledgerUser.name} in Year {selectedYear}.
                      </div>
                    );
                  }

                  return (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5 border-b">Leave Type</th>
                            <th className="p-2.5 border-b">Period</th>
                            <th className="p-2.5 border-b text-center">Days</th>
                            <th className="p-2.5 border-b">Reason</th>
                            <th className="p-2.5 border-b text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {empLeaves.map((lv) => (
                            <tr key={lv.id} className="hover:bg-slate-50/60">
                              <td className="p-2.5 font-bold text-slate-900">{lv.leaveTypeName}</td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-700">
                                {lv.startDate} → {lv.endDate}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-900">{lv.daysCount}d</td>
                              <td className="p-2.5 text-slate-600 italic max-w-xs truncate">{lv.reason}</td>
                              <td className="p-2.5 text-right">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    lv.status === 'approved'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : lv.status === 'rejected'
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  {lv.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const target = ledgerUser;
                  setLedgerUser(null);
                  handleOpenAdjustModal(target);
                }}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Adjust Quotas</span>
              </button>

              <button
                type="button"
                onClick={() => setLedgerUser(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Quota Import Modal - ONLY opened via 'Import Leave Balance' button */}
      <LeaveQuotaImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        selectedYear={selectedYear}
        onSuccess={(msg) => {
          setImportSuccessToast(msg);
          setTimeout(() => setImportSuccessToast(''), 5000);
        }}
      />
    </div>
  );
};
