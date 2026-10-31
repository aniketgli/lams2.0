import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, DataTable, Input, Modal, Select, Textarea } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { LeaveTypeInput, LeaveTypeList, LeaveTypeRecord, leaveTypeApi } from '../../leave/leaveApi';
import { ConfirmDialog, NoticeBar, PanelCard, StatusPill, useNotice } from './masterUi';

/**
 * Leave Policy master: the leave types, their quota and their rules. Administrators
 * change them; everyone else sees them read-only. The server checks every field.
 * Nothing is pre-filled: the administrator adds the institute's own leave types.
 */

const ACCRUALS = [
  { label: 'Yearly', value: 'yearly' }, { label: 'Half-yearly', value: 'half_yearly' }, { label: 'Quarterly', value: 'quarterly' },
  { label: 'Monthly', value: 'monthly' }, { label: 'Upfront', value: 'upfront' },
];
const yesNo = [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }];

const blank = (): LeaveTypeInput => ({
  code: '', name: '', description: '', defaultQuota: 0, accrual: 'yearly', maxAccumulation: 0, carryForward: false, maxCarryForward: 0,
  encashmentAllowed: false, approvalStages: 1, minNoticeDays: 0, halfDayAllowed: false, medicalCertDays: 0, sandwichRule: 'excluded',
  employeeTypes: [], gender: 'all', minServiceMonths: 0, maxConsecutiveDays: 0, isDebited: true, isPaid: true, afterExhaustedTypeId: '', lifetimeMax: 0, maxSpellsPerYear: 0, quotas: [], status: 'active',
});

const flag = (b: boolean) => (b ? 'yes' : 'no');

export const LeavePolicyMaster: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [data, setData] = useState<LeaveTypeList>({ types: [], employeeTypes: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [notice, showNotice, clearNotice] = useNotice();

  const [editing, setEditing] = useState<LeaveTypeRecord | null>(null);
  const [form, setForm] = useState<LeaveTypeInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<LeaveTypeRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setData(await leaveTypeApi.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the leave types.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const nameOf = (id: string) => data.types.find((t) => t.id === id)?.name ?? id;
  const typeName = (code: string) => data.employeeTypes.find((t) => t.code === code)?.name ?? code;

  const open = (record: LeaveTypeRecord | null) => {
    setEditing(record);
    setForm(record ? { ...record } : blank());
    setErrors({});
    setFormMessage(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setFormMessage(null);
    try {
      const result = editing ? await leaveTypeApi.update(editing.id, form) : await leaveTypeApi.create(form);
      setForm(null);
      showNotice('success', result.message);
      await load();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setFormMessage(error.message);
      } else setFormMessage('Could not save the leave type.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (reason: string) => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await leaveTypeApi.remove(deleting.id, reason || undefined);
      setDeleting(null);
      showNotice('success', result.message);
      await load();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the leave type.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const set = <K extends keyof LeaveTypeInput>(key: K, value: LeaveTypeInput[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((er) => (er[key as string] ? { ...er, [key as string]: '' } : er));
  };
  const num = (key: keyof LeaveTypeInput) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, (e.target.value === '' ? 0 : Number(e.target.value)) as never);

  const columns: ColumnDef<LeaveTypeRecord>[] = [
    {
      key: 'name', header: 'Leave type', width: '20%', sortValue: (t) => t.name,
      render: (t) => (
        <div className="min-w-0 leading-tight">
          <div className="font-semibold text-slate-900">{t.name}</div>
          <div className="font-mono text-[11px] text-slate-500">{t.code}</div>
        </div>
      ),
    },
    {
      key: 'quota', header: 'Yearly quota', width: '14%', sortValue: (t) => t.defaultQuota,
      render: (t) => (
        <div className="whitespace-normal leading-snug">
          <div className="font-semibold">{t.isDebited ? `${t.defaultQuota} days` : 'No limit'}</div>
          {t.isDebited && t.quotas.map((q) => <div key={q.employeeType} className="text-[11px] text-slate-600">{typeName(q.employeeType)}: {q.quota}</div>)}
        </div>
      ),
    },
    {
      key: 'approval', header: 'Approval', width: '14%', sortValue: (t) => t.approvalStages,
      render: (t) => <span className="text-slate-700">{t.approvalStages === 2 ? 'Reporting Manager → HoD' : 'Reporting Manager'}</span>,
    },
    {
      key: 'eligible', header: 'Eligibility', width: '20%', sortValue: (t) => t.employeeTypes.length,
      render: (t) => (
        <div className="whitespace-normal leading-snug text-slate-700 text-[11px]">
          {t.employeeTypes.length ? t.employeeTypes.map(typeName).join(', ') : 'All employee types'}
          {t.gender !== 'all' ? ` · ${t.gender === 'female_only' ? 'Female' : 'Male'} only` : ''}
          {t.minServiceMonths ? ` · ${t.minServiceMonths} months service` : ''}
        </div>
      ),
    },
    {
      key: 'rules', header: 'Rules', sortValue: (t) => t.maxConsecutiveDays,
      render: (t) => (
        <div className="whitespace-normal leading-snug text-slate-600 text-[11px]">
          {[
            t.halfDayAllowed ? 'Half day' : null,
            t.minNoticeDays ? `${t.minNoticeDays} days notice` : null,
            t.maxConsecutiveDays ? `Max ${t.maxConsecutiveDays} days at a time` : null,
            t.medicalCertDays ? `Certificate above ${t.medicalCertDays} days` : null,
            t.carryForward ? `Carry forward ${t.maxCarryForward}` : null,
            t.encashmentAllowed ? 'Encashable' : null,
            t.sandwichRule === 'included' ? 'Holidays counted' : 'Holidays not counted',
            t.isPaid ? null : 'Unpaid',
            t.afterExhaustedTypeId ? `Only after ${nameOf(t.afterExhaustedTypeId)} is used up` : null,
            t.lifetimeMax ? `Max ${t.lifetimeMax} days in service` : null,
            t.maxSpellsPerYear ? `${t.maxSpellsPerYear} times a year` : null,
            t.carryForward ? null : 'Lapses at year end',
          ].filter(Boolean).join(' · ') || '—'}
        </div>
      ),
    },
    { key: 'status', header: 'Status', width: '9%', sortValue: (t) => t.status, render: (t) => <StatusPill active={t.status === 'active'} /> },
    ...(readOnly ? [] : [{
      key: 'actions', header: 'Actions', width: '100px', align: 'right' as const,
      render: (t: LeaveTypeRecord) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="icon" size="sm" leftIcon={Pencil} title="Edit" aria-label={`Edit ${t.name}`} onClick={() => open(t)} />
          <Button variant="icon" size="sm" leftIcon={Trash2} title="Delete" aria-label={`Delete ${t.name}`} className="text-error hover:bg-error-subtle"
            onClick={() => { setDeleteError(null); setDeleting(t); }} />
        </div>
      ),
    }]),
  ];

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><FileText className="w-4 h-4 text-primary" />Leave Policy</>}
        count={data.types.length}
        actions={!readOnly && <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => open(null)}>Add leave type</Button>}
      >
        <DataTable columns={columns} data={data.types} loading={loading} error={loadError} keyExtractor={(t) => t.id}
          emptyTitle="No leave types yet" emptyDescription={readOnly ? 'Nothing has been added yet.' : 'Add the institute’s first leave type.'} />
      </PanelCard>

      <Modal
        isOpen={Boolean(form)}
        onClose={() => !saving && setForm(null)}
        size="lg"
        title={editing ? 'Edit leave type' : 'Add leave type'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="leave-type-editor" loading={saving}>{editing ? 'Save changes' : 'Add leave type'}</Button>
          </div>
        }
      >
        {form && (
          <form id="leave-type-editor" onSubmit={save} className="space-y-4" noValidate>
            {formMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Code" required maxLength={20} value={form.code} error={errors.code} onChange={(e) => set('code', e.target.value)} />
              <Input label="Name" required maxLength={100} value={form.name} error={errors.name} onChange={(e) => set('name', e.target.value)} containerClassName="sm:col-span-2" />
              <Input label="Yearly quota (days)" type="number" min={0} max={400} step="0.5" required value={String(form.defaultQuota)} error={errors.defaultQuota} onChange={num('defaultQuota')} />
              <Select label="Accrual" required value={form.accrual} searchable={false} error={Boolean(errors.accrual)} onChange={(v: string) => set('accrual', v as LeaveTypeInput['accrual'])} options={ACCRUALS} />
              <Input label="Maximum balance (0 = no limit)" type="number" min={0} value={String(form.maxAccumulation)} error={errors.maxAccumulation} onChange={num('maxAccumulation')} />
              <Select label="Approval stages" required value={String(form.approvalStages)} searchable={false} error={Boolean(errors.approvalStages)}
                onChange={(v: string) => set('approvalStages', Number(v) as 1 | 2)}
                options={[{ label: '1 · Reporting Manager approves', value: '1' }, { label: '2 · Reporting Manager forwards, HoD approves', value: '2' }]} />
              <Input label="Notice needed (days)" type="number" min={0} max={365} value={String(form.minNoticeDays)} error={errors.minNoticeDays} onChange={num('minNoticeDays')} />
              <Input label="Longest at a time (days, 0 = no limit)" type="number" min={0} value={String(form.maxConsecutiveDays)} error={errors.maxConsecutiveDays} onChange={num('maxConsecutiveDays')} />
              <Input label="Certificate needed above (days, 0 = never)" type="number" min={0} value={String(form.medicalCertDays)} error={errors.medicalCertDays} onChange={num('medicalCertDays')} />
              <Input label="Minimum service (months)" type="number" min={0} value={String(form.minServiceMonths)} error={errors.minServiceMonths} onChange={num('minServiceMonths')} />
              <Select label="Gender" required value={form.gender} searchable={false} error={Boolean(errors.gender)} onChange={(v: string) => set('gender', v as LeaveTypeInput['gender'])}
                options={[{ label: 'All', value: 'all' }, { label: 'Female only', value: 'female_only' }, { label: 'Male only', value: 'male_only' }]} />
              <Select label="Holidays in between" required value={form.sandwichRule} searchable={false} error={Boolean(errors.sandwichRule)} onChange={(v: string) => set('sandwichRule', v as LeaveTypeInput['sandwichRule'])}
                options={[{ label: 'Not counted', value: 'excluded' }, { label: 'Counted as leave', value: 'included' }]} />
              <Select label="Half day allowed" value={flag(form.halfDayAllowed)} searchable={false} onChange={(v: string) => set('halfDayAllowed', v === 'yes')} options={yesNo} />
              <Select label="Carry forward" value={flag(form.carryForward)} searchable={false} onChange={(v: string) => set('carryForward', v === 'yes')} options={yesNo} />
              {form.carryForward && (
                <Input label="Carry forward up to (days)" type="number" min={0} step="0.5" value={String(form.maxCarryForward)} error={errors.maxCarryForward} onChange={num('maxCarryForward')} />
              )}
              <Select label="Encashment allowed" value={flag(form.encashmentAllowed)} searchable={false} onChange={(v: string) => set('encashmentAllowed', v === 'yes')} options={yesNo} />
              <Select label="Debited from balance" value={flag(form.isDebited)} searchable={false} onChange={(v: string) => set('isDebited', v === 'yes')} options={yesNo} />
              <Select label="Paid" value={flag(form.isPaid)} searchable={false} onChange={(v: string) => set('isPaid', v === 'yes')} options={yesNo} />
              <Select label="Can be taken only after" value={form.afterExhaustedTypeId} searchable={false} placeholder="Any time" error={Boolean(errors.afterExhaustedTypeId)}
                onChange={(v: string) => set('afterExhaustedTypeId', v)}
                options={[{ label: 'Any time', value: '' }, ...data.types.filter((t) => t.isDebited && t.id !== editing?.id).map((t) => ({ label: `${t.name} is used up`, value: t.id }))]} />
              <Input label="Limit in whole service (days, 0 = no limit)" type="number" min={0} step="0.5" value={String(form.lifetimeMax)} error={errors.lifetimeMax} onChange={num('lifetimeMax')} />
              <Input label="Times a year (0 = no limit)" type="number" min={0} value={String(form.maxSpellsPerYear)} error={errors.maxSpellsPerYear} onChange={num('maxSpellsPerYear')} />
              <Select label="Status" required value={form.status} searchable={false} onChange={(v: string) => set('status', v as 'active' | 'inactive')}
                options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold text-slate-700 mb-1.5">Employee types (none selected = everyone)</legend>
              <div className="flex flex-wrap gap-1.5">
                {data.employeeTypes.map((t) => {
                  const on = form.employeeTypes.includes(t.code);
                  return (
                    <button key={t.code} type="button" aria-pressed={on}
                      onClick={() => set('employeeTypes', on ? form.employeeTypes.filter((x) => x !== t.code) : [...form.employeeTypes, t.code])}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
              {errors.employeeTypes && <p className="text-xs text-error mt-1">{errors.employeeTypes}</p>}
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold text-slate-700 mb-1.5">Quota by employee type (blank = yearly quota above)</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.employeeTypes.filter((t) => !form.employeeTypes.length || form.employeeTypes.includes(t.code)).map((t) => {
                  const found = form.quotas.find((q) => q.employeeType === t.code);
                  return (
                    <Input key={t.code} label={`${t.name} (days)`} type="number" min={0} max={400} step="0.5" value={found ? String(found.quota) : ''}
                      onChange={(e) => {
                        const rest = form.quotas.filter((q) => q.employeeType !== t.code);
                        set('quotas', e.target.value === '' ? rest : [...rest, { employeeType: t.code, quota: Number(e.target.value) }]);
                      }} />
                  );
                })}
              </div>
              {errors.quotas && <p className="text-xs text-error mt-1">{errors.quotas}</p>}
            </fieldset>
            <Textarea label="Description" rows={2} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        busy={deleteBusy}
        error={deleteError}
        title="Delete leave type?"
        confirmLabel="Delete"
        message={<>“{deleting?.name}” will be removed permanently. A leave type that has balances or requests cannot be deleted; make it Inactive instead.</>}
        onConfirm={(reason) => void remove(reason)}
        onCancel={() => !deleteBusy && setDeleting(null)}
      />
    </div>
  );
};
