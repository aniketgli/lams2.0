import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';
import { User } from '../../../../shared/types/auth.types';
import {
  LEAVE_CYCLE_OPTIONS,
  isCalendarYearCadre,
  getUserLeaveCycleType,
  CadreAccountingCycle
} from '../utils/leaveCycleUtils';

interface LeaveCycleDropdownProps {
  selectedCycle: string; // '' means no cycle selected by default
  onChange: (cycle: string) => void;
  className?: string;
  userLeaveCycle?: CadreAccountingCycle;
  userEmploymentType?: string;
  targetUser?: User | null;
  isAdminInstitutionalView?: boolean;
}

export const LeaveCycleDropdown: React.FC<LeaveCycleDropdownProps> = ({
  selectedCycle,
  onChange,
  className = '',
  userLeaveCycle,
  userEmploymentType,
  targetUser,
  isAdminInstitutionalView = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Determine effective leave cycle for user: 'CY' (Calendar Year) or 'FY' (Financial Year)
  const effectiveCycle: CadreAccountingCycle =
    userLeaveCycle ||
    (targetUser
      ? getUserLeaveCycleType(targetUser)
      : userEmploymentType
      ? isCalendarYearCadre(userEmploymentType)
        ? 'CY'
        : 'FY'
      : 'CY');

  const updatePopoverCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 320;
    const spaceBelow = window.innerHeight - rect.bottom;

    let top = rect.bottom + 6;
    if (spaceBelow < 340 && rect.top > 340) {
      top = Math.max(8, rect.top - 340);
    }

    if (window.innerWidth - rect.left < dropdownWidth + 16) {
      setCoords({
        top,
        right: Math.max(8, window.innerWidth - rect.right)
      });
    } else {
      setCoords({
        top,
        left: Math.max(8, rect.left)
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePopoverCoords();
      const handleScrollOrResize = () => updatePopoverCoords();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const cyOptions = LEAVE_CYCLE_OPTIONS.filter((opt) => opt.group === 'CY');
  const fyOptions = LEAVE_CYCLE_OPTIONS.filter((opt) => opt.group === 'FY');

  // Filter options strictly matching the user's cadre cycle
  const availableOptions = isAdminInstitutionalView
    ? LEAVE_CYCLE_OPTIONS.filter((opt) => opt.group !== 'all')
    : effectiveCycle === 'CY'
    ? cyOptions
    : fyOptions;

  const selectedOption = availableOptions.find(
    (opt) =>
      opt.value === selectedCycle ||
      (selectedCycle && opt.value.replace(/^(CY-|FY-)/, '').startsWith(selectedCycle)) ||
      (selectedCycle && selectedCycle.replace(/^(CY-|FY-)/, '').startsWith(opt.value.replace(/^(CY-|FY-)/, '')))
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const cyclePrefixLabel = effectiveCycle === 'CY' ? 'Calendar Year:' : 'Financial Year:';
  const selectPlaceholder = effectiveCycle === 'CY' ? 'Select Calendar Year' : 'Select Financial Year';
  const clearButtonText =
    effectiveCycle === 'CY'
      ? 'Show All Calendar Years (Clear Filter)'
      : 'Show All Financial Years (Clear Filter)';

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      {/* Trigger Button matching Theme */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-9 px-3 bg-white border ${
          selectedCycle
            ? effectiveCycle === 'CY'
              ? 'border-indigo-500 bg-indigo-50/40 text-indigo-950 font-bold ring-1 ring-indigo-500/20'
              : 'border-teal-500 bg-teal-50/40 text-teal-950 font-bold ring-1 ring-teal-500/20'
            : 'border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
        } rounded-xl text-xs font-semibold shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all flex items-center justify-between gap-2 cursor-pointer`}
        title={`Filter by ${effectiveCycle === 'CY' ? 'Calendar Year (01 Jan – 31 Dec)' : 'Financial Year (01 Apr – 31 Mar)'}`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <Calendar
            className={`w-4 h-4 shrink-0 ${
              effectiveCycle === 'CY' ? 'text-indigo-600' : 'text-teal-600'
            }`}
          />
          <span className="text-slate-500 font-medium text-xs whitespace-nowrap">
            {isAdminInstitutionalView ? 'Year / Cycle:' : cyclePrefixLabel}
          </span>
          {selectedCycle ? (
            <span className="font-bold text-slate-900 text-xs truncate max-w-[190px] sm:max-w-[240px]">
              {selectedOption ? selectedOption.label.replace(' • Current Active', '') : selectedCycle}
            </span>
          ) : (
            <span className="text-slate-400 font-medium text-xs italic">{selectPlaceholder}</span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          {selectedCycle && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Clear Year filter"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? (effectiveCycle === 'CY' ? 'rotate-180 text-indigo-600' : 'rotate-180 text-teal-600') : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown Portal styled to theme */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              ...(coords.left !== undefined ? { left: `${coords.left}px` } : {}),
              ...(coords.right !== undefined ? { right: `${coords.right}px` } : {})
            }}
            className="z-[9999] w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200/90 rounded-2xl shadow-xl p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150 text-xs"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-1.5">
                <Calendar
                  className={`w-4 h-4 ${effectiveCycle === 'CY' ? 'text-indigo-600' : 'text-teal-600'}`}
                />
                <span className="font-bold text-slate-900 text-xs">
                  {isAdminInstitutionalView
                    ? 'Select Leave Cycle'
                    : effectiveCycle === 'CY'
                    ? 'Select Calendar Year'
                    : 'Select Financial Year'}
                </span>
              </div>
              {selectedCycle && (
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className="text-2xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Calendar Year (CY) Group - Rendered only if user is CY or in Admin Institutional view */}
            {(isAdminInstitutionalView || effectiveCycle === 'CY') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2.5 py-1 bg-indigo-50/80 border border-indigo-100/90 rounded-lg">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                    <span className="font-bold text-indigo-950 text-xs">Calendar Year (CY)</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                    01 Jan – 31 Dec
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 px-2.5 leading-tight">
                  Permanent &amp; Cadre Staff (CCS Leave Rules 1972)
                </p>

                <div className="space-y-0.5 pt-0.5">
                  {cyOptions.map((opt) => {
                    const isSelected =
                      selectedCycle === opt.value ||
                      (selectedCycle && opt.value.replace('CY-', '') === selectedCycle);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/90 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">{opt.label}</div>
                          <div className="text-[10px] text-slate-400">{opt.dateRangeText}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Divider if both shown */}
            {isAdminInstitutionalView && <div className="border-t border-slate-100" />}

            {/* Financial Year (FY) Group - Rendered only if user is FY or in Admin Institutional view */}
            {(isAdminInstitutionalView || effectiveCycle === 'FY') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2.5 py-1 bg-teal-50/80 border border-teal-100/90 rounded-lg">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0"></span>
                    <span className="font-bold text-teal-950 text-xs">Financial Year (FY)</span>
                  </div>
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                    01 Apr – 31 Mar
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 px-2.5 leading-tight">
                  Contractual, Project Scientists &amp; Research Fellows (Grant Basis)
                </p>

                <div className="space-y-0.5 pt-0.5">
                  {fyOptions.map((opt) => {
                    const isSelected =
                      selectedCycle === opt.value ||
                      (selectedCycle && opt.value.replace('FY-', '') === selectedCycle);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/90 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">{opt.label}</div>
                          <div className="text-[10px] text-slate-400">{opt.dateRangeText}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Option: Unfiltered / Show All */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  !selectedCycle
                    ? 'bg-slate-100 text-slate-800 border-slate-300 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{isAdminInstitutionalView ? 'Show All Cycles (Institutional Overview)' : clearButtonText}</span>
                {!selectedCycle && <Check className="w-3.5 h-3.5 text-slate-600" />}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
