import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, FileText, Pencil, Plus, Upload } from 'lucide-react';
import { Button, Input, Modal } from '../../../shared/components';
import { AppSelect } from '../../../shared/components/AppSelect';
import { AppDatePicker } from '../../../shared/components/AppDatePicker';
import { ApiError } from '../../../shared/services/api';
import { PROJECT_FILE_MAX_BYTES as MAX_BYTES, Project, ProjectDocument, Stage, formatDay, formatRupees, projectsApi, readAsDataUrl } from '../projectsApi';
import { ConfirmDialog } from '../../hrms/master/components/masterUi';
import { StageBadge } from './StageBadge';
import { ErrorLine, Field, Panel, RowActions } from './workspaceUi';

/**
 * Details & documents of a project (first tab of its workspace). The RC office and the project's PI edit the details
 * and upload documents (the PI cannot change the code, title or PI); only the RC office moves the stage (the server
 * applies the stage rules: some moves need a reason, an extension a later end date). Documents: the proposal and the
 * sanction order, and any other PDF (≤ 8 MB each).
 */
interface Props {
  project: Project;
  /** Edit the details and upload documents: the RC office, or the project's PI. */
  canEdit: boolean;
  /** Move the stage: the RC office only. */
  canChangeStage: boolean;
  stages: Record<Stage, string>;
  next: Record<Stage, Stage[]>;
  onEdit: (project: Project) => void;
  onChanged: (project: Project, message: string) => void;
  onMessage: (message: string) => void;
}

export const ProjectDetailsPanel: React.FC<Props> = ({ project, canEdit, canChangeStage, stages, next, onEdit, onChanged, onMessage }) => {
  const [to, setTo] = useState<Stage | ''>('');
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<'proposal' | 'sanction'>('proposal');

  useEffect(() => { setTo(''); setReason(''); setEndDate(''); setError(null); }, [project.id, project.stage]);

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
    <div className="space-y-4">
      <Panel title="Details" action={canEdit ? <Button variant="outline" size="sm" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => onEdit(project)}>Edit details</Button> : undefined}>
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
          <div className="font-bold text-slate-700">Proposal and sanction order</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {doc('proposal', 'Proposal')}
            {doc('sanction', 'Sanction order')}
          </div>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </div>

        {canChangeStage && next[project.stage]?.length > 0 && (
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
      </Panel>
      <OtherDocuments project={project} canEdit={canEdit} onMessage={onMessage} />
    </div>
  );
};

/** Other documents of the project (PDF): progress reports, utilisation certificates, MoUs … */
const OtherDocuments: React.FC<{ project: Project; canEdit: boolean; onMessage: (m: string) => void }> = ({ project, canEdit, onMessage }) => {
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ProjectDocument | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setDocs((await projectsApi.documents(project.id)).documents); } catch (e) { setError(e instanceof ApiError ? e.message : 'The documents could not be loaded.'); }
  }, [project.id]);
  useEffect(() => { void load(); }, [load]);

  const upload = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('Use a PDF smaller than 8 MB.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await projectsApi.addDocument(project.id, { title: title.trim(), name: file.name, data: await readAsDataUrl(file) });
      setDocs(r.documents); onMessage(r.message); setAdding(false); setTitle(''); setFile(null);
    } catch (e) {
      setError(e instanceof ApiError ? (e.details?.file ?? e.details?.title ?? e.message) : 'The document could not be uploaded.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (reason: string) => {
    if (!removing) return;
    setBusy(true); setRemoveError(null);
    try {
      setDocs((await projectsApi.removeDocument(project.id, removing.id, reason)).documents); onMessage('The document was removed.'); setRemoving(null);
    } catch (e) {
      setRemoveError(e instanceof ApiError ? e.message : 'It could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={`Other documents (${docs.length})`} action={canEdit ? <Button variant="outline" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>Upload document</Button> : undefined}>
      <div className="space-y-2 text-xs">
        <ErrorLine text={error} />
        {docs.length === 0 && <p className="text-slate-500">No other documents. Progress reports, utilisation certificates, MoUs … can be kept here (PDF).</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-xl px-3 py-2">
            <div className="min-w-0">
              <div className="font-bold text-slate-800">{d.title}</div>
              <div className="text-slate-500 truncate">{d.fileName} · {Math.round(d.size / 1024)} KB · {new Date(d.uploadedAt).toLocaleDateString('en-IN')}{d.uploadedBy ? ` · ${d.uploadedBy}` : ''}</div>
            </div>
            <div className="flex gap-1.5 shrink-0 items-center">
              <a href={projectsApi.documentUrl(project.id, d.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"><FileText className="w-3.5 h-3.5" />View</a>
              {canEdit && <RowActions onDelete={() => setRemoving(d)} />}
            </div>
          </div>
        ))}
      </div>
      {adding && (
        <Modal isOpen onClose={() => setAdding(false)} size="md" icon={Upload} title="Upload a document" subtitle={`${project.code} · ${project.title}`}
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" size="sm" loading={busy} disabled={!file || !title.trim()} onClick={() => void upload()}>Upload</Button>
            </div>
          )}>
          <div className="space-y-3 text-xs">
            <ErrorLine text={error} />
            <Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Utilisation certificate 2025-26" size="sm" /></Field>
            <Field label="PDF file (up to 8 MB)" required>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-xs" />
            </Field>
          </div>
        </Modal>
      )}
      <ConfirmDialog open={removing !== null} title="Remove this document?" message={removing?.title ?? ''} confirmLabel="Remove" danger
        busy={busy} error={removeError} onConfirm={(r) => void remove(r)} onCancel={() => { setRemoving(null); setRemoveError(null); }} />
    </Panel>
  );
};
