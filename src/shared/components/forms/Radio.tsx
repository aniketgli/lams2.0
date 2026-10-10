import React from 'react';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  containerClassName?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      description,
      checked,
      disabled,
      className = '',
      containerClassName = '',
      onChange,
      id,
      ...rest
    },
    ref
  ) => {
    const generatedId = id || (typeof label === 'string' ? `radio-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

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
            type="radio"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only peer"
            {...rest}
          />
          <div
            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
              checked
                ? 'border-[#2563eb] bg-white shadow-2xs'
                : 'border-slate-300 bg-white peer-hover:border-slate-400 peer-focus:ring-2 peer-focus:ring-blue-600/20'
            } ${disabled ? 'bg-slate-100 border-slate-200' : ''} ${className}`}
          >
            {checked && <div className="w-2 h-2 rounded-full bg-[#2563eb]" />}
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
Radio.displayName = 'Radio';

export interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (val: string) => void;
  options: RadioOption[];
  direction?: 'vertical' | 'horizontal';
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  onChange,
  options,
  direction = 'vertical',
  className = ''
}) => {
  return (
    <div
      className={`flex ${
        direction === 'horizontal' ? 'flex-row flex-wrap gap-4' : 'flex-col space-y-2'
      } ${className}`}
    >
      {options.map((opt) => (
        <Radio
          key={opt.value}
          name={name}
          value={opt.value}
          checked={value === opt.value}
          disabled={opt.disabled}
          label={opt.label}
          description={opt.description}
          onChange={() => onChange(opt.value)}
        />
      ))}
    </div>
  );
};
