import React from 'react';
import type { Stage } from '../projectsApi';

const TONES: Record<Stage, string> = {
  proposed: 'bg-slate-50 text-slate-700 border-slate-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-sky-50 text-sky-700 border-sky-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  ongoing: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  extended: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-300',
};

/** A project's stage as a coloured pill. */
export const StageBadge: React.FC<{ stage: Stage; label: string }> = ({ stage, label }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${TONES[stage] ?? TONES.proposed}`}>{label}</span>
);
