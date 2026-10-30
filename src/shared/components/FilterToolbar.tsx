import React from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import { ExportButtons, ExportButtonsProps } from './ExportButtons';

/**
 * The search / filter / export bar used above every list in the portal, so
 * each page has the same layout and only shows the parts it needs:
 *
 *   row 1  start (view switch, year…)                    Export CSV · Export PDF
 *   row 2  [ search ……………………………………… ]   Reset   [ view toggle ]
 *   row 3  filter · filter · filter …
 */

export interface ViewOption<V extends string> {
  value: V;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface FilterToolbarProps<V extends string = string> {
  start?: React.ReactNode;
  exports?: ExportButtonsProps | null;
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  /** Shown only when something is filtered. */
  onReset?: (() => void) | null;
  view?: { value: V; options: ViewOption<V>[]; onChange: (value: V) => void } | null;
  /** Filter controls; each is given the same width. */
  filters?: React.ReactNode[];
}

export function FilterToolbar<V extends string = string>({ start, exports, search, onReset, view, filters = [] }: FilterToolbarProps<V>) {
  const shownFilters = filters.filter(Boolean);
  const hasTop = Boolean(start) || Boolean(exports);
  const hasSearchRow = Boolean(search) || Boolean(onReset) || Boolean(view);

  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {hasTop && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${hasSearchRow || shownFilters.length ? 'border-b border-slate-100 pb-3.5' : ''}`}>
          <div className="flex flex-wrap items-center gap-2 min-w-0">{start}</div>
          {exports && <ExportButtons {...exports} />}
        </div>
      )}

      {hasSearchRow && (
        <div className="flex items-center gap-2.5">
          {search && (
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                maxLength={100}
                aria-label={search.placeholder}
                className="h-9 w-full pl-10 pr-9 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
              />
              {search.value && (
                <button type="button" onClick={() => search.onChange('')} aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {!search && <div className="flex-1" />}
          {onReset && (
            <button type="button" onClick={onReset} title="Clear search and filters"
              className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs">
              <RotateCcw className="w-3.5 h-3.5 text-primary" /> <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          {view && (
            <div className="h-9 flex items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0" role="tablist" aria-label="View">
              {view.options.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" role="tab" aria-selected={view.value === value} aria-label={label} title={label}
                  onClick={() => view.onChange(value)}
                  className={`h-7 px-2 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                    view.value === value ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' : 'text-slate-400 hover:text-slate-700'
                  }`}>
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shownFilters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {shownFilters.map((f, i) => <div key={i} className="min-w-0">{f}</div>)}
        </div>
      )}
    </section>
  );
}
