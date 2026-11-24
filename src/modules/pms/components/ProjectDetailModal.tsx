import React, { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Briefcase, FileText, Pencil, Upload } from 'lucide-react';
import { Button, Input, Modal } from '../../../shared/components';
import { AppSelect } from '../../../shared/components/AppSelect';
import { AppDatePicker } from '../../../shared/components/AppDatePicker';
import { ApiError } from '../../../shared/services/api';
import { Project, Stage, formatDay, formatRupees, projectsApi } from '../projectsApi';
import { StageBadge } from './StageBadge';

/**
 * A project's details. The RC office also edits it, moves its stage (the server applies the stage rules: some
 * moves need a reason, an extension a later end date) and uploads the proposal / sanction order (PDF, ≤ 8 MB).
 */
interface Props {
  project: Project | null;
  canEdit: boolean;
  stages: Record<Stage, string>;
  next: Record<Stage, Stage[]>;
  onClose: () => void;
  onEdit: (project: Project) => void;
  onChanged: (project: Project, message: string) => void;
}

const MAX_BYTES = 8 * 1024 * 1024;

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export const ProjectDetailModal: React.FC<Props> = ({ project, canEdit, stages, next, onClose, onEdit, onChanged }) => {
  const [to, setTo] = useState<Stage | ''>('');
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<'proposal' | 'sanction'>('proposal');

  useEffect(() => { setTo(''); setReason(''); setEndDate(''); setError(null); }, [project?.id, project?.stage]);
  if (!project) return null;

  const moveStage = async () => {
    if (!to) return;
    setBusy('stage'); setError(null);
    try {
      const r = await projectsApi.stage(project.id, { stage: to, reason: reason.trim() || undefined, endDate: to === 'extended' ? endDate : undefined });
      onChanged(r.project, r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The stage could not be changed.');
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('Use a PDF smaller than 8 MB.'); return; }
    setBusy(uploadKind); setError(null);
    try {
      const r = await projectsApi.upload(project.id, uploadKind, { name: file.name, data: await readAsDataUrl(file) });
      onChanged(r.project, r.message);
    } catch (e) {
      setError(e instanceof ApiError ? (e.details?.file ?? e.message) : 'The document could not be uploaded.');
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const rows: Array<[string, React.ReactNode]> = [
    ['Code', project.code], ['Short name', project.shortName ?? '—'], ['Category', project.categoryLabel ?? '—'],
    ['Funding agency', project.fundingAgency ?? '—'], ['Scheme / programme', project.scheme ?? '—'],
    ['Sanction order', project.sanctionOrderNo ? `${project.sanctionOrderNo}${project.sanctionDate ? ` · ${formatDay(project.sanctionDate)}` : ''}` : formatDay(project.sanctionDate)],
    ['Sanctioned amount', formatRupees(project.sanctionedAmount)],
    ['Duration', project.startDate || project.endDate ? `${formatDay(project.startDate)} to ${formatDay(project.endDate)}${project.durationMonths ? ` (${project.durationMonths} months)` : ''}` : '—'],
    ['PI', project.pi ? `${project.pi.name} (B.I. ${project.pi.biometricId})` : project.piName ?? '—'],
    ['Co-PI(s)', project.coPis.length ? project.coPis.map((c) => `${c.name} (B.I. ${c.biometricId})`).join(', ') : '—'],
    ['Department / Faculty', project.department ?? '—'], ['Site / State(s)', project.sites ?? '—'], ['Staff on the project', String(project.staff)],
  ];
  const needsReason = to === 'rejected' || to === 'closed' || to === 'extended'
    || (to && Object.keys(stages).indexOf(to) < Object.keys(stages).indexOf(project.stage) && !(project.stage === 'rejected' && to === 'proposed'));

  const doc = (kind: 'proposal' | 'sanction', label: string) => {
    const f = project.files[kind];
    return (
      <div className="flex items-center justify-between gap-2 border border-slate-200 rounded-xl px-3 py-2">
        <div className="min-w-0">
          <div className="font-bold text-slate-800">{label}</div>
          <div className="text-slate-500 truncate">{f ? `${f.name} · ${Math.round(f.size / 1024)} KB · ${new Date(f.uploadedAt).toLocaleDateString('en-IN')}` : 'Not uploaded'}</div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {f && <a href={projectsApi.fileUrl(project.id, kind)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"><FileText className="w-3.5 h-3.5" />View</a>}
          {canEdit && (
            <Button variant="outline" size="xs" leftIcon={<Upload className="w-3.5 h-3.5" />} loading={busy === kind}
              onClick={() => { setUploadKind(kind); fileInput.current?.click(); }}>{f ? 'Replace' : 'Upload'}</Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      icon={Briefcase}
      title={project.title}
      subtitle={`${project.code}${project.fundingAgency ? ` · ${project.fundingAgency}` : ''}`}
      footer={(
        <div className="flex justify-between gap-2 w-full">
          <div>{canEdit && <Button variant="outline" size="sm" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => onEdit(project)}>Edit</Button>}</div>
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      )}
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center gap-2"><span className="font-semibold text-slate-500">Stage</span><StageBadge stage={project.stage} label={project.stageLabel} /></div>
        {error && <div role="alert" className="px-3 py-2 rounded-xl border bg-error-subtle border-error-border text-error font-semibold">{error}</div>}
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {rows.map(([k, v]) => (
            <div key={k}><dt className="font-semibold text-slate-500">{k}</dt><dd className="text-slate-900 font-medium break-words">{v}</dd></div>
          ))}
        </dl>
        {(project.objectives || project.remarks) && (
          <div className="space-y-2">
            {project.objectives && <div><div className="font-semibold text-slate-500">Objectives / abstract</div><p className="text-slate-800 whitespace-pre-line">{project.objectives}</p></div>}
            {project.remarks && <div><div className="font-semibold text-slate-500">Remarks</div><p className="text-slate-800 whitespace-pre-line">{project.remarks}</p></div>}
          </div>
        )}

        <div className="space-y-2">
          <div className="font-bold text-slate-700">Documents</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {doc('proposal', 'Proposal')}
            {doc('sanction', 'Sanction order')}
          </div>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </div>

        {canEdit && next[project.stage]?.length > 0 && (
          <div className="border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="font-bold text-slate-700 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4" />Change stage</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <AppSelect value={to} onChange={(v) => setTo(v as Stage)} placeholder="Move to…"
                options={next[project.stage].map((s) => ({ value: s, label: s === project.stage ? `${stages[s]} again` : stages[s] }))} />
              {to === 'extended' && (
                <AppDatePicker value={endDate} minDate={project.endDate ?? undefined} isOpen={dateOpen} onToggle={() => setDateOpen((o) => !o)}
                  onChange={(d) => { setEndDate(d); setDateOpen(false); }} placeholder="New end date" />
              )}
              {needsReason && <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" size="sm" />}
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => void moveStage()} loading={busy === 'stage'} disabled={!to || (needsReason && !reason.trim()) || (to === 'extended' && !endDate)}>
                {to ? `Make it ${stages[to]}` : 'Change stage'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
