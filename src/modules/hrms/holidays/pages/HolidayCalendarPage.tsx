import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { MultiSelectFilter, matchesMultiSelect } from '../../../../shared/components/MultiSelectFilter';
import {
  HolidayItem,
  MONTH_NAMES
} from '../data/holidayData';
import { PageHeader } from '../../../../shared/components/PageHeader';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Search,
  Download,
  FileText,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Table as TableIcon,
  LayoutGrid,
  CheckCircle2,
  Printer,
  SunMedium,
  Umbrella,
  CalendarCheck,
  Tag,
  PlusCircle,
  Plus,
  X,
  RotateCcw,
  Filter,
  Pencil,
  Trash2,
  AlertTriangle,
  Layers
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HolidayCalendarPageProps {
  onNavigate?: (tab: string) => void;
}

export const HolidayCalendarPage: React.FC<HolidayCalendarPageProps> = ({ onNavigate }) => {
  const { currentUser, holidays, addHoliday, updateHoliday, deleteHoliday } = useApp();
  const isAdmin = currentUser.role === 'administrator';

  const [filterStartDate, setFilterStartDate] = useState<string>('2026-01-01');
  const [filterEndDate, setFilterEndDate] = useState<string>('2026-12-31');
  const [selectedType, setSelectedType] = useState<string[]>(['all']); // all, gazetted, restricted, local
  const [selectedCategory, setSelectedCategory] = useState<string[]>(['all']);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayItem | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<HolidayItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    hindiName: string;
    date: string;
    type: 'gazetted' | 'restricted' | 'local';
    category: 'National' | 'Religious' | 'Cultural' | 'Institutional' | 'International' | 'Other';
    description: string;
    isLongWeekend: boolean;
  }>({
    name: '',
    hindiName: '',
    date: '2026-08-15',
    type: 'gazetted',
    category: 'National',
    description: '',
    isLongWeekend: false
  });

  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Open modal for new holiday
  const handleOpenAddModal = () => {
    const defaultDate = filterStartDate ? filterStartDate : '2026-08-15';
    const dateObj = new Date(defaultDate + 'T00:00:00');
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const isAutoLW = (dayOfWeek === 'Friday' || dayOfWeek === 'Monday' || dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday');

    setFormData({
      name: '',
      hindiName: '',
      date: defaultDate,
      type: 'gazetted',
      category: 'National',
      description: '',
      isLongWeekend: isAutoLW
    });
    setEditingHoliday(null);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open modal for editing existing holiday
  const handleOpenEditModal = (h: HolidayItem) => {
    setEditingHoliday(h);
    setFormData({
      name: h.name,
      hindiName: h.hindiName || '',
      date: h.date,
      type: h.type,
      category: (h.category as any) || 'National',
      description: h.description || '',
      isLongWeekend: Boolean(h.isLongWeekend)
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Handle Date Change inside form to auto compute long weekend suggestion
  const handleFormDateChange = (newDate: string) => {
    if (!newDate) {
      setFormData(prev => ({ ...prev, date: newDate }));
      return;
    }
    const dateObj = new Date(newDate + 'T00:00:00');
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const isAutoLW = (dayOfWeek === 'Friday' || dayOfWeek === 'Monday' || dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday');
    setFormData(prev => ({
      ...prev,
      date: newDate,
      isLongWeekend: isAutoLW
    }));
  };

  // Save Holiday Form (Create or Update)
  const handleSaveHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Holiday Name is required.');
      return;
    }
    if (!formData.date) {
      setFormError('Date is required.');
      return;
    }

    if (editingHoliday) {
      // Update
      const res = updateHoliday(editingHoliday.id, {
        name: formData.name.trim(),
        hindiName: formData.hindiName.trim() || undefined,
        date: formData.date,
        type: formData.type,
        category: formData.category as any,
        description: formData.description.trim() || `${formData.name} Holiday`,
        isLongWeekend: formData.isLongWeekend
      });
      if (res.success) {
        showToast(res.message);
        setIsFormModalOpen(false);
        setEditingHoliday(null);
      } else {
        setFormError(res.message);
      }
    } else {
      // Create
      const res = addHoliday({
        name: formData.name.trim(),
        hindiName: formData.hindiName.trim() || undefined,
        date: formData.date,
        type: formData.type,
        category: formData.category as any,
        description: formData.description.trim() || `${formData.name} Holiday`,
        isLongWeekend: formData.isLongWeekend
      });
      if (res.success) {
        showToast(res.message);
        setIsFormModalOpen(false);
      } else {
        setFormError(res.message);
      }
    }
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingHoliday) return;
    const res = deleteHoliday(deletingHoliday.id);
    if (res.success) {
      showToast(res.message);
    } else {
      showToast(res.message || 'Failed to delete holiday');
    }
    setDeletingHoliday(null);
  };

  // Filtered Holidays from AppContext state
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      if (filterStartDate && h.date < filterStartDate) return false;
      if (filterEndDate && h.date > filterEndDate) return false;
      if (!matchesMultiSelect(selectedType, h.type)) return false;
      if (!matchesMultiSelect(selectedCategory, h.category)) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = h.name.toLowerCase().includes(query);
        const matchesHindi = h.hindiName ? h.hindiName.toLowerCase().includes(query) : false;
        const matchesDesc = h.description ? h.description.toLowerCase().includes(query) : false;
        const matchesDate = h.date.includes(query);
        const matchesDay = h.dayOfWeek.toLowerCase().includes(query);
        if (!matchesName && !matchesHindi && !matchesDesc && !matchesDate && !matchesDay) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [holidays, filterStartDate, filterEndDate, selectedType, selectedCategory, searchTerm]);

  // Table Column Sort State
  const [sortField, setSortField] = useState<'date' | 'name' | 'type' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'date' | 'name' | 'type' | 'category') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedHolidays = useMemo(() => {
    return [...filteredHolidays].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else if (sortField === 'category') {
        cmp = (a.category || '').localeCompare(b.category || '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredHolidays, sortField, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const yearHolidays = holidays.filter((h) => {
      if (filterStartDate && h.date < filterStartDate) return false;
      if (filterEndDate && h.date > filterEndDate) return false;
      return true;
    });
    const gazettedCount = yearHolidays.filter((h) => h.type === 'gazetted').length;
    const restrictedCount = yearHolidays.filter((h) => h.type === 'restricted').length;
    const localCount = yearHolidays.filter((h) => h.type === 'local').length;
    const longWeekends = yearHolidays.filter((h) => h.isLongWeekend).length;

    // Next upcoming holiday from today
    const todayStr = '2026-08-15'; // Local context date
    const upcoming = holidays.filter(
      (h) => h.date >= todayStr
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    return {
      total: yearHolidays.length,
      gazettedCount,
      restrictedCount,
      localCount,
      longWeekends,
      upcoming
    };
  }, [holidays, filterStartDate, filterEndDate]);

  // Unique Categories List
  const categoryList = useMemo(() => {
    const cats = new Set<string>();
    holidays.forEach((h) => {
      if (h.category) cats.add(h.category);
    });
    return Array.from(cats).sort();
  }, [holidays]);

  // Quick Preset Handlers
  const currentYear = filterStartDate ? new Date(filterStartDate).getFullYear() : 2026;

  const handlePresetCurrentYear = () => {
    setFilterStartDate('2026-01-01');
    setFilterEndDate('2026-12-31');
  };

  const handleResetFilters = () => {
    setFilterStartDate('2026-01-01');
    setFilterEndDate('2026-12-31');
    setSelectedType(['all']);
    setSelectedCategory(['all']);
    setSearchTerm('');
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Day', 'Holiday Name', 'Hindi Name', 'Type', 'Category', 'Description', 'Long Weekend'];
    const rows = filteredHolidays.map((h) => [
      h.id,
      h.date,
      h.dayOfWeek,
      `"${h.name}"`,
      `"${h.hindiName || ''}"`,
      h.type.toUpperCase(),
      h.category,
      `"${h.description}"`,
      h.isLongWeekend ? 'Yes' : 'No'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Holiday_Calendar_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Holiday calendar exported to CSV');
  };

  // Export PDF Report
  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    // Header Banner
    doc.setFillColor(30, 41, 59); // slate-900
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAMS 2.0 — Official Holiday Calendar', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Calendar Year: ${currentYear} | Generated: ${new Date().toLocaleDateString('en-GB')}`, 196, 15, { align: 'right' });

    // Meta details
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const typeText = selectedType.includes('all') ? 'Gazetted & Restricted' : selectedType.join(', ').toUpperCase();
    doc.text(`Range: ${filterStartDate} to ${filterEndDate} | Category: ${selectedCategory.includes('all') ? 'All Categories' : selectedCategory.join(', ')} | Type: ${typeText} | Total: ${filteredHolidays.length}`, 14, 32);

    // Table
    const tableHead = [
      ['#', 'Date & Day', 'Holiday Name', 'Hindi Name', 'Type', 'Category']
    ];

    const tableData = filteredHolidays.map((h, idx) => [
      idx + 1,
      `${new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}\n(${h.dayOfWeek})`,
      h.name + (h.isLongWeekend ? ' [Long Weekend]' : ''),
      h.hindiName || '-',
      h.type === 'gazetted' ? 'Gazetted (GH)' : h.type === 'restricted' ? 'Restricted (RH)' : 'Local (LH)',
      h.category
    ]);

    autoTable(doc, {
      startY: 38,
      head: tableHead,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 60 },
        3: { cellWidth: 40 },
        4: { cellWidth: 30 },
        5: { cellWidth: 25 }
      }
    });

    doc.save(`Official_Holiday_Calendar_${currentYear}.pdf`);
    showToast('Holiday calendar PDF report downloaded');
  };

  // Days in calendar month generation helper
  const renderCalendarMonth = (monthIndex: number) => {
    const year = currentYear;
    const firstDay = new Date(year, monthIndex - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, monthIndex, 0).getDate();

    const monthHolidays = holidays.filter(
      (h) => h.year === year && h.month === monthIndex
    );

    const holidayMap = new Map<number, HolidayItem>();
    monthHolidays.forEach((h) => {
      const day = parseInt(h.date.split('-')[2], 10);
      holidayMap.set(day, h);
    });

    const dayCells = [];
    // Padding blanks for first row
    for (let i = 0; i < firstDay; i++) {
      dayCells.push(
        <div key={`blank-${i}`} className="min-h-[105px] bg-slate-50/40 border border-slate-100/80 rounded-2xl" />
      );
    }

    // Days 1 to daysInMonth
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, monthIndex - 1, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;
      const holiday = holidayMap.get(day);
      const isToday = dateStr === '2026-08-15';

      let bgClass = 'bg-white hover:bg-slate-50/80 border-slate-200';
      if (isToday) bgClass = 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-500/20';
      else if (holiday) {
        if (holiday.type === 'gazetted') bgClass = 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/60';
        else if (holiday.type === 'restricted') bgClass = 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/60';
        else bgClass = 'bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100/60';
      }

      dayCells.push(
        <div
          key={`day-${day}`}
          className={`min-h-[105px] border rounded-2xl p-2.5 flex flex-col justify-between transition-all group relative overflow-hidden ${bgClass}`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold ${
                isToday
                  ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center -ml-0.5 -mt-0.5 shadow-2xs'
                  : isSunday
                  ? 'text-rose-600'
                  : 'text-slate-800'
              }`}
            >
              {day}
            </span>
            {holiday && (
              <div className="flex items-center space-x-1">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-tight ${
                    holiday.type === 'gazetted'
                      ? 'bg-emerald-600 text-white'
                      : holiday.type === 'restricted'
                      ? 'bg-amber-500 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {holiday.type === 'gazetted' ? 'GH' : holiday.type === 'restricted' ? 'RH' : 'LH'}
                </span>
                {isAdmin && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5">
                    <button
                      onClick={() => handleOpenEditModal(holiday)}
                      title="Edit Holiday"
                      className="p-1 hover:bg-white/80 rounded text-slate-700 hover:text-blue-600 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setDeletingHoliday(holiday)}
                      title="Delete Holiday"
                      className="p-1 hover:bg-white/80 rounded text-slate-700 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {holiday ? (
            <div className="mt-auto">
              <p
                className="text-xs font-bold leading-snug line-clamp-2 text-slate-900 group-hover:text-blue-700"
                title={`${holiday.name} - ${holiday.description}`}
              >
                {holiday.name}
              </p>
              {holiday.isLongWeekend && (
                <span className="inline-block text-[9px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded mt-1">
                  Long Weekend
                </span>
              )}
            </div>
          ) : isWeekend ? (
            <span className="text-[10px] text-slate-400 font-medium self-end">
              {dayOfWeek === 0 ? 'Sun' : 'Sat'}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900">
            {MONTH_NAMES[monthIndex - 1]} {year}
          </h3>
          {monthHolidays.length > 0 && (
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              {monthHolidays.length} {monthHolidays.length === 1 ? 'Holiday' : 'Holidays'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-7 gap-2.5 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div
              key={d}
              className={`text-xs font-bold py-1 ${
                i === 0 ? 'text-rose-600' : 'text-slate-600'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2.5">{dayCells}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Uniform Page Header with Admin Create Action */}
      <PageHeader
        icon={CalendarIcon}
        title="Holiday Calendar"
        subtitle="Official schedule of Closed Gazetted Holidays (GH), Restricted Holidays (RH), and Local Institute Holidays."
        rightAction={
          isAdmin ? (
            <button
              onClick={handleOpenAddModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Holiday</span>
            </button>
          ) : onNavigate ? (
            <button
              onClick={() => onNavigate('leave')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Apply for Leave / RH</span>
            </button>
          ) : undefined
        }
      />

      {/* Holiday Summary Stat Cards: Placed immediately below PageHeader */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Gazetted Holidays (GH) - GREEN */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Gazetted Holidays (GH)</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">{stats.gazettedCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CalendarCheck className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Compulsory Closed Offices ({currentYear})
          </div>
        </div>

        {/* 2. Restricted Holidays */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">Restricted Holidays (RH)</p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">{stats.restrictedCount}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Tag className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Optional Festival List ({currentYear})
          </div>
        </div>

        {/* 3. Long Weekends (LW) - RED */}
        <div className="bg-rose-50/70 border border-rose-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 truncate">Long Weekends (LW)</p>
              <p className="text-xl sm:text-2xl font-black text-rose-900 mt-0.5">{stats.longWeekends}</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 border border-rose-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <SunMedium className="w-4 h-4 text-rose-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-rose-200/60 text-[10px] sm:text-[11px] font-semibold text-rose-700 whitespace-nowrap overflow-hidden text-ellipsis">
            3–4 Days Continuous Breaks
          </div>
        </div>

        {/* 4. RH Quota */}
        <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 truncate">RH Allowed Quota</p>
              <p className="text-xl sm:text-2xl font-black text-indigo-900 mt-0.5">2 / Year</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-100 border border-indigo-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <CalendarDays className="w-4 h-4 text-indigo-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-indigo-200/60 text-[10px] sm:text-[11px] font-semibold text-indigo-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Max 2 RH Availment / Employee
          </div>
        </div>
      </div>

      {/* Professional Date Range & Related Filters Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Top Bar: Clean Themed Selectors, Presets & Export Action Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 border-b border-slate-100 pb-3.5">
          {/* Left: Date Pickers & Quick Presets */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <AppDatePicker
                size="sm"
                placeholder="From Date"
                value={filterStartDate}
                onChange={(dStr) => setFilterStartDate(dStr)}
              />

              <span className="text-slate-300 font-bold">—</span>

              <AppDatePicker
                size="sm"
                placeholder="To Date"
                value={filterEndDate}
                onChange={(dStr) => setFilterEndDate(dStr)}
                isRightColumn={true}
              />
            </div>

            {/* Quick Preset: Current Year (Only appears when dates are modified from default) */}
            {(filterStartDate !== '2026-01-01' || filterEndDate !== '2026-12-31') && (
              <div>
                <button
                  onClick={handlePresetCurrentYear}
                  className="bg-slate-50/90 hover:bg-white border border-slate-200/90 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer"
                  title="Reset dates to Current Year"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Current Year</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Export Buttons (CSV & PDF) */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Second Row: Search Keyword, Reset & View Toggle Switch */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search holiday name, date, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
              {(searchTerm !== '' ||
                filterStartDate !== '2026-01-01' ||
                filterEndDate !== '2026-12-31' ||
                !selectedType.includes('all') ||
                !selectedCategory.includes('all')) && (
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200/90 rounded-2xl text-xs font-bold flex items-center space-x-2 shrink-0 transition-all cursor-pointer shadow-2xs"
                  title="Reset all search and filter selections"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Reset All Filters</span>
                </button>
              )}

              {/* View Mode Toggle: Row View (Table) vs Grid View */}
              <div className="flex items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0">
                <button
                  onClick={() => setViewMode('table')}
                  title="Table View"
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <TableIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Third Row: Filter Dropdowns */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-nowrap">
              {/* 1. Holiday Type Filter */}
              <div className="flex-1 min-w-[140px] max-w-[220px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="Holiday Type"
                  icon={<Tag className="w-3.5 h-3.5" />}
                  selectedValues={selectedType}
                  onChange={setSelectedType}
                  options={[
                    { label: 'Gazetted (GH)', value: 'gazetted' },
                    { label: 'Restricted (RH)', value: 'restricted' },
                    { label: 'Local (LH)', value: 'local' }
                  ]}
                />
              </div>

              {/* 2. Category Filter */}
              <div className="flex-1 min-w-[140px] max-w-[220px] shrink-0 sm:shrink">
                <MultiSelectFilter
                  label="Category"
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  selectedValues={selectedCategory}
                  onChange={setSelectedCategory}
                  options={categoryList.map((c) => ({ label: c, value: c }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW 1: MONTHLY CALENDAR GRID */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          {/* Top Month Navigation Bar */}
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3 px-5 rounded-2xl shadow-2xs">
            <button
              onClick={() => {
                const prev = currentCalendarMonth > 1 ? currentCalendarMonth - 1 : 12;
                setCurrentCalendarMonth(prev);
              }}
              className="hover:bg-slate-100 px-3 py-1.5 rounded-xl text-slate-800 font-bold flex items-center space-x-1.5 text-xs transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
              <span>Previous Month</span>
            </button>

            <h2 className="text-base font-extrabold text-slate-900">
              {MONTH_NAMES[currentCalendarMonth - 1]} {currentYear}
            </h2>

            <button
              onClick={() => {
                const next = currentCalendarMonth < 12 ? currentCalendarMonth + 1 : 1;
                setCurrentCalendarMonth(next);
              }}
              className="hover:bg-slate-100 px-3 py-1.5 rounded-xl text-slate-800 font-bold flex items-center space-x-1.5 text-xs transition-colors cursor-pointer"
            >
              <span>Next Month</span>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Full-width Single Month Card */}
          <div className="w-full">
            {renderCalendarMonth(currentCalendarMonth)}
          </div>
        </div>
      )}

      {/* VIEW 2: LIST TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          {/* Table Title Bar */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 min-h-[50px]">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Official Holiday Master Table ({sortedHolidays.length})
              </span>
              <span className="text-[11px] text-slate-500 font-medium bg-slate-200/60 px-2.5 py-0.5 rounded-full border border-slate-200">
                Year {currentYear}
              </span>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr className="h-10">
                  <th className="py-2.5 px-3 w-[5%] text-center font-bold whitespace-nowrap align-middle">#</th>
                  <th
                    onClick={() => handleSort('date')}
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[18%]"
                    title="Click to sort by Date"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Date (Day)</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[37%]"
                    title="Click to sort by Holiday Name"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Holiday Name</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('type')}
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[18%]"
                    title="Click to sort by Type"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Type</span>
                      {sortField === 'type' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('category')}
                    className="py-2.5 px-3 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 transition-colors align-middle w-[14%]"
                    title="Click to sort by Category"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Category</span>
                      {sortField === 'category' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 shrink-0" />
                      )}
                    </div>
                  </th>
                  {isAdmin && (
                    <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap align-middle w-[8%]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {sortedHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">No holidays match the selected filter criteria.</p>
                        <button
                          onClick={handleResetFilters}
                          className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Reset filters to full year
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedHolidays.map((h, idx) => (
                    <tr
                      key={h.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        h.isLongWeekend ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-bold text-center">{idx + 1}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {new Date(h.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {h.dayOfWeek}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{h.name}</span>
                            {h.isLongWeekend && (
                              <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded font-bold">
                                Long Weekend
                              </span>
                            )}
                          </div>
                          {h.hindiName && (
                            <span className="text-[11px] text-slate-500 font-normal block">
                              {h.hindiName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-tight ${
                            h.type === 'gazetted'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : h.type === 'restricted'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {h.type === 'gazetted' ? 'Gazetted (GH)' : h.type === 'restricted' ? 'Restricted (RH)' : 'Local (LH)'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                          {h.category}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleOpenEditModal(h)}
                              title="Edit Holiday"
                              className="p-1.5 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-200 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingHoliday(h)}
                              title="Delete Holiday"
                              className="p-1.5 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {/* ================= ADMIN MODAL: CREATE / EDIT HOLIDAY ================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-600/30 rounded-xl border border-blue-400/40 text-blue-400">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {editingHoliday ? 'Edit Holiday (अवकाश संपादित करें)' : 'Create New Holiday (नया अवकाश जोड़ें)'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Manage official calendar for current &amp; upcoming years
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveHoliday} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Holiday Name English & Hindi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Holiday Name (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Buddha Purnima, Diwali"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Hindi / Regional Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. बुद्ध पूर्णिमा, दीपावली"
                    value={formData.hindiName}
                    onChange={(e) => setFormData({ ...formData, hindiName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Date & Day of Week */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <AppDatePicker
                    label="Date *"
                    value={formData.date}
                    onChange={(dStr) => handleFormDateChange(dStr)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Day of Week / Year
                  </label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      {formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '—'}
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-mono">
                      {formData.date ? new Date(formData.date + 'T00:00:00').getFullYear() : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Type & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Holiday Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
                  >
                    <option value="gazetted">Gazetted (GH) - Compulsory Closed</option>
                    <option value="restricted">Restricted (RH) - Optional List</option>
                    <option value="local">Local (LH) - Regional / Institute</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
                  >
                    <option value="National">National</option>
                    <option value="Religious">Religious</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Institutional">Institutional</option>
                    <option value="International">International</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Description / Significance
                </label>
                <textarea
                  rows={2}
                  placeholder="Details or historical note about this holiday..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>

              {/* Long Weekend Checkbox */}
              <label className="flex items-center space-x-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isLongWeekend}
                  onChange={(e) => setFormData({ ...formData, isLongWeekend: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Long Weekend (LW) Flag</span>
                  <span className="text-[11px] text-slate-500">Marks 3–4 days continuous break adjoining Saturday / Sunday.</span>
                </div>
              </label>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingHoliday ? 'Save Changes' : 'Create Holiday'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADMIN DELETE CONFIRMATION MODAL ================= */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-4 bg-rose-600 text-white flex items-center space-x-2.5">
              <div className="p-2 bg-white/20 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Delete Holiday Confirmation</h3>
                <p className="text-[11px] text-rose-100">Permanent removal from institute holiday calendar</p>
              </div>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700">
              <p>Are you sure you want to remove this holiday from the official schedule?</p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{deletingHoliday.name}</div>
                {deletingHoliday.hindiName && (
                  <div className="text-slate-500">{deletingHoliday.hindiName}</div>
                )}
                <div className="text-[11px] text-slate-600 flex items-center space-x-2 mt-1">
                  <span>📅 {deletingHoliday.date} ({deletingHoliday.dayOfWeek})</span>
                  <span>•</span>
                  <span className="font-semibold uppercase">{deletingHoliday.type}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingHoliday(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

