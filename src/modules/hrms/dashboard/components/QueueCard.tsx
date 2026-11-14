import React from 'react';
import { ChevronRight } from 'lucide-react';
import { DataTable, type ColumnDef } from '../../../../shared/components';
import type { Queue, QueueItem } from '../dashboardApi';
import { KeepDates } from '../../../../shared/components/KeepDates';

interface QueueTableProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  queue: Queue;
  emptyTitle: string;
  onViewAll: () => void;
  /** Show who the request is from (managers); staff see their own. */
  showPerson?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-14 to 2026-11-15" → "14 Nov 2026 to 15 Nov 2026", as the other tables write dates. */
const prettyDates = (text: string) => text.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`);

/**
 * One pending-requests section: the first few requests in the shared table and a link to the full screen.
 * Every section uses the same fixed column widths, so the columns line up from one section to the next;
 * Reason takes the rest of the row.
 */
export const QueueTable: React.FC<QueueTableProps> = ({ title, icon: Icon, queue, emptyTitle, onViewAll, showPerson = true }) => {
  const columns: ColumnDef<QueueItem>[] = [
    ...(showPerson ? [{
      key: 'name', header: 'Employee', width: '15rem', sortValue: (i: QueueItem) => i.name,
      render: (i: QueueItem) => <div className="min-w-0"><div className="font-semibold text-slate-900 truncate" title={i.name}>{i.name}</div><div className="text-[11px] text-slate-500 truncate" title={`${i.department}${i.designation ? ` · ${i.designation}` : ''}`}>{i.department}{i.designation ? ` · ${i.designation}` : ''}</div></div>,
    }] : []),
    { key: 'tag', header: 'Type', width: '13rem', sortValue: (i) => i.tag, render: (i) => <span className="inline-flex max-w-full px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 whitespace-normal leading-snug">{i.tag}</span> },
    {
      key: 'when', header: 'Date', width: '14rem', sortValue: (i) => i.when,
      render: (i) => <div><div className="text-slate-800"><KeepDates text={prettyDates(i.when)} /></div>{(i.where || i.days != null) && <div className="text-[11px] text-slate-500">{[i.where, i.days != null ? `${i.days} ${i.days === 1 ? 'day' : 'days'}` : null].filter(Boolean).join(' · ')}</div>}</div>,
    },
    {
      key: 'text', header: 'Reason', render: (i) => <div className="text-slate-700 break-words">{i.text}{i.note && <div className="text-[11px] font-semibold text-amber-700 mt-0.5">{i.note}</div>}</div>,
    },
  ];
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0"><Icon className="w-4 h-4 text-primary shrink-0" /><span className="truncate">{title}</span></h3>
        <button type="button" onClick={onViewAll}
          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:text-primary hover:border-primary/40 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap">
          View all ({queue.total}) <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <DataTable columns={columns} data={queue.items} keyExtractor={(i) => i.id} emptyTitle={emptyTitle} emptyDescription="Nothing is waiting here right now." />
    </section>
  );
};
