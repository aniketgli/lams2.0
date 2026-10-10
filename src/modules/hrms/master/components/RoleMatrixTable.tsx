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
    title: 'HoD'
  },
  {
    tierId: 'l1',
    title: 'Reporting Manager'
  },
  {
    tierId: 'staff',
    title: 'user'
  }
];

// Direct 1-to-1 deterministic mapping of Role Tier & Module to exact Role ID
export const ROLE_MATRIX_CELL_MAP: Record<'admin' | 'l2' | 'l1' | 'staff', Record<EnterpriseModuleId, string>> = {
  admin: {
    lams: 'hrms_admin',
    pms: 'pms_admin',
    sims: 'sims_admin',
    finance: 'fin_admin',
    fms: 'fms_admin'
  },
  l2: {
    lams: 'hrms_reviewing',
    pms: 'pms_pi',
    sims: 'sims_approver',
    finance: 'fin_officer',
    fms: 'fms_officer'
  },
  l1: {
    lams: 'hrms_reporting',
    pms: 'pms_co_pi',
    sims: 'sims_store_keeper',
    finance: 'fin_accountant',
    fms: 'fms_supervisor'
  },
  staff: {
    lams: 'hrms_staff',
    pms: 'pms_researcher',
    sims: 'sims_indenter',
    finance: 'fin_claimant',
    fms: 'fms_requester'
  }
};

export const RoleMatrixTable: React.FC<RoleMatrixTableProps> = ({
  mode,
  moduleRoles,
  onToggleModuleRole
}) => {
  const handleToggle = (moduleId: EnterpriseModuleId, roleId: string) => {
    if (mode === 'view') return;
    if (onToggleModuleRole) {
      onToggleModuleRole(moduleId, roleId);
    }
  };

  const getRoleDescription = (colId: EnterpriseModuleId, roleId: string) => {
    const defs = MODULE_ROLE_DEFINITIONS[colId] || [];
    const found = defs.find((d) => d.id === roleId);
    return found ? `${found.name}: ${found.description}` : `${colId.toUpperCase()} Role`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[580px]">
          {/* Columns Header */}
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-900 text-xs sm:text-sm">
              {/* Column 1: Role Header */}
              <th className="p-3 font-bold text-slate-800 w-[180px] min-w-[160px] border-r border-slate-200 bg-slate-50/90">
                <div className="flex items-center space-x-2 font-bold text-slate-900">
                  <Shield className="w-4 h-4 text-blue-600 stroke-[2.2]" />
                  <span>Role</span>
                </div>
              </th>

              {/* Columns 2-6: HRMS | PMS | Stock | Finance | Facility */}
              {MODULE_COLUMNS.map((col) => (
                <th
                  key={col.id}
                  className="p-3 font-bold text-center border-r border-slate-200 last:border-r-0 min-w-[85px] text-slate-900"
                >
                  <span className="whitespace-nowrap font-bold text-slate-800 text-xs tracking-wide">
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
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  {/* Row Header: Role Title */}
                  <td className="p-3 bg-white border-r border-slate-200 align-middle">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                      {row.title}
                    </span>
                  </td>

                  {/* Module Cells: Direct Checkbox Toggle */}
                  {MODULE_COLUMNS.map((col) => {
                    const roleId = ROLE_MATRIX_CELL_MAP[row.tierId][col.id];
                    const active = (moduleRoles[col.id] || []).includes(roleId);
                    const desc = getRoleDescription(col.id, roleId);

                    return (
                      <td
                        key={col.id}
                        onClick={() => handleToggle(col.id, roleId)}
                        title={desc}
                        className={`p-3 text-center border-r border-slate-100 last:border-r-0 align-middle transition-colors ${
                          mode === 'edit'
                            ? 'cursor-pointer hover:bg-blue-50/30'
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
                              handleToggle(col.id, roleId);
                            }}
                            disabled={mode === 'view'}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all select-none ${
                              mode === 'edit'
                                ? 'cursor-pointer active:scale-95'
                                : 'cursor-default'
                            } ${
                              active
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
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
