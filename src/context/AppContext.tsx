import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from '../auth/SessionContext';
import { MASTERS_CHANGED_EVENT, MasterOptions, masterApi } from '../modules/hrms/master/masterApi';
import { EmployeeRow, SaveResult, employeeApi, toSaveError } from '../modules/hrms/profile/employeeApi';
import { User, EmploymentType, OutdoorDutyRequest, OrgBranding, UserModuleRoles, EmailDeliveryStatus } from '../types';
import { HolidayItem } from '../modules/hrms/holidays/data/holidayData';
import { holidayApi, toHolidayItem } from '../modules/hrms/holidays/holidayApi';

interface AppContextType {
  currentUser: User;
  users: User[];
  /** System accounts (Administrator / Auditor): for the Profiles table only, never in dropdowns, exports or other lists. */
  systemUsers: User[];
  /** Active values of every master (salutation, gender, employee type, departments, ...). */
  masterOptions: MasterOptions;
  odRequests: OutdoorDutyRequest[];

  // Admin / Profile Actions
  updateUserProfile: (userId: string, updatedFields: Partial<User>) => Promise<SaveResult>;
  addUserProfile: (newUser: Omit<User, 'id' | 'leaveBalances'>) => Promise<SaveResult>;
  reloadEmployees: () => Promise<User[] | null>;
  toggleUserStatus: (userId: string, reason?: string, effectiveDate?: string) => Promise<{ success: boolean; message?: string; temporaryPassword?: string }>;
  deleteUser: (userId: string, reason: string, reference?: string) => Promise<{ success: boolean; message?: string }>;

  // Holiday Management Actions (Admin)
  holidays: HolidayItem[];
  /** Re-reads the holiday calendar from the database (after a change on the Holiday Calendar page). */
  reloadHolidays: () => Promise<void>;

  // Organization Branding & Logo Management
  orgBranding: OrgBranding;
  updateOrgBranding: (branding: Partial<OrgBranding>) => void;

  // Logo Viewer Modal State
  isLogoViewerOpen: boolean;
  setIsLogoViewerOpen: (open: boolean) => void;

  // User Project & Career History Actions

  // Multi-Module Role Controls

  // Automated System-Wide Email Notifications & Outbox Audit
  latestEmailToast: { id: string; to: string; subject: string; status: EmailDeliveryStatus } | null;
  dismissEmailToast: () => void;

  // Profile & Department Masters
  departmentsMaster: string[];
}

const NO_OD_REQUESTS: OutdoorDutyRequest[] = [];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Profile dropdowns are hydrated from MySQL; localStorage is not an authority for master data.
  const [departmentsMaster, setDepartmentsMaster] = useState<string[]>([]);
  // Identity, modules and the active role come only from the server session.
  const { status: sessionStatus, session } = useSession();
  // While a password change is pending the server refuses every data request, so nothing is loaded.
  const isAuthenticated = sessionStatus === 'signedIn' && Boolean(session) && !session?.mustChangePassword;

  // All dropdown masters come from one server call (/api/hrms/masters/options),
  // reloaded whenever any master changes (MASTERS_CHANGED_EVENT).
  const [masterOptions, setMasterOptions] = useState<MasterOptions>({});
  useEffect(() => {
    if (!isAuthenticated || !session?.activeModule) return;
    let cancelled = false;
    const names = (key: string, opts: MasterOptions) => (opts[key] ?? []).map((r) => r.name);
    const loadMasters = async () => {
      try {
        const opts = await masterApi.options();
        if (cancelled) return;
        setMasterOptions(opts);
        setDepartmentsMaster(names('organizations', opts));
      } catch (error) {
        console.error('Unable to load masters', error);
      }
    };
    void loadMasters();
    window.addEventListener(MASTERS_CHANGED_EVENT, loadMasters);
    return () => {
      cancelled = true;
      window.removeEventListener(MASTERS_CHANGED_EVENT, loadMasters);
    };
  }, [isAuthenticated, session?.activeModule, session?.activeRole]);

  // Employee identities must come from the authenticated server/database only.
  // Never hydrate the directory from browser-local seed/demo users.
  const [users, setUsers] = useState<User[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  // The employee directory always comes from the database (GET /api/hrms/employees).
  // The server decides how much of each profile this user may see.
  const toDirectoryUser = (row: EmployeeRow): User => {
    let saved: Partial<User> = {};
    try {
      const parsed = JSON.parse(row.profileData || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Partial<User>;
    } catch {
      console.warn('Ignoring invalid profile_data for employee:', row.id);
    }
    return {
      ...saved,
      id: String(row.id),
      isSystem: row.isSystem === true,
      biometricId: row.biometricId,
      suffix: row.suffix ?? undefined,
      name: row.name,
      email: row.email,
      role: row.role,
      roles: row.roles,
      baseRole: row.role,
      employmentType: (row.employmentType || '') as EmploymentType,
      department: row.department || '',
      designation: row.designation || '',
      joiningDate: row.joiningDate ?? undefined,
      phone: row.phone ?? undefined,
      officeLocation: row.officeLocation ?? undefined,
      institute: row.institute ?? undefined,
      shiftId: row.shiftId ?? undefined,
      moduleRoles: row.moduleRoles as UserModuleRoles,
      // Photos are served by the server; old avatar values inside profile_data are ignored.
      avatar: row.photoUrl ?? '',
      status: row.status === 'active' ? 'active' : 'deactivated',
      expired: row.expired === true,
      leaveBalances: saved.leaveBalances || {},
    };
  };

  const reloadEmployees = React.useCallback(async (): Promise<User[] | null> => {
    try {
      const rows = await employeeApi.list();
      const next = Array.isArray(rows) ? rows.map(toDirectoryUser) : [];
      setUsers(next);
      employeeApi.listSystem().then((sys) => setSystemUsers(Array.isArray(sys) ? sys.map(toDirectoryUser) : [])).catch(() => setSystemUsers([]));
      return next;
    } catch (error) {
      // Never fall back to seed data for an authenticated directory.
      console.error('Employee directory load failed:', error);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void reloadEmployees();
  }, [isAuthenticated, reloadEmployees]);

  const odRequests = NO_OD_REQUESTS; // outdoor duty is served by /api/hrms/outdoor-duty; this legacy list stays empty for the placeholder Finance view

  // Organization Branding State
  const DEFAULT_ORG_BRANDING: OrgBranding = {
    orgName: 'Organization',
    logoUrl: '',
    address: 'Office Location',
    copyrightText: `© ${new Date().getFullYear()} Organization • Integrated Enterprise Suite`,
    appName: 'WII Portal',
    orgHindiName: '',
    badgeText: 'HUB',
    logoType: 'custom',
    themePrimaryColor: '#204088',
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

  // Load public organization branding as soon as the app starts. This ensures
  // first-time visitors see the configured logo before opening Master Settings.
  useEffect(() => {
    let cancelled = false;

    fetch('/api/hrms/organization', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Organization branding request failed (${response.status}).`);
        }
        return response.json();
      })
      .then((organization) => {
        if (cancelled || !organization) return;

        setOrgBranding((previous) => ({
          ...previous,
          orgName: organization.orgName || previous.orgName,
          logoUrl: organization.logoData || previous.logoUrl,
          address: organization.address || previous.address,
          copyrightText: organization.copyrightText || previous.copyrightText,
          updatedAt: organization.updatedAt || previous.updatedAt
        }));
      })
      .catch((error) => {
        // Keep the cached/default branding available if the API is temporarily unavailable.
        console.warn('Could not load organization branding during app startup:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateOrgBranding = (branding: Partial<OrgBranding>) => {
    setOrgBranding((prev) => ({
      ...prev,
      ...branding,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser ? currentUser.name : 'Administrator'
    }));
  };

  const [latestEmailToast, setLatestEmailToast] = useState<{ id: string; to: string; subject: string; status: EmailDeliveryStatus } | null>(null);

  const dismissEmailToast = () => {
    setLatestEmailToast(null);
  };

  // The server session is the identity source of truth. The directory entry
  // (loaded from /api/hrms/employees) only adds profile details for display.
  const sessionUserId = session?.user.id ?? '';
  const directoryEntry = users.find((u) => String(u.id) === sessionUserId);
  const currentUser = (session
    ? ({
        ...(directoryEntry || {}),
        id: sessionUserId,
        biometricId: session.user.biometricId,
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.photoUrl ?? '',
        role: session.activeRole ?? 'general_staff',
        roles: session.modules.find((m) => m.moduleId === 'hrms')?.roles ?? [],
        leaveBalances: directoryEntry?.leaveBalances ?? {},
      } as User)
    : undefined) as User;

  // Get attendance visible based on Role Rules:
  // Admin: ALL
  // Reporting / Reviewing Mgr: Team members reporting to them or in sub-team + themselves

  // --- OUTDOOR DUTY (OD) ACTIONS ---
  // Rules:
  // - User can Apply for self. Can Edit & Delete ONLY before approval AND before start date.
  // - Reporting Manager can Approve & Reject ONLY before approval AND before start date.
  // - Reviewing Manager: Only View (cannot approve, reject, edit, or delete).

  // --- PROFILE ACTIONS ---
  /** Saves the employee form to the database, then reloads the directory from it. */
  const updateUserProfile = async (userId: string, updatedFields: Partial<User>): Promise<SaveResult> => {
    const existing = users.find((user) => user.id === userId);
    if (!existing) return { success: false, message: 'Employee account not found.' };
    try {
      const result = await employeeApi.update(userId, { ...existing, ...updatedFields });
      const fresh = await reloadEmployees();
      return { success: true, message: result.message, user: fresh?.find((u) => u.id === userId) };
    } catch (error) {
      return toSaveError(error, 'Could not save employee changes.');
    }
  };

  const addUserProfile = async (newUser: Omit<User, 'id' | 'leaveBalances'>): Promise<SaveResult> => {
    let createdUser: User;
    let savedMessage = '';
    let temporaryPassword: string | undefined;
    try {
      const result = await employeeApi.create(newUser);
      savedMessage = result.message;
      temporaryPassword = result.temporaryPassword;
      const fresh = await reloadEmployees();
      createdUser = fresh?.find((u) => u.id === String(result.employee.id)) ?? toDirectoryUser(result.employee);
    } catch (error) {
      return toSaveError(error, 'Could not save the new employee.');
    }

    // The welcome and supervisor emails are sent by the server (server/notifications) after the account is saved.
    return { success: true, message: savedMessage || `Employee ${createdUser.name} saved.`, user: createdUser, temporaryPassword };
  };

  const toggleUserStatus = async (userId: string, reason?: string, effectiveDate?: string): Promise<{ success: boolean; message?: string; temporaryPassword?: string }> => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return { success: false, message: 'Employee account not found.' };

    const isActivating = targetUser.status === 'deactivated';
    let temporaryPassword: string | undefined;
    try {
      // The server checks responsibilities, writes users + profile + audit, and signs a deactivated user out.
      ({ temporaryPassword } = await employeeApi.setStatus(userId, isActivating ? 'active' : 'inactive', reason || '', effectiveDate || undefined));
    } catch (error) {
      return toSaveError(error, 'Unable to reach the server. Account status was not changed.');
    }

    // Show what the database now holds.
    await reloadEmployees();
    return { success: true, temporaryPassword };
  };

  const deleteUser = async (userId: string, reason: string, reference?: string): Promise<{ success: boolean; message?: string }> => {
    const existing = users.find((user) => user.id === userId);
    if (!existing) return { success: false, message: 'Employee account not found.' };
    try {
      await employeeApi.remove(userId, reason, reference || '');
    } catch (error) {
      return toSaveError(error, 'Unable to reach server. Employee account was not deleted.');
    }
    await reloadEmployees();
    return { success: true };
  };

  // The portal used to keep demo attendance, leave and OD data in the browser. Nothing reads it any more, so remove it.
  useEffect(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && /^la_hub_(seed|attendance|manual_attendance|od_requests|leave|shifts|project_histories|email|locations|slack_logs|slack_config)/.test(key)) localStorage.removeItem(key);
      }
    } catch { /* storage unavailable */ }
  }, []);

  // Holiday calendar: always from the database (GET /api/hrms/holidays), all years.
  // Leave, attendance and dashboards read this list; only the Holiday Calendar page changes it.
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const reloadHolidays = React.useCallback(async () => {
    try {
      const result = await holidayApi.list();
      setHolidays(result.holidays.map(toHolidayItem));
    } catch (error) {
      console.error('Holiday calendar load failed:', error);
    }
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    try { localStorage.removeItem('la_hub_holidays'); } catch { /* storage unavailable */ }
    void reloadHolidays();
  }, [isAuthenticated, reloadHolidays]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        masterOptions,
        odRequests,
        updateUserProfile,
        addUserProfile,
        reloadEmployees,
        systemUsers,
        toggleUserStatus,
        deleteUser,
        holidays,
        reloadHolidays,
        orgBranding,
        updateOrgBranding,
        isLogoViewerOpen,
        setIsLogoViewerOpen,
        latestEmailToast,
        dismissEmailToast,
        departmentsMaster
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

/** The holiday calendar from the database, or an empty list outside the provider (shared pickers use it). */
export const useCalendarHolidays = (): HolidayItem[] => useContext(AppContext)?.holidays ?? [];

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
