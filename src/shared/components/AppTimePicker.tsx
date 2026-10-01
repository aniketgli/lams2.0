import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown } from 'lucide-react';

export interface AppTimePickerProps {
  label?: string;
  value: string; // "HH:mm" (24-hour format e.g. "09:30")
  onChange: (timeStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right' | 'auto';
  stepMinute?: number; // default 5 or 1
}

export const AppTimePicker: React.FC<AppTimePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = '09:30',
  className = '',
  disabled = false,
  required = false,
  size = 'md',
  align = 'auto'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Parse "HH:mm"
  const parseTime = (val: string) => {
    if (!val) return { hour: '09', minute: '30' };
    const [h, m] = val.split(':');
    return {
      hour: (h || '09').padStart(2, '0'),
      minute: (m || '00').padStart(2, '0')
    };
  };

  const { hour: currentHour, minute: currentMinute } = parseTime(value);

  // Generate 00..23 hours and 00..59 minutes
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  // Minutes: 00..59 (all 60 minutes for precision)
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  }>({
    left: 0,
    width: 130
  });

  const updatePopoverCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const popoverHeight = 220;
    const openUpward = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    let top: number | undefined;
    let bottom: number | undefined;

    if (openUpward) {
      bottom = window.innerHeight - rect.top + 4;
      top = undefined;
    } else {
      top = rect.bottom + 4;
      bottom = undefined;
    }

    const popoverWidth = 140;
    let left: number;
    if (align === 'right' || window.innerWidth - rect.left < popoverWidth + 16) {
      left = Math.max(8, rect.right - popoverWidth);
    } else {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
    }

    setCoords({
      top,
      bottom,
      left,
      width: popoverWidth
    });
  }, [align]);

  useEffect(() => {
    if (isOpen) {
      updatePopoverCoords();
      const handleScrollOrResize = () => {
        updatePopoverCoords();
      };
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);

      // Auto-scroll selected hour & minute into view
      setTimeout(() => {
        if (hourListRef.current) {
          const selectedHourEl = hourListRef.current.querySelector('[data-selected="true"]') as HTMLElement;
          if (selectedHourEl) {
            hourListRef.current.scrollTop = selectedHourEl.offsetTop - hourListRef.current.offsetHeight / 2 + selectedHourEl.offsetHeight / 2;
          }
        }
        if (minuteListRef.current) {
          const selectedMinEl = minuteListRef.current.querySelector('[data-selected="true"]') as HTMLElement;
          if (selectedMinEl) {
            minuteListRef.current.scrollTop = selectedMinEl.offsetTop - minuteListRef.current.offsetHeight / 2 + selectedMinEl.offsetHeight / 2;
          }
        }
      }, 50);

      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen, updatePopoverCoords]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleHourSelect = (h: string) => {
    onChange(`${h}:${currentMinute}`);
  };

  const handleMinuteSelect = (m: string) => {
    onChange(`${currentHour}:${m}`);
  };

  const isSmall = size === 'sm';

  return (
    <div className={`relative inline-block w-full select-none ${className}`}>
      {label && (
        <label className="block font-bold text-slate-800 text-xs tracking-tight mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl ${
          isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
        } text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 flex items-center justify-between cursor-pointer shadow-2xs transition-all text-left ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
        }`}
      >
        <div className="flex items-center space-x-2 truncate min-w-0 pr-1">
          <Clock className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-blue-600 shrink-0`} />
          <span className={`font-mono text-xs font-bold ${!value ? 'text-slate-400' : 'text-slate-900'}`}>
            {value || placeholder}
          </span>
        </div>
        <ChevronDown
          className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              ...(coords.top !== undefined ? { top: `${coords.top}px` } : {}),
              ...(coords.bottom !== undefined ? { bottom: `${coords.bottom}px` } : {}),
              left: `${coords.left}px`,
              width: `${coords.width}px`
            }}
            className="z-[9999] bg-white border border-slate-200/90 rounded-xl shadow-xl overflow-hidden ring-1 ring-slate-900/5 animate-in fade-in zoom-in-95 duration-100 text-xs"
          >
            {/* Header Titles */}
            <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center py-1">
              <div>Hour</div>
              <div>Min</div>
            </div>

            {/* 2-Column Vertical Scroll List (Exact Match to User Reference Image) */}
            <div className="grid grid-cols-2 h-48 divide-x divide-slate-100 bg-white">
              {/* Left Column: Hours */}
              <div
                ref={hourListRef}
                className="overflow-y-auto no-scrollbar py-1 space-y-0.5"
              >
                {hours.map((h) => {
                  const isSelected = currentHour === h;
                  return (
                    <div
                      key={h}
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => handleHourSelect(h)}
                      className={`h-7 mx-1 rounded-md flex items-center justify-center font-mono font-bold text-xs cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-black shadow-2xs'
                          : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {h}
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Minutes */}
              <div
                ref={minuteListRef}
                className="overflow-y-auto no-scrollbar py-1 space-y-0.5"
              >
                {minutes.map((m) => {
                  const isSelected = currentMinute === m;
                  return (
                    <div
                      key={m}
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => handleMinuteSelect(m)}
                      className={`h-7 mx-1 rounded-md flex items-center justify-center font-mono font-bold text-xs cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-black shadow-2xs'
                          : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
