import React from 'react';
import { AppDatePicker, AppDatePickerProps, AppDatePickerHoliday } from './AppDatePicker';

export type { AppDatePickerHoliday };

export interface DatePickerProps extends AppDatePickerProps {
  error?: string | boolean;
  helperText?: string;
  containerClassName?: string;
  required?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  error,
  helperText,
  containerClassName = '',
  required = false,
  label,
  ...props
}) => {
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : undefined;

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 select-none">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      <AppDatePicker {...props} />

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
};
