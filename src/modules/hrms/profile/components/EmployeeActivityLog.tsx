import React, { useCallback, useEffect, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import { Button, DataTable, Input, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { ActivityQuery, ActivityRow, auditorApi } from '../employeeApi';

/**
 * Auditor: who did what to employee records — profiles created, changed,
 * deactivated or deleted, roles changed, passwords reset, photos changed and
 * data downloaded. Read-only; the CSV export uses the same filters and is
 * itself logged by the server.
 */

const AREAS = [
  { value: 'all', label: 'All areas' },
  { value: 'employee', label: 'Employee profile' },
  { value: 'user_roles', label: 'Module roles' },
  { value: 'employee_password', label: 'Password' },
  { value: 'employee_photo', label: 'Profile photo' },
  { value: 'employee_export', label: 'Data download' },
];
const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.value, a.label]));

const ACTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'CREATE', label: 'Created' },
  { value: 'UPDATE', label: 'Changed' },
  { value: 'STATUS', label: 'Activated / deactivated' },
  { value: 'DELETE', label: 'Deleted' },
  { value: 'RESET', label: 'Password reset' },
  { value: 'EXPORT', label: 'Downloaded' },
];
const ACTION_LABEL: Record<string, string> = Object.fromEntries(ACTIONS.map((a) => [a.value, a.label]));
const ACTION_TONE: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  STATUS: 'bg-amber-50 text-amber-800 border-amber-200',
  DELETE: 'bg-error-subtle text-error border-error-border',
  RESET: 'bg-violet-50 text-violet-700 border-violet-200',
  EXPORT: 'bg-slate-100 text-slate-700 border-slate-200',
};

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** "field: old → new" lines for one entry. */
function changeLines(row: ActivityRow): string[] {
  if (row.action === 'UPDATE' || row.action === 'STATUS') {
    const keys = row.changedFields.length ? row.changedFields : Object.keys(row.after ?? {});
    return keys.map((k) => `${k}: ${show(row.before?.[k])} → ${show(row.after?.[k])}`);
  }
  const data = row.action === 'DELETE' ? row.before : row.after;
  return Object.entries(data ?? {}).slice(0, 6).map(([k, v]) => `${k}: ${show(v)}`);
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

const EMPTY: ActivityQuery = { area: 'all', action: 'all', from: '', to: '', search: '' };

/** What the server receives: 'all' means no filter. */
const toQuery = (q: ActivityQuery): ActivityQuery => ({ ...q, area: q.area === 'all' ? '' : q.area, action: q.action === 'all' ? '' : q.action });

const ROLE_LABEL: Record<string, string> = {
  administrator: 'Administrator', audit: 'Auditor', reviewing_manager: 'HoD', reporting_manager: 'Reporting Manager', general_staff: 'User',
};

export const EmployeeActivityLog: React.FC = () => {
  const [filters, setFilters] = useState<ActivityQuery>(EMPTY);
  const [applied, setApplied] = useState<ActivityQuery>(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<{ rows: ActivityRow[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditorApi.activity({ ...toQuery(applied), page, pageSize });
      setData({ rows: result.rows, total: result.total });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The activity log could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [applied, page, pageSize]);
  useEffect(() => { void load(); }, [load]);

  // Search applies after a short pause; the other filters apply at once.
  useEffect(() => {
    const t = window.setTimeout(() => { setApplied(filters); setPage(1); }, filters.search === applied.search ? 0 : 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const set = (key: keyof ActivityQuery, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = Object.values(toQuery(applied)).some(Boolean);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await auditorApi.downloadActivity(toQuery(applied));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download failed.');
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<ActivityRow>[] = [
    { key: 'at', header: 'When', width: '150px', sortValue: (r) => r.at, render: (r) => <span className="text-xs text-slate-700 whitespace-nowrap">{when(r.at)}</span> },
    {
      key: 'record', header: 'Employee / record', width: '200px', sortValue: (r) => r.recordLabel ?? r.recordId,
      render: (r) => (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{r.recordLabel ?? '—'}</p>
          <p className="text-[11px] text-slate-500">{AREA_LABEL[r.area] ?? r.area} · {r.recordId}</p>
        </div>
      ),
    },
    {
      key: 'action', header: 'Action', width: '150px', sortValue: (r) => r.action,
      render: (r) => <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${ACTION_TONE[r.action] ?? ACTION_TONE.EXPORT}`}>{ACTION_LABEL[r.action] ?? r.action}</span>,
    },
    {
      key: 'changes', header: 'Details',
      render: (r) => {
        const lines = changeLines(r);
        return (
          <div className="text-xs text-slate-700 space-y-0.5 max-w-[520px]">
            {lines.length ? lines.map((l, i) => <p key={i} className="break-words">{l}</p>) : <p className="text-slate-400">—</p>}
            {r.reason && <p className="text-slate-500">Reason: {r.reason}</p>}
          </div>
        );
      },
    },
    {
      key: 'actor', header: 'Done by', width: '170px', sortValue: (r) => r.actor.name ?? '',
      render: (r) => (
        <div>
          <p className="text-[13px] font-semibold text-slate-900">{r.actor.name ?? '—'}</p>
          <p className="text-[11px] text-slate-500">{[r.actor.biometricId && `B.I. ${r.actor.biometricId}`, r.actor.role && (ROLE_LABEL[r.actor.role] ?? r.actor.role)].filter(Boolean).join(' · ')}</p>
        </div>
      ),
    },
  ];

  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Employee activity log</h3>
          <p className="text-xs text-slate-500 mt-0.5">Every change to employee records, roles, passwords and photos, and every data download.</p>
        </div>
        <Button variant="outline" size="sm" leftIcon={Download} loading={exporting} onClick={() => void exportCsv()} disabled={data.total === 0}>
          Export CSV
        </Button>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <Input label="Search" leftIcon={Search} value={filters.search} placeholder="Employee, biometric ID, done by, reason…"
          onChange={(e) => set('search', e.target.value)} containerClassName="md:col-span-4" maxLength={100} />
        <Select label="Area" value={filters.area} options={AREAS} onChange={(v: string) => set('area', v)} containerClassName="md:col-span-2" />
        <Select label="Action" value={filters.action} options={ACTIONS} onChange={(v: string) => set('action', v)} containerClassName="md:col-span-2" />
        <div className="md:col-span-2">
          <AppDatePicker label="From" value={filters.from ?? ''} maxDate={filters.to || undefined} placeholder="Any date" onChange={(v) => set('from', v)} className="w-full" />
        </div>
        <div className="md:col-span-2">
          <AppDatePicker label="To" value={filters.to ?? ''} minDate={filters.from || undefined} placeholder="Any date" onChange={(v) => set('to', v)} className="w-full" />
        </div>
        {filtered && (
          <div className="md:col-span-12">
            <button type="button" onClick={() => setFilters(EMPTY)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" /> Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        <DataTable
          columns={columns}
          data={data.rows}
          loading={loading}
          error={error ?? undefined}
          keyExtractor={(r) => r.id}
          emptyTitle="No activity found"
          emptyDescription={filtered ? 'Nothing matches these filters.' : 'No employee changes have been recorded yet.'}
          pagination={{
            currentPage: page,
            totalPages: Math.max(1, Math.ceil(data.total / pageSize)),
            totalItems: data.total,
            pageSize,
            onPageChange: setPage,
            onPageSizeChange: (n) => { setPageSize(n); setPage(1); },
            pageSizeOptions: [25, 50, 100],
          }}
        />
      </div>
    </section>
  );
};
