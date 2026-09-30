import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  rightAction?: React.ReactNode;
  action?: React.ReactNode;
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
    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 min-h-[82px] min-w-0">
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
          <p className="text-xs text-slate-300 mt-0.5 break-words">{subtitle}</p>
        </div>
      </div>
      {actions && (
        <div className="flex items-center space-x-2 shrink-0 flex-wrap w-full md:w-auto md:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};
