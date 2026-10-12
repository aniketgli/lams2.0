import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string | boolean;
  maxCharacters?: number;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      maxCharacters,
      disabled,
      required,
      className = '',
      containerClassName = '',
      value,
      onChange,
      id,
      rows = 3,
      ...rest
    },
    ref
  ) => {
    const generatedId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;

    const currentCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={generatedId}
              className="block text-xs font-semibold text-slate-700 select-none"
            >
              {label}
              {required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
          )}

          {maxCharacters && (
            <span className={`text-[10px] font-mono ${
              currentCount > maxCharacters ? 'text-rose-600 font-bold' : 'text-slate-400'
            }`}>
              {currentCount} / {maxCharacters}
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          id={generatedId}
          rows={rows}
          disabled={disabled}
          required={required}
          value={value}
          onChange={onChange}
          className={`w-full p-3 bg-white border rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 transition-all outline-none shadow-2xs resize-y ${
            hasError
              ? 'border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20'
              : 'border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'
          } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : ''} ${className}`}
          {...rest}
        />

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

Textarea.displayName = 'Textarea';
