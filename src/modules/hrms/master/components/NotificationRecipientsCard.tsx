import React, { useEffect, useState } from 'react';
import { Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, DataTable, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { MasterStatus, NotificationRecipient, RecipientInput, RecipientType, recipientApi } from '../masterApi';
import { ConfirmDialog, NoticeBar, PanelCard, StatusPill, useNotice } from './masterUi';

const TYPE_LABEL: Record<RecipientType, string> = {
  CC: 'CC (visible to recipients)',
  BCC: 'BCC (hidden from recipients)',
};

const blank = (): RecipientInput => ({ type: 'CC', email: '', name: '', status: 'ACTIVE' });

/**
 * Organization-wide CC / BCC addresses copied on every notification email
 * (leave, attendance, OD, ...). Security emails such as password resets are
 * never copied.
 */
export const NotificationRecipientsCard: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const [rows, setRows] = useState<NotificationRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [notice, showNotice, clearNotice] = useNotice();

  const [editing, setEditing] = useState<NotificationRecipient | null>(null);
  const [form, setForm] = useState<RecipientInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<NotificationRecipient | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    recipientApi.list()
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Could not load recipients.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const open = (r: NotificationRecipient | null) => {
    setEditing(r);
    setForm(r ? { type: r.type, email: r.email, name: r.name, status: r.status } : blank());
    setErrors({});
    setFormMessage(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErrors({ email: 'Enter a valid email address.' });
      return;
    }
    setSaving(true);
    setFormMessage(null);
    try {
      const payload = { ...form, email: form.email.trim() };
      const saved = editing ? await recipientApi.update(editing.id, payload) : await recipientApi.create(payload);
      setRows((prev) => (editing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved])
        .sort((a, b) => a.type.localeCompare(b.type) || a.email.localeCompare(b.email)));
      setForm(null);
      showNotice('success', `${saved.email} ${editing ? 'updated' : `added to ${saved.type}`}.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setFormMessage(error.message);
      } else setFormMessage('Could not save the recipient.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await recipientApi.remove(deleting.id, reason || undefined);
      setRows((prev) => prev.filter((r) => r.id !== deleting.id));
      showNotice('success', `${deleting.email} removed from ${deleting.type}.`);
      setDeleting(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not remove the recipient.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: ColumnDef<NotificationRecipient>[] = [
    { key: 'type', header: 'Copy as', width: '12%', render: (r) => <span className="inline-flex rounded-md bg-primary-subtle text-primary border border-primary-border px-2 py-0.5 text-[11px] font-semibold">{r.type}</span> },
    { key: 'email', header: 'Email', render: (r) => <span className="font-semibold text-slate-900">{r.email}</span> },
    { key: 'name', header: 'Name / purpose', render: (r) => <span className="text-slate-600">{r.name || '—'}</span> },
    { key: 'status', header: 'Status', width: '12%', render: (r) => <StatusPill active={r.status === 'ACTIVE'} /> },
    ...(readOnly ? [] : [{
      key: 'actions', header: 'Actions', width: '100px', align: 'right' as const,
      render: (r: NotificationRecipient) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="icon" size="sm" leftIcon={Pencil} title="Edit" aria-label={`Edit ${r.email}`} onClick={() => open(r)} />
          <Button variant="icon" size="sm" leftIcon={Trash2} title="Delete" aria-label={`Delete ${r.email}`} className="text-error hover:bg-error-subtle" onClick={() => { setDeleteError(null); setDeleting(r); }} />
        </div>
      ),
    }]),
  ];

  const set = <K extends keyof RecipientInput>(key: K, value: RecipientInput[K]) => form && setForm({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><Mail className="w-4 h-4 text-primary" />Email notification copies</>}
        description="These addresses receive a copy of every notification email (leave, attendance, OD, …). Password and other security emails are never copied."
        count={rows.length}
        actions={!readOnly && <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => open(null)}>Add email</Button>}
      >
        <DataTable columns={columns} data={rows} loading={loading} error={loadError} keyExtractor={(r) => r.id}
          emptyTitle="No CC or BCC emails" emptyDescription={readOnly ? 'Nothing has been added yet.' : 'Add an address to copy it on notification emails.'} />
      </PanelCard>

      <Modal
        isOpen={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size="sm"
        title={editing ? 'Edit CC / BCC email' : 'Add CC / BCC email'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="recipient-editor" loading={saving}>{editing ? 'Save changes' : 'Add email'}</Button>
          </div>
        }
      >
        {form && (
          <form id="recipient-editor" onSubmit={save} className="space-y-4" noValidate>
            {formMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}
            <Select label="Copy as" required value={form.type} error={errors.type} onChange={(v: RecipientType) => set('type', v)}
              options={(Object.keys(TYPE_LABEL) as RecipientType[]).map((value) => ({ label: TYPE_LABEL[value], value }))} />
            <Input label="Email" type="email" required maxLength={254} value={form.email} error={errors.email}
              autoComplete="off" onChange={(e) => set('email', e.target.value)} placeholder="name@wii.gov.in" />
            <Input label="Name / purpose" maxLength={255} value={form.name} error={errors.name}
              onChange={(e) => set('name', e.target.value)} placeholder="e.g. HR section" helperText="Optional" />
            <Select label="Status" required value={form.status} error={errors.status} onChange={(v: MasterStatus) => set('status', v)}
              options={[{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive (not copied)', value: 'INACTIVE' }]} />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        busy={deleteBusy}
        error={deleteError}
        title="Remove email?"
        confirmLabel="Remove"
        message={<>{deleting?.email} will no longer receive copies ({deleting?.type}) of notification emails.</>}
        onConfirm={(reason) => void remove(reason)}
        onCancel={() => !deleteBusy && setDeleting(null)}
      />
    </div>
  );
};
