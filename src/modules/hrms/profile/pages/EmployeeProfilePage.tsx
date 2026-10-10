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
import { AppSelect } from '../../../../shared/components/AppSelect';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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

export const PROJECTS_MASTER = [
  'National Tiger Conservation Authority (NTCA) Project',
  'CAMPA - Recovery Program for Bustard',
  'Ganga Rejuvenation & River Biodiversity Project',
  'All India Synchronized Elephant Population Estimation',
  'Snow Leopard Population Assessment in India (SPAI)',
  'Central Indian Landscape Wildlife Corridor Monitoring',
  'EIA Study of Infrastructure Projects in Eco-Sensitive Zones',
  'Wildlife Crime Control & Forensic Species Identification',
  'GIS & Spatial Ecology of Protected Areas',
  'Bio-Resource Conservation & Community Livelihoods'
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
      return 'HoD';
    default:
      return 'user';
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
    transferLogs,
    departmentsMaster,
    designationsMaster,
    categoriesMaster,
    projectsMaster,
    coursesMaster,
    batchesMaster,
    phdEnrollmentMaster,
    locationsMaster
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
      if (q.length < 2) return true;
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

  // Calculate retirement date: On the day one less than 60th the month in which DOB falls on last day of that month
  const calculateRetirementDate = (dobStr?: string): string => {
    if (!dobStr) return 'Enter DOB to calculate';
    const parts = dobStr.split('-');
    if (parts.length !== 3) return 'Enter DOB to calculate';
    const birthYear = parseInt(parts[0], 10);
    const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    const birthDay = parseInt(parts[2], 10);

    if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return 'Enter DOB to calculate';

    let targetYear = birthYear + 60;
    let targetMonth = birthMonth;

    // If born on the 1st of the month, retirement is last day of previous month
    if (birthDay === 1) {
      targetMonth = birthMonth - 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
    }

    const lastDay = new Date(targetYear, targetMonth + 1, 0);
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
    gender: '',
    phone: '',
    emergencyContactPhone: '',
    biometricId: '',
    permanentEmploymentType: '' as 'Direct' | 'Deputation' | '',
    shiftId: '',
    leaveCycle: '' as 'CY' | 'FY' | '',
    leaveCycleBasis: '' as 'calendar_year' | 'financial_year' | '',
    department: '',
    designation: '',
    role: 'general_staff' as UserRole,
    employmentType: 'permanent' as EmploymentType,
    employeeCategory: '',
    isPhDEnrolled: false,
    officeLocation: 'Main Campus, Building A',
    reportingManagerId: '',
    reviewingManagerId: '',
    joiningDate: '',
    dob: '',
    isOnProbation: false,
    probationEndDate: '',
    validUntilDate: '',
    piName: '',
    hodName: '',
    courseProgram: '',
    courseBatch: '',
    enrolledThrough: '',
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
      lams: u.moduleRoles?.lams ? [...u.moduleRoles.lams] : getUserModuleRoles(u, 'lams'),
      pms: u.moduleRoles?.pms ? [...u.moduleRoles.pms] : [],
      sims: u.moduleRoles?.sims ? [...u.moduleRoles.sims] : [],
      fms: u.moduleRoles?.fms ? [...u.moduleRoles.fms] : [],
      finance: u.moduleRoles?.finance ? [...u.moduleRoles.finance] : []
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
  const [transferEmpSearchQuery, setTransferEmpSearchQuery] = useState('');
  const [transferDeptFilter, setTransferDeptFilter] = useState('all');

  const [transferForm, setTransferForm] = useState({
    newDept: '',
    newReportingManagerId: '',
    newReviewingManagerId: '',
    newLocation: '',
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
  const [transferSortField, setTransferSortField] = useState<'name' | 'dept' | 'effectiveDate'>('effectiveDate');
  const [transferSortOrder, setTransferSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleTransferSort = (field: 'name' | 'dept' | 'effectiveDate') => {
    if (transferSortField === field) {
      setTransferSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTransferSortField(field);
      setTransferSortOrder('asc');
    }
  };

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
        return 'Permanent';
      case 'contractual':
        return 'Contractual';
      case 'researcher':
        return 'Project Staff';
      case 'diploma_trainee':
        return 'Trainee';
      case 'intern':
        return 'Intern';
      case 'bsc_msc_student':
        return 'M.Sc Student';
      case 'phd_student':
        return 'PhD Scholar';
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

    const missingFields: string[] = [];
    if (!newUserForm.name?.trim()) missingFields.push('Full Name');
    if (!newUserForm.gender?.trim()) missingFields.push('Gender');
    if (!newUserForm.dob?.trim()) missingFields.push('Date of Birth (DOB)');
    if (!newUserForm.phone?.trim()) missingFields.push('Mobile Number');
    if (!newUserForm.email?.trim()) missingFields.push('Email Address');
    if (!newUserForm.biometricId?.trim() && !newUserForm.emergencyContactPhone?.trim()) missingFields.push('Biometric ID');
    if (!newUserForm.employmentType) missingFields.push('Employee Type');
    if (!newUserForm.shiftId?.trim()) missingFields.push('Shift');
    if (!newUserForm.leaveCycle) missingFields.push('Leave Year Type');
    if (!newUserForm.joiningDate?.trim()) missingFields.push('Date of Joining');

    if (newUserForm.employmentType === 'permanent') {
      if (!newUserForm.permanentEmploymentType?.trim()) missingFields.push('Employment Type (Direct / Deputation)');
      if (!newUserForm.employeeCategory?.trim()) missingFields.push('Category (Administrative / Scientific / Technical)');
      if (!newUserForm.designation?.trim()) missingFields.push('Designation');
      if (!newUserForm.department?.trim()) missingFields.push('Department / Section / Cell');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.hodName?.trim()) missingFields.push('HoD');
      if (newUserForm.permanentEmploymentType === 'Deputation' && !newUserForm.validUntilDate?.trim()) {
        missingFields.push('Valid Up To Date');
      }
      if (newUserForm.isOnProbation && !newUserForm.probationEndDate?.trim()) missingFields.push('Tentative Probation End Date');
    } else if (newUserForm.employmentType === 'contractual') {
      if (!newUserForm.employeeCategory?.trim()) missingFields.push('Category (Administrative / Scientific / Technical)');
      if (!newUserForm.designation?.trim()) missingFields.push('Designation');
      if (!newUserForm.department?.trim()) missingFields.push('Department / Section / Cell');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (newUserForm.employmentType === 'researcher') {
      if (!newUserForm.designation?.trim()) missingFields.push('Designation');
      if (!newUserForm.department?.trim()) missingFields.push('Project Name');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager / PI');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (newUserForm.employmentType === 'diploma_trainee') {
      if (!newUserForm.courseProgram?.trim()) missingFields.push('Course');
      if (!newUserForm.courseBatch?.trim()) missingFields.push('Batch');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (newUserForm.employmentType === 'bsc_msc_student') {
      if (!newUserForm.courseProgram?.trim()) missingFields.push('Course');
      if (!newUserForm.courseBatch?.trim()) missingFields.push('Batch');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (newUserForm.employmentType === 'phd_student') {
      if (!newUserForm.enrolledThrough?.trim()) missingFields.push('Enrolled Through');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (newUserForm.employmentType === 'intern') {
      if (!newUserForm.department?.trim()) missingFields.push('Project / Department / Section / Cell');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    }

    if (missingFields.length > 0) {
      showToast(`Mandatory fields required: ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? ` and ${missingFields.length - 3} more` : ''}`);
      return;
    }

    const defaultShiftId = shifts.find((s) => s.isDefault)?.id || shifts[0]?.id || 'shift-gen';
    const chosenCycle = (newUserForm.leaveCycle as 'CY' | 'FY') || (isCalendarYearCadre(newUserForm.employmentType as EmploymentType) ? 'CY' : 'FY');

    const created = addUserProfile({
      name: newUserForm.name,
      email: newUserForm.email,
      gender: newUserForm.gender,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80`,
      role: newUserForm.role || 'general_staff',
      employmentType: (newUserForm.employmentType as EmploymentType) || 'permanent',
      employeeCategory: newUserForm.employeeCategory || 'Administrative',
      isPhDEnrolled: newUserForm.isPhDEnrolled,
      department: newUserForm.department || 'Wildlife Sciences',
      designation: newUserForm.designation || 'Staff',
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

    showToast(`New Employee profile created for ${created.name}!`);
    setIsCreatingUser(false);
    setSelectedUserId(created.id);
  };

  const handleOpenCreateEmployeeModal = () => {
    setNewUserForm({
      name: '',
      email: '',
      gender: '',
      phone: '',
      emergencyContactPhone: '',
      biometricId: '',
      shiftId: '',
      leaveCycle: '' as 'CY' | 'FY' | '',
      leaveCycleBasis: '' as 'calendar_year' | 'financial_year' | '',
      department: '',
      designation: '',
      role: 'general_staff' as UserRole,
      employmentType: 'permanent' as EmploymentType,
      employeeCategory: '',
      isPhDEnrolled: false,
      officeLocation: 'Main Campus, Building A',
      reportingManagerId: '',
      reviewingManagerId: '',
      joiningDate: '',
      dob: '',
      isOnProbation: false,
      probationEndDate: '',
      validUntilDate: '',
      piName: '',
      hodName: '',
      courseProgram: '',
      courseBatch: '',
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

  // Memoized active employees (excluding deactivated)
  const activeEmployees = useMemo(() => {
    return users.filter((u) => u.status !== 'deactivated');
  }, [users]);

  // Filtered active employees for employee transfer search (minimum 2 chars required)
  const searchedTransferEmployees = useMemo(() => {
    const q = transferEmpSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return activeEmployees.filter((emp) => {
      const nameMatch = (emp.name || '').toLowerCase().includes(q);
      const idMatch = (emp.biometricId || '').toLowerCase().includes(q) || (emp.id || '').toLowerCase().includes(q);
      const deptMatch = (emp.department || '').toLowerCase().includes(q);
      const desigMatch = (emp.designation || '').toLowerCase().includes(q);
      const emailMatch = (emp.email || '').toLowerCase().includes(q);
      return nameMatch || idMatch || deptMatch || desigMatch || emailMatch;
    });
  }, [activeEmployees, transferEmpSearchQuery]);

  // Memoized active managers & HoDs (strictly active only)
  const activeManagersAndHods = useMemo(() => {
    return users.filter((u) => {
      if (u.status === 'deactivated') return false;
      const roleStr = String(u.role || '').toLowerCase();
      const rolesArr = (u.roles || []).map((r) => String(r).toLowerCase());
      const desigStr = String(u.designation || '').toLowerCase();

      const isMgrRole =
        roleStr.includes('manager') ||
        roleStr.includes('admin') ||
        roleStr.includes('director') ||
        roleStr.includes('hod') ||
        roleStr.includes('head') ||
        rolesArr.some((r) => r.includes('manager') || r.includes('admin') || r.includes('director') || r.includes('hod'));

      const isMgrDesig =
        desigStr.includes('manager') ||
        desigStr.includes('director') ||
        desigStr.includes('head') ||
        desigStr.includes('officer') ||
        desigStr.includes('in-charge') ||
        desigStr.includes('incharge') ||
        desigStr.includes('hod') ||
        desigStr.includes('scientist') ||
        desigStr.includes('dean');

      const hasReportees = users.some(
        (other) => (other.reportingManagerId === u.id || other.reviewingManagerId === u.id) && other.status !== 'deactivated'
      );

      return isMgrRole || isMgrDesig || hasReportees;
    });
  }, [users]);

  // Compute direct active reportees under the outgoing manager for the replacement mode
  const reporteesUnderOutgoing = useMemo(() => {
    if (!managerReplacementForm.outgoingManagerId) return [];
    const outMgr = users.find((u) => u.id === managerReplacementForm.outgoingManagerId);
    return users.filter((u) => {
      if (u.status === 'deactivated') return false;
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
    setTransferEmpSearchQuery('');
    setTransferDeptFilter('all');
    if (u) {
      setSelectedTransferUserIds([u.id]);
      setTransferForm({
        newDept: '',
        newReportingManagerId: '',
        newReviewingManagerId: '',
        newLocation: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } else {
      setSelectedTransferUserIds([]);
      setTransferForm({
        newDept: '',
        newReportingManagerId: '',
        newReviewingManagerId: '',
        newLocation: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setActiveTransferModal('employee_transfer');
  };

  const handleOpenManagerReplacementModal = (outgoingMgrId?: string) => {
    setManagerReplacementForm({
      outgoingManagerId: outgoingMgrId || '',
      incomingManagerId: '',
      reassignType: 'both',
      selectedReporteeIds: [],
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
        !q || q.length < 2 ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        (u.biometricId && u.biometricId.toLowerCase().includes(q));

      const matchModule =
        userControlsModuleFilter.includes('all') ||
        userControlsModuleFilter.some((m) => {
          const modKey = (m === 'hrms' ? 'lams' : m === 'stock' ? 'sims' : m === 'facility' ? 'fms' : m) as EnterpriseModuleId;
          const assignedRoles = u.moduleRoles?.[modKey];
          return Array.isArray(assignedRoles) && assignedRoles.length > 0;
        });

      const matchRole =
        userControlsRoleFilter.includes('all') ||
        userControlsRoleFilter.some((rf) => {
          if (rf === 'administrator') {
            return u.role === 'administrator' || u.roles?.includes('administrator') ||
              (u.moduleRoles?.lams || []).includes('hrms_admin') ||
              (u.moduleRoles?.pms || []).includes('pms_admin') ||
              (u.moduleRoles?.sims || []).includes('sims_admin') ||
              (u.moduleRoles?.finance || []).includes('fin_admin') ||
              (u.moduleRoles?.fms || []).includes('fms_admin');
          }
          if (rf === 'reviewing_manager') {
            return u.role === 'reviewing_manager' || u.roles?.includes('reviewing_manager') ||
              (u.moduleRoles?.lams || []).includes('hrms_reviewing') ||
              (u.moduleRoles?.pms || []).includes('pms_pi') ||
              (u.moduleRoles?.sims || []).includes('sims_approver') ||
              (u.moduleRoles?.finance || []).includes('fin_officer') ||
              (u.moduleRoles?.fms || []).includes('fms_officer');
          }
          if (rf === 'reporting_manager') {
            return u.role === 'reporting_manager' || u.roles?.includes('reporting_manager') ||
              (u.moduleRoles?.lams || []).includes('hrms_reporting') ||
              (u.moduleRoles?.pms || []).includes('pms_co_pi') ||
              (u.moduleRoles?.sims || []).includes('sims_store_keeper') ||
              (u.moduleRoles?.finance || []).includes('fin_accountant') ||
              (u.moduleRoles?.fms || []).includes('fms_supervisor');
          }
          if (rf === 'general_staff' || rf === 'user') {
            return u.role === 'general_staff' || (u.roles || []).includes('general_staff') ||
              (u.moduleRoles?.lams || []).includes('hrms_staff') ||
              (u.moduleRoles?.pms || []).includes('pms_researcher') ||
              (u.moduleRoles?.sims || []).includes('sims_indenter') ||
              (u.moduleRoles?.finance || []).includes('fin_claimant') ||
              (u.moduleRoles?.fms || []).includes('fms_requester');
          }
          return u.role === rf || (u.roles && u.roles.includes(rf as UserRole));
        });

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
  const [userControlsSortField, setUserControlsSortField] = useState<'name' | 'status'>('name');
  const [userControlsSortOrder, setUserControlsSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleUserControlsSort = (field: 'name' | 'status') => {
    if (userControlsSortField === field) {
      setUserControlsSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setUserControlsSortField(field);
      setUserControlsSortOrder('asc');
    }
  };

  const sortedUsersForControls = useMemo(() => {
    return [...filteredUsersForControls].sort((a, b) => {
      let cmp = 0;
      if (userControlsSortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (userControlsSortField === 'status') {
        const statusA = a.status || 'active';
        const statusB = b.status || 'active';
        cmp = statusA.localeCompare(statusB);
      }
      return userControlsSortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredUsersForControls, userControlsSortField, userControlsSortOrder]);

  const paginatedUsersForControls = useMemo(() => {
    const start = (userControlsPage - 1) * userControlsPageSize;
    return sortedUsersForControls.slice(start, start + userControlsPageSize);
  }, [sortedUsersForControls, userControlsPage, userControlsPageSize]);

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
                title="New Employee"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ New Employee</span>
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
                <div className="pt-2 border-t border-slate-100">
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
                      options={departmentsMaster.map((dept) => ({ label: dept, value: dept }))}
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
            /* VIEW 2: DETAILED SELECTED PROFILE VIEW (REBUILT & STREAMLINED)   */
            /* ================================================================ */
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs space-y-6">
              {/* Unified Dark Navy Cover Header */}
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5 sm:p-6 relative text-white">
                {/* Profile Details Header */}
                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <div className="relative shrink-0">
                    <img
                      src={selectedUser.avatar}
                      alt={selectedUser.name}
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover ring-4 ring-white/20 shadow-xl bg-slate-800"
                    />
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                        selectedUser.status === 'deactivated' ? 'bg-slate-400' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-xs">{selectedUser.name}</h2>
                    <p className="text-xs sm:text-sm font-bold text-blue-300 mt-0.5">{selectedUser.designation}</p>
                    <p className="text-[11px] sm:text-xs font-medium text-slate-300">{selectedUser.department}</p>
                  </div>
                </div>
              </div>

              {/* Profile Body: Clean, Organized Information Cards */}
              <div className="p-4 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Card 1: Official & Employment Details */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                    <div className="flex items-center space-x-2 text-slate-900 font-black text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5">
                      <Building className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Official &amp; Employment Details</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Department</span>
                        <span className="font-bold text-slate-900">{selectedUser.department}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Designation</span>
                        <span className="font-bold text-slate-900">{selectedUser.designation}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Employment Cadre</span>
                        <span className="font-bold text-slate-900">{getEmploymentTypeLabel(selectedUser.employmentType)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Date of Joining</span>
                        <span className="font-bold text-slate-900">{selectedUser.joiningDate || 'N/A'}</span>
                        <span className="text-[10px] text-blue-600 block mt-0.5 font-medium">{calculateServiceTenure(selectedUser.joiningDate)}</span>
                      </div>

                      {selectedUser.dob && (
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Date of Birth (DOB)</span>
                          <span className="font-bold text-slate-900">{selectedUser.dob}</span>
                        </div>
                      )}

                      {selectedUser.employmentType === 'permanent' ? (
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Superannuation Date</span>
                          <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block text-[11px]">
                            {calculateRetirementDate(selectedUser.dob)}
                          </span>
                        </div>
                      ) : selectedUser.validUntilDate ? (
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Tenure / Contract Valid Up To</span>
                          <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block text-[11px]">
                            {selectedUser.validUntilDate}
                          </span>
                        </div>
                      ) : null}

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Assigned Work Shift</span>
                        <span className="font-bold text-slate-900">
                          {(() => {
                            const userShift = shifts.find((s) => s.id === selectedUser.shiftId) || shifts.find((s) => s.isDefault) || shifts[0];
                            return userShift ? `${userShift.name} (${userShift.startTime} - ${userShift.endTime})` : 'General Shift (09:00 - 17:30)';
                          })()}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Probation Status</span>
                        <span className="font-bold text-slate-900">
                          {selectedUser.isOnProbation
                            ? `Under Probation (Until ${selectedUser.probationEndDate || 'N/A'})`
                            : 'Confirmed Regular Staff'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Reporting Hierarchy & Roles */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                    <div className="flex items-center space-x-2 text-slate-900 font-black text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5">
                      <Shield className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Reporting Hierarchy &amp; Access Roles</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Reporting Manager (L1)</span>
                        <span className="font-bold text-slate-900">
                          {users.find((u) => u.id === selectedUser.reportingManagerId)?.name || 'Not Assigned'}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {users.find((u) => u.id === selectedUser.reportingManagerId)?.designation || ''}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Reviewing Officer / HoD (L2)</span>
                        <span className="font-bold text-slate-900">
                          {selectedUser.hodName || users.find((u) => u.id === selectedUser.reviewingManagerId)?.name || 'Not Assigned'}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {users.find((u) => u.id === selectedUser.reviewingManagerId)?.designation || ''}
                        </span>
                      </div>

                      {(selectedUser.piName || selectedUser.guideSupervisor) && (
                        <div className="sm:col-span-2">
                          <span className="text-[10px] text-slate-400 font-semibold block">Principal Investigator / Supervisor</span>
                          <span className="font-bold text-slate-900">{selectedUser.piName || selectedUser.guideSupervisor}</span>
                        </div>
                      )}

                      <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">Assigned System Roles</span>
                        <div className="flex flex-wrap gap-1.5">
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
                </div>

                {/* Card 3: Contact Information */}
                <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                  <div className="flex items-center space-x-2 text-slate-900 font-black text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5">
                    <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Contact Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Official Email</span>
                      <span className="font-bold text-slate-900 truncate block">{selectedUser.email}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Contact Phone</span>
                      <span className="font-bold text-slate-900">{selectedUser.phone || '+91 98765 43210'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Emergency Contact</span>
                      <span className="font-bold text-slate-900">{selectedUser.emergencyContactName || 'Family / Guardian'}</span>
                      <span className="text-[10px] text-slate-500 block">{selectedUser.emergencyContactPhone || '+91 99887 76655'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Academic Program & Research (Conditionally displayed when relevant) */}
                {(selectedUser.employmentType === 'bsc_msc_student' ||
                  selectedUser.employmentType === 'phd_student' ||
                  selectedUser.employmentType === 'diploma_trainee' ||
                  selectedUser.employmentType === 'intern' ||
                  selectedUser.isPhDEnrolled) && (
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                    <div className="flex items-center space-x-2 text-indigo-950 font-black text-xs uppercase tracking-wider border-b border-indigo-200/80 pb-2.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Academic Program &amp; Research Affiliation</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-slate-800">
                      {selectedUser.courseProgram && (
                        <div>
                          <span className="text-[10px] text-indigo-800 font-semibold block">Degree / Course Program</span>
                          <span className="font-bold text-slate-900">{selectedUser.courseProgram}</span>
                        </div>
                      )}

                      {selectedUser.courseBatch && (
                        <div>
                          <span className="text-[10px] text-indigo-800 font-semibold block">Batch / Academic Year</span>
                          <span className="font-bold text-slate-900">{selectedUser.courseBatch}</span>
                        </div>
                      )}

                      {(selectedUser.universityName || selectedUser.parentInstitution) && (
                        <div>
                          <span className="text-[10px] text-indigo-800 font-semibold block">Affiliated University / Institute</span>
                          <span className="font-bold text-slate-900">{selectedUser.universityName || selectedUser.parentInstitution}</span>
                        </div>
                      )}

                      {selectedUser.enrollmentNo && (
                        <div>
                          <span className="text-[10px] text-indigo-800 font-semibold block">Enrollment / Registration No</span>
                          <span className="font-mono font-bold text-indigo-950">{selectedUser.enrollmentNo}</span>
                        </div>
                      )}

                      {(selectedUser.guideSupervisor || selectedUser.phdGuide) && (
                        <div>
                          <span className="text-[10px] text-indigo-800 font-semibold block">Academic Supervisor / Guide</span>
                          <span className="font-bold text-slate-900">{selectedUser.phdGuide || selectedUser.guideSupervisor}</span>
                        </div>
                      )}

                      {selectedUser.phdTopic && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <span className="text-[10px] text-indigo-800 font-semibold block">Research Topic / Title</span>
                          <span className="font-bold text-slate-900">{selectedUser.phdTopic}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Card 5: Service & Posting History Timeline */}
                <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center space-x-2 text-slate-900 font-black text-xs uppercase tracking-wider">
                      <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Service &amp; Posting History</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
                      {calculateServiceTenure(selectedUser.joiningDate)}
                    </span>
                  </div>

                  {/* Clean Minimal Timeline */}
                  <div className="relative pl-4 border-l-2 border-slate-200 space-y-3 my-1 text-xs">
                    {/* Active Posting */}
                    <div className="relative">
                      <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-900">{selectedUser.designation}</span>
                            <span className="px-2 py-0.2 rounded text-[9.5px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Current Posting
                            </span>
                          </div>
                          <span className="text-[10.5px] text-slate-500 font-mono">
                            {selectedUser.joiningDate ? `${selectedUser.joiningDate} — Present` : 'Present'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          {selectedUser.department}
                        </p>
                      </div>
                    </div>

                    {/* Historical Transfers */}
                    {transferLogs
                      .filter(
                        (t) =>
                          t.userId === selectedUser.id ||
                          t.userName.toLowerCase() === selectedUser.name.toLowerCase()
                      )
                      .map((t) => (
                        <div key={t.id} className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100"></div>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="font-bold text-slate-900">Transfer &amp; Posting Order</span>
                              <span className="text-[10.5px] text-slate-500 font-mono">Effective: {t.effectiveDate}</span>
                            </div>
                            <div className="text-[11px] text-slate-700">
                              <span className="text-slate-500">Department:</span> {t.previousDept} <span className="text-blue-600 font-bold">→</span> {t.newDept}
                            </div>
                            {t.notes && (
                              <p className="text-[10.5px] text-slate-500 italic">Note: {t.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
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
              <div className="pt-2 border-t border-slate-100">
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
                      { label: 'HoD', value: 'reviewing_manager' },
                      { label: 'user', value: 'general_staff' }
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
            <div className="w-full overflow-x-auto custom-table-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100/95 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[10.5px] shadow-2xs">
                  <tr className="h-10">
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[30%]">
                      <button
                        type="button"
                        onClick={() => handleUserControlsSort('name')}
                        className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-colors cursor-pointer select-none group"
                      >
                        <span>EMPLOYEE</span>
                        {userControlsSortField === 'name' ? (
                          userControlsSortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 opacity-60 shrink-0" />
                        )}
                      </button>
                    </th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[42%]">Role &amp; Module</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[12%] text-center">
                      <button
                        type="button"
                        onClick={() => handleUserControlsSort('status')}
                        className="inline-flex items-center justify-center space-x-1.5 font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-colors cursor-pointer select-none group mx-auto"
                      >
                        <span>STATUS</span>
                        {userControlsSortField === 'status' ? (
                          userControlsSortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 opacity-60 shrink-0" />
                        )}
                      </button>
                    </th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap align-middle w-[16%]">Actions</th>
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
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5 shadow-2xs aspect-square"
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

                        {/* 2. Role & Module Column - Clean, Compact Inline Module Display */}
                        <td
                          onClick={() => handleOpenEditRoles(u)}
                          title="Click to view/edit Role & Module Matrix"
                          className="px-3.5 py-3 align-middle cursor-pointer hover:bg-slate-100/60 transition-colors group"
                        >
                          <div className="flex flex-wrap items-center gap-1.5 max-w-full">
                            {(() => {
                              const ALL_MODULES: { id: EnterpriseModuleId; label: string }[] = [
                                { id: 'lams', label: 'HRMS' },
                                { id: 'pms', label: 'PMS' },
                                { id: 'sims', label: 'Stock' },
                                { id: 'finance', label: 'Finance' },
                                { id: 'fms', label: 'Facility' }
                              ];

                              const assignedModules = ALL_MODULES.map((m) => {
                                const roleIds = u.moduleRoles?.[m.id] || [];
                                const defs = MODULE_ROLE_DEFINITIONS[m.id] || [];

                                const roles = roleIds.map((rId) => {
                                  const found = defs.find((d) => d.id === rId);
                                  return found ? (found.shortName || found.name) : rId;
                                });

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
                                    No roles assigned
                                  </span>
                                );
                              }

                              return assignedModules.map((m) => (
                                <div
                                  key={m.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50/70 text-indigo-950 border border-indigo-200/90 text-[11px] font-medium shadow-2xs max-w-full shrink-0"
                                >
                                  <span className="font-extrabold text-slate-900 bg-white/95 px-1.5 py-0.5 rounded border border-indigo-100 text-[10px] tracking-wide shrink-0">
                                    {m.label}
                                  </span>
                                  <span className="text-indigo-800 font-bold truncate text-[10.5px] max-w-[220px] inline-block" title={m.roles.join(', ')}>
                                    {m.roles.join(', ')}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        </td>

                        {/* 3. Status Column */}
                        <td className="px-3.5 py-3 align-middle text-center whitespace-nowrap">
                          {u.status === 'deactivated' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-bold text-[10px] uppercase whitespace-nowrap shrink-0">
                              <UserX className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="whitespace-nowrap">Deactivated</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-[10px] uppercase whitespace-nowrap shrink-0">
                              <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="whitespace-nowrap">Active</span>
                            </span>
                          )}
                        </td>

                        {/* 4. Actions Column */}
                        <td className="px-3.5 py-3 text-right align-middle whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {/* Project & Career History Button */}
                            <button
                              onClick={() => setHistoryUser(u)}
                              title="View Project & Career Posting History"
                              className="w-7 h-7 min-w-[28px] min-h-[28px] max-w-[28px] max-h-[28px] aspect-square p-0 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold cursor-pointer inline-flex items-center justify-center border border-purple-200 transition-all active:scale-95 shadow-2xs shrink-0"
                            >
                              <Briefcase className="w-3.5 h-3.5 text-purple-600 stroke-[2] shrink-0" />
                            </button>

                            {/* Edit User Roles & 2D Matrix Button */}
                            {isAdmin && (
                              <button
                                onClick={() => handleOpenEditRoles(u)}
                                title="Configure User Roles & 2D Matrix Permissions"
                                className="w-7 h-7 min-w-[28px] min-h-[28px] max-w-[28px] max-h-[28px] aspect-square p-0 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold cursor-pointer inline-flex items-center justify-center border border-indigo-200 transition-all active:scale-95 shadow-2xs shrink-0"
                              >
                                <Shield className="w-3.5 h-3.5 text-indigo-700 stroke-[2.2] shrink-0" />
                              </button>
                            )}

                            {/* Reset Password */}
                            <button
                              onClick={() => handleTriggerResetPassword(u)}
                              title="Reset User Password"
                              className="w-7 h-7 min-w-[28px] min-h-[28px] max-w-[28px] max-h-[28px] aspect-square p-0 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold cursor-pointer inline-flex items-center justify-center border border-slate-200 transition-all active:scale-95 shadow-2xs shrink-0"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-slate-600 stroke-[2] shrink-0" />
                            </button>

                            {/* Toggle Active/Deactive */}
                            {isAdmin && !isSelf && (
                              <button
                                onClick={() => handleOpenStatusToggleModal(u)}
                                title={u.status === 'deactivated' ? 'Reactivate User' : 'Deactivate User'}
                                className={`w-7 h-7 min-w-[28px] min-h-[28px] max-w-[28px] max-h-[28px] aspect-square p-0 rounded-lg font-bold cursor-pointer inline-flex items-center justify-center transition-all border active:scale-95 shadow-2xs shrink-0 ${
                                  u.status === 'deactivated'
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                                }`}
                              >
                                {u.status === 'deactivated' ? (
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-700 stroke-[2] shrink-0" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5 text-amber-700 stroke-[2] shrink-0" />
                                )}
                              </button>
                            )}

                            {/* Delete User */}
                            {isAdmin && !isSelf && (
                              <button
                                onClick={() => setUserToDelete(u)}
                                title="Delete User"
                                className="w-7 h-7 min-w-[28px] min-h-[28px] max-w-[28px] max-h-[28px] aspect-square p-0 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold cursor-pointer inline-flex items-center justify-center border border-rose-200 transition-all shrink-0 active:scale-95 shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600 stroke-[2] shrink-0" />
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
            <div className="w-full border-t border-slate-200/90 bg-white rounded-b-2xl">
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
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap">
                  {/* 1. Department Filter Pill */}
                  <div className="flex-1 min-w-[160px] max-w-[260px] shrink-0 sm:shrink">
                    <MultiSelectFilter
                      label="Department"
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      selectedValues={transferRegisterDeptFilter}
                      onChange={setTransferRegisterDeptFilter}
                      options={departmentsMaster.map((d) => ({
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
            <div className="w-full overflow-x-auto custom-table-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100/95 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[10.5px] shadow-2xs">
                  <tr className="h-10">
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[24%]">
                      <button
                        type="button"
                        onClick={() => handleTransferSort('name')}
                        className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-colors cursor-pointer select-none group"
                      >
                        <span>EMPLOYEE</span>
                        {transferSortField === 'name' ? (
                          transferSortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 opacity-60 shrink-0" />
                        )}
                      </button>
                    </th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[26%]">
                      <button
                        type="button"
                        onClick={() => handleTransferSort('dept')}
                        className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-colors cursor-pointer select-none group"
                      >
                        <span>NEW DEPARTMENT</span>
                        {transferSortField === 'dept' ? (
                          transferSortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 opacity-60 shrink-0" />
                        )}
                      </button>
                    </th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[24%]">Hierarchy Reassignment</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap align-middle w-[12%]">
                      <button
                        type="button"
                        onClick={() => handleTransferSort('effectiveDate')}
                        className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-colors cursor-pointer select-none group"
                      >
                        <span>EFFECTIVE DATE</span>
                        {transferSortField === 'effectiveDate' ? (
                          transferSortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 opacity-60 shrink-0" />
                        )}
                      </button>
                    </th>
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

                    const sorted = [...filtered].sort((a, b) => {
                      let cmp = 0;
                      if (transferSortField === 'name') {
                        cmp = a.userName.localeCompare(b.userName);
                      } else if (transferSortField === 'dept') {
                        cmp = a.newDept.localeCompare(b.newDept);
                      } else if (transferSortField === 'effectiveDate') {
                        cmp = (a.effectiveDate || '').localeCompare(b.effectiveDate || '');
                      }
                      return transferSortOrder === 'asc' ? cmp : -cmp;
                    });

                    if (sorted.length === 0) {
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

                    return sorted.map((log) => {
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
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <Edit3 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    Edit Profile: {editingUser.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="relative z-10 text-blue-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
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
                  <span className="uppercase tracking-wider text-[11px] text-slate-700">Basic Personal Details</span>
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
                  <span className="uppercase tracking-wider text-[11px] text-slate-700">Official &amp; Cadre Details</span>
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
                          {editingUser.designation && !designationsMaster.includes(editingUser.designation) && (
                            <option value={editingUser.designation}>{editingUser.designation}</option>
                          )}
                          {designationsMaster.map((desig) => (
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
                          {editingUser.department && !departmentsMaster.includes(editingUser.department) && (
                            <option value={editingUser.department}>{editingUser.department}</option>
                          )}
                          {departmentsMaster.map((dept) => (
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
                          {editingUser.designation && !designationsMaster.includes(editingUser.designation) && (
                            <option value={editingUser.designation}>{editingUser.designation}</option>
                          )}
                          {designationsMaster.map((desig) => (
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
                          {editingUser.department && !departmentsMaster.includes(editingUser.department) && (
                            <option value={editingUser.department}>{editingUser.department}</option>
                          )}
                          {departmentsMaster.map((dept) => (
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
                          {editingUser.designation && !designationsMaster.includes(editingUser.designation) && (
                            <option value={editingUser.designation}>{editingUser.designation}</option>
                          )}
                          {designationsMaster.map((desig) => (
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
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <UserPlus className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    Add New Employee Profile
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingUser(false)}
                className="relative z-10 text-blue-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* Unified Form Grid without Subheadings or Numbering */}
                <div className="p-3.5 sm:p-4 bg-slate-50/70 border border-slate-200/90 rounded-2xl space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Full Name <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter Full Name"
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 text-xs bg-white text-slate-900 font-medium shadow-2xs transition-all"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Gender <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <AppSelect
                        value={newUserForm.gender}
                        placeholder="Select Gender"
                        onChange={(val) => setNewUserForm({ ...newUserForm, gender: val })}
                        options={[
                          { label: 'Select Gender', value: '' },
                          { label: 'Male', value: 'Male' },
                          { label: 'Female', value: 'Female' },
                          { label: 'Other', value: 'Other' }
                        ]}
                        className="w-full"
                      />
                    </div>

                    {/* Date of Birth (DOB) */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Date of Birth (DOB) <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <AppDatePicker
                        value={newUserForm.dob}
                        placeholder="Select Date of Birth"
                        onChange={(val) => setNewUserForm({ ...newUserForm, dob: val })}
                        className="w-full"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Mobile Number (Mob) <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter Mobile Number"
                        value={newUserForm.phone}
                        onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 text-xs bg-white text-slate-900 font-medium shadow-2xs transition-all"
                      />
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Email Address <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="Enter Email Address"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 text-xs bg-white text-slate-900 font-medium shadow-2xs transition-all"
                      />
                    </div>

                    {/* Biometric ID */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Biometric ID <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newUserForm.biometricId || newUserForm.emergencyContactPhone}
                        onChange={(e) => setNewUserForm({ ...newUserForm, biometricId: e.target.value, emergencyContactPhone: e.target.value })}
                        placeholder="Enter Biometric ID"
                        className="w-full px-3 py-2 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 text-xs bg-white text-slate-900 font-semibold shadow-2xs transition-all"
                      />
                    </div>

                    {/* Employee Type Selection */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Employee Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <AppSelect
                        value={newUserForm.employmentType || 'permanent'}
                        placeholder="Select Employee Type"
                        onChange={(val) => {
                          const newCategory = (val || 'permanent') as EmploymentType;
                          setNewUserForm({
                            ...newUserForm,
                            employmentType: newCategory,
                            employeeCategory: '',
                            permanentEmploymentType: ''
                          });
                        }}
                        options={[
                          { label: 'Select Employee Type', value: '' },
                          { label: 'Permanent', value: 'permanent' },
                          { label: 'Contractual', value: 'contractual' },
                          { label: 'Project Staff', value: 'researcher' },
                          { label: 'Trainee', value: 'diploma_trainee' },
                          { label: 'M.Sc Student', value: 'bsc_msc_student' },
                          { label: 'PhD Scholar', value: 'phd_student' },
                          { label: 'Intern', value: 'intern' }
                        ]}
                        className="w-full"
                      />
                    </div>

                    {/* PERMANENT */}
                    {newUserForm.employmentType === 'permanent' && (
                      <>
                        {/* Employment Type: Direct / Deputation */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Employment Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.permanentEmploymentType}
                            placeholder="Select Employment Type"
                            onChange={(val) => setNewUserForm({ ...newUserForm, permanentEmploymentType: val as any })}
                            options={[
                              { label: 'Select Employment Type', value: '' },
                              { label: 'Direct', value: 'Direct' },
                              { label: 'Deputation', value: 'Deputation' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Category: Administrative / Scientific / Technical */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Category <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.employeeCategory}
                            placeholder="Select Category"
                            onChange={(val) => setNewUserForm({ ...newUserForm, employeeCategory: val })}
                            options={[
                              { label: 'Select Category', value: '' },
                              ...categoriesMaster.map((c) => ({ label: c, value: c }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Designation */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Designation <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.designation}
                            placeholder="Select Designation"
                            onChange={(val) => setNewUserForm({ ...newUserForm, designation: val })}
                            options={[
                              { label: 'Select Designation', value: '' },
                              ...designationsMaster.map((desig) => ({ label: desig, value: desig }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Department / section / cell */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Department / Section / Cell <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.department}
                            placeholder="Select Department / Section / Cell"
                            onChange={(val) => setNewUserForm({ ...newUserForm, department: val })}
                            options={[
                              { label: 'Select Department / Section / Cell', value: '' },
                              ...departmentsMaster.map((dept) => ({ label: dept, value: dept }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Shift */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Shift <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.shiftId}
                            placeholder="Select Shift"
                            onChange={(val) => setNewUserForm({ ...newUserForm, shiftId: val })}
                            options={[
                              { label: 'Select Shift', value: '' },
                              ...shifts.map((s) => ({
                                label: `${s.code} - ${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' (Default)' : ''}`,
                                value: s.id
                              }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave year type */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Year Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveCycle}
                            placeholder="Select Leave Year Type"
                            onChange={(val) => {
                              const v = val as 'CY' | 'FY' | '';
                              setNewUserForm({
                                ...newUserForm,
                                leaveCycle: v as any,
                                leaveCycleBasis: v === 'CY' ? 'calendar_year' : v === 'FY' ? 'financial_year' : ('' as any)
                              });
                            }}
                            options={[
                              { label: 'Select Leave Year Type', value: '' },
                              { label: 'Calendar Year (CY: 01 Jan – 31 Dec)', value: 'CY' },
                              { label: 'Financial Year (FY: 01 Apr – 31 Mar)', value: 'FY' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Reporting manager */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Reporting Manager <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.reportingManagerId}
                            placeholder="Select Reporting Manager"
                            onChange={(val) => setNewUserForm({ ...newUserForm, reportingManagerId: val })}
                            options={[
                              { label: 'Select Reporting Manager', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'Manager'} - ${u.department || 'General'})`,
                                value: u.id
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* HoD */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            HoD <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.hodName}
                            placeholder="Select HoD"
                            onChange={(val) => setNewUserForm({ ...newUserForm, hodName: val })}
                            options={[
                              { label: 'Select HoD', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'HoD'} - ${u.department || 'General'})`,
                                value: u.name
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Date of joining */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Date of Joining <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.joiningDate}
                            placeholder="Select Date of Joining"
                            onChange={(val) => setNewUserForm({ ...newUserForm, joiningDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Retirement date vs Valid up to (If deputation) */}
                        {newUserForm.permanentEmploymentType === 'Deputation' ? (
                          <div>
                            <label className="block text-slate-700 font-bold mb-1 text-xs">
                              Valid Up To Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                            </label>
                            <AppDatePicker
                              value={newUserForm.validUntilDate}
                              placeholder="Select Valid Up To Date"
                              onChange={(val) => setNewUserForm({ ...newUserForm, validUntilDate: val })}
                              className="w-full"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-slate-700 font-bold mb-1 text-xs">Auto Calculate Retirement Date</label>
                            <div className="px-3 py-2 bg-blue-50/80 border border-blue-200/90 text-blue-950 font-bold rounded-xl text-xs flex flex-col justify-center min-h-[38px] shadow-2xs">
                              <span>{calculateRetirementDate(newUserForm.dob) || 'Enter DOB to calculate'}</span>
                            </div>
                          </div>
                        )}

                        {/* Currently on probation */}
                        <div className="sm:col-span-2 space-y-2 border-t border-slate-200/80 pt-2.5">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newUserForm.isOnProbation}
                              onChange={(e) => setNewUserForm({ ...newUserForm, isOnProbation: e.target.checked })}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold text-slate-700 text-xs">Currently on probation?</span>
                          </label>

                          {newUserForm.isOnProbation && (
                            <div className="mt-2">
                              <label className="block text-slate-700 font-bold mb-1 text-xs">
                                Tentative Probation End Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                              </label>
                              <AppDatePicker
                                value={newUserForm.probationEndDate}
                                placeholder="Select Probation End Date"
                                onChange={(val) => setNewUserForm({ ...newUserForm, probationEndDate: val })}
                                className="w-full sm:w-1/2"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* CONTRACTUAL */}
                    {newUserForm.employmentType === 'contractual' && (
                      <>
                        {/* Category: Administrative / Scientific / Technical */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Category <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.employeeCategory}
                            placeholder="Select Category"
                            onChange={(val) => setNewUserForm({ ...newUserForm, employeeCategory: val })}
                            options={[
                              { label: 'Select Category', value: '' },
                              ...categoriesMaster.map((c) => ({ label: c, value: c }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Designation */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Designation <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.designation}
                            placeholder="Select Designation"
                            onChange={(val) => setNewUserForm({ ...newUserForm, designation: val })}
                            options={[
                              { label: 'Select Designation', value: '' },
                              ...designationsMaster.map((desig) => ({ label: desig, value: desig }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Department / section / cell */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Department / Section / Cell <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.department}
                            placeholder="Select Department / Section / Cell"
                            onChange={(val) => setNewUserForm({ ...newUserForm, department: val })}
                            options={[
                              { label: 'Select Department / Section / Cell', value: '' },
                              ...departmentsMaster.map((dept) => ({ label: dept, value: dept }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Shift */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Shift <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.shiftId}
                            placeholder="Select Shift"
                            onChange={(val) => setNewUserForm({ ...newUserForm, shiftId: val })}
                            options={[
                              { label: 'Select Shift', value: '' },
                              ...shifts.map((s) => ({
                                label: `${s.code} - ${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' (Default)' : ''}`,
                                value: s.id
                              }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave year type */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Year Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveCycle}
                            placeholder="Select Leave Year Type"
                            onChange={(val) => {
                              const v = val as 'CY' | 'FY' | '';
                              setNewUserForm({
                                ...newUserForm,
                                leaveCycle: v as any,
                                leaveCycleBasis: v === 'CY' ? 'calendar_year' : v === 'FY' ? 'financial_year' : ('' as any)
                              });
                            }}
                            options={[
                              { label: 'Select Leave Year Type', value: '' },
                              { label: 'Calendar Year (CY: 01 Jan – 31 Dec)', value: 'CY' },
                              { label: 'Financial Year (FY: 01 Apr – 31 Mar)', value: 'FY' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Reporting manager */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Reporting Manager <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.reportingManagerId}
                            placeholder="Select Reporting Manager"
                            onChange={(val) => setNewUserForm({ ...newUserForm, reportingManagerId: val })}
                            options={[
                              { label: 'Select Reporting Manager', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'Manager'} - ${u.department || 'General'})`,
                                value: u.id
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Date of joining */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Date of Joining <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.joiningDate}
                            placeholder="Select Date of Joining"
                            onChange={(val) => setNewUserForm({ ...newUserForm, joiningDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Valid Up To */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Valid Up To Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.validUntilDate}
                            placeholder="Select Valid Up To Date"
                            onChange={(val) => setNewUserForm({ ...newUserForm, validUntilDate: val })}
                            className="w-full"
                          />
                        </div>
                      </>
                    )}

                    {/* PROJECT STAFF */}
                    {newUserForm.employmentType === 'researcher' && (
                      <>
                        {/* Designation */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Designation <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.designation}
                            placeholder="Select Designation"
                            onChange={(val) => setNewUserForm({ ...newUserForm, designation: val })}
                            options={[
                              { label: 'Select Designation', value: '' },
                              ...designationsMaster.map((desig) => ({ label: desig, value: desig }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Project */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Project <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.department}
                            placeholder="Select Project"
                            onChange={(val) => setNewUserForm({ ...newUserForm, department: val })}
                            options={[
                              { label: 'Select Project', value: '' },
                              ...projectsMaster.map((proj) => ({ label: proj, value: proj }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Shift */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Shift <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.shiftId}
                            placeholder="Select Shift"
                            onChange={(val) => setNewUserForm({ ...newUserForm, shiftId: val })}
                            options={[
                              { label: 'Select Shift', value: '' },
                              ...shifts.map((s) => ({
                                label: `${s.code} - ${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' (Default)' : ''}`,
                                value: s.id
                              }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave year type */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Year Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveCycle}
                            placeholder="Select Leave Year Type"
                            onChange={(val) => {
                              const v = val as 'CY' | 'FY' | '';
                              setNewUserForm({
                                ...newUserForm,
                                leaveCycle: v as any,
                                leaveCycleBasis: v === 'CY' ? 'calendar_year' : v === 'FY' ? 'financial_year' : ('' as any)
                              });
                            }}
                            options={[
                              { label: 'Select Leave Year Type', value: '' },
                              { label: 'Calendar Year (CY: 01 Jan – 31 Dec)', value: 'CY' },
                              { label: 'Financial Year (FY: 01 Apr – 31 Mar)', value: 'FY' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Reporting manager */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Reporting Manager <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.reportingManagerId}
                            placeholder="Select Reporting Manager"
                            onChange={(val) => {
                              const sel = users.find((u) => u.id === val);
                              setNewUserForm({ ...newUserForm, reportingManagerId: val, piName: sel ? sel.name : newUserForm.piName });
                            }}
                            options={[
                              { label: 'Select Reporting Manager', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'PI'} - ${u.department || 'General'})`,
                                value: u.id
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Date of joining */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Date of Joining <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.joiningDate}
                            placeholder="Select Date of Joining"
                            onChange={(val) => setNewUserForm({ ...newUserForm, joiningDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Valid Up To */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Valid Up To Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.validUntilDate}
                            placeholder="Select Valid Up To Date"
                            onChange={(val) => setNewUserForm({ ...newUserForm, validUntilDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Can be enrolled in PhD parallel */}
                        <div className="sm:col-span-2 p-2.5 bg-blue-50/80 border border-blue-200/90 rounded-xl">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!newUserForm.isPhDEnrolled}
                              onChange={(e) => setNewUserForm({ ...newUserForm, isPhDEnrolled: e.target.checked })}
                              className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold text-blue-900 text-xs">Can be enrolled in PhD parallel?</span>
                          </label>
                        </div>
                      </>
                    )}

                    {/* TRAINEE */}
                    {newUserForm.employmentType === 'diploma_trainee' && (
                      <>
                        {/* Course */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Course <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.courseProgram}
                            placeholder="Select Course"
                            onChange={(val) => setNewUserForm({ ...newUserForm, courseProgram: val })}
                            options={[
                              { label: 'Select Course', value: '' },
                              ...coursesMaster.map((c) => ({ label: c, value: c }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Batch */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Batch <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.courseBatch}
                            placeholder="Select Batch"
                            onChange={(val) => setNewUserForm({ ...newUserForm, courseBatch: val })}
                            options={[
                              { label: 'Select Batch', value: '' },
                              ...batchesMaster.map((b) => ({ label: b, value: b }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Shift */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Shift <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.shiftId}
                            placeholder="Select Shift"
                            onChange={(val) => setNewUserForm({ ...newUserForm, shiftId: val })}
                            options={[
                              { label: 'Select Shift', value: '' },
                              ...shifts.map((s) => ({
                                label: `${s.code} - ${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' (Default)' : ''}`,
                                value: s.id
                              }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave year type */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Year Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveCycle}
                            placeholder="Select Leave Year Type"
                            onChange={(val) => {
                              const v = val as 'CY' | 'FY' | '';
                              setNewUserForm({
                                ...newUserForm,
                                leaveCycle: v as any,
                                leaveCycleBasis: v === 'CY' ? 'calendar_year' : v === 'FY' ? 'financial_year' : ('' as any)
                              });
                            }}
                            options={[
                              { label: 'Select Leave Year Type', value: '' },
                              { label: 'Calendar Year (CY: 01 Jan – 31 Dec)', value: 'CY' },
                              { label: 'Financial Year (FY: 01 Apr – 31 Mar)', value: 'FY' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Reporting manager */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Reporting Manager <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.reportingManagerId}
                            placeholder="Select Reporting Manager"
                            onChange={(val) => setNewUserForm({ ...newUserForm, reportingManagerId: val })}
                            options={[
                              { label: 'Select Reporting Manager', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'Manager'} - ${u.department || 'General'})`,
                                value: u.id
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Date of joining */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Date of Joining <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.joiningDate}
                            placeholder="Select Date of Joining"
                            onChange={(val) => setNewUserForm({ ...newUserForm, joiningDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Valid Up To */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Valid Up To Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.validUntilDate}
                            placeholder="Select Valid Up To Date"
                            onChange={(val) => setNewUserForm({ ...newUserForm, validUntilDate: val })}
                            className="w-full"
                          />
                        </div>
                      </>
                    )}

                    {/* M.SC STUDENT */}
                    {newUserForm.employmentType === 'bsc_msc_student' && (
                      <>
                        {/* Course */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Course <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.courseProgram}
                            placeholder="Select Course"
                            onChange={(val) => setNewUserForm({ ...newUserForm, courseProgram: val })}
                            options={[
                              { label: 'Select Course', value: '' },
                              ...coursesMaster.map((c) => ({ label: c, value: c }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Batch */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Batch <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.courseBatch}
                            placeholder="Select Batch"
                            onChange={(val) => setNewUserForm({ ...newUserForm, courseBatch: val })}
                            options={[
                              { label: 'Select Batch', value: '' },
                              ...batchesMaster.map((b) => ({ label: b, value: b }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Shift */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Shift <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.shiftId}
                            placeholder="Select Shift"
                            onChange={(val) => setNewUserForm({ ...newUserForm, shiftId: val })}
                            options={[
                              { label: 'Select Shift', value: '' },
                              ...shifts.map((s) => ({
                                label: `${s.code} - ${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' (Default)' : ''}`,
                                value: s.id
                              }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave year type */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Year Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveCycle}
                            placeholder="Select Leave Year Type"
                            onChange={(val) => {
                              const v = val as 'CY' | 'FY' | '';
                              setNewUserForm({
                                ...newUserForm,
                                leaveCycle: v as any,
                                leaveCycleBasis: v === 'CY' ? 'calendar_year' : v === 'FY' ? 'financial_year' : ('' as any)
                              });
                            }}
                            options={[
                              { label: 'Select Leave Year Type', value: '' },
                              { label: 'Calendar Year (CY: 01 Jan – 31 Dec)', value: 'CY' },
                              { label: 'Financial Year (FY: 01 Apr – 31 Mar)', value: 'FY' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Reporting manager */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Reporting Manager <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.reportingManagerId}
                            placeholder="Select Reporting Manager"
                            onChange={(val) => setNewUserForm({ ...newUserForm, reportingManagerId: val })}
                            options={[
                              { label: 'Select Reporting Manager', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'Guide'} - ${u.department || 'General'})`,
                                value: u.id
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Date of joining */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Date of Joining <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.joiningDate}
                            placeholder="Select Date of Joining"
                            onChange={(val) => {
                              const autoVal = calculateStudentValidUntil(val);
                              setNewUserForm({ ...newUserForm, joiningDate: val, validUntilDate: autoVal || newUserForm.validUntilDate });
                            }}
                            className="w-full"
                          />
                        </div>

                        {/* Valid Up To */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Valid Up To Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.validUntilDate}
                            placeholder="Select Valid Up To Date"
                            onChange={(val) => setNewUserForm({ ...newUserForm, validUntilDate: val })}
                            className="w-full"
                          />
                        </div>
                      </>
                    )}

                    {/* PHD SCHOLAR */}
                    {newUserForm.employmentType === 'phd_student' && (
                      <>
                        {/* Enrolled through */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Enrolled Through <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.enrolledThrough}
                            placeholder="Select Enrolled Through"
                            onChange={(val) => setNewUserForm({ ...newUserForm, enrolledThrough: val })}
                            options={[
                              { label: 'Select Enrolled Through', value: '' },
                              ...phdEnrollmentMaster.map((e) => ({ label: e, value: e }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Shift */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Shift <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.shiftId}
                            placeholder="Select Shift"
                            onChange={(val) => setNewUserForm({ ...newUserForm, shiftId: val })}
                            options={[
                              { label: 'Select Shift', value: '' },
                              ...shifts.map((s) => ({
                                label: `${s.code} - ${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' (Default)' : ''}`,
                                value: s.id
                              }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave year type */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Year Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveCycle}
                            placeholder="Select Leave Year Type"
                            onChange={(val) => {
                              const v = val as 'CY' | 'FY' | '';
                              setNewUserForm({
                                ...newUserForm,
                                leaveCycle: v as any,
                                leaveCycleBasis: v === 'CY' ? 'calendar_year' : v === 'FY' ? 'financial_year' : ('' as any)
                              });
                            }}
                            options={[
                              { label: 'Select Leave Year Type', value: '' },
                              { label: 'Calendar Year (CY: 01 Jan – 31 Dec)', value: 'CY' },
                              { label: 'Financial Year (FY: 01 Apr – 31 Mar)', value: 'FY' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Reporting manager */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Reporting Manager <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.reportingManagerId}
                            placeholder="Select Reporting Manager"
                            onChange={(val) => {
                              const sel = users.find((u) => u.id === val);
                              setNewUserForm({ ...newUserForm, reportingManagerId: val, piName: sel ? sel.name : newUserForm.piName });
                            }}
                            options={[
                              { label: 'Select Reporting Manager', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'Guide'} - ${u.department || 'General'})`,
                                value: u.id
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Date of joining */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Date of Joining <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.joiningDate}
                            placeholder="Select Date of Joining"
                            onChange={(val) => setNewUserForm({ ...newUserForm, joiningDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Valid Up To */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Valid Up To Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.validUntilDate}
                            placeholder="Select Valid Up To Date"
                            onChange={(val) => setNewUserForm({ ...newUserForm, validUntilDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Can be enrolled in Project parallel */}
                        <div className="sm:col-span-2 p-2.5 bg-blue-50/80 border border-blue-200/90 rounded-xl">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!newUserForm.isPhDEnrolled}
                              onChange={(e) => setNewUserForm({ ...newUserForm, isPhDEnrolled: e.target.checked })}
                              className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold text-blue-900 text-xs">Can be enrolled in Project parallel?</span>
                          </label>
                        </div>
                      </>
                    )}

                    {/* INTERN */}
                    {newUserForm.employmentType === 'intern' && (
                      <>
                        {/* project / Department / section / cell */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Project / Department / Section / Cell <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.department}
                            placeholder="Select Project / Department / Section / Cell"
                            onChange={(val) => setNewUserForm({ ...newUserForm, department: val })}
                            options={[
                              { label: 'Select Project / Department / Section / Cell', value: '' },
                              ...departmentsMaster.map((dept) => ({ label: `[Dept/Cell] ${dept}`, value: dept })),
                              ...projectsMaster.map((proj) => ({ label: `[Project] ${proj}`, value: proj }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Shift */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Shift <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.shiftId}
                            placeholder="Select Shift"
                            onChange={(val) => setNewUserForm({ ...newUserForm, shiftId: val })}
                            options={[
                              { label: 'Select Shift', value: '' },
                              ...shifts.map((s) => ({
                                label: `${s.code} - ${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' (Default)' : ''}`,
                                value: s.id
                              }))
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave year type */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Year Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveCycle}
                            placeholder="Select Leave Year Type"
                            onChange={(val) => {
                              const v = val as 'CY' | 'FY' | '';
                              setNewUserForm({
                                ...newUserForm,
                                leaveCycle: v as any,
                                leaveCycleBasis: v === 'CY' ? 'calendar_year' : v === 'FY' ? 'financial_year' : ('' as any)
                              });
                            }}
                            options={[
                              { label: 'Select Leave Year Type', value: '' },
                              { label: 'Calendar Year (CY: 01 Jan – 31 Dec)', value: 'CY' },
                              { label: 'Financial Year (FY: 01 Apr – 31 Mar)', value: 'FY' }
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Reporting manager */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Reporting Manager <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.reportingManagerId}
                            placeholder="Select Reporting Manager"
                            onChange={(val) => setNewUserForm({ ...newUserForm, reportingManagerId: val })}
                            options={[
                              { label: 'Select Reporting Manager', value: '' },
                              ...activeManagersAndHods.map((u) => ({
                                label: `${u.name} (${u.designation || 'Manager'} - ${u.department || 'General'})`,
                                value: u.id
                              }))
                            ]}
                            className="w-full"
                            searchable={true}
                            minSearchChars={2}
                          />
                        </div>

                        {/* Date of joining */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Date of Joining <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.joiningDate}
                            placeholder="Select Date of Joining"
                            onChange={(val) => setNewUserForm({ ...newUserForm, joiningDate: val })}
                            className="w-full"
                          />
                        </div>

                        {/* Valid Up To */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Valid Up To Date <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppDatePicker
                            value={newUserForm.validUntilDate}
                            placeholder="Select Valid Up To Date"
                            onChange={(val) => setNewUserForm({ ...newUserForm, validUntilDate: val })}
                            className="w-full"
                          />
                        </div>
                      </>
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>New Employee</span>
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-emerald-300 shrink-0 shadow-sm">
                  <KeyRound className="w-4.5 h-4.5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">Password Reset Generated</h3>
                  <p className="text-xs text-blue-200/80 mt-0.5">Temporary credential generated</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordResetModal(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
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
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Notification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: DELETE USER CONFIRMATION */}
      {/* ==================================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-rose-300 shrink-0 shadow-sm">
                  <Trash2 className="w-4.5 h-4.5 text-rose-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">Confirm User Deletion</h3>
                  <p className="text-xs text-blue-200/80 mt-0.5">Permanent account removal</p>
                </div>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete user account{' '}
                <strong className="text-slate-900">{userToDelete.name}</strong> ({userToDelete.email})?
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteUser}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5A: INITIATE EMPLOYEE TRANSFER (SINGLE / BULK) */}
      {/* ==================================================================== */}
      {activeTransferModal === 'employee_transfer' && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-xl sm:max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            {/* Dedicated Modal Header */}
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <ArrowLeftRight className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    Employee Transfer &amp; Department Mapping
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setActiveTransferModal('none')}
                className="relative z-10 text-blue-300 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/10"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dedicated Modal Body Container */}
            <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 text-xs space-y-3.5 sm:space-y-4">
              <form onSubmit={handleSingleMultiTransferSubmit} className="space-y-4">
                {/* Select Employee to Transfer */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Select Employee for Transfer <span className="text-rose-500">*</span></span>
                  </label>
                  <AppSelect
                    value={selectedTransferUserIds[0] || ''}
                    placeholder="Select Employee"
                    onChange={(val) => {
                      setSelectedTransferUserIds(val ? [val] : []);
                    }}
                    options={[
                      { label: 'Select Employee', value: '' },
                      ...activeEmployees.map((u) => ({
                        label: `${u.name} (${u.department} - ${u.designation})`,
                        value: u.id,
                        description: u.biometricId ? `ID: ${u.biometricId} • ${u.department}` : undefined
                      }))
                    ]}
                    className="w-full"
                    searchable={true}
                    minSearchChars={2}
                  />

                  {selectedTransferUserIds.length > 0 && (() => {
                    const emp = users.find((u) => u.id === selectedTransferUserIds[0]);
                    if (!emp) return null;
                    const currentMgr = users.find((m) => m.id === emp.reportingManagerId);
                    const currentRevMgr = users.find((m) => m.id === emp.reviewingManagerId);
                    return (
                      <div className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 border border-blue-200/90 rounded-xl flex items-center justify-between text-xs shadow-2xs animate-in fade-in">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-300/60 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">{emp.name}</span>
                              {emp.biometricId && (
                                <span className="font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                  ID: {emp.biometricId}
                                </span>
                              )}
                              <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ACTIVE
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 truncate mt-0.5">
                              Current: {emp.department} &bull; {emp.designation}
                            </p>
                            {(currentMgr || currentRevMgr) && (
                              <div className="flex items-center gap-2 mt-0.5 text-[10.5px]">
                                {currentMgr && (
                                  <span className="text-blue-700 truncate">
                                    Manager: {currentMgr.name}
                                  </span>
                                )}
                                {currentRevMgr && (
                                  <span className="text-slate-600 truncate">
                                    HoD: {currentRevMgr.name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedTransferUserIds([])}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                          title="Remove selection"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Destination & Manager Details */}
                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-1">
                    New Department &amp; Reporting Hierarchy
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">New Department *</label>
                      <AppSelect
                        value={transferForm.newDept}
                        placeholder="-- Select New Department --"
                        onChange={(val) => setTransferForm({ ...transferForm, newDept: val })}
                        options={[
                          { label: '-- Select New Department --', value: '' },
                          ...departmentsMaster.map((dept) => ({ label: dept, value: dept }))
                        ]}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Effective Transfer Date *</label>
                      <AppDatePicker
                        value={transferForm.effectiveDate}
                        onChange={(val) => setTransferForm({ ...transferForm, effectiveDate: val })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">New Reporting Manager (Level 1)</label>
                      <AppSelect
                        value={transferForm.newReportingManagerId}
                        placeholder="-- Unchanged / Keep Current --"
                        onChange={(val) => setTransferForm({ ...transferForm, newReportingManagerId: val })}
                        options={[
                          { label: '-- Unchanged / Keep Current --', value: '' },
                          ...activeManagersAndHods.map((u) => ({
                            label: `${u.name} (${u.department} - ${u.designation})`,
                            value: u.id
                          }))
                        ]}
                        className="w-full"
                        searchable={true}
                        minSearchChars={2}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">New Reviewing Manager / HoD (Level 2)</label>
                      <AppSelect
                        value={transferForm.newReviewingManagerId}
                        placeholder="-- Unchanged / Keep Current --"
                        onChange={(val) => setTransferForm({ ...transferForm, newReviewingManagerId: val })}
                        options={[
                          { label: '-- Unchanged / Keep Current --', value: '' },
                          ...activeManagersAndHods.map((u) => ({
                            label: `${u.name} (${u.department} - ${u.designation})`,
                            value: u.id
                          }))
                        ]}
                        className="w-full"
                        searchable={true}
                        minSearchChars={2}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Transfer Reason / Official Reference <span className="text-[10px] font-normal text-slate-500">(Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={transferForm.notes}
                        onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                        placeholder="e.g. Official Ref: WII/ADMIN/TRANSFER/2026/88 (Optional)"
                        className="w-full px-3 py-2 border border-slate-200/90 rounded-xl text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Pinned Fixed Footer */}
                <div className="p-3 bg-slate-50/90 border border-slate-200/90 rounded-xl flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTransferModal('none')}
                    className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedTransferUserIds.length === 0 || !transferForm.newDept}
                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 active:scale-95"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Migrate</span>
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
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-xl sm:max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            {/* Dedicated Modal Header */}
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <RefreshCw className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    Manager Replacement &amp; Cascading Handover
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setActiveTransferModal('none')}
                className="relative z-10 text-blue-300 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/10"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dedicated Modal Body Container */}
            <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 text-xs space-y-3.5 sm:space-y-4">
              <form onSubmit={handleManagerReplacementSubmit} className="space-y-4">
                {/* Outgoing vs Incoming Managers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl space-y-2">
                    <label className="block text-rose-900 font-extrabold text-xs">
                      Outgoing Manager / Officer Leaving *
                    </label>
                    <AppSelect
                      value={managerReplacementForm.outgoingManagerId}
                      placeholder="-- Select Outgoing Manager --"
                      onChange={(outgoingId) => {
                        const newReportees = users
                          .filter(
                            (u) =>
                              (u.reportingManagerId === outgoingId || u.reviewingManagerId === outgoingId) &&
                              u.status !== 'deactivated'
                          )
                          .map((u) => u.id);

                        setManagerReplacementForm({
                          ...managerReplacementForm,
                          outgoingManagerId: outgoingId,
                          selectedReporteeIds: newReportees
                        });
                      }}
                      options={[
                        { label: '-- Select Outgoing Manager --', value: '' },
                        ...activeManagersAndHods.map((u) => ({
                          label: `${u.name} (${u.department} - ${u.designation})`,
                          value: u.id,
                          description: u.biometricId ? `ID: ${u.biometricId}` : undefined
                        }))
                      ]}
                      className="w-full"
                      searchable={true}
                      minSearchChars={2}
                    />

                    {managerReplacementForm.outgoingManagerId && (
                      <div className="text-[10px] font-bold text-rose-800 bg-white p-2 rounded-lg border border-rose-200">
                        Found <span className="text-rose-900 underline">{reporteesUnderOutgoing.length}</span> active reportee(s) assigned under this manager.
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
                    <label className="block text-emerald-900 font-extrabold text-xs">
                      Replacement / Incoming Manager *
                    </label>
                    <AppSelect
                      value={managerReplacementForm.incomingManagerId}
                      placeholder="-- Select Incoming Manager --"
                      onChange={(incomingId) =>
                        setManagerReplacementForm({ ...managerReplacementForm, incomingManagerId: incomingId })
                      }
                      options={[
                        { label: '-- Select Incoming Manager --', value: '' },
                        ...activeManagersAndHods
                          .filter((u) => u.id !== managerReplacementForm.outgoingManagerId)
                          .map((u) => ({
                            label: `${u.name} (${u.department} - ${u.designation})`,
                            value: u.id,
                            description: u.biometricId ? `ID: ${u.biometricId}` : undefined
                          }))
                      ]}
                      className="w-full"
                      searchable={true}
                      minSearchChars={2}
                    />

                    {managerReplacementForm.incomingManagerId && (
                      <div className="text-[10px] font-bold text-emerald-800 bg-white p-2 rounded-lg border border-emerald-200">
                        Incoming Officer:{' '}
                        <span className="text-emerald-950 font-bold">
                          {users.find((u) => u.id === managerReplacementForm.incomingManagerId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scope of Reassignment */}
                <div className="space-y-2">
                  <label className="block text-slate-800 font-extrabold text-xs uppercase tracking-wider">
                    Hierarchy Scope to Reassign
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label
                      className={`p-2.5 border rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
                        managerReplacementForm.reassignType === 'reporting'
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-2xs'
                          : 'bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50'
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
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-2xs'
                          : 'bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50'
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
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold shadow-2xs'
                          : 'bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50'
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

                {/* Reportees List Verification */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Affected Reportee Employees ({managerReplacementForm.selectedReporteeIds.length} /{' '}
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

                  <div className="max-h-36 overflow-y-auto border border-slate-200/90 rounded-xl divide-y divide-slate-100 bg-white">
                    {reporteesUnderOutgoing.length === 0 ? (
                      <div className="p-3 text-center text-slate-400">
                        Select an Outgoing Manager above to load their active reportees.
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
                                className="w-4 h-4 rounded-xs border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate text-xs">{rep.name}</span>
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

                {/* Effective Date & Movement Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Effective Transfer Date *</label>
                    <AppDatePicker
                      value={managerReplacementForm.effectiveDate}
                      onChange={(val) =>
                        setManagerReplacementForm({ ...managerReplacementForm, effectiveDate: val })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Movement Reference / Reason <span className="text-[10px] font-normal text-slate-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={managerReplacementForm.notes}
                      onChange={(e) =>
                        setManagerReplacementForm({ ...managerReplacementForm, notes: e.target.value })
                      }
                      placeholder="e.g. Movement Ref: WII/TRANSFER/2026/MGR-99 (Optional)"
                      className="h-9 w-full px-3 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                    />
                  </div>
                </div>

                {/* Pinned Fixed Footer */}
                <div className="p-3 bg-slate-50/90 border border-slate-200/90 rounded-xl flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTransferModal('none')}
                    className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
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
                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Migrate</span>
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
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl sm:max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150">
            {/* INSTITUTIONAL HEADER */}
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white border-b border-blue-900/60 flex items-center justify-between gap-3 shrink-0 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              {/* User Identity */}
              <div className="relative z-10 flex items-center space-x-3 min-w-0">
                <div className="relative">
                  <img
                    src={userToEditRoles.avatar}
                    alt={userToEditRoles.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-400/40 shrink-0 shadow-sm"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-900" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base text-white tracking-tight truncate">
                      {userToEditRoles.name}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-200 border border-blue-800/60">
                      ID: {userToEditRoles.biometricId || userToEditRoles.id}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/80 mt-0.5 truncate">Edit System &amp; Enterprise Module Roles</p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setUserToEditRoles(null)}
                className="relative z-10 p-1.5 text-blue-300 hover:text-white rounded-lg cursor-pointer hover:bg-white/10 transition-colors shrink-0"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSaveRoleChangesInProfile} className="flex flex-col min-h-0 overflow-hidden">
              {/* SCROLLABLE INNER BODY */}
              <div className="p-3.5 sm:p-4 space-y-3 text-xs overflow-y-auto bg-slate-50/50">
                {/* 2D ROLE MATRIX TABLE (Columns: Modules, Rows: Roles) */}
                <RoleMatrixTable
                  mode="edit"
                  systemRoles={editUserRolesState}
                  moduleRoles={editUserModuleRolesState}
                  onToggleSystemRole={handleToggleSystemRoleInMatrix}
                  onToggleModuleRole={handleToggleModuleRoleInProfile}
                />
              </div>

              {/* PINNED FIXED FOOTER */}
              <div className="px-4 sm:px-5 py-2.5 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50 z-30">
                <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-2 min-w-0">
                  <span className="truncate">
                    Configuring permissions for <strong className="text-slate-800">{userToEditRoles.name}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.2 rounded text-[10px] shrink-0">
                    {activeAssignedRolesSummary.length} Active Grants
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setUserToEditRoles(null)}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-3.5 py-1.5 rounded-lg text-xs border border-slate-200 cursor-pointer transition-colors shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                  >
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: RESET PASSWORD */}
      {/* ==================================================================== */}
      {userToResetPasswordForm && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Unified Theme Modal Header */}
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <KeyRound className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    Reset Portal Password
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToResetPasswordForm(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteResetPassword} className="p-5 space-y-4 text-xs">
              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/90 rounded-xl">
                <img
                  src={userToResetPasswordForm.avatar}
                  alt={userToResetPasswordForm.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 text-sm truncate">{userToResetPasswordForm.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{userToResetPasswordForm.designation} &bull; {userToResetPasswordForm.department}</p>
                  <p className="text-[10px] text-emerald-700 font-mono font-bold truncate">{userToResetPasswordForm.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-extrabold text-xs mb-1.5">
                  Password Generation Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      resetPassForm.mode === 'auto'
                        ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="passMode"
                      checked={resetPassForm.mode === 'auto'}
                      onChange={() => setResetPassForm({ ...resetPassForm, mode: 'auto' })}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[11px]">Auto Temp Key</span>
                  </label>

                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      resetPassForm.mode === 'custom'
                        ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="passMode"
                      checked={resetPassForm.mode === 'custom'}
                      onChange={() => setResetPassForm({ ...resetPassForm, mode: 'custom' })}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[11px]">Set Custom Pass</span>
                  </label>
                </div>
              </div>

              {resetPassForm.mode === 'custom' ? (
                <div className="space-y-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/90">
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
                        className="h-9 w-full pl-3 pr-9 border border-slate-200/90 rounded-xl text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
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
                      className="h-9 w-full px-3 border border-slate-200/90 rounded-xl text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                  <p className="font-bold">✨ System Auto-Generated Temporary Credential</p>
                  <p className="text-amber-700 mt-0.5">
                    A secure 6-digit temporary key will be generated and dispatched to the user's email.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">
                  Reason / Official Reference
                </label>
                <input
                  type="text"
                  value={resetPassForm.reason}
                  onChange={(e) => setResetPassForm({ ...resetPassForm, reason: e.target.value })}
                  placeholder="e.g. Employee requested password reset via helpdesk ticket"
                  className="h-9 w-full px-3 border border-slate-200/90 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUserToResetPasswordForm(null)}
                  className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs active:scale-95"
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-200" />
                  <span>Confirm Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: ACCOUNT STATUS TOGGLE (DEACTIVATE / REACTIVATE) INPUT FORM */}
      {/* ==================================================================== */}
      {userToToggleStatusModal && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Standard Institutional Header */}
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  {userToToggleStatusModal.status === 'active' ? (
                    <UserX className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-rose-400" />
                  ) : (
                    <UserCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-emerald-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    {userToToggleStatusModal.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
                  </h3>
                  <p className="text-xs text-blue-200/80 mt-0.5">Update employee portal access and account status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToToggleStatusModal(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteStatusChange} className="p-5 space-y-4 text-xs">
              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/90 rounded-xl">
                <img
                  src={userToToggleStatusModal.avatar}
                  alt={userToToggleStatusModal.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 text-sm truncate">{userToToggleStatusModal.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{userToToggleStatusModal.designation} &bull; {userToToggleStatusModal.department}</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">Current Status:</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border whitespace-nowrap ${
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
                <label className="block text-slate-800 font-bold text-xs mb-1">
                  Reason for Action <span className="text-rose-500">*</span>
                </label>
                <AppSelect
                  value={statusChangeForm.reasonCategory}
                  onChange={(val) => setStatusChangeForm({ ...statusChangeForm, reasonCategory: val })}
                  options={
                    userToToggleStatusModal.status === 'active'
                      ? [
                          'End of Contract / Tenure',
                          'Resignation / Retirement',
                          'Departmental Transfer / Relocation',
                          'Administrative Suspension / Investigation',
                          'Unsanctioned Absence',
                          'Other Administrative Reason'
                        ]
                      : [
                          'Re-instated by Administration',
                          'Contract Extension / Renewal',
                          'Returned from Deputation / Long Leave',
                          'Other Administrative Reason'
                        ]
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold text-xs mb-1">
                  Effective Date <span className="text-rose-500">*</span>
                </label>
                <AppDatePicker
                  value={statusChangeForm.effectiveDate}
                  onChange={(val) => setStatusChangeForm({ ...statusChangeForm, effectiveDate: val })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold text-xs mb-1">
                  Official Remarks / Reference Note
                </label>
                <textarea
                  rows={2}
                  value={statusChangeForm.customNotes}
                  onChange={(e) => setStatusChangeForm({ ...statusChangeForm, customNotes: e.target.value })}
                  placeholder="e.g. As per office order WII/ADMIN/2026/88..."
                  className="w-full px-3 py-2 border border-slate-200/90 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                />
              </div>

              {userToToggleStatusModal.status === 'active' ? (
                <div className="p-3 bg-rose-50 border border-rose-200/90 rounded-xl text-rose-800 text-[11px] leading-relaxed flex items-start space-x-2">
                  <UserX className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Access Revocation Notice</p>
                    <p className="text-rose-700 text-[10.5px]">
                      Deactivating this account will immediately revoke portal sign-in credentials and stop biometric attendance sync.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200/90 rounded-xl text-emerald-800 text-[11px] leading-relaxed flex items-start space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Access Restoration Notice</p>
                    <p className="text-emerald-700 text-[10.5px]">
                      Reactivating this account will restore active portal sign-in privileges and re-enable biometric attendance tracking.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUserToToggleStatusModal(null)}
                  className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`h-9 px-5 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs text-white active:scale-95 ${
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

