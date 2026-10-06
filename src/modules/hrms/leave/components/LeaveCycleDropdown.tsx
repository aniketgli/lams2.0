import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';
import { User } from '../../../../shared/types/auth.types';
import {
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

interface MinimalCycleOption {
  value: string;
  label: string;
  isCurrent?: boolean;
}

const CY_OPTIONS: MinimalCycleOption[] = [
  { value: 'CY-2026', label: '2026', isCurrent: true },
  { value: 'CY-2025', label: '2025' },
  { value: 'CY-2024', label: '2024' },
  { value: 'CY-2027', label: '2027' }
];

const FY_OPTIONS: MinimalCycleOption[] = [
  { value: 'FY-2026-27', label: '2026-27', isCurrent: true },
  { value: 'FY-2025-26', label: '2025-26' },
  { value: 'FY-2024-25', label: '2024-25' },
  { value: 'FY-2027-28', label: '2027-28' }
];

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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 144 });
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
    const dropdownWidth = Math.max(144, rect.width);
    const spaceBelow = window.innerHeight - rect.bottom;

    let top = rect.bottom + 4;
    if (spaceBelow < 200 && rect.top > 200) {
      top = Math.max(8, rect.top - 200);
    }

    let left = rect.left;
    if (window.innerWidth - rect.left < dropdownWidth + 16) {
      left = Math.max(8, window.innerWidth - dropdownWidth - 8);
    }

    setCoords({
      top,
      left,
      width: dropdownWidth
    });
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

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const getDisplayLabel = () => {
    if (!selectedCycle || selectedCycle === 'all') {
      return 'All Years';
    }

    const allOpts = [...CY_OPTIONS, ...FY_OPTIONS];
    const match = allOpts.find(
      (o) =>
        o.value === selectedCycle ||
        o.value.replace(/^(CY-|FY-)/, '') === selectedCycle ||
        selectedCycle.replace(/^(CY-|FY-)/, '') === o.value.replace(/^(CY-|FY-)/, '')
    );
    return match ? match.label : selectedCycle.replace(/^(CY-|FY-)/, '');
  };

  const isSelectedActive = Boolean(selectedCycle && selectedCycle !== 'all');

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      {/* Clean, Minimal Trigger Button matching Theme */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-9 px-3 w-36 bg-white hover:bg-slate-50 border ${
          isOpen
            ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/10'
            : isSelectedActive
            ? 'border-blue-500 bg-blue-50/30 text-blue-950 font-bold'
            : 'border-slate-200/90 text-slate-700 hover:border-slate-300'
        } rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center justify-between gap-1.5 cursor-pointer select-none`}
        title={`Filter by Year`}
      >
        <div className="flex items-center space-x-1.5 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate text-xs font-semibold text-slate-900">
            {getDisplayLabel()}
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          {isSelectedActive && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Clear Year filter"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown Portal: Exact Matching Width, Minimal, Generic */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`
            }}
            className="z-[9999] bg-white border border-slate-200/90 rounded-xl shadow-xl p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-xs"
          >
            {/* 1. All Option */}
            <button
              type="button"
              onClick={() => handleSelect('all')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                !selectedCycle || selectedCycle === 'all'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-100 font-medium'
              }`}
            >
              <span>All Years</span>
              {(!selectedCycle || selectedCycle === 'all') && (
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1.5" />
              )}
            </button>

            <div className="border-t border-slate-100 my-0.5" />

            {/* 2. Calendar Year Options (Shown for CY users or Admin Institutional Overview) */}
            {(isAdminInstitutionalView || effectiveCycle === 'CY') && (
              <div className="space-y-0.5">
                {isAdminInstitutionalView && (
                  <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Regular
                  </div>
                )}
                {CY_OPTIONS.map((opt) => {
                  const isSelected =
                    selectedCycle === opt.value ||
                    (selectedCycle && opt.value.replace('CY-', '') === selectedCycle);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>{opt.label}</span>
                        {opt.isCurrent && (
                          <span className="text-[9.5px] font-semibold px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1.5" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3. Financial Year Options (Shown for FY users or Admin Institutional Overview) */}
            {(isAdminInstitutionalView || effectiveCycle === 'FY') && (
              <div className="space-y-0.5">
                {isAdminInstitutionalView && (
                  <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1 border-t border-slate-100 mt-1">
                    Project
                  </div>
                )}
                {FY_OPTIONS.map((opt) => {
                  const isSelected =
                    selectedCycle === opt.value ||
                    (selectedCycle && opt.value.replace('FY-', '') === selectedCycle);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>{opt.label}</span>
                        {opt.isCurrent && (
                          <span className="text-[9.5px] font-semibold px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
