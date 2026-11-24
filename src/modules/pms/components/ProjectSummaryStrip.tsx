import React, { useEffect, useState } from 'react';
import { Briefcase, Hourglass, IndianRupee, ListChecks } from 'lucide-react';
import { Project, formatRupees, projectsApi } from '../projectsApi';

/** PMS dashboard: the projects at a glance (above the attendance and leave of the dashboard). */
export const ProjectSummaryStrip: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => {
    let live = true;
    projectsApi.list().then((r) => { if (live) setProjects(r.projects); }).catch(() => { if (live) setProjects(null); });
    return () => { live = false; };
  }, []);
  if (!projects) return null;
  const count = (...stages: Project['stage'][]) => projects.filter((p) => stages.includes(p.stage)).length;
  const sanctioned = projects.filter((p) => ['approved', 'ongoing', 'extended', 'completed', 'closed'].includes(p.stage)).reduce((t, p) => t + (p.sanctionedAmount ?? 0), 0);
  const cards = [
    { label: 'Active projects', value: count('ongoing', 'extended'), note: 'Ongoing and extended', icon: Briefcase, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Total sanctioned', value: formatRupees(sanctioned), note: 'Approved onwards', icon: IndianRupee, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
    { label: 'In the pipeline', value: count('proposed', 'under_review'), note: 'Proposed and under review', icon: Hourglass, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Completed / closed', value: count('completed', 'closed'), note: `${projects.length} project(s) in all`, icon: ListChecks, tone: 'text-primary bg-primary/10 border-primary/20' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, note, icon: Icon, tone }) => (
        <button type="button" key={label} onClick={onOpen} className="text-left bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 min-w-0 hover:border-primary/40 cursor-pointer">
          <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-slate-500">{label}</span>
            <span className="block text-lg font-extrabold text-slate-900 truncate">{value}</span>
            <span className="block text-[11px] text-slate-500 truncate">{note}</span>
          </span>
        </button>
      ))}
    </div>
  );
};
