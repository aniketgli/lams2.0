import React from 'react';

/**
 * The switch between a page's views (Requests / Activity log, Directory / Activity logs …). One look everywhere: a grey
 * track with the chosen view raised in white. Page-level switches use text; pass `icon` for icon-only toggles in a toolbar.
 */
export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function SegmentedControl<V extends string>({ options, value, onChange, ariaLabel }: {
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="h-9 inline-flex items-center p-1 bg-slate-100/90 border border-slate-200/90 rounded-xl gap-1 shrink-0">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`h-7 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
            value === v ? 'bg-white text-primary shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
