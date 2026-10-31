import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cpu, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { Button, DataTable, Input, Modal, Select } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { MachineInput, MachinePurpose, MachineRecord, MasterStatus, machineApi } from '../masterApi';
import { ConfirmDialog, NoticeBar, PanelCard, StatusPill, useNotice } from './masterUi';

const PURPOSE_LABEL: Record<MachinePurpose, string> = {
  ATTENDANCE: 'Attendance',
  ACCESS: 'Access only',
  BOTH: 'Attendance & access',
};

const blankMachine = (): MachineInput => ({
  id: '', fullName: '', shortName: '', serialNumber: '', ipAddress: '', purpose: 'ATTENDANCE', status: 'ACTIVE',
});

export const BiometricMachinesPanel: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const [machines, setMachines] = useState<MachineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<'ALL' | MachinePurpose>('ALL');
  const [notice, showNotice, clearNotice] = useNotice();

  const [editing, setEditing] = useState<MachineRecord | null>(null);
  const [form, setForm] = useState<MachineInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState<{ kind: 'status' | 'delete'; machine: MachineRecord } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setMachines(await machineApi.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load biometric machines.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return machines.filter((m) =>
      (purposeFilter === 'ALL' || m.purpose === purposeFilter) &&
      (!term || [m.id, m.fullName, m.shortName, m.serialNumber, m.ipAddress].some((v) => v.toLowerCase().includes(term))));
  }, [machines, search, purposeFilter]);

  const open = (machine: MachineRecord | null) => {
    setEditing(machine);
    setForm(machine ? { id: machine.id, fullName: machine.fullName, shortName: machine.shortName, serialNumber: machine.serialNumber, ipAddress: machine.ipAddress, purpose: machine.purpose, status: machine.status } : blankMachine());
    setErrors({});
    setFormMessage(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormMessage(null);
    try {
      const saved = editing ? await machineApi.update(editing.id, form) : await machineApi.create(form);
      setMachines((prev) => editing ? prev.map((m) => (m.id === saved.id ? saved : m)) : [...prev, saved]);
      setForm(null);
      showNotice('success', `Machine "${saved.fullName}" ${editing ? 'updated' : 'added'}.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setFormMessage(error.message);
      } else setFormMessage('Could not save the machine.');
    } finally {
      setSaving(false);
    }
  };

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const { kind, machine } = confirm;
    try {
      if (kind === 'delete') {
        await machineApi.remove(machine.id, reason || undefined);
        setMachines((prev) => prev.filter((m) => m.id !== machine.id));
        showNotice('success', `Machine "${machine.fullName}" deleted.`);
      } else {
        const next: MasterStatus = machine.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const saved = await machineApi.setStatus(machine.id, next, reason || undefined);
        setMachines((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
        showNotice('success', `Machine "${machine.fullName}" is now ${next === 'ACTIVE' ? 'active' : 'inactive'}.`);
      }
      setConfirm(null);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : 'Could not complete the action.');
    } finally {
      setConfirmBusy(false);
    }
  };

  const columns: ColumnDef<MachineRecord>[] = [
    { key: 'id', header: 'Device ID', width: '11%', sortValue: (m) => m.id, render: (m) => <span className="font-mono text-[11px] font-semibold text-slate-800">{m.id}</span> },
    { key: 'fullName', header: 'Device', width: '22%', sortValue: (m) => m.fullName, render: (m) => <div><div className="font-semibold text-slate-900">{m.fullName}</div><div className="font-mono text-[11px] text-slate-500">{m.shortName}</div></div> },
    { key: 'serialNumber', header: 'Serial number', width: '15%', sortValue: (m) => m.serialNumber, render: (m) => <span className="font-mono text-[11px]">{m.serialNumber}</span> },
    { key: 'ipAddress', header: 'IP address', width: '13%', sortValue: (m) => m.ipAddress.split('.').map((x) => x.padStart(3, '0')).join('.'), render: (m) => <span className="font-mono text-[11px]">{m.ipAddress}</span> },
    { key: 'purpose', header: 'Purpose', width: '14%', sortValue: (m) => PURPOSE_LABEL[m.purpose], render: (m) => <span className="text-slate-700">{PURPOSE_LABEL[m.purpose]}</span> },
    { key: 'counts', header: 'Counts for attendance', width: '12%', align: 'center', sortValue: (m) => m.countsForAttendance, render: (m) => <span className={m.countsForAttendance ? 'text-success font-semibold' : 'text-slate-400'}>{m.countsForAttendance ? 'Yes' : 'No'}</span> },
    { key: 'status', header: 'Status', width: '10%', sortValue: (m) => m.status, render: (m) => <StatusPill active={m.status === 'ACTIVE'} /> },
    ...(readOnly ? [] : [{
      key: 'actions', header: 'Actions', width: '120px', align: 'right' as const,
      render: (m: MachineRecord) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="icon" size="sm" leftIcon={Pencil} title="Edit" aria-label={`Edit ${m.fullName}`} onClick={() => open(m)} />
          <Button variant="icon" size="sm" leftIcon={Power} title={m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} aria-label={`${m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${m.fullName}`} onClick={() => { setConfirmError(null); setConfirm({ kind: 'status', machine: m }); }} />
          <Button variant="icon" size="sm" leftIcon={Trash2} title="Delete" aria-label={`Delete ${m.fullName}`} className="text-error hover:bg-error-subtle" onClick={() => { setConfirmError(null); setConfirm({ kind: 'delete', machine: m }); }} />
        </div>
      ),
    }]),
  ];

  const set = <K extends keyof MachineInput>(key: K, value: MachineInput[K]) => form && setForm({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><Cpu className="w-4 h-4 text-primary" />Biometric Machines</>}
        count={machines.length}
        actions={!readOnly && <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => open(null)}>Add machine</Button>}
      >
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input aria-label="Search" placeholder="Search by ID, name, serial or IP" leftIcon={Search} value={search}
            onChange={(e) => setSearch(e.target.value)} containerClassName="flex-1" />
          <div className="sm:w-52">
            <Select value={purposeFilter} onChange={(v: 'ALL' | MachinePurpose) => setPurposeFilter(v)}
              options={[{ label: 'All purposes', value: 'ALL' }, ...Object.entries(PURPOSE_LABEL).map(([value, label]) => ({ label, value }))]} />
          </div>
        </div>
        <DataTable columns={columns} data={visible} loading={loading} error={loadError} keyExtractor={(m) => m.id}
          emptyTitle={machines.length ? 'No matching machines' : 'No machines yet'}
          emptyDescription={machines.length ? 'Try a different search or purpose.' : readOnly ? 'Nothing has been added yet.' : 'Add the first punch device.'} />
      </PanelCard>

      <Modal
        isOpen={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size="md"
        title={editing ? 'Edit biometric machine' : 'Add biometric machine'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="machine-editor" loading={saving}>{editing ? 'Save changes' : 'Add machine'}</Button>
          </div>
        }
      >
        {form && (
          <form id="machine-editor" onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
            {formMessage && <p role="alert" className="sm:col-span-2 rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}
            <Input label="Device ID" required maxLength={64} value={form.id} error={errors.id} disabled={Boolean(editing)}
              placeholder="e.g. BIO-01" onChange={(e) => set('id', e.target.value)} />
            <Input label="Short name" required maxLength={80} value={form.shortName} error={errors.shortName} placeholder="e.g. MAIN-GATE" onChange={(e) => set('shortName', e.target.value)} />
            <Input label="Device full name" required maxLength={255} value={form.fullName} error={errors.fullName} onChange={(e) => set('fullName', e.target.value)} containerClassName="sm:col-span-2" />
            <Input label="Serial number" required maxLength={120} value={form.serialNumber} error={errors.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
            <Input label="IP address" required maxLength={45} value={form.ipAddress} error={errors.ipAddress} placeholder="e.g. 192.168.1.100" onChange={(e) => set('ipAddress', e.target.value)} />
            <Select label="Purpose" required value={form.purpose} error={errors.purpose} onChange={(v: MachinePurpose) => set('purpose', v)}
              options={Object.entries(PURPOSE_LABEL).map(([value, label]) => ({ label, value }))} />
            <Select label="Status" required value={form.status} error={errors.status} onChange={(v: MasterStatus) => set('status', v)}
              options={[{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }]} />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        busy={confirmBusy}
        error={confirmError}
        danger={confirm?.kind === 'delete'}
        title={confirm?.kind === 'delete' ? 'Delete biometric machine?' : confirm?.machine.status === 'ACTIVE' ? 'Deactivate machine?' : 'Activate machine?'}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : confirm?.machine.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        message={confirm?.kind === 'delete'
          ? <>“{confirm.machine.fullName}” ({confirm.machine.id}) will be removed permanently.</>
          : <>“{confirm?.machine.fullName}” will be {confirm?.machine.status === 'ACTIVE' ? 'marked inactive' : 'marked active'}.</>}
        onConfirm={(reason) => void runConfirm(reason)}
        onCancel={() => !confirmBusy && setConfirm(null)}
      />
    </div>
  );
};
