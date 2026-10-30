import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Edit3, Eye } from 'lucide-react';
import { DataTable } from '../../../../shared/components';
import { compareValues } from '../../../../shared/components/Table';
import type { ColumnDef } from '../../../../shared/components';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import type { User } from '../../../../shared/types/auth.types';

/**
 * Employee directory as a table, in the same style as the Master Settings
 * tables: navy header strip, sortable columns, paging. Which people appear and
 * which actions show is decided by the page (and enforced by the server).
 */
export interface DirectoryTableProps {
  rows: User[];
  typeLabel: (code?: string | null) => string;
  instituteName: (code?: string | null) => string;
  managerName: (id?: string | null) => string;
  onView: (u: User) => void;
  /** Administrators only. */
  onEdit?: (u: User) => void;
  onHistory?: (u: User) => void;
}

const iconButton = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 cursor-pointer transition-colors';

export const DirectoryTable: React.FC<DirectoryTableProps> = ({ rows, typeLabel, instituteName, managerName, onView, onEdit, onHistory }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => setPage(1), [rows]);

  // Sorting runs over the whole list (not just the visible page): asc -> desc -> off.
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const onSort = (key: string) => setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const columns: ColumnDef<User>[] = [
    {
      key: 'name', header: 'Employee', width: '240px', sortValue: (u) => u.name,
      render: (u) => (
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar name={u.name} src={u.avatar} className="w-9 h-9 rounded-full border border-slate-200" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 truncate">{[u.suffix, u.name].filter(Boolean).join(' ')}</p>
            <p className="text-[11px] text-slate-500">B.I. {u.biometricId || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation', header: 'Designation', width: '170px', sortValue: (u) => u.designation || u.courseProgram || '',
      render: (u) => <span className="text-[13px] text-slate-800">{u.designation || u.courseProgram || '—'}</span>,
    },
    {
      key: 'department', header: 'Department / Project', width: '190px', sortValue: (u) => u.department || '',
      render: (u) => (
        <div className="min-w-0">
          <p className="text-[13px] text-slate-800 truncate">{u.department || u.courseBatch || '—'}</p>
          <p className="text-[11px] text-slate-500 truncate">{instituteName(u.institute)}</p>
        </div>
      ),
    },
    {
      key: 'type', header: 'Employee type', width: '140px', sortValue: (u) => typeLabel(u.employmentType),
      render: (u) => <span className="text-[13px] text-slate-800">{typeLabel(u.employmentType)}</span>,
    },
    {
      key: 'manager', header: 'Reporting manager', width: '170px', sortValue: (u) => managerName(u.reportingManagerId),
      render: (u) => <span className="text-[13px] text-slate-700">{managerName(u.reportingManagerId)}</span>,
    },
    {
      key: 'status', header: 'Status', width: '110px', sortValue: (u) => u.status || 'active',
      render: (u) => (u.status === 'deactivated'
        ? <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactive</span>
        : <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-subtle px-2 py-0.5 text-[11px] font-bold text-success"><span className="w-1.5 h-1.5 rounded-full bg-success" />Active</span>),
    },
    {
      key: 'actions', header: 'Actions', width: '130px', align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" className={iconButton} onClick={() => onView(u)} title="View full profile" aria-label={`View ${u.name}`}>
            <Eye className="w-4 h-4" />
          </button>
          {onHistory && (
            <button type="button" className={iconButton} onClick={() => onHistory(u)} title="Manage project & career history" aria-label={`Career history of ${u.name}`}>
              <Briefcase className="w-4 h-4" />
            </button>
          )}
          {onEdit && (
            <button type="button" className={iconButton} onClick={() => onEdit(u)} title="Edit profile" aria-label={`Edit ${u.name}`}>
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    return [...rows].sort((a, b) => compareValues(col.sortValue!(a), col.sortValue!(b), sort.dir));
    // columns are rebuilt each render but depend only on the props below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort, typeLabel, managerName]);
  const visible = sorted.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  return (
    <DataTable
      columns={columns}
      data={visible}
      sortColumn={sort?.key}
      sortDirection={sort?.dir}
      onSort={onSort}
      keyExtractor={(u) => u.id}
      emptyTitle="No employees found"
      emptyDescription="Nothing matches the selected filters."
      pagination={rows.length > 0 ? {
        currentPage: Math.min(page, totalPages),
        totalPages,
        totalItems: rows.length,
        pageSize,
        onPageChange: setPage,
        onPageSizeChange: (n) => { setPageSize(n); setPage(1); },
        pageSizeOptions: [25, 50, 100],
      } : undefined}
    />
  );
};
