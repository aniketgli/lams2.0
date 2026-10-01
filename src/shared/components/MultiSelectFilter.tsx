import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface MultiSelectFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: FilterOption[];
  selectedValues: string[]; // ['all'] or [] means All, or array of selected values e.g. ['dept1', 'dept2']
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  allLabel?: string;
  align?: 'left' | 'right' | 'auto';
}

export const matchesMultiSelect = (
  selectedValues: string[],
  itemValue: string | null | undefined
): boolean => {
  if (!selectedValues || selectedValues.length === 0 || selectedValues.includes('all')) {
    return true;
  }
  if (!itemValue) return false;
  return selectedValues.includes(itemValue);
};

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  icon,
  options,
  selectedValues,
  onChange,
  placeholder,
  className = '',
  allLabel = 'All',
  align = 'auto'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePopoverCoords = () => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const dropdownWidth = 280; // approximate width of w-64/w-72
    const spaceBelow = window.innerHeight - rect.bottom;

    let top = rect.bottom + 6;
    if (spaceBelow < 260 && rect.top > 280) {
      top = Math.max(8, rect.top - 280);
    }

    if (align === 'right' || window.innerWidth - rect.left < dropdownWidth + 16) {
      setCoords({
        top,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    } else {
      setCoords({
        top,
        left: Math.max(8, rect.left),
      });
    }
  };

  // Close dropdown on scroll or resize to prevent floating artifacts
  useEffect(() => {
    if (isOpen) {
      updatePopoverCoords();
      const handleScrollOrResize = (e: Event) => {
        if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
          return;
        }
        setIsOpen(false);
      };
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    } else {
      setSearchTerm('');
    }
  }, [isOpen, align]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
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

  const isAllSelected =
    !selectedValues ||
    selectedValues.length === 0 ||
    selectedValues.includes('all') ||
    selectedValues.length === options.length;

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleOption = (val: string) => {
    if (val === 'all') {
      onChange(['all']);
      return;
    }

    let current = selectedValues.filter((v) => v !== 'all');
    if (current.includes(val)) {
      current = current.filter((v) => v !== val);
    } else {
      current = [...current, val];
    }

    if (current.length === 0 || current.length === options.length) {
      onChange(['all']);
    } else {
      onChange(current);
    }
  };

  const handleSelectAll = () => {
    onChange(['all']);
  };

  // Determine trigger button display text
  const getDisplayText = () => {
    if (isAllSelected) {
      return `${label}: ${allLabel}`;
    }
    if (selectedValues.length === 1) {
      const opt = options.find((o) => o.value === selectedValues[0]);
      return `${label}: ${opt ? opt.label : selectedValues[0]}`;
    }
    return `${label}: (${selectedValues.length}) Selected`;
  };

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white hover:bg-slate-50 border ${
          isOpen
            ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/10'
            : !isAllSelected
            ? 'border-blue-500 bg-blue-50/50 text-blue-950 font-bold ring-1 ring-blue-500/20'
            : 'border-slate-300 text-slate-800 font-semibold hover:border-slate-400'
        } rounded-xl pl-8 pr-7 py-1.5 text-xs focus:outline-none cursor-pointer transition-all shadow-2xs text-left truncate flex items-center justify-between group h-9`}
        title={`${label}: Click to filter by multiple options`}
      >
        <span className="truncate flex items-center gap-1.5 text-xs">
          {getDisplayText()}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>
      {icon && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {icon}
        </span>
      )}

      {/* Popover Dropdown Portal */}
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
            className="z-[9999] w-48 sm:w-52 max-w-[calc(100vw-1rem)] bg-white border border-slate-200/90 rounded-2xl shadow-xl p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150 text-xs"
          >
            {/* Header & Quick Action */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-slate-800 text-xs truncate">
                  {label}
                </span>
                <span className="text-2xs font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full shrink-0">
                  {options.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className={`text-2xs font-bold transition-all cursor-pointer px-2 py-1 rounded-md shrink-0 ${
                  isAllSelected
                    ? 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                    : 'text-blue-600 bg-blue-50/80 hover:bg-blue-100'
                }`}
              >
                {isAllSelected ? 'Select All' : 'Reset to All'}
              </button>
            </div>

            {/* Search Input (Shown when options > 4) */}
            {options.length > 4 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={placeholder || `Search ${label.toLowerCase()}...`}
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1 text-xs">
              {/* Uniform 'All' Option (Checkbox on LEFT) */}
              <button
                type="button"
                onClick={() => handleToggleOption('all')}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl font-medium flex items-center cursor-pointer transition-all ${
                  isAllSelected
                    ? 'bg-blue-50/90 text-blue-950 font-semibold'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mr-2.5 transition-all ${
                    isAllSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className="truncate flex-1">
                  {allLabel} <span className="text-2xs text-slate-400 font-normal">({options.length})</span>
                </span>
              </button>

              {filteredOptions.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400 italic">
                  No matching results
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = !isAllSelected && selectedValues.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleToggleOption(opt.value)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl font-medium flex items-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50/90 text-blue-950 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mr-2.5 transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate flex-1">
                        {opt.label}
                        {opt.count !== undefined && (
                          <span className="text-2xs text-slate-400 font-normal ml-1">
                            ({opt.count})
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer note if multi-selected */}
            {!isAllSelected && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500 font-medium whitespace-nowrap">
                <span><strong>{selectedValues.length}</strong> selected</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-bold cursor-pointer transition-colors"
                >
                  Reset to All
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
