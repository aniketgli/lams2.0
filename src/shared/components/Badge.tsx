import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'primary'
  | 'neutral';

export type PresetStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'draft'
  | 'submitted'
  | 'completed'
  | 'cancelled';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: PresetStatus;
  mode?: 'badge' | 'dot';
  size?: 'sm' | 'md';
  children?: React.ReactNode;
}

const STATUS_VARIANT_MAP: Record<PresetStatus, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  approved: { variant: 'success', label: 'Approved' },
  completed: { variant: 'success', label: 'Completed' },
  pending: { variant: 'warning', label: 'Pending' },
  draft: { variant: 'neutral', label: 'Draft' },
  submitted: { variant: 'info', label: 'Submitted' },
  inactive: { variant: 'neutral', label: 'Inactive' },
  rejected: { variant: 'error', label: 'Rejected' },
  cancelled: { variant: 'error', label: 'Cancelled' }
};

export const Badge: React.FC<BadgeProps> = ({
  variant,
  status,
  mode = 'badge',
  size = 'md',
  children,
  className = '',
  ...rest
}) => {
  const effectiveVariant: BadgeVariant =
    variant || (status ? STATUS_VARIANT_MAP[status].variant : 'neutral');
  const label = children || (status ? STATUS_VARIANT_MAP[status].label : null);

  if (mode === 'dot') {
    const dotColors: Record<BadgeVariant, string> = {
      success: 'bg-emerald-600',
      warning: 'bg-amber-500',
      error: 'bg-rose-600',
      info: 'bg-blue-600',
      primary: 'bg-[#2563eb]',
      neutral: 'bg-slate-400'
    };

    const textColors: Record<BadgeVariant, string> = {
      success: 'text-emerald-700',
      warning: 'text-amber-700',
      error: 'text-rose-700',
      info: 'text-blue-700',
      primary: 'text-[#2563eb]',
      neutral: 'text-slate-600'
    };

    const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';
    const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';

    return (
      <span
        className={`inline-flex items-center space-x-1.5 font-semibold ${textSize} ${textColors[effectiveVariant]} ${className}`}
        {...rest}
      >
        <span className={`${dotSize} rounded-full ${dotColors[effectiveVariant]} shrink-0`} />
        <span>{label}</span>
      </span>
    );
  }

  // Boxed badge variant (Zero-Pill: rounded-md, not rounded-full!)
  const badgeStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    primary: 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.2 text-[10px]' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-md border ${sizeClasses} ${badgeStyles[effectiveVariant]} ${className}`}
      {...rest}
    >
      {label}
    </span>
  );
};

export const StatusBadge = Badge;
export type StatusBadgeProps = BadgeProps;

