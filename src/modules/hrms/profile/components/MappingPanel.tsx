import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, RefreshCw, Search } from 'lucide-react';
import { ApiError } from '../../../../shared/services/api';
import { DataTable } from '../../../../shared/components/Table';
import type { ColumnDef } from '../../../../shared/components/Table';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { AppSelect } from '../../../../shared/components/AppSelect';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { Modal } from '../../../../shared/components/Modal';
import { Button } from '../../../../shared/components/Button';
import { downloadTablePdf, printedAt } from '../../../../shared/services/printTable';
import { MappingData, MappingLogQuery, MappingLogRow, MappingPerson, mappingApi } from '../mappingApi';

/**
 * Employees Mapping: the register of transfers and reporting-manager / HoD changes, plus the two orders that make them
 * (employee transfer, manager replacement). Everything is saved on the server, which validates each order and records it
 * in the audit log; this screen only collects the input and shows the register.
 */

const today = () => new Date().toISOString().slice(0, 10);

const KIND_OPTIONS = [
  { value: 'all', label: 'All orders' },
  { value: 'transfer', label: 'Employee transfer' },
  { value: 'manager_change', label: 'Manager replacement' },
];

const errorText = (e: unknown, fallback: string) => {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : fallback;
};

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold text-slate-700">{label}</label>
    {children}
    {error && <p className="text-[11px] font-semibold text-error">{error}</p>}
  </div>
);

const personOption = (p: MappingPerson) => ({ value: p.id, label: `${p.name} (${p.biometricId})` });

const Change: React.FC<{ from: string | null; to: string | null }> = ({ from, to }) => {
  if ((from ?? '') === (to ?? '')) return <span className="text-xs text-slate-500">{to || '—'}</span>;
  return (
    <span className="text-xs">
      <span className="text-slate-500">{from || '—'}</span>
      <span className="mx-1 text-slate-400">→</span>
      <span className="font-semibold text-slate-900">{to || '—'}</span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Employee transfer
// ---------------------------------------------------------------------------

const TransferModal: React.FC<{
  open: boolean;
  data: MappingData | null;
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ open, data, onClose, onDone }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [department, setDepartment] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState('');
  const [reviewingManagerId, setReviewingManagerId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSelected([]); setSearch(''); setDeptFilter('all'); setDepartment(''); setReportingManagerId('');
    setReviewingManagerId(''); setEffectiveDate(today()); setNotes(''); setError(null); setFieldErrors({});
  }, [open]);

  const people = data?.people ?? [];
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => (deptFilter === 'all' || (p.department ?? '') === deptFilter)
      && (!q || p.name.toLowerCase().includes(q) || p.biometricId.includes(q)));
  }, [people, search, deptFilter]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.includes(p.id));

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleShown = () => setSelected((s) => (allShownSelected ? s.filter((id) => !shown.some((p) => p.id === id)) : [...new Set([...s, ...shown.map((p) => p.id)])]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});
    try {
      const result = await mappingApi.transfer({
        userIds: selected,
        department: department || undefined,
        reportingManagerId: reportingManagerId || undefined,
        reviewingManagerId: reviewingManagerId || undefined,
        effectiveDate,
        notes: notes.trim() || undefined,
      });
      onDone(result.message);
    } catch (err) {
      setError(errorText(err, 'The transfer could not be saved.'));
      if (err instanceof ApiError && err.details) setFieldErrors(err.details);
    } finally {
      setBusy(false);
    }
  };

  const departments = (data?.departments ?? []).map((d) => ({ value: d.name, label: d.name }));
  const deptFilterOptions = [{ value: 'all', label: 'All departments' }, ...[...new Set(people.map((p) => p.department).filter(Boolean) as string[])].sort().map((d) => ({ value: d, label: d }))];

  return (
    <Modal
      isOpen={open}
      onClose={busy ? () => undefined : onClose}
      size="xl"
      icon={ArrowLeftRight}
      title="Employee Transfer"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" form="mapping-transfer-form" loading={busy}>
            {selected.length > 1 ? `Transfer ${selected.length} employees` : 'Transfer'}
          </Button>
        </div>
      )}
    >
      <form id="mapping-transfer-form" onSubmit={(e) => void submit(e)} className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2.5 min-w-0">
          <Field label={`Employees (${selected.length} selected)`} error={fieldErrors.userIds}>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or biometric ID"
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <AppSelect value={deptFilter} options={deptFilterOptions} onChange={setDeptFilter} searchable />
            </div>
          </Field>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 px-1 cursor-pointer">
            <input type="checkbox" checked={allShownSelected} onChange={toggleShown} />
            Select all shown ({shown.length})
          </label>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {shown.length === 0 && <p className="p-4 text-xs text-slate-500 text-center">No employees found.</p>}
            {shown.map((p) => (
              <label key={p.id} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" className="mt-1" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-900 truncate">{p.name} <span className="text-slate-500 font-medium">({p.biometricId})</span></span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {[p.department || 'No department', p.reportingManagerId && `RM: ${nameOf.get(p.reportingManagerId) ?? '—'}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3.5 min-w-0">
          <Field label="New department" error={fieldErrors.department}>
            <AppSelect value={department} options={departments} onChange={setDepartment} placeholder="Keep current department" searchable />
          </Field>
          <Field label="New reporting manager" error={fieldErrors.reportingManagerId}>
            <AppSelect value={reportingManagerId} options={people.map(personOption)} onChange={setReportingManagerId} placeholder="Keep current reporting manager" searchable />
          </Field>
          <Field label="New HoD" error={fieldErrors.reviewingManagerId}>
            <AppSelect value={reviewingManagerId} options={people.map(personOption)} onChange={setReviewingManagerId} placeholder="Keep current HoD" searchable />
          </Field>
          <Field label="Effective date" error={fieldErrors.effectiveDate}>
            <AppDatePicker value={effectiveDate} maxDate={today()} onChange={setEffectiveDate} className="w-full" />
          </Field>
          <Field label="Order reference / remarks" error={fieldErrors.notes}>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Order number, reason…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          {error && <p className="rounded-xl border border-error-border bg-error-subtle px-3 py-2 text-xs font-semibold text-error">{error}</p>}
        </div>
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Manager replacement
// ---------------------------------------------------------------------------

const SCOPES = [
  { value: 'both', label: 'Reporting manager and HoD' },
  { value: 'reporting', label: 'Reporting manager only' },
  { value: 'reviewing', label: 'HoD only' },
];

const ReplaceModal: React.FC<{
  open: boolean;
  data: MappingData | null;
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ open, data, onClose, onDone }) => {
  const [outgoing, setOutgoing] = useState('');
  const [incoming, setIncoming] = useState('');
  const [scope, setScope] = useState<'reporting' | 'reviewing' | 'both'>('both');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setOutgoing(''); setIncoming(''); setScope('both'); setExcluded([]); setEffectiveDate(today()); setNotes(''); setError(null); setFieldErrors({});
  }, [open]);
  useEffect(() => setExcluded([]), [outgoing, scope]);

  const people = data?.people ?? [];
  // Only people who manage someone else can be replaced.
  const managers = useMemo(() => {
    const ids = new Set<string>();
    for (const p of people) {
      if (p.reportingManagerId && p.reportingManagerId !== p.id) ids.add(p.reportingManagerId);
      if (p.reviewingManagerId && p.reviewingManagerId !== p.id) ids.add(p.reviewingManagerId);
    }
    return people.filter((p) => ids.has(p.id));
  }, [people]);
  const reportees = useMemo(() => people.filter((p) => p.id !== outgoing && outgoing
    && ((scope !== 'reviewing' && p.reportingManagerId === outgoing) || (scope !== 'reporting' && p.reviewingManagerId === outgoing))), [people, outgoing, scope]);
  const chosen = reportees.filter((p) => !excluded.includes(p.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});
    try {
      const result = await mappingApi.replaceManager({
        outgoingManagerId: outgoing, incomingManagerId: incoming, scope,
        // Sending the list only when someone is left out keeps "all reportees" meaning all.
        userIds: excluded.length ? chosen.map((p) => p.id) : [],
        effectiveDate, notes: notes.trim() || undefined,
      });
      onDone(result.message);
    } catch (err) {
      setError(errorText(err, 'The change could not be saved.'));
      if (err instanceof ApiError && err.details) setFieldErrors(err.details);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={busy ? () => undefined : onClose}
      size="lg"
      icon={RefreshCw}
      title="Manager Replacement"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" form="mapping-replace-form" loading={busy} disabled={!chosen.length}>
            {chosen.length ? `Reassign ${chosen.length} employee${chosen.length === 1 ? '' : 's'}` : 'Reassign'}
          </Button>
        </div>
      )}
    >
      <form id="mapping-replace-form" onSubmit={(e) => void submit(e)} className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Outgoing manager" error={fieldErrors.outgoingManagerId}>
            <AppSelect value={outgoing} options={managers.map(personOption)} onChange={setOutgoing} placeholder="Select outgoing manager" searchable />
          </Field>
          <Field label="Incoming manager" error={fieldErrors.incomingManagerId}>
            <AppSelect value={incoming} options={people.filter((p) => p.id !== outgoing).map(personOption)} onChange={setIncoming} placeholder="Select incoming manager" searchable />
          </Field>
          <Field label="Replace as" error={fieldErrors.scope}>
            <AppSelect value={scope} options={SCOPES} onChange={(v) => setScope(v as typeof scope)} />
          </Field>
          <Field label="Effective date" error={fieldErrors.effectiveDate}>
            <AppDatePicker value={effectiveDate} maxDate={today()} onChange={setEffectiveDate} className="w-full" />
          </Field>
        </div>

        {outgoing && (
          <Field label={`Employees to reassign (${chosen.length} of ${reportees.length})`} error={fieldErrors.userIds}>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {reportees.length === 0 && <p className="p-4 text-xs text-slate-500 text-center">This manager has no employees for the chosen role.</p>}
              {reportees.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={!excluded.includes(p.id)} onChange={() => setExcluded((x) => (x.includes(p.id) ? x.filter((i) => i !== p.id) : [...x, p.id]))} />
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{p.name} <span className="text-slate-500 font-medium">({p.biometricId})</span></span>
                  <span className="ml-auto text-[11px] text-slate-500 truncate">{p.department}</span>
                </label>
              ))}
            </div>
          </Field>
        )}

        <Field label="Order reference / remarks" error={fieldErrors.notes}>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} placeholder="Order number, reason…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </Field>
        {error && <p className="rounded-xl border border-error-border bg-error-subtle px-3 py-2 text-xs font-semibold text-error">{error}</p>}
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// The register
// ---------------------------------------------------------------------------

const EMPTY = { kind: 'all', department: 'all', from: '', to: '', search: '' };
const toQuery = (f: typeof EMPTY): MappingLogQuery => ({
  kind: f.kind === 'all' ? '' : f.kind, department: f.department === 'all' ? '' : f.department, from: f.from, to: f.to, search: f.search.trim(),
});

export const MappingPanel: React.FC<{
  /** Only the administrator may make orders; the auditor reads the register. */
  canChange: boolean;
  /** Called after an order is saved so the employee list (departments, managers) is reloaded. */
  onChanged: () => void;
  /** Shows a short message (the page's toast). */
  notify: (message: string) => void;
}> = ({ canChange, onChanged, notify }) => {
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [rows, setRows] = useState<MappingLogRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [data, setData] = useState<MappingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [modal, setModal] = useState<'none' | 'transfer' | 'replace'>('none');

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await mappingApi.log(toQuery(applied));
      setRows(result.rows); setTruncated(result.truncated); setError(null);
    } catch (e) {
      setError(errorText(e, 'The register could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => { void loadLog(); }, [loadLog]);

  // The page passes a new function on every render; a ref keeps the loaders stable.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const loadData = useCallback(async () => {
    try { setData(await mappingApi.data()); } catch (e) { notifyRef.current(errorText(e, 'Employees could not be loaded.')); }
  }, []);
  useEffect(() => { if (canChange) void loadData(); }, [canChange, loadData]);
  // The department filter lists the departments present in the register itself.
  const [departmentNames, setDepartmentNames] = useState<string[]>([]);
  useEffect(() => {
    if (applied.department !== 'all' || applied.kind !== 'all' || applied.search || applied.from || applied.to) return;
    setDepartmentNames([...new Set(rows.flatMap((r) => [r.prevDepartment, r.newDepartment]).filter(Boolean) as string[])].sort());
  }, [rows, applied]);

  // Search applies after a short pause; the other filters at once.
  useEffect(() => {
    const t = window.setTimeout(() => setApplied(filters), filters.search === applied.search ? 0 : 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
  const set = (key: keyof typeof EMPTY, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = Object.values(toQuery(applied)).some(Boolean);

  const done = (message: string) => {
    setModal('none');
    notify(message);
    void loadLog();
    void loadData();
    onChanged();
  };

  const exportCsv = async () => {
    setExporting('csv');
    try { await mappingApi.downloadCsv(toQuery(applied)); } catch (e) { notify(errorText(e, 'The download failed.')); } finally { setExporting(null); }
  };
  const exportPdf = async () => {
    setExporting('pdf');
    try {
      const q = toQuery(applied);
      const table = await mappingApi.forPdf(q);
      const line = [q.kind && `Type: ${KIND_OPTIONS.find((k) => k.value === q.kind)?.label}`, q.department && `Department: ${q.department}`, q.from && `From ${q.from}`, q.to && `To ${q.to}`, q.search && `Search: “${q.search}”`].filter(Boolean).join(' · ');
      downloadTablePdf({
        title: 'Employees Mapping Register',
        subtitle: [`Generated ${printedAt(table.generatedAt)}`, line || 'All transfers and manager changes'],
        headers: table.headers.map((h) => (h === 'Recorded at (UTC)' ? 'Recorded at' : h)),
        rows: table.rows.map((r) => [...r.slice(0, -1), printedAt(String(r[r.length - 1]))]),
        fileName: `WII_Employee_Mapping_Register_${table.generatedAt.slice(0, 10)}`,
        columnWidths: [8, 8, 6, 10, 8, 8, 9, 9, 7, 7, 9, 8, 8],
      });
    } catch (e) {
      notify(errorText(e, 'The PDF could not be prepared.'));
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnDef<MappingLogRow>[] = [
    { key: 'date', header: 'Effective', width: '110px', sortValue: (r) => r.effectiveDate, render: (r) => <span className="text-xs text-slate-700 whitespace-nowrap">{r.effectiveDate}</span> },
    {
      key: 'employee', header: 'Employee', width: '190px', sortValue: (r) => r.employeeName,
      render: (r) => (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{r.employeeName}</p>
          <p className="text-[11px] text-slate-500">B.I. {r.biometricId}</p>
        </div>
      ),
    },
    {
      key: 'kind', header: 'Type', width: '150px', sortValue: (r) => r.kind,
      render: (r) => (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${r.kind === 'transfer' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
          {r.kind === 'transfer' ? 'Employee transfer' : 'Manager replacement'}
        </span>
      ),
    },
    { key: 'dept', header: 'Department', sortValue: (r) => r.newDepartment ?? '', render: (r) => <Change from={r.prevDepartment} to={r.newDepartment} /> },
    { key: 'rm', header: 'Reporting manager', sortValue: (r) => r.newReportingManager ?? '', render: (r) => <Change from={r.prevReportingManager} to={r.newReportingManager} /> },
    { key: 'hod', header: 'HoD', sortValue: (r) => r.newHod ?? '', render: (r) => <Change from={r.prevHod} to={r.newHod} /> },
    { key: 'notes', header: 'Remarks', render: (r) => <span className="text-xs text-slate-600 break-words">{r.notes || '—'}</span> },
    {
      key: 'by', header: 'Authorized by', width: '150px', sortValue: (r) => r.doneBy ?? '',
      render: (r) => <span className="text-xs text-slate-700">{r.doneBy ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <FilterToolbar
        start={canChange ? (
          <>
            <Button variant="primary" size="sm" leftIcon={ArrowLeftRight} onClick={() => setModal('transfer')} disabled={!data}>Employee Transfer</Button>
            <Button variant="outline" size="sm" leftIcon={RefreshCw} onClick={() => setModal('replace')} disabled={!data}>Manager Replacement</Button>
          </>
        ) : undefined}
        exports={{
          onCsv: () => void exportCsv(), onPdf: () => void exportPdf(), busy: exporting, disabled: rows.length === 0,
          csvTitle: 'Download the filtered register as CSV (the download is logged)',
          pdfTitle: 'Download the filtered register as PDF (the download is logged)',
        }}
        search={{ value: filters.search, onChange: (v) => set('search', v), placeholder: 'Employee, biometric ID, department, manager…' }}
        onReset={filtered ? () => setFilters(EMPTY) : null}
        filters={[
          <AppSelect key="kind" value={filters.kind} options={KIND_OPTIONS} onChange={(v) => set('kind', v)} />,
          <AppSelect key="dept" value={filters.department} options={[{ value: 'all', label: 'All departments' }, ...departmentNames.map((d) => ({ value: d, label: d }))]} onChange={(v) => set('department', v)} searchable />,
          <AppDatePicker key="from" value={filters.from} maxDate={filters.to || undefined} placeholder="From date" onChange={(v) => set('from', v)} className="w-full" />,
          <AppDatePicker key="to" value={filters.to} minDate={filters.from || undefined} placeholder="To date" onChange={(v) => set('to', v)} className="w-full" />,
        ]}
      />
      {truncated && <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Only the latest 5,000 records are shown. Narrow the filters to see older ones.</p>}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error ?? undefined}
        keyExtractor={(r) => r.id}
        emptyTitle="No transfers recorded"
        emptyDescription={filtered ? 'Nothing matches these filters.' : 'Transfers and manager changes will appear here once they are made.'}
      />
      <TransferModal open={modal === 'transfer'} data={data} onClose={() => setModal('none')} onDone={done} />
      <ReplaceModal open={modal === 'replace'} data={data} onClose={() => setModal('none')} onDone={done} />
    </div>
  );
};
