import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Plus, Search, SunMedium, Tag, Trash2,
} from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { DataTable, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { Textarea } from '../../../../shared/components/forms/Textarea';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { AppSelect } from '../../../../shared/components/AppSelect';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import { ExportButtons } from '../../../../shared/components/ExportButtons';
import { ActivityLogPanel, ActivitySource } from '../../../../shared/components/ActivityLogPanel';
import { ApiError } from '../../../../shared/services/api';
import { activityEndpoints } from '../../../../shared/services/activityApi';
import { printTable, printedAt } from '../../../../shared/services/printTable';
import { ConfirmDialog, NoticeBar, useNotice } from '../../master/components/masterUi';
import { HolidayItem, MONTH_NAMES } from '../data/holidayData';
import { HolidayInput, holidayApi } from '../holidayApi';

/**
 * Holiday Calendar.
 *   User / Reporting Manager / HoD : view and download (CSV / PDF)
 *   Administrator                  : view, add, edit, delete (audited on the server)
 *   Auditor                        : view and download, plus the holiday activity log
 * The list comes from the database (AppContext.holidays); the server enforces every role.
 */

const TYPE_META: Record<HolidayItem['type'], { short: string; label: string; pill: string; dot: string }> = {
  gazetted: { short: 'GH', label: 'Gazetted', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' },
  restricted: { short: 'RH', label: 'Restricted', pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  local: { short: 'LH', label: 'Local', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-600' },
};
const TYPES = Object.keys(TYPE_META) as HolidayItem['type'][];
const CATEGORIES = ['National', 'Religious', 'Cultural', 'Institutional', 'International', 'Other'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOLIDAY_ACTIVITY: ActivitySource = {
  title: 'Holiday activity log',
  recordLabel: 'Holiday',
  searchPlaceholder: 'Holiday, done by, reason…',
  areas: [{ value: 'holiday', label: 'Holiday' }, { value: 'holiday_export', label: 'Log download' }],
  actions: ['CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
  ...activityEndpoints('/hrms/holidays/activity', 'WII_Holiday_Activity.csv'),
};

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** CSV cell; values a spreadsheet would run as formulas are prefixed with a quote. */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const EMPTY_FORM: HolidayInput = { date: '', name: '', hindiName: '', type: 'gazetted', category: 'National', description: '' };

interface HolidayCalendarPageProps {
  onNavigate?: (tab: string) => void;
}

export const HolidayCalendarPage: React.FC<HolidayCalendarPageProps> = () => {
  const { currentUser, holidays, reloadHolidays } = useApp();
  const isAdmin = currentUser.role === 'administrator';
  const isAudit = currentUser.role === 'audit';

  const [notice, showNotice, clearNotice] = useNotice();
  const [auditorView, setAuditorView] = useState<'calendar' | 'activity'>('calendar');
  const [viewMode, setViewMode] = useState<'table' | 'month'>('table');

  // ---- Year and filters ------------------------------------------------------
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const set = new Set<number>([thisYear, ...holidays.map((h) => h.year)]);
    return [...set].sort((a, b) => b - a);
  }, [holidays, thisYear]);
  const [year, setYear] = useState<number>(thisYear);
  const [types, setTypes] = useState<string[]>(['all']);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  const yearHolidays = useMemo(() => holidays.filter((h) => h.year === year), [holidays, year]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return yearHolidays
      .filter((h) => matchesMultiSelect(types, h.type) && matchesMultiSelect(categories, h.category))
      .filter((h) => !q || [h.name, h.hindiName, h.description, h.dayOfWeek, h.date, formatDate(h.date)].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [yearHolidays, types, categories, search]);

  const stats = useMemo(() => {
    const today = todayIso();
    return {
      gazetted: yearHolidays.filter((h) => h.type === 'gazetted').length,
      restricted: yearHolidays.filter((h) => h.type === 'restricted').length,
      longWeekends: yearHolidays.filter((h) => h.isLongWeekend && h.type === 'gazetted').length,
      next: holidays.filter((h) => h.date >= today && h.type === 'gazetted').sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    };
  }, [yearHolidays, holidays]);

  // ---- Downloads (everyone) ---------------------------------------------------
  const exportHeaders = ['Date', 'Day', 'Holiday', 'Hindi name', 'Type', 'Category', 'Long weekend', 'Description'];
  const exportRows = () => visible.map((h) => [
    formatDate(h.date), h.dayOfWeek, h.name, h.hindiName ?? '', TYPE_META[h.type]?.label ?? h.type, h.category, h.isLongWeekend ? 'Yes' : 'No', h.description,
  ]);
  const filterLine = () => [
    !types.includes('all') && types.length ? `Type: ${types.map((t) => TYPE_META[t as HolidayItem['type']]?.label ?? t).join(', ')}` : null,
    !categories.includes('all') && categories.length ? `Category: ${categories.join(', ')}` : null,
    search.trim() ? `Search: “${search.trim()}”` : null,
  ].filter(Boolean).join(' · ');

  const downloadCsv = () => {
    const csv = `﻿${[exportHeaders, ...exportRows()].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `WII_Holiday_Calendar_${year}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const downloadPdf = () => printTable({
    title: `Holiday Calendar ${year}`,
    subtitle: [`Generated ${printedAt(new Date().toISOString())}`, filterLine() || 'All holidays'],
    headers: exportHeaders,
    rows: exportRows(),
  });

  // ---- Administrator: add / edit / delete ------------------------------------
  const [editing, setEditing] = useState<HolidayItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<HolidayInput>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<HolidayItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openAdd = (date?: string) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: date ?? '' });
    setFormErrors({});
    setFormMessage(null);
    setFormOpen(true);
  };
  const openEdit = (h: HolidayItem) => {
    setEditing(h);
    setForm({ date: h.date, name: h.name, hindiName: h.hindiName ?? '', type: h.type, category: h.category, description: h.description ?? '' });
    setFormErrors({});
    setFormMessage(null);
    setFormOpen(true);
  };
  const setField = <K extends keyof HolidayInput>(key: K, value: HolidayInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormMessage(null);
    try {
      const result = editing ? await holidayApi.update(editing.id, form) : await holidayApi.create(form);
      await reloadHolidays();
      setFormOpen(false);
      showNotice('success', result.message);
      setYear(Number(form.date.slice(0, 4)) || year);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormErrors(error.details ?? {});
        const first = Object.values(error.details ?? {}).find(Boolean);
        setFormMessage(first ? `${error.message} ${first}` : error.message);
      } else {
        setFormMessage('The holiday could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await holidayApi.remove(deleting.id, reason);
      await reloadHolidays();
      setDeleting(null);
      showNotice('success', result.message);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The holiday could not be removed.');
    } finally {
      setDeleteBusy(false);
    }
  };

  useEffect(() => { if (!formOpen) setSaving(false); }, [formOpen]);

  // ---- Table -----------------------------------------------------------------
  const columns: ColumnDef<HolidayItem>[] = [
    {
      key: 'date', header: 'Date', width: '150px', sortValue: (h) => h.date,
      render: (h) => (
        <div>
          <p className="text-[13px] font-semibold text-slate-900 whitespace-nowrap">{formatDate(h.date)}</p>
          <p className="text-[11px] text-slate-500">{h.dayOfWeek}</p>
        </div>
      ),
    },
    {
      key: 'name', header: 'Holiday', sortValue: (h) => h.name,
      render: (h) => (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">{h.name}</p>
          {h.hindiName && <p className="text-[11px] text-slate-500">{h.hindiName}</p>}
        </div>
      ),
    },
    {
      key: 'type', header: 'Type', width: '130px', sortValue: (h) => h.type,
      render: (h) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${TYPE_META[h.type]?.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${TYPE_META[h.type]?.dot}`} />{TYPE_META[h.type]?.label ?? h.type}
        </span>
      ),
    },
    { key: 'category', header: 'Category', width: '130px', sortValue: (h) => h.category, render: (h) => <span className="text-[13px] text-slate-700">{h.category}</span> },
    {
      key: 'weekend', header: 'Long weekend', width: '130px', sortValue: (h) => (h.isLongWeekend ? 1 : 0),
      render: (h) => (h.isLongWeekend
        ? <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700"><SunMedium className="w-3 h-3" />Yes</span>
        : <span className="text-[13px] text-slate-400">—</span>),
    },
    { key: 'description', header: 'Description', render: (h) => <span className="text-xs text-slate-600 line-clamp-2">{h.description || '—'}</span> },
    ...(isAdmin ? [{
      key: 'actions', header: 'Actions', width: '100px', align: 'right' as const,
      render: (h: HolidayItem) => (
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => openEdit(h)} title="Edit holiday" aria-label={`Edit ${h.name}`}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 cursor-pointer">
            <Pencil className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { setDeleteError(null); setDeleting(h); }} title="Delete holiday" aria-label={`Delete ${h.name}`}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-error hover:border-error-border cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    }] : []),
  ];

  // ---- Month grid ------------------------------------------------------------
  const monthGrid = () => {
    const first = new Date(year, month - 1, 1);
    const days = new Date(year, month, 0).getDate();
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`pad-${i}`} />);
    for (let d = 1; d <= days; d++) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayHolidays = visible.filter((h) => h.date === iso);
      const weekday = new Date(year, month - 1, d).getDay();
      const isToday = iso === todayIso();
      cells.push(
        <div
          key={iso}
          className={`min-h-[92px] rounded-xl border p-2 flex flex-col gap-1 ${
            dayHolidays.length ? 'border-primary/25 bg-primary/5' : weekday === 0 || weekday === 6 ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
          } ${isAdmin && !dayHolidays.length ? 'cursor-pointer hover:border-primary/40' : ''}`}
          onClick={isAdmin && !dayHolidays.length ? () => openAdd(iso) : undefined}
          title={isAdmin && !dayHolidays.length ? 'Add a holiday on this day' : undefined}
        >
          <span className={`text-xs font-bold ${isToday ? 'w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center' : weekday === 0 ? 'text-rose-600' : 'text-slate-700'}`}>{d}</span>
          {dayHolidays.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); if (isAdmin) openEdit(h); }}
              className={`text-left rounded-md border px-1.5 py-1 ${TYPE_META[h.type]?.pill} ${isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              title={`${h.name} · ${TYPE_META[h.type]?.label}${h.description ? ` · ${h.description}` : ''}`}
            >
              <span className="block text-[10px] font-extrabold">{TYPE_META[h.type]?.short}</span>
              <span className="block text-[11px] font-semibold leading-tight line-clamp-2">{h.name}</span>
            </button>
          ))}
        </div>,
      );
    }
    return cells;
  };

  // ---- Layout ----------------------------------------------------------------
  const auditorSwitch = isAudit ? (
    <div className="inline-flex p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1" role="tablist" aria-label="Auditor view">
      {([['calendar', 'Holiday calendar'], ['activity', 'Activity logs']] as const).map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={auditorView === key} onClick={() => setAuditorView(key)}
          className={`h-7 px-3.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${auditorView === key ? 'bg-white text-primary shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}>
          {label}
        </button>
      ))}
    </div>
  ) : null;

  const statCards = [
    { label: 'Gazetted holidays', value: stats.gazetted, note: `Offices closed in ${year}`, icon: CalendarCheck, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Restricted holidays', value: stats.restricted, note: `Optional list for ${year}`, icon: Tag, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Long weekends', value: stats.longWeekends, note: 'Gazetted holiday on a Friday or Monday', icon: SunMedium, tone: 'text-rose-700 bg-rose-50 border-rose-200' },
    {
      label: 'Next holiday', value: stats.next ? stats.next.name : '—',
      note: stats.next ? `${formatDate(stats.next.date)} · ${stats.next.dayOfWeek}` : 'No upcoming gazetted holiday listed', icon: CalendarClock, tone: 'text-primary bg-primary/10 border-primary/20',
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={CalendarDays}
        title="Holiday Calendar"
        subtitle={isAdmin ? 'Add, edit and remove institute holidays' : 'Gazetted, restricted and local holidays of the institute'}
        rightAction={isAdmin ? (
          <button type="button" onClick={() => openAdd()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-2xs cursor-pointer">
            <Plus className="w-4 h-4" /> Add holiday
          </button>
        ) : undefined}
      />

      <NoticeBar notice={notice} onClose={clearNotice} />

      {isAudit && auditorView === 'activity' ? (
        <ActivityLogPanel source={HOLIDAY_ACTIVITY} toolbarStart={auditorSwitch} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map(({ label, value, note, icon: Icon, tone }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 min-w-0">
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className="text-lg font-extrabold text-slate-900 truncate" title={String(value)}>{value}</p>
                  <p className="text-[11px] text-slate-500 truncate" title={note}>{note}</p>
                </div>
              </div>
            ))}
          </div>

          <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex flex-wrap items-center gap-2">
                {auditorSwitch}
                <div className="w-32">
                  <AppSelect value={String(year)} onChange={(v) => setYear(Number(v))} options={years.map((y) => ({ label: `Year ${y}`, value: String(y) }))} />
                </div>
              </div>
              <ExportButtons onCsv={downloadCsv} onPdf={downloadPdf} disabled={visible.length === 0}
                csvTitle={`Download the ${year} holidays shown below as CSV`} pdfTitle={`Print / save the ${year} holidays shown below as PDF`} />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search holiday, date or day…"
                  maxLength={100}
                  className="h-9 w-full pl-10 pr-3 bg-slate-50/70 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-44"><MultiSelectFilter label="Type" options={TYPES.map((t) => ({ label: TYPE_META[t].label, value: t }))} selectedValues={types} onChange={setTypes} /></div>
                <div className="w-48"><MultiSelectFilter label="Category" options={CATEGORIES.map((c) => ({ label: c, value: c }))} selectedValues={categories} onChange={setCategories} /></div>
                <div className="h-9 flex items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0">
                  {([['table', List, 'Table view'], ['month', LayoutGrid, 'Month view']] as const).map(([mode, Icon, title]) => (
                    <button key={mode} type="button" onClick={() => setViewMode(mode)} title={title} aria-label={title}
                      className={`h-7 px-2 flex items-center justify-center rounded-lg cursor-pointer ${viewMode === mode ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' : 'text-slate-400 hover:text-slate-700'}`}>
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {viewMode === 'table' ? (
            <DataTable
              columns={columns}
              data={visible}
              keyExtractor={(h) => h.id}
              emptyTitle={yearHolidays.length ? 'No holidays match these filters' : `No holidays listed for ${year}`}
              emptyDescription={yearHolidays.length ? 'Change the filters or search.' : isAdmin ? 'Use “Add holiday” to build the calendar.' : 'The administrator has not published this year yet.'}
            />
          ) : (
            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setMonth((m) => (m === 1 ? 12 : m - 1))} aria-label="Previous month"
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                <h3 className="text-sm font-bold text-slate-900">{MONTH_NAMES[month - 1]} {year}</h3>
                <button type="button" onClick={() => setMonth((m) => (m === 12 ? 1 : m + 1))} aria-label="Next month"
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
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
                {TYPES.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <span className={`w-2 h-2 rounded-full ${TYPE_META[t].dot}`} />{TYPE_META[t].label} ({TYPE_META[t].short})
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Administrator: add / edit */}
      {isAdmin && (
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          size="lg"
          title={editing ? 'Edit holiday' : 'Add holiday'}
          subtitle={editing ? `${editing.name} · ${formatDate(editing.date)}` : 'Day of week and long weekend are worked out from the date'}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" form="holiday-form" disabled={saving} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add holiday'}
              </button>
            </div>
          )}
        >
          <form id="holiday-form" onSubmit={save} noValidate className="space-y-4">
            {formMessage && <NoticeBar notice={{ kind: 'error', text: formMessage }} onClose={() => setFormMessage(null)} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Holiday name" required maxLength={150} value={form.name} error={Boolean(formErrors.name)} title={formErrors.name || undefined}
                onChange={(e) => setField('name', e.target.value)} />
              <Input label="Hindi name" maxLength={150} value={form.hindiName} error={Boolean(formErrors.hindiName)} title={formErrors.hindiName || undefined}
                onChange={(e) => setField('hindiName', e.target.value)} />
              <div className={formErrors.date ? 'rounded-xl ring-2 ring-rose-400' : ''} title={formErrors.date || undefined}>
                <AppDatePicker label="Date *" value={form.date} placeholder="Select date" onChange={(v) => setField('date', v)} className="w-full" />
              </div>
              <Select label="Type" required value={form.type} error={Boolean(formErrors.type)}
                options={TYPES.map((t) => ({ label: `${TYPE_META[t].label} (${TYPE_META[t].short})`, value: t }))}
                onChange={(v: HolidayItem['type']) => setField('type', v)} />
              <Select label="Category" required value={form.category} error={Boolean(formErrors.category)}
                options={CATEGORIES.map((c) => ({ label: c, value: c }))} onChange={(v: string) => setField('category', v)} />
            </div>
            <Textarea label="Description" rows={3} maxLength={500} value={form.description} error={Boolean(formErrors.description)}
              onChange={(e) => setField('description', e.target.value)} />
          </form>
        </Modal>
      )}

      {isAdmin && (
        <ConfirmDialog
          open={Boolean(deleting)}
          title="Delete holiday"
          message={deleting ? <>Remove <strong>{deleting.name}</strong> on {formatDate(deleting.date)} from the calendar? This is recorded in the audit log.</> : ''}
          confirmLabel="Delete"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={(reason) => void confirmDelete(reason)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
};
