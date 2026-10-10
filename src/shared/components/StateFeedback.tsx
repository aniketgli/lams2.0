import React from 'react';
import { Loader2, AlertCircle, Inbox, RefreshCw, LucideIcon } from 'lucide-react';
import { Button } from './Button';

/* -------------------------------------------------------------------------- */
/* LoadingState                                                               */
/* -------------------------------------------------------------------------- */

export interface LoadingStateProps {
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  fullHeight?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading...',
  description,
  size = 'md',
  fullHeight = false,
  className = ''
}) => {
  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center ${
        fullHeight ? 'min-h-[280px] h-full' : 'py-10'
      } ${className}`}
    >
      <Loader2 className={`${spinnerSizes[size]} animate-spin text-[#2563eb] mb-2.5`} />
      <p className="text-xs font-bold text-slate-800 tracking-tight">{title}</p>
      {description && (
        <p className="text-[11px] text-slate-500 mt-1 max-w-sm">{description}</p>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  circle = false,
  className = '',
  style,
  ...rest
}) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 ${
        circle ? 'rounded-full' : 'rounded-lg'
      } ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style
      }}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------- */
/* EmptyState                                                                 */
/* -------------------------------------------------------------------------- */

export interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}) => {
  const renderIcon = () => {
    if (!Icon) return <Inbox className="w-8 h-8 text-slate-300 stroke-[1.5]" />;
    if (React.isValidElement(Icon)) return Icon;
    if (
      typeof Icon === 'function' ||
      (typeof Icon === 'object' && Icon !== null && ('$$typeof' in (Icon as any) || 'render' in (Icon as any)))
    ) {
      const IconComponent = Icon as any;
      return <IconComponent className="w-8 h-8 text-slate-400 stroke-[1.5]" />;
    }
    return null;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white border border-slate-200/90 rounded-xl shadow-2xs ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mb-3.5 shadow-2xs">
        {renderIcon()}
      </div>

      <h4 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h4>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-md font-normal leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* ErrorState                                                                 */
/* -------------------------------------------------------------------------- */

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryText?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this view. Please try again.',
  onRetry,
  retryText = 'Try Again',
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-rose-50/30 border border-rose-200 rounded-xl ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mb-3 shadow-2xs">
        <AlertCircle className="w-6 h-6" />
      </div>

      <h4 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h4>
      <p className="text-xs text-slate-600 mt-1 max-w-md leading-relaxed">{message}</p>

      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {retryText}
          </Button>
        </div>
      )}
    </div>
  );
};
