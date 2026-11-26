import React, { useCallback, useEffect, useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';
import { Button, DataTable, Input, Modal } from '../../../shared/components';
import type { ColumnDef } from '../../../shared/components';
import { AppSelect } from '../../../shared/components/AppSelect';
import { Textarea } from '../../../shared/components/forms/Textarea';
import { ApiError } from '../../../shared/services/api';
import { ConfirmDialog } from '../../hrms/master/components/masterUi';
import { Activity, ActivityList, ActivityStatus, Project, formatDay, projectsApi } from '../projectsApi';
import { DateField, ErrorLine, Field, Panel, RowActions } from './workspaceUi';

/** Activities / milestones of a project: dates, status and progress. Done ones go to the end. */
interface Props { project: Project; canEdit: boolean; onMessage: (m: string) => void }

const TONE: Record<ActivityStatus, string> = {
  planned: 'bg-slate-50 text-slate-700 border-slate-200',
  in_progress: 'bg-sky-50 text-sky-800 border-sky-200',
  on_hold: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

export const ProjectActivitiesPanel: React.FC<Props> = ({ project, canEdit, onMessage }) => {
  const [data, setData] = useState<ActivityList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Activity | 'new' | null>(null);
  const [removing, setRemoving] = useState<Activity | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await projectsApi.activities(project.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The activities could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [project.id]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (reason: string) => {
    if (!removing) return;
    setBusy(true); setRemoveError(null);
    try {
      setData(await projectsApi.deleteActivity(project.id, removing.id, reason));
      onMessage('The activity was removed.');
      setRemoving(null);
    } catch (e) {
      setRemoveError(e instanceof ApiError ? e.message : 'It could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<Activity>[] = [
    { key: 'title', header: 'Activity', sortValue: (a) => a.title, render: (a) => (
      <div><div className="font-semibold text-slate-900">{a.title}</div>{a.description && <div className="text-[11px] text-slate-500 whitespace-pre-line">{a.description}</div>}</div>
    ) },
    { key: 'dates', header: 'Start – due', sortValue: (a) => a.dueDate ?? '', render: (a) => {
      const late = a.status !== 'done' && a.dueDate && a.dueDate < today();
      return <div className="text-[11px] font-mono">{formatDay(a.startDate)}<div className={late ? 'text-error font-bold' : 'text-slate-600'}>{formatDay(a.dueDate)}{late ? ' · overdue' : ''}</div></div>;
    } },
    { key: 'status', header: 'Status', sortValue: (a) => a.statusLabel, render: (a) => <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${TONE[a.status]}`}>{a.statusLabel}</span> },
    { key: 'progress', header: 'Progress', sortValue: (a) => a.progress, render: (a) => (
      <div className="min-w-[90px]"><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${a.progress}%` }} /></div><div className="text-[11px] text-slate-600 mt-0.5">{a.progress}%</div></div>
    ) },
    ...(canEdit ? [{ key: 'actions', header: '', align: 'right' as const, render: (a: Activity) => <RowActions onEdit={() => setEditing(a)} onDelete={() => setRemoving(a)} /> }] : []),
  ];

  const list = data?.activities ?? [];
  const done = list.filter((a) => a.status === 'done').length;
  return (
    <Panel
      title={<span className="flex items-center gap-1.5"><ListChecks className="w-4 h-4" />Activities ({done} of {list.length} done)</span>}
      action={canEdit ? <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Add activity</Button> : undefined}
    >
      <div className="space-y-3">
        <ErrorLine text={error} />
        <DataTable columns={columns} data={list} loading={loading} keyExtractor={(a) => a.id}
          emptyTitle="No activities yet" emptyDescription={canEdit ? 'Add the activities and milestones of the project.' : undefined} />
      </div>
      {editing && (
        <ActivityModal project={project} activity={editing === 'new' ? null : editing} statuses={data?.statuses} onClose={() => setEditing(null)}
          onSaved={(d, m) => { setData(d); onMessage(m); setEditing(null); }} />
      )}
      <ConfirmDialog open={removing !== null} title="Remove this activity?" message={removing?.title ?? ''} confirmLabel="Remove" danger
        busy={busy} error={removeError} onConfirm={(r) => void remove(r)} onCancel={() => { setRemoving(null); setRemoveError(null); }} />
    </Panel>
  );
};

const ActivityModal: React.FC<{ project: Project; activity: Activity | null; statuses?: Record<ActivityStatus, string>; onClose: () => void; onSaved: (d: ActivityList, m: string) => void }> = ({ project, activity, statuses, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title: activity?.title ?? '', description: activity?.description ?? '', startDate: activity?.startDate ?? '', dueDate: activity?.dueDate ?? '',
    status: (activity?.status ?? 'planned') as ActivityStatus, progress: String(activity?.progress ?? 0),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true); setError(null); setErrors({});
    try {
      const d = await projectsApi.saveActivity(project.id, activity?.id ?? null, { ...form, progress: Number(form.progress || 0) });
      onSaved(d, activity ? 'The activity was saved.' : 'The activity was added.');
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.details ?? {}); setError(e.message); } else setError('It could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const labels = statuses ?? { planned: 'Planned', in_progress: 'In progress', on_hold: 'On hold', done: 'Done' };
  return (
    <Modal isOpen onClose={onClose} size="lg" icon={ListChecks} title={activity ? 'Edit activity' : 'Add activity'} subtitle={`${project.code} · ${project.title}`}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void save()}>Save</Button>
        </div>
      )}>
      <div className="space-y-3 text-xs">
        <ErrorLine text={error} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Activity / milestone" required error={errors.title} wide>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Camera-trap survey, phase 1" size="sm" />
          </Field>
          <Field label="Start date" error={errors.startDate}><DateField value={form.startDate} onChange={(v) => set('startDate', v)} /></Field>
          <Field label="Due date" error={errors.dueDate}><DateField value={form.dueDate} minDate={form.startDate || undefined} onChange={(v) => set('dueDate', v)} /></Field>
          <Field label="Status" error={errors.status}>
            <AppSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v as ActivityStatus, progress: v === 'done' ? '100' : f.progress }))}
              options={(Object.keys(labels) as ActivityStatus[]).map((s) => ({ value: s, label: labels[s] }))} />
          </Field>
          <Field label="Progress (%)" error={errors.progress}>
            <Input type="number" min={0} max={100} value={form.progress} onChange={(e) => set('progress', e.target.value)} size="sm" disabled={form.status === 'done'} />
          </Field>
          <div className="md:col-span-2">
            <Textarea label="Description" rows={3} maxLength={5000} value={form.description} onChange={(e) => set('description', e.target.value)} />
            {errors.description && <p className="mt-1 text-[11px] font-semibold text-error">{errors.description}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
};
