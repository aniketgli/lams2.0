import { EnterpriseModuleId, ModuleRoleDef } from './module.types';

export type UserRole = 'administrator' | 'reporting_manager' | 'reviewing_manager' | 'general_staff';

export type EmploymentType = 
  | 'permanent'
  | 'contractual'
  | 'researcher'
  | 'diploma_trainee'
  | 'intern'
  | 'bsc_msc_student'
  | 'phd_student';

export interface UserModuleRoles {
  lams?: string[];    // HRMS: 'hrms_admin' | 'hrms_reporting' | 'hrms_reviewing' | 'hrms_staff'
  pms?: string[];     // PMS: 'pms_admin' | 'pms_pi' | 'pms_co_pi' | 'pms_researcher' | 'pms_reviewer'
  sims?: string[];    // Stock/SIMS: 'sims_admin' | 'sims_store_keeper' | 'sims_approver' | 'sims_indenter'
  fms?: string[];     // Facility/FMS: 'fms_admin' | 'fms_officer' | 'fms_supervisor' | 'fms_requester'
  finance?: string[]; // Finance: 'fin_admin' | 'fin_officer' | 'fin_accountant' | 'fin_claimant'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  roles?: UserRole[];
  baseRole?: UserRole;
  employmentType: EmploymentType;
  employeeCategory?: string;
  department: string;
  designation: string;
  reportingManagerId?: string;
  reviewingManagerId?: string;
  slackHandle?: string;
  phone?: string;
  gender?: string;
  officeLocation?: string;
  joiningDate?: string;
  dob?: string;
  isOnProbation?: boolean;
  probationEndDate?: string;
  validUntilDate?: string;
  piName?: string;
  hodName?: string;
  courseProgram?: string;
  courseBatch?: string;
  guideSupervisor?: string;
  enrollmentNo?: string;
  universityName?: string;
  // Dual Status for Researchers doing PhD
  isPhDEnrolled?: boolean;
  phdUniversity?: string;
  phdGuide?: string;
  phdTopic?: string;
  phdRegistrationDate?: string;
  // Trainee / Intern fields
  internshipDuration?: string;
  parentInstitution?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  biometricId?: string;
  bio?: string;
  shiftId?: string; // ID of assigned Shift (falls back to default shift)
  leaveCycle?: 'CY' | 'FY'; // Cadre-specific Leave Accounting Cycle ('CY' for Calendar Year, 'FY' for Financial Year)
  leaveCycleBasis?: 'calendar_year' | 'financial_year'; // Descriptive basis for leave cycle
  status?: 'active' | 'deactivated';
  leaveBalances: Record<string, { total: number; used: number; pending: number; carryForward?: number }>;
  yearlyLeaveBalances?: Record<string, Record<string, { total: number; used: number; pending: number; carryForward?: number }>>;
  moduleRoles?: UserModuleRoles;
}

export const MODULE_ROLE_DEFINITIONS: Record<EnterpriseModuleId, ModuleRoleDef[]> = {
  lams: [
    {
      id: 'hrms_admin',
      name: 'HRMS Administrator',
      shortName: 'HR Admin',
      description: 'Full administrative control over HR policies, shifts, biometrics, regularization and leave quotas.',
      moduleId: 'lams',
      color: 'purple',
      badgeBg: 'bg-purple-100 border-purple-300',
      badgeText: 'text-purple-800',
      level: 'admin'
    },
    {
      id: 'hrms_reporting',
      name: 'Reporting Officer (L1)',
      shortName: 'L1 Manager',
      description: 'First-level approver for team member leave applications, manual attendance, and outdoor duty.',
      moduleId: 'lams',
      color: 'blue',
      badgeBg: 'bg-blue-100 border-blue-300',
      badgeText: 'text-blue-800',
      level: 'manager'
    },
    {
      id: 'hrms_reviewing',
      name: 'Reviewing Officer / HoD (L2)',
      shortName: 'HoD / L2 Reviewer',
      description: 'Second-level reviewing authority, departmental head approval for extended leaves and special permissions.',
      moduleId: 'lams',
      color: 'amber',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-800',
      level: 'manager'
    },
    {
      id: 'hrms_staff',
      name: 'General Staff / Employee',
      shortName: 'HR Staff',
      description: 'Self-service access to attendance punch, leave application, outdoor duty, and profile records.',
      moduleId: 'lams',
      color: 'emerald',
      badgeBg: 'bg-emerald-100 border-emerald-300',
      badgeText: 'text-emerald-800',
      level: 'staff'
    }
  ],
  pms: [
    {
      id: 'pms_admin',
      name: 'PMS Administrator / Dean R&D',
      shortName: 'PMS Admin',
      description: 'Full oversight of all institutional research projects, funding agencies, and master grant accounts.',
      moduleId: 'pms',
      color: 'teal',
      badgeBg: 'bg-teal-100 border-teal-300',
      badgeText: 'text-teal-800',
      level: 'admin'
    },
    {
      id: 'pms_pi',
      name: 'Principal Investigator (PI)',
      shortName: 'Project PI',
      description: 'Lead researcher with full control over project milestones, budget spending, and timesheet approvals.',
      moduleId: 'pms',
      color: 'indigo',
      badgeBg: 'bg-indigo-100 border-indigo-300',
      badgeText: 'text-indigo-800',
      level: 'manager'
    },
    {
      id: 'pms_co_pi',
      name: 'Co-Principal Investigator (Co-PI)',
      shortName: 'Co-PI',
      description: 'Project co-lead managing task allocations, interim technical deliverables, and research protocols.',
      moduleId: 'pms',
      color: 'sky',
      badgeBg: 'bg-sky-100 border-sky-300',
      badgeText: 'text-sky-800',
      level: 'manager'
    },
    {
      id: 'pms_researcher',
      name: 'Research Fellow / Staff',
      shortName: 'Researcher',
      description: 'Logs research timesheets, uploads fieldwork deliverables, reports milestone progress.',
      moduleId: 'pms',
      color: 'emerald',
      badgeBg: 'bg-emerald-100 border-emerald-300',
      badgeText: 'text-emerald-800',
      level: 'staff'
    },
    {
      id: 'pms_reviewer',
      name: 'Project Reviewer / Auditor',
      shortName: 'Auditor',
      description: 'External or internal technical committee member with audit and evaluation permissions.',
      moduleId: 'pms',
      color: 'slate',
      badgeBg: 'bg-slate-100 border-slate-300',
      badgeText: 'text-slate-800',
      level: 'staff'
    }
  ],
  sims: [
    {
      id: 'sims_admin',
      name: 'Store Administrator / Purchase Officer',
      shortName: 'Store Admin',
      description: 'Manages master item catalog, vendor procurement policies, inventory thresholds, and asset disposals.',
      moduleId: 'sims',
      color: 'emerald',
      badgeBg: 'bg-emerald-100 border-emerald-300',
      badgeText: 'text-emerald-800',
      level: 'admin'
    },
    {
      id: 'sims_store_keeper',
      name: 'Store Keeper / Custodian',
      shortName: 'Store Keeper',
      description: 'Physical inventory custody, goods inwards receipt, physical stock dispatch, and return verification.',
      moduleId: 'sims',
      color: 'amber',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-800',
      level: 'manager'
    },
    {
      id: 'sims_approver',
      name: 'Department Indent Approver',
      shortName: 'Indent Approver',
      description: 'Reviews and authorizes departmental material indents and laboratory consumable requisitions.',
      moduleId: 'sims',
      color: 'blue',
      badgeBg: 'bg-blue-100 border-blue-300',
      badgeText: 'text-blue-800',
      level: 'manager'
    },
    {
      id: 'sims_indenter',
      name: 'Indenter / General Staff',
      shortName: 'Indenter',
      description: 'Raises stock indents, requests lab supplies and field equipment, submits return entries.',
      moduleId: 'sims',
      color: 'slate',
      badgeBg: 'bg-slate-100 border-slate-300',
      badgeText: 'text-slate-800',
      level: 'staff'
    }
  ],
  fms: [
    {
      id: 'fms_admin',
      name: 'Facility & Fleet Administrator',
      shortName: 'Fleet Admin',
      description: 'Controls master campus estate, vehicle inventory, maintenance schedules, and reservation policies.',
      moduleId: 'fms',
      color: 'orange',
      badgeBg: 'bg-orange-100 border-orange-300',
      badgeText: 'text-orange-800',
      level: 'admin'
    },
    {
      id: 'fms_officer',
      name: 'Estate / Transport Officer',
      shortName: 'Transport Officer',
      description: 'Assigns official vehicles, designates drivers, approves guest house and seminar hall bookings.',
      moduleId: 'fms',
      color: 'blue',
      badgeBg: 'bg-blue-100 border-blue-300',
      badgeText: 'text-blue-800',
      level: 'manager'
    },
    {
      id: 'fms_supervisor',
      name: 'Driver / Facility Supervisor',
      shortName: 'Supervisor / Driver',
      description: 'Fills vehicle log sheets, logs fuel receipts, records facility maintenance and room turnovers.',
      moduleId: 'fms',
      color: 'amber',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-800',
      level: 'staff'
    },
    {
      id: 'fms_requester',
      name: 'Booking Requester / Staff',
      shortName: 'Requester',
      description: 'Submits requisitions for field vehicles, conference halls, and guest house room allotments.',
      moduleId: 'fms',
      color: 'slate',
      badgeBg: 'bg-slate-100 border-slate-300',
      badgeText: 'text-slate-800',
      level: 'staff'
    }
  ],
  finance: [
    {
      id: 'fin_admin',
      name: 'Finance Comptroller / Finance Officer',
      shortName: 'Finance Admin',
      description: 'Full control over institutional budget heads, financial year closures, and grant ledger allocations.',
      moduleId: 'finance',
      color: 'purple',
      badgeBg: 'bg-purple-100 border-purple-300',
      badgeText: 'text-purple-800',
      level: 'admin'
    },
    {
      id: 'fin_officer',
      name: 'Drawing & Disbursing Officer (DDO)',
      shortName: 'DDO / Officer',
      description: 'Authorizes payment sanctions, approves TA/DA claim settlements, signs off expenditure vouchers.',
      moduleId: 'finance',
      color: 'indigo',
      badgeBg: 'bg-indigo-100 border-indigo-300',
      badgeText: 'text-indigo-800',
      level: 'manager'
    },
    {
      id: 'fin_accountant',
      name: 'Accountant / Cashier',
      shortName: 'Accountant',
      description: 'Scrutinizes TA/DA vouchers, processes payroll releases, issues receipts, records ledger entries.',
      moduleId: 'finance',
      color: 'blue',
      badgeBg: 'bg-blue-100 border-blue-300',
      badgeText: 'text-blue-800',
      level: 'staff'
    },
    {
      id: 'fin_claimant',
      name: 'Claimant / General Staff',
      shortName: 'Claimant',
      description: 'Applies for TA/DA advances, submits travel reimbursement claims, and tracks settlement status.',
      moduleId: 'finance',
      color: 'slate',
      badgeBg: 'bg-slate-100 border-slate-300',
      badgeText: 'text-slate-800',
      level: 'staff'
    }
  ]
};

export const getUserModuleRoles = (user?: Partial<User> | null, moduleId?: EnterpriseModuleId): string[] => {
  if (!user) return ['hrms_staff'];
  
  if (user.moduleRoles && moduleId && user.moduleRoles[moduleId]) {
    const assigned = user.moduleRoles[moduleId];
    if (assigned && assigned.length > 0) return assigned;
  }

  const legacyRole = user.role || 'general_staff';
  if (legacyRole === 'administrator') {
    if (moduleId === 'pms') return ['pms_admin', 'pms_pi'];
    if (moduleId === 'sims') return ['sims_admin', 'sims_approver'];
    if (moduleId === 'fms') return ['fms_admin', 'fms_officer'];
    if (moduleId === 'finance') return ['fin_admin', 'fin_officer'];
    return ['hrms_admin', 'hrms_reviewing'];
  }

  if (legacyRole === 'reviewing_manager') {
    if (moduleId === 'pms') return ['pms_pi'];
    if (moduleId === 'sims') return ['sims_approver', 'sims_indenter'];
    if (moduleId === 'fms') return ['fms_officer', 'fms_requester'];
    if (moduleId === 'finance') return ['fin_officer', 'fin_claimant'];
    return ['hrms_reviewing', 'hrms_reporting'];
  }

  if (legacyRole === 'reporting_manager') {
    if (moduleId === 'pms') return ['pms_pi', 'pms_co_pi'];
    if (moduleId === 'sims') return ['sims_approver', 'sims_indenter'];
    if (moduleId === 'fms') return ['fms_requester'];
    if (moduleId === 'finance') return ['fin_claimant'];
    return ['hrms_reporting', 'hrms_staff'];
  }

  if (moduleId === 'pms') return ['pms_researcher'];
  if (moduleId === 'sims') return ['sims_indenter'];
  if (moduleId === 'fms') return ['fms_requester'];
  if (moduleId === 'finance') return ['fin_claimant'];
  return ['hrms_staff'];
};

export const userHasModuleRole = (user: Partial<User> | null | undefined, moduleId: EnterpriseModuleId, roleId: string): boolean => {
  if (!user) return false;
  if (user.role === 'administrator') return true;
  const roles = getUserModuleRoles(user, moduleId);
  return roles.includes(roleId);
};

export const getUserRoles = (user?: Partial<User> | null): UserRole[] => {
  if (!user) return ['general_staff'];
  if (user.roles && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  return ['general_staff'];
};

export const userHasRole = (user?: Partial<User> | null, targetRole?: UserRole): boolean => {
  if (!user || !targetRole) return false;
  const userRoles = getUserRoles(user);
  return userRoles.includes(targetRole);
};
