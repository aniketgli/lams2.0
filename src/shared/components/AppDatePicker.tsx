import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

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

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pickerMode, setPickerMode] = useState<'days' | 'months' | 'years'>('days');

  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  }>({ left: 0, width: 240 });

  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(`${value}T12:00:00`);
    if (minDate) return new Date(`${minDate}T12:00:00`);
    return new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const updatePopoverCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number | undefined;
    let bottom: number | undefined;
    const popoverHeight = 275;

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      bottom = window.innerHeight - rect.top + 4;
      top = undefined;
    } else {
      top = rect.bottom + 4;
      bottom = undefined;
    }

    const popoverWidth = Math.min(250, window.innerWidth - 16);
    let left: number;
    if (isRightColumn) {
      left = Math.max(8, rect.right - popoverWidth);
    } else {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
    }

    setCoords({
      top,
      bottom,
      left,
      width: popoverWidth,
    });
  }, [isRightColumn]);

  useEffect(() => {
    if (openState) {
      updatePopoverCoords();
      const handleScrollOrResize = () => {
        updatePopoverCoords();
      };
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    } else {
      setPickerMode('days');
    }
  }, [openState, updatePopoverCoords]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
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

  const selectedDateObj = value ? new Date(`${value}T12:00:00`) : null;
  const isSmall = size === 'sm';

  // Year range calculation for year selection grid
  const startYear = Math.floor(year / 12) * 12;
  const yearsList = Array.from({ length: 12 }, (_, i) => startYear + i);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block font-bold text-slate-800 text-xs tracking-tight mb-1">{label}</label>
      )}

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          className={`w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl ${
            isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
          } text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex items-center justify-between cursor-pointer shadow-2xs transition-all text-left`}
        >
          {value ? (
            <div className="flex items-center space-x-2 truncate min-w-0 pr-1">
              <Calendar className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-indigo-600 shrink-0`} />
              <span className="truncate text-xs font-bold text-slate-900">
                {selectedDateObj && !isNaN(selectedDateObj.getTime())
                  ? selectedDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

        {openState && typeof document !== 'undefined' && createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl p-2.5 space-y-2 ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-150"
          >
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

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setPickerMode('months')}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50 font-black text-xs text-slate-800 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs"
                    title="Click to select month"
                  >
                    <span>{monthsList[month]}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerMode('years')}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50 font-black text-xs text-slate-800 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs"
                    title="Click to select year"
                  >
                    <span>{year}</span>
                  </button>
                </div>

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
              <div className="space-y-2 py-0.5">
                <div className="flex items-center justify-between bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => changeYearBy(-1)}
                    className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                    title="Previous Year (-1 Year)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPickerMode('years')}
                    className="font-black text-xs text-indigo-950 tracking-tight px-3 py-0.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs hover:text-indigo-600 cursor-pointer"
                    title="Select Year"
                  >
                    {year}
                  </button>

                  <button
                    type="button"
                    onClick={() => changeYearBy(1)}
                    className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                    title="Next Year (+1 Year)"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

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
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-600 text-white font-black shadow-xs border-indigo-600'
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

            {pickerMode === 'years' && (
              <div className="space-y-2 py-0.5">
                <div className="flex items-center justify-between bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => changeYearBy(-12)}
                    className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                    title="Previous 12 Years"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-black text-xs text-indigo-950 tracking-tight px-2 py-0.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                    {startYear} – {startYear + 11}
                  </span>

                  <button
                    type="button"
                    onClick={() => changeYearBy(12)}
                    className="p-1 rounded-md hover:bg-white text-slate-600 hover:text-indigo-600 cursor-pointer transition-all shadow-2xs"
                    title="Next 12 Years"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {yearsList.map((yr) => {
                    const isCurrent = yr === year;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setViewDate(new Date(yr, month, 1));
                          setPickerMode('months');
                        }}
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-600 text-white font-black shadow-xs border-indigo-600'
                            : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200/70 shadow-2xs'
                        }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Days Grid View */}
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

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  onChange(todayStr);
                  if (onToggle) onToggle();
                  else setInternalIsOpen(false);
                }}
                className="text-indigo-600 font-bold hover:underline cursor-pointer px-1"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    if (onToggle) onToggle();
                    else setInternalIsOpen(false);
                  }}
                  className="text-slate-400 hover:text-rose-500 font-semibold cursor-pointer px-1 flex items-center space-x-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

