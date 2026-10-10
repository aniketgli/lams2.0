import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X, Loader2 } from 'lucide-react';
import { AppSelectOption, AppSelectProps } from './AppSelect';

export interface SelectOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  value?: string | string[];
  onChange: (value: any) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  error?: string | boolean;
  helperText?: string;
  isMulti?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right' | 'auto';
  minSearchChars?: number;
}

const renderSelectIcon = (iconItem: any, className = 'w-3.5 h-3.5') => {
  if (!iconItem) return null;
  if (React.isValidElement(iconItem)) return iconItem;
  if (
    typeof iconItem === 'function' ||
    (typeof iconItem === 'object' && iconItem !== null && ('$$typeof' in iconItem || 'render' in iconItem))
  ) {
    const Component = iconItem;
    return <Component className={className} />;
  }
  if (typeof iconItem === 'string' || typeof iconItem === 'number') {
    return iconItem;
  }
  return null;
};

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  containerClassName = '',
  disabled = false,
  required = false,
  loading = false,
  error,
  helperText,
  isMulti = false,
  clearable = false,
  searchable,
  size = 'md',
  align = 'auto',
  minSearchChars
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    left: 0,
    width: 200,
    maxHeight: 240
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selectedValues: string[] = isMulti
    ? Array.isArray(value)
      ? value
      : value
      ? [value]
      : []
    : typeof value === 'string' && value
    ? [value]
    : [];

  const selectedOptions = normalizedOptions.filter((o) => selectedValues.includes(o.value));

  const showSearch = searchable !== undefined ? searchable : normalizedOptions.length > 7;

  const updatePopoverCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;

    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight: number;

    if (openUpward) {
      bottom = window.innerHeight - rect.top + 4;
      top = undefined;
      maxHeight = Math.min(260, Math.max(120, spaceAbove - 16));
    } else {
      top = rect.bottom + 4;
      bottom = undefined;
      maxHeight = Math.min(260, Math.max(120, spaceBelow - 16));
    }

    const targetWidth = rect.width;
    const popoverWidth = Math.min(Math.max(targetWidth, 180), window.innerWidth - 16);

    let left: number;
    if (align === 'right') {
      left = Math.max(8, rect.right - popoverWidth);
    } else {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
    }

    setCoords({
      top,
      bottom,
      left,
      width: popoverWidth,
      maxHeight
    });
  }, [align]);

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
    } else {
      setSearchTerm('');
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
      if (e.key === 'Escape') setIsOpen(false);
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

  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchTerm.trim()) return true;
    return (
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const handleToggleOption = (val: string) => {
    if (isMulti) {
      const exists = selectedValues.includes(val);
      const newValues = exists
        ? selectedValues.filter((v) => v !== val)
        : [...selectedValues, val];
      onChange(newValues);
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(isMulti ? [] : '');
  };

  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : undefined;

  const sizeClasses = {
    sm: 'h-8 text-xs px-2.5 rounded-lg',
    md: 'h-9 text-xs px-3 rounded-xl',
    lg: 'h-10 text-sm px-3.5 rounded-xl'
  };

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 select-none">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled || loading}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full bg-white border flex items-center justify-between transition-all outline-none font-medium text-slate-900 shadow-2xs select-none cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            hasError
              ? 'border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20'
              : isOpen
              ? 'border-blue-600 ring-2 ring-blue-600/20'
              : 'border-slate-300 hover:border-slate-400'
          } ${sizeClasses[size]} ${className}`}
        >
          <div className="flex items-center gap-1.5 truncate pr-2 min-w-0 flex-1 text-left">
            {loading ? (
              <span className="text-slate-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading...</span>
              </span>
            ) : selectedOptions.length === 0 ? (
              <span className="text-slate-400 font-normal truncate">{placeholder}</span>
            ) : isMulti ? (
              <div className="flex items-center gap-1 truncate flex-wrap">
                <span className="font-semibold text-slate-900 truncate">
                  {selectedOptions.map((o) => o.label).join(', ')}
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded-md border border-slate-200">
                  {selectedOptions.length}
                </span>
              </div>
            ) : (
              <span className="truncate flex items-center gap-2">
                {selectedOptions[0].icon && <span>{renderSelectIcon(selectedOptions[0].icon)}</span>}
                <span className="font-semibold">{selectedOptions[0].label}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-slate-400">
            {clearable && selectedOptions.length > 0 && !disabled && (
              <span
                onClick={handleClear}
                className="hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </div>
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
                width: `${coords.width}px`,
                maxHeight: `${coords.maxHeight}px`
              }}
              className="z-[9999] bg-white border border-slate-200/90 rounded-xl shadow-2xl overflow-hidden p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-xs flex flex-col"
            >
              {showSearch && (
                <div className="relative p-1 pb-1.5 border-b border-slate-100 shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                    className="w-full h-7 pl-8 pr-7 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <div
                style={{ maxHeight: `${coords.maxHeight - (showSearch ? 45 : 12)}px` }}
                className="overflow-y-auto space-y-0.5 no-scrollbar py-0.5 flex-1"
              >
                {searchTerm.trim().length > 0 && minSearchChars && searchTerm.trim().length < minSearchChars ? (
                  <div className="py-4 px-3 text-center text-xs text-blue-700 bg-blue-50/60 rounded-lg m-1 font-medium">
                    Type at least {minSearchChars} characters to search...
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 font-medium">
                    No matching options
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        disabled={opt.disabled}
                        onClick={() => handleToggleOption(opt.value)}
                        className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-between text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-[#2563eb] text-white font-bold shadow-2xs'
                            : 'text-slate-700 hover:bg-[#eff6ff] hover:text-[#2563eb]'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate pr-2 min-w-0">
                          {opt.icon && (
                            <span className={`shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                              {renderSelectIcon(opt.icon)}
                            </span>
                          )}
                          <div className="truncate">
                            <div className="truncate">{opt.label}</div>
                            {opt.description && (
                              <div
                                className={`text-[10px] font-medium truncate ${
                                  isSelected ? 'text-red-100' : 'text-slate-400'
                                }`}
                              >
                                {opt.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )}
      </div>

      {hasError && errorMessage ? (
        <p className="text-[11px] font-semibold text-rose-600 leading-tight">
          {errorMessage}
        </p>
      ) : helperText ? (
        <p className="text-[11px] font-normal text-slate-500 leading-tight">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
