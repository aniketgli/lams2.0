import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info' | 'primary';

export interface AlertProps {
  variant?: AlertVariant;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onDismiss,
  action,
  icon,
  className = ''
}) => {
  const styles: Record<
    AlertVariant,
    { container: string; iconColor: string; titleColor: string; defaultIcon: React.ReactNode }
  > = {
    primary: {
      container: 'bg-[#eff6ff] border-[#bfdbfe] text-[#2563eb]',
      iconColor: 'text-[#2563eb]',
      titleColor: 'text-[#1e40af]',
      defaultIcon: <Info className="w-4 h-4 shrink-0 text-[#2563eb]" />
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      iconColor: 'text-emerald-700',
      titleColor: 'text-emerald-950',
      defaultIcon: <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-800',
      iconColor: 'text-amber-700',
      titleColor: 'text-amber-950',
      defaultIcon: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
    },
    error: {
      container: 'bg-rose-50 border-rose-200 text-rose-800',
      iconColor: 'text-rose-700',
      titleColor: 'text-rose-950',
      defaultIcon: <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      iconColor: 'text-blue-700',
      titleColor: 'text-blue-950',
      defaultIcon: <Info className="w-4 h-4 shrink-0 text-blue-600" />
    }
  };

  const currentStyle = styles[variant];

  const renderAlertIcon = () => {
    if (!icon) return currentStyle.defaultIcon;
    if (React.isValidElement(icon)) return icon;
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('$$typeof' in (icon as any) || 'render' in (icon as any)))
    ) {
      const Component = icon as any;
      return <Component className="w-4 h-4 shrink-0" />;
    }
    return null;
  };

  return (
    <div
      role="alert"
      className={`border rounded-xl p-3.5 shadow-2xs flex items-start gap-3 transition-all ${currentStyle.container} ${className}`}
    >
      <div className="shrink-0 mt-0.5">{renderAlertIcon()}</div>

      <div className="min-w-0 flex-1">
        {title && (
          <h5 className={`text-xs font-bold leading-tight ${currentStyle.titleColor}`}>
            {title}
          </h5>
        )}
        {children && (
          <div className={`text-xs mt-0.5 leading-relaxed font-normal opacity-90 ${title ? 'mt-1' : ''}`}>
            {children}
          </div>
        )}
        {action && <div className="mt-2 flex items-center space-x-2">{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
