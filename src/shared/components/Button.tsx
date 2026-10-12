import React from 'react';
import { Loader2, LucideIcon } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'success'
  | 'danger'
  | 'link'
  | 'icon';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: LucideIcon | React.ReactNode;
  rightIcon?: LucideIcon | React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      loading = false,
      loadingText,
      fullWidth = false,
      disabled,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] disabled:active:scale-100';

    const sizeClasses: Record<ButtonSize, string> = {
      xs: 'h-7 px-2.5 text-[11px] rounded-lg gap-1',
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-9 px-4 text-xs rounded-xl gap-1.5 shadow-xs',
      lg: 'h-10 px-5 text-sm rounded-xl gap-2 shadow-xs'
    };

    const iconOnlySizes: Record<ButtonSize, string> = {
      xs: 'w-7 h-7 p-0 rounded-lg',
      sm: 'w-8 h-8 p-0 rounded-lg',
      md: 'w-9 h-9 p-0 rounded-xl shadow-xs',
      lg: 'w-10 h-10 p-0 rounded-xl shadow-xs'
    };

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white focus:ring-[#2563eb]/30 shadow-xs border border-transparent',
      secondary:
        'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white focus:ring-slate-900/30 shadow-xs border border-transparent',
      outline:
        'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 focus:ring-blue-600/20 shadow-2xs',
      ghost:
        'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 focus:ring-slate-400/20',
      success:
        'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white focus:ring-emerald-600/30 shadow-xs border border-transparent',
      danger:
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white focus:ring-rose-600/30 shadow-xs border border-transparent',
      link:
        'bg-transparent p-0 h-auto text-[#2563eb] hover:underline focus:ring-0 active:scale-100 shadow-none',
      icon:
        'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200/90 focus:ring-slate-400/20 shadow-2xs'
    };

    const isIconOnly = variant === 'icon' || (!children && (leftIcon || rightIcon));
    const effectiveSizeClass = isIconOnly ? iconOnlySizes[size] : sizeClasses[size];
    const widthClass = fullWidth ? 'w-full' : '';

    const renderIcon = (iconItem: LucideIcon | React.ReactNode) => {
      if (!iconItem) return null;
      const iconSize = size === 'xs' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-4.5 h-4.5' : 'w-4 h-4';
      if (React.isValidElement(iconItem)) {
        return <span className="shrink-0">{iconItem}</span>;
      }
      if (
        typeof iconItem === 'function' ||
        (typeof iconItem === 'object' && iconItem !== null && ('$$typeof' in (iconItem as any) || 'render' in (iconItem as any)))
      ) {
        const IconComponent = iconItem as any;
        return <IconComponent className={`${iconSize} shrink-0`} />;
      }
      if (typeof iconItem === 'string' || typeof iconItem === 'number') {
        return <span className="shrink-0">{iconItem}</span>;
      }
      return null;
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses[variant]} ${effectiveSizeClass} ${widthClass} ${className}`}
        {...rest}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            {loadingText && <span>{loadingText}</span>}
          </>
        ) : (
          <>
            {renderIcon(leftIcon)}
            {children && <span>{children}</span>}
            {renderIcon(rightIcon)}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
