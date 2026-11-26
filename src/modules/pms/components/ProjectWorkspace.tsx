import React, { useState } from 'react';
import { ArrowLeft, FileText, ListChecks, Users, Wallet } from 'lucide-react';
import type { Project, ProjectList, Stage } from '../projectsApi';
import { TabStrip } from '../../hrms/master/components/masterUi';
import { StageBadge } from './StageBadge';
import { ProjectDetailsPanel } from './ProjectDetailsPanel';
import { ProjectEmployeesPanel } from './ProjectEmployeesPanel';
import { ProjectFundsPanel } from './ProjectFundsPanel';
import { ProjectActivitiesPanel } from './ProjectActivitiesPanel';

/**
 * One project, opened from PMS → Projects: Details & documents, Employees, Funds, Activities. The RC office and the
 * project's PI change it (the PI cannot change the code, title, PI or stage); the PMS Auditor reads.
 */
type Tab = 'details' | 'employees' | 'funds' | 'activities';
const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'details', label: 'Details & documents', icon: FileText },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'funds', label: 'Funds', icon: Wallet },
  { id: 'activities', label: 'Activities', icon: ListChecks },
];

interface Props {
  project: Project;
  canEdit: boolean;
  canChangeStage: boolean;
  stages: Record<Stage, string>;
  next: ProjectList['next'];
  onBack: () => void;
  onEdit: (project: Project) => void;
  onChanged: (project: Project, message: string) => void;
  onMessage: (message: string) => void;
}

export const ProjectWorkspace: React.FC<Props> = ({ project, canEdit, canChangeStage, stages, next, onBack, onEdit, onChanged, onMessage }) => {
  const [tab, setTab] = useState<Tab>('details');
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
        <button type="button" onClick={onBack} aria-label="Back to the projects"
          className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">{project.code}</span>
            <StageBadge stage={project.stage} label={project.stageLabel} />
          </div>
          <h2 className="text-base font-extrabold text-slate-900 mt-1">{project.title}</h2>
          <p className="text-xs text-slate-500">PI: {project.pi ? `${project.pi.name} (B.I. ${project.pi.biometricId})` : project.piName ?? '—'}{project.fundingAgency ? ` · ${project.fundingAgency}` : ''}</p>
        </div>
      </div>
      <TabStrip tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'details' && (
        <ProjectDetailsPanel project={project} canEdit={canEdit} canChangeStage={canChangeStage} stages={stages} next={next}
          onEdit={onEdit} onChanged={onChanged} onMessage={onMessage} />
      )}
      {tab === 'employees' && <ProjectEmployeesPanel project={project} canEdit={canEdit} onMessage={onMessage} />}
      {tab === 'funds' && <ProjectFundsPanel project={project} canEdit={canEdit} onMessage={onMessage} />}
      {tab === 'activities' && <ProjectActivitiesPanel project={project} canEdit={canEdit} onMessage={onMessage} />}
    </div>
  );
};
