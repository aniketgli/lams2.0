import React from 'react';

export interface FormSectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  divider?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  actions,
  divider = true,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {(title || description || actions) && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          divider ? 'pb-3 border-b border-slate-100' : ''
        }`}>
          <div>
            {title && (
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                {title}
              </h4>
            )}
            {description && (
              <p className="text-xs text-slate-500 font-normal mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center space-x-2">{actions}</div>}
        </div>
      )}

      <div className="space-y-3">{children}</div>
    </div>
  );
};
