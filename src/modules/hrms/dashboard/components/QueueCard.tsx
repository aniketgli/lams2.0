import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { Queue } from '../dashboardApi';

export type QueueTone = 'indigo' | 'emerald' | 'blue' | 'amber';

const TONES: Record<QueueTone, { icon: string; button: string; badge: string }> = {
  indigo: { icon: 'text-indigo-600', button: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200/80', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  emerald: { icon: 'text-emerald-600', button: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/80', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  blue: { icon: 'text-blue-600', button: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200/80', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  amber: { icon: 'text-amber-600', button: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/80', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
};

interface QueueCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: QueueTone;
  queue: Queue;
  emptyText: string;
  onViewAll: () => void;
  /** Show who the request is from (managers); staff see their own. */
  showPerson?: boolean;
}

/** One pending-requests card of the dashboard: the first few requests and a link to the full screen. */
export const QueueCard: React.FC<QueueCardProps> = ({ title, icon: Icon, tone, queue, emptyText, onViewAll, showPerson = true }) => {
  const t = TONES[tone];
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${t.icon}`} />
          <span className="truncate">{title}</span>
        </h3>
        <button type="button" onClick={onViewAll}
          className={`font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer inline-flex items-center gap-1 border shrink-0 ml-2 whitespace-nowrap ${t.button}`}>
          View All ({queue.total}) <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {queue.items.length === 0 ? (
        <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 text-center text-slate-400 text-xs font-medium mt-4">{emptyText}</div>
      ) : (
        <div className="space-y-3 text-xs mt-4">
          {queue.items.map((item) => (
            <div key={item.id} className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                {showPerson ? (
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 text-xs block truncate">{item.name}</span>
                    <span className="text-slate-400 text-[11px] font-medium block truncate">{item.department}</span>
                  </div>
                ) : <span />}
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase shrink-0 ${t.badge}`}>{item.tag}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-slate-700 space-y-1">
                <p className="font-semibold text-slate-800">
                  {item.where ? `${item.where} · ` : ''}{item.when}{item.days != null ? ` (${item.days} ${item.days === 1 ? 'day' : 'days'})` : ''}
                </p>
                {item.text && <p className="italic text-slate-600 break-words">"{item.text}"</p>}
                {item.note && <p className="text-[11px] font-semibold text-amber-700">{item.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
