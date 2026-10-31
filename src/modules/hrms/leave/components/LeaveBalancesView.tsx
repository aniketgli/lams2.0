import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Pencil } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { DataTable, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { Textarea } from '../../../../shared/components/forms/Textarea';
import { ApiError } from '../../../../shared/services/api';
import { downloadCsvText, downloadTablePdf, printedAt, toCsvText } from '../../../../shared/services/printTable';
import { NoticeBar, useNotice } from '../../master/components/masterUi';
import { BalanceList, BalanceRow, leaveApi } from '../leaveApi';
import { LeaveImportModal } from './LeaveImportModal';
import { LeaveHistoryModal } from './LeaveHistoryModal';

/**
 * Leave balances for one leave year. Used and pending days come from the requests; the
 * administrator sets the days granted (and carried forward). The server decides who sees whom.
 */

const PAGE_SIZES = [25, 50, 100];
const days = (n: number) => String(Math.round(n * 10) / 10);

export const LeaveBalancesView: React.FC<{ importSignal?: number }> = ({ importSignal = 0 }) => {
  const { currentUser } = useApp();
  const role = currentUser.role;
  const isAdmin = role === 'administrator';
  const cards = role === 'general_staff';
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<BalanceList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useNotice();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await leaveApi.balances(year));
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : 'Balances could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [year]);
  useEffect(() => { void load(); }, [load, role]);

  const [importing, setImporting] = useState(false);
  const [historyOf, setHistoryOf] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => { if (importSignal > 0 && isAdmin) setImporting(true); }, [importSignal, isAdmin]);

  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState<string[]>(['all']);
  const rows = data?.rows ?? [];
  const types = data?.types ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => matchesMultiSelect(departments, r.department) && (!q || [r.name, r.biometricId, r.department, r.designation].some((v) => (v || '').toLowerCase().includes(q))));
  }, [rows, search, departments]);
  const filtered = Boolean(search.trim()) || !departments.includes('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  useEffect(() => setPage(1), [visible.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice((page - 1) * pageSize, page * pageSize);

  // ---- Administrator sets a grant -----------------------------------------------------------------
  const [editing, setEditing] = useState<{ row: BalanceRow; typeId: string } | null>(null);
  const [total, setTotal] = useState('');
  const [carry, setCarry] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const openEdit = (row: BalanceRow, typeId: string) => {
    const b = row.balances[typeId];
    setEditing({ row, typeId });
    setTotal(String(b?.total ?? 0)); setCarry(String(b?.carryForward ?? 0)); setReason(''); setErrors({}); setMessage(null);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || saving) return;
    setSaving(true); setMessage(null);
    try {
      const result = await leaveApi.setBalance({ userId: editing.row.userId, leaveTypeId: editing.typeId, year, total: Number(total), carryForward: Number(carry || 0), reason });
      setEditing(null);
      showNotice('success', result.message);
      await load(true);
    } catch (error) {
      if (error instanceof ApiError) { setErrors(error.details ?? {}); setMessage(error.message); } else setMessage('The balance could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<BalanceRow>[] = [
    {
      key: 'employee', header: 'Employee', width: '18%', sortValue: (r) => r.name,
      render: (r) => (
        <div className="leading-tight min-w-0">
          <div className="font-semibold text-slate-900 truncate">{r.name}</div>
          <div className="text-[11px] text-slate-500 truncate">B.I. {r.biometricId}{r.department ? ` · ${r.department}` : ''} · {r.cycle}</div>
        </div>
      ),
    },
    ...types.map((t) => ({
      key: `t${t.id}`, header: t.code, align: 'center' as const, sortValue: (r: BalanceRow) => r.balances[t.id]?.available ?? -1,
      render: (r: BalanceRow) => {
        const b = r.balances[t.id];
        if (!b) return <span className="text-slate-300">—</span>;
        const cell = (
          <div className="leading-tight" title={`${t.name}: total ${days(b.total + b.carryForward)}, used ${days(b.used)}, pending ${days(b.pending)}`}>
            <div className={`font-bold ${b.available <= 0 && t.isDebited ? 'text-rose-600' : 'text-slate-900'}`}>{days(b.available)}</div>
            <div className="text-[10px] text-slate-500 whitespace-nowrap">of {days(b.total + b.carryForward)}{b.pending ? ` · ${days(b.pending)} pending` : ''}</div>
          </div>
        );
        return isAdmin ? (
          <button type="button" onClick={() => openEdit(r, t.id)} aria-label={`Set ${t.name} balance of ${r.name}`} className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-slate-50 cursor-pointer">
            {cell}<Pencil className="w-3 h-3 text-slate-300 group-hover:text-primary" />
          </button>
        ) : cell;
      },
    })),
    {
      key: 'history', header: 'History', width: '70px', align: 'center' as const,
      render: (r: BalanceRow) => (
        <button type="button" onClick={() => setHistoryOf({ id: r.userId, name: r.name })} title="Year-wise leave history" aria-label={`Leave history of ${r.name}`}
          className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 cursor-pointer"><History className="w-4 h-4" /></button>
      ),
    },
  ];

  const exportHeaders = ['Biometric ID', 'Employee', 'Department', 'Leave year', ...types.flatMap((t) => [`${t.code} total`, `${t.code} used`, `${t.code} pending`, `${t.code} available`])];
  const exportRows = () => visible.map((r) => [r.biometricId, r.name, r.department, r.cycle, ...types.flatMap((t) => {
    const b = r.balances[t.id];
    return b ? [b.total + b.carryForward, b.used, b.pending, b.available] : ['', '', '', ''];
  })]);
  const fileName = `WII_Leave_Balances_${year}`;

  const editType = editing ? types.find((t) => t.id === editing.typeId) : null;
  const mine = rows[0];

  return (
    <div className="space-y-5">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <LeaveHistoryModal userId={historyOf?.id ?? null} name={historyOf?.name ?? ''} onClose={() => setHistoryOf(null)} />
      {isAdmin && (
        <LeaveImportModal open={importing} year={year} onClose={() => setImporting(false)}
          onImported={(message) => { setImporting(false); showNotice('success', message); void load(true); }} />
      )}
      {error && <div role="alert" className="px-4 py-3 rounded-2xl border text-xs font-semibold bg-error-subtle border-error-border text-error">{error}</div>}

      <FilterToolbar
        start={(
          <div className="w-44">
            <Select value={String(year)} searchable={false} onChange={(v: string) => setYear(Number(v))}
              options={(data?.years ?? [year]).map((y) => ({ label: `CY ${y} · FY ${y}-${String(y + 1).slice(2)}`, value: String(y) }))} />
          </div>
        )}
        exports={cards ? null : {
          onCsv: () => downloadCsvText(toCsvText(exportHeaders, exportRows()), fileName),
          onPdf: () => downloadTablePdf({
            title: `Leave balances ${year}`, subtitle: [`Generated ${printedAt(new Date().toISOString())}`], headers: exportHeaders, rows: exportRows(), fileName,
            columnWidths: [6, 12, 10, 6, ...types.flatMap(() => [4, 4, 4, 4])],
          }),
          disabled: visible.length === 0,
          csvTitle: 'Download the balances shown below as CSV', pdfTitle: 'Download the balances shown below as PDF',
        }}
        search={cards ? undefined : { value: search, onChange: setSearch, placeholder: 'Search employee, department…' }}
        onReset={filtered ? () => { setSearch(''); setDepartments(['all']); } : null}
        filters={cards ? [] : [<MultiSelectFilter key="dept" label="Department" options={[...new Set(rows.map((r) => r.department).filter(Boolean))].sort().map((v) => ({ label: v, value: v }))} selectedValues={departments} onChange={setDepartments} />]}
      />

      {cards ? (
        loading ? <div className="text-xs text-slate-500 px-1">Loading…</div> : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {types.filter((t) => mine?.balances[t.id]).map((t) => {
              const b = mine!.balances[t.id]!;
              return (
                <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500 truncate" title={t.name}>{t.name} ({t.code})</p>
                  <p className={`text-2xl font-extrabold ${b.available <= 0 && t.isDebited ? 'text-rose-600' : 'text-slate-900'}`}>{days(b.available)}</p>
                  <p className="text-[11px] text-slate-500">available · total {days(b.total + b.carryForward)} · used {days(b.used)}{b.pending ? ` · ${days(b.pending)} pending` : ''}</p>
                </div>
              );
            })}
            {!types.some((t) => mine?.balances[t.id]) && <div className="col-span-full text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl p-6 text-center">No leave types apply to you yet.</div>}
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          data={pageRows}
          loading={loading}
          keyExtractor={(r) => r.userId}
          className="min-w-[900px]"
          emptyTitle={rows.length ? 'No employees match these filters' : 'No balances'}
          emptyDescription={rows.length ? 'Change the filters or search.' : types.length ? 'There are no employees to show.' : 'Add leave types in Master Settings first.'}
          pagination={{ currentPage: page, totalPages, totalItems: visible.length, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize, pageSizeOptions: PAGE_SIZES }}
        />
      )}

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        size="sm"
        title="Set leave balance"
        subtitle={editing && editType ? `${editing.row.name} · ${editType.name} · ${editing.row.cycle}` : undefined}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} disabled={saving} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button type="submit" form="balance-form" disabled={saving} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        )}
      >
        <form id="balance-form" onSubmit={save} noValidate className="space-y-4">
          {message && <NoticeBar notice={{ kind: 'error', text: message }} onClose={() => setMessage(null)} />}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Days granted" type="number" min={0} step="0.5" required value={total} error={errors.total} onChange={(e) => { setTotal(e.target.value); setErrors((x) => ({ ...x, total: '' })); }} />
            <Input label="Carried forward" type="number" min={0} step="0.5" value={carry} error={errors.carryForward} onChange={(e) => { setCarry(e.target.value); setErrors((x) => ({ ...x, carryForward: '' })); }} />
          </div>
          <Textarea label="Reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </form>
      </Modal>
    </div>
  );
};
