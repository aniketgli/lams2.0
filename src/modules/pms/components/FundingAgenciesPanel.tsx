import React, { useState } from 'react';
import { Landmark, Pencil, Plus } from 'lucide-react';
import { Button, DataTable, Input, Modal } from '../../../shared/components';
import type { ColumnDef } from '../../../shared/components';
import { AppSelect } from '../../../shared/components/AppSelect';
import { ApiError } from '../../../shared/services/api';
import { Agency, projectsApi } from '../projectsApi';

/** Funding agencies (DST, MoEFCC, NTCA …), chosen on the project form. The RC office adds, edits and deactivates them. */
interface Props { agencies: Agency[]; canEdit: boolean; onSaved: (message: string) => void; toolbarStart?: React.ReactNode }

export const FundingAgenciesPanel: React.FC<Props> = ({ agencies, canEdit, onSaved, toolbarStart }) => {
  const [editing, setEditing] = useState<Agency | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', code: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const open = (a: Agency | 'new') => {
    setEditing(a); setErrors({}); setMessage(null);
    setForm(a === 'new' ? { name: '', code: '', status: 'ACTIVE' } : { name: a.name, code: a.code, status: a.status });
  };
  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      const r = await projectsApi.saveAgency(editing && editing !== 'new' ? editing.id : null, form);
      setEditing(null);
      onSaved(r.message);
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.details ?? {}); setMessage(e.message); } else setMessage('Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<Agency>[] = [
    { key: 'name', header: 'Funding agency', sortValue: (a) => a.name, render: (a) => <span className="font-semibold text-slate-900">{a.name}</span> },
    { key: 'code', header: 'Code', sortValue: (a) => a.code, render: (a) => <span className="font-mono">{a.code}</span> },
    { key: 'projects', header: 'Projects', align: 'right', sortValue: (a) => a.projects, render: (a) => a.projects },
    { key: 'status', header: 'Status', sortValue: (a) => a.status, render: (a) => (
      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${a.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>{a.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
    ) },
    ...(canEdit ? [{ key: 'edit', header: '', align: 'right' as const, render: (a: Agency) => (
      <Button variant="icon" size="sm" aria-label={`Edit ${a.name}`} onClick={() => open(a)}><Pencil className="w-4 h-4" /></Button>
    ) }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">{toolbarStart}</div>
        {canEdit && <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => open('new')}>Add funding agency</Button>}
      </div>
      <DataTable columns={columns} data={agencies} keyExtractor={(a) => a.id} emptyTitle="No funding agencies" emptyDescription={canEdit ? 'Add the agencies that fund projects.' : 'The RC office has not added any yet.'} />
      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        size="md"
        icon={Landmark}
        title={editing === 'new' ? 'Add funding agency' : 'Edit funding agency'}
        footer={(
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => void save()} loading={busy}>Save</Button>
          </div>
        )}
      >
        <div className="space-y-3 text-xs">
          {message && <div role="alert" className="px-3 py-2 rounded-xl border bg-error-subtle border-error-border text-error font-semibold">{message}</div>}
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} placeholder="e.g. Department of Science and Technology" size="sm" />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} error={errors.code} placeholder="e.g. DST" size="sm" />
          <div>
            <label className="block text-slate-700 font-bold mb-1 text-xs">Status</label>
            <AppSelect value={form.status} onChange={(v) => setForm({ ...form, status: v as 'ACTIVE' | 'INACTIVE' })} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
          </div>
        </div>
      </Modal>
    </div>
  );
};
