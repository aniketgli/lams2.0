import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
  Hash
} from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = ''
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className={`px-4 py-2.5 bg-slate-50/90 text-xs text-slate-600 select-none ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 items-center gap-2 w-full">
        {/* 1. Left Align: ONLY rows per page dropdown (Theme aligned custom popover) */}
        <div className="justify-self-start relative inline-block" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`h-8 px-3 bg-white border ${
              isDropdownOpen
                ? 'border-blue-500 ring-2 ring-blue-500/20'
                : 'border-slate-200/90 hover:border-slate-300'
            } rounded-xl font-bold text-slate-800 text-xs shadow-2xs flex items-center justify-between gap-2 transition-all cursor-pointer whitespace-nowrap`}
            title="Rows per page"
          >
            <span>{pageSize === 999999 ? `All (${totalItems})` : pageSize}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${isDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>

          {/* Theme-aligned floating menu (opens upwards above footer with robust width) */}
          {isDropdownOpen && (
            <div className="absolute bottom-full mb-1.5 left-0 z-50 w-32 min-w-[120px] bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="space-y-0.5">
                {pageSizeOptions.map((opt) => {
                  const isSelected = pageSize === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onPageSizeChange(opt);
                        onPageChange(1);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="whitespace-nowrap">{opt}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    onPageSizeChange(999999);
                    onPageChange(1);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 whitespace-nowrap transition-colors cursor-pointer border-t border-slate-100 mt-1 pt-1.5 ${
                    pageSize === 999999
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="whitespace-nowrap">All ({totalItems})</span>
                  {pageSize === 999999 && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Page Navigation: Right on mobile, Centre on tablet/desktop */}
        <div className="justify-self-end sm:justify-self-center flex items-center">
          <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* First Page */}
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1 sm:p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer shadow-2xs"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 sm:p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer shadow-2xs"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center space-x-1">
              {getPageNumbers().map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold select-none text-xs">
                      ...
                    </span>
                  );
                }
                const isCurrent = p === currentPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    disabled={totalPages <= 1}
                    className={`min-w-[26px] sm:min-w-[28px] h-7 px-1.5 sm:px-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 sm:p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer shadow-2xs"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 sm:p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer shadow-2xs"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Jump to Page Input for large records */}
            {totalPages > 5 && (
              <div className="hidden md:flex items-center space-x-1 pl-2 border-l border-slate-200 ml-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  placeholder="Page"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = Number((e.target as HTMLInputElement).value);
                      if (val >= 1 && val <= totalPages) {
                        onPageChange(val);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="w-12 h-7 bg-white border border-slate-300 rounded-lg text-center text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  title="Type page number and press Enter"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. Showing Records: Row 2 in mobile (col-span-2), Right aligned in desktop/tablet */}
        <div className="col-span-2 sm:col-span-1 justify-self-center sm:justify-self-end text-center sm:text-right text-slate-600 font-medium text-xs pt-1.5 border-t border-slate-200/60 sm:border-0 sm:pt-0 whitespace-nowrap">
          Showing <span className="font-extrabold text-slate-900">{startItem.toLocaleString()}</span> to{' '}
          <span className="font-extrabold text-slate-900">{endItem.toLocaleString()}</span> of{' '}
          <span className="font-extrabold text-blue-900">{totalItems.toLocaleString()}</span> records
        </div>
      </div>
    </div>
  );
};
