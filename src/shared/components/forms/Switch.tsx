import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
  id
}) => {
  const generatedId = id || (typeof label === 'string' ? `switch-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const dimensions =
    size === 'sm'
      ? { track: 'w-8 h-4.5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-3.5' }
      : { track: 'w-10 h-5.5', thumb: 'w-4.5 h-4.5', translate: 'translate-x-4.5' };

  return (
    <label
      htmlFor={generatedId}
      className={`inline-flex items-start gap-2.5 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <div className="relative inline-flex items-center shrink-0 mt-0.5">
        <input
          id={generatedId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`${dimensions.track} rounded-full transition-colors duration-200 ease-in-out border border-slate-300 ${
            checked
              ? 'bg-[#2563eb] border-[#2563eb]'
              : 'bg-slate-200 hover:bg-slate-300'
          }`}
        >
          <span
            className={`block ${dimensions.thumb} rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out mt-0.5 ml-0.5 ${
              checked ? dimensions.translate : 'translate-x-0'
            }`}
          />
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
};
