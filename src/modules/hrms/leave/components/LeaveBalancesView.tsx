import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { DataTable, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { ApiError } from '../../../../shared/services/api';
import { downloadCsvText, downloadTablePdf, printedAt, toCsvText } from '../../../../shared/services/printTable';
import { NoticeBar, useNotice } from '../../master/components/masterUi';
import { BalanceList, BalanceRow, leaveApi } from '../leaveApi';
import { LeaveImportModal } from './LeaveImportModal';
import { LeaveHistoryModal } from './LeaveHistoryModal';

/**
 * Leave balances for one leave year. Used and pending days come from the requests; the
 * balances are display-only (change them through Import). A past year shows the closing balance on its last day, the current year the latest balance.
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
  const [employees, setEmployees] = useState<string[]>(['all']);
  const [departments, setDepartments] = useState<string[]>(['all']);
  const [employeeTypes, setEmployeeTypes] = useState<string[]>(['all']);
  const [cycles, setCycles] = useState<string[]>(['all']);
  const rows = data?.rows ?? [];
  const types = data?.types ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => matchesMultiSelect(employees, r.userId) && matchesMultiSelect(departments, r.department) && matchesMultiSelect(employeeTypes, r.employmentType) && matchesMultiSelect(cycles, r.basis) && (!q || [r.name, r.biometricId, r.department, r.designation].some((v) => (v || '').toLowerCase().includes(q))));
  }, [rows, search, employees, departments, employeeTypes, cycles]);
  const filtered = Boolean(search.trim()) || [employees, departments, employeeTypes, cycles].some((f) => !f.includes('all'));

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  useEffect(() => setPage(1), [visible.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice((page - 1) * pageSize, page * pageSize);

  const columns: ColumnDef<BalanceRow>[] = [
    {
      key: 'employee', header: 'Employee', width: '18%', sortValue: (r) => r.name,
      render: (r) => (
        <div className="leading-tight min-w-0">
          <div className="font-semibold text-slate-900 truncate">{r.name}</div>
          <div className="text-[11px] text-slate-500 truncate">B.I. {r.biometricId}{r.department ? ` · ${r.department}` : ''} · {r.cycle}</div>
          <div className="text-[11px] text-slate-400 truncate">Balance as on {r.asOn}</div>
        </div>
      ),
    },
    ...types.flatMap((t) => {
      const head = (label: string) => (
        <div className="leading-tight"><div>{t.code}</div><div className="text-[10px] font-medium text-slate-400">{label}</div></div>
      );
      const sub = { align: 'center' as const };
      return [
        { key: `g${t.id}`, header: head('Given'), ...sub, sortValue: (r: BalanceRow) => (r.balances[t.id]?.total ?? 0) + (r.balances[t.id]?.carryForward ?? 0),
          render: (r: BalanceRow) => { const b = r.balances[t.id]; return b && t.isDebited ? <span className="text-slate-700">{days(b.total + b.carryForward)}</span> : <span className="text-slate-300">—</span>; } },
        { key: `u${t.id}`, header: head('Used'), ...sub, sortValue: (r: BalanceRow) => r.balances[t.id]?.used ?? 0,
          render: (r: BalanceRow) => { const b = r.balances[t.id]; return b ? <span className="text-slate-700">{days(b.used)}</span> : <span className="text-slate-300">—</span>; } },
        { key: `b${t.id}`, header: head('Balance'), ...sub, sortValue: (r: BalanceRow) => r.balances[t.id]?.available ?? -1,
          render: (r: BalanceRow) => {
            const b = r.balances[t.id];
            if (!b || !t.isDebited) return <span className="text-slate-300">—</span>;
            return (
              <div className="leading-tight" title={`${t.name}: given ${days(b.total + b.carryForward)}, used ${days(b.used)}, pending ${days(b.pending)}`}>
                <div className={`font-bold ${b.available <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>{days(b.available)}</div>
                {b.pending ? <div className="text-[10px] text-slate-500 whitespace-nowrap">{days(b.pending)} pending</div> : null}
              </div>
            );
          } },
      ];
    }),
    {
      key: 'history', header: 'History', width: '70px', align: 'center' as const,
      render: (r: BalanceRow) => (
        <button type="button" onClick={() => setHistoryOf({ id: r.userId, name: r.name })} title="Year-wise leave history" aria-label={`Leave history of ${r.name}`}
          className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 cursor-pointer"><History className="w-4 h-4" /></button>
      ),
    },
  ];

  const exportHeaders = ['Biometric ID', 'Employee', 'Department', 'Leave year', 'Balance as on', ...types.flatMap((t) => [`${t.code} given`, `${t.code} used`, `${t.code} pending`, `${t.code} balance`])];
  const exportRows = () => visible.map((r) => [r.biometricId, r.name, r.department, r.cycle, r.asOn, ...types.flatMap((t) => {
    const b = r.balances[t.id];
    return b ? [b.total + b.carryForward, b.used, b.pending, b.available] : ['', '', '', ''];
  })]);
  const fileName = `WII_Leave_Balances_${year}`;

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
        search={cards ? undefined : { value: search, onChange: setSearch, placeholder: 'Search employee, department, designation…' }}
        onReset={filtered ? () => { setSearch(''); setEmployees(['all']); setDepartments(['all']); setEmployeeTypes(['all']); setCycles(['all']); } : null}
        filters={cards ? [] : [
          <MultiSelectFilter key="emp" label="Employee" options={rows.map((r) => ({ label: `${r.name} (${r.biometricId})`, value: r.userId }))} selectedValues={employees} onChange={setEmployees} />,
          <MultiSelectFilter key="dept" label="Department" options={[...new Set(rows.map((r) => r.department).filter(Boolean))].sort().map((v) => ({ label: v, value: v }))} selectedValues={departments} onChange={setDepartments} />,
          <MultiSelectFilter key="etype" label="Employee type" options={(data?.employeeTypes ?? []).map((t) => ({ label: t.name, value: t.code }))} selectedValues={employeeTypes} onChange={setEmployeeTypes} />,
          <MultiSelectFilter key="cycle" label="Leave year" options={[{ label: 'Calendar year (CY)', value: 'CY' }, { label: 'Financial year (FY)', value: 'FY' }]} selectedValues={cycles} onChange={setCycles} />,
        ]}
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
    </div>
  );
};
