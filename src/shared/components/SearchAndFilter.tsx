import React from 'react';
import { Search, X, Filter, RotateCcw, Check, Calendar } from 'lucide-react';
import { Button } from './Button';
import { AppDatePicker } from './AppDatePicker';

/* -------------------------------------------------------------------------- */
/* SearchBar                                                                  */
/* -------------------------------------------------------------------------- */

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search records...',
  size = 'md',
  className = '',
  autoFocus = false
}) => {
  const sizeClasses = {
    sm: 'h-8 text-xs pl-8 pr-7 rounded-lg',
    md: 'h-9 text-xs pl-9 pr-8 rounded-xl',
    lg: 'h-10 text-sm pl-10 pr-9 rounded-xl'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5 left-2.5',
    md: 'w-4 h-4 left-3',
    lg: 'w-4.5 h-4.5 left-3.5'
  };

  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search
        className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${iconSizes[size]}`}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 font-medium text-slate-900 placeholder-slate-400 outline-none transition-all shadow-2xs ${sizeClasses[size]}`}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Filter Buttons                                                             */
/* -------------------------------------------------------------------------- */

export interface FilterActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const ResetButton: React.FC<FilterActionButtonProps & { children?: React.ReactNode }> = ({
  onClick,
  disabled = false,
  className = '',
  children = 'Reset Filters'
}) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onClick}
    disabled={disabled}
    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
    className={className}
  >
    {children}
  </Button>
);

export const ApplyButton: React.FC<FilterActionButtonProps & { children?: React.ReactNode }> = ({
  onClick,
  disabled = false,
  className = '',
  children = 'Apply Filters'
}) => (
  <Button
    variant="primary"
    size="sm"
    onClick={onClick}
    disabled={disabled}
    leftIcon={<Check className="w-3.5 h-3.5" />}
    className={className}
  >
    {children}
  </Button>
);

/* -------------------------------------------------------------------------- */
/* DateRangeFilter                                                            */
/* -------------------------------------------------------------------------- */

export interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  startLabel?: string;
  endLabel?: string;
  className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = 'From Date',
  endLabel = 'To Date',
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row items-center gap-2 ${className}`}>
      <div className="w-full sm:w-auto">
        <AppDatePicker
          value={startDate}
          onChange={onStartDateChange}
          placeholder={startLabel}
          maxDate={endDate || undefined}
          size="sm"
        />
      </div>
      <span className="hidden sm:inline text-slate-400 text-xs font-bold">to</span>
      <div className="w-full sm:w-auto">
        <AppDatePicker
          value={endDate}
          onChange={onEndDateChange}
          placeholder={endLabel}
          minDate={startDate || undefined}
          size="sm"
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* FilterPanel                                                                */
/* -------------------------------------------------------------------------- */

export interface FilterPanelProps {
  title?: string;
  children: React.ReactNode;
  onReset?: () => void;
  onApply?: () => void;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  activeFilterCount?: number;
  className?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  title = 'Filters & Search',
  children,
  onReset,
  onApply,
  isCollapsible = false,
  defaultExpanded = true,
  activeFilterCount = 0,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className={`bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-bold text-slate-800 tracking-tight">{title}</h4>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] px-1.5 py-0.2 rounded-md">
              {activeFilterCount} active
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {isCollapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {children}
          </div>

          {onApply && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <ApplyButton onClick={onApply} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
