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
import { EmployeeProfileView, MyProfileView } from '../components/MyProfileView';
import { EmployeeActivityLog, MappingActivityLog, UserControlsActivityLog } from '../components/EmployeeActivityLog';
import { DirectoryTable } from '../components/DirectoryTable';
import { MappingPanel } from '../components/MappingPanel';
import { Button } from '../../../../shared/components/Button';
import { PageHeaderButton } from '../../../../shared/components/PageHeader';
import { SegmentedControl } from '../../../../shared/components/SegmentedControl';
import { PAGE_ICONS } from '../../hrmsPages';
import { logThenDownload } from '../../../../shared/services/downloadAudit';
import { auditorApi } from '../employeeApi';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { downloadTablePdf, printedAt } from '../../../../shared/services/printTable';
import { useSession } from '../../../../auth/SessionContext';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { AppSelect } from '../../../../shared/components/AppSelect';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { api } from '../../../../shared/services/api';
import { LeaveGroupRecord, leaveGroupApi } from '../../leave/leaveApi';
import { User as UserIcon, Briefcase, Edit3, Check, X, Shield, KeyRound, UserCheck, UserX, Trash2, Plus, ArrowLeftRight, ArrowUp, ArrowDown, ArrowUpDown, RefreshCw, UserPlus, Eye, EyeOff, GraduationCap, BookOpen, Microscope, Building2, Award, Sparkles, LayoutGrid, List } from 'lucide-react';
import { RoleMatrixTable } from '../../master/components/RoleMatrixTable';
import { exportHRMSToCSV, exportHRMSToPDF, HRMSExportColumn, HRMSFilterTag } from '../../utils/hrmsExportUtils';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { actionBtn } from '../../../../shared/components/actionStyles';

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

/** Cadre of permanent / contractual staff (fixed list, no master; same list as the server's CADRES). */
const CADRES = ['Scientific', 'Technical', 'Support', 'Administrative', 'Finance', 'Stenographer', 'Driver', 'Multi Tasking Staff'];

export const EmployeeProfilePage: React.FC<EmployeeProfilePageProps> = ({ initialTab = 'profile' }) => {
  const {
    currentUser,
    users,
    systemUsers,
    updateUserProfile,
    addUserProfile,
    toggleUserStatus,
    deleteUser,
    departmentsMaster,
    masterOptions,
    reloadEmployees
  } = useApp();

  // Every dropdown on the employee form comes from the database masters
  // (Master Settings), loaded once in AppContext and refreshed when they change.
  const optionNames = (key: string) => (masterOptions[key] ?? []).map((r) => r.name);
  const salutationOptions = (masterOptions.salutation ?? []).map((r) => ({ label: r.name, value: r.code }));
  const genderOptions = (masterOptions.gender ?? []).map((r) => ({ label: r.name, value: r.code }));
  const employeeTypeOptions = (masterOptions.employeeType ?? []).map((r) => ({ label: r.name, value: r.code }));
  const instituteOptions = (masterOptions.institute ?? []).map((r) => ({ label: r.name, value: r.code }));
  /** The form layout behind an employee type (types are admin-defined; layouts are fixed). */
  const layoutOf = (employeeType?: string | null): string =>
    (masterOptions.employeeType ?? []).find((r) => r.code === employeeType)?.fields.formLayout || String(employeeType || '');

  // ---- Add / edit employee form: each list follows the choice made above it ----
  type Opt = { label: string; value: string };
  /** Keeps a stored value selectable while editing, even if it is no longer in the list. */
  const withCurrent = (options: Opt[], value?: string | null): Opt[] =>
    value && !options.some((o) => o.value === value) ? [...options, { label: `${value} (inactive)`, value }] : options;
  const toOpts = (names: string[]): Opt[] => names.map((n) => ({ label: n, value: n }));
  /** Designations of this employee type (a designation without a type fits every staff type). */
  const designationOptionsFor = (employeeType: string, cadre = ''): Opt[] =>
    toOpts((masterOptions.designations ?? []).filter((r) =>
      (!r.fields.empType || r.fields.empType === employeeType) && (!cadre || !r.fields.cadre || r.fields.cadre === cadre)).map((r) => r.name));
  /** Units of the organization (shown to every employee type). */
  const departmentsFor = (institute: string): string[] =>
    institute ? (masterOptions.organizations ?? []).filter((r) => (r.fields.institute || '') === institute).map((r) => r.name) : [];
  /** Trainees pick a training course, M.Sc students a stream. */
  const courseOptionsFor = (layout: string): Opt[] =>
    toOpts(optionNames(layout === 'bsc_msc_student' ? 'mscStreams' : 'courses'));
  /** Batches of the chosen course / stream only. */
  const batchOptionsFor = (layout: string, course: string): Opt[] => {
    if (!course) return [];
    const msc = layout === 'bsc_msc_student';
    return toOpts((masterOptions[msc ? 'mscBatches' : 'traineeBatches'] ?? [])
      .filter((r) => (msc ? r.fields.parentStream : r.fields.parentCourse) === course).map((r) => r.name));
  };
  const projectOptions = toOpts(optionNames('projects'));
  const enrollmentOptions = toOpts(optionNames('phdEnrollment'));
  const shiftOptions: Opt[] = (masterOptions.shifts ?? []).map((sh) => ({ label: `${sh.code} - ${sh.name}${sh.isDefault ? ' (Default)' : ''}`, value: sh.id }));
  const cadreOptions = toOpts(CADRES);
  const recruitmentCategoryOptions = toOpts(['Direct', 'Deputation']);
  /** Cadre changed: keep designation / department only if they still fit. */
  const changeCadre = (cadre: string) => setNewUserForm((f) => ({
    ...f,
    employeeCategory: cadre,
    designation: designationOptionsFor(f.employmentType, cadre).some((o) => o.value === f.designation) ? f.designation : '',
    department: departmentsFor(f.institute).includes(f.department) ? f.department : '',
  }));

  // Role Checks
  const isAdmin = currentUser.role === 'administrator';
  const isAudit = currentUser.role === 'audit';
  const isManager = currentUser.role === 'reporting_manager' || currentUser.role === 'reviewing_manager';
  const canAccessAdminSubTabs = isAdmin || isAudit;
  const showMyProfile = !isAdmin && !isAudit && !isManager;
  const [auditorView, setAuditorView] = useState<'directory' | 'activity'>('directory');
  /** The header's Employee transfer / Manager replacement buttons ask the mapping panel to open that order form. */
  const [mappingOrder, setMappingOrder] = useState<{ kind: 'transfer' | 'replace'; n: number }>({ kind: 'transfer', n: 0 });
  const { refresh: refreshSession } = useSession();

  // Sub-tabs State
  const [activeTab, setActiveTab] = useState<'profile' | 'user_controls' | 'transfers'>(initialTab);
  useEffect(() => { setAuditorView('directory'); }, [activeTab]);
  /** Auditor: Directory / Activity logs switch, shown at the top-left of whichever panel is open. */
  const auditorSwitch = (
    <SegmentedControl
      ariaLabel="Auditor view"
      value={auditorView}
      onChange={setAuditorView}
      options={[{ value: 'directory', label: activeTab === 'user_controls' ? 'User controls' : activeTab === 'transfers' ? 'Employees mapping' : 'Employee directory' }, { value: 'activity', label: 'Activity log' }]}
    />
  );

  useEffect(() => {
    if (!canAccessAdminSubTabs && (initialTab === 'user_controls' || initialTab === 'transfers')) {
      setActiveTab('profile');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, canAccessAdminSubTabs]);

  // User Project History Modal State
  const [historyUser, setHistoryUser] = useState<UserType | null>(null);

  // Dynamic Search Query for Employee Profiles
  const [profileSearchQuery, setProfileSearchQuery] = useState('');

  // Category Filter State for Directory Tab
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string[]>(['all']);

  // Department, Employee, Designation, Reporting Mgr & Status Filter States
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string[]>(['all']);
  const [selectedDesignationFilter, setSelectedDesignationFilter] = useState<string[]>(['all']);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string[]>(['all']);
  const [selectedReportingMgrFilter, setSelectedReportingMgrFilter] = useState<string[]>(['all']);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string[]>(['all']);

  // Directory View Mode: 'grid' (Category Cards Grid) or 'detail' (Single Detailed Profile View)
  // table (default) or cards; 'detail' = one employee's full profile.
  const [directoryViewMode, setDirectoryViewModeRaw] = useState<'table' | 'grid' | 'detail'>('table');
  // Remember table vs cards so "Back" returns to the same list.
  const [lastListMode, setLastListMode] = useState<'table' | 'grid'>('table');
  const setDirectoryViewMode = (mode: 'table' | 'grid' | 'detail') => {
    if (mode !== 'detail') setLastListMode(mode);
    setDirectoryViewModeRaw(mode);
  };

  // UI mirrors server authorization; API remains the security boundary.
  // Who appears in the directory, by active role. The server sends full details
  // only for these people and refuses any other profile, whatever the screen shows.
  const accessibleProfiles = useMemo(() => {
    if (isAdmin || isAudit) return users;
    if (isManager) {
      return users.filter((u) => {
        if (u.id === currentUser.id) return false;
        if (u.reportingManagerId === currentUser.id) return true;
        if (u.reviewingManagerId === currentUser.id) return true;
        return false;
      });
    }
    return users.filter((u) => u.id === currentUser.id);
  }, [currentUser, users, isAdmin, isAudit, isManager]);

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
      permanent: accessibleProfiles.filter((u) => layoutOf(u.employmentType) === 'permanent').length,
      contractual: accessibleProfiles.filter((u) => layoutOf(u.employmentType) === 'contractual').length,
      researcher: accessibleProfiles.filter((u) => layoutOf(u.employmentType) === 'researcher').length,
      diploma_trainee: accessibleProfiles.filter((u) => layoutOf(u.employmentType) === 'diploma_trainee').length,
      intern: accessibleProfiles.filter((u) => layoutOf(u.employmentType) === 'intern').length,
      bsc_msc_student: accessibleProfiles.filter((u) => layoutOf(u.employmentType) === 'bsc_msc_student').length,
      phd_student: accessibleProfiles.filter((u) => layoutOf(u.employmentType) === 'phd_student').length,
    };
  }, [accessibleProfiles]);

  // Category, Department, Status & Search Filtered Profiles
  const categoryFilteredProfiles = useMemo(() => {
    // The system accounts show in this table only (administrator and auditor), after everyone else.
    const rows = isAdmin || isAudit ? [...accessibleProfiles, ...systemUsers] : accessibleProfiles;
    return rows.filter((u) => {
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
    systemUsers,
    isAdmin,
    isAudit,
    selectedEmployeeFilter,
    selectedDesignationFilter,
    selectedDepartmentFilter,
    selectedReportingMgrFilter,
    selectedCategoryFilter,
    selectedStatusFilter,
    profileSearchQuery,
  ]);

  const directoryFiltered = !selectedEmployeeFilter.includes('all') || !selectedDesignationFilter.includes('all') ||
    !selectedDepartmentFilter.includes('all') || !selectedReportingMgrFilter.includes('all') ||
    !selectedCategoryFilter.includes('all') || !selectedStatusFilter.includes('all') || profileSearchQuery !== '';
  const resetDirectoryFilters = () => {
    setSelectedEmployeeFilter(['all']);
    setSelectedDesignationFilter(['all']);
    setSelectedDepartmentFilter(['all']);
    setSelectedReportingMgrFilter(['all']);
    setSelectedCategoryFilter(['all']);
    setSelectedStatusFilter(['all']);
    setProfileSearchQuery('');
  };

  // Export Handlers for Personnel Directory
  // Auditor: the server builds the files from the database and logs every download.
  const [exportingDirectory, setExportingDirectory] = useState<'csv' | 'pdf' | null>(null);
  const canExportDirectory = isAdmin || isAudit || isManager;
  const handleExportCSV = async () => {
    if (!canExportDirectory || exportingDirectory) return;
    setExportingDirectory('csv');
    try {
      await auditorApi.downloadDirectory();
      showToast('Employee records downloaded.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The download failed.');
    } finally {
      setExportingDirectory(null);
    }
  };

  const handleExportPDF = async () => {
    if (!canExportDirectory || exportingDirectory) return;
    setExportingDirectory('pdf');
    try {
      const table = await auditorApi.directoryForPdf();
      const title = isManager ? 'My team' : 'Employee directory';
      downloadTablePdf({
        title,
        subtitle: [`Generated ${printedAt(table.generatedAt)}`],
        headers: table.headers,
        rows: table.rows,
        fileName: `WII_${title.replace(/\s+/g, '_')}_${table.generatedAt.slice(0, 10)}`,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The PDF could not be prepared.');
    } finally {
      setExportingDirectory(null);
    }
  };

  const getCategoryBadge = (u: UserType) => {
    if (layoutOf(u.employmentType) === 'researcher' && u.isPhDEnrolled) {
      return {
        label: 'Researchers / Project Staff (PhD Enrolled)',
        shortLabel: 'Researcher (PhD Dual)',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        darkBadgeClass: 'bg-purple-500/30 text-purple-200 border-purple-400/40',
        icon: Sparkles,
        emoji: '🔬🎓'
      };
    }
    if (layoutOf(u.employmentType) === 'phd_student' && u.isPhDEnrolled) {
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

  // Modals and Toasts State
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    suffix: '' as string,
    email: '',
    gender: '',
    phone: '',
    emergencyContactPhone: '',
    biometricId: '',
    permanentEmploymentType: '' as 'Direct' | 'Deputation' | '',
    shiftId: '',
    leaveGroup: '',
    department: '',
    designation: '',
    role: '' as UserRole,
    employmentType: '' as EmploymentType,
    employeeCategory: '',
    isPhDEnrolled: false,
    officeLocation: '',
    institute: '',
    reportingManagerId: '',
    reviewingManagerId: '',
    joiningDate: '',
    dob: '',
    isOnProbation: false,
    isPwd: false,
    probationEndDate: '',
    validUntilDate: '',
    piName: '',
    hodName: '',
    courseProgram: '',
    courseBatch: '',
    enrolledThrough: '',
    guideSupervisor: ''
  });

  /** Account being edited in the employee form, or null when adding a new one. */
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  // Field errors from the server's last answer, shown under each field.
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  // Leave groups come from Master Settings; the employee's group decides the leave types and the leave year.
  const [leaveGroups, setLeaveGroups] = useState<LeaveGroupRecord[]>([]);
  useEffect(() => {
    let active = true;
    leaveGroupApi.list().then((r) => { if (active) setLeaveGroups(r.groups); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  // Allowed email domains come from the server's sign-in rules.
  const [emailDomains, setEmailDomains] = useState<string[]>(['wii.gov.in', 'edu.wii.gov.in']);
  useEffect(() => {
    let active = true;
    api<{ emailDomains?: string[] }>('/auth/config')
      .then((c) => { if (active && Array.isArray(c.emailDomains) && c.emailDomains.length) setEmailDomains(c.emailDomains); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  /** Updates one form field and clears its error. */
  const setField = <K extends keyof typeof newUserForm>(key: K, value: (typeof newUserForm)[K]) => {
    setNewUserForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => (e[key as string] ? { ...e, [key as string]: '' } : e));
  };

  // Instant hints while typing. The server repeats every check when saving.
  const liveErrors = useMemo(() => {
    const out: Record<string, string> = {};
    const others = users.filter((u) => u.id !== editingEmployeeId);
    const email = newUserForm.email.trim().toLowerCase();
    if (email) {
      const domain = email.includes('@') ? email.slice(email.lastIndexOf('@') + 1) : '';
      if (!emailDomains.includes(domain)) out.email = `Only ${emailDomains.map((d) => `@${d}`).join(' or ')} email addresses are accepted.`;
      else if (others.some((u) => (u.email || '').toLowerCase() === email)) out.email = 'Another employee already uses this email.';
    }
    const phoneDigits = newUserForm.phone.replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      const owner = others.find((u) => (u.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits.slice(-10));
      if (owner) out.phone = `This mobile number is already registered to ${owner.name}.`;
    } else if (newUserForm.phone.trim()) {
      out.phone = 'Enter a 10-digit mobile number.';
    }
    const bio = newUserForm.biometricId.trim();
    if (bio && !editingEmployeeId) {
      if (!/^\d{4}$/.test(bio)) out.biometricId = 'Biometric ID must be exactly 4 digits.';
      else if (others.some((u) => u.biometricId === bio)) out.biometricId = 'This biometric ID is already in use.';
    }
    return out;
  }, [newUserForm.email, newUserForm.phone, newUserForm.biometricId, users, emailDomains, editingEmployeeId]);

  const errorOf = (key: string): string => liveErrors[key] || formErrors[key] || '';
  const inputClass = (key: string, locked = false) =>
    `w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 text-xs font-medium shadow-2xs transition-all ${
      locked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'
    } ${
      errorOf(key) ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200/90 focus:ring-blue-600/20 focus:border-blue-500'
    }`;
  // Nothing is written under a field: a problem shows as a red border with the
  // reason on hover, is read out by screen readers, and appears in the toast on save.
  const fieldError = (name: string) =>
    errorOf(name) ? <span className="sr-only" role="alert">{errorOf(name)}</span> : null;
  /** Red outline around a dropdown / date picker that has a problem. */
  const controlBox = (name: string) =>
    errorOf(name) ? 'rounded-xl ring-2 ring-rose-400' : '';

  // Password reset modal (display result)
  const [passwordResetModal, setPasswordResetModal] = useState<{
    user: UserType;
    tempPass: string;
    /** Heading and the line under the password (defaults: a password reset). */
    title?: string;
    note?: string;
  } | null>(null);

  // Password Reset Form Modal State
  const [userToResetPasswordForm, setUserToResetPasswordForm] = useState<UserType | null>(null);
  const [resetPassForm, setResetPassForm] = useState({
    mode: 'default' as 'default' | 'auto' | 'custom',
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
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReference, setDeleteReference] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Active module-role assignments loaded from the access API for the table.
  const [databaseModuleRoles, setDatabaseModuleRoles] = useState<Record<string, Partial<Record<EnterpriseModuleId, string[]>>>>({});

  useEffect(() => {
    let cancelled = false;
    const loadActiveModuleRoles = async () => {
      try {
        const employeeResponse = await fetch('/api/hrms/employees', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (!employeeResponse.ok) return;
        const payload = await employeeResponse.json();
        const employeeRows = Array.isArray(payload) ? payload : Array.isArray(payload?.employees) ? payload.employees : [];
        const next: Record<string, Partial<Record<EnterpriseModuleId, string[]>>> = {};

        await Promise.all(users.map(async (user) => {
          const employee = employeeRows.find((row: any) =>
            String(row?.id ?? '') === String(user.id ?? '') ||
            (user.email && String(row?.email ?? '').trim().toLowerCase() === String(user.email).trim().toLowerCase()) ||
            (user.name && String(row?.name ?? '').trim().toLowerCase() === String(user.name).trim().toLowerCase())
          );
          const biometricId = String(
            user.biometricId ?? (user as UserType & { biometric_id?: string }).biometric_id ??
            employee?.biometricId ?? employee?.biometric_id ?? ''
          ).trim();
          if (!biometricId) return;

          try {
            const response = await fetch(`/api/access/users/${encodeURIComponent(biometricId)}/roles`, {
              credentials: 'same-origin',
              cache: 'no-store',
              headers: { Accept: 'application/json' }
            });
            if (!response.ok) return;
            const rolePayload = await response.json();
            const assignments = Array.isArray(rolePayload?.assignments) ? rolePayload.assignments : [];
            const moduleRoles: Partial<Record<EnterpriseModuleId, string[]>> = {};
            assignments.filter((a: any) => String(a?.status ?? 'active').toLowerCase() === 'active')
              .forEach((assignment: any) => {
                const rawModule = String(assignment?.moduleId ?? '').toLowerCase();
                const moduleKey: EnterpriseModuleId | undefined = ({
                  hrms: 'lams', lams: 'lams', pms: 'pms',
                  stock: 'sims', sims: 'sims', finance: 'finance',
                  facility: 'fms', fms: 'fms'
                } as Record<string, EnterpriseModuleId>)[rawModule];
                if (!moduleKey) return;
                const rawRole = String(assignment?.roleId ?? '').trim();
                const normalizedRole = /^(auditor|audit|hrms_auditor|pms_reviewer|sims_auditor|fin_auditor|fms_auditor)$/i.test(rawRole)
                  ? 'Auditor'
                  : rawRole;
                if (!moduleRoles[moduleKey]) moduleRoles[moduleKey] = [];
                if (normalizedRole && !moduleRoles[moduleKey]!.includes(normalizedRole)) moduleRoles[moduleKey]!.push(normalizedRole);
              });
            next[String(user.id)] = moduleRoles;
          } catch (error) {
            console.error('Could not load active module roles for employee:', error);
          }
        }));
        if (!cancelled) setDatabaseModuleRoles(next);
      } catch (error) {
        console.error('Could not load active module roles for table:', error);
      }
    };
    void loadActiveModuleRoles();
    return () => { cancelled = true; };
  }, [users]);

  // Role Edit Modal State
  const [userToEditRoles, setUserToEditRoles] = useState<UserType | null>(null);
  const [editUserBaseRole, setEditUserBaseRole] = useState<UserRole>('general_staff');
  const [editUserRolesState, setEditUserRolesState] = useState<UserRole[]>(['general_staff']);
  const [editUserModuleRolesState, setEditUserModuleRolesState] = useState<Record<string, string[]>>({});
  const [isRoleMatrixLoading, setIsRoleMatrixLoading] = useState(false);

  const handleOpenEditRoles = async (u: UserType) => {
    if (u.id === currentUser.id) {
      showToast('Administrators cannot edit their own roles.');
      return;
    }

    // AppContext can provide users with an internal numeric ID but without the
    // canonical biometric ID. Resolve the employee row before querying grants.
    let biometricId = String(
      u.biometricId ?? (u as UserType & { biometric_id?: string }).biometric_id ?? ''
    ).trim();

    if (!biometricId) {
      try {
        const employeeResponse = await fetch('/api/hrms/employees', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (employeeResponse.ok) {
          const employeePayload = await employeeResponse.json();
          const employeeRows = Array.isArray(employeePayload)
            ? employeePayload
            : Array.isArray(employeePayload?.employees)
              ? employeePayload.employees
              : [];
          const canonicalEmployee = employeeRows.find((employee: any) =>
            String(employee?.id ?? '') === String(u.id ?? '') ||
            (u.email && String(employee?.email ?? '').trim().toLowerCase() === String(u.email).trim().toLowerCase()) ||
            (u.name && String(employee?.name ?? '').trim().toLowerCase() === String(u.name).trim().toLowerCase())
          );
          biometricId = String(canonicalEmployee?.biometricId ?? canonicalEmployee?.biometric_id ?? '').trim();
        }
      } catch (error) {
        console.error('Could not resolve employee biometric ID for role matrix:', error);
      }
    }

    if (!biometricId) {
      showToast('Cannot open role matrix: employee biometric ID was not found in the database.');
      return;
    }

    const userForRoleEditor = { ...u, biometricId } as UserType;

    setUserToEditRoles(userForRoleEditor);
    setEditUserBaseRole(u.role);
    setEditUserRolesState(getUserRoles(u));

    const modRoles: Record<string, string[]> = {
      lams: u.moduleRoles?.lams ? [...u.moduleRoles.lams] : getUserModuleRoles(u, 'lams'),
      pms: u.moduleRoles?.pms ? [...u.moduleRoles.pms] : [],
      sims: u.moduleRoles?.sims ? [...u.moduleRoles.sims] : [],
      fms: u.moduleRoles?.fms ? [...u.moduleRoles.fms] : [],
      finance: u.moduleRoles?.finance ? [...u.moduleRoles.finance] : []
    };
    setEditUserModuleRolesState(modRoles);
    // Prevent edits while the authoritative DB grants are loading; otherwise a late GET can overwrite a checkbox click.
    setIsRoleMatrixLoading(true);

    if (biometricId) {
      void fetch(`/api/access/users/${encodeURIComponent(biometricId)}/roles`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Role lookup failed (${response.status})`);
        const payload = await response.json();
        const next: Record<string, string[]> = { lams: [], pms: [], sims: [], finance: [], fms: [] };
        const moduleKeyMap: Record<string, string> = {
          hrms: 'lams', lams: 'lams', pms: 'pms', stock: 'sims', sims: 'sims',
          finance: 'finance', facility: 'fms', fms: 'fms'
        };
        const normalizeRole = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
        const hrmsRoleMap: Record<string, string> = {
          user: 'hrms_staff', generalstaff: 'hrms_staff', hrmsstaff: 'hrms_staff',
          reportingmanager: 'hrms_reporting', hrmsreporting: 'hrms_reporting',
          hod: 'hrms_reviewing', reviewingmanager: 'hrms_reviewing', hrmsreviewing: 'hrms_reviewing',
          administrator: 'hrms_admin', admin: 'hrms_admin', hrmsadmin: 'hrms_admin',
          auditor: 'auditor', audit: 'auditor',
          leavebalancemanager: 'hrms_leave_balance', hrmsleavebalance: 'hrms_leave_balance', leavebalance: 'hrms_leave_balance'
        };
        const matrixRoleAliases: Record<string, Record<string, string>> = {
          lams: hrmsRoleMap,
          pms: { admin: 'pms_admin', administrator: 'pms_admin', hod: 'pms_pi', reportingmanager: 'pms_co_pi', user: 'pms_researcher', auditor: 'auditor' },
          sims: { admin: 'sims_admin', administrator: 'sims_admin', hod: 'sims_approver', reportingmanager: 'sims_store_keeper', user: 'sims_indenter', auditor: 'auditor' },
          finance: { admin: 'fin_admin', administrator: 'fin_admin', hod: 'fin_officer', reportingmanager: 'fin_accountant', user: 'fin_claimant', auditor: 'auditor' },
          fms: { admin: 'fms_admin', administrator: 'fms_admin', hod: 'fms_officer', reportingmanager: 'fms_supervisor', user: 'fms_requester', auditor: 'auditor' }
        };
        for (const grant of (Array.isArray(payload.assignments) ? payload.assignments : [])) {
          if (grant.status && String(grant.status).toLowerCase() !== 'active') continue;
          const moduleKey = moduleKeyMap[String(grant.moduleId || '').trim().toLowerCase()];
          if (!moduleKey) continue;
          const rawRole = String(grant.roleId || '').trim();
          const normalized = normalizeRole(rawRole);
          const defs = MODULE_ROLE_DEFINITIONS[moduleKey as EnterpriseModuleId] || [];
          const match = defs.find((definition) =>
            normalizeRole(definition.id) === normalized ||
            normalizeRole(definition.name) === normalized
          );
          const roleKey = match?.id || matrixRoleAliases[moduleKey]?.[normalized] || rawRole;
          if (roleKey && !next[moduleKey].includes(roleKey)) next[moduleKey].push(roleKey);
        }
        setEditUserModuleRolesState(next);
      }).catch((error) => {
        console.error('Could not load active roles for user matrix:', error);
        showToast('Could not load active role assignments from database.');
      }).finally(() => {
        setIsRoleMatrixLoading(false);
      });
    }
  };

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

  const handleSaveRoleChangesInProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEditRoles) return;

    // Role Matrix save must only update module-role assignments.
    // Do not update employee profile, employment type, manager hierarchy, or core user role here.
    const moduleIds: Record<string, string> = { lams: 'hrms', pms: 'pms', sims: 'stock', finance: 'finance', fms: 'facility' };
    const assignments = Object.entries(editUserModuleRolesState).flatMap(([moduleKey, roleIds]) => {
      const defs = MODULE_ROLE_DEFINITIONS[moduleKey as keyof typeof MODULE_ROLE_DEFINITIONS] || [];
      return roleIds.map((roleId) => {
        const definition = defs.find((item) => item.id === roleId);
        if (!moduleIds[moduleKey]) return null;

        // Auditor is a shared cross-module role and may not exist in each module's
        // legacy MODULE_ROLE_DEFINITIONS list. Never silently drop a selected matrix cell.
        const normalizedRoleId = String(roleId || '').trim().toLowerCase().replace(/[\\s_-]+/g, '');
        const canonicalRoleName = normalizedRoleId === 'auditor' || normalizedRoleId === 'audit'
          ? 'Auditor'
          : definition?.name || roleId;

        return canonicalRoleName
          ? { moduleId: moduleIds[moduleKey], roleId: canonicalRoleName }
          : null;
      }).filter((item): item is { moduleId: string; roleId: string } => Boolean(item));
    });

    if (isRoleMatrixLoading) {
      showToast('Role assignments are still loading. Please wait a moment and try Save again.');
      return;
    }
    if (assignments.length === 0) {
      showToast('No role assignments selected. Select at least one role before saving.');
      return;
    }

    try {
      const response = await fetch(`/api/access/users/${encodeURIComponent(userToEditRoles.biometricId || '')}/roles`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ assignments })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || `Save failed (${response.status})`);
      }
    } catch (error) {
      console.error('Failed to save module-role assignments:', error);
      showToast(error instanceof Error ? error.message : 'Could not save module-role assignments.');
      return;
    }

    // Refresh the table's role chips immediately from the exact assignments just saved.
    const moduleKeyMap: Record<string, EnterpriseModuleId> = {
      hrms: 'lams', lams: 'lams', pms: 'pms',
      stock: 'sims', sims: 'sims', finance: 'finance',
      facility: 'fms', fms: 'fms'
    };
    const refreshedRoles: Partial<Record<EnterpriseModuleId, string[]>> = {};
    for (const assignment of assignments) {
      const moduleKey = moduleKeyMap[String(assignment.moduleId).toLowerCase()];
      if (!moduleKey) continue;
      if (!refreshedRoles[moduleKey]) refreshedRoles[moduleKey] = [];
      if (!refreshedRoles[moduleKey]!.includes(assignment.roleId)) refreshedRoles[moduleKey]!.push(assignment.roleId);
    }
    setDatabaseModuleRoles((previous) => ({
      ...previous,
      [String(userToEditRoles.id)]: refreshedRoles
    }));
    showToast(`Module roles and permissions updated for ${userToEditRoles.name}`);
    setUserToEditRoles(null);
  };

  // Search & Multi-Select Filters in User Controls (Module, Role, Status)
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userControlsModuleFilter, setUserControlsModuleFilter] = useState<string[]>(['all']);
  const [userControlsRoleFilter, setUserControlsRoleFilter] = useState<string[]>(['all']);
  const [userControlsStatusFilter, setUserControlsStatusFilter] = useState<string[]>(['all']);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handlers
  const [savingProfile, setSavingProfile] = useState(false);

  const closeEmployeeForm = () => {
    setIsCreatingUser(false);
    setEditingEmployeeId(null);
  };

  /** Opens the same form used for new employees, filled with the saved profile. */
  const openEditEmployee = (u: UserType) => {
    const saved = u as UserType & { permanentEmploymentType?: 'Direct' | 'Deputation'; enrolledThrough?: string };
    setNewUserForm({
      name: u.name || '',
      suffix: u.suffix || '',
      email: u.email || '',
      gender: u.gender || '',
      phone: u.phone || '',
      emergencyContactPhone: '',
      biometricId: u.biometricId || '',
      permanentEmploymentType: saved.permanentEmploymentType || '',
      shiftId: u.shiftId || '',
      leaveGroup: u.leaveGroup || '',
      department: u.department || '',
      designation: u.designation || '',
      role: u.role,
      employmentType: u.employmentType,
      employeeCategory: u.employeeCategory || '',
      isPhDEnrolled: Boolean(u.isPhDEnrolled),
      officeLocation: u.officeLocation || '',
      institute: u.institute || '',
      reportingManagerId: u.reportingManagerId || '',
      reviewingManagerId: u.reviewingManagerId || users.find((m) => m.name === u.hodName)?.id || '',
      joiningDate: u.joiningDate || '',
      dob: u.dob || '',
      isOnProbation: Boolean(u.isOnProbation),
      isPwd: Boolean(u.isPwd),
      probationEndDate: u.probationEndDate || '',
      validUntilDate: u.validUntilDate || '',
      piName: u.piName || '',
      hodName: u.hodName || '',
      courseProgram: u.courseProgram || '',
      courseBatch: u.courseBatch || '',
      enrolledThrough: saved.enrolledThrough || '',
      guideSupervisor: u.guideSupervisor || ''
    });
    setFormErrors({});
    setEditingEmployeeId(u.id);
    setIsCreatingUser(true);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    if (!isAdmin) {
      showToast('Only administrators can create employee profiles.');
      return;
    }

    const missingFields: string[] = [];
    if (!newUserForm.suffix?.trim()) missingFields.push('Suffix');
    if (!newUserForm.name?.trim()) missingFields.push('Full Name');
    if (!newUserForm.gender?.trim()) missingFields.push('Gender');
    if (!newUserForm.dob?.trim()) missingFields.push('Date of Birth (DOB)');
    if (!newUserForm.phone?.trim()) missingFields.push('Mobile Number');
    if (!newUserForm.email?.trim()) missingFields.push('Email Address');
    if (!/^\d{4}$/.test(newUserForm.biometricId?.trim() || '')) missingFields.push('Biometric ID (4 digits)');
    if (!newUserForm.institute) missingFields.push('Organization');
    if (!newUserForm.employmentType) missingFields.push('Employee Type');
    if (!newUserForm.shiftId?.trim()) missingFields.push('Shift');
    if (!newUserForm.leaveGroup) missingFields.push('Leave Group');
    if (!newUserForm.joiningDate?.trim()) missingFields.push('Date of Joining');

    if (layoutOf(newUserForm.employmentType) === 'permanent') {
      if (!newUserForm.permanentEmploymentType?.trim()) missingFields.push('Category');
      if (!newUserForm.employeeCategory?.trim()) missingFields.push('Cadre');
      if (!newUserForm.designation?.trim()) missingFields.push('Designation');
      if (!newUserForm.department?.trim()) missingFields.push('Department / Section / Cell');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.reviewingManagerId?.trim()) missingFields.push('HoD');
      if (newUserForm.permanentEmploymentType === 'Deputation' && !newUserForm.validUntilDate?.trim()) {
        missingFields.push('Valid Up To Date');
      }
      if (newUserForm.isOnProbation && !newUserForm.probationEndDate?.trim()) missingFields.push('Tentative Probation End Date');
    } else if (layoutOf(newUserForm.employmentType) === 'contractual') {
      if (!newUserForm.employeeCategory?.trim()) missingFields.push('Cadre');
      if (!newUserForm.designation?.trim()) missingFields.push('Designation');
      if (!newUserForm.department?.trim()) missingFields.push('Department / Section / Cell');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (layoutOf(newUserForm.employmentType) === 'researcher') {
      if (!newUserForm.designation?.trim()) missingFields.push('Designation');
      if (!newUserForm.department?.trim()) missingFields.push('Project Name');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager / PI');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (layoutOf(newUserForm.employmentType) === 'diploma_trainee') {
      if (!newUserForm.courseProgram?.trim()) missingFields.push('Course');
      if (!newUserForm.courseBatch?.trim()) missingFields.push('Batch');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (layoutOf(newUserForm.employmentType) === 'bsc_msc_student') {
      if (!newUserForm.courseProgram?.trim()) missingFields.push('Course');
      if (!newUserForm.courseBatch?.trim()) missingFields.push('Batch');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (layoutOf(newUserForm.employmentType) === 'phd_student') {
      if (!newUserForm.enrolledThrough?.trim()) missingFields.push('Enrolled Through');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    } else if (layoutOf(newUserForm.employmentType) === 'intern') {
      if (!newUserForm.department?.trim()) missingFields.push('Project / Department / Section / Cell');
      if (!newUserForm.reportingManagerId?.trim()) missingFields.push('Reporting Manager');
      if (!newUserForm.validUntilDate?.trim()) missingFields.push('Valid Up To Date');
    }

    const liveProblems = Object.values(liveErrors).filter(Boolean);
    if (liveProblems.length > 0) {
      showToast(liveProblems[0]);
      return;
    }

    if (missingFields.length > 0) {
      showToast(`Mandatory fields required: ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? ` and ${missingFields.length - 3} more` : ''}`);
      return;
    }

    // The server re-checks every field and writes users, employee_profiles,
    // the HRMS role and the audit log together. The form only reports its answer.
    const payload = {
      ...newUserForm,
      name: newUserForm.name.trim(),
      biometricId: newUserForm.biometricId.trim(),
      avatar: '',
      role: newUserForm.role || 'general_staff',
      employmentType: newUserForm.employmentType as EmploymentType,
      leaveGroup: newUserForm.leaveGroup,
      status: 'active' as const
    };
    setSavingProfile(true);
    let result;
    try {
      result = editingEmployeeId ? await updateUserProfile(editingEmployeeId, payload) : await addUserProfile(payload);
    } finally {
      setSavingProfile(false);
    }

    showToast(result.message);
    if (!result.success) {
      setFormErrors(result.fieldErrors ?? {});
      return;
    }
    const savedId = result.user?.id ?? editingEmployeeId;
    closeEmployeeForm();
    if (savedId) setSelectedUserId(savedId);
    // A new account: show its temporary password once, in case the welcome email does not arrive.
    if (result.temporaryPassword && result.user) {
      setPasswordResetModal({
        user: result.user, tempPass: result.temporaryPassword, title: 'Employee account created',
        note: `Also emailed to ${result.user.email} with the login ID and portal address. They will be asked to choose their own password at sign-in.`,
      });
    }
  };

  const handleOpenCreateEmployeeModal = () => {
    setFormErrors({});
    setEditingEmployeeId(null);
    setNewUserForm({
      permanentEmploymentType: '',
      enrolledThrough: '',
      name: '',
      suffix: '' as string,
      email: '',
      gender: '',
      phone: '',
      emergencyContactPhone: '',
      biometricId: '',
      shiftId: '',
      leaveGroup: '',
      department: '',
      designation: '',
      role: '' as UserRole,
      employmentType: '' as EmploymentType,
      employeeCategory: '',
      isPhDEnrolled: false,
      officeLocation: '',
      institute: '',
      reportingManagerId: '',
      reviewingManagerId: '',
      joiningDate: '',
      dob: '',
      isOnProbation: false,
      isPwd: false,
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
      mode: 'default',
      customPassword: '',
      confirmPassword: '',
      reason: 'Official Reset Request',
      showPassword: false
    });
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToResetPasswordForm) return;

    if (resetPassForm.mode === 'custom') {
      if (!resetPassForm.customPassword || resetPassForm.customPassword.length < 8) {
        showToast('Custom password must be at least 8 characters, with a letter and a number.');
        return;
      }
      if (resetPassForm.customPassword !== resetPassForm.confirmPassword) {
        showToast('Passwords do not match. Please re-enter.');
        return;
      }
    }

    const biometricId = String((userToResetPasswordForm as UserType & { biometricId?: string; biometric_id?: string }).biometricId ??
      (userToResetPasswordForm as UserType & { biometric_id?: string }).biometric_id ?? '').trim();
    if (!/^\d{4}$/.test(biometricId)) {
      showToast('Cannot reset password: this user has no valid biometric ID.');
      return;
    }

    try {
      const response = await fetch(`/api/hrms/employees/${encodeURIComponent(biometricId)}/reset-password`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          mode: resetPassForm.mode,
          password: resetPassForm.mode === 'custom' ? resetPassForm.customPassword : undefined,
          reason: resetPassForm.reason
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        showToast(result?.message || result?.error || 'Password reset failed.');
        return;
      }
      const target = userToResetPasswordForm;
      setUserToResetPasswordForm(null);
      setPasswordResetModal({ user: target, tempPass: resetPassForm.mode === 'auto'
        ? 'Temporary password sent to the employee email. They must choose a new password at sign-in.'
        : resetPassForm.mode === 'default'
          ? 'Password reset to the default password. They must choose a new password at sign-in.'
          : 'Temporary password set. They must choose a new password at sign-in.' });
      showToast(result.message || `Password successfully reset for ${target.name}`);
    } catch (error) {
      console.error('Password reset request failed:', error);
      showToast('Unable to reach the server. Password was not confirmed as reset.');
    }
  };

  const handleOpenStatusToggleModal = (u: UserType) => {
    if (u.id === currentUser.id) {
      showToast('Administrators cannot change their own account status.');
      return;
    }
    const isDeactivating = u.status === 'active';
    setStatusChangeError(null);
    setUserToToggleStatusModal(u);
    setStatusChangeForm({
      reasonCategory: isDeactivating ? 'End of Contract / Tenure' : 'Re-instated by Administration',
      customNotes: '',
      effectiveDate: new Date().toISOString().split('T')[0]
    });
  };

  const handleExecuteStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToToggleStatusModal) return;

    const target = userToToggleStatusModal;
    setStatusChangeError(null);
    const fullReason = `${statusChangeForm.reasonCategory}${statusChangeForm.customNotes ? ` (${statusChangeForm.customNotes})` : ''}`;
    const result = await toggleUserStatus(target.id, fullReason, statusChangeForm.effectiveDate);
    if (!result.success) {
      const message = result.message || 'Account status could not be changed.';
      setStatusChangeError(message);
      showToast(message);
      return;
    }

    const isActivating = target.status === 'deactivated';
    showToast(`Account status for ${target.name} changed to ${isActivating ? 'Active' : 'Deactivated'}`);
    setStatusChangeError(null);
    setUserToToggleStatusModal(null);
    if (isActivating && result.temporaryPassword) {
      setPasswordResetModal({
        user: target, tempPass: result.temporaryPassword, title: 'Account reactivated',
        note: `Also emailed to ${target.email} with the login ID and portal address. They will be asked to choose their own password at sign-in.`,
      });
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete || deleteBusy) return;
    if (!deleteReason.trim()) { setDeleteError('Deletion reason is required for the audit log.'); return; }
    setDeleteBusy(true);
    setDeleteError('');
    const target = userToDelete;
    const result = await deleteUser(target.id, deleteReason.trim(), deleteReference.trim());
    setDeleteBusy(false);
    if (!result.success) { setDeleteError(result.message || 'User could not be deleted.'); return; }
    showToast(`User ${target.name} deleted successfully. Audit log recorded.`);
    setUserToDelete(null);
    setDeleteReason('');
    setDeleteReference('');
    setDeleteError('');
  };

  // Memoized active employees (excluding deactivated)
  /** Reporting manager / HoD choices on the employee form: active employees of the same organization. The employee may be their own (a Director is their own reporting manager and HoD). */
  const formManagers = useMemo(() => users.filter((u) =>
    u.status !== 'deactivated' && (!newUserForm.institute || !u.institute || u.institute === newUserForm.institute)),
  [users, newUserForm.institute]);

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

  // Export Configuration Builder for User Access & Permissions
  const getUserControlsExportConfig = () => {
    const activeFiltersList: HRMSFilterTag[] = [];

    if (!userControlsModuleFilter.includes('all')) {
      activeFiltersList.push({
        label: 'Module Filter',
        value: userControlsModuleFilter.join(', ').toUpperCase()
      });
    }

    if (!userControlsRoleFilter.includes('all')) {
      activeFiltersList.push({
        label: 'Role Filter',
        value: userControlsRoleFilter.join(', ').replace(/_/g, ' ')
      });
    }

    if (!userControlsStatusFilter.includes('all')) {
      activeFiltersList.push({
        label: 'Status',
        value: userControlsStatusFilter.join(', ').toUpperCase()
      });
    }

    if (userSearchTerm.trim()) {
      activeFiltersList.push({
        label: 'Search Query',
        value: userSearchTerm.trim()
      });
    }

    const columns: HRMSExportColumn[] = [
      { header: '#', key: 'sno', width: 10, align: 'center' },
      { header: 'Employee Name', key: 'name', width: 34 },
      { header: 'Official Email', key: 'email', width: 38 },
      { header: 'Bio ID', key: 'biometricId', width: 18, align: 'center' },
      { header: 'Department', key: 'department', width: 28 },
      { header: 'Designation', key: 'designation', width: 28 },
      { header: 'System Role', key: 'role', width: 22 },
      { header: 'Assigned Roles', key: 'assignedRoles', width: 34 },
      { header: 'Status', key: 'statusStr', width: 16, align: 'center' }
    ];

    const exportData = filteredUsersForControls.map((u, idx) => ({
      sno: idx + 1,
      name: u.name,
      email: u.email,
      biometricId: u.biometricId || '-',
      department: u.department || '-',
      designation: u.designation || '-',
      role: u.role.replace(/_/g, ' ').toUpperCase(),
      assignedRoles: (u.roles || [u.role]).join('; '),
      statusStr: (u.status || 'active').toUpperCase()
    }));

    return {
      title: 'User Roles & System Access Control Register',
      subtitle: 'Multi-Module Authorization, Profile Verification and Active Status Audit Matrix',
      category: 'HRMS • Security & Role-Based Access Control (RBAC)',
      institution: 'WILDLIFE INSTITUTE OF INDIA (WII)',
      generatedBy: {
        name: currentUser.name,
        designation: currentUser.designation,
        department: currentUser.department,
        email: currentUser.email
      },
      filters: activeFiltersList,
      summaryItems: [
        { label: 'Total Users Monitored', value: filteredUsersForControls.length },
        { label: 'Active Accounts', value: filteredUsersForControls.filter((u) => u.status !== 'inactive').length },
        { label: 'Inactive / Suspended', value: filteredUsersForControls.filter((u) => u.status === 'inactive').length }
      ],
      columns,
      data: exportData,
      fileName: `WII_User_Permissions_Matrix_${new Date().toISOString().split('T')[0]}`
    };
  };

  const handleExportUserControlsCSV = () => {
    if (filteredUsersForControls.length === 0) {
      showToast('No user records match the current filter criteria.');
      return;
    }
    const config = getUserControlsExportConfig();
    void logThenDownload('user_controls', 'csv', filteredUsersForControls.length, config.filters.map((f) => `${f.label}: ${f.value}`).join(' · '), () => {
      exportHRMSToCSV(config);
      showToast('User Access Matrix exported to CSV successfully!');
    }, showToast);
  };

  const handleExportUserControlsPDF = () => {
    if (filteredUsersForControls.length === 0) {
      showToast('No user records match the current filter criteria.');
      return;
    }
    const config = getUserControlsExportConfig();
    void logThenDownload('user_controls', 'pdf', filteredUsersForControls.length, config.filters.map((f) => `${f.label}: ${f.value}`).join(' · '), () => {
      exportHRMSToPDF({
        ...config,
        orientation: 'landscape'
      });
      showToast('User Access Matrix exported to PDF successfully!');
    }, showToast);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Page Header */}
      <PageHeader
        icon={
          activeTab === 'user_controls'
            ? PAGE_ICONS.user_controls
            : activeTab === 'transfers'
            ? PAGE_ICONS.transfers
            : PAGE_ICONS.profile
        }
        title={
          activeTab === 'user_controls'
            ? 'User Controls & Roles'
            : activeTab === 'transfers'
            ? 'Employees Mapping'
            : (isAdmin || isAudit)
            ? 'Employee Profiles & Directory'
            : isManager
            ? 'My Team'
            : 'Profile'
        }
        subtitle={
          activeTab === 'user_controls'
            ? 'Manage user accounts, system roles, reporting hierarchy & access permissions'
            : activeTab === 'transfers'
            ? 'Manage employee department transfers, posting orders & manager replacements'
            : isAudit
            ? 'View every employee profile, download records and review activity logs'
            : isAdmin
            ? 'Manage employee profiles, service cadres & official personnel records'
            : isManager
            ? 'Profiles of the employees who report to you or whose HoD you are'
            : 'Personal employment record, service tenure, cadre details & official contact information'
        }
        rightAction={
          isAdmin && !isAudit ? (
            activeTab === 'profile' || !activeTab ? (
              <PageHeaderButton icon={Plus} onClick={handleOpenCreateEmployeeModal}>New employee</PageHeaderButton>
            ) : activeTab === 'transfers' ? (
              <>
                <PageHeaderButton icon={ArrowLeftRight} onClick={() => setMappingOrder((o) => ({ kind: 'transfer', n: o.n + 1 }))}>Employee transfer</PageHeaderButton>
                <PageHeaderButton icon={RefreshCw} variant="secondary" onClick={() => setMappingOrder((o) => ({ kind: 'replace', n: o.n + 1 }))}>Manager replacement</PageHeaderButton>
              </>
            ) : undefined
          ) : undefined
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[100] bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: EMPLOYEE PROFILE DETAILS */}
      {/* ==================================================================== */}
      {/* User role: the employee's own profile, laid out by the server for their employee type. */}
      {showMyProfile && (
        <MyProfileView
          onPhotoChanged={async () => {
            await Promise.all([refreshSession(), reloadEmployees()]);
          }}
        />
      )}

      {isAudit && activeTab === 'profile' && auditorView === 'activity' && <EmployeeActivityLog toolbarStart={auditorSwitch} />}

      {!showMyProfile && !(isAudit && auditorView === 'activity') && (activeTab === 'profile' || (!isAdmin && !isAudit)) && (
        <div className="space-y-5">
          {/* Search / filter / export bar (same layout on every page) */}
          {(isAdmin || isAudit || isManager) && (
            <FilterToolbar
              start={isAudit ? auditorSwitch : null}
              exports={canExportDirectory ? {
                onCsv: () => void handleExportCSV(), onPdf: () => void handleExportPDF(), busy: exportingDirectory,
                csvTitle: isManager ? 'Download your team as CSV (the download is logged)' : 'Download employee records as CSV (the download is logged)',
                pdfTitle: isManager ? 'Download your team as PDF (the download is logged)' : 'Download employee records as PDF (the download is logged)',
              } : null}
              search={{ value: profileSearchQuery, onChange: setProfileSearchQuery, placeholder: 'Search staff, department, designation, biometric ID…' }}
              onReset={directoryFiltered ? resetDirectoryFilters : null}
              view={{
                value: directoryViewMode === 'grid' ? 'grid' : 'table',
                onChange: (v) => setDirectoryViewMode(v),
                options: [{ value: 'table', label: 'Table view', icon: List }, { value: 'grid', label: 'Card view', icon: LayoutGrid }],
              }}
              filters={[
              <MultiSelectFilter key="employee"
              label="Employee"
              selectedValues={selectedEmployeeFilter}
              onChange={(newVals) => {
              setSelectedEmployeeFilter(newVals);
              if (newVals.length === 1 && newVals[0] !== 'all') {
              setSelectedUserId(newVals[0]);
              }
              }}
              options={accessibleProfiles.map((u) => ({ label: u.name, value: u.id }))}
              />,
              <MultiSelectFilter key="designation"
              label="Designation"
              selectedValues={selectedDesignationFilter}
              onChange={setSelectedDesignationFilter}
              options={designationsList.map((desig) => ({ label: desig, value: desig }))}
              />,
              <MultiSelectFilter key="department"
              label="Department"
              selectedValues={selectedDepartmentFilter}
              onChange={setSelectedDepartmentFilter}
              options={departmentsMaster.map((dept) => ({ label: dept, value: dept }))}
              />,
              !isManager && <MultiSelectFilter key="manager"
              label="Reporting Manager"
              selectedValues={selectedReportingMgrFilter}
              onChange={setSelectedReportingMgrFilter}
              options={reportingMgrsList.map((mgr) => ({ label: mgr.name, value: mgr.id }))}
              />,
              <MultiSelectFilter key="type"
              label="Employment Type"
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
              />,
              <MultiSelectFilter key="status"
              label="Status"
              selectedValues={selectedStatusFilter}
              onChange={setSelectedStatusFilter}
              options={[
              { label: 'Active', value: 'active' },
              { label: 'Deactivated', value: 'deactivated' }
              ]}
              />,
              ]}
            />
          )}

          {/* Directory Rendering Switcher */}
          {((isAdmin || isAudit || isManager) && directoryViewMode !== 'detail') ? (
            /* ================================================================ */
            /* VIEW 1: CATEGORY CARDS GRID */
            /* ================================================================ */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>Showing <strong>{categoryFilteredProfiles.length}</strong> profile(s) in selected view</span>
              </div>

              {categoryFilteredProfiles.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                  <UserX className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-bold text-slate-800 text-sm">No profiles match the selected category & search criteria</h4>
                  
                  <Button variant="primary" size="sm" onClick={() => { setSelectedCategoryFilter('all'); setProfileSearchQuery(''); }}>Show all profiles</Button>
                </div>
              ) : directoryViewMode === 'table' ? (
                <DirectoryTable
                  rows={categoryFilteredProfiles}
                  typeLabel={(code) => (masterOptions.employeeType ?? []).find((r) => r.code === code)?.name || code || '—'}
                  instituteName={(code) => (masterOptions.institute ?? []).find((r) => r.code === code)?.name || ''}
                  managerName={(id) => (id && users.find((m) => m.id === id)?.name) || '—'}
                  onView={(u) => { setSelectedUserId(u.id); setDirectoryViewMode('detail'); }}
                  onEdit={isAdmin ? (u) => openEditEmployee(u) : undefined}
                  onHistory={isAdmin ? (u) => setHistoryUser(u) : undefined}
                />
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
                                <UserAvatar name={u.name} src={u?.avatar} className="w-12 h-12 rounded-xl ring-2 ring-slate-100 shadow-2xs" />
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

                            {layoutOf(u.employmentType) === 'researcher' && u.isPhDEnrolled && (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300 flex items-center space-x-1">
                                <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>Dual PhD Enrolled</span>
                              </span>
                            )}
                          </div>

                          {/* Category Specific Highlights */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1.5 text-slate-700">
                            {(layoutOf(u.employmentType) === 'msc_student' || layoutOf(u.employmentType) === 'phd_scholar' || u.isPhDEnrolled) && (
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

                            {(layoutOf(u.employmentType) === 'trainee' || layoutOf(u.employmentType) === 'intern') && (
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

                            {(layoutOf(u.employmentType) === 'permanent' || layoutOf(u.employmentType) === 'contractual' || (layoutOf(u.employmentType) === 'researcher' && !u.isPhDEnrolled)) && (
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

                          {isAdmin && !u.isSystem && (
                            <button
                              onClick={() => setHistoryUser(u)}
                              className={actionBtn('neutral')}
                              title="Manage project & career history"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && !u.isSystem && (
                            <button
                              onClick={() => {
                                openEditEmployee(u);
                              }}
                              className={actionBtn('neutral')}
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
            /* Full profile of one employee (server checks the viewer may see it). */
            <div>
              <EmployeeProfileView
                userId={selectedUser.id}
                canEditPhoto={isAdmin && !selectedUser.isSystem}
                onBack={(isAdmin || isAudit || isManager) ? () => setDirectoryViewMode(lastListMode) : undefined}
                onPhotoChanged={async () => {
                  await Promise.all([reloadEmployees(), selectedUser.id === currentUser.id ? refreshSession() : Promise.resolve()]);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: USER CONTROLS, ROLES & ACCOUNTS */}
      {/* ==================================================================== */}
      {activeTab === 'user_controls' && isAudit && auditorView === 'activity' && <UserControlsActivityLog toolbarStart={auditorSwitch} />}
      {activeTab === 'user_controls' && !(isAudit && auditorView === 'activity') && (
        <div className="space-y-4">
          {/* Search / filter / export bar (same layout on every page) */}
          <FilterToolbar
            start={isAudit ? auditorSwitch : null}
            exports={{
              onCsv: handleExportUserControlsCSV, onPdf: handleExportUserControlsPDF,
              csvTitle: 'Export the user permissions register as CSV', pdfTitle: 'Export the user permissions register as PDF',
            }}
            search={{ value: userSearchTerm, onChange: setUserSearchTerm, placeholder: 'Search user name, email, department, designation…' }}
            onReset={(!userControlsModuleFilter.includes('all') || !userControlsRoleFilter.includes('all') || !userControlsStatusFilter.includes('all') || userSearchTerm !== '')
              ? () => { setUserControlsModuleFilter(['all']); setUserControlsRoleFilter(['all']); setUserControlsStatusFilter(['all']); setUserSearchTerm(''); }
              : null}
            filters={[
            <MultiSelectFilter key="module"
            label="Module"
            selectedValues={userControlsModuleFilter}
            onChange={setUserControlsModuleFilter}
            options={[
            { label: 'HRMS (Leave & Attendance)', value: 'hrms' },
            { label: 'PMS (Project Management)', value: 'pms' },
            { label: 'Stock & Inventory (SIMS)', value: 'stock' },
            { label: 'Facility Management (FMS)', value: 'facility' },
            { label: 'Finance & Budget', value: 'finance' }
            ]}
            />,
            <MultiSelectFilter key="role"
            label="Role"
            selectedValues={userControlsRoleFilter}
            onChange={setUserControlsRoleFilter}
            options={[
            { label: 'Administrator', value: 'administrator' },
            { label: 'Reporting Manager', value: 'reporting_manager' },
            { label: 'HoD', value: 'reviewing_manager' },
            { label: 'User', value: 'general_staff' }
            ]}
            />,
            <MultiSelectFilter key="status"
            label="Status"
            selectedValues={userControlsStatusFilter}
            onChange={setUserControlsStatusFilter}
            options={[
            { label: 'Active', value: 'active' },
            { label: 'Inactive / Suspended', value: 'inactive' }
            ]}
            />,
            ]}
          />

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


                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Employee Details (3 Lines: Name, Designation, Bio ID) */}
                        <td className="px-3.5 py-3 align-middle">
                          <div className="flex items-start space-x-2.5 min-w-0">
                            <UserAvatar name={u.name} src={u?.avatar} className="w-8 h-8 rounded-full border border-slate-200 shrink-0 mt-0.5 shadow-2xs" />
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-900 truncate text-xs block">{u.name}</span>
                              <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={u.email || ''}>
                                {u.email || 'Email not available'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono tracking-tight block truncate mt-0.5">
                                Bio ID: {u.biometricId || 'Not available'}
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
                                const roleIds = databaseModuleRoles[String(u.id)]?.[m.id] ??
                                  u.moduleRoles?.[m.id] ?? [];
                                const defs = MODULE_ROLE_DEFINITIONS[m.id] || [];

                                const roles = roleIds.map((rId) => {
                                  if (/^(auditor|audit|hrms_auditor|pms_reviewer|sims_auditor|fin_auditor|fms_auditor)$/i.test(rId)) return 'Auditor';
                                  const found = defs.find((d) => d.id === rId || d.name === rId || d.shortName === rId);
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
                              className={actionBtn('neutral')}
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit User Roles & 2D Matrix Button */}
                            {isAdmin && (
                              <button
                                onClick={() => handleOpenEditRoles(u)}
                                title="Configure User Roles & 2D Matrix Permissions"
                                className={actionBtn('neutral')}
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Reset Password */}
                            <button
                              onClick={() => handleTriggerResetPassword(u)}
                              title="Reset User Password"
                              className={actionBtn('neutral')}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
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
                                  <UserCheck className="w-3.5 h-3.5" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {/* Delete User */}
                            {isAdmin && !isSelf && (
                              <button
                                onClick={() => { setDeleteError(''); setDeleteReason(''); setDeleteReference(''); setUserToDelete(u); }}
                                title="Delete User"
                                className={actionBtn('danger')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      {/* TAB 3: EMPLOYEES MAPPING (transfers, reporting manager / HoD changes) */}
      {/* ==================================================================== */}
      {activeTab === 'transfers' && isAudit && auditorView === 'activity' && <MappingActivityLog toolbarStart={auditorSwitch} />}
      {activeTab === 'transfers' && !(isAudit && auditorView === 'activity') && (
        <MappingPanel order={mappingOrder} canChange={isAdmin && !isAudit} onChanged={() => void reloadEmployees()} notify={showToast} toolbarStart={isAudit ? auditorSwitch : null} />
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CREATE NEW EMPLOYEE PROFILE */}
      {/* ==================================================================== */}
      {isCreatingUser && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    {editingEmployeeId ? 'Edit Employee Profile' : 'Add New Employee Profile'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEmployeeForm}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
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
                    {/* Row 1: Suffix + Full Name */}
                    <div className="sm:col-span-2 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3.5">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1 text-xs">
                          Suffix <span className="text-blue-600 font-bold ml-0.5">*</span>
                        </label>
                        <div className={controlBox('suffix')} title={errorOf('suffix') || undefined}>
                        <AppSelect
                          value={newUserForm.suffix}
                          placeholder="Select"
                          onChange={(val) => setField('suffix', val as typeof newUserForm.suffix)}
                          options={[{ label: 'Select', value: '' }, ...salutationOptions]}
                          className="w-full"
                        />
                        </div>
                        {fieldError('suffix')}
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1 text-xs">
                          Full Name <span className="text-blue-600 font-bold ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={255}
                          placeholder="Enter Full Name"
                          value={newUserForm.name}
                          onChange={(e) => setField('name', e.target.value)}
                          title={errorOf('name') || undefined}
                        className={inputClass('name')}
                        />
                        {fieldError('name')}
                      </div>
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Gender <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <div className={controlBox('gender')} title={errorOf('gender') || undefined}>
                      <AppSelect
                        value={newUserForm.gender}
                        placeholder="Select Gender"
                        onChange={(val) => setField('gender', val)}
                        options={[
                          { label: 'Select Gender', value: '' },
                          ...genderOptions
                        ]}
                        className="w-full"
                      />
                      </div>
                      {fieldError('gender')}
                    </div>

                    {/* Person with disability */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">Person with disability (PwD)</label>
                      <div className={controlBox('isPwd')} title={errorOf('isPwd') || undefined}>
                      <AppSelect
                        value={newUserForm.isPwd ? 'yes' : 'no'}
                        onChange={(val) => setField('isPwd', val === 'yes')}
                        options={[{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }]}
                        className="w-full"
                      />
                      </div>
                      {fieldError('isPwd')}
                    </div>

                    {/* Date of Birth (DOB) */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Date of Birth (DOB) <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <div className={controlBox('dob')} title={errorOf('dob') || undefined}>
                      <AppDatePicker
                        value={newUserForm.dob}
                        placeholder="Select Date of Birth"
                        onChange={(val) => setField('dob', val)}
                        className="w-full"
                      />
                      </div>
                      {fieldError('dob')}
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Mobile Number (Mob) <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        inputMode="tel"
                        maxLength={16}
                        placeholder="10-digit mobile number"
                        value={newUserForm.phone}
                        onChange={(e) => setField('phone', e.target.value.replace(/[^\d+\s-]/g, ''))}
                        aria-invalid={Boolean(errorOf('phone'))}
                        title={errorOf('phone') || undefined}
                        className={inputClass('phone')}
                      />
                      {fieldError('phone')}
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Email Address <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        maxLength={254}
                        placeholder={`name@${emailDomains[0] ?? 'wii.gov.in'}`}
                        value={newUserForm.email}
                        onChange={(e) => setField('email', e.target.value.trim())}
                        aria-invalid={Boolean(errorOf('email'))}
                        title={errorOf('email') || undefined}
                        className={inputClass('email')}
                      />
                      {fieldError('email')}
                    </div>

                    {/* Biometric ID */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Biometric ID <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={4}
                        readOnly={Boolean(editingEmployeeId)}
                        value={newUserForm.biometricId}
                        onChange={(e) => setField('biometricId', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="4-digit biometric ID"
                        aria-invalid={Boolean(errorOf('biometricId'))}
                        title={errorOf('biometricId') || (editingEmployeeId ? 'The biometric ID cannot be changed after the employee is created.' : undefined)}
                        className={inputClass('biometricId', Boolean(editingEmployeeId))}
                      />
                      {fieldError('biometricId')}
                    </div>

                    {/* Organization (institute) */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Organization <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <div className={controlBox('institute')} title={errorOf('institute') || undefined}>
                        <AppSelect
                          value={newUserForm.institute}
                          placeholder="Select Organization"
                          onChange={(val) => {
                            // Departments belong to an organization: clear one that is not in the new one.
                            // Departments and managers belong to an organization: clear the ones that are not in the new one.
                            const keepDept = !val || departmentsFor(val).includes(newUserForm.department) || optionNames('projects').includes(newUserForm.department);
                            const inInstitute = (id: string) => !id || !val || (users.find((u) => u.id === id)?.institute ?? val) === val;
                            setNewUserForm((f) => ({
                              ...f, institute: val, department: keepDept ? f.department : '',
                              reportingManagerId: inInstitute(f.reportingManagerId) ? f.reportingManagerId : '',
                              reviewingManagerId: inInstitute(f.reviewingManagerId) ? f.reviewingManagerId : '',
                              hodName: inInstitute(f.reviewingManagerId) ? f.hodName : '',
                            }));
                            setFormErrors((e) => (e.institute ? { ...e, institute: '' } : e));
                          }}
                          options={[{ label: 'Select Organization', value: '' }, ...instituteOptions]}
                          className="w-full"
                        />
                      </div>
                      {fieldError('institute')}
                    </div>

                    {/* Employee Type Selection */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-xs">
                        Employee Type <span className="text-blue-600 font-bold ml-0.5">*</span>
                      </label>
                      <AppSelect
                        value={newUserForm.employmentType}
                        placeholder="Select Employee Type"
                        onChange={(val) => {
                          const newCategory = (val || '') as EmploymentType | '';
                          // Everything below depends on the type: start those fields again.
                          setNewUserForm({
                            ...newUserForm,
                            employmentType: newCategory,
                            employeeCategory: '',
                            permanentEmploymentType: '',
                            designation: '',
                            department: '',
                            courseProgram: '',
                            courseBatch: '',
                            enrolledThrough: ''
                          });
                        }}
                        options={[
                          { label: 'Select Employee Type', value: '' },
                          ...employeeTypeOptions
                        ]}
                        className="w-full"
                      />
                    </div>

                    {/* PERMANENT */}
                    {layoutOf(newUserForm.employmentType) === 'permanent' && (
                      <>
                        {/* Category: Direct / Deputation */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Category <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.permanentEmploymentType}
                            placeholder="Select Category"
                            onChange={(val) => setNewUserForm({ ...newUserForm, permanentEmploymentType: val as any })}
                            options={[
                              { label: 'Select Category', value: '' },
                              ...recruitmentCategoryOptions
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Cadre (fixed list) */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Cadre <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.employeeCategory}
                            placeholder="Select Cadre"
                            onChange={changeCadre}
                            options={[
                              { label: 'Select Cadre', value: '' },
                              ...withCurrent(cadreOptions, newUserForm.employeeCategory)
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
                              ...withCurrent(designationOptionsFor(newUserForm.employmentType, newUserForm.employeeCategory), newUserForm.designation)
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
                              { label: newUserForm.institute ? 'Select Department / Section / Cell' : 'Select the organization first', value: '' },
                              ...withCurrent(toOpts(departmentsFor(newUserForm.institute)), newUserForm.department)
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
                              ...withCurrent(shiftOptions, newUserForm.shiftId)
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave group */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Group <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveGroup}
                            placeholder="Select Leave Group"
                            onChange={(val) => setNewUserForm({ ...newUserForm, leaveGroup: String(val ?? '') })}
                            options={[
                              { label: 'Select Leave Group', value: '' },
                              ...leaveGroups.filter((g) => g.status === 'active').map((g) => ({ label: `${g.name} (${g.leaveYear})`, value: g.code })),
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
                              ...formManagers.map((u) => ({
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
                            value={newUserForm.reviewingManagerId}
                            placeholder="Select HoD"
                            onChange={(val) => setNewUserForm({ ...newUserForm, reviewingManagerId: val, hodName: users.find((u) => u.id === val)?.name || '' })}
                            options={[
                              { label: 'Select HoD', value: '' },
                              ...formManagers.map((u) => ({
                                label: `${u.name} (${u.designation || 'HoD'} - ${u.department || 'General'})`,
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
                    {layoutOf(newUserForm.employmentType) === 'contractual' && (
                      <>
                        {/* Cadre (fixed list) */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Cadre <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.employeeCategory}
                            placeholder="Select Cadre"
                            onChange={changeCadre}
                            options={[
                              { label: 'Select Cadre', value: '' },
                              ...withCurrent(cadreOptions, newUserForm.employeeCategory)
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
                              ...withCurrent(designationOptionsFor(newUserForm.employmentType, newUserForm.employeeCategory), newUserForm.designation)
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
                              { label: newUserForm.institute ? 'Select Department / Section / Cell' : 'Select the organization first', value: '' },
                              ...withCurrent(toOpts(departmentsFor(newUserForm.institute)), newUserForm.department)
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
                              ...withCurrent(shiftOptions, newUserForm.shiftId)
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave group */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Group <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveGroup}
                            placeholder="Select Leave Group"
                            onChange={(val) => setNewUserForm({ ...newUserForm, leaveGroup: String(val ?? '') })}
                            options={[
                              { label: 'Select Leave Group', value: '' },
                              ...leaveGroups.filter((g) => g.status === 'active').map((g) => ({ label: `${g.name} (${g.leaveYear})`, value: g.code })),
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
                              ...formManagers.map((u) => ({
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
                    {layoutOf(newUserForm.employmentType) === 'researcher' && (
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
                              ...withCurrent(designationOptionsFor(newUserForm.employmentType, newUserForm.employeeCategory), newUserForm.designation)
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
                              ...withCurrent(projectOptions, newUserForm.department)
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
                              ...withCurrent(shiftOptions, newUserForm.shiftId)
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave group */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Group <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveGroup}
                            placeholder="Select Leave Group"
                            onChange={(val) => setNewUserForm({ ...newUserForm, leaveGroup: String(val ?? '') })}
                            options={[
                              { label: 'Select Leave Group', value: '' },
                              ...leaveGroups.filter((g) => g.status === 'active').map((g) => ({ label: `${g.name} (${g.leaveYear})`, value: g.code })),
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
                              ...formManagers.map((u) => ({
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
                    {layoutOf(newUserForm.employmentType) === 'diploma_trainee' && (
                      <>
                        {/* Course */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Course <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.courseProgram}
                            placeholder="Select Course"
                            onChange={(val) => setNewUserForm({ ...newUserForm, courseProgram: val, courseBatch: val === newUserForm.courseProgram ? newUserForm.courseBatch : '' })}
                            options={[
                              { label: 'Select Course', value: '' },
                              ...withCurrent(courseOptionsFor(layoutOf(newUserForm.employmentType)), newUserForm.courseProgram)
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
                              { label: newUserForm.courseProgram ? 'Select Batch' : 'Select the course first', value: '' },
                              ...withCurrent(batchOptionsFor(layoutOf(newUserForm.employmentType), newUserForm.courseProgram), newUserForm.courseBatch)
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
                              ...withCurrent(shiftOptions, newUserForm.shiftId)
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave group */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Group <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveGroup}
                            placeholder="Select Leave Group"
                            onChange={(val) => setNewUserForm({ ...newUserForm, leaveGroup: String(val ?? '') })}
                            options={[
                              { label: 'Select Leave Group', value: '' },
                              ...leaveGroups.filter((g) => g.status === 'active').map((g) => ({ label: `${g.name} (${g.leaveYear})`, value: g.code })),
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
                              ...formManagers.map((u) => ({
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
                    {layoutOf(newUserForm.employmentType) === 'bsc_msc_student' && (
                      <>
                        {/* Course */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Course <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.courseProgram}
                            placeholder="Select Course"
                            onChange={(val) => setNewUserForm({ ...newUserForm, courseProgram: val, courseBatch: val === newUserForm.courseProgram ? newUserForm.courseBatch : '' })}
                            options={[
                              { label: 'Select Course', value: '' },
                              ...withCurrent(courseOptionsFor(layoutOf(newUserForm.employmentType)), newUserForm.courseProgram)
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
                              { label: newUserForm.courseProgram ? 'Select Batch' : 'Select the course first', value: '' },
                              ...withCurrent(batchOptionsFor(layoutOf(newUserForm.employmentType), newUserForm.courseProgram), newUserForm.courseBatch)
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
                              ...withCurrent(shiftOptions, newUserForm.shiftId)
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave group */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Group <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveGroup}
                            placeholder="Select Leave Group"
                            onChange={(val) => setNewUserForm({ ...newUserForm, leaveGroup: String(val ?? '') })}
                            options={[
                              { label: 'Select Leave Group', value: '' },
                              ...leaveGroups.filter((g) => g.status === 'active').map((g) => ({ label: `${g.name} (${g.leaveYear})`, value: g.code })),
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
                              ...formManagers.map((u) => ({
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
                    {layoutOf(newUserForm.employmentType) === 'phd_student' && (
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
                              ...withCurrent(enrollmentOptions, newUserForm.enrolledThrough)
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
                              ...withCurrent(shiftOptions, newUserForm.shiftId)
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave group */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Group <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveGroup}
                            placeholder="Select Leave Group"
                            onChange={(val) => setNewUserForm({ ...newUserForm, leaveGroup: String(val ?? '') })}
                            options={[
                              { label: 'Select Leave Group', value: '' },
                              ...leaveGroups.filter((g) => g.status === 'active').map((g) => ({ label: `${g.name} (${g.leaveYear})`, value: g.code })),
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
                              ...formManagers.map((u) => ({
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
                    {layoutOf(newUserForm.employmentType) === 'intern' && (
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
                              ...departmentsFor(newUserForm.institute).map((dept) => ({ label: `[Dept/Cell] ${dept}`, value: dept })),
                              ...projectOptions.map((o) => ({ label: `[Project] ${o.label}`, value: o.value }))
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
                              ...withCurrent(shiftOptions, newUserForm.shiftId)
                            ]}
                            className="w-full"
                          />
                        </div>

                        {/* Leave group */}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-xs">
                            Leave Group <span className="text-blue-600 font-bold ml-0.5">*</span>
                          </label>
                          <AppSelect
                            value={newUserForm.leaveGroup}
                            placeholder="Select Leave Group"
                            onChange={(val) => setNewUserForm({ ...newUserForm, leaveGroup: String(val ?? '') })}
                            options={[
                              { label: 'Select Leave Group', value: '' },
                              ...leaveGroups.filter((g) => g.status === 'active').map((g) => ({ label: `${g.name} (${g.leaveYear})`, value: g.code })),
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
                              ...formManagers.map((u) => ({
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
                <Button type="button" variant="outline" size="sm" onClick={closeEmployeeForm} disabled={savingProfile}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" loading={savingProfile} loadingText="Saving…">{editingEmployeeId ? 'Save changes' : 'Add employee'}</Button>
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
            <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
                  <KeyRound className="w-4.5 h-4.5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">{passwordResetModal.title ?? 'Password Reset Generated'}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Temporary credential generated</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordResetModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                  {passwordResetModal.note ?? 'The user must choose a new password at the next sign-in.'}
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
            <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
                  <Trash2 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">Confirm User Deletion</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Permanent account removal</p>
                </div>
              </div>
              <button
                onClick={() => { if (!deleteBusy) setUserToDelete(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for deletion <span className="text-rose-600">*</span></label>
                <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={3} maxLength={2000} required placeholder="Enter approved reason for permanently deleting this account..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Order No. (optional)</label>
                <input value={deleteReference} onChange={(e) => setDeleteReference(e.target.value)} maxLength={255} placeholder="Office order, file number, etc." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </div>
              {deleteError && <div role="alert" aria-live="assertive" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{deleteError}</div>}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteUser}
                  disabled={deleteBusy || !deleteReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteBusy ? 'Deleting…' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 6: EDIT SYSTEM & ENTERPRISE MODULE ROLES */}
      {/* ==================================================================== */}
      {userToEditRoles && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl sm:max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150">
            {/* INSTITUTIONAL HEADER */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 text-white border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 rounded-t-2xl">
              {/* User Identity */}
              <div className="flex items-center space-x-3 min-w-0">
                <div className="relative">
                  <UserAvatar name={userToEditRoles.name} src={userToEditRoles?.avatar} className="w-10 h-10 rounded-full ring-2 ring-blue-400/40 shrink-0 shadow-sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-900" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base text-white tracking-tight truncate">
                      {userToEditRoles.name}
                    </h3>
                    {(userToEditRoles.biometricId || (userToEditRoles as any).biometric_id) && <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-200 border border-blue-800/60">Biometric ID: {userToEditRoles.biometricId || (userToEditRoles as any).biometric_id}</span>}
                  </div>
                  
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setUserToEditRoles(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer hover:bg-white/10 transition-colors shrink-0"
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
                  mode={isRoleMatrixLoading ? 'view' : 'edit'}
                  systemRoles={editUserRolesState}
                  moduleRoles={editUserModuleRolesState}
                  onToggleSystemRole={handleToggleSystemRoleInMatrix}
                  onToggleModuleRole={handleToggleModuleRoleInProfile}
                />
              </div>

              {/* PINNED FIXED FOOTER */}
              <div className="px-4 sm:px-5 py-2.5 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50 z-30">
                <div className="text-[11px] text-slate-500 font-medium min-w-0">Configuring permissions for <strong className="text-slate-800">{userToEditRoles.name}</strong></div>
                <div className="flex items-center space-x-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => setUserToEditRoles(null)}>Cancel</Button>
                  <Button type="submit" variant="primary" size="sm" disabled={isRoleMatrixLoading}>Save</Button>
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
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
                  <KeyRound className="w-5 h-5 text-blue-400" />
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteResetPassword} className="p-5 space-y-4 text-xs">
              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/90 rounded-xl">
                <UserAvatar name={userToResetPasswordForm.name} src={userToResetPasswordForm?.avatar} className="w-10 h-10 rounded-full ring-2 ring-slate-200 shrink-0" />
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
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      resetPassForm.mode === 'default'
                        ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="passMode"
                      checked={resetPassForm.mode === 'default'}
                      onChange={() => setResetPassForm({ ...resetPassForm, mode: 'default' })}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[11px]">Default Password</span>
                  </label>

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
                        placeholder="Min 8 characters, a letter and a number"
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
              ) : resetPassForm.mode === 'default' ? (
                <div className="p-3 bg-blue-50 border border-blue-200/90 rounded-xl text-blue-900 text-[11px] leading-relaxed">
                  <p className="font-bold">Reset to the default password</p>
                  <p className="text-blue-800 mt-0.5">
                    The account goes back to the default password set in Master Settings → Organization. The employee must choose a new password at the next sign-in.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                  <p className="font-bold">Auto-generated temporary password</p>
                  <p className="text-amber-700 mt-0.5">
                    A random 12-character temporary password is emailed to the employee. They must choose a new password at the next sign-in.
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
                <Button type="button" variant="outline" size="sm" onClick={() => setUserToResetPasswordForm(null)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" leftIcon={KeyRound}>Reset password</Button>
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
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
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
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToToggleStatusModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteStatusChange} className="p-5 space-y-4 text-xs">
              {statusChangeError && (
                <div role="alert" aria-live="assertive" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <span className="mt-0.5 shrink-0" aria-hidden="true">⚠</span>
                  <span>{statusChangeError}</span>
                </div>
              )}
              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/90 rounded-xl">
                <UserAvatar name={userToToggleStatusModal.name} src={userToToggleStatusModal?.avatar} className="w-10 h-10 rounded-full ring-2 ring-slate-200 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-slate-900 text-sm truncate">{userToToggleStatusModal.name}</p>
                  <p className="text-[11px] text-slate-500 truncate" title={userToToggleStatusModal.email}>{userToToggleStatusModal.email || 'Email not available'}</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">Biometric ID: {userToToggleStatusModal.biometricId || 'Not available'}</p>
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
                          'Tenure End',
                          'Resignation',
                          'Return to Parent Organization',
                          'Termination',
                          'Retirement',
                          'Other'
                        ]
                      : [
                          'Tenure Extend',
                          'Rejoin',
                          'Other'
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

