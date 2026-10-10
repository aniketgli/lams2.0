import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface AppSelectOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | AppSelectOption)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  searchable?: boolean;
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

export const AppSelect: React.FC<AppSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
  size = 'md',
  searchable,
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

  const normalizedOptions: AppSelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selectedOpt = normalizedOptions.find((o) => o.value === value);

  // Auto enable search if > 7 options unless explicitly disabled
  const showSearch = searchable !== undefined ? searchable : normalizedOptions.length > 7;

  const updatePopoverCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Prefer opening downwards unless space below is tight and space above is larger
    const openUpward = spaceBelow < 170 && spaceAbove > spaceBelow;

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
    const popoverWidth = Math.min(targetWidth, window.innerWidth - 16);

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

  const sizeClasses =
    size === 'sm'
      ? 'h-8 px-2.5 py-1 text-xs'
      : size === 'lg'
      ? 'h-11 px-4 py-2 text-sm'
      : 'h-9 px-3 py-1.5 text-xs';

  const isMinCharConditionMet =
    !minSearchChars || searchTerm.trim().length === 0 || searchTerm.trim().length >= minSearchChars;

  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchTerm.trim()) return true;
    if (minSearchChars && searchTerm.trim().length < minSearchChars) return false;
    return (
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className={`relative inline-block w-full select-none ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full ${sizeClasses} bg-white hover:bg-slate-50 border ${
          isOpen
            ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/10'
            : 'border-slate-300 hover:border-slate-400'
        } rounded-xl font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200' : ''
        }`}
      >
        <div className="flex items-center space-x-2 truncate pr-2 min-w-0">
          {selectedOpt?.icon && <span className="shrink-0 text-slate-500">{renderSelectIcon(selectedOpt.icon)}</span>}
          <span className={`truncate text-xs font-semibold ${!selectedOpt ? 'text-slate-400' : 'text-slate-900'}`}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : 'group-hover:text-slate-600'
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
                  const isSelected = opt.value === value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-between text-left ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'text-slate-700 hover:bg-blue-50 hover:text-blue-900'
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
                              isSelected ? 'text-blue-100' : 'text-slate-400'
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
  );
};
