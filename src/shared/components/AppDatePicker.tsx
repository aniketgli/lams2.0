import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface AppDatePickerHoliday {
  date: string;
  name?: string;
  type?: string;
}

export interface AppDatePickerProps {
  label?: string;
  value: string; // 'YYYY-MM-DD'
  minDate?: string;
  maxDate?: string;
  onChange: (dateStr: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  restrictToStationLeave?: boolean; // Default false. If true, restricts to weekends & GH
  holidays?: AppDatePickerHoliday[];
  placeholder?: string;
  className?: string;
  isRightColumn?: boolean;
  size?: 'sm' | 'md';
}

const monthsList = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const AppDatePicker: React.FC<AppDatePickerProps> = ({
  label,
  value,
  minDate,
  maxDate,
  onChange,
  isOpen,
  onToggle,
  restrictToStationLeave = false,
  holidays = [],
  placeholder = 'Select Date',
  className = '',
  isRightColumn = false,
  size = 'md',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const openState = isOpen !== undefined ? isOpen : internalIsOpen;
  const toggleOpen = onToggle || (() => setInternalIsOpen(!internalIsOpen));

  const containerRef = useRef<HTMLDivElement>(null);
  const [pickerMode, setPickerMode] = useState<'days' | 'months'>('days');

  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(`${value}T12:00:00`);
    if (minDate) return new Date(`${minDate}T12:00:00`);
    return new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (openState) {
          if (onToggle) {
            onToggle();
          } else {
            setInternalIsOpen(false);
          }
        }
      }
    }
    if (openState) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openState, onToggle]);

  // Reset picker mode when closed
  useEffect(() => {
    if (!openState) {
      setPickerMode('days');
    }
  }, [openState]);

  // Keep viewDate synced if value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(`${value}T12:00:00`);
      if (!isNaN(d.getTime())) {
        setViewDate(d);
      }
    }
  }, [value]);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const changeYearBy = (delta: number) => {
    setViewDate(new Date(year + delta, month, 1));
  };

  const calendarCells = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push({ dateStr: '', dayNum: 0, isCurrentMonth: false, isEligible: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const moStr = String(month + 1).padStart(2, '0');
    const dyStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${moStr}-${dyStr}`;

    const d = new Date(`${dateStr}T12:00:00`);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const ghMatch = holidays.find((h) => h.date === dateStr && h.type === 'gazetted');

    const isBeforeMin = minDate ? dateStr < minDate : false;
    const isAfterMax = maxDate ? dateStr > maxDate : false;

    // Is date eligible / selectable?
    let isEligible = !isBeforeMin && !isAfterMax;
    if (restrictToStationLeave) {
      isEligible = isEligible && (isWeekend || !!ghMatch);
    }

    calendarCells.push({
      dateStr,
      dayNum: day,
      isCurrentMonth: true,
      isEligible,
      reason: isWeekend ? (dayOfWeek === 0 ? 'Sunday' : 'Saturday') : ghMatch?.name,
      ghName: ghMatch?.name,
      isWeekend,
    });
  }

  const selectedGh = value ? holidays.find((h) => h.date === value && h.type === 'gazetted') : null;
  const selectedDateObj = value ? new Date(`${value}T12:00:00`) : null;
  const isSelectedWeekend = selectedDateObj ? (selectedDateObj.getDay() === 0 || selectedDateObj.getDay() === 6) : false;

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block font-bold text-slate-800 text-xs tracking-tight mb-1">{label}</label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={toggleOpen}
          className={`w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl ${
            isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-xs'
          } text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex items-center justify-between cursor-pointer shadow-2xs transition-all text-left`}
        >
          {value ? (
            <div className="flex items-center space-x-2 truncate min-w-0 pr-1">
              <Calendar className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-indigo-600 shrink-0`} />
              <span className="truncate text-xs font-bold text-slate-900">
                {selectedDateObj && !isNaN(selectedDateObj.getTime())
                  ? selectedDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })
                  : value}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Calendar className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400 shrink-0`} />
              <span className="text-slate-400 font-medium text-xs">{placeholder}</span>
            </div>
          )}
          <ChevronDown className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400 shrink-0 transition-transform duration-200 ${openState ? 'rotate-180 text-indigo-600' : ''}`} />
        </button>

        {openState && (
          <div className={`absolute top-full mt-1 bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 w-[220px] sm:w-[230px] ring-1 ring-slate-900/5 animate-in fade-in zoom-in-95 duration-150 ${
            isRightColumn ? 'right-0' : 'left-0'
          }`}>
            {/* Header Controls */}
            {pickerMode === 'days' && (
              <div className="flex items-center justify-between bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setPickerMode('months')}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50 font-black text-xs text-slate-800 hover:text-indigo-600 transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                  title="Click to select month"
                >
                  <span>{monthsList[month]} {year}</span>
                  <ChevronDown className="w-3 h-3 text-indigo-500 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                  title="Next Month"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {pickerMode === 'months' && (
              <div className="flex items-center justify-between bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => changeYearBy(-1)}
                  className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                  title="Previous Year (-1 Year)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="font-black text-xs text-indigo-950 tracking-tight px-3 py-0.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                  {year}
                </span>

                <button
                  type="button"
                  onClick={() => changeYearBy(1)}
                  className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                  title="Next Year (+1 Year)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* View Modes */}
            {pickerMode === 'days' && (
              <>
                {/* Weekday Grid Labels */}
                <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider pb-0.5 border-b border-slate-100">
                  <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-0.5 text-xs">
                  {calendarCells.map((cell, idx) => {
                    if (!cell.isCurrentMonth) return <div key={`empty-${idx}`} className="h-6.5"></div>;
                    const isSelected = cell.dateStr === value;
                    if (!cell.isEligible) {
                      return (
                        <div
                          key={cell.dateStr}
                          title="Date Restricted"
                          className="h-6.5 rounded-md flex items-center justify-center text-[10.5px] text-slate-300 bg-transparent cursor-not-allowed select-none font-normal"
                        >
                          {cell.dayNum}
                        </div>
                      );
                    }

                    return (
                      <button
                        type="button"
                        key={cell.dateStr}
                        onClick={() => {
                          onChange(cell.dateStr);
                          if (onToggle) {
                            onToggle();
                          } else {
                            setInternalIsOpen(false);
                          }
                        }}
                        className={`h-6.5 rounded-md flex flex-col items-center justify-center text-[10.5px] font-bold transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-black shadow-xs scale-105 z-10 border-indigo-600'
                            : cell.ghName
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-300 hover:bg-emerald-600 hover:text-white shadow-2xs'
                            : cell.isWeekend
                            ? 'bg-indigo-50/80 text-indigo-900 border border-indigo-200/70 hover:bg-indigo-600 hover:text-white shadow-2xs'
                            : 'bg-slate-50 text-slate-800 border border-slate-200/60 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 shadow-2xs'
                        }`}
                        title={cell.ghName ? `Gazetted Holiday: ${cell.ghName}` : cell.reason ? `Weekend (${cell.reason})` : `Selectable Date`}
                      >
                        <span>{cell.dayNum}</span>
                        {cell.ghName && !isSelected && (
                          <span className="w-1 h-1 bg-emerald-600 rounded-full absolute bottom-0.5"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {pickerMode === 'months' && (
              <div className="space-y-2 py-1">
                <div className="grid grid-cols-3 gap-1.5">
                  {monthsList.map((m, idx) => {
                    const isCurrent = idx === month;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setViewDate(new Date(year, idx, 1));
                          setPickerMode('days');
                        }}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-600 text-white font-black shadow-xs scale-102 border-indigo-600'
                            : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200/70 shadow-2xs'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
