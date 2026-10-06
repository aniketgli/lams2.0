import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Check
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
  if (totalItems === 0) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) {
        setIsPageSizeOpen(false);
      }
    };
    if (isPageSizeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPageSizeOpen]);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 1) pages.push('...');
      if (totalPages > 1 && !pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={`w-full max-w-full px-4 py-3 bg-slate-50/80 border-t border-slate-200/80 text-xs text-slate-600 select-none ${className}`}>
      {/* Top Row: Rows per page button on the left, Navigation buttons on the right */}
      <div className="flex items-center justify-between gap-3 w-full">
        {/* Left: Page Size Popover Button (Opens UPWARD, exactly like in the reference image) */}
        <div ref={pageSizeRef} className="relative inline-block shrink-0">
          <button
            type="button"
            onClick={() => setIsPageSizeOpen((prev) => !prev)}
            className={`h-9 px-3.5 bg-white rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center space-x-2 ${
              isPageSizeOpen
                ? 'border-2 border-blue-500 text-slate-900 ring-2 ring-blue-500/15'
                : 'border border-slate-200/90 hover:border-slate-300 text-slate-800'
            }`}
            title="Rows per page"
          >
            <span>{pageSize >= 999999 ? `All (${totalItems})` : pageSize}</span>
            {isPageSizeOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500 stroke-[2.5]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />
            )}
          </button>

          {/* Upward Floating Popover matching reference image */}
          {isPageSizeOpen && (
            <div className="absolute left-0 bottom-full mb-2 z-50 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-1.5 min-w-[140px] w-max whitespace-nowrap animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
              {pageSizeOptions.map((opt) => {
                const isSelected = pageSize === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onPageSizeChange(opt);
                      onPageChange(1);
                      setIsPageSizeOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <span className="whitespace-nowrap">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5] shrink-0" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  onPageSizeChange(999999);
                  onPageChange(1);
                  setIsPageSizeOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  pageSize >= 999999
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <span className="whitespace-nowrap">All ({totalItems})</span>
                {pageSize >= 999999 && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5] shrink-0" />}
              </button>
            </div>
          )}
        </div>

        {/* Right: Navigation Controls (First, Prev, Page Numbers, Next, Last) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* First Page « */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:hover:bg-white text-slate-500 transition-colors cursor-pointer shadow-2xs shrink-0 flex items-center justify-center"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4 shrink-0" />
          </button>

          {/* Previous Page ‹ */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:hover:bg-white text-slate-500 transition-colors cursor-pointer shadow-2xs shrink-0 flex items-center justify-center"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </button>

          {/* Mobile Page Indicator (Visible on xs only) */}
          <div className="sm:hidden px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs whitespace-nowrap">
            {currentPage} / {totalPages}
          </div>

          {/* Page Numbers (Visible on sm+) */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {getPageNumbers().map((p, idx) => {
              if (typeof p === 'string') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold select-none text-xs shrink-0">
                    ...
                  </span>
                );
              }
              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p as number)}
                  disabled={totalPages <= 1}
                  className={`min-w-[32px] h-8 px-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next Page › */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:hover:bg-white text-slate-500 transition-colors cursor-pointer shadow-2xs shrink-0 flex items-center justify-center"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>

          {/* Last Page » */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:hover:bg-white text-slate-500 transition-colors cursor-pointer shadow-2xs shrink-0 flex items-center justify-center"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* Bottom Center: Showing X to Y of Z records with subtle divider */}
      <div className="pt-2.5 mt-2.5 border-t border-slate-200/60 text-center text-xs text-slate-600 font-medium">
        Showing <span className="font-extrabold text-slate-900">{startItem.toLocaleString()}</span> to{' '}
        <span className="font-extrabold text-slate-900">{endItem.toLocaleString()}</span> of{' '}
        <span className="font-extrabold text-blue-900">{totalItems.toLocaleString()}</span> records
      </div>
    </div>
  );
};
