import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'elevated' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...rest }, ref) => {
    const variantClasses = {
      default: 'bg-white border border-slate-200/90 shadow-xs',
      flat: 'bg-white border border-slate-200 shadow-none',
      elevated: 'bg-white border border-slate-200 shadow-md',
      subtle: 'bg-slate-50/70 border border-slate-200 shadow-2xs'
    };

    const paddingClasses = {
      none: '',
      sm: 'p-3.5',
      md: 'p-4 sm:p-5',
      lg: 'p-6'
    };

    return (
      <div
        ref={ref}
        className={`rounded-xl transition-all ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  divider?: boolean;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  actions,
  divider = false,
  className = '',
  ...rest
}) => {
  return (
    <div
      className={`px-5 py-4 border-b border-blue-900/40 bg-[#0a132b] text-white rounded-t-xl flex items-center justify-between gap-3 ${className}`}
      {...rest}
    >
      <div className="min-w-0 flex-1 text-white">{children}</div>
      {actions && <div className="shrink-0 flex items-center space-x-2">{actions}</div>}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <h3 className={`text-sm sm:text-base font-bold text-inherit tracking-tight ${className}`} {...rest}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <p className={`text-xs text-slate-500 mt-0.5 font-normal leading-relaxed ${className}`} {...rest}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`space-y-4 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div
    className={`pt-3 mt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/* MetricCard / StatCard Component (Used across dashboards & module metrics)   */
/* -------------------------------------------------------------------------- */

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'slate' | 'emerald' | 'amber' | 'rose' | 'blue';
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'slate',
  trend,
  onClick,
  className = ''
}) => {
  const variantsMap = {
    primary: {
      bg: 'bg-[#eff6ff]/60 border-[#bfdbfe]',
      titleColor: 'text-[#2563eb]',
      valueColor: 'text-[#1e40af]',
      iconBg: 'bg-[#dbeafe] border-[#bfdbfe] text-[#2563eb]',
      subColor: 'text-[#2563eb]'
    },
    slate: {
      bg: 'bg-white border-slate-200/90',
      titleColor: 'text-slate-600',
      valueColor: 'text-slate-900',
      iconBg: 'bg-slate-100 border-slate-200 text-slate-700',
      subColor: 'text-slate-500'
    },
    emerald: {
      bg: 'bg-emerald-50/60 border-emerald-200/90',
      titleColor: 'text-emerald-800',
      valueColor: 'text-emerald-950',
      iconBg: 'bg-emerald-100 border-emerald-300/80 text-emerald-700',
      subColor: 'text-emerald-700'
    },
    amber: {
      bg: 'bg-amber-50/60 border-amber-200/90',
      titleColor: 'text-amber-800',
      valueColor: 'text-amber-950',
      iconBg: 'bg-amber-100 border-amber-300/80 text-amber-700',
      subColor: 'text-amber-700'
    },
    rose: {
      bg: 'bg-rose-50/60 border-rose-200/90',
      titleColor: 'text-rose-800',
      valueColor: 'text-rose-950',
      iconBg: 'bg-rose-100 border-rose-300/80 text-rose-700',
      subColor: 'text-rose-700'
    },
    blue: {
      bg: 'bg-blue-50/60 border-blue-200/90',
      titleColor: 'text-blue-800',
      valueColor: 'text-blue-950',
      iconBg: 'bg-blue-100 border-blue-300/80 text-blue-700',
      subColor: 'text-blue-700'
    }
  };
  const styles = (variant && variantsMap[variant as keyof typeof variantsMap]) || variantsMap.slate;
  if (!styles) {
    return null; // Or handle error appropriately
  }

  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px] transition-all ${
        styles.bg
      } ${onClick ? 'cursor-pointer hover:shadow-xs hover:border-slate-300' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wider truncate ${styles.titleColor}`}>
            {title}
          </p>
          <p className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight ${styles.valueColor}`}>
            {value}
          </p>
        </div>
        {Icon && (
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs ${styles.iconBg}`}
          >
            {React.isValidElement(Icon) ? (
              Icon
            ) : typeof Icon === 'function' ||
              (typeof Icon === 'object' && Icon !== null && ('$$typeof' in (Icon as any) || 'render' in (Icon as any))) ? (
              <Icon className="w-4 h-4" />
            ) : null}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div
          className={`mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] sm:text-[11px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis ${styles.subColor}`}
        >
          {subtitle && <span className="truncate">{subtitle}</span>}
          {trend && (
            <span
              className={`font-bold ml-auto shrink-0 ${
                trend.isPositive ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
