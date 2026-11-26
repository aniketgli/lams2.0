import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, FolderPlus, Hourglass, IndianRupee, ListChecks, Upload } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DataTable } from '../../shared/components';
import type { ColumnDef } from '../../shared/components';
import { PageHeader, PageHeaderButton } from '../../shared/components/PageHeader';
import { SegmentedControl } from '../../shared/components/SegmentedControl';
import { FilterToolbar } from '../../shared/components/FilterToolbar';
import { MultiSelectFilter, matchesMultiSelect } from '../../shared/components/MultiSelectFilter';
import { ApiError } from '../../shared/services/api';
import { downloadCsvText, downloadTablePdf, printedAt, toCsvText } from '../../shared/services/printTable';
import { NoticeBar, useNotice } from '../hrms/master/components/masterUi';
import { Project, ProjectList, Stage, formatDay, formatRupees, projectsApi } from './projectsApi';
import { StageBadge } from './components/StageBadge';
import { ProjectFormModal } from './components/ProjectFormModal';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { ProjectImportModal } from './components/ProjectImportModal';
import { FundingAgenciesPanel } from './components/FundingAgenciesPanel';

/**
 * PMS → Projects: every project's record, kept by the RC office (the PMS Administrator), who creates, edits, imports
 * and moves the stage. Everyone else in PMS reads it. Funding agencies are kept on the second tab.
 */
const ACTIVE: Stage[] = ['ongoing', 'extended'];
const SANCTIONED: Stage[] = ['approved', 'ongoing', 'extended', 'completed', 'closed'];
const PIPELINE: Stage[] = ['proposed', 'under_review'];

export const ProjectsPage: React.FC = () => {
  const { currentUser } = useApp();
  const isRcOffice = currentUser.role === 'administrator';
  const [data, setData] = useState<ProjectList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useNotice();
  const [view, setView] = useState<'projects' | 'agencies'>('projects');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string[]>(['all']);
  const [agencyFilter, setAgencyFilter] = useState<string[]>(['all']);
  const [categoryFilter, setCategoryFilter] = useState<string[]>(['all']);
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const [viewing, setViewing] = useState<Project | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await projectsApi.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Projects could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const projects = data?.projects ?? [];
  const stages = data?.stages ?? ({} as Record<Stage, string>);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => matchesMultiSelect(stageFilter, p.stage) && matchesMultiSelect(agencyFilter, p.fundingAgencyId ?? '')
      && matchesMultiSelect(categoryFilter, p.category ?? '')
      && (!q || [p.code, p.title, p.shortName, p.piName, p.fundingAgency, p.department, p.scheme, p.sanctionOrderNo, ...p.coPis.map((c) => c.name)]
        .some((v) => String(v ?? '').toLowerCase().includes(q))));
  }, [projects, search, stageFilter, agencyFilter, categoryFilter]);

  const sum = (list: Project[]) => list.reduce((t, p) => t + (p.sanctionedAmount ?? 0), 0);
  const cards = [
    { label: 'Active projects', value: projects.filter((p) => ACTIVE.includes(p.stage)).length, note: 'Ongoing and extended', icon: Briefcase, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Total sanctioned', value: formatRupees(sum(projects.filter((p) => SANCTIONED.includes(p.stage)))), note: 'Approved onwards', icon: IndianRupee, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
    { label: 'In the pipeline', value: projects.filter((p) => PIPELINE.includes(p.stage)).length, note: 'Proposed and under review', icon: Hourglass, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Completed / closed', value: projects.filter((p) => p.stage === 'completed' || p.stage === 'closed').length, note: `${projects.length} project(s) in all`, icon: ListChecks, tone: 'text-primary bg-primary/10 border-primary/20' },
  ];

  const columns: ColumnDef<Project>[] = [
    { key: 'project', header: 'Project code & title', sortValue: (p) => p.code, render: (p) => (
      <div className="min-w-0">
        <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">{p.code}</span>
        <div className="font-semibold text-slate-900 mt-1">{p.title}</div>
        {p.staff > 0 && <div className="text-[11px] text-slate-500">{p.staff} staff on the project</div>}
      </div>
    ) },
    { key: 'pi', header: 'PI & funding agency', sortValue: (p) => p.piName ?? '', render: (p) => (
      <div className="text-xs">
        <div className="font-semibold text-slate-900">{p.piName ?? '—'}</div>
        {p.coPis.length > 0 && <div className="text-slate-500">Co-PI: {p.coPis.map((c) => c.name).join(', ')}</div>}
        <div className="text-primary">{p.fundingAgency ?? '—'}</div>
      </div>
    ) },
    { key: 'amount', header: 'Sanctioned', align: 'right', sortValue: (p) => p.sanctionedAmount ?? 0, render: (p) => <span className="font-semibold">{formatRupees(p.sanctionedAmount)}</span> },
    { key: 'duration', header: 'Duration', sortValue: (p) => p.startDate ?? '', render: (p) => (
      <div className="text-[11px] font-mono text-slate-700">{formatDay(p.startDate)}<div className="text-slate-400">to</div>{formatDay(p.endDate)}</div>
    ) },
    { key: 'stage', header: 'Stage', sortValue: (p) => p.stageLabel, render: (p) => <StageBadge stage={p.stage} label={p.stageLabel} /> },
  ];

  const exportHeaders = ['Code', 'Title', 'Category', 'Funding agency', 'Scheme', 'Sanction order', 'Sanction date', 'Sanctioned (₹)', 'Start', 'End', 'PI', 'Co-PIs', 'Department', 'Stage'];
  const exportRows = () => visible.map((p) => [p.code, p.title, p.categoryLabel ?? '', p.fundingAgency ?? '', p.scheme ?? '', p.sanctionOrderNo ?? '', formatDay(p.sanctionDate),
    p.sanctionedAmount ?? '', formatDay(p.startDate), formatDay(p.endDate), p.piName ?? '', p.coPis.map((c) => c.name).join('; '), p.department ?? '', p.stageLabel]);
  const now = new Date().toISOString();

  const viewSwitch = (
    <SegmentedControl ariaLabel="Projects views" value={view} onChange={setView}
      options={[{ value: 'projects', label: 'Projects' }, { value: 'agencies', label: 'Funding Agencies' }]} />
  );

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={Briefcase}
        title="Projects"
        subtitle={isRcOffice ? 'RC office: create, import and track every project from proposal to closure' : 'Research projects of the institute'}
        rightAction={isRcOffice && view === 'projects' ? (
          <div className="flex items-center gap-2">
            <PageHeaderButton icon={Upload} variant="secondary" onClick={() => setImporting(true)}>Import projects</PageHeaderButton>
            <PageHeaderButton icon={FolderPlus} onClick={() => setEditing('new')}>New project</PageHeaderButton>
          </div>
        ) : undefined}
      />
      <NoticeBar notice={notice} onClose={clearNotice} />
      {error && <div role="alert" className="px-4 py-3 rounded-2xl border text-xs font-semibold bg-error-subtle border-error-border text-error">{error}</div>}

      {view === 'agencies' ? (
        <FundingAgenciesPanel agencies={data?.agencies ?? []} canEdit={isRcOffice} toolbarStart={viewSwitch}
          onSaved={(m) => { showNotice('success', m); void load(true); }} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map(({ label, value, note, icon: Icon, tone }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 min-w-0">
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className="text-lg font-extrabold text-slate-900 truncate" title={String(value)}>{value}</p>
                  <p className="text-[11px] text-slate-500 truncate">{note}</p>
                </div>
              </div>
            ))}
          </div>

          <FilterToolbar
            start={viewSwitch}
            exports={{
              onCsv: () => downloadCsvText(toCsvText(exportHeaders, exportRows()), 'WII_Projects', { title: 'Projects', subtitle: [`${visible.length} project(s)`] }),
              onPdf: () => downloadTablePdf({ title: 'Projects', subtitle: [`${visible.length} project(s)`, printedAt(now)], headers: exportHeaders, rows: exportRows(), fileName: 'WII_Projects', landscape: true }),
              disabled: visible.length === 0, csvTitle: 'Download the projects shown below as CSV', pdfTitle: 'Print / save the projects shown below as PDF',
            }}
            search={{ value: search, onChange: setSearch, placeholder: 'Search code, title, PI, agency, department…' }}
            onReset={search || stageFilter[0] !== 'all' || agencyFilter[0] !== 'all' || categoryFilter[0] !== 'all'
              ? () => { setSearch(''); setStageFilter(['all']); setAgencyFilter(['all']); setCategoryFilter(['all']); } : null}
            filters={[
              <MultiSelectFilter key="stage" label="Stage" selectedValues={stageFilter} onChange={setStageFilter}
                options={Object.entries(stages).map(([value, label]) => ({ value, label }))} />,
              <MultiSelectFilter key="agency" label="Funding agency" selectedValues={agencyFilter} onChange={setAgencyFilter}
                options={(data?.agencies ?? []).map((a) => ({ value: a.id, label: a.name }))} />,
              <MultiSelectFilter key="category" label="Category" selectedValues={categoryFilter} onChange={setCategoryFilter}
                options={Object.entries(data?.categories ?? {}).map(([value, label]) => ({ value, label }))} />,
            ]}
          />

          <DataTable columns={columns} data={visible} loading={loading} keyExtractor={(p) => p.id} onRowClick={(p) => setViewing(p)}
            emptyTitle={projects.length ? 'No project matches' : 'No projects yet'}
            emptyDescription={projects.length ? 'Change the search or the filters.' : isRcOffice ? 'Create a project or import them from a CSV file.' : 'The RC office has not added any projects yet.'} />
        </>
      )}

      <ProjectFormModal open={editing !== null} project={editing === 'new' ? null : editing} agencies={data?.agencies ?? []} piOptions={data?.piOptions ?? []} stages={stages}
        categories={data?.categories ?? ({} as ProjectList['categories'])} onClose={() => setEditing(null)}
        onSaved={(p, m) => { setEditing(null); setViewing(p); showNotice('success', m); void load(true); }} />
      <ProjectDetailModal project={viewing} canEdit={isRcOffice} stages={stages} next={data?.next ?? ({} as ProjectList['next'])}
        onClose={() => setViewing(null)} onEdit={(p) => { setViewing(null); setEditing(p); }}
        onChanged={(p, m) => { setViewing(p); showNotice('success', m); void load(true); }} />
      {isRcOffice && <ProjectImportModal open={importing} onClose={() => setImporting(false)} onImported={(m) => { setImporting(false); showNotice('success', m); void load(true); }} />}
    </div>
  );
};
