import React from 'react';
import {
  Check,
  Shield
} from 'lucide-react';
import {
  UserRole,
  EnterpriseModuleId,
  MODULE_ROLE_DEFINITIONS
} from '../../../../types';

export interface RoleMatrixTableProps {
  mode: 'edit' | 'view';
  systemRoles?: UserRole[];
  moduleRoles: Record<string, string[]>;
  onToggleSystemRole?: (role: UserRole) => void;
  onToggleModuleRole?: (moduleId: string, roleId: string) => void;
}

interface ModuleColumnDef {
  id: EnterpriseModuleId;
  label: string;
  shortLabel: string;
}

// Exactly 5 module columns + 1 Role column = 6 columns
// Role | HRMS | PMS | Stock | Finance | Facility
const MODULE_COLUMNS: ModuleColumnDef[] = [
  { id: 'lams', label: 'HRMS', shortLabel: 'HRMS' },
  { id: 'pms', label: 'PMS', shortLabel: 'PMS' },
  { id: 'sims', label: 'Stock', shortLabel: 'Stock' },
  { id: 'finance', label: 'Finance', shortLabel: 'Finance' },
  { id: 'fms', label: 'Facility', shortLabel: 'Facility' }
];

interface RoleRowDef {
  tierId: 'admin' | 'l2' | 'l1' | 'staff';
  title: string;
}

const ROLE_ROWS: RoleRowDef[] = [
  {
    tierId: 'admin',
    title: 'Administrator'
  },
  {
    tierId: 'l2',
    title: 'Reviewing Officer / HoD'
  },
  {
    tierId: 'l1',
    title: 'Reporting Officer'
  },
  {
    tierId: 'staff',
    title: 'General Staff'
  }
];

interface CellRoleItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  moduleKey: string;
}

function getRolesForCell(tierId: 'admin' | 'l2' | 'l1' | 'staff', colId: EnterpriseModuleId): CellRoleItem[] {
  const defs = MODULE_ROLE_DEFINITIONS[colId] || [];

  if (tierId === 'admin') {
    const adminRoles = defs.filter((d) => d.level === 'admin');
    if (adminRoles.length > 0) {
      return adminRoles.map((r) => ({
        id: r.id,
        name: r.name,
        shortName: r.shortName || r.name,
        description: r.description,
        moduleKey: colId
      }));
    }
    return [{
      id: `${colId}_admin`,
      name: `${colId.toUpperCase()} Admin`,
      shortName: 'Admin',
      description: `Full administrative access to ${colId.toUpperCase()}`,
      moduleKey: colId
    }];
  }

  if (tierId === 'l2') {
    const l2Roles = defs.filter(
      (d) =>
        d.id === 'hrms_reviewing' ||
        d.id === 'pms_pi' ||
        d.id === 'sims_approver' ||
        d.id === 'fin_officer' ||
        d.id === 'fms_officer' ||
        d.level === 'manager'
    );
    if (l2Roles.length > 0) {
      return l2Roles.map((r) => ({
        id: r.id,
        name: r.name,
        shortName: r.shortName || r.name,
        description: r.description,
        moduleKey: colId
      }));
    }
    return [{
      id: `${colId}_reviewing`,
      name: `${colId.toUpperCase()} Reviewing Officer`,
      shortName: 'Reviewing Officer',
      description: `Reviewing Officer access for ${colId.toUpperCase()}`,
      moduleKey: colId
    }];
  }

  if (tierId === 'l1') {
    const l1Roles = defs.filter(
      (d) =>
        d.id === 'hrms_reporting' ||
        d.id === 'pms_co_pi' ||
        d.id === 'sims_store_keeper' ||
        d.id === 'fin_accountant' ||
        d.id === 'fms_supervisor'
    );
    if (l1Roles.length > 0) {
      return l1Roles.map((r) => ({
        id: r.id,
        name: r.name,
        shortName: r.shortName || r.name,
        description: r.description,
        moduleKey: colId
      }));
    }
    return [{
      id: `${colId}_reporting`,
      name: `${colId.toUpperCase()} Reporting Officer`,
      shortName: 'Reporting Officer',
      description: `Reporting Officer access for ${colId.toUpperCase()}`,
      moduleKey: colId
    }];
  }

  // Staff / Self-service
  const staffRoles = defs.filter(
    (d) =>
      d.id === 'hrms_staff' ||
      d.id === 'pms_researcher' ||
      d.id === 'sims_indenter' ||
      d.id === 'fin_claimant' ||
      d.id === 'fms_requester' ||
      d.level === 'staff'
  );
  if (staffRoles.length > 0) {
    return staffRoles.map((r) => ({
      id: r.id,
      name: r.name,
      shortName: r.shortName || r.name,
      description: r.description,
      moduleKey: colId
    }));
  }
  return [{
    id: `${colId}_staff`,
    name: `${colId.toUpperCase()} Staff`,
    shortName: 'General Staff',
    description: `Staff access for ${colId.toUpperCase()}`,
    moduleKey: colId
  }];
}

export const RoleMatrixTable: React.FC<RoleMatrixTableProps> = ({
  mode,
  systemRoles,
  moduleRoles,
  onToggleModuleRole
}) => {
  const isChecked = (cellItems: CellRoleItem[], tierId: string): boolean => {
    // If explicit module role is in moduleRoles state
    const isExplicitInModule = cellItems.some((item) => (moduleRoles[item.moduleKey] || []).includes(item.id));
    if (isExplicitInModule) return true;

    // System roles hierarchy mapping
    if (tierId === 'admin') {
      return !!systemRoles?.includes('administrator');
    }

    if (tierId === 'l2') {
      return !!(systemRoles?.includes('administrator') || systemRoles?.includes('reviewing_manager'));
    }

    if (tierId === 'l1') {
      return !!(systemRoles?.includes('administrator') || systemRoles?.includes('reviewing_manager') || systemRoles?.includes('reporting_manager'));
    }

    if (tierId === 'staff') {
      // General staff tier or higher gets general staff access
      return !!(
        systemRoles?.includes('administrator') ||
        systemRoles?.includes('reviewing_manager') ||
        systemRoles?.includes('reporting_manager') ||
        systemRoles?.includes('general_staff') ||
        !systemRoles ||
        systemRoles.length === 0
      );
    }

    return false;
  };

  const handleToggle = (cellItems: CellRoleItem[]) => {
    if (mode === 'view') return;
    if (onToggleModuleRole && cellItems.length > 0) {
      const first = cellItems[0];
      onToggleModuleRole(first.moduleKey, first.id);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
      {/* Exactly 6 Columns Table matching image.png */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[620px]">
          {/* Columns Header */}
          <thead>
            <tr className="bg-[#f8fafd] border-b border-slate-200 text-slate-900 text-xs sm:text-sm">
              {/* Column 1: Role Header */}
              <th className="p-3.5 font-bold text-slate-900 w-[220px] min-w-[200px] border-r border-slate-200 bg-[#f8fafd]">
                <div className="flex items-center space-x-2 font-bold text-slate-900">
                  <Shield className="w-4 h-4 text-indigo-600 stroke-[2.2]" />
                  <span>Role</span>
                </div>
              </th>

              {/* Columns 2-6: HRMS | PMS | Stock | Finance | Facility */}
              {MODULE_COLUMNS.map((col) => (
                <th
                  key={col.id}
                  className="p-3.5 font-bold text-center border-r border-slate-200 last:border-r-0 min-w-[90px] text-slate-900"
                >
                  <span className="whitespace-nowrap font-bold text-slate-900 text-xs sm:text-sm tracking-wide">
                    {col.shortLabel}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Rows Body */}
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
            {ROLE_ROWS.map((row) => {
              return (
                <tr
                  key={row.tierId}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  {/* Row Header: Role Title */}
                  <td className="p-3.5 bg-white border-r border-slate-200 align-middle">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                      {row.title}
                    </span>
                  </td>

                  {/* Module Cells: Only Checkbox in each cell */}
                  {MODULE_COLUMNS.map((col) => {
                    const cellRoles = getRolesForCell(row.tierId, col.id);
                    const active = isChecked(cellRoles, row.tierId);
                    const roleItem = cellRoles[0];

                    return (
                      <td
                        key={col.id}
                        onClick={() => handleToggle(cellRoles)}
                        title={roleItem ? `${roleItem.name} (${col.label}): ${roleItem.description}` : col.label}
                        className={`p-3.5 text-center border-r border-slate-100 last:border-r-0 align-middle transition-colors ${
                          mode === 'edit'
                            ? 'cursor-pointer hover:bg-emerald-50/20'
                            : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={active}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle(cellRoles);
                            }}
                            disabled={mode === 'view'}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all select-none ${
                              mode === 'edit'
                                ? 'cursor-pointer active:scale-95'
                                : 'cursor-default'
                            } ${
                              active
                                ? 'bg-[#059669] border-[#059669] text-white shadow-2xs'
                                : 'bg-white border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {active && (
                              <Check className="w-4 h-4 stroke-[3.5] text-white" />
                            )}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

