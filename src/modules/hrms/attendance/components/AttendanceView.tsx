import React, { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock, LayoutGrid, List, UserX,
} from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { DataTable } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { ApiError } from '../../../../shared/services/api';
import { downloadCsvText, downloadTablePdf, printedAt, toCsvText } from '../../../../shared/services/printTable';
import { AttendanceDay, AttendanceResponse, attendanceApi } from '../attendanceApi';

/**
 * Biometric Attendance.
 * Each day is worked out on the server from the punch log the machine software
 * fills (first punch = In, last = Out, hours against the employee's shift).
 *
 *   User                       : own attendance; status filter
 *   Reporting Manager / HoD    : own and team attendance; team filters
 *   Administrator / Auditor    : everyone; all filters
 * Everyone can download what is shown (CSV / PDF). The server enforces who sees whom.
 */

const STATUS_META: Record<AttendanceDay['status'], { label: string; pill: string; dot: string }> = {
  PP: { label: 'Present', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' },
  PA: { label: 'Half day (1st half)', pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  AP: { label: 'Half day (2nd half)', pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  AA: { label: 'Absent', pill: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-600' },
  WW: { label: 'Weekly off', pill: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  'WW#': { label: 'Worked on weekly off', pill: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-600' },
  GH: { label: 'Holiday', pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-600' },
  'HH#': { label: 'Worked on holiday', pill: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-600' },
  OD: { label: 'Outdoor duty', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-600' },
};
const STATUSES = Object.keys(STATUS_META) as AttendanceDay['status'][];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PAGE_SIZES = [25, 50, 100];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const dayName = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()] ?? '';
const hoursText = (h: number | null) => (h === null ? '—' : `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`);

const StatusPill: React.FC<{ status: AttendanceDay['status'] }> = ({ status }) => {
  const meta = STATUS_META[status];
  return (
    <span title={meta.label} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${meta.pill}`}>
      <span className="font-mono">{status}</span>
      <span className="font-semibold">{meta.label}</span>
    </span>
  );
};

type Row = AttendanceDay & { name: string; department: string; designation: string; employmentType: string; reportingManagerId: string; avatar: string };

export const AttendanceView: React.FC = () => {
  const { currentUser, users, masterOptions } = useApp();
  const role = currentUser.role;
  const isAdminOrAudit = role === 'administrator' || role === 'audit';
  const isManager = role === 'reporting_manager' || role === 'reviewing_manager';
  const teamView = isAdminOrAudit || isManager;
  const showManagerFilter = isAdminOrAudit || role === 'reviewing_manager';

  // ---- Dates and data ---------------------------------------------------------
  const today = localToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const defaultFrom = teamView ? today : monthStart;
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'month'>('table');
  // Month view shows (and loads) one whole month; the table shows the chosen dates.
  const [month, setMonth] = useState(() => (from || today).slice(0, 7));
  const monthEnd = (() => {
    const [y, m] = month.split('-').map(Number);
    return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  })();
  const start = viewMode === 'month' ? `${month}-01` : from || monthStart;
  const end = viewMode === 'month' ? (monthEnd < today ? monthEnd : today) : to || today;

  useEffect(() => {
    if (start > end) {
      setData(null);
      setError(viewMode === 'month' ? null : 'The From date must be on or before the To date.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    attendanceApi.list(start, end)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) { setData(null); setError(e instanceof ApiError ? e.message : 'Attendance could not be loaded. Please try again.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [start, end, viewMode, role]);

  const shiftByCode = useMemo(() => new Map((data?.shifts ?? []).map((s) => [s.code, s])), [data]);
  const typeName = (code: string) => (masterOptions.employeeType ?? []).find((r) => r.code === code)?.name || code;
  const userById = useMemo(() => new Map(users.map((u) => [String(u.id), u])), [users]);

  const rows = useMemo<Row[]>(() => (data?.records ?? []).map((r) => {
    const u = userById.get(r.userId);
    return {
      ...r,
      name: u?.name ?? `Biometric ${r.biometricId}`,
      department: u?.department ?? '',
      designation: u?.designation ?? '',
      employmentType: String(u?.employmentType ?? ''),
      reportingManagerId: String(u?.reportingManagerId ?? ''),
      avatar: (u as { avatar?: string } | undefined)?.avatar ?? '',
    };
  }), [data, userById]);

  // ---- Filters ------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>(['all']);
  const [employees, setEmployees] = useState<string[]>(['all']);
  const [departments, setDepartments] = useState<string[]>(['all']);
  const [designations, setDesignations] = useState<string[]>(['all']);
  const [types, setTypes] = useState<string[]>(['all']);
  const [shiftsFilter, setShiftsFilter] = useState<string[]>(['all']);
  const [managers, setManagers] = useState<string[]>(['all']);

  const distinct = (pick: (r: Row) => string) => [...new Set(rows.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filterSets = [statuses, employees, departments, designations, types, shiftsFilter, managers];
  const filtered = Boolean(search.trim()) || filterSets.some((f) => !f.includes('all')) || (viewMode === 'table' && (from !== defaultFrom || to !== today));
  const resetAll = () => {
    setSearch(''); [setStatuses, setEmployees, setDepartments, setDesignations, setTypes, setShiftsFilter, setManagers].forEach((set) => set(['all']));
    setFrom(defaultFrom); setTo(today);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      matchesMultiSelect(statuses, r.status) &&
      (!teamView || (
        matchesMultiSelect(employees, r.userId) && matchesMultiSelect(departments, r.department) &&
        matchesMultiSelect(designations, r.designation) && matchesMultiSelect(types, r.employmentType) &&
        matchesMultiSelect(shiftsFilter, r.shiftCode)
      )) &&
      (!showManagerFilter || matchesMultiSelect(managers, r.reportingManagerId)) &&
      (!q || [r.name, r.biometricId, r.department, r.designation, r.date, formatDate(r.date), dayName(r.date), r.remark, STATUS_META[r.status].label]
        .some((v) => (v || '').toLowerCase().includes(q))));
  }, [rows, search, statuses, employees, departments, designations, types, shiftsFilter, managers, teamView, showManagerFilter]);

  // ---- Sorting and pages (the whole list is sorted, then paged) ----------------------
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: teamView ? 'asc' : 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  useEffect(() => setPage(1), [visible.length, pageSize, sort]);

  // ---- Summary --------------------------------------------------------------------
  const range = start > end ? '—' : start !== end ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
  const stats = useMemo(() => ({
    present: visible.filter((r) => r.status === 'PP' || r.status === 'WW#' || r.status === 'HH#' || r.status === 'OD').length,
    half: visible.filter((r) => r.status === 'PA' || r.status === 'AP').length,
    absent: visible.filter((r) => r.status === 'AA').length,
    late: visible.filter((r) => r.lateByMins > 0).length,
  }), [visible]);
  const statCards = [
    { label: 'Present', value: stats.present, note: range, icon: CalendarCheck, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Half day', value: stats.half, note: range, icon: Clock, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Absent', value: stats.absent, note: range, icon: UserX, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: 'Late arrivals', value: stats.late, note: range, icon: AlarmClock, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  ];

  // ---- Table -----------------------------------------------------------------------
  const shiftText = (code: string) => {
    const s = shiftByCode.get(code);
    return s ? `${s.startTime}–${s.endTime}` : '';
  };
  const columns: ColumnDef<Row>[] = [
    {
      key: 'date', header: 'Date', width: teamView ? '11%' : '17%', sortValue: (r) => r.date,
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-900 whitespace-nowrap">{formatDate(r.date)}</div>
          <div className="text-[11px] text-slate-500">{dayName(r.date)}</div>
        </div>
      ),
    },
    ...(teamView ? [{
      key: 'employee', header: 'Employee', width: '22%', sortValue: (r: Row) => r.name,
      render: (r: Row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar name={r.name} src={r.avatar || null} className="w-8 h-8 rounded-full shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-slate-900 truncate">{r.name}</div>
            <div className="text-[11px] text-slate-500 truncate">B.I. {r.biometricId}{r.designation ? ` · ${r.designation}` : ''}</div>
          </div>
        </div>
      ),
    } as ColumnDef<Row>] : []),
    ...(teamView ? [{
      key: 'shift', header: 'Shift', width: '10%', sortValue: (r: Row) => r.shiftCode,
      render: (r: Row) => (
        <div className="leading-tight">
          <div className="font-mono text-[11px] font-bold text-slate-800">{r.shiftCode}</div>
          <div className="text-[11px] text-slate-500 font-mono">{shiftText(r.shiftCode)}</div>
        </div>
      ),
    } as ColumnDef<Row>] : []),
    { key: 'in', header: 'In', width: teamView ? '6%' : '11%', align: 'center', sortValue: (r) => r.clockIn ?? '', render: (r) => <span className={`font-mono font-semibold ${r.lateByMins > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{r.clockIn ?? '—'}</span> },
    { key: 'out', header: 'Out', width: teamView ? '6%' : '11%', align: 'center', sortValue: (r) => r.clockOut ?? '', render: (r) => <span className={`font-mono font-semibold ${r.earlyByMins > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{r.clockOut ?? '—'}</span> },
    { key: 'hours', header: 'Hours', width: teamView ? '8%' : '12%', align: 'center', sortValue: (r) => r.totalHours ?? -1, render: (r) => <span className="font-mono text-slate-700">{hoursText(r.totalHours)}</span> },
    { key: 'status', header: 'Status', width: teamView ? '17%' : '23%', sortValue: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
    {
      key: 'remark', header: 'Remark', width: teamView ? '20%' : '26%', sortValue: (r) => r.remark,
      render: (r) => (
        <div className="whitespace-normal leading-snug min-w-[140px]">
          <span className="text-slate-700">{r.remark || '—'}</span>
          {r.devices.length > 0 && <div className="text-[11px] text-slate-400">{r.devices.join(', ')}</div>}
        </div>
      ),
    },
  ];

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    const value = col?.sortValue ?? ((r: Row) => r.date);
    const dir = sort.dir === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    return [...visible].sort((a, b) => {
      const x = value(a), y = value(b);
      const primary = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x ?? ''), String(y ?? ''));
      return primary * dir || a.name.localeCompare(b.name) || a.date.localeCompare(b.date);
    });
    // columns are rebuilt each render; their sort values depend only on the row
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  // ---- Downloads -------------------------------------------------------------------
  const exportHeaders = [...(teamView ? ['Biometric ID', 'Employee', 'Department', 'Designation', 'Shift'] : []), 'Date', 'Day', 'In', 'Out', 'Hours', 'Status', 'Remark'];
  const exportRows = () => sorted.map((r) => [
    ...(teamView ? [r.biometricId, r.name, r.department, r.designation, r.shiftCode] : []),
    formatDate(r.date), dayName(r.date), r.clockIn ?? '', r.clockOut ?? '', r.totalHours === null ? '' : hoursText(r.totalHours),
    `${r.status} – ${STATUS_META[r.status].label}`, [r.remark, r.devices.join(', ')].filter(Boolean).join(' · '),
  ]);
  const filterLine = () => [
    !statuses.includes('all') && statuses.length ? `Status: ${statuses.join(', ')}` : null,
    teamView && !departments.includes('all') && departments.length ? `Department: ${departments.join(', ')}` : null,
    teamView && !employees.includes('all') && employees.length ? `Employees: ${employees.length}` : null,
    search.trim() ? `Search: “${search.trim()}”` : null,
  ].filter(Boolean).join(' · ');
  const fileName = `WII_Attendance_${start}_to_${end}`;
  const downloadCsv = () => downloadCsvText(toCsvText(exportHeaders, exportRows()), fileName);
  const downloadPdf = () => downloadTablePdf({
    title: 'Biometric Attendance',
    subtitle: [`${range} · Generated ${printedAt(new Date().toISOString())}`, filterLine() || (teamView ? 'All employees shown' : currentUser.name)],
    headers: exportHeaders,
    rows: exportRows(),
    fileName,
    columnWidths: teamView ? [7, 14, 12, 12, 7, 10, 5, 6, 6, 7, 13, 18] : [14, 7, 9, 9, 10, 20, 31],
  });

  // ---- Month view --------------------------------------------------------------------
  const singlePerson = new Set(visible.map((r) => r.userId)).size === 1;
  const monthGrid = () => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < first; i++) cells.push(<div key={`b${i}`} />);
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      const items = visible.filter((r) => r.date === date);
      const isToday = date === today;
      cells.push(
        <div key={date} className={`min-h-[78px] rounded-xl border p-2 flex flex-col gap-1 ${isToday ? 'border-primary/60 bg-primary/5' : 'border-slate-200 bg-white'}`}>
          <span className={`text-[11px] font-bold ${isToday ? 'text-primary' : 'text-slate-500'}`}>{d}</span>
          {singlePerson && items[0] ? (
            <>
              <span className={`self-start px-1.5 py-0.5 rounded-md border text-[10px] font-bold font-mono ${STATUS_META[items[0].status].pill}`} title={STATUS_META[items[0].status].label}>{items[0].status}</span>
              {items[0].clockIn && <span className="text-[10px] font-mono text-slate-600">{items[0].clockIn}{items[0].clockOut ? `–${items[0].clockOut}` : ''}</span>}
            </>
          ) : items.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(['PP', 'PA', 'AP', 'AA'] as const).map((s) => {
                const n = items.filter((r) => r.status === s || (s === 'PP' && (r.status === 'WW#' || r.status === 'HH#' || r.status === 'OD'))).length;
                return n ? <span key={s} title={STATUS_META[s].label} className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${STATUS_META[s].pill}`}>{s} {n}</span> : null;
              })}
              {items.every((r) => r.status === 'WW' || r.status === 'GH') && (
                <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${STATUS_META[items[0].status].pill}`}>{items[0].status}</span>
              )}
            </div>
          ) : null}
        </div>,
      );
    }
    return cells;
  };
  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const [my, mm] = month.split('-').map(Number);

  // ---- Notices -----------------------------------------------------------------------
  const notice = error
    ?? (data && !data.machinesConfigured ? 'No attendance machine is registered yet. Add the machines with their serial numbers in Master Settings → Biometric Machines.' : null);

  const opt = (values: string[], label: (v: string) => string = (v) => v) => values.map((v) => ({ label: label(v), value: v }));
  const employeeOptions = [...new Map(rows.map((r) => [r.userId, `${r.name} (${r.biometricId})`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value }));

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={CalendarDays}
        title="Biometric Attendance"
        subtitle={isAdminOrAudit ? 'Daily attendance of all employees from the biometric machines'
          : isManager ? 'Your attendance and your team’s, from the biometric machines' : 'Your daily attendance from the biometric machines'}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 min-w-0">
            <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">{label}</p>
              <p className="text-lg font-extrabold text-slate-900">{loading ? '…' : value}</p>
              <p className="text-[11px] text-slate-500 truncate" title={note}>{note}</p>
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <div role="status" className={`px-4 py-3 rounded-2xl border text-xs font-semibold ${error ? 'bg-error-subtle border-error-border text-error' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {notice}
        </div>
      )}

      <FilterToolbar
        start={viewMode === 'month' ? (
          <span className="text-xs font-bold text-slate-700">{MONTHS[mm - 1]} {my}</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-36"><AppDatePicker size="sm" placeholder="From date" value={from} onChange={setFrom} /></div>
            <span className="text-slate-300 font-bold">—</span>
            <div className="w-36"><AppDatePicker size="sm" placeholder="To date" value={to} onChange={setTo} isRightColumn /></div>
          </div>
        )}
        exports={{
          onCsv: downloadCsv, onPdf: downloadPdf, disabled: sorted.length === 0,
          csvTitle: 'Download the attendance shown below as CSV', pdfTitle: 'Download the attendance shown below as PDF',
        }}
        search={{ value: search, onChange: setSearch, placeholder: teamView ? 'Search employee, date, remark…' : 'Search date, day, remark…' }}
        onReset={filtered ? resetAll : null}
        view={{
          value: viewMode,
          onChange: (v) => { if (v === 'month') setMonth((from || today).slice(0, 7)); setViewMode(v); },
          options: [{ value: 'table', label: 'Table view', icon: List }, { value: 'month', label: 'Month view', icon: LayoutGrid }],
        }}
        filters={[
          teamView && <MultiSelectFilter key="emp" label="Employee" options={employeeOptions} selectedValues={employees} onChange={setEmployees} />,
          teamView && <MultiSelectFilter key="dept" label="Department" options={opt(distinct((r) => r.department))} selectedValues={departments} onChange={setDepartments} />,
          teamView && <MultiSelectFilter key="desig" label="Designation" options={opt(distinct((r) => r.designation))} selectedValues={designations} onChange={setDesignations} />,
          teamView && <MultiSelectFilter key="type" label="Employee type" options={opt(distinct((r) => r.employmentType), typeName)} selectedValues={types} onChange={setTypes} />,
          showManagerFilter && <MultiSelectFilter key="mgr" label="Reporting manager" options={opt(distinct((r) => r.reportingManagerId), (id) => userById.get(id)?.name ?? id)} selectedValues={managers} onChange={setManagers} />,
          teamView && <MultiSelectFilter key="shift" label="Shift" options={opt(distinct((r) => r.shiftCode))} selectedValues={shiftsFilter} onChange={setShiftsFilter} />,
          <MultiSelectFilter key="status" label="Status" options={STATUSES.map((s) => ({ label: `${s} – ${STATUS_META[s].label}`, value: s }))} selectedValues={statuses} onChange={setStatuses} />,
        ].filter(Boolean) as React.ReactNode[]}
      />

      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={pageRows}
          loading={loading}
          keyExtractor={(r) => `${r.userId}-${r.date}`}
          className={teamView ? 'min-w-[1100px]' : 'min-w-[720px]'}
          sortColumn={sort.key}
          sortDirection={sort.dir}
          onSort={(key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
          emptyTitle={rows.length ? 'No attendance matches these filters' : 'No attendance for these dates'}
          emptyDescription={rows.length ? 'Change the filters or search.' : 'Choose other dates, or check that the machines are sending punches.'}
          pagination={sorted.length > PAGE_SIZES[0] ? {
            currentPage: page, totalPages, totalItems: sorted.length, pageSize,
            onPageChange: setPage, onPageSizeChange: setPageSize, pageSizeOptions: PAGE_SIZES,
          } : undefined}
        />
      ) : (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <h3 className="text-sm font-bold text-slate-900">{MONTHS[mm - 1]} {my}</h3>
            <button type="button" onClick={() => shiftMonth(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month"
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS.map((d, i) => <div key={d} className={`text-center text-[11px] font-bold uppercase tracking-wide ${i === 0 ? 'text-rose-600' : 'text-slate-500'}`}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">{monthGrid()}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            {STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} />{STATUS_META[s].label} ({s})
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
