import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, DataTable, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { LeaveGroupInput, LeaveGroupList, LeaveGroupRecord, leaveGroupApi } from '../../leave/leaveApi';
import { ConfirmDialog, NoticeBar, PanelCard, StatusPill, useNotice } from './masterUi';

/**
 * Leave groups: a name, a code, the leave year and the leave types of the group. An employee is put in
 * one group on the Add Employee form and takes leave only from that group's leave types.
 * Administrators change groups; everyone else sees them read-only. The server checks every field.
 */

const LEAVE_YEARS = [
  { label: 'Calendar year (1 Jan – 31 Dec)', value: 'CY' },
  { label: 'Financial year (1 Apr – 31 Mar)', value: 'FY' },
];

const blank = (): LeaveGroupInput => ({ name: '', code: '', leaveYear: 'CY', leaveTypeIds: [], status: 'active' });

export const LeaveGroupsPanel: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [data, setData] = useState<LeaveGroupList>({ groups: [], leaveTypes: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [notice, showNotice, clearNotice] = useNotice();

  const [editing, setEditing] = useState<LeaveGroupRecord | null>(null);
  const [form, setForm] = useState<LeaveGroupInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<LeaveGroupRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setData(await leaveGroupApi.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the leave groups.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = (record: LeaveGroupRecord | null) => {
    setEditing(record);
    setForm(record ? { name: record.name, code: record.code, leaveYear: record.leaveYear, leaveTypeIds: record.leaveTypeIds, status: record.status } : blank());
    setErrors({});
    setFormMessage(null);
  };

  const set = <K extends keyof LeaveGroupInput>(key: K, value: LeaveGroupInput[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((er) => (er[key as string] ? { ...er, [key as string]: '' } : er));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setFormMessage(null);
    try {
      const result = editing ? await leaveGroupApi.update(editing.id, form) : await leaveGroupApi.create(form);
      setForm(null);
      showNotice('success', result.message);
      await load();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setFormMessage(error.message);
      } else setFormMessage('Could not save the leave group.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await leaveGroupApi.remove(deleting.id, reason || undefined);
      setDeleting(null);
      showNotice('success', result.message);
      await load();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the leave group.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: ColumnDef<LeaveGroupRecord>[] = [
    { key: 'name', header: 'Name', width: '22%', sortValue: (g) => g.name, render: (g) => <span className="font-semibold text-slate-900">{g.name}</span> },
    { key: 'code', header: 'Code', width: '10%', sortValue: (g) => g.code, render: (g) => <span className="font-mono text-[11px] font-semibold text-slate-800">{g.code}</span> },
    { key: 'year', header: 'Leave year', width: '14%', sortValue: (g) => g.leaveYear, render: (g) => <span className="text-slate-700">{g.leaveYear === 'FY' ? 'Financial year' : 'Calendar year'}</span> },
    {
      key: 'leaves', header: 'Leaves', sortValue: (g) => g.leaves.length,
      render: (g) => (
        <div className="flex flex-wrap gap-1 whitespace-normal">
          {g.leaves.map((l) => <span key={l.id} title={l.name} className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700">{l.code}</span>)}
        </div>
      ),
    },
    { key: 'employees', header: 'Employees', width: '10%', align: 'center', sortValue: (g) => g.employeeCount, render: (g) => g.employeeCount },
    { key: 'status', header: 'Status', width: '10%', sortValue: (g) => g.status, render: (g) => <StatusPill active={g.status === 'active'} /> },
    ...(readOnly ? [] : [{
      key: 'actions', header: 'Actions', width: '100px', align: 'right' as const,
      render: (g: LeaveGroupRecord) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="icon" size="sm" leftIcon={Pencil} title="Edit" aria-label={`Edit ${g.name}`} onClick={() => open(g)} />
          <Button variant="icon" size="sm" leftIcon={Trash2} title="Delete" aria-label={`Delete ${g.name}`} className="text-error hover:bg-error-subtle"
            onClick={() => { setDeleteError(null); setDeleting(g); }} />
        </div>
      ),
    }]),
  ];

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><Layers className="w-4 h-4 text-primary" />Leave groups</>}
        count={data.groups.length}
        actions={!readOnly && <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => open(null)}>Add leave group</Button>}
      >
        <DataTable columns={columns} data={data.groups} loading={loading} error={loadError} keyExtractor={(g) => g.id}
          emptyTitle="No leave groups yet" emptyDescription={readOnly ? 'Nothing has been added yet.' : 'Add the first leave group, then choose it on the Add Employee form.'} />
      </PanelCard>

      <Modal
        isOpen={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size="md"
        title={editing ? 'Edit leave group' : 'Add leave group'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="leave-group-editor" loading={saving}>{editing ? 'Save changes' : 'Add leave group'}</Button>
          </div>
        }
      >
        {form && (
          <form id="leave-group-editor" onSubmit={save} className="space-y-4" noValidate>
            {formMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Name" required maxLength={100} value={form.name} placeholder="e.g. Permanent staff" error={errors.name} onChange={(e) => set('name', e.target.value)} containerClassName="sm:col-span-2" />
              <Input label="Code" required maxLength={20} value={form.code} placeholder="e.g. PERM" error={errors.code} onChange={(e) => set('code', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Leave year" required value={form.leaveYear} searchable={false} error={errors.leaveYear} onChange={(v: string) => set('leaveYear', v as 'CY' | 'FY')} options={LEAVE_YEARS} />
              <Select label="Status" required value={form.status} searchable={false} error={errors.status} onChange={(v: string) => set('status', v as 'active' | 'inactive')}
                options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} />
            </div>
            <Select label="Leaves" required isMulti value={form.leaveTypeIds} placeholder="Select leave types" error={errors.leaveTypeIds} onChange={(v: string[]) => set('leaveTypeIds', v)}
              options={data.leaveTypes.map((t) => ({ label: `${t.name} (${t.code})`, value: t.id }))} />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        busy={deleteBusy}
        error={deleteError}
        title="Delete leave group?"
        confirmLabel="Delete"
        message={<>“{deleting?.name}” will be removed permanently. A group that has employees cannot be deleted; make it Inactive instead.</>}
        onConfirm={(reason) => void remove(reason)}
        onCancel={() => !deleteBusy && setDeleting(null)}
      />
    </div>
  );
};
