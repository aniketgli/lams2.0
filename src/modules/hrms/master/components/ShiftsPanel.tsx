import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button, DataTable, Input, Modal, Select, Textarea } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { ShiftInput, ShiftRecord, announceMastersChanged, shiftApi } from '../masterApi';
import { ConfirmDialog, NoticeBar, PanelCard, StatusPill, useNotice } from './masterUi';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const blankShift = (): ShiftInput => ({
  code: '', name: '', startTime: '09:30', endTime: '17:30', gracePeriodMins: 15,
  halfDayHours: 4, fullDayHours: 7.5, halfDayCutoffTime: '13:30', description: '',
  applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], isDefault: false, status: 'active',
});

function duration(start: string, end: string): string {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) diff += 24 * 60; // overnight shift
  return `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, '0')}m`;
}

export const ShiftsPanel: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [notice, showNotice, clearNotice] = useNotice();

  const [editing, setEditing] = useState<ShiftRecord | null>(null);
  const [form, setForm] = useState<ShiftInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ShiftRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setShifts(await shiftApi.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load shifts.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = (shift: ShiftRecord | null) => {
    setEditing(shift);
    setForm(shift ? { ...shift, halfDayCutoffTime: shift.halfDayCutoffTime ?? '' } : blankShift());
    setErrors({});
    setFormMessage(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormMessage(null);
    try {
      const payload = { ...form, halfDayCutoffTime: form.halfDayCutoffTime || null };
      editing ? await shiftApi.update(editing.id, payload) : await shiftApi.create(payload);
      await load(); // default flag may have moved to this shift
      setForm(null);
      announceMastersChanged();
      showNotice('success', `Shift "${form.name}" ${editing ? 'updated' : 'created'}.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setFormMessage(error.message);
      } else setFormMessage('Could not save the shift.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await shiftApi.remove(deleting.id, reason || undefined);
      setShifts((prev) => prev.filter((s) => s.id !== deleting.id));
      announceMastersChanged();
      showNotice('success', `Shift "${deleting.name}" deleted.`);
      setDeleting(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the shift.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: ColumnDef<ShiftRecord>[] = [
    {
      key: 'name', header: 'Shift',
      render: (s) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
            {s.name}
            {s.isDefault && <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-subtle border border-warning-border px-1.5 py-0.5 text-[10px] font-semibold text-warning"><Star className="w-2.5 h-2.5" />Default</span>}
          </div>
          <div className="font-mono text-[11px] text-slate-500">{s.code}</div>
        </div>
      ),
    },
    { key: 'timing', header: 'Timing', render: (s) => <span className="font-mono text-[11px] text-slate-700">{s.startTime}–{s.endTime} · {duration(s.startTime, s.endTime)}</span> },
    {
      key: 'days', header: 'Working days',
      render: (s) => (
        <div className="flex gap-0.5">
          {DAYS.map((d) => (
            <span key={d} title={d} className={`w-5 h-5 rounded text-[9px] font-bold inline-flex items-center justify-center ${s.applicableDays.includes(d) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>{d[0]}</span>
          ))}
        </div>
      ),
    },
    { key: 'rules', header: 'Rules', render: (s) => <span className="text-[11px] text-slate-600">Grace {s.gracePeriodMins}m · Full {s.fullDayHours}h · Half {s.halfDayHours}h{s.halfDayCutoffTime ? ` · Cut-off ${s.halfDayCutoffTime}` : ''}</span> },
    { key: 'status', header: 'Status', width: '10%', render: (s) => <StatusPill active={s.status === 'active'} /> },
    ...(readOnly ? [] : [{
      key: 'actions', header: 'Actions', width: '100px', align: 'right' as const,
      render: (s: ShiftRecord) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="icon" size="sm" leftIcon={Pencil} title="Edit" aria-label={`Edit ${s.name}`} onClick={() => open(s)} />
          <Button variant="icon" size="sm" leftIcon={Trash2} title="Delete" aria-label={`Delete ${s.name}`} className="text-error hover:bg-error-subtle"
            disabled={s.isDefault} onClick={() => { setDeleteError(null); setDeleting(s); }} />
        </div>
      ),
    }]),
  ];

  const set = <K extends keyof ShiftInput>(key: K, value: ShiftInput[K]) => form && setForm({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><Clock className="w-4 h-4 text-primary" />Shift Master &amp; Timing Rules</>}
        description="Working hours, grace period and half-day rules used to evaluate attendance."
        count={shifts.length}
        actions={!readOnly && <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => open(null)}>Add shift</Button>}
      >
        <DataTable columns={columns} data={shifts} loading={loading} error={loadError} keyExtractor={(s) => s.id}
          emptyTitle="No shifts yet" emptyDescription={readOnly ? 'Nothing has been added yet.' : 'Add the institute’s first shift.'} />
      </PanelCard>

      <Modal
        isOpen={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size="lg"
        title={editing ? 'Edit shift' : 'Add shift'}
        subtitle={editing ? `${editing.name} · ${editing.code}` : 'Timing rules apply to every employee on this shift.'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="shift-editor" loading={saving}>{editing ? 'Save changes' : 'Add shift'}</Button>
          </div>
        }
      >
        {form && (
          <form id="shift-editor" onSubmit={save} className="space-y-4" noValidate>
            {formMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Code" required maxLength={50} value={form.code} error={errors.code} onChange={(e) => set('code', e.target.value)} helperText="e.g. GEN" />
              <Input label="Name" required maxLength={255} value={form.name} error={errors.name} onChange={(e) => set('name', e.target.value)} containerClassName="sm:col-span-2" />
              <Input label="Start time" type="time" required value={form.startTime} error={errors.startTime} onChange={(e) => set('startTime', e.target.value)} />
              <Input label="End time" type="time" required value={form.endTime} error={errors.endTime} onChange={(e) => set('endTime', e.target.value)} />
              <Input label="Half-day cut-off" type="time" value={form.halfDayCutoffTime ?? ''} error={errors.halfDayCutoffTime} onChange={(e) => set('halfDayCutoffTime', e.target.value)} helperText="Optional" />
              <Input label="Grace period (minutes)" type="number" min={0} max={240} required value={String(form.gracePeriodMins)} error={errors.gracePeriodMins} onChange={(e) => set('gracePeriodMins', Number(e.target.value))} />
              <Input label="Full day (hours)" type="number" step="0.5" min={0.5} max={24} required value={String(form.fullDayHours)} error={errors.fullDayHours} onChange={(e) => set('fullDayHours', Number(e.target.value))} />
              <Input label="Half day (hours)" type="number" step="0.5" min={0.5} max={24} required value={String(form.halfDayHours)} error={errors.halfDayHours} onChange={(e) => set('halfDayHours', Number(e.target.value))} />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold text-slate-700 mb-1.5">Working days <span className="text-error">*</span></legend>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = form.applicableDays.includes(d);
                  return (
                    <button key={d} type="button" aria-pressed={on}
                      onClick={() => set('applicableDays', on ? form.applicableDays.filter((x) => x !== d) : [...form.applicableDays, d])}
                      className={`h-8 w-12 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
              {errors.applicableDays && <p className="text-xs text-error mt-1">{errors.applicableDays}</p>}
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Status" required value={form.status} error={errors.status}
                onChange={(v: 'active' | 'inactive') => set('status', v)}
                options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:mt-6 cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="w-4 h-4 accent-[var(--ds-primary)]" />
                Default shift for new employees
              </label>
            </div>
            <Textarea label="Description" rows={2} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} />
            {editing?.isDefault && <p className="text-[11px] text-slate-500">This is the default shift. To change the default, mark another shift as default.</p>}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        busy={deleteBusy}
        error={deleteError}
        title="Delete shift?"
        confirmLabel="Delete"
        message={<>“{deleting?.name}” will be removed permanently. Shifts assigned to employees cannot be deleted; make them Inactive instead.</>}
        onConfirm={(reason) => void remove(reason)}
        onCancel={() => !deleteBusy && setDeleting(null)}
      />
    </div>
  );
};

