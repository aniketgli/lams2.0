import React from 'react';
import { LucideIcon, X } from 'lucide-react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string | boolean;
  leftIcon?: LucideIcon | React.ReactNode;
  rightIcon?: LucideIcon | React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  clearable?: boolean;
  onClear?: () => void;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      size = 'md',
      clearable = false,
      onClear,
      disabled,
      required,
      className = '',
      containerClassName = '',
      value,
      onChange,
      id,
      ...rest
    },
    ref
  ) => {
    const generatedId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;

    const sizeClasses = {
      sm: 'h-8 text-xs px-2.5 rounded-lg',
      md: 'h-9 text-xs px-3 rounded-xl',
      lg: 'h-10 text-sm px-3.5 rounded-xl'
    };

    const renderIcon = (iconItem: LucideIcon | React.ReactNode, position: 'left' | 'right') => {
      if (!iconItem) return null;
      const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
      const posClass = position === 'left' ? 'left-3' : 'right-3';

      if (React.isValidElement(iconItem)) {
        return (
          <span className={`absolute ${posClass} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}>
            {iconItem}
          </span>
        );
      }

      if (
        typeof iconItem === 'function' ||
        (typeof iconItem === 'object' && iconItem !== null && ('$$typeof' in (iconItem as any) || 'render' in (iconItem as any)))
      ) {
        const IconComponent = iconItem as any;
        return (
          <span className={`absolute ${posClass} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}>
            <IconComponent className={sizeClass} />
          </span>
        );
      }

      if (typeof iconItem === 'string' || typeof iconItem === 'number') {
        return (
          <span className={`absolute ${posClass} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}>
            {iconItem}
          </span>
        );
      }

      return null;
    };

    const hasValue = value !== undefined && value !== null && value !== '';

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-xs font-semibold text-slate-700 select-none"
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {renderIcon(leftIcon, 'left')}

          <input
            ref={ref}
            id={generatedId}
            disabled={disabled}
            required={required}
            value={value}
            onChange={onChange}
            className={`w-full bg-white border transition-all outline-none font-medium text-slate-900 placeholder-slate-400 shadow-2xs ${
              hasError
                ? 'border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20'
                : 'border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'
            } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed select-none border-slate-200 shadow-none' : ''} ${
              sizeClasses[size]
            } ${leftIcon ? 'pl-9' : ''} ${
              rightIcon || (clearable && hasValue) ? 'pr-9' : ''
            } ${className}`}
            {...rest}
          />

          {clearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              aria-label="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {!clearable && renderIcon(rightIcon, 'right')}
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
  }
);

Input.displayName = 'Input';
