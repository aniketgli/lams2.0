import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import {
  User as UserType,
  UserRole,
  EmploymentType,
  EnterpriseModuleId,
  MODULE_ROLE_DEFINITIONS,
  getUserRoles,
  getUserModuleRoles
} from '../../../../types';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { TablePagination } from '../../../../shared/components/TablePagination';
import { UserProjectHistoryModal } from '../components/UserProjectHistoryModal';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { getUserLeaveCycleType, isCalendarYearCadre } from '../../leave/utils/leaveCycleUtils';
import {
  User as UserIcon,
  Users,
  Users2,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  AlertCircle,
  Edit3,
  Check,
  X,
  Clock,
  MessageSquare,
  Shield,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  UserCheck,
  UserCog,
  UserX,
  Trash2,
  Plus,
  Search,
  ArrowLeftRight,
  ArrowRight,
  RefreshCw,
  Building,
  Lock,
  FileText,
  ChevronRight,
  UserPlus,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpen,
  Microscope,
  Building2,
  Award,
  Sparkles,
  LayoutGrid,
  List,
  Filter,
  Layers,
  School,
  Download,
  ChevronDown,
  RotateCcw,
  Grid3X3
} from 'lucide-react';
import { RoleMatrixTable } from '../../master/components/RoleMatrixTable';

// Master Data Lists for Dropdowns
export const DEPARTMENTS_MASTER = [
  'Wildlife Ecology & Management',
  'Habitat Ecology',
  'Landscape Level Planning & Management',
  'Eco-development & Planning',
  'Protected Area Network, Wildlife Management & Conservation Biology',
  'EIA & Climate Change Cell',
  'Geoinformatics / GIS Cell',
  'Wildlife Forensic & Conservation Genetics',
  'Computer & IT Cell',
  'Administration & Establishment',
  'Finance & Accounts',
  'Library & Documentation',
  'Publication & Public Relations',
  'Directorate & Executive'
];

export const DESIGNATIONS_MASTER = [
  'Director',
  'Dean',
  'Scientist G',
  'Scientist F',
  'Scientist E',
  'Scientist D',
  'Scientist C',
  'Registrar',
  'Senior Administrative Officer (SAO)',
  'Finance & Accounts Officer',
  'Technical Officer',
  'Senior Technical Assistant',
  'Technical Assistant',
  'Junior Research Fellow (JRF)',
  'Senior Research Fellow (SRF)',
  'Research Associate (RA)',
  'Project Scientist',
  'Project Associate',
  'Project Assistant',
  'Office Assistant',
  'Upper Division Clerk (UDC)',
  'Lower Division Clerk (LDC)',
  'Multi-Tasking Staff (MTS)',
  'Ph.D. Scholar',
  'M.Sc. Student',
  'Intern'
];

export const STREAMS_MASTER = [
  'Wildlife Sciences',
  'Freshwater Ecology',
  'Heritage Conservation & Management',
  'Biodiversity Conservation',
  'Landscape Level Planning & Management',
  'Environmental Science'
];

export const BATCHES_MASTER = [
  '2021-2023',
  '2022-2024',
  '2023-2025',
  '2024-2026',
  '2025-2027',
  '2026-2028',
  '2027-2029'
];

export const calculateStudentValidUntil = (joiningDateStr?: string): string => {
  if (!joiningDateStr) return '';
  const date = new Date(joiningDateStr);
  if (isNaN(date.getTime())) return '';
  date.setFullYear(date.getFullYear() + 2);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const EMPLOYEE_TYPE_OPTIONS_MAP: Record<string, string[]> = {
  permanent: ['Administrative', 'Scientific', 'Technical', 'Support'],
  contractual: ['Administrative', 'Scientific', 'Technical', 'Support', 'Project Staff', 'Consultant'],
  researcher: ['Research Associate', 'Project Fellow (JRF/SRF)', 'Project Scientist', 'Project Assistant'],
  diploma_trainee: ['Technical Trainee', 'Administrative Trainee', 'Field Trainee'],
  intern: ['Research Intern', 'IT / GIS Intern', 'Administrative Intern'],
  bsc_msc_student: ['M.Sc. Wildlife Science', 'M.Sc. Heritage Management', 'B.Sc. Student'],
  phd_student: ['Ph.D. Scholar (Regular)', 'Ph.D. Scholar (Project Funded)', 'Ph.D. Scholar (External)']
};

export const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case 'administrator':
      return 'Administrator';
    case 'reporting_manager':
      return 'Reporting Manager';
    case 'reviewing_manager':
      return 'Reviewing Manager';
    default:
      return 'General Staff';
  }
};

export const getRoleBadgeStyle = (role: UserRole): string => {
  switch (role) {
    case 'administrator':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'reporting_manager':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'reviewing_manager':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
};

export interface EmployeeProfilePageProps {
  initialTab?: 'profile' | 'user_controls' | 'transfers';
}

export const EmployeeProfilePage: React.FC<EmployeeProfilePageProps> = ({ initialTab = 'profile' }) => {
  const {
    currentUser,
    users,
    shifts,
    updateUserProfile,
    addUserProfile,
    updateUserRoleAndHierarchy,
    toggleUserStatus,
    deleteUser,
    resetUserPassword,
    transferUser,
    bulkTransferUsers,
    bulkReassignManager,
    transferLogs
  } = useApp();

  // Role Checks
  const isAdmin = currentUser.role === 'administrator';
  const isManager = currentUser.role === 'reporting_manager' || currentUser.role === 'reviewing_manager';

  // Sub-tabs State
  const [activeTab, setActiveTab] = useState<'profile' | 'user_controls' | 'transfers'>(initialTab);

  useEffect(() => {
    if (!isAdmin && (initialTab === 'user_controls' || initialTab === 'transfers')) {
      setActiveTab('profile');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isAdmin]);

  // User Project History Modal State
  const [historyUser, setHistoryUser] = useState<UserType | null>(null);

  // Dynamic Search Query for Employee Profiles
  const [profileSearchQuery, setProfileSearchQuery] = useState('');

  // Profile / Directory Summary KPI Stats
  const profileStats = useMemo(() => {
    const total = users.length;
    const regular = users.filter((u) => u.employmentType === 'regular' || u.employmentType === 'permanent' || u.employmentType === 'deputation').length;
    const contractual = users.filter((u) => u.employmentType === 'contractual' || u.employmentType === 'project' || u.employmentType === 'outsourced').length;
    const depts = new Set(users.map((u) => u.department).filter(Boolean)).size;
    return { total, regular, contractual, depts };
  }, [users]);

  // Category Filter State for Directory Tab
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string[]>(['all']);

  // Department, Employee, Designation, Reporting Mgr & Status Filter States
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string[]>(['all']);
  const [selectedDesignationFilter, setSelectedDesignationFilter] = useState<string[]>(['all']);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string[]>(['all']);
  const [selectedReportingMgrFilter, setSelectedReportingMgrFilter] = useState<string[]>(['all']);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string[]>(['all']);

  // Date Range Filter States (Pic 2)
  const [startDateFilter, setStartDateFilter] = useState<string>('2026-01-01');
  const [endDateFilter, setEndDateFilter] = useState<string>('2026-12-31');

  // Helper to format YYYY-MM-DD to "Thu, 01 Jan, 2026"
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleSetCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];
    setStartDateFilter(formatYMD(firstDay));
    setEndDateFilter(formatYMD(lastDay));
  };

  // Directory View Mode: 'grid' (Category Cards Grid) or 'detail' (Single Detailed Profile View)
  const [directoryViewMode, setDirectoryViewMode] = useState<'grid' | 'detail'>('grid');

  // Accessible profiles: Admin sees all, Managers see reportees/under-employees + self, General Staff see self only
  const accessibleProfiles = useMemo(() => {
    if (isAdmin) return users;
    if (isManager) {
      return users.filter((u) => {
        if (u.id === currentUser.id) return true;
        if (u.reportingManagerId === currentUser.id) return true;
        if (u.reportingManagerName && u.reportingManagerName === currentUser.name) return true;
        if (currentUser.role === 'reviewing_manager' && u.department === currentUser.department) return true;
        if ((u as any).hodUserId === currentUser.id) return true;
        return false;
      });
    }
    return users.filter((u) => u.id === currentUser.id);
  }, [currentUser, users, isAdmin, isManager]);

  // Dynamic Designations List
  const designationsList = useMemo(() => {
    return Array.from(new Set(accessibleProfiles.map((u) => u.designation).filter(Boolean))).sort();
  }, [accessibleProfiles]);

  // Dynamic Reporting Managers List
  const reportingMgrsList = useMemo(() => {
    const mgrIds = Array.from(new Set(accessibleProfiles.map((u) => u.reportingManagerId).filter(Boolean)));
    return mgrIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as UserType[];
  }, [accessibleProfiles, users]);

  // Dynamic Category Counts
  const categoryCounts = useMemo(() => {
    return {
      all: accessibleProfiles.length,
      permanent: accessibleProfiles.filter((u) => u.employmentType === 'permanent').length,
      contractual: accessibleProfiles.filter((u) => u.employmentType === 'contractual').length,
      researcher: accessibleProfiles.filter((u) => u.employmentType === 'researcher').length,
      diploma_trainee: accessibleProfiles.filter((u) => u.employmentType === 'diploma_trainee').length,
      intern: accessibleProfiles.filter((u) => u.employmentType === 'intern').length,
      bsc_msc_student: accessibleProfiles.filter((u) => u.employmentType === 'bsc_msc_student').length,
      phd_student: accessibleProfiles.filter((u) => u.employmentType === 'phd_student').length,
    };
  }, [accessibleProfiles]);

  // Category, Department, Status & Search Filtered Profiles
  const categoryFilteredProfiles = useMemo(() => {
    return accessibleProfiles.filter((u) => {
      // 1. Employee Filter Match
      if (!matchesMultiSelect(selectedEmployeeFilter, u.id)) return false;

      // 2. Designation Filter Match
      if (!matchesMultiSelect(selectedDesignationFilter, u.designation)) return false;

      // 3. Department Filter Match
      if (!matchesMultiSelect(selectedDepartmentFilter, u.department)) return false;

      // 4. Reporting Mgr Filter Match
      if (!matchesMultiSelect(selectedReportingMgrFilter, u.reportingManagerId)) return false;

      // 5. Category (Type) Filter Match
      if (!matchesMultiSelect(selectedCategoryFilter, u.employmentType)) return false;

      // 6. Status Filter Match
      const statusVal = u.status === 'deactivated' ? 'deactivated' : 'active';
      if (!matchesMultiSelect(selectedStatusFilter, statusVal)) return false;

      // 7. Search Query Match
      if (!profileSearchQuery.trim()) return true;
      const q = profileSearchQuery.toLowerCase().trim();
      return (
        u.name.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.piName && u.piName.toLowerCase().includes(q)) ||
        (u.guideSupervisor && u.guideSupervisor.toLowerCase().includes(q)) ||
        (u.courseProgram && u.courseProgram.toLowerCase().includes(q)) ||
        (u.phdTopic && u.phdTopic.toLowerCase().includes(q)) ||
        (u.universityName && u.universityName.toLowerCase().includes(q)) ||
        (u.biometricId && u.biometricId.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [
    accessibleProfiles,
    selectedEmployeeFilter,
    selectedDesignationFilter,
    selectedDepartmentFilter,
    selectedReportingMgrFilter,
    selectedCategoryFilter,
    selectedStatusFilter,
    profileSearchQuery,
  ]);

  // Legacy alias for existing dropdown compatibility
  const filteredProfiles = categoryFilteredProfiles;

  // Export Handlers for Personnel Directory
  const handleExportCSV = () => {
    if (!categoryFilteredProfiles || categoryFilteredProfiles.length === 0) return;
    const headers = ['Employee ID', 'Biometric ID', 'Name', 'Designation', 'Department', 'Category', 'Email', 'Phone', 'Status'];
    const rows = categoryFilteredProfiles.map((u) => [
      u.id,
      u.biometricId || u.emergencyContactPhone || '',
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.designation || '').replace(/"/g, '""')}"`,
      `"${(u.department || '').replace(/"/g, '""')}"`,
      `"${getCategoryBadge(u).label}"`,
      u.email || '',
      u.phone || '',
      u.status || 'active'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WII_Personnel_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const getCategoryBadge = (u: UserType) => {
    if (u.employmentType === 'researcher' && u.isPhDEnrolled) {
      return {
        label: 'Researchers / Project Staff (PhD Enrolled)',
        shortLabel: 'Researcher (PhD Dual)',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        darkBadgeClass: 'bg-purple-500/30 text-purple-200 border-purple-400/40',
        icon: Sparkles,
        emoji: '🔬🎓'
      };
    }
    if (u.employmentType === 'phd_student' && u.isPhDEnrolled) {
      return {
        label: 'PhD Student (Project Associated)',
        shortLabel: 'PhD (Project Dual)',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        darkBadgeClass: 'bg-purple-500/30 text-purple-200 border-purple-400/40',
        icon: Sparkles,
        emoji: '🎓🔬'
      };
    }
    switch (u.employmentType) {
      case 'permanent':
        return {
          label: 'Permanent Employees',
          shortLabel: 'Permanent',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
          darkBadgeClass: 'bg-blue-500/30 text-blue-200 border-blue-400/40',
          icon: Building2,
          emoji: '👔'
        };
      case 'contractual':
        return {
          label: 'Contractual Employees',
          shortLabel: 'Contractual',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
          darkBadgeClass: 'bg-amber-500/30 text-amber-200 border-amber-400/40',
          icon: Briefcase,
          emoji: '💼'
        };
      case 'researcher':
        return {
          label: 'Researchers / Project Staff',
          shortLabel: 'Researcher',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          darkBadgeClass: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40',
          icon: Microscope,
          emoji: '🔬'
        };
      case 'diploma_trainee':
        return {
          label: 'Diploma Trainee',
          shortLabel: 'Diploma Trainee',
          badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
          darkBadgeClass: 'bg-teal-500/30 text-teal-200 border-teal-400/40',
          icon: Award,
          emoji: '📜'
        };
      case 'intern':
        return {
          label: 'Interns',
          shortLabel: 'Intern',
          badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
          darkBadgeClass: 'bg-sky-500/30 text-sky-200 border-sky-400/40',
          icon: UserCheck,
          emoji: '🧑‍💻'
        };
      case 'bsc_msc_student':
        return {
          label: 'BSc / MSc Students',
          shortLabel: 'BSc/MSc Student',
          badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          darkBadgeClass: 'bg-cyan-500/30 text-cyan-200 border-cyan-400/40',
          icon: BookOpen,
          emoji: '📚'
        };
      case 'phd_student':
        return {
          label: 'PhD Students',
          shortLabel: 'PhD Student',
          badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
          darkBadgeClass: 'bg-indigo-500/30 text-indigo-200 border-indigo-400/40',
          icon: GraduationCap,
          emoji: '🎓'
        };
      default:
        return {
          label: 'Staff Member',
          shortLabel: 'Staff',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
          darkBadgeClass: 'bg-slate-500/30 text-slate-200 border-slate-400/40',
          icon: UserIcon,
          emoji: '👤'
        };
    }
  };

  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const selectedUser = users.find((u) => u.id === selectedUserId) || currentUser;

  // Calculate retirement date: last day of the 60th birthday month
  const calculateRetirementDate = (dobStr?: string): string => {
    if (!dobStr) return 'Not Provided';
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return 'Not Provided';
    const year60 = dob.getFullYear() + 60;
    const month = dob.getMonth(); // 0-indexed
    const lastDay = new Date(year60, month + 1, 0); // last day of 60th birthday month
    const y = lastDay.getFullYear();
    const m = String(lastDay.getMonth() + 1).padStart(2, '0');
    const d = String(lastDay.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  };

  // Calculate total tenure in service
  const calculateServiceTenure = (joiningDateStr?: string): string => {
    if (!joiningDateStr) return 'Service Record Active';
    const join = new Date(joiningDateStr);
    if (isNaN(join.getTime())) return `Joined: ${joiningDateStr}`;
    const now = new Date();
    let years = now.getFullYear() - join.getFullYear();
    let months = now.getMonth() - join.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years <= 0 && months <= 0) return 'Joined Recently';
    const yStr = years > 0 ? `${years} Year${years > 1 ? 's' : ''}` : '';
    const mStr = months > 0 ? `${months} Month${months > 1 ? 's' : ''}` : '';
    return `${[yStr, mStr].filter(Boolean).join(', ')} in Service`;
  };

  // Modals and Toasts State
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    gender: 'Male',
    phone: '',
    emergencyContactPhone: '',
    biometricId: '',
    shiftId: shifts.find((s) => s.isDefault)?.id || shifts[0]?.id || 'shift-gen',
    leaveCycle: 'CY' as 'CY' | 'FY',
    leaveCycleBasis: 'calendar_year' as 'calendar_year' | 'financial_year',
    department: 'Wildlife Sciences',
    designation: 'Research Associate',
    role: 'general_staff' as UserRole,
    employmentType: 'permanent' as EmploymentType,
    employeeCategory: 'Administrative / Scientific / Technical / Support',
    isPhDEnrolled: false,
    officeLocation: 'Main Campus, Building A',
    reportingManagerId: users.find((u) => u.role === 'reporting_manager')?.id || '',
    reviewingManagerId: users.find((u) => u.role === 'reviewing_manager')?.id || '',
    joiningDate: new Date().toISOString().split('T')[0],
    dob: '',
    isOnProbation: false,
    probationEndDate: '',
    validUntilDate: '',
    piName: '',
    hodName: '',
    courseProgram: '',
    guideSupervisor: ''
  });

  // Password reset modal (display result)
  const [passwordResetModal, setPasswordResetModal] = useState<{
    user: UserType;
    tempPass: string;
  } | null>(null);

  // Password Reset Form Modal State
  const [userToResetPasswordForm, setUserToResetPasswordForm] = useState<UserType | null>(null);
  const [resetPassForm, setResetPassForm] = useState({
    mode: 'auto' as 'auto' | 'custom',
    customPassword: '',
    confirmPassword: '',
    reason: 'Official Reset Request',
    showPassword: false
  });

  // Status Change (Deactivate / Reactivate) Form Modal State
  const [userToToggleStatusModal, setUserToToggleStatusModal] = useState<UserType | null>(null);
  const [statusChangeForm, setStatusChangeForm] = useState({
    reasonCategory: 'End of Contract / Tenure',
    customNotes: '',
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  // Delete user confirmation
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);

  // Role Edit Modal State
  const [userToEditRoles, setUserToEditRoles] = useState<UserType | null>(null);
  const [editUserBaseRole, setEditUserBaseRole] = useState<UserRole>('general_staff');
  const [editUserRolesState, setEditUserRolesState] = useState<UserRole[]>(['general_staff']);
  const [editUserModuleRolesState, setEditUserModuleRolesState] = useState<Record<string, string[]>>({});
  const [editUserL1, setEditUserL1] = useState<string>('');
  const [editUserL2, setEditUserL2] = useState<string>('');
  const [editUserShift, setEditUserShift] = useState<string>('shift-gen-01');
  const [editUserEmpType, setEditUserEmpType] = useState<EmploymentType>('permanent');

  const handleOpenEditRoles = (u: UserType) => {
    if (u.id === currentUser.id) {
      showToast('Administrators cannot edit their own roles.');
      return;
    }
    setUserToEditRoles(u);
    setEditUserBaseRole(u.role);
    setEditUserRolesState(getUserRoles(u));
    setEditUserL1(u.reportingManagerId || '');
    setEditUserL2(u.reviewingManagerId || '');
    setEditUserShift(u.shiftId || 'shift-gen-01');
    setEditUserEmpType(u.employmentType || 'permanent');

    const modRoles: Record<string, string[]> = {
      lams: getUserModuleRoles(u, 'lams'),
      pms: getUserModuleRoles(u, 'pms'),
      sims: getUserModuleRoles(u, 'sims'),
      fms: getUserModuleRoles(u, 'fms'),
      finance: getUserModuleRoles(u, 'finance')
    };
    setEditUserModuleRolesState(modRoles);
  };

  // Live Summary of all Assigned Roles in Matrix
  const activeAssignedRolesSummary = useMemo(() => {
    const list: {
      id: string;
      name: string;
      moduleLabel: string;
      color: string;
      bgClass: string;
      borderClass: string;
      textClass: string;
    }[] = [];

    // Enterprise Module Roles (HRMS, PMS, Stock, Finance, Facility)
    const moduleLabels: Record<string, string> = {
      lams: 'HRMS',
      pms: 'PMS',
      sims: 'Stock',
      finance: 'Finance',
      fms: 'Facility'
    };

    Object.entries(editUserModuleRolesState).forEach(([modId, rawRoleIds]) => {
      const defs = MODULE_ROLE_DEFINITIONS[modId as EnterpriseModuleId] || [];
      const roleIds = Array.isArray(rawRoleIds) ? (rawRoleIds as string[]) : [];
      roleIds.forEach((rId) => {
        const matched = defs.find((d) => d.id === rId);
        if (matched) {
          list.push({
            id: `${modId}-${rId}`,
            name: matched.name,
            moduleLabel: moduleLabels[modId] || modId.toUpperCase(),
            color: matched.color || 'indigo',
            bgClass: matched.badgeBg || 'bg-indigo-100',
            borderClass: matched.badgeBg?.includes('border-') ? '' : 'border-indigo-300',
            textClass: matched.badgeText || 'text-indigo-900'
          });
        }
      });
    });

    return list;
  }, [editUserModuleRolesState]);

  const handleToggleSystemRoleInMatrix = (role: UserRole) => {
    if (editUserRolesState.includes(role)) {
      if (editUserRolesState.length > 1) {
        const next = editUserRolesState.filter((r) => r !== role);
        setEditUserRolesState(next);
        if (editUserBaseRole === role) {
          setEditUserBaseRole(next[0] || 'general_staff');
        }
      } else {
        showToast('At least one system role must remain active.');
      }
    } else {
      setEditUserRolesState([...editUserRolesState, role]);
      if (role === 'administrator') {
        setEditUserBaseRole('administrator');
      }
    }
  };

  const handleToggleModuleRoleInProfile = (moduleId: string, roleId: string) => {
    setEditUserModuleRolesState((prev) => {
      const current = prev[moduleId] || [];
      const updated = current.includes(roleId)
        ? current.filter((r) => r !== roleId)
        : [...current, roleId];
      return { ...prev, [moduleId]: updated };
    });
  };

  const handleApplyPresetInProfile = (
    presetType: 'super_admin' | 'hod_pi' | 'store_keeper' | 'finance_ddo' | 'research_fellow' | 'reset_staff'
  ) => {
    if (presetType === 'super_admin') {
      setEditUserBaseRole('administrator');
      setEditUserRolesState(['administrator', 'reviewing_manager', 'reporting_manager', 'general_staff']);
      setEditUserModuleRolesState({
        lams: ['hrms_admin', 'hrms_reviewing', 'hrms_reporting', 'hrms_staff'],
        pms: ['pms_admin', 'pms_pi', 'pms_reviewer'],
        sims: ['sims_admin', 'sims_store_keeper', 'sims_approver'],
        fms: ['fms_admin', 'fms_officer'],
        finance: ['fin_admin', 'fin_officer', 'fin_accountant']
      });
    } else if (presetType === 'hod_pi') {
      setEditUserBaseRole('reviewing_manager');
      setEditUserRolesState(['reviewing_manager', 'reporting_manager', 'general_staff']);
      setEditUserModuleRolesState({
        lams: ['hrms_reviewing', 'hrms_reporting', 'hrms_staff'],
        pms: ['pms_pi', 'pms_reviewer'],
        sims: ['sims_approver', 'sims_indenter'],
        fms: ['fms_requester'],
        finance: ['fin_officer', 'fin_claimant']
      });
    } else if (presetType === 'store_keeper') {
      setEditUserBaseRole('reporting_manager');
      setEditUserRolesState(['reporting_manager', 'general_staff']);
      setEditUserModuleRolesState({
        lams: ['hrms_staff'],
        pms: ['pms_researcher'],
        sims: ['sims_store_keeper', 'sims_approver', 'sims_indenter'],
        fms: ['fms_supervisor', 'fms_requester'],
        finance: ['fin_claimant']
      });
    } else if (presetType === 'finance_ddo') {
      setEditUserBaseRole('reviewing_manager');
      setEditUserRolesState(['reviewing_manager', 'reporting_manager', 'general_staff']);
      setEditUserModuleRolesState({
        lams: ['hrms_reviewing', 'hrms_staff'],
        pms: ['pms_reviewer'],
        sims: ['sims_approver'],
        fms: ['fms_officer'],
        finance: ['fin_admin', 'fin_officer', 'fin_accountant', 'fin_claimant']
      });
    } else if (presetType === 'research_fellow') {
      setEditUserBaseRole('general_staff');
      setEditUserRolesState(['general_staff']);
      setEditUserEmpType('researcher');
      setEditUserModuleRolesState({
        lams: ['hrms_staff'],
        pms: ['pms_researcher'],
        sims: ['sims_indenter'],
        fms: ['fms_requester'],
        finance: ['fin_claimant']
      });
    } else if (presetType === 'reset_staff') {
      setEditUserBaseRole('general_staff');
      setEditUserRolesState(['general_staff']);
      setEditUserEmpType('permanent');
      setEditUserModuleRolesState({
        lams: ['hrms_staff'],
        pms: ['pms_researcher'],
        sims: ['sims_indenter'],
        fms: ['fms_requester'],
        finance: ['fin_claimant']
      });
    }
    showToast('Role preset applied to matrix! Click Save to confirm.');
  };

  const handleSaveRoleChangesInProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEditRoles) return;

    // Synchronize system roles based on assigned matrix tiers
    const hasAdmin = (editUserModuleRolesState.lams || []).includes('hrms_admin') ||
      (editUserModuleRolesState.pms || []).includes('pms_admin') ||
      (editUserModuleRolesState.sims || []).includes('sims_admin') ||
      (editUserModuleRolesState.finance || []).includes('fin_admin') ||
      (editUserModuleRolesState.fms || []).includes('fms_admin');

    const hasL2 = (editUserModuleRolesState.lams || []).includes('hrms_reviewing') ||
      (editUserModuleRolesState.pms || []).includes('pms_pi') ||
      (editUserModuleRolesState.sims || []).includes('sims_approver') ||
      (editUserModuleRolesState.finance || []).includes('fin_officer') ||
      (editUserModuleRolesState.fms || []).includes('fms_officer');

    const hasL1 = (editUserModuleRolesState.lams || []).includes('hrms_reporting') ||
      (editUserModuleRolesState.pms || []).includes('pms_co_pi') ||
      (editUserModuleRolesState.pms || []).includes('pms_reviewer') ||
      (editUserModuleRolesState.sims || []).includes('sims_store_keeper') ||
      (editUserModuleRolesState.finance || []).includes('fin_accountant') ||
      (editUserModuleRolesState.fms || []).includes('fms_supervisor');

    const syncedRoles: UserRole[] = ['general_staff'];
    if (hasL1) syncedRoles.push('reporting_manager');
    if (hasL2) syncedRoles.push('reviewing_manager');
    if (hasAdmin) syncedRoles.push('administrator');

    let highestRole: UserRole = 'general_staff';
    if (hasAdmin) highestRole = 'administrator';
    else if (hasL2) highestRole = 'reviewing_manager';
    else if (hasL1) highestRole = 'reporting_manager';

    // 1. Update Core Role & Hierarchy
    updateUserRoleAndHierarchy(
      userToEditRoles.id,
      highestRole,
      userToEditRoles.employmentType || editUserEmpType || 'permanent',
      userToEditRoles.reportingManagerId,
      userToEditRoles.reviewingManagerId,
      syncedRoles
    );

    // 2. Update Module Roles
    updateUserProfile(userToEditRoles.id, {
      role: highestRole,
      roles: syncedRoles,
      moduleRoles: editUserModuleRolesState
    });

    showToast(`Role allocation & module permissions updated for ${userToEditRoles.name}`);
    setUserToEditRoles(null);
  };

  // Separate Dedicated Modals for Transfer vs Manager Replacement
  const [activeTransferModal, setActiveTransferModal] = useState<'none' | 'employee_transfer' | 'manager_replacement'>('none');
  
  // Single & Multi Employee Transfer State
  const [selectedTransferUserIds, setSelectedTransferUserIds] = useState<string[]>([]);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [transferDeptFilter, setTransferDeptFilter] = useState('all');

  const [transferForm, setTransferForm] = useState({
    newDept: 'Wildlife Sciences',
    newReportingManagerId: '',
    newReviewingManagerId: '',
    newLocation: 'Main Campus, Building B',
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Manager Replacement / Cascading Migration Form State
  const [managerReplacementForm, setManagerReplacementForm] = useState({
    outgoingManagerId: '',
    incomingManagerId: '',
    reassignType: 'both' as 'reporting' | 'reviewing' | 'both',
    selectedReporteeIds: [] as string[],
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Transfer Register Search/Filter State
  const [transferRegisterSearch, setTransferRegisterSearch] = useState('');
  const [transferRegisterDeptFilter, setTransferRegisterDeptFilter] = useState<string[]>(['all']);
  const [transferRegisterTypeFilter, setTransferRegisterTypeFilter] = useState<string[]>(['all']);

  const handleExportTransfersPDF = () => {
    window.print();
  };

  // Search & Multi-Select Filters in User Controls (Module, Role, Status)
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userControlsModuleFilter, setUserControlsModuleFilter] = useState<string[]>(['all']);
  const [userControlsRoleFilter, setUserControlsRoleFilter] = useState<string[]>(['all']);
  const [userControlsStatusFilter, setUserControlsStatusFilter] = useState<string[]>(['all']);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getEmploymentTypeLabel = (type: EmploymentType) => {
    switch (type) {
      case 'permanent':
        return 'Permanent Employees';
      case 'contractual':
        return 'Contractual Employees';
      case 'researcher':
        return 'Researchers / Project Staff';
      case 'diploma_trainee':
        return 'Diploma Trainee';
      case 'intern':
        return 'Interns';
      case 'bsc_msc_student':
        return 'BSc / MSc Students';
      case 'phd_student':
        return 'PhD Students';
      default:
        return type;
    }
  };

  // Handlers
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editingUser.biometricId?.trim() && !editingUser.emergencyContactPhone?.trim()) {
      alert('Biometric ID is mandatory. Please provide a valid Biometric ID.');
      return;
    }
    updateUserProfile(editingUser.id, editingUser);
    showToast(`Profile for ${editingUser.name} updated successfully!`);
    setEditingUser(null);
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name?.trim() || !newUserForm.email?.trim() || (!newUserForm.biometricId?.trim() && !newUserForm.emergencyContactPhone?.trim())) {
      alert('Please fill in required fields: Name, Email & Biometric ID');
      return;
    }

    const defaultShiftId = shifts.find((s) => s.isDefault)?.id || shifts[0]?.id || 'shift-gen';
    const chosenCycle = newUserForm.leaveCycle || (isCalendarYearCadre(newUserForm.employmentType) ? 'CY' : 'FY');

    const created = addUserProfile({
      name: newUserForm.name,
      email: newUserForm.email,
      gender: newUserForm.gender,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80`,
      role: newUserForm.role || 'general_staff',
      employmentType: newUserForm.employmentType,
      employeeCategory: newUserForm.employeeCategory,
      isPhDEnrolled: newUserForm.isPhDEnrolled,
      department: newUserForm.department,
      designation: newUserForm.designation,
      phone: newUserForm.phone || '+91 98765 00000',
      emergencyContactPhone: newUserForm.emergencyContactPhone || newUserForm.biometricId,
      biometricId: newUserForm.biometricId || newUserForm.emergencyContactPhone,
      shiftId: newUserForm.shiftId || defaultShiftId,
      leaveCycle: chosenCycle,
      leaveCycleBasis: chosenCycle === 'FY' ? 'financial_year' : 'calendar_year',
      officeLocation: newUserForm.officeLocation,
      reportingManagerId: newUserForm.reportingManagerId,
      reviewingManagerId: newUserForm.reviewingManagerId,
      joiningDate: newUserForm.joiningDate || new Date().toISOString().split('T')[0],
      dob: newUserForm.dob,
      isOnProbation: newUserForm.isOnProbation,
      probationEndDate: newUserForm.probationEndDate,
      validUntilDate: newUserForm.validUntilDate,
      piName: newUserForm.piName,
      hodName: newUserForm.hodName,
      courseProgram: newUserForm.courseProgram,
      guideSupervisor: newUserForm.guideSupervisor,
      status: 'active'
    });

    showToast(`New employee profile created for ${created.name}!`);
    setIsCreatingUser(false);
    setSelectedUserId(created.id);
  };

  const handleOpenCreateEmployeeModal = () => {
    const defaultShiftId = shifts.find((s) => s.isDefault)?.id || shifts[0]?.id || 'shift-gen';
    setNewUserForm({
      name: '',
      email: '',
      gender: 'Male',
      phone: '',
      emergencyContactPhone: '',
      biometricId: '',
      shiftId: defaultShiftId,
      leaveCycle: 'CY',
      leaveCycleBasis: 'calendar_year',
      department: 'Wildlife Sciences',
      designation: 'Research Associate',
      role: 'general_staff' as UserRole,
      employmentType: 'permanent' as EmploymentType,
      employeeCategory: 'Administrative / Scientific / Technical / Support',
      isPhDEnrolled: false,
      officeLocation: 'Main Campus, Building A',
      reportingManagerId: users.find((u) => u.role === 'reporting_manager')?.id || '',
      reviewingManagerId: users.find((u) => u.role === 'reviewing_manager')?.id || '',
      joiningDate: new Date().toISOString().split('T')[0],
      dob: '',
      isOnProbation: false,
      probationEndDate: '',
      validUntilDate: '',
      piName: '',
      hodName: '',
      courseProgram: '',
      guideSupervisor: ''
    });
    setIsCreatingUser(true);
  };

  const handleTriggerResetPassword = (u: UserType) => {
    if (u.id === currentUser.id) {
      showToast('Administrators cannot reset their own password from user controls.');
      return;
    }
    setUserToResetPasswordForm(u);
    setResetPassForm({
      mode: 'auto',
      customPassword: '',
      confirmPassword: '',
      reason: 'Official Reset Request',
      showPassword: false
    });
  };

  const handleExecuteResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToResetPasswordForm) return;

    if (resetPassForm.mode === 'custom') {
      if (!resetPassForm.customPassword || resetPassForm.customPassword.length < 6) {
        showToast('Custom password must be at least 6 characters long.');
        return;
      }
      if (resetPassForm.customPassword !== resetPassForm.confirmPassword) {
        showToast('Passwords do not match. Please re-enter.');
        return;
      }
    }

    const tempPass = resetUserPassword(
      userToResetPasswordForm.id,
      resetPassForm.mode === 'custom' ? resetPassForm.customPassword : undefined,
      resetPassForm.reason
    );

    const target = userToResetPasswordForm;
    setUserToResetPasswordForm(null);
    setPasswordResetModal({ user: target, tempPass });
    showToast(`Password successfully reset for ${target.name}`);
  };

  const handleOpenStatusToggleModal = (u: UserType) => {
    if (u.id === currentUser.id) {
      showToast('Administrators cannot change their own account status.');
      return;
    }
    const isDeactivating = u.status === 'active';
    setUserToToggleStatusModal(u);
    setStatusChangeForm({
      reasonCategory: isDeactivating ? 'End of Contract / Tenure' : 'Re-instated by Administration',
      customNotes: '',
      effectiveDate: new Date().toISOString().split('T')[0]
    });
  };

  const handleExecuteStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToToggleStatusModal) return;

    const fullReason = `${statusChangeForm.reasonCategory}${statusChangeForm.customNotes ? ` (${statusChangeForm.customNotes})` : ''}`;
    toggleUserStatus(userToToggleStatusModal.id, fullReason, statusChangeForm.effectiveDate);

    const isActivating = userToToggleStatusModal.status === 'deactivated';
    showToast(`Account status for ${userToToggleStatusModal.name} changed to ${isActivating ? 'Active' : 'Deactivated'}`);
    setUserToToggleStatusModal(null);
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    deleteUser(userToDelete.id);
    showToast(`User ${userToDelete.name} deleted successfully.`);
    setUserToDelete(null);
  };

  // Compute direct reportees under the outgoing manager for the replacement mode
  const reporteesUnderOutgoing = useMemo(() => {
    if (!managerReplacementForm.outgoingManagerId) return [];
    const outMgr = users.find((u) => u.id === managerReplacementForm.outgoingManagerId);
    return users.filter((u) => {
      if (u.id === managerReplacementForm.outgoingManagerId) return false;
      const isReporting = u.reportingManagerId === managerReplacementForm.outgoingManagerId;
      const isReviewing = u.reviewingManagerId === managerReplacementForm.outgoingManagerId || (outMgr && u.hodName === outMgr.name);
      if (managerReplacementForm.reassignType === 'reporting') return isReporting;
      if (managerReplacementForm.reassignType === 'reviewing') return isReviewing;
      return isReporting || isReviewing;
    });
  }, [users, managerReplacementForm.outgoingManagerId, managerReplacementForm.reassignType]);

  const handleOpenTransferModal = (u?: UserType) => {
    setTransferSearchQuery('');
    setTransferDeptFilter('all');
    if (u) {
      setSelectedTransferUserIds([u.id]);
      setTransferForm({
        newDept: u.department,
        newReportingManagerId: u.reportingManagerId || '',
        newReviewingManagerId: u.reviewingManagerId || '',
        newLocation: u.officeLocation || 'Main Campus, Building B',
        effectiveDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } else {
      setSelectedTransferUserIds([]);
      setTransferForm({
        newDept: DEPARTMENTS_MASTER[0] || 'Wildlife Sciences',
        newReportingManagerId: '',
        newReviewingManagerId: '',
        newLocation: 'Main Campus, Building B',
        effectiveDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setActiveTransferModal('employee_transfer');
  };

  const handleOpenManagerReplacementModal = (outgoingMgrId?: string) => {
    const defaultOutgoing = outgoingMgrId || users.find((u) => u.role === 'reporting_manager' || u.role === 'reviewing_manager')?.id || users[0]?.id || '';
    const defaultIncoming = users.find((u) => (u.role === 'reporting_manager' || u.role === 'reviewing_manager' || u.role === 'administrator') && u.id !== defaultOutgoing)?.id || '';

    const initialReportees = users
      .filter((u) => u.reportingManagerId === defaultOutgoing || u.reviewingManagerId === defaultOutgoing)
      .map((u) => u.id);

    setManagerReplacementForm({
      outgoingManagerId: defaultOutgoing,
      incomingManagerId: defaultIncoming,
      reassignType: 'both',
      selectedReporteeIds: initialReportees,
      effectiveDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setActiveTransferModal('manager_replacement');
  };

  const handleSingleMultiTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTransferUserIds.length === 0) {
      showToast('Please select at least one employee for transfer.');
      return;
    }

    const finalNotes = transferForm.notes.trim() || 'Official Transfer Order';
    if (selectedTransferUserIds.length === 1) {
      const singleId = selectedTransferUserIds[0];
      transferUser(singleId, {
        newDept: transferForm.newDept,
        newReportingManagerId: transferForm.newReportingManagerId,
        newReviewingManagerId: transferForm.newReviewingManagerId,
        newLocation: transferForm.newLocation,
        effectiveDate: transferForm.effectiveDate,
        notes: finalNotes
      });
      const singleUser = users.find((u) => u.id === singleId);
      showToast(`Transfer executed for ${singleUser?.name || 'Employee'}`);
    } else {
      const result = bulkTransferUsers(selectedTransferUserIds, {
        newDept: transferForm.newDept,
        newReportingManagerId: transferForm.newReportingManagerId,
        newReviewingManagerId: transferForm.newReviewingManagerId,
        newLocation: transferForm.newLocation,
        effectiveDate: transferForm.effectiveDate,
        notes: finalNotes
      });
      showToast(result.message);
    }
    setActiveTransferModal('none');
  };

  const handleManagerReplacementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerReplacementForm.outgoingManagerId || !managerReplacementForm.incomingManagerId) {
      showToast('Please select both Outgoing and Incoming Managers.');
      return;
    }

    if (managerReplacementForm.outgoingManagerId === managerReplacementForm.incomingManagerId) {
      showToast('Outgoing and Incoming Manager cannot be the same person.');
      return;
    }

    const finalNotes = managerReplacementForm.notes.trim() || 'Manager Reassignment Order';
    const result = bulkReassignManager({
      outgoingManagerId: managerReplacementForm.outgoingManagerId,
      incomingManagerId: managerReplacementForm.incomingManagerId,
      reassignType: managerReplacementForm.reassignType,
      selectedUserIds: managerReplacementForm.selectedReporteeIds,
      effectiveDate: managerReplacementForm.effectiveDate,
      notes: finalNotes
    });

    showToast(result.message);
    setActiveTransferModal('none');
  };

  const handleExportTransfersCSV = () => {
    if (transferLogs.length === 0) {
      showToast('No transfer records to export.');
      return;
    }
    const headers = ['Log ID', 'Employee Name', 'Previous Dept', 'New Dept', 'Previous Manager', 'New Manager', 'Effective Date', 'Authorized By', 'Timestamp', 'Notes'];
    const rows = transferLogs.map((l) => [
      l.id,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.previousDept.replace(/"/g, '""')}"`,
      `"${l.newDept.replace(/"/g, '""')}"`,
      `"${l.previousManagerName.replace(/"/g, '""')}"`,
      `"${l.newManagerName.replace(/"/g, '""')}"`,
      l.effectiveDate,
      `"${l.transferredBy.replace(/"/g, '""')}"`,
      `"${l.timestamp.replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WII_Transfer_Posting_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Transfer Register exported as CSV!');
  };

  const handleExportUserControlsCSV = () => {
    if (filteredUsersForControls.length === 0) {
      showToast('No user records match the current filter criteria.');
      return;
    }
    const headers = ['User ID', 'Name', 'Email', 'Biometric ID', 'Department', 'Designation', 'Primary Role', 'Assigned Roles', 'Account Status'];
    const rows = filteredUsersForControls.map((u) => [
      u.id,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      `"${(u.biometricId || '').replace(/"/g, '""')}"`,
      `"${(u.department || '').replace(/"/g, '""')}"`,
      `"${(u.designation || '').replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${(u.roles || [u.role]).join('; ')}"`,
      `"${u.status || 'active'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WII_User_Permissions_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('User Access & Permissions Register exported as CSV!');
  };

  const handleExportUserControlsPDF = () => {
    window.print();
  };

  // Filtered Users for User Controls tab
  const filteredUsersForControls = useMemo(() => {
    return users.filter((u) => {
      const q = userSearchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        (u.biometricId && u.biometricId.toLowerCase().includes(q));

      const matchModule =
        userControlsModuleFilter.includes('all') ||
        userControlsModuleFilter.some((m) => {
          if (m === 'lams' || m === 'hrms') return true;
          if (m === 'pms') return (u.moduleRoles?.pms && u.moduleRoles.pms.length > 0) || u.role === 'administrator';
          if (m === 'sims' || m === 'stock') return (u.moduleRoles?.sims && u.moduleRoles.sims.length > 0) || u.role === 'administrator';
          if (m === 'fms' || m === 'facility') return (u.moduleRoles?.fms && u.moduleRoles.fms.length > 0) || u.role === 'administrator';
          if (m === 'finance') return (u.moduleRoles?.finance && u.moduleRoles.finance.length > 0) || u.role === 'administrator';
          return false;
        });

      const matchRole =
        userControlsRoleFilter.includes('all') ||
        userControlsRoleFilter.includes(u.role) ||
        (u.roles && u.roles.some((r) => userControlsRoleFilter.includes(r)));

      const matchStatus =
        userControlsStatusFilter.includes('all') ||
        userControlsStatusFilter.includes(u.status || 'active');

      return matchSearch && matchModule && matchRole && matchStatus;
    });
  }, [
    users,
    userSearchTerm,
    userControlsModuleFilter,
    userControlsRoleFilter,
    userControlsStatusFilter
  ]);

  const [userControlsPage, setUserControlsPage] = useState(1);
  const [userControlsPageSize, setUserControlsPageSize] = useState(25);

  const paginatedUsersForControls = useMemo(() => {
    const start = (userControlsPage - 1) * userControlsPageSize;
    return filteredUsersForControls.slice(start, start + userControlsPageSize);
  }, [filteredUsersForControls, userControlsPage, userControlsPageSize]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={
          activeTab === 'user_controls'
            ? Shield
            : activeTab === 'transfers'
            ? ArrowLeftRight
            : UserIcon
        }
        title={
          activeTab === 'user_controls'
            ? 'User Controls & Roles'
            : activeTab === 'transfers'
            ? 'Employees Mapping'
            : isAdmin
            ? 'Employee Profiles & Directory'
            : isManager
            ? 'Employee Directory'
            : 'Profile'
        }
        subtitle={
          activeTab === 'user_controls'
            ? 'Manage user accounts, system roles, reporting hierarchy & access permissions'
            : activeTab === 'transfers'
            ? 'Manage employee department transfers, posting orders & manager replacements'
            : isAdmin
            ? 'Manage employee profiles, service cadres & official personnel records'
            : isManager
            ? 'View employee profiles, service cadre information & official contact details'
            : 'Personal employment record, service tenure, cadre details & official contact information'
        }
        rightAction={
          isAdmin ? (
            activeTab === 'profile' || !activeTab ? (
              <button
                type="button"
                onClick={handleOpenCreateEmployeeModal}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Add New Employee"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Employee</span>
              </button>
            ) : activeTab === 'transfers' ? (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleOpenTransferModal()}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Transfer single or multiple staff members"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>+ Employee Transfer</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenManagerReplacementModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Transfer all reportees of an outgoing manager to a replacement manager"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Manager Replacement</span>
                </button>
              </div>
            ) : undefined
          ) : undefined
        }
      />

      {/* Employee Profile Summary Stat Cards: Exactly 4 Uniform Cards matching standard theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Personnel */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Total Personnel</p>
            <p className="text-2xl font-black text-blue-900 mt-1">{profileStats.total}</p>
            <p className="text-[10px] text-blue-700 font-semibold mt-0.5">Active Employee Accounts</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-blue-700" />
          </div>
        </div>

        {/* 2. Permanent / Regular Staff */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Permanent Cadres</p>
            <p className="text-2xl font-black text-emerald-900 mt-1">{profileStats.regular}</p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Regular Service Staff</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
        </div>

        {/* 3. Contractual / Project Staff */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Contractual / Project</p>
            <p className="text-2xl font-black text-amber-900 mt-1">{profileStats.contractual}</p>
            <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Fellows &amp; Research Staff</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-amber-700" />
          </div>
        </div>

        {/* 4. Active Departments */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Departments &amp; Wings</p>
            <p className="text-2xl font-black text-purple-900 mt-1">{profileStats.depts}</p>
            <p className="text-[10px] text-purple-700 font-semibold mt-0.5">Organizational Units</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-purple-700" />
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: EMPLOYEE PROFILE DETAILS */}
      {/* ==================================================================== */}
      {(activeTab === 'profile' || !isAdmin) && (
        <div className="space-y-5">
          {/* Category Filter & Directory View Mode Switcher Console (Admin & Managers) */}
          {(isAdmin || isManager) && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
              {/* Top Bar: Clean Themed Scope & Export Action Buttons */}
              <div className="flex items-center justify-between gap-3.5 border-b border-slate-100 pb-3.5">
                {/* Left: Blank as requested */}
                <div />

                {/* Right: Export Buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={handleExportCSV}
                    className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Export Personnel Directory to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Print / Export Personnel Directory to PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              {/* Second Row: Search Input on Left, Reset and View Mode on Right */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search Box */}
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search staff, department, designation, biometric ID..."
                      value={profileSearchQuery}
                      onChange={(e) => setProfileSearchQuery(e.target.value)}
                      className="h-9 w-full pl-10 pr-9 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all shadow-2xs"
                    />
                    {profileSearchQuery && (
                      <button
                        onClick={() => setProfileSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Right Controls: Reset All Filters + View Switcher */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                    {/* Reset All Filters Pill Button */}
                    {(!selectedEmployeeFilter.includes('all') ||
                      !selectedDesignationFilter.includes('all') ||
                      !selectedDepartmentFilter.includes('all') ||
                      !selectedReportingMgrFilter.includes('all') ||
                      !selectedCategoryFilter.includes('all') ||
                      !selectedStatusFilter.includes('all') ||
                      profileSearchQuery !== '') && (
                      <button
                        onClick={() => {
                          setSelectedEmployeeFilter(['all']);
                          setSelectedDesignationFilter(['all']);
                          setSelectedDepartmentFilter(['all']);
                          setSelectedReportingMgrFilter(['all']);
                          setSelectedCategoryFilter(['all']);
                          setSelectedStatusFilter(['all']);
                          setProfileSearchQuery('');
                        }}
                        className="h-9 px-3.5 bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer shadow-2xs"
                        title="Reset all search and filter selections"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                        <span>Reset All Filters</span>
                      </button>
                    )}

                    {/* View Switcher Icons Container */}
                    <div className="h-9 flex items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0">
                      <button
                        onClick={() => setDirectoryViewMode('grid')}
                        className={`h-7 px-2 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                          directoryViewMode === 'grid'
                            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                        title="Grid View"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDirectoryViewMode('detail')}
                        className={`h-7 px-2 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                          directoryViewMode === 'detail'
                            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                        title="Detailed View"
                      >
                        <UserIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Third Row: Filters Row */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  {/* FILTERS Label */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
                      FILTERS
                    </span>
                  </div>

                {/* Single-line Filter Bar - All filters in one line */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap">
                  {/* 1. Employee Dropdown Pill */}
                  <div className="flex-1 min-w-[130px] max-w-[210px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Employee"
                      icon={<UserIcon className="w-3.5 h-3.5" />}
                      selectedValues={selectedEmployeeFilter}
                      onChange={(newVals) => {
                        setSelectedEmployeeFilter(newVals);
                        if (newVals.length === 1 && newVals[0] !== 'all') {
                          setSelectedUserId(newVals[0]);
                        }
                      }}
                      options={accessibleProfiles.map((u) => ({ label: u.name, value: u.id }))}
                    />
                  </div>

                  {/* 2. Designation Dropdown Pill */}
                  <div className="flex-1 min-w-[130px] max-w-[210px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Designation"
                      icon={<Filter className="w-3.5 h-3.5" />}
                      selectedValues={selectedDesignationFilter}
                      onChange={setSelectedDesignationFilter}
                      options={designationsList.map((desig) => ({ label: desig, value: desig }))}
                    />
                  </div>

                  {/* 3. Department Dropdown Pill */}
                  <div className="flex-1 min-w-[130px] max-w-[210px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Department"
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      selectedValues={selectedDepartmentFilter}
                      onChange={setSelectedDepartmentFilter}
                      options={DEPARTMENTS_MASTER.map((dept) => ({ label: dept, value: dept }))}
                    />
                  </div>

                  {/* 4. Reporting Mgr Dropdown Pill */}
                  <div className="flex-1 min-w-[130px] max-w-[210px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Reporting Manager"
                      icon={<UserIcon className="w-3.5 h-3.5" />}
                      selectedValues={selectedReportingMgrFilter}
                      onChange={setSelectedReportingMgrFilter}
                      options={reportingMgrsList.map((mgr) => ({ label: mgr.name, value: mgr.id }))}
                    />
                  </div>

                  {/* 5. Type (Category) Dropdown Pill */}
                  <div className="flex-1 min-w-[130px] max-w-[210px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Employment Type"
                      icon={<Filter className="w-3.5 h-3.5" />}
                      selectedValues={selectedCategoryFilter}
                      onChange={setSelectedCategoryFilter}
                      options={[
                        { label: `Permanent (${categoryCounts.permanent})`, value: 'permanent' },
                        { label: `Contractual (${categoryCounts.contractual})`, value: 'contractual' },
                        { label: `Researchers / Project Staff (${categoryCounts.researcher})`, value: 'researcher' },
                        { label: `Diploma Trainee (${categoryCounts.diploma_trainee})`, value: 'diploma_trainee' },
                        { label: `Interns (${categoryCounts.intern})`, value: 'intern' },
                        { label: `BSc / MSc Students (${categoryCounts.bsc_msc_student})`, value: 'bsc_msc_student' },
                        { label: `PhD Students (${categoryCounts.phd_student})`, value: 'phd_student' }
                      ]}
                    />
                  </div>

                  {/* 6. Status Dropdown Pill */}
                  <div className="flex-1 min-w-[120px] max-w-[180px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Status"
                      icon={<Clock className="w-3.5 h-3.5" />}
                      selectedValues={selectedStatusFilter}
                      onChange={setSelectedStatusFilter}
                      options={[
                        { label: 'Active', value: 'active' },
                        { label: 'Deactivated', value: 'deactivated' }
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Directory Rendering Switcher */}
          {((isAdmin || isManager) && directoryViewMode === 'grid') ? (
            /* ================================================================ */
            /* VIEW 1: CATEGORY CARDS GRID */
            /* ================================================================ */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>Showing <strong>{categoryFilteredProfiles.length}</strong> profile(s) in selected view</span>
                {selectedCategoryFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedCategoryFilter('all')}
                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                  >
                    Reset Filter (Show All)
                  </button>
                )}
              </div>

              {categoryFilteredProfiles.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                  <UserX className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-bold text-slate-800 text-sm">No profiles match the selected category & search criteria</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Try clearing your search query or switching to another category tab above.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategoryFilter('all');
                      setProfileSearchQuery('');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer inline-block"
                  >
                    Show All Profiles
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryFilteredProfiles.map((u) => {
                    const badge = getCategoryBadge(u);
                    const IconComp = badge.icon;
                    return (
                      <div
                        key={u.id}
                        className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          {/* Card Top Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-3">
                              <div className="relative shrink-0">
                                <img
                                  src={u.avatar}
                                  alt={u.name}
                                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100 shadow-2xs"
                                />
                                <span
                                  className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                    u.status === 'deactivated' ? 'bg-slate-400' : 'bg-emerald-500'
                                  }`}
                                />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-black text-slate-900 text-sm truncate">{u.name}</h4>
                                <p className="text-[11px] font-bold text-blue-600 truncate">{u.designation}</p>
                                <p className="text-[10px] text-slate-500 truncate">{u.department}</p>
                              </div>
                            </div>
                          </div>

                          {/* Category Badge Pill */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border flex items-center space-x-1 ${badge.badgeClass}`}>
                              <IconComp className="w-3 h-3 shrink-0" />
                              <span>{badge.label}</span>
                            </span>

                            {u.employmentType === 'researcher' && u.isPhDEnrolled && (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300 flex items-center space-x-1">
                                <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>Dual PhD Enrolled</span>
                              </span>
                            )}
                          </div>

                          {/* Category Specific Highlights */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1.5 text-slate-700">
                            {(u.employmentType === 'msc_student' || u.employmentType === 'phd_scholar' || u.isPhDEnrolled) && (
                              <>
                                {u.courseProgram && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Degree Program:</span>
                                    <span className="font-bold text-slate-900 truncate max-w-[170px]">{u.courseProgram}</span>
                                  </div>
                                )}
                                {u.universityName && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">University:</span>
                                    <span className="font-bold text-slate-800 truncate max-w-[170px]">{u.universityName}</span>
                                  </div>
                                )}
                                {u.phdUniversity && (
                                  <div className="flex justify-between">
                                    <span className="text-purple-600 font-semibold">PhD University:</span>
                                    <span className="font-bold text-purple-900 truncate max-w-[170px]">{u.phdUniversity}</span>
                                  </div>
                                )}
                                {(u.guideSupervisor || u.phdGuide) && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Supervisor / Guide:</span>
                                    <span className="font-bold text-slate-800 truncate max-w-[170px]">{u.phdGuide || u.guideSupervisor}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {(u.employmentType === 'trainee' || u.employmentType === 'intern') && (
                              <>
                                {u.parentInstitution && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">College / Institution:</span>
                                    <span className="font-bold text-slate-900 truncate max-w-[170px]">{u.parentInstitution}</span>
                                  </div>
                                )}
                                {u.internshipDuration && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Tenure Duration:</span>
                                    <span className="font-bold text-slate-800">{u.internshipDuration}</span>
                                  </div>
                                )}
                                {u.guideSupervisor && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Mentor Scientist:</span>
                                    <span className="font-bold text-slate-800 truncate max-w-[170px]">{u.guideSupervisor}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {(u.employmentType === 'permanent' || u.employmentType === 'contractual' || (u.employmentType === 'researcher' && !u.isPhDEnrolled)) && (
                              <>
                                {u.piName && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">PI / Project Lead:</span>
                                    <span className="font-bold text-slate-900 truncate max-w-[170px]">{u.piName}</span>
                                  </div>
                                )}
                                {u.joiningDate && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Date of Joining:</span>
                                    <span className="font-bold text-slate-800">{u.joiningDate}</span>
                                  </div>
                                )}
                                {u.validUntilDate && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Valid Up To:</span>
                                    <span className="font-bold text-amber-700">{u.validUntilDate}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action Controls */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setDirectoryViewMode('detail');
                            }}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-300" />
                            <span>View Full Profile</span>
                          </button>

                          <button
                            onClick={() => setHistoryUser(u)}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold p-2 rounded-xl text-xs border border-purple-200 cursor-pointer transition-colors"
                            title="View Project & Career History"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => {
                                const targetShiftId = u.shiftId || shifts.find((s) => s.isDefault)?.id || shifts[0]?.id || 'shift-gen';
                                const targetCycle = u.leaveCycle || getUserLeaveCycleType(u);
                                setEditingUser({
                                  ...u,
                                  shiftId: targetShiftId,
                                  leaveCycle: targetCycle,
                                  leaveCycleBasis: targetCycle === 'CY' ? 'calendar_year' : 'financial_year',
                                  biometricId: u.biometricId || u.emergencyContactPhone || ''
                                });
                              }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold p-2 rounded-xl text-xs border border-blue-200 cursor-pointer transition-colors"
                              title="Edit User Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ================================================================ */
            /* VIEW 2: DETAILED SELECTED PROFILE VIEW */
            /* ================================================================ */
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              {/* Unified Dark Navy Cover Header */}
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 relative text-white">
                {/* Top Bar inside Cover */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-blue-200 bg-white/10 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-xs uppercase tracking-wider">
                      Emp ID: {selectedUser.id}
                    </span>
                    {/* Category Badge Tag inside Navy Cover */}
                    {(() => {
                      const badge = getCategoryBadge(selectedUser);
                      const IconComp = badge.icon;
                      return (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border backdrop-blur-xs flex items-center space-x-1 ${badge.darkBadgeClass}`}>
                          <IconComp className="w-3 h-3 shrink-0" />
                          <span>{badge.label}</span>
                        </span>
                      );
                    })()}

                    {selectedUser.isPhDEnrolled && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-md border backdrop-blur-xs bg-purple-500/30 text-purple-200 border-purple-400/40 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-purple-300 shrink-0" />
                        <span>Dual PhD Scholar</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedUser.status === 'deactivated' && (
                      <span className="text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider bg-rose-500/20 text-rose-200 border border-rose-400/30">
                        Deactivated
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile Details Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-5">
                    <img
                      src={selectedUser.avatar}
                      alt={selectedUser.name}
                      className="w-22 h-22 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-xl bg-slate-800 shrink-0"
                    />
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-xs">{selectedUser.name}</h2>
                      <p className="text-xs sm:text-sm font-bold text-blue-300 mt-1">{selectedUser.designation}</p>
                      <p className="text-[11px] sm:text-xs font-medium text-slate-300 mt-0.5">{selectedUser.department}</p>
                    </div>
                  </div>

                  {/* Profile Banner Action Buttons */}
                  <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
                    <button
                      onClick={() => setHistoryUser(selectedUser)}
                      className="bg-purple-600/90 hover:bg-purple-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer border border-purple-400/30 backdrop-blur-xs transition-colors shadow-xs"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-purple-200" />
                      <span>Project &amp; Career History</span>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleOpenTransferModal(selectedUser)}
                          className="bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer border border-white/20 backdrop-blur-xs transition-colors"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-blue-300" />
                          <span>Transfer Employee</span>
                        </button>
                        <button
                          onClick={() => {
                            const targetShiftId = selectedUser.shiftId || shifts.find((s) => s.isDefault)?.id || shifts[0]?.id || 'shift-gen';
                            const targetCycle = selectedUser.leaveCycle || getUserLeaveCycleType(selectedUser);
                            setEditingUser({
                              ...selectedUser,
                              shiftId: targetShiftId,
                              leaveCycle: targetCycle,
                              leaveCycleBasis: targetCycle === 'CY' ? 'calendar_year' : 'financial_year',
                              biometricId: selectedUser.biometricId || selectedUser.emergencyContactPhone || ''
                            });
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-100" />
                          <span>Edit Profile</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Body Details */}
              <div className="p-6 space-y-6">

                {/* Personal Bio / Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Email Address</span>
                      <span className="font-semibold text-slate-900">{selectedUser.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Contact Phone</span>
                      <span className="font-semibold text-slate-900">
                        {selectedUser.phone || '+91 98765 43210'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <Fingerprint className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Biometric ID (Mandatory)</span>
                      <span className="font-mono text-xs font-extrabold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block">
                        {selectedUser.biometricId || selectedUser.emergencyContactPhone || `BIO-${selectedUser.id.replace('usr-', '100')}`}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Shift Display */}
                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Assigned Shift</span>
                      <span className="font-semibold text-slate-900 text-xs">
                        {(() => {
                          const userShift = shifts.find(s => s.id === selectedUser.shiftId) || shifts.find(s => s.isDefault) || shifts[0];
                          return userShift ? `${userShift.name} (${userShift.startTime} - ${userShift.endTime})` : 'General Shift';
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Leave Year Type Display */}
                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Leave Year Type</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {getUserLeaveCycleType(selectedUser) === 'CY' ? 'Calendar Year (Jan – Dec)' : 'Financial Year (Apr – Mar)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Slack Handle</span>
                      <span className="font-mono text-blue-700 font-semibold">
                        {selectedUser.slackHandle || `@${selectedUser.name.toLowerCase().replace(/\s+/g, '')}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Employment Category</span>
                      <span className="font-semibold text-slate-900">
                        {getEmploymentTypeLabel(selectedUser.employmentType)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Office Location</span>
                      <span className="font-semibold text-slate-900">
                        {selectedUser.officeLocation || 'Main Campus, Building B'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-slate-700 md:col-span-2 lg:col-span-3 pt-2 border-t border-slate-100">
                    <Shield className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Assigned System Roles</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(selectedUser.roles && selectedUser.roles.length > 0 ? selectedUser.roles : [selectedUser.role]).map((r) => (
                          <span
                            key={r}
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${getRoleBadgeStyle(r)}`}
                          >
                            {getRoleLabel(r)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Academic & Dissertation Profile Card for MSc, PhD, Trainees, Interns & Dual PhD Researchers */}
                {(selectedUser.employmentType === 'msc_student' ||
                  selectedUser.employmentType === 'phd_scholar' ||
                  selectedUser.employmentType === 'trainee' ||
                  selectedUser.employmentType === 'intern' ||
                  selectedUser.isPhDEnrolled) && (
                  <div className="mt-4 p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-3">
                    <div className="flex items-center space-x-2 text-indigo-950 font-black border-b border-indigo-200/80 pb-2">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <span>Academic Program, Dissertation &amp; Supervisor Details</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-slate-800">
                      {selectedUser.courseProgram && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">Degree / Course Program:</span>
                          <span className="font-bold text-slate-900">{selectedUser.courseProgram}</span>
                        </div>
                      )}
                      {selectedUser.courseBatch && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">Batch / Academic Year:</span>
                          <span className="font-bold text-slate-900">{selectedUser.courseBatch}</span>
                        </div>
                      )}
                      {selectedUser.universityName && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">Affiliated University / Institute:</span>
                          <span className="font-bold text-slate-900">{selectedUser.universityName}</span>
                        </div>
                      )}
                      {selectedUser.enrollmentNo && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">Enrollment / Registration No:</span>
                          <span className="font-bold font-mono text-indigo-900">{selectedUser.enrollmentNo}</span>
                        </div>
                      )}
                      {selectedUser.guideSupervisor && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">Guide / Academic Supervisor:</span>
                          <span className="font-bold text-slate-900">{selectedUser.guideSupervisor}</span>
                        </div>
                      )}
                      {selectedUser.parentInstitution && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">Parent Institution / College:</span>
                          <span className="font-bold text-slate-900">{selectedUser.parentInstitution}</span>
                        </div>
                      )}
                      {selectedUser.internshipDuration && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">Training / Internship Tenure:</span>
                          <span className="font-bold text-slate-900">{selectedUser.internshipDuration}</span>
                        </div>
                      )}
                    </div>

                    {/* Dual Status PhD Highlight Box */}
                    {selectedUser.isPhDEnrolled && (
                      <div className="mt-2 p-3 bg-purple-100/80 border border-purple-300 rounded-lg space-y-2">
                        <div className="flex items-center space-x-2 text-purple-900 font-black">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span>Enrolled PhD Research Details (Dual Status Researcher)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
                          <div>
                            <span className="text-purple-700 font-medium block text-[10px]">PhD Registered University:</span>
                            <span className="font-bold text-purple-950">{selectedUser.phdUniversity || 'Forest Research Institute (FRI)'}</span>
                          </div>
                          <div>
                            <span className="text-purple-700 font-medium block text-[10px]">PhD Thesis Guide:</span>
                            <span className="font-bold text-purple-950">{selectedUser.phdGuide || selectedUser.guideSupervisor || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-purple-700 font-medium block text-[10px]">PhD Registration Date:</span>
                            <span className="font-bold text-purple-950">{selectedUser.phdRegistrationDate || 'N/A'}</span>
                          </div>
                          <div className="sm:col-span-2 lg:col-span-3">
                            <span className="text-purple-700 font-medium block text-[10px]">PhD Thesis Topic / Title:</span>
                            <span className="font-bold text-purple-950">{selectedUser.phdTopic || 'Thesis Topic Under Approval'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cadre & Tenure Info for Permanent / Contractual */}
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-3">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold border-b border-slate-200/80 pb-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>Cadre, Tenure &amp; Reporting Details ({getEmploymentTypeLabel(selectedUser.employmentType)})</span>
                  </div>

                  {selectedUser.employmentType === 'permanent' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Date of Joining:</span>
                        <span className="font-bold text-slate-800">{selectedUser.joiningDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Date of Birth (DOB):</span>
                        <span className="font-bold text-slate-800">{selectedUser.dob || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Superannuation / Retirement Date:</span>
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                          {calculateRetirementDate(selectedUser.dob)}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">(Last day of 60th birthday month)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Probation Status:</span>
                        <span className="font-bold text-slate-800">
                          {selectedUser.isOnProbation
                            ? `Under Probation (Tentative End: ${selectedUser.probationEndDate || 'N/A'})`
                            : 'Probation Completed / Regular Staff'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Reporting Manager (Level 1):</span>
                        <span className="font-bold text-slate-800">
                          {users.find((u) => u.id === selectedUser.reportingManagerId)?.name || 'Not Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Head of Department (HoD) / Reviewing Manager:</span>
                        <span className="font-bold text-slate-800">
                          {selectedUser.hodName || users.find((u) => u.id === selectedUser.reviewingManagerId)?.name || 'Not Assigned'}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedUser.employmentType === 'contractual' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Joining Date:</span>
                        <span className="font-bold text-slate-800">{selectedUser.joiningDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Contract Valid Up To Date:</span>
                        <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                          {selectedUser.validUntilDate || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Principal Investigator (PI) / Project Head:</span>
                        <span className="font-bold text-slate-800">
                          {selectedUser.piName || users.find((u) => u.id === selectedUser.reportingManagerId)?.name || 'Not Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Reporting Manager:</span>
                        <span className="font-bold text-slate-800">
                          {users.find((u) => u.id === selectedUser.reportingManagerId)?.name || 'Not Assigned'}
                        </span>
                      </div>
                    </div>
                  )}

                  {(selectedUser.employmentType === 'researcher' || selectedUser.employmentType === 'phd_scholar' || selectedUser.employmentType === 'msc_student' || selectedUser.employmentType === 'trainee' || selectedUser.employmentType === 'intern') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Enrolment / Start Date:</span>
                        <span className="font-bold text-slate-800">{selectedUser.joiningDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Course / Program / Research Project:</span>
                        <span className="font-bold text-slate-800">
                          {selectedUser.courseProgram || selectedUser.designation || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Tenure / Valid Up To Date:</span>
                        <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                          {selectedUser.validUntilDate || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Supervisor / Guide / PI:</span>
                        <span className="font-bold text-slate-800">
                          {selectedUser.guideSupervisor || selectedUser.piName || users.find((u) => u.id === selectedUser.reportingManagerId)?.name || 'Not Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Reporting Manager:</span>
                        <span className="font-bold text-slate-800">
                          {users.find((u) => u.id === selectedUser.reportingManagerId)?.name || 'Not Assigned'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

              {/* ============================================================ */}
              {/* EMPLOYMENT & SERVICE HISTORY TIMELINE */}
              {/* ============================================================ */}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span>Employment &amp; Service Posting History</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{calculateServiceTenure(selectedUser.joiningDate)}</span>
                  </div>
                </div>

                {/* Timeline Container */}
                <div className="relative pl-5 border-l-2 border-slate-200 space-y-4 my-2">
                  {/* Current Active Posting Node */}
                  <div className="relative">
                    <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-900 text-xs">
                            {selectedUser.designation}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Current Active Posting
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {selectedUser.joiningDate ? `${selectedUser.joiningDate} — Present` : 'Present'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 font-medium block text-[10px]">Department:</span>
                          <span className="font-bold text-slate-800">{selectedUser.department}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block text-[10px]">Office Location:</span>
                          <span className="font-bold text-slate-800">{selectedUser.officeLocation || 'Main Campus, Building B'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block text-[10px]">Reporting Officer:</span>
                          <span className="font-bold text-slate-800">
                            {users.find((u) => u.id === selectedUser.reportingManagerId)?.name || 'Not Assigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transfer / Reassignment History Nodes */}
                  {transferLogs
                    .filter(
                      (t) =>
                        t.userId === selectedUser.id ||
                        t.userName.toLowerCase() === selectedUser.name.toLowerCase()
                    )
                    .map((t) => (
                      <div key={t.id} className="relative">
                        <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-blue-100 flex items-center justify-center">
                          <ArrowLeftRight className="w-2 h-2 text-white" />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-slate-900 text-xs">
                                Department Reassignment &amp; Transfer
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                Transferred
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Effective: {t.effectiveDate}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                            <div>
                              <span className="text-slate-400 font-medium block text-[10px]">Department Movement:</span>
                              <span className="font-bold text-slate-800">
                                {t.previousDept} <span className="text-blue-600 font-black">→</span> {t.newDept}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium block text-[10px]">Reporting Manager Transition:</span>
                              <span className="font-bold text-slate-800">
                                {t.previousManagerName} <span className="text-blue-600 font-black">→</span> {t.newManagerName}
                              </span>
                            </div>
                          </div>

                          {t.notes && (
                            <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-[10.5px] text-slate-700 font-medium">
                              <span className="font-bold text-slate-900">Office Order Note:</span> {t.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  {/* Regularization / Probation Completion Node */}
                  {!selectedUser.isOnProbation && selectedUser.employmentType === 'permanent' && (
                    <div className="relative">
                      <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-purple-500 ring-4 ring-purple-100 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">
                            Probation Completed &amp; Service Regularization
                          </span>
                          <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Regularized
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Successfully completed mandatory probation evaluation. Confirmed as regular permanent service cadre.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Initial Appointment Node */}
                  <div className="relative">
                    <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-slate-400 ring-4 ring-slate-100 flex items-center justify-center">
                      <Building className="w-2 h-2 text-white" />
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 text-xs">
                          Initial Appointment — Wildlife Institute of India
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {selectedUser.joiningDate || 'Date of Joining'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Joined Wildlife Institute of India as <span className="font-bold text-slate-800">{selectedUser.designation}</span> in the <span className="font-bold text-slate-800">{selectedUser.department}</span> under <span className="font-semibold text-slate-800">{getEmploymentTypeLabel(selectedUser.employmentType)}</span> cadre.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Block */}
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                <div className="flex items-center space-x-2 mb-1.5 text-slate-800 font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Emergency Contact Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Contact Name:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedUser.emergencyContactName || 'Family Contact / Guardian'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Contact Phone:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedUser.emergencyContactPhone || '+91 99887 76655'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {/* ==================================================================== */}
      {/* TAB 2: USER CONTROLS, ROLES & ACCOUNTS */}
      {/* ==================================================================== */}
      {activeTab === 'user_controls' && (
        <div className="space-y-4">
          {/* Category Filter Console for User Controls (Pic 2 Layout) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            {/* Top Bar: Clean Themed Scope & Export Action Buttons */}
            <div className="flex items-center justify-between gap-3.5 border-b border-slate-100 pb-3.5">
              {/* Left: Blank as requested */}
              <div />

              {/* Right: Export CSV & PDF Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleExportUserControlsCSV}
                  className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Export User Permissions Register to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportUserControlsPDF}
                  className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Print / Export User Permissions Register to PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            {/* Second Row: Search Input on Left, Reset on Right */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search user name, email, department, designation..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="h-9 w-full pl-10 pr-9 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  {userSearchTerm && (
                    <button
                      onClick={() => setUserSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Right Controls: Reset All Filters */}
                {(!userControlsModuleFilter.includes('all') ||
                  !userControlsRoleFilter.includes('all') ||
                  !userControlsStatusFilter.includes('all') ||
                  userSearchTerm !== '') && (
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => {
                        setUserControlsModuleFilter(['all']);
                        setUserControlsRoleFilter(['all']);
                        setUserControlsStatusFilter(['all']);
                        setUserSearchTerm('');
                      }}
                      className="h-9 px-3.5 bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer shadow-2xs"
                      title="Reset all search and filter selections"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                      <span>Reset All Filters</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Third Row: FILTERS */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    FILTERS
                  </span>
                </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap">
                {/* 1. Module Filter Pill */}
                <div className="flex-1 min-w-[150px] max-w-[240px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Module"
                    icon={<Building2 className="w-3.5 h-3.5" />}
                    selectedValues={userControlsModuleFilter}
                    onChange={setUserControlsModuleFilter}
                    options={[
                      { label: 'HRMS (Leave & Attendance)', value: 'hrms' },
                      { label: 'PMS (Project Management)', value: 'pms' },
                      { label: 'Stock & Inventory (SIMS)', value: 'stock' },
                      { label: 'Facility Management (FMS)', value: 'facility' },
                      { label: 'Finance & Budget', value: 'finance' }
                    ]}
                  />
                </div>

                {/* 2. System Role Dropdown Pill */}
                <div className="flex-1 min-w-[130px] max-w-[200px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Role"
                    icon={<Shield className="w-3.5 h-3.5" />}
                    selectedValues={userControlsRoleFilter}
                    onChange={setUserControlsRoleFilter}
                    options={[
                      { label: 'Administrator', value: 'administrator' },
                      { label: 'Reporting Manager', value: 'reporting_manager' },
                      { label: 'Reviewing Manager', value: 'reviewing_manager' },
                      { label: 'General Staff', value: 'general_staff' }
                    ]}
                  />
                </div>

                {/* 3. Account Status Dropdown Pill */}
                <div className="flex-1 min-w-[120px] max-w-[180px] shrink-0 sm:shrink">
                  <MultiSelectFilter
                    label="Status"
                    icon={<Clock className="w-3.5 h-3.5" />}
                    selectedValues={userControlsStatusFilter}
                    onChange={setUserControlsStatusFilter}
                    options={[
                      { label: 'Active', value: 'active' },
                      { label: 'Inactive / Suspended', value: 'inactive' }
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Controls Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
            <div className="w-full">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px] shadow-2xs">
                  <tr className="h-10">
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[28%]">Employee Details</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[44%]">Role &amp; Module</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[11%]">Status</th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap align-middle w-[17%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsersForControls.map((u) => {
                    const isSelf = u.id === currentUser.id;

                    const isSystemAdmin = u.roles?.includes('administrator') || u.role === 'administrator';
                    const isReviewing = u.roles?.includes('reviewing_manager') || u.role === 'reviewing_manager';
                    const isReporting = u.roles?.includes('reporting_manager') || u.role === 'reporting_manager';

                    const primarySystemRole: UserRole = isSystemAdmin
                      ? 'administrator'
                      : isReviewing
                      ? 'reviewing_manager'
                      : isReporting
                      ? 'reporting_manager'
                      : 'general_staff';

                    const reportingManagerObj = u.reportingManagerId
                      ? users.find((m) => m.id === u.reportingManagerId)
                      : null;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Employee Details (3 Lines: Name, Designation, Bio ID) */}
                        <td className="px-3.5 py-3 align-middle">
                          <div className="flex items-start space-x-2.5 min-w-0">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-7.5 h-7.5 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5 shadow-2xs"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-900 truncate text-xs block">{u.name}</span>
                              <span className="text-[11px] text-slate-500 font-medium block truncate mt-0.5">
                                {u.designation || 'Staff'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono tracking-tight block truncate mt-0.5">
                                {u.biometricId ? `Bio ID: ${u.biometricId}` : (u.id ? `Bio ID: ${u.id}` : 'Bio ID: N/A')}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Role & Module Column - Clean, Uniform Module Display */}
                        <td
                          onClick={() => handleOpenEditRoles(u)}
                          title="Click to view/edit Role & Module Matrix"
                          className="px-3.5 py-3 align-middle cursor-pointer hover:bg-slate-100/60 transition-colors group"
                        >
                          <div className="flex flex-col gap-1 max-w-full">
                            {(() => {
                              const ALL_MODULES: { id: EnterpriseModuleId; label: string }[] = [
                                { id: 'lams', label: 'HRMS' },
                                { id: 'pms', label: 'PMS' },
                                { id: 'sims', label: 'Stock' },
                                { id: 'finance', label: 'Finance' },
                                { id: 'fms', label: 'Facility' }
                              ];

                              const isSysAdmin = primarySystemRole === 'administrator';

                              const assignedModules = ALL_MODULES.map((m) => {
                                const roleIds = u.moduleRoles?.[m.id] || [];
                                const defs = MODULE_ROLE_DEFINITIONS[m.id] || [];

                                if (isSysAdmin) {
                                  return {
                                    id: m.id,
                                    label: m.label,
                                    hasAccess: true,
                                    roles: ['Admin']
                                  };
                                }

                                const roles = roleIds.map((rId) => {
                                  const found = defs.find((d) => d.id === rId);
                                  return found ? (found.shortName || found.name) : rId;
                                });

                                // Default fallback for LAMS ONLY if user has no explicit moduleRoles defined anywhere
                                if (roles.length === 0 && m.id === 'lams' && (!u.moduleRoles || Object.keys(u.moduleRoles).length === 0)) {
                                  if (primarySystemRole === 'reviewing_manager') roles.push('HoD / L2');
                                  else if (primarySystemRole === 'reporting_manager') roles.push('L1 Manager');
                                  else roles.push('HR Staff');
                                }

                                return {
                                  id: m.id,
                                  label: m.label,
                                  hasAccess: roles.length > 0,
                                  roles
                                };
                              }).filter((m) => m.hasAccess);

                              if (assignedModules.length === 0) {
                                return (
                                  <span className="text-[11px] text-slate-400 font-medium italic">
                                    No specific module permissions assigned
                                  </span>
                                );
                              }

                              return assignedModules.map((m) => (
                                <div
                                  key={m.id}
                                  className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-indigo-50/70 text-indigo-950 border border-indigo-200/90 text-[11px] font-medium shadow-2xs w-fit max-w-full"
                                >
                                  <span className="font-extrabold text-slate-900 bg-white/95 px-1.5 py-0.2 rounded border border-indigo-100 text-[10px] tracking-wide shrink-0">
                                    {m.label}
                                  </span>
                                  <span className="text-indigo-800 font-bold truncate">
                                    {m.roles.join(', ')}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        </td>

                        {/* 3. Status Column */}
                        <td className="px-3.5 py-3 align-middle">
                          {u.status === 'deactivated' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-extrabold text-[10px] uppercase">
                              <UserX className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>Deactivated</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-extrabold text-[10px] uppercase">
                              <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>Active</span>
                            </span>
                          )}
                        </td>

                        {/* 4. Actions Column */}
                        <td className="px-3.5 py-3 text-right align-middle">
                          <div className="flex items-center justify-end space-x-1">
                            {/* Project & Career History Button */}
                            <button
                              onClick={() => setHistoryUser(u)}
                              title="View Project & Career Posting History"
                              className="w-7 h-7 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold cursor-pointer text-xs inline-flex items-center justify-center border border-purple-200 transition-all active:scale-95 shadow-2xs shrink-0"
                            >
                              <Briefcase className="w-3.5 h-3.5 text-purple-600 stroke-[2]" />
                            </button>

                            {/* Edit User Roles & 2D Matrix Button */}
                            {isAdmin && (
                              <button
                                onClick={() => handleOpenEditRoles(u)}
                                title="Configure User Roles & 2D Matrix Permissions"
                                className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold cursor-pointer text-xs inline-flex items-center justify-center border border-indigo-200 transition-all active:scale-95 shadow-2xs shrink-0"
                              >
                                <Shield className="w-3.5 h-3.5 text-indigo-700 stroke-[2.2]" />
                              </button>
                            )}

                            {/* Reset Password */}
                            <button
                              onClick={() => handleTriggerResetPassword(u)}
                              title="Reset User Password"
                              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold cursor-pointer text-xs inline-flex items-center justify-center border border-slate-200 transition-all active:scale-95 shadow-2xs shrink-0"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-slate-600 stroke-[2]" />
                            </button>

                            {/* Toggle Active/Deactive */}
                            {isAdmin && !isSelf && (
                              <button
                                onClick={() => handleOpenStatusToggleModal(u)}
                                title={u.status === 'deactivated' ? 'Reactivate User' : 'Deactivate User'}
                                className={`w-7 h-7 rounded-lg font-bold cursor-pointer text-xs inline-flex items-center justify-center transition-all border active:scale-95 shadow-2xs shrink-0 ${
                                  u.status === 'deactivated'
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                                }`}
                              >
                                {u.status === 'deactivated' ? (
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-700 stroke-[2]" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5 text-amber-700 stroke-[2]" />
                                )}
                              </button>
                            )}

                            {/* Delete User */}
                            {isAdmin && !isSelf && (
                              <button
                                onClick={() => setUserToDelete(u)}
                                title="Delete User"
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold cursor-pointer text-xs inline-flex items-center justify-center border border-rose-200 transition-all shrink-0 active:scale-95 shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600 stroke-[2]" />
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
                currentPage={userControlsPage}
                totalPages={Math.ceil(filteredUsersForControls.length / userControlsPageSize)}
                totalItems={filteredUsersForControls.length}
                pageSize={userControlsPageSize}
                onPageChange={setUserControlsPage}
                onPageSizeChange={setUserControlsPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* TAB 3: EMPLOYEE TRANSFERS & MAPPING */}
      {/* ==================================================================== */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Filter & Action Console for Transfers */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            {/* Top Bar: Clean Themed Scope & Action Buttons */}
            <div className="flex items-center justify-between gap-3.5 border-b border-slate-100 pb-3.5">
              {/* Left: Blank as requested */}
              <div />

              {/* Right: Export Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleExportTransfersCSV}
                  className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Export Transfer Register as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={handleExportTransfersPDF}
                  className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Print / Export Transfer Register to PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            {/* Second Row: Search Input on Left, Reset on Right */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search staff name, previous/new department, manager, or notes..."
                    value={transferRegisterSearch}
                    onChange={(e) => setTransferRegisterSearch(e.target.value)}
                    className="h-9 w-full pl-10 pr-9 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  {transferRegisterSearch && (
                    <button
                      onClick={() => setTransferRegisterSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Right Controls: Reset All Filters */}
                {(!transferRegisterDeptFilter.includes('all') ||
                  !transferRegisterTypeFilter.includes('all') ||
                  transferRegisterSearch !== '') && (
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => {
                        setTransferRegisterDeptFilter(['all']);
                        setTransferRegisterTypeFilter(['all']);
                        setTransferRegisterSearch('');
                      }}
                      className="h-9 px-3.5 bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer shadow-2xs"
                      title="Reset all search and filter selections"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                      <span>Reset All Filters</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Third Row: FILTERS */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    FILTERS
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap">
                  {/* 1. Department Filter Pill */}
                  <div className="flex-1 min-w-[160px] max-w-[260px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Department"
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      selectedValues={transferRegisterDeptFilter}
                      onChange={setTransferRegisterDeptFilter}
                      options={DEPARTMENTS_MASTER.map((d) => ({
                        label: d,
                        value: d
                      }))}
                    />
                  </div>

                  {/* 2. Transfer Type Filter Pill */}
                  <div className="flex-1 min-w-[150px] max-w-[240px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Transfer Type"
                      icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
                      selectedValues={transferRegisterTypeFilter}
                      onChange={setTransferRegisterTypeFilter}
                      options={[
                        { label: 'Individual Staff Transfer', value: 'individual' },
                        { label: 'Manager Replacement (Cascading)', value: 'manager_replacement' }
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transfer History Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed min-w-[760px]">
                <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr className="h-10">
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[24%]">Employee Details</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[26%]">New Department</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[24%]">Hierarchy Reassignment</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[12%]">Effective Date</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[14%]">Order &amp; Auth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filtered = transferLogs.filter((log) => {
                      const q = transferRegisterSearch.toLowerCase().trim();
                      const matchSearch =
                        !q ||
                        log.userName.toLowerCase().includes(q) ||
                        log.previousDept.toLowerCase().includes(q) ||
                        log.newDept.toLowerCase().includes(q) ||
                        log.previousManagerName.toLowerCase().includes(q) ||
                        log.newManagerName.toLowerCase().includes(q) ||
                        (log.notes && log.notes.toLowerCase().includes(q)) ||
                        (log.transferredBy && log.transferredBy.toLowerCase().includes(q));

                      const matchDept =
                        transferRegisterDeptFilter.includes('all') ||
                        transferRegisterDeptFilter.includes(log.previousDept) ||
                        transferRegisterDeptFilter.includes(log.newDept);

                      const isBulkManagerMove = log.notes && log.notes.includes('[Manager Re-mapping]');
                      const matchType =
                        transferRegisterTypeFilter.includes('all') ||
                        (transferRegisterTypeFilter.includes('manager_replacement') && isBulkManagerMove) ||
                        (transferRegisterTypeFilter.includes('individual') && !isBulkManagerMove);

                      return matchSearch && matchDept && matchType;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-400">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <ArrowLeftRight className="w-8 h-8 text-slate-300" />
                              <span className="font-semibold text-xs text-slate-600">
                                {transferLogs.length === 0
                                  ? 'No employee transfer records logged yet.'
                                  : 'No transfer records matching your search and filter criteria.'}
                              </span>
                              {transferLogs.length > 0 && (
                                <button
                                  onClick={() => {
                                    setTransferRegisterSearch('');
                                    setTransferRegisterDeptFilter(['all']);
                                    setTransferRegisterTypeFilter(['all']);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                                >
                                  Clear Filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((log) => {
                      const isBulkManagerMove = log.notes && log.notes.includes('[Manager Re-mapping]');
                      const userObj = users.find((u) => u.id === log.userId || u.name === log.userName);

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* 1. Employee Details (3 Lines: Name, Designation, Bio ID) */}
                          <td className="px-3.5 py-3 align-middle">
                            <div className="flex items-start space-x-2.5 min-w-0">
                              <img
                                src={userObj?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                                alt={log.userName}
                                className="w-7.5 h-7.5 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5 shadow-2xs"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-slate-900 truncate text-xs block">{log.userName}</span>
                                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {userObj?.designation || 'Staff Member'}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">
                                  {userObj?.biometricId ? `Bio ID: ${userObj.biometricId}` : (log.userId ? `Bio ID: ${log.userId}` : 'Bio ID: N/A')}
                                </div>
                                {isBulkManagerMove && (
                                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold mt-1">
                                    <RefreshCw className="w-2.5 h-2.5 shrink-0 text-indigo-600" />
                                    <span>Manager Reassignment</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Department Posting */}
                          <td className="px-3.5 py-3 align-middle">
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-1.5 text-xs">
                                <span className="line-through text-slate-400 truncate max-w-[140px] text-[11px]">{log.previousDept}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="font-bold text-blue-900 truncate text-xs">{log.newDept}</span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Hierarchy Reassignment */}
                          <td className="px-3.5 py-3 align-middle">
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-1.5 text-xs">
                                <span className="text-slate-500 truncate max-w-[130px] text-[11px]">{log.previousManagerName}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-900 truncate text-xs">{log.newManagerName}</span>
                              </div>
                            </div>
                          </td>

                          {/* 4. Effective Date */}
                          <td className="px-3.5 py-3 align-middle whitespace-nowrap">
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-[11px] border border-slate-200">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{log.effectiveDate}</span>
                            </span>
                          </td>

                          {/* 5. Order Ref / Authorized By */}
                          <td className="px-3.5 py-3 align-middle">
                            <p className="font-semibold text-slate-800 truncate text-xs" title={log.notes || 'Official Transfer Order'}>
                              {log.notes || 'Official Transfer Order'}
                            </p>
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                              Auth: {log.transferredBy} • {log.timestamp}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: EDIT USER PROFILE */}
      {/* ==================================================================== */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Edit3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white">
                    Edit Profile: {editingUser.name}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Update personal information, biometric ID, and institutional credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* BLOCK 1: BASIC DETAILS */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-200 pb-2">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  <span className="uppercase tracking-wider text-[11px] text-slate-700">1. Basic Personal Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Gender *</label>
                    <select
                      value={editingUser.gender || 'Male'}
                      onChange={(e) => setEditingUser({ ...editingUser, gender: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Date of Birth (DOB)</label>
                    <input
                      type="date"
                      value={editingUser.dob || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, dob: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Mobile Number (Mob) *</label>
                    <input
                      type="text"
                      required
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Biometric ID *</label>
                    <input
                      type="text"
                      required
                      value={editingUser.biometricId || editingUser.emergencyContactPhone || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, biometricId: e.target.value, emergencyContactPhone: e.target.value })}
                      placeholder="e.g. BIO-8842 or 1002"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCK 2: OFFICIAL DETAILS */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-200 pb-2">
                  <Building className="w-4 h-4 text-emerald-600" />
                  <span className="uppercase tracking-wider text-[11px] text-slate-700">2. Official &amp; Cadre Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editingUser.employmentType === 'contractual' ? (
                    <>
                      {/* Row 1: Primary Category & Designation */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={editingUser.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setEditingUser({
                              ...editingUser,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Designation *</label>
                        <select
                          value={editingUser.designation}
                          onChange={(e) => setEditingUser({ ...editingUser, designation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {editingUser.designation && !DESIGNATIONS_MASTER.includes(editingUser.designation) && (
                            <option value={editingUser.designation}>{editingUser.designation}</option>
                          )}
                          {DESIGNATIONS_MASTER.map((desig) => (
                            <option key={desig} value={desig}>{desig}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={editingUser.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setEditingUser({ ...editingUser, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={editingUser.leaveCycle || getUserLeaveCycleType(editingUser)}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setEditingUser({
                              ...editingUser,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Department / Cell & Reporting Manager */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Department / Cell *</label>
                        <select
                          value={editingUser.department}
                          onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {editingUser.department && !DEPARTMENTS_MASTER.includes(editingUser.department) && (
                            <option value={editingUser.department}>{editingUser.department}</option>
                          )}
                          {DEPARTMENTS_MASTER.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Reporting Manager (Level 1)</label>
                        <select
                          value={editingUser.reportingManagerId || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, reportingManagerId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">None / Direct</option>
                          {users.filter(u => u.id !== editingUser.id).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 4: Date of Joining & Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={editingUser.joiningDate || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Valid Up To Date</label>
                        <input
                          type="date"
                          value={editingUser.validUntilDate || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>
                    </>
                  ) : editingUser.employmentType === 'researcher' ? (
                    <>
                      {/* Row 1: Primary Category & Designation */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={editingUser.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setEditingUser({
                              ...editingUser,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Designation *</label>
                        <select
                          value={editingUser.designation}
                          onChange={(e) => setEditingUser({ ...editingUser, designation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {editingUser.designation && !DESIGNATIONS_MASTER.includes(editingUser.designation) && (
                            <option value={editingUser.designation}>{editingUser.designation}</option>
                          )}
                          {DESIGNATIONS_MASTER.map((desig) => (
                            <option key={desig} value={desig}>{desig}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={editingUser.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setEditingUser({ ...editingUser, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={editingUser.leaveCycle || getUserLeaveCycleType(editingUser)}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setEditingUser({
                              ...editingUser,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Project Name & PI */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Project Name *</label>
                        <input
                          type="text"
                          value={editingUser.department}
                          onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                          placeholder="Enter Project Name"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">PI (Principal Investigator)</label>
                        <select
                          value={editingUser.piName || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, piName: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select PI</option>
                          {users.filter(u => u.id !== editingUser.id).map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                          {editingUser.piName && !users.some(u => u.name === editingUser.piName) && (
                            <option value={editingUser.piName}>{editingUser.piName}</option>
                          )}
                        </select>
                      </div>

                      {/* Row 4: Date of Joining & Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={editingUser.joiningDate || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Valid Up To Date</label>
                        <input
                          type="date"
                          value={editingUser.validUntilDate || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      {/* Dual Role Checkbox */}
                      <div className="sm:col-span-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!editingUser.isPhDEnrolled}
                            onChange={(e) => setEditingUser({ ...editingUser, isPhDEnrolled: e.target.checked })}
                            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="font-bold text-purple-900 text-xs">Simultaneously Enrolled in PhD Program? (Dual Role: Research + PhD)</span>
                        </label>
                      </div>
                    </>
                  ) : editingUser.employmentType === 'intern' ? (
                    <>
                      {/* Row 1: Primary Category & Reporting Manager / PI */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={editingUser.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setEditingUser({
                              ...editingUser,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Reporting Manager / PI</label>
                        <select
                          value={editingUser.reportingManagerId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const selectedUser = users.find(u => u.id === selectedId);
                            setEditingUser({
                              ...editingUser,
                              reportingManagerId: selectedId,
                              piName: selectedUser ? selectedUser.name : editingUser.piName
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select Manager / PI</option>
                          {users.filter(u => u.id !== editingUser.id).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={editingUser.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setEditingUser({ ...editingUser, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={editingUser.leaveCycle || getUserLeaveCycleType(editingUser)}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setEditingUser({
                              ...editingUser,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Date of Joining & Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={editingUser.joiningDate || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Valid Up To Date</label>
                        <input
                          type="date"
                          value={editingUser.validUntilDate || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>
                    </>
                  ) : editingUser.employmentType === 'bsc_msc_student' ? (
                    <>
                      {/* Row 1: Primary Category & Stream */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={editingUser.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setEditingUser({
                              ...editingUser,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Stream *</label>
                        <select
                          value={editingUser.courseProgram || editingUser.employeeCategory || STREAMS_MASTER[0]}
                          onChange={(e) => setEditingUser({ ...editingUser, courseProgram: e.target.value, employeeCategory: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {STREAMS_MASTER.map((stream) => (
                            <option key={stream} value={stream}>{stream}</option>
                          ))}
                          {editingUser.courseProgram && !STREAMS_MASTER.includes(editingUser.courseProgram) && (
                            <option value={editingUser.courseProgram}>{editingUser.courseProgram}</option>
                          )}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={editingUser.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setEditingUser({ ...editingUser, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={editingUser.leaveCycle || getUserLeaveCycleType(editingUser)}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setEditingUser({
                              ...editingUser,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: PI (Principal Investigator) & Batch */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">PI (Principal Investigator) / Guide</label>
                        <select
                          value={editingUser.piName || ''}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            const matchedUser = users.find(u => u.name === selectedName);
                            setEditingUser({
                              ...editingUser,
                              piName: selectedName,
                              guideSupervisor: selectedName,
                              reportingManagerId: matchedUser ? matchedUser.id : editingUser.reportingManagerId
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select PI / Guide</option>
                          {users.filter(u => u.id !== editingUser.id).map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                          {editingUser.piName && !users.some(u => u.name === editingUser.piName) && (
                            <option value={editingUser.piName}>{editingUser.piName}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Batch *</label>
                        <select
                          value={editingUser.courseBatch || BATCHES_MASTER[2]}
                          onChange={(e) => setEditingUser({ ...editingUser, courseBatch: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {BATCHES_MASTER.map((batch) => (
                            <option key={batch} value={batch}>{batch}</option>
                          ))}
                          {editingUser.courseBatch && !BATCHES_MASTER.includes(editingUser.courseBatch) && (
                            <option value={editingUser.courseBatch}>{editingUser.courseBatch}</option>
                          )}
                        </select>
                      </div>

                      {/* Row 4: Date of Joining & Auto Calculate Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={editingUser.joiningDate || ''}
                          onChange={(e) => {
                            const newJoining = e.target.value;
                            const autoValid = calculateStudentValidUntil(newJoining);
                            setEditingUser({
                              ...editingUser,
                              joiningDate: newJoining,
                              validUntilDate: autoValid || editingUser.validUntilDate
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1 flex items-center justify-between">
                          <span>Valid Up To Date</span>
                          <span className="text-[10px] text-cyan-700 font-normal bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                            Auto (2 Years)
                          </span>
                        </label>
                        <input
                          type="date"
                          value={
                            editingUser.validUntilDate ||
                            calculateStudentValidUntil(editingUser.joiningDate) ||
                            ''
                          }
                          onChange={(e) => setEditingUser({ ...editingUser, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-slate-50 font-semibold"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Row 1: Primary Category & Employee Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={editingUser.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setEditingUser({
                              ...editingUser,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Employee Type</label>
                        <select
                          value={editingUser.employeeCategory || (EMPLOYEE_TYPE_OPTIONS_MAP[editingUser.employmentType]?.[0] || 'Administrative')}
                          onChange={(e) => setEditingUser({ ...editingUser, employeeCategory: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {(EMPLOYEE_TYPE_OPTIONS_MAP[editingUser.employmentType] || ['Administrative', 'Scientific', 'Technical', 'Support']).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={editingUser.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setEditingUser({ ...editingUser, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={editingUser.leaveCycle || getUserLeaveCycleType(editingUser)}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setEditingUser({
                              ...editingUser,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Department / Cell & Designation */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Department / Cell *</label>
                        <select
                          value={editingUser.department}
                          onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {editingUser.department && !DEPARTMENTS_MASTER.includes(editingUser.department) && (
                            <option value={editingUser.department}>{editingUser.department}</option>
                          )}
                          {DEPARTMENTS_MASTER.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Designation *</label>
                        <select
                          value={editingUser.designation}
                          onChange={(e) => setEditingUser({ ...editingUser, designation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {editingUser.designation && !DESIGNATIONS_MASTER.includes(editingUser.designation) && (
                            <option value={editingUser.designation}>{editingUser.designation}</option>
                          )}
                          {DESIGNATIONS_MASTER.map((desig) => (
                            <option key={desig} value={desig}>{desig}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 4: Reporting Manager & HoD */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Reporting Manager (Level 1)</label>
                        <select
                          value={editingUser.reportingManagerId || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, reportingManagerId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">None / Direct</option>
                          {users.filter(u => u.id !== editingUser.id).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Head of Department (HoD)</label>
                        <select
                          value={editingUser.hodName || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, hodName: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select HoD</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                          {editingUser.hodName && !users.some(u => u.name === editingUser.hodName) && (
                            <option value={editingUser.hodName}>{editingUser.hodName}</option>
                          )}
                        </select>
                      </div>

                      {/* Row 5: Date of Joining & Retirement Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={editingUser.joiningDate || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Calculated Retirement Date</label>
                        <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold rounded-lg text-xs flex flex-col justify-center min-h-[34px]">
                          <span>{calculateRetirementDate(editingUser.dob)}</span>
                        </div>
                      </div>

                      {/* Row 6: Probation Status */}
                      <div className="sm:col-span-2 space-y-2 border-t border-slate-200 pt-2.5">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!editingUser.isOnProbation}
                            onChange={(e) => setEditingUser({ ...editingUser, isOnProbation: e.target.checked })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-bold text-slate-700 text-xs">Currently on Probation?</span>
                        </label>

                        {editingUser.isOnProbation && (
                          <div className="mt-2">
                            <label className="block text-slate-600 font-bold mb-1">Tentative Probation End Date</label>
                            <input
                              type="date"
                              value={editingUser.probationEndDate || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, probationEndDate: e.target.value })}
                              className="w-full sm:w-1/2 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {editingUser.employmentType === 'phd_student' && (
                    <div className="sm:col-span-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editingUser.isPhDEnrolled}
                          onChange={(e) => setEditingUser({ ...editingUser, isPhDEnrolled: e.target.checked })}
                          className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-bold text-purple-900 text-xs">Simultaneously Associated with Research Project / Project Staff? (Dual Role: PhD + Project)</span>
                      </label>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-bold mb-1">Slack Handle</label>
                    <input
                      type="text"
                      value={editingUser.slackHandle || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, slackHandle: e.target.value })}
                      placeholder="@username"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pinned Modal Card Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CREATE NEW EMPLOYEE PROFILE */}
      {/* ==================================================================== */}
      {isCreatingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                  <UserPlus className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white">
                    Create New Employee Profile
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Register a new staff member, researcher, or administrator in the system
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingUser(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* BLOCK 1: BASIC DETAILS */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-200 pb-2">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  <span className="uppercase tracking-wider text-[11px] text-slate-700">1. Basic Personal Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Aniket Verma"
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Gender *</label>
                    <select
                      value={newUserForm.gender || 'Male'}
                      onChange={(e) => setNewUserForm({ ...newUserForm, gender: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Date of Birth (DOB)</label>
                    <input
                      type="date"
                      value={newUserForm.dob}
                      onChange={(e) => setNewUserForm({ ...newUserForm, dob: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Mobile Number (Mob) *</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 98765 43210"
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="aniket@wii.gov.in"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Biometric ID *</label>
                    <input
                      type="text"
                      required
                      value={newUserForm.biometricId || newUserForm.emergencyContactPhone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, biometricId: e.target.value, emergencyContactPhone: e.target.value })}
                      placeholder="e.g. BIO-8842 or 1002"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCK 2: OFFICIAL DETAILS */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-200 pb-2">
                  <Building className="w-4 h-4 text-emerald-600" />
                  <span className="uppercase tracking-wider text-[11px] text-slate-700">2. Official &amp; Cadre Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {newUserForm.employmentType === 'contractual' ? (
                    <>
                      {/* Row 1: Primary Category & Designation */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={newUserForm.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setNewUserForm({
                              ...newUserForm,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Designation *</label>
                        <select
                          value={newUserForm.designation}
                          onChange={(e) => setNewUserForm({ ...newUserForm, designation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {DESIGNATIONS_MASTER.map((desig) => (
                            <option key={desig} value={desig}>{desig}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={newUserForm.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setNewUserForm({ ...newUserForm, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={newUserForm.leaveCycle || getUserLeaveCycleType({ employmentType: newUserForm.employmentType })}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setNewUserForm({
                              ...newUserForm,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Department / Cell & Reporting Manager */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Department / Cell *</label>
                        <select
                          value={newUserForm.department}
                          onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {DEPARTMENTS_MASTER.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Reporting Manager (Level 1)</label>
                        <select
                          value={newUserForm.reportingManagerId}
                          onChange={(e) => setNewUserForm({ ...newUserForm, reportingManagerId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">None / Direct</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 4: Date of Joining & Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={newUserForm.joiningDate}
                          onChange={(e) => setNewUserForm({ ...newUserForm, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Valid Up To Date</label>
                        <input
                          type="date"
                          value={newUserForm.validUntilDate}
                          onChange={(e) => setNewUserForm({ ...newUserForm, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>
                    </>
                  ) : newUserForm.employmentType === 'researcher' ? (
                    <>
                      {/* Row 1: Primary Category & Designation */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={newUserForm.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setNewUserForm({
                              ...newUserForm,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Designation *</label>
                        <select
                          value={newUserForm.designation}
                          onChange={(e) => setNewUserForm({ ...newUserForm, designation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {DESIGNATIONS_MASTER.map((desig) => (
                            <option key={desig} value={desig}>{desig}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={newUserForm.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setNewUserForm({ ...newUserForm, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={newUserForm.leaveCycle || getUserLeaveCycleType({ employmentType: newUserForm.employmentType })}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setNewUserForm({
                              ...newUserForm,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Project Name & PI */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Project Name *</label>
                        <input
                          type="text"
                          value={newUserForm.department}
                          onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                          placeholder="Enter Project Name"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">PI (Principal Investigator)</label>
                        <select
                          value={newUserForm.piName || ''}
                          onChange={(e) => setNewUserForm({ ...newUserForm, piName: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select PI</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 4: Date of Joining & Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={newUserForm.joiningDate}
                          onChange={(e) => setNewUserForm({ ...newUserForm, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Valid Up To Date</label>
                        <input
                          type="date"
                          value={newUserForm.validUntilDate}
                          onChange={(e) => setNewUserForm({ ...newUserForm, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      {/* Dual Role Checkbox */}
                      <div className="sm:col-span-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!newUserForm.isPhDEnrolled}
                            onChange={(e) => setNewUserForm({ ...newUserForm, isPhDEnrolled: e.target.checked })}
                            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="font-bold text-purple-900 text-xs">Simultaneously Enrolled in PhD Program? (Dual Role: Research + PhD)</span>
                        </label>
                      </div>
                    </>
                  ) : newUserForm.employmentType === 'intern' ? (
                    <>
                      {/* Row 1: Primary Category & Reporting Manager / PI */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={newUserForm.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setNewUserForm({
                              ...newUserForm,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Reporting Manager / PI</label>
                        <select
                          value={newUserForm.reportingManagerId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const selectedUser = users.find(u => u.id === selectedId);
                            setNewUserForm({
                              ...newUserForm,
                              reportingManagerId: selectedId,
                              piName: selectedUser ? selectedUser.name : newUserForm.piName
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select Manager / PI</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={newUserForm.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setNewUserForm({ ...newUserForm, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={newUserForm.leaveCycle || getUserLeaveCycleType({ employmentType: newUserForm.employmentType })}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setNewUserForm({
                              ...newUserForm,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Date of Joining & Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={newUserForm.joiningDate}
                          onChange={(e) => setNewUserForm({ ...newUserForm, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Valid Up To Date</label>
                        <input
                          type="date"
                          value={newUserForm.validUntilDate}
                          onChange={(e) => setNewUserForm({ ...newUserForm, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>
                    </>
                  ) : newUserForm.employmentType === 'bsc_msc_student' ? (
                    <>
                      {/* Row 1: Primary Category & Stream */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={newUserForm.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setNewUserForm({
                              ...newUserForm,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Stream *</label>
                        <select
                          value={newUserForm.courseProgram || newUserForm.employeeCategory || STREAMS_MASTER[0]}
                          onChange={(e) => setNewUserForm({ ...newUserForm, courseProgram: e.target.value, employeeCategory: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {STREAMS_MASTER.map((stream) => (
                            <option key={stream} value={stream}>{stream}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={newUserForm.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setNewUserForm({ ...newUserForm, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={newUserForm.leaveCycle || getUserLeaveCycleType({ employmentType: newUserForm.employmentType })}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setNewUserForm({
                              ...newUserForm,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: PI (Principal Investigator) & Batch */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">PI (Principal Investigator) / Guide</label>
                        <select
                          value={newUserForm.piName || ''}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            const matchedUser = users.find(u => u.name === selectedName);
                            setNewUserForm({
                              ...newUserForm,
                              piName: selectedName,
                              guideSupervisor: selectedName,
                              reportingManagerId: matchedUser ? matchedUser.id : newUserForm.reportingManagerId
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select PI / Guide</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Batch *</label>
                        <select
                          value={newUserForm.courseBatch || BATCHES_MASTER[2]}
                          onChange={(e) => setNewUserForm({ ...newUserForm, courseBatch: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {BATCHES_MASTER.map((batch) => (
                            <option key={batch} value={batch}>{batch}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 4: Date of Joining & Auto Calculate Valid Up To Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={newUserForm.joiningDate}
                          onChange={(e) => {
                            const newJoining = e.target.value;
                            const autoValid = calculateStudentValidUntil(newJoining);
                            setNewUserForm({
                              ...newUserForm,
                              joiningDate: newJoining,
                              validUntilDate: autoValid || newUserForm.validUntilDate
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1 flex items-center justify-between">
                          <span>Valid Up To Date</span>
                          <span className="text-[10px] text-cyan-700 font-normal bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                            Auto (2 Years)
                          </span>
                        </label>
                        <input
                          type="date"
                          value={
                            newUserForm.validUntilDate ||
                            calculateStudentValidUntil(newUserForm.joiningDate) ||
                            ''
                          }
                          onChange={(e) => setNewUserForm({ ...newUserForm, validUntilDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-slate-50 font-semibold"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Row 1: Primary Category & Employee Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Primary Category *</label>
                        <select
                          value={newUserForm.employmentType}
                          onChange={(e) => {
                            const newCategory = e.target.value as EmploymentType;
                            const defaultTypes = EMPLOYEE_TYPE_OPTIONS_MAP[newCategory] || ['Administrative', 'Scientific', 'Technical', 'Support'];
                            setNewUserForm({
                              ...newUserForm,
                              employmentType: newCategory,
                              employeeCategory: defaultTypes[0]
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="permanent">Permanent Employees</option>
                          <option value="contractual">Contractual Employees</option>
                          <option value="researcher">Researchers / Project Staff</option>
                          <option value="diploma_trainee">Diploma Trainee</option>
                          <option value="intern">Interns</option>
                          <option value="bsc_msc_student">BSc / MSc Students</option>
                          <option value="phd_student">PhD Students</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Employee Type</label>
                        <select
                          value={newUserForm.employeeCategory || (EMPLOYEE_TYPE_OPTIONS_MAP[newUserForm.employmentType]?.[0] || 'Administrative')}
                          onChange={(e) => setNewUserForm({ ...newUserForm, employeeCategory: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {(EMPLOYEE_TYPE_OPTIONS_MAP[newUserForm.employmentType] || ['Administrative', 'Scientific', 'Technical', 'Support']).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Shift & Leave Year Type */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Shift *</label>
                        <select
                          value={newUserForm.shiftId || (shifts.find(s => s.isDefault)?.id || shifts[0]?.id || '')}
                          onChange={(e) => setNewUserForm({ ...newUserForm, shiftId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name} ({s.startTime} - {s.endTime}){s.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Leave Year Type *</label>
                        <select
                          value={newUserForm.leaveCycle || getUserLeaveCycleType({ employmentType: newUserForm.employmentType })}
                          onChange={(e) => {
                            const val = e.target.value as 'CY' | 'FY';
                            setNewUserForm({
                              ...newUserForm,
                              leaveCycle: val,
                              leaveCycleBasis: val === 'CY' ? 'calendar_year' : 'financial_year'
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="CY">Calendar Year (CY: 01 Jan – 31 Dec)</option>
                          <option value="FY">Financial Year (FY: 01 Apr – 31 Mar)</option>
                        </select>
                      </div>

                      {/* Row 3: Department / Cell & Designation */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Department / Cell *</label>
                        <select
                          value={newUserForm.department}
                          onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {DEPARTMENTS_MASTER.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Designation *</label>
                        <select
                          value={newUserForm.designation}
                          onChange={(e) => setNewUserForm({ ...newUserForm, designation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          {DESIGNATIONS_MASTER.map((desig) => (
                            <option key={desig} value={desig}>{desig}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 4: Reporting Manager & HoD */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Reporting Manager (Level 1)</label>
                        <select
                          value={newUserForm.reportingManagerId}
                          onChange={(e) => setNewUserForm({ ...newUserForm, reportingManagerId: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">None / Direct</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Head of Department (HoD)</label>
                        <select
                          value={newUserForm.hodName}
                          onChange={(e) => setNewUserForm({ ...newUserForm, hodName: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white font-semibold"
                        >
                          <option value="">Select HoD</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name} ({u.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 5: Date of Joining & Retirement Date */}
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Date of Joining</label>
                        <input
                          type="date"
                          value={newUserForm.joiningDate}
                          onChange={(e) => setNewUserForm({ ...newUserForm, joiningDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Calculated Retirement Date</label>
                        <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold rounded-lg text-xs flex flex-col justify-center min-h-[34px]">
                          <span>{calculateRetirementDate(newUserForm.dob)}</span>
                        </div>
                      </div>

                      {/* Row 6: Probation Status */}
                      <div className="sm:col-span-2 space-y-2 border-t border-slate-200 pt-2.5">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newUserForm.isOnProbation}
                            onChange={(e) => setNewUserForm({ ...newUserForm, isOnProbation: e.target.checked })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-bold text-slate-700 text-xs">Currently on Probation?</span>
                        </label>

                        {newUserForm.isOnProbation && (
                          <div className="mt-2">
                            <label className="block text-slate-600 font-bold mb-1">Tentative Probation End Date</label>
                            <input
                              type="date"
                              value={newUserForm.probationEndDate}
                              onChange={(e) => setNewUserForm({ ...newUserForm, probationEndDate: e.target.value })}
                              className="w-full sm:w-1/2 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {newUserForm.employmentType === 'phd_student' && (
                    <div className="sm:col-span-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!newUserForm.isPhDEnrolled}
                          onChange={(e) => setNewUserForm({ ...newUserForm, isPhDEnrolled: e.target.checked })}
                          className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-bold text-purple-900 text-xs">Simultaneously Associated with Research Project / Project Staff? (Dual Role: PhD + Project)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pinned Modal Card Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Employee Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: PASSWORD RESET SUCCESS DISPLAY */}
      {/* ==================================================================== */}
      {passwordResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 p-5 space-y-4">
            <div className="flex items-center space-x-3 text-emerald-600">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Password Reset Generated</h3>
                <p className="text-xs text-slate-500">Temporary credentials for {passwordResetModal.user.name}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 rounded-xl text-white space-y-2 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Temporary Login Password
              </span>
              <p className="text-xl font-mono font-black text-amber-400 tracking-wider">
                {passwordResetModal.tempPass}
              </p>
              <p className="text-[10px] text-slate-400">
                Dispatched via simulated SMS &amp; Official Slack notification. User must reset upon first login.
              </p>
            </div>

            <button
              onClick={() => setPasswordResetModal(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Close Notification
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: DELETE USER CONFIRMATION */}
      {/* ==================================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Confirm User Deletion</h3>
                <p className="text-xs text-slate-500">Action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-700">
              Are you sure you want to permanently delete user account{' '}
              <strong className="text-slate-900">{userToDelete.name}</strong> ({userToDelete.email})?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-1.5 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5A: INITIATE EMPLOYEE TRANSFER (SINGLE / BULK) */}
      {/* ==================================================================== */}
      {activeTransferModal === 'employee_transfer' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[88vh] my-auto">
            {/* Dedicated Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white">
                    Employee Transfer Order
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Official Administrative Orders for Departmental Transfers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTransferModal('none')}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dedicated Modal Body Container */}
            <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
              <form onSubmit={handleSingleMultiTransferSubmit} className="space-y-4">
                {/* Step 1: Select Employees */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. Select Employee(s) for Transfer ({selectedTransferUserIds.length})</span>
                    </label>

                    <div className="flex items-center space-x-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          const filteredIds = users
                            .filter((u) => {
                              const q = transferSearchQuery.toLowerCase();
                              const matchSearch =
                                u.name.toLowerCase().includes(q) ||
                                u.department.toLowerCase().includes(q) ||
                                u.designation.toLowerCase().includes(q);
                              const matchDept = transferDeptFilter === 'all' || u.department === transferDeptFilter;
                              return matchSearch && matchDept;
                            })
                            .map((u) => u.id);
                          setSelectedTransferUserIds(filteredIds);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      >
                        Select All Filtered
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTransferUserIds([])}
                        className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Filter Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={transferSearchQuery}
                        onChange={(e) => setTransferSearchQuery(e.target.value)}
                        placeholder="Filter employees by name/role..."
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                      />
                    </div>

                    <select
                      value={transferDeptFilter}
                      onChange={(e) => setTransferDeptFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="all">All Departments</option>
                      {DEPARTMENTS_MASTER.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Employee Checklist */}
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                    {(() => {
                      const filteredList = users.filter((u) => {
                        const q = transferSearchQuery.toLowerCase();
                        const matchSearch =
                          u.name.toLowerCase().includes(q) ||
                          u.department.toLowerCase().includes(q) ||
                          u.designation.toLowerCase().includes(q);
                        const matchDept = transferDeptFilter === 'all' || u.department === transferDeptFilter;
                        return matchSearch && matchDept;
                      });

                      if (filteredList.length === 0) {
                        return <div className="p-3 text-center text-slate-400">No matching employees found.</div>;
                      }

                      return filteredList.map((u) => {
                        const isChecked = selectedTransferUserIds.includes(u.id);
                        const reportingMgr = users.find((m) => m.id === u.reportingManagerId);
                        return (
                          <label
                            key={u.id}
                            className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTransferUserIds([...selectedTransferUserIds, u.id]);
                                  } else {
                                    setSelectedTransferUserIds(selectedTransferUserIds.filter((id) => id !== u.id));
                                  }
                                }}
                                className="w-4 h-4 rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate">{u.name}</span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {u.department} • {u.designation} {reportingMgr ? `(Mgr: ${reportingMgr.name})` : ''}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Step 2: Destination & Manager Details */}
                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-1">
                    2. New Department &amp; Reporting Hierarchy
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">New Department *</label>
                      <select
                        required
                        value={transferForm.newDept}
                        onChange={(e) => setTransferForm({ ...transferForm, newDept: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white"
                      >
                        {DEPARTMENTS_MASTER.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Effective Transfer Date *</label>
                      <input
                        type="date"
                        required
                        value={transferForm.effectiveDate}
                        onChange={(e) => setTransferForm({ ...transferForm, effectiveDate: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">New Reporting Manager (Level 1)</label>
                      <select
                        value={transferForm.newReportingManagerId}
                        onChange={(e) => setTransferForm({ ...transferForm, newReportingManagerId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      >
                        <option value="">-- Unchanged / Keep Current --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.department} - {u.designation})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">New Reviewing Manager / HoD (Level 2)</label>
                      <select
                        value={transferForm.newReviewingManagerId}
                        onChange={(e) => setTransferForm({ ...transferForm, newReviewingManagerId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                      >
                        <option value="">-- Unchanged / Keep Current --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.department} - {u.designation})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-bold mb-1">
                        Transfer Reason / Official Order Reference <span className="text-[10px] font-normal text-slate-500">(Optional - values can be filled later)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={transferForm.notes}
                        onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                        placeholder="e.g. Official Order Ref: WII/ADMIN/TRANSFER/2026/88 (Optional)"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Bar */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTransferModal('none')}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedTransferUserIds.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Execute Transfer Order ({selectedTransferUserIds.length} Staff)</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5B: MANAGER REPLACEMENT & CASCADING HANDOVER */}
      {/* ==================================================================== */}
      {activeTransferModal === 'manager_replacement' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[88vh] my-auto">
            {/* Dedicated Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white">
                    Manager Replacement &amp; Cascading Handover
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Reassign all reportees of an outgoing officer or HoD to an incoming manager
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTransferModal('none')}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dedicated Modal Body Container */}
            <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
              <form onSubmit={handleManagerReplacementSubmit} className="space-y-4">
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-900 text-xs flex items-center space-x-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Bulk Cascading Manager Re-assignment</span>
                  </span>
                  <p className="text-[11px] text-indigo-800 leading-snug">
                    When a Reporting Manager or Head of Department transfers out, use this tool to reassign all employee reportees under them to a new incoming Manager in one single order.
                  </p>
                </div>

                {/* Step 1: Outgoing vs Incoming Managers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl space-y-2">
                    <label className="block text-rose-900 font-extrabold text-xs">
                      1. Outgoing Manager / Officer Leaving *
                    </label>
                    <select
                      required
                      value={managerReplacementForm.outgoingManagerId}
                      onChange={(e) => {
                        const outgoingId = e.target.value;
                        const newReportees = users
                          .filter((u) => u.reportingManagerId === outgoingId || u.reviewingManagerId === outgoingId)
                          .map((u) => u.id);

                        setManagerReplacementForm({
                          ...managerReplacementForm,
                          outgoingManagerId: outgoingId,
                          selectedReporteeIds: newReportees
                        });
                      }}
                      className="w-full px-3 py-2 border border-rose-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                    >
                      <option value="">-- Select Outgoing Manager --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.department} - {u.designation})
                        </option>
                      ))}
                    </select>

                    {managerReplacementForm.outgoingManagerId && (
                      <div className="text-[10px] font-bold text-rose-800 bg-white p-2 rounded-lg border border-rose-200">
                        Found <span className="text-rose-900 underline">{reporteesUnderOutgoing.length}</span> direct reportee(s) assigned under this manager.
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
                    <label className="block text-emerald-900 font-extrabold text-xs">
                      2. Replacement / Incoming Manager *
                    </label>
                    <select
                      required
                      value={managerReplacementForm.incomingManagerId}
                      onChange={(e) =>
                        setManagerReplacementForm({ ...managerReplacementForm, incomingManagerId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                    >
                      <option value="">-- Select Incoming Manager --</option>
                      {users
                        .filter((u) => u.id !== managerReplacementForm.outgoingManagerId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.department} - {u.designation})
                          </option>
                        ))}
                    </select>

                    {managerReplacementForm.incomingManagerId && (
                      <div className="text-[10px] font-bold text-emerald-800 bg-white p-2 rounded-lg border border-emerald-200">
                        Incoming Officer:{' '}
                        <span className="text-emerald-950">
                          {users.find((u) => u.id === managerReplacementForm.incomingManagerId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Scope of Reassignment */}
                <div className="space-y-2">
                  <label className="block text-slate-800 font-extrabold text-xs uppercase tracking-wider">
                    3. Hierarchy Scope to Reassign
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label
                      className={`p-2.5 border rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
                        managerReplacementForm.reassignType === 'reporting'
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reassignType"
                        value="reporting"
                        checked={managerReplacementForm.reassignType === 'reporting'}
                        onChange={() =>
                          setManagerReplacementForm({ ...managerReplacementForm, reassignType: 'reporting' })
                        }
                        className="sr-only"
                      />
                      <span className="text-xs">Level 1 Only</span>
                      <span className="text-[10px] opacity-75 font-normal">Reporting Mgr</span>
                    </label>

                    <label
                      className={`p-2.5 border rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
                        managerReplacementForm.reassignType === 'reviewing'
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reassignType"
                        value="reviewing"
                        checked={managerReplacementForm.reassignType === 'reviewing'}
                        onChange={() =>
                          setManagerReplacementForm({ ...managerReplacementForm, reassignType: 'reviewing' })
                        }
                        className="sr-only"
                      />
                      <span className="text-xs">Level 2 Only</span>
                      <span className="text-[10px] opacity-75 font-normal">Reviewing / HoD</span>
                    </label>

                    <label
                      className={`p-2.5 border rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
                        managerReplacementForm.reassignType === 'both'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reassignType"
                        value="both"
                        checked={managerReplacementForm.reassignType === 'both'}
                        onChange={() =>
                          setManagerReplacementForm({ ...managerReplacementForm, reassignType: 'both' })
                        }
                        className="sr-only"
                      />
                      <span className="text-xs">Both L1 &amp; L2</span>
                      <span className="text-[10px] opacity-75 font-normal">Full Handover</span>
                    </label>
                  </div>
                </div>

                {/* Step 3: Reportees List Verification */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      4. Affected Reportee Employees ({managerReplacementForm.selectedReporteeIds.length} /{' '}
                      {reporteesUnderOutgoing.length})
                    </label>

                    <div className="space-x-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setManagerReplacementForm({
                            ...managerReplacementForm,
                            selectedReporteeIds: reporteesUnderOutgoing.map((u) => u.id)
                          })
                        }
                        className="text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setManagerReplacementForm({
                            ...managerReplacementForm,
                            selectedReporteeIds: []
                          })
                        }
                        className="text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        Unselect All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                    {reporteesUnderOutgoing.length === 0 ? (
                      <div className="p-3 text-center text-slate-400">
                        Select an Outgoing Manager above to load their reportees.
                      </div>
                    ) : (
                      reporteesUnderOutgoing.map((rep) => {
                        const isSelected = managerReplacementForm.selectedReporteeIds.includes(rep.id);
                        return (
                          <label
                            key={rep.id}
                            className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setManagerReplacementForm({
                                      ...managerReplacementForm,
                                      selectedReporteeIds: [...managerReplacementForm.selectedReporteeIds, rep.id]
                                    });
                                  } else {
                                    setManagerReplacementForm({
                                      ...managerReplacementForm,
                                      selectedReporteeIds: managerReplacementForm.selectedReporteeIds.filter(
                                        (id) => id !== rep.id
                                      )
                                    });
                                  }
                                }}
                                className="w-4 h-4 rounded-xs border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate">{rep.name}</span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {rep.department} • {rep.designation}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Step 4: Effective Date & Reason */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Effective Transfer Date *</label>
                    <input
                      type="date"
                      required
                      value={managerReplacementForm.effectiveDate}
                      onChange={(e) =>
                        setManagerReplacementForm({ ...managerReplacementForm, effectiveDate: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Office Order / Movement Ref <span className="text-[10px] font-normal text-slate-500">(Optional - values can be filled later)</span>
                    </label>
                    <input
                      type="text"
                      value={managerReplacementForm.notes}
                      onChange={(e) =>
                        setManagerReplacementForm({ ...managerReplacementForm, notes: e.target.value })
                      }
                      placeholder="e.g. Order Ref WII/TRANSFER/2026/MGR-99 (Optional)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Submit Bar */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTransferModal('none')}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !managerReplacementForm.outgoingManagerId ||
                      !managerReplacementForm.incomingManagerId ||
                      managerReplacementForm.selectedReporteeIds.length === 0
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      Execute Manager Migration ({managerReplacementForm.selectedReporteeIds.length} Reportees)
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: EDIT SYSTEM & ENTERPRISE MODULE ROLES */}
      {/* ==================================================================== */}
      {userToEditRoles && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[85vh] my-auto">
            {/* UNIFIED STREAMLINED MODAL HEADER */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
              {/* User Identity */}
              <div className="flex items-center space-x-3 min-w-0">
                <div className="relative">
                  <img
                    src={userToEditRoles.avatar}
                    alt={userToEditRoles.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-400/40 shrink-0 shadow-xs"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-900" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-white truncate">
                      {userToEditRoles.name}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      ID: {userToEditRoles.biometricId || userToEditRoles.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    {userToEditRoles.designation} &bull; {userToEditRoles.department} &bull; <span className="font-mono text-slate-400">{userToEditRoles.email}</span>
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setUserToEditRoles(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSaveRoleChangesInProfile} className="flex flex-col min-h-0 overflow-hidden">
              {/* SCROLLABLE INNER BODY */}
              <div className="p-3.5 space-y-3 text-xs overflow-y-auto">
                {/* 2D ROLE MATRIX TABLE (Columns: Modules, Rows: Roles) */}
                <RoleMatrixTable
                  mode="edit"
                  systemRoles={editUserRolesState}
                  moduleRoles={editUserModuleRolesState}
                  onToggleSystemRole={handleToggleSystemRoleInMatrix}
                  onToggleModuleRole={handleToggleModuleRoleInProfile}
                />
              </div>

              {/* PINNED FIXED FOOTER (NEVER UNDERFLOWS OR SCROLLS AWAY) */}
              <div className="px-5 py-2.5 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80 z-30">
                <div className="text-[11px] text-slate-600 font-medium flex items-center space-x-2">
                  <span>
                    Configuring permissions for <strong className="text-slate-900">{userToEditRoles.name}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-indigo-700 font-extrabold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[10px]">
                    {activeAssignedRolesSummary.length} Active Grants
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setUserToEditRoles(null)}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-4 py-1.5 rounded-xl text-xs border border-slate-200 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                  >
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>Save Role Allocation &amp; Access</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {userToResetPasswordForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-xs uppercase tracking-wider">
                  Reset Password — {userToResetPasswordForm.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUserToResetPasswordForm(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteResetPassword} className="p-5 space-y-4 text-xs">
              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <img
                  src={userToResetPasswordForm.avatar}
                  alt={userToResetPasswordForm.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 text-sm truncate">{userToResetPasswordForm.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{userToResetPasswordForm.designation} • {userToResetPasswordForm.department}</p>
                  <p className="text-[10px] text-emerald-700 font-mono font-bold truncate">{userToResetPasswordForm.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-extrabold text-xs mb-1.5 uppercase tracking-wider">
                  Password Generation Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      resetPassForm.mode === 'auto'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="passMode"
                      checked={resetPassForm.mode === 'auto'}
                      onChange={() => setResetPassForm({ ...resetPassForm, mode: 'auto' })}
                      className="text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                    />
                    <span className="text-[11px]">Auto Temp Key</span>
                  </label>

                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      resetPassForm.mode === 'custom'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="passMode"
                      checked={resetPassForm.mode === 'custom'}
                      onChange={() => setResetPassForm({ ...resetPassForm, mode: 'custom' })}
                      className="text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                    />
                    <span className="text-[11px]">Set Custom Pass</span>
                  </label>
                </div>
              </div>

              {resetPassForm.mode === 'custom' ? (
                <div className="space-y-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1">
                      New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={resetPassForm.showPassword ? 'text' : 'password'}
                        required
                        value={resetPassForm.customPassword}
                        onChange={(e) => setResetPassForm({ ...resetPassForm, customPassword: e.target.value })}
                        placeholder="Min 6 characters"
                        className="w-full pl-3 pr-9 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                      <button
                        type="button"
                        onClick={() => setResetPassForm({ ...resetPassForm, showPassword: !resetPassForm.showPassword })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {resetPassForm.showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1">
                      Confirm New Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type={resetPassForm.showPassword ? 'text' : 'password'}
                      required
                      value={resetPassForm.confirmPassword}
                      onChange={(e) => setResetPassForm({ ...resetPassForm, confirmPassword: e.target.value })}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                  <p className="font-bold">✨ System Auto-Generated Temporary Credential</p>
                  <p className="text-amber-700 mt-0.5">
                    A secure 6-digit temporary key will be generated and dispatched to the user's email.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-extrabold text-xs mb-1">
                  Reason / Order Reference
                </label>
                <input
                  type="text"
                  value={resetPassForm.reason}
                  onChange={(e) => setResetPassForm({ ...resetPassForm, reason: e.target.value })}
                  placeholder="e.g. Employee requested password reset via helpdesk ticket"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setUserToResetPasswordForm(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                >
                  <KeyRound className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Confirm Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 8: ACCOUNT STATUS TOGGLE (DEACTIVATE / REACTIVATE) INPUT FORM */}
      {/* ==================================================================== */}
      {userToToggleStatusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            {userToToggleStatusModal.status === 'active' ? (
              <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserX className="w-4 h-4 text-rose-300" />
                  <span className="font-extrabold text-xs uppercase tracking-wider">
                    Deactivate Account — {userToToggleStatusModal.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUserToToggleStatusModal(null)}
                  className="text-slate-300 hover:text-white p-1 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-300" />
                  <span className="font-extrabold text-xs uppercase tracking-wider">
                    Reactivate Account — {userToToggleStatusModal.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUserToToggleStatusModal(null)}
                  className="text-slate-300 hover:text-white p-1 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleExecuteStatusChange} className="p-5 space-y-4 text-xs">
              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <img
                  src={userToToggleStatusModal.avatar}
                  alt={userToToggleStatusModal.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 text-sm truncate">{userToToggleStatusModal.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{userToToggleStatusModal.designation} • {userToToggleStatusModal.department}</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">Current Status:</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                      userToToggleStatusModal.status === 'deactivated'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {userToToggleStatusModal.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-extrabold text-xs mb-1 uppercase tracking-wider">
                  Reason for Action <span className="text-rose-500">*</span>
                </label>
                <select
                  value={statusChangeForm.reasonCategory}
                  onChange={(e) => setStatusChangeForm({ ...statusChangeForm, reasonCategory: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {userToToggleStatusModal.status === 'active' ? (
                    <>
                      <option value="End of Contract / Tenure">End of Contract / Tenure</option>
                      <option value="Resignation / Retirement">Resignation / Retirement</option>
                      <option value="Departmental Transfer / Relocation">Departmental Transfer / Relocation</option>
                      <option value="Administrative Suspension / Investigation">Administrative Suspension / Investigation</option>
                      <option value="Unsanctioned Absence">Unsanctioned Absence</option>
                      <option value="Other Administrative Reason">Other Administrative Reason</option>
                    </>
                  ) : (
                    <>
                      <option value="Re-instated by Administration">Re-instated by Administration</option>
                      <option value="Contract Extension / Renewal">Contract Extension / Renewal</option>
                      <option value="Returned from Deputation / Long Leave">Returned from Deputation / Long Leave</option>
                      <option value="Other Administrative Reason">Other Administrative Reason</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-800 font-extrabold text-xs mb-1 uppercase tracking-wider">
                  Effective Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={statusChangeForm.effectiveDate}
                  onChange={(e) => setStatusChangeForm({ ...statusChangeForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-extrabold text-xs mb-1 uppercase tracking-wider">
                  Official Remarks / Reference Note
                </label>
                <textarea
                  rows={2}
                  value={statusChangeForm.customNotes}
                  onChange={(e) => setStatusChangeForm({ ...statusChangeForm, customNotes: e.target.value })}
                  placeholder="e.g. As per office order WII/ADMIN/2026/88..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {userToToggleStatusModal.status === 'active' ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] leading-relaxed flex items-start space-x-2">
                  <UserX className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Access Revocation Notice</p>
                    <p className="text-rose-700 text-[10.5px]">
                      Deactivating this account will immediately revoke portal sign-in credentials and stop biometric attendance sync.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] leading-relaxed flex items-start space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Access Restoration Notice</p>
                    <p className="text-emerald-700 text-[10.5px]">
                      Reactivating this account will restore active portal sign-in privileges and re-enable biometric attendance tracking.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setUserToToggleStatusModal(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`font-extrabold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs text-white ${
                    userToToggleStatusModal.status === 'active'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {userToToggleStatusModal.status === 'active' ? (
                    <>
                      <UserX className="w-3.5 h-3.5 text-rose-200" />
                      <span>Confirm Deactivation</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Confirm Reactivation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* User Project & Career Posting History Modal */}
      <UserProjectHistoryModal
        user={historyUser}
        isOpen={!!historyUser}
        onClose={() => setHistoryUser(null)}
      />
    </div>
  );
};

