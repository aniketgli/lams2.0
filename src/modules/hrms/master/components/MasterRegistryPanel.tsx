import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { Button, DataTable, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import {
  MasterCatalog, MasterDefinition, MasterInput, MasterRecord, MasterStatus, announceMastersChanged, masterApi,
} from '../masterApi';
import { ConfirmDialog, NoticeBar, PanelCard, StatusPill, TabStrip, formatDateTime, useNotice } from './masterUi';

/**
 * One screen for every registry master in a group ("profile" masters or
 * employee-form "lists"). Columns, form fields and dropdown sources all come
 * from the server catalog, so the screen never hard-codes a master.
 */

type StatusFilter = 'ALL' | MasterStatus;

interface Props {
  catalog: MasterCatalog;
  /** Limit to one group; omit to show every master. */
  group?: 'profile' | 'lists';
  readOnly: boolean;
}

const emptyInput = (def: MasterDefinition): MasterInput => ({
  name: '',
  code: '',
  status: 'ACTIVE',
  sortOrder: def.kind === 'lookup' ? 0 : undefined,
  fields: Object.fromEntries(def.fields.map((f) => [f.key, ''])),
});

export const MasterRegistryPanel: React.FC<Props> = ({ catalog, group, readOnly }) => {
  const masters = useMemo(() => catalog.masters.filter((m) => !group || m.group === group), [catalog, group]);
  const [activeKey, setActiveKey] = useState(masters[0]?.key ?? '');
  const def = masters.find((m) => m.key === activeKey) ?? masters[0];

  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [notice, showNotice, clearNotice] = useNotice();

  // Options for fields that point at another list/master (active values only).
  const [fieldOptions, setFieldOptions] = useState<Record<string, { label: string; value: string }[]>>({});

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MasterRecord | null>(null);
  const [form, setForm] = useState<MasterInput | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Status / delete confirmation
  const [confirm, setConfirm] = useState<{ kind: 'status' | 'delete'; record: MasterRecord } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!def) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      setRecords(await masterApi.list(def.key));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load records.');
    } finally {
      setLoading(false);
    }
  }, [def]);

  useEffect(() => {
    setSearch('');
    setStatusFilter('ALL');
    void load();
  }, [load]);

  // Load option lists the current master's fields depend on.
  useEffect(() => {
    if (!def) return;
    const needs = def.fields.filter((f) => f.type === 'lookup' || f.type === 'master');
    if (needs.length === 0) {
      setFieldOptions({});
      return;
    }
    let cancelled = false;
    masterApi.options().then((opts) => {
      if (cancelled) return;
      const out: Record<string, { label: string; value: string }[]> = {};
      for (const field of needs) {
        if (field.type === 'lookup') {
          const source = catalog.masters.find((m) => m.kind === 'lookup' && m.lookupType === field.lookupType);
          out[field.key] = (source ? opts[source.key] ?? [] : []).map((r) => ({ label: r.name, value: r.code }));
        } else {
          out[field.key] = (opts[field.masterKey!] ?? []).map((r) => ({ label: r.name, value: r.name }));
        }
      }
      setFieldOptions(out);
    }).catch(() => { if (!cancelled) setFieldOptions({}); });
    return () => { cancelled = true; };
  }, [def, catalog]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) =>
      (statusFilter === 'ALL' || r.status === statusFilter) &&
      (!term || r.name.toLowerCase().includes(term) || r.code.toLowerCase().includes(term) ||
        Object.values(r.fields).some((v) => v.toLowerCase().includes(term))));
  }, [records, search, statusFilter]);

  if (!def) return null;

  const labelFor = (fieldKey: string, value: string) => {
    if (!value) return '—';
    const field = def.fields.find((f) => f.key === fieldKey);
    if (field?.type === 'layout') return catalog.formLayouts.find((l) => l.code === value)?.name.split(' (')[0] ?? value;
    return fieldOptions[fieldKey]?.find((o) => o.value === value)?.label ?? value;
  };

  const columns: ColumnDef<MasterRecord>[] = [
    { key: 'name', header: 'Name', sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
    { key: 'code', header: 'Code', width: '14%', sortValue: (r) => r.code, render: (r) => <span className="font-mono text-[11px] text-slate-600">{r.code}</span> },
    ...def.fields.map<ColumnDef<MasterRecord>>((f) => ({
      key: `f:${f.key}`, header: f.label, width: '18%',
      sortValue: (r) => labelFor(f.key, r.fields[f.key]).replace(/^—$/, ''),
      render: (r) => <span className="text-slate-700">{labelFor(f.key, r.fields[f.key])}</span>,
    })),
    ...(def.kind === 'lookup' ? [{ key: 'sortOrder', header: 'Order', width: '8%', align: 'center' as const, sortValue: (r: MasterRecord) => r.sortOrder ?? 0, render: (r: MasterRecord) => r.sortOrder ?? 0 }] : []),
    { key: 'status', header: 'Status', width: '11%', sortValue: (r) => r.status, render: (r) => <StatusPill active={r.status === 'ACTIVE'} /> },
    { key: 'updatedAt', header: 'Last updated', width: '15%', sortValue: (r) => r.updatedAt, render: (r) => <span className="text-slate-500 whitespace-nowrap">{formatDateTime(r.updatedAt)}</span> },
    ...(readOnly ? [] : [{
      key: 'actions', header: 'Actions', width: '120px', align: 'right' as const,
      render: (r: MasterRecord) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="icon" size="sm" leftIcon={Pencil} aria-label={`Edit ${r.name}`} title="Edit" onClick={() => openEditor(r)} />
          <Button variant="icon" size="sm" leftIcon={Power} aria-label={r.status === 'ACTIVE' ? `Deactivate ${r.name}` : `Activate ${r.name}`} title={r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} onClick={() => { setConfirmError(null); setConfirm({ kind: 'status', record: r }); }} />
          <Button variant="icon" size="sm" leftIcon={Trash2} aria-label={`Delete ${r.name}`} title="Delete" className="text-error hover:bg-error-subtle" onClick={() => { setConfirmError(null); setConfirm({ kind: 'delete', record: r }); }} />
        </div>
      ),
    }]),
  ];

  function openEditor(record: MasterRecord | null) {
    setEditing(record);
    setForm(record
      ? { name: record.name, code: record.code, status: record.status, sortOrder: record.sortOrder, fields: { ...emptyInput(def).fields, ...record.fields } }
      : emptyInput(def));
    setFormErrors({});
    setFormMessage(null);
    setEditorOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    // Quick checks for obvious gaps; the server validates everything again.
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.code.trim()) errs.code = 'Code is required.';
    for (const f of def.fields) if (f.required && !form.fields[f.key]) errs[`fields.${f.key}`] = `${f.label} is required.`;
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    setFormMessage(null);
    try {
      const saved = editing ? await masterApi.update(def.key, editing.id, form) : await masterApi.create(def.key, form);
      setRecords((prev) => editing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setEditorOpen(false);
      announceMastersChanged();
      showNotice('success', `${def.noun} "${saved.name}" ${editing ? 'updated' : 'created'}.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormErrors(error.details ?? {});
        setFormMessage(error.message);
      } else {
        setFormMessage('Could not save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm(reason: string) {
    if (!confirm) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const { kind, record } = confirm;
    try {
      if (kind === 'delete') {
        await masterApi.remove(def.key, record.id, reason || undefined);
        setRecords((prev) => prev.filter((r) => r.id !== record.id));
        showNotice('success', `${def.noun} "${record.name}" deleted.`);
      } else {
        const next: MasterStatus = record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const saved = await masterApi.setStatus(def.key, record.id, next, reason || undefined);
        setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        showNotice('success', `${def.noun} "${record.name}" is now ${next === 'ACTIVE' ? 'active' : 'inactive'}.`);
      }
      announceMastersChanged();
      setConfirm(null);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : 'Could not complete the action.');
    } finally {
      setConfirmBusy(false);
    }
  }

  const err = (key: string) => formErrors[key];

  return (
    <div className="space-y-4">
      {masters.length > 1 && (
        <TabStrip size="sm" tabs={masters.map((m) => ({ id: m.key, label: m.label }))} value={def.key} onChange={setActiveKey} />
      )}

      <NoticeBar notice={notice} onClose={clearNotice} />

      <PanelCard
        title={def.label}
        description={def.description}
        count={records.length}
        actions={!readOnly && (
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => openEditor(null)}>Add {def.noun.toLowerCase()}</Button>
        )}
      >
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            aria-label="Search"
            placeholder="Search by name, code or details"
            leftIcon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="flex-1"
          />
          <div className="sm:w-44">
            <Select
              value={statusFilter}
              onChange={(v: StatusFilter) => setStatusFilter(v)}
              options={[{ label: 'All statuses', value: 'ALL' }, { label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }]}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          data={visible}
          loading={loading}
          error={loadError}
          keyExtractor={(r) => r.id}
          emptyTitle={records.length ? 'No matching records' : `No ${def.label.toLowerCase()} yet`}
          emptyDescription={records.length ? 'Try a different search or status.' : readOnly ? 'Nothing has been added yet.' : `Use "Add ${def.noun.toLowerCase()}" to create the first one.`}
        />
      </PanelCard>

      {/* Editor */}
      <Modal
        isOpen={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        size="md"
        title={editing ? `Edit ${def.noun.toLowerCase()}` : `Add ${def.noun.toLowerCase()}`}
        subtitle={editing ? `${editing.name} · ${editing.code}` : def.description}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="master-editor" loading={saving}>{editing ? 'Save changes' : `Add ${def.noun.toLowerCase()}`}</Button>
          </div>
        }
      >
        {form && (
          <form id="master-editor" onSubmit={save} className="space-y-4" noValidate>
            {formMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Name" required maxLength={255} value={form.name} error={err('name')}
                onChange={(e) => setForm({ ...form, name: e.target.value })} containerClassName="sm:col-span-2" />
              <Input label="Code" required maxLength={def.kind === 'lookup' ? 50 : 100} value={form.code} error={err('code')}
                disabled={def.kind === 'lookup' && Boolean(editing)}
                helperText={def.kind === 'lookup' ? (editing ? 'The code is stored on records and cannot be changed.' : 'Stored on records; it cannot be changed later.') : 'Saved in capital letters.'}
                onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Select label="Status" required value={form.status} error={err('status')}
                onChange={(v: MasterStatus) => setForm({ ...form, status: v })}
                options={[{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }]} />
              {def.fields.map((f) => {
                const value = form.fields[f.key] ?? '';
                const setValue = (v: string) => setForm({ ...form, fields: { ...form.fields, [f.key]: v } });
                if (f.type === 'text') {
                  return <Input key={f.key} label={f.label} required={f.required} maxLength={f.maxLength} placeholder={f.placeholder}
                    value={value} error={err(`fields.${f.key}`)} onChange={(e) => setValue(e.target.value)} />;
                }
                const options = f.type === 'layout'
                  ? catalog.formLayouts.map((l) => ({ label: l.name, value: l.code }))
                  : [...(fieldOptions[f.key] ?? [])];
                // Keep a current value visible even if its option was deactivated.
                if (value && !options.some((o) => o.value === value)) options.push({ label: `${value} (inactive)`, value });
                return <Select key={f.key} label={f.label} required={f.required} value={value} error={err(`fields.${f.key}`)}
                  placeholder={`Select ${f.label.toLowerCase()}`} onChange={(v: string) => setValue(v)} options={options} searchable={options.length > 8}
                  containerClassName={f.type === 'layout' ? 'sm:col-span-2' : undefined} />;
              })}
              {def.kind === 'lookup' && (
                <Input label="Display order" type="number" min={0} max={100000} value={String(form.sortOrder ?? 0)} error={err('sortOrder')}
                  helperText="Lower numbers appear first in dropdowns."
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
              )}
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        busy={confirmBusy}
        error={confirmError}
        danger={confirm?.kind === 'delete'}
        title={confirm?.kind === 'delete' ? `Delete ${def.noun.toLowerCase()}?` : confirm?.record.status === 'ACTIVE' ? `Deactivate ${def.noun.toLowerCase()}?` : `Activate ${def.noun.toLowerCase()}?`}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : confirm?.record.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        message={confirm?.kind === 'delete'
          ? <>“{confirm.record.name}” will be removed permanently. Records that use it block deletion; deactivate it instead in that case.</>
          : confirm?.record.status === 'ACTIVE'
            ? <>“{confirm?.record.name}” will no longer be offered in dropdowns. Records that already use it keep it.</>
            : <>“{confirm?.record.name}” will be offered in dropdowns again.</>}
        onConfirm={(reason) => void runConfirm(reason)}
        onCancel={() => !confirmBusy && setConfirm(null)}
      />
    </div>
  );
};
