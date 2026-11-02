import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  href?: string;
}

export interface PageHeaderProps {
  icon?: LucideIcon | any;
  title: string;
  subtitle?: string;
  badge?: string | { text: string; variant?: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral' };
  badgeColor?: string;
  rightAction?: React.ReactNode;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  rightAction,
  action
}) => {
  const HeaderIcon = Icon || Sparkles;
  const actions = rightAction || action;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 min-h-[82px] min-w-0">
      <div className="flex items-center space-x-3.5 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
          <HeaderIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2 min-w-0 flex-wrap">
            <h1 className="text-base font-bold text-white tracking-tight break-words">{title}</h1>
            {badge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex items-center justify-end space-x-2 shrink-0 flex-wrap w-full md:w-auto ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

/**
 * The buttons in a page header's top-right corner: the icon first, then the label (no "+" in the label).
 * `primary` is the page's main action; `secondary` (a second action next to it) is outlined for the dark header.
 */
export const PageHeaderButton: React.FC<{
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, onClick, variant = 'primary', title, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
      variant === 'primary'
        ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-blue-600'
        : 'bg-white/10 hover:bg-white/20 text-white border border-white/25'
    }`}
  >
    <Icon className="w-4 h-4" />
    <span>{children}</span>
  </button>
);
