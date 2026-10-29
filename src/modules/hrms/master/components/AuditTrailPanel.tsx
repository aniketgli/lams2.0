import React, { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Search } from 'lucide-react';
import { Button, DataTable, DatePicker, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { AuditQuery, AuditRow, MasterCatalog, fetchAudit } from '../masterApi';
import { PanelCard, formatDateTime } from './masterUi';

/** Every create / update / status change / delete across all masters. */

const ACTION_STYLE: Record<AuditRow['action'], { label: string; cls: string }> = {
  CREATE: { label: 'Created', cls: 'bg-success-subtle text-success border-success-border' },
  UPDATE: { label: 'Updated', cls: 'bg-primary-subtle text-primary border-primary-border' },
  STATUS: { label: 'Status changed', cls: 'bg-warning-subtle text-warning border-warning-border' },
  DELETE: { label: 'Deleted', cls: 'bg-error-subtle text-error border-error-border' },
};

const ROLE_LABEL: Record<string, string> = {
  administrator: 'Administrator', audit: 'Auditor', reviewing_manager: 'HoD', reporting_manager: 'Reporting Manager', general_staff: 'User',
};

const EMPTY: AuditQuery = { master: '', action: '', from: '', to: '', search: '', page: 1, pageSize: 25 };

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const AuditTrailPanel: React.FC<{ catalog: MasterCatalog }> = ({ catalog }) => {
  const [query, setQuery] = useState<AuditQuery>(EMPTY);
  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const load = useCallback(async (q: AuditQuery) => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await fetchAudit(q);
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit trail.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(query); }, [load, query]);

  // Search applies after typing stops.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery((q) => (q.search === searchText ? q : { ...q, search: searchText, page: 1 })), 400);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const update = (patch: Partial<AuditQuery>) => setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 1 }));
  const masterLabel = (key: string) => catalog.auditMasters[key] ?? key;

  const columns: ColumnDef<AuditRow>[] = [
    { key: 'at', header: 'When', width: '15%', render: (r) => <span className="text-slate-600 whitespace-nowrap">{formatDateTime(r.at)}</span> },
    { key: 'master', header: 'Master', width: '14%', render: (r) => <span className="text-slate-700">{masterLabel(r.master)}</span> },
    { key: 'record', header: 'Record', render: (r) => <span className="font-semibold text-slate-900">{r.recordLabel || r.recordId}</span> },
    {
      key: 'action', header: 'Action', width: '12%',
      render: (r) => <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTION_STYLE[r.action]?.cls ?? ''}`}>{ACTION_STYLE[r.action]?.label ?? r.action}</span>,
    },
    { key: 'fields', header: 'Changed', render: (r) => <span className="text-[11px] text-slate-600">{r.changedFields.length ? r.changedFields.join(', ') : '—'}</span> },
    {
      key: 'actor', header: 'By', width: '16%',
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-800">{r.actor.name || '—'}</div>
          <div className="text-[11px] text-slate-500">{r.actor.biometricId ? `B.I. ${r.actor.biometricId}` : ''}{r.actor.role ? ` · ${ROLE_LABEL[r.actor.role] ?? r.actor.role}` : ''}</div>
        </div>
      ),
    },
    { key: 'view', header: '', width: '70px', align: 'right', render: (r) => <Button variant="link" size="xs" onClick={() => setDetail(r)}>Details</Button> },
  ];

  const pages = Math.max(1, Math.ceil(total / (query.pageSize ?? 25)));
  const filtersActive = Boolean(query.master || query.action || query.from || query.to || query.search);
  const detailKeys = detail ? [...new Set([...Object.keys(detail.before ?? {}), ...Object.keys(detail.after ?? {})])] : [];

  return (
    <PanelCard
      title={<><History className="w-4 h-4 text-primary" />Audit Trail</>}
      description="Every change made in Master Settings: who changed what, when, and in which role."
      count={total}
      actions={filtersActive && <Button variant="outline" size="sm" leftIcon={RotateCcw} onClick={() => { setSearchText(''); setQuery(EMPTY); }}>Clear filters</Button>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <Input aria-label="Search" placeholder="Search record, person or reason" leftIcon={Search} value={searchText}
          onChange={(e) => setSearchText(e.target.value)} containerClassName="lg:col-span-2" />
        <Select value={query.master ?? ''} onChange={(v: string) => update({ master: v })} placeholder="All masters"
          options={[{ label: 'All masters', value: '' }, ...Object.entries(catalog.auditMasters).sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value }))]} />
        <Select value={query.action ?? ''} onChange={(v: string) => update({ action: v })} placeholder="All actions"
          options={[{ label: 'All actions', value: '' }, ...Object.entries(ACTION_STYLE).map(([value, s]) => ({ label: s.label, value }))]} />
        <div className="grid grid-cols-2 gap-2">
          <DatePicker value={query.from ?? ''} onChange={(v) => update({ from: v })} placeholder="From" maxDate={query.to || undefined} />
          <DatePicker value={query.to ?? ''} onChange={(v) => update({ to: v })} placeholder="To" minDate={query.from || undefined} />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        keyExtractor={(r) => r.id}
        emptyTitle={filtersActive ? 'No changes match these filters' : 'No changes recorded yet'}
        emptyDescription={filtersActive ? 'Try clearing a filter.' : 'Changes to any master will appear here.'}
        pagination={total > (query.pageSize ?? 25) ? {
          currentPage: query.page ?? 1,
          totalPages: pages,
          totalItems: total,
          pageSize: query.pageSize ?? 25,
          onPageChange: (page) => update({ page }),
          onPageSizeChange: (pageSize) => update({ pageSize }),
          pageSizeOptions: [25, 50, 100],
        } : undefined}
      />

      <Modal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        size="lg"
        title={detail ? `${ACTION_STYLE[detail.action]?.label ?? detail.action}: ${detail.recordLabel || detail.recordId}` : ''}
        subtitle={detail ? `${masterLabel(detail.master)} · ${formatDateTime(detail.at)} · ${detail.actor.name || 'Unknown'}${detail.actor.biometricId ? ` (B.I. ${detail.actor.biometricId})` : ''}` : ''}
      >
        {detail && (
          <div className="space-y-3">
            {detail.reason && <p className="text-xs text-slate-700"><span className="font-semibold">Reason:</span> {detail.reason}</p>}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 w-1/4">Field</th>
                    <th className="text-left font-semibold px-3 py-2">Before</th>
                    <th className="text-left font-semibold px-3 py-2">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailKeys.map((key) => {
                    const changed = detail.changedFields.includes(key) || detail.action === 'CREATE' || detail.action === 'DELETE';
                    return (
                      <tr key={key} className={detail.changedFields.includes(key) ? 'bg-warning-subtle/50' : ''}>
                        <td className="px-3 py-2 font-semibold text-slate-700">{key}</td>
                        <td className={`px-3 py-2 break-all ${changed ? 'text-slate-800' : 'text-slate-500'}`}>{show(detail.before?.[key])}</td>
                        <td className={`px-3 py-2 break-all ${changed ? 'text-slate-800' : 'text-slate-500'}`}>{show(detail.after?.[key])}</td>
                      </tr>
                    );
                  })}
                  {detailKeys.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">No field details were recorded for this change.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </PanelCard>
  );
};
