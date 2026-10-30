import React, { useCallback, useEffect, useState } from 'react';
import { DataTable } from './Table';
import { AppSelect } from './AppSelect';
import { FilterToolbar } from './FilterToolbar';
import { AppDatePicker } from './AppDatePicker';
import type { ColumnDef } from './Table';
import { printTable, printedAt } from '../services/printTable';
import type { ActivityQuery, ActivityRow, PrintableTable } from '../services/activityApi';

/**
 * Auditor activity log: who did what, when, with old → new values. Read-only.
 * Used for employee records, the holiday calendar and any other audited area;
 * each passes its own `source`. CSV and PDF downloads use the screen's filters
 * and the server records every download.
 */

export interface ActivitySource {
  /** Used in the PDF title. */
  title: string;
  /** Areas (audit keys) offered in the Area filter. */
  areas: { value: string; label: string }[];
  /** Actions offered in the Action filter (defaults to all). */
  actions?: string[];
  /** Label of the record column ("Employee / record", "Holiday"). */
  recordLabel?: string;
  searchPlaceholder?: string;
  list: (q: ActivityQuery) => Promise<{ rows: ActivityRow[]; total: number }>;
  downloadCsv: (q: ActivityQuery) => Promise<void>;
  forPdf: (q: ActivityQuery) => Promise<PrintableTable>;
}

const ALL_ACTIONS = [
  { value: 'CREATE', label: 'Created' },
  { value: 'UPDATE', label: 'Changed' },
  { value: 'STATUS', label: 'Activated / deactivated' },
  { value: 'DELETE', label: 'Deleted' },
  { value: 'RESET', label: 'Password reset' },
  { value: 'EXPORT', label: 'Downloaded' },
];
const ACTION_LABEL: Record<string, string> = Object.fromEntries(ALL_ACTIONS.map((a) => [a.value, a.label]));
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

/** `toolbarStart` sits at the left of the top row (e.g. a view switch). */
export const ActivityLogPanel: React.FC<{ source: ActivitySource; toolbarStart?: React.ReactNode }> = ({ source, toolbarStart }) => {
  const AREAS = React.useMemo(() => [{ value: 'all', label: 'All areas' }, ...source.areas], [source.areas]);
  const AREA_LABEL: Record<string, string> = React.useMemo(() => Object.fromEntries(source.areas.map((a) => [a.value, a.label])), [source.areas]);
  const ACTIONS = React.useMemo(() => [
    { value: 'all', label: 'All actions' },
    ...ALL_ACTIONS.filter((a) => !source.actions || source.actions.includes(a.value)),
  ], [source.actions]);
  const [filters, setFilters] = useState<ActivityQuery>(EMPTY);
  const [applied, setApplied] = useState<ActivityQuery>(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<{ rows: ActivityRow[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await source.list({ ...toQuery(applied), page, pageSize });
      setData({ rows: result.rows, total: result.total });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The activity log could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [applied, page, pageSize, source]);
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
    setExporting('csv');
    try {
      await source.downloadCsv(toQuery(applied));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download failed.');
    } finally {
      setExporting(null);
    }
  };

  /** Same filters as the screen; the server supplies the rows and logs the download. */
  const exportPdf = async () => {
    setExporting('pdf');
    try {
      const q = toQuery(applied);
      const table = await source.forPdf(q);
      const filterLine = [
        q.area && `Area: ${AREA_LABEL[q.area] ?? q.area}`,
        q.action && `Action: ${ACTION_LABEL[q.action] ?? q.action}`,
        q.from && `From ${q.from}`, q.to && `To ${q.to}`, q.search && `Search: “${q.search}”`,
      ].filter(Boolean).join(' · ');
      printTable({
        title: source.title,
        subtitle: [`Generated ${printedAt(table.generatedAt)}`, filterLine || 'All activity'],
        headers: table.headers,
        rows: table.rows.map((r) => [printedAt(String(r[0])), ...r.slice(1)]),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The PDF could not be prepared.');
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnDef<ActivityRow>[] = [
    { key: 'at', header: 'When', width: '150px', sortValue: (r) => r.at, render: (r) => <span className="text-xs text-slate-700 whitespace-nowrap">{when(r.at)}</span> },
    {
      key: 'record', header: source.recordLabel ?? 'Record', width: '200px', sortValue: (r) => r.recordLabel ?? r.recordId,
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
    <div className="space-y-4">
      <FilterToolbar
        start={toolbarStart}
        exports={{
          onCsv: () => void exportCsv(), onPdf: () => void exportPdf(), busy: exporting, disabled: data.total === 0,
          csvTitle: 'Download the filtered log as CSV (the download is logged)',
          pdfTitle: 'Print / save the filtered log as PDF (the download is logged)',
        }}
        search={{ value: filters.search ?? '', onChange: (v) => set('search', v), placeholder: source.searchPlaceholder ?? 'Search record, done by, reason…' }}
        onReset={filtered ? () => setFilters(EMPTY) : null}
        filters={[
          <AppSelect key="area" value={filters.area ?? 'all'} options={AREAS} onChange={(v) => set('area', v)} />,
          <AppSelect key="action" value={filters.action ?? 'all'} options={ACTIONS} onChange={(v) => set('action', v)} />,
          <AppDatePicker key="from" value={filters.from ?? ''} maxDate={filters.to || undefined} placeholder="From date" onChange={(v) => set('from', v)} className="w-full" />,
          <AppDatePicker key="to" value={filters.to ?? ''} minDate={filters.from || undefined} placeholder="To date" onChange={(v) => set('to', v)} className="w-full" />,
        ]}
      />

      <DataTable
        columns={columns}
        data={data.rows}
        loading={loading}
        error={error ?? undefined}
        keyExtractor={(r) => r.id}
        emptyTitle="No activity found"
        emptyDescription={filtered ? 'Nothing matches these filters.' : 'No changes have been recorded yet.'}
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
  );
};
