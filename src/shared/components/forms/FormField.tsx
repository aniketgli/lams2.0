import React from 'react';

export interface FormFieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  helperText?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  optional = false,
  helperText,
  error,
  className = '',
  children
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={htmlFor}
            className="block text-xs font-semibold text-slate-700 select-none"
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          {optional && !required && (
            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
          )}
        </div>
      )}

      {children}

      {error ? (
        <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-[11px] font-normal text-slate-500 mt-1 leading-normal">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
