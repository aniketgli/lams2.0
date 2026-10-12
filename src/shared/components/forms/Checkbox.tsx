import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
  containerClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      checked,
      indeterminate,
      disabled,
      className = '',
      containerClassName = '',
      onChange,
      id,
      ...rest
    },
    ref
  ) => {
    const generatedId = id || (typeof label === 'string' ? `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <label
        htmlFor={generatedId}
        className={`inline-flex items-start gap-2.5 select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${containerClassName}`}
      >
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            ref={ref}
            id={generatedId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only peer"
            {...rest}
          />
          <div
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              checked || indeterminate
                ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-2xs'
                : 'bg-white border-slate-300 peer-hover:border-slate-400 peer-focus:ring-2 peer-focus:ring-blue-600/20'
            } ${disabled ? 'bg-slate-100 border-slate-200 text-slate-400' : ''} ${className}`}
          >
            {indeterminate ? (
              <Minus className="w-3 h-3 stroke-[3]" />
            ) : checked ? (
              <Check className="w-3 h-3 stroke-[3]" />
            ) : null}
          </div>
        </div>

        {(label || description) && (
          <div className="min-w-0 flex-1 leading-none">
            {label && (
              <span className="text-xs font-semibold text-slate-800 block">
                {label}
              </span>
            )}
            {description && (
              <span className="text-[11px] text-slate-500 font-normal mt-0.5 block leading-normal">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
