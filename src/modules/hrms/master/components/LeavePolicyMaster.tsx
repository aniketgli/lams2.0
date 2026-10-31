import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, DataTable, Input, Modal, Select } from '../../../../shared/components';
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
  code: '', name: '', description: '', defaultQuota: 0, pwdQuota: null, pwdOnly: false, accrual: 'yearly', maxAccumulation: 0, carryForward: false, maxCarryForward: 0,
  encashmentAllowed: false, approvalStages: 1, minNoticeDays: 0, halfDayAllowed: false, medicalCertDays: 0, sandwichRule: 'excluded', combineWith: 'none',
  employeeTypes: [], gender: 'all', minServiceMonths: 0, maxConsecutiveDays: 0, isDebited: true, isPaid: true, afterExhaustedTypeId: '', debitFromTypeId: '', debitFactor: 1, lifetimeMax: 0, maxSpellsPerYear: 0, minDaysPerApplication: 0, maxSpellsPerMonth: 0, maxSpellsLifetime: 0, quotas: [], status: 'active',
});

const flag = (b: boolean) => (b ? 'yes' : 'no');

/** One numbered block of the leave type form; shows how many of its fields the server rejected. */
const FormSection: React.FC<{ step: number; title: string; errorCount: number; children: React.ReactNode }> = ({ step, title, errorCount, children }) => (
  <section className="rounded-xl border border-slate-200">
    <header className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50 rounded-t-xl">
      <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">{step}</span>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {errorCount > 0 && <span className="ml-auto text-[11px] font-semibold text-error">{errorCount} to fix</span>}
    </header>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">{children}</div>
  </section>
);

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
  const countErrors = (keys: string[]) => keys.filter((k) => errors[k]).length;
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
          {t.isDebited && t.pwdQuota !== null && <div className="text-[11px] text-slate-600">PwD: {t.pwdQuota}</div>}
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
            t.pwdOnly ? 'Persons with disability only' : null,
            t.afterExhaustedTypeId ? `Only after ${nameOf(t.afterExhaustedTypeId)} is used up` : null,
            t.debitFromTypeId ? `${t.debitFactor} day(s) of ${nameOf(t.debitFromTypeId)} per day` : null,
            t.combineWith === 'none' ? 'Not joined with other leaves' : t.combineWith === 'both' ? null : `Joined with ${t.combineWith === 'single' ? '1-stage' : '2-stage'} leaves only`,
            t.accrual === 'half_yearly' ? 'Credited every half-year' : null,
            t.lifetimeMax ? `Max ${t.lifetimeMax} days in service` : null,
            t.maxSpellsPerYear ? `${t.maxSpellsPerYear} times a year` : null,
            t.minDaysPerApplication ? `Min ${t.minDaysPerApplication} days at a time` : null,
            t.maxSpellsPerMonth ? `${t.maxSpellsPerMonth} times a month` : null,
            t.maxSpellsLifetime ? `${t.maxSpellsLifetime} times in service` : null,
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
          <form id="leave-type-editor" onSubmit={save} className="space-y-5" noValidate>
            {formMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{formMessage}</p>}

            <FormSection step={1} title="Basic details" errorCount={countErrors(['name', 'code', 'status'])}>
              <Input label="Name" required maxLength={100} placeholder="e.g. Casual Leave" value={form.name} error={errors.name} onChange={(e) => set('name', e.target.value)} />
              <Input label="Code" required maxLength={20} placeholder="e.g. CL" value={form.code} error={errors.code} onChange={(e) => set('code', e.target.value)} />
              <Select label="Status" required value={form.status} searchable={false} onChange={(v: string) => set('status', v as 'active' | 'inactive')}
                options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} />
            </FormSection>

            <FormSection step={2} title="Rules for taking leave" errorCount={countErrors(['approvalStages', 'combineWith', 'sandwichRule', 'halfDayAllowed', 'minDaysPerApplication', 'maxConsecutiveDays', 'gender', 'pwdOnly', 'maxSpellsPerMonth', 'maxSpellsLifetime'])}>
              <Select label="Approval stages" required value={String(form.approvalStages)} searchable={false} error={Boolean(errors.approvalStages)}
                onChange={(v: string) => set('approvalStages', Number(v) as 1 | 2)}
                options={[{ label: '1 stage · Reporting Manager', value: '1' }, { label: '2 stages · Reporting Manager, HoD', value: '2' }]} />
              <Select label="Can be combined with" required value={form.combineWith} searchable={false} error={Boolean(errors.combineWith)} onChange={(v: string) => set('combineWith', v as LeaveTypeInput['combineWith'])}
                options={[{ label: 'Nothing', value: 'none' }, { label: '1-stage leaves', value: 'single' }, { label: '2-stage leaves', value: 'double' }, { label: 'Both 1-stage and 2-stage leaves', value: 'both' }]} />
              <Select label="Holidays in between" required value={form.sandwichRule} searchable={false} error={Boolean(errors.sandwichRule)} onChange={(v: string) => set('sandwichRule', v as LeaveTypeInput['sandwichRule'])}
                options={[{ label: 'Not counted', value: 'excluded' }, { label: 'Counted as leave', value: 'included' }]} />

              <Select label="Half day allowed" value={flag(form.halfDayAllowed)} searchable={false} onChange={(v: string) => set('halfDayAllowed', v === 'yes')} options={yesNo} />
              <Input label="Minimum days per application (0 = no limit)" type="number" min={0} step="0.5" value={String(form.minDaysPerApplication)} error={errors.minDaysPerApplication} onChange={num('minDaysPerApplication')} />
              <Input label="Maximum days per application (0 = no limit)" type="number" min={0} value={String(form.maxConsecutiveDays)} error={errors.maxConsecutiveDays} onChange={num('maxConsecutiveDays')} />

              <Select label="Who can take it" required value={form.pwdOnly ? 'pwd' : form.gender} searchable={false} error={Boolean(errors.gender || errors.pwdOnly)}
                onChange={(v: string) => { set('pwdOnly', v === 'pwd'); set('gender', v === 'pwd' ? 'all' : (v as LeaveTypeInput['gender'])); }}
                options={[{ label: 'All', value: 'all' }, { label: 'Male', value: 'male_only' }, { label: 'Female', value: 'female_only' }, { label: 'Persons with disability', value: 'pwd' }]} />
              <Input label="Times in a month (0 = no limit)" type="number" min={0} max={31} value={String(form.maxSpellsPerMonth)} error={errors.maxSpellsPerMonth} onChange={num('maxSpellsPerMonth')} />
              <Input label="Times in the whole service (0 = no limit)" type="number" min={0} value={String(form.maxSpellsLifetime)} error={errors.maxSpellsLifetime} onChange={num('maxSpellsLifetime')} />
            </FormSection>

            <FormSection step={3} title="Balance" errorCount={countErrors(['isPaid', 'isDebited', 'debitFromTypeId', 'debitFactor', 'afterExhaustedTypeId'])}>
              <Select label="Paid" value={flag(form.isPaid)} searchable={false} onChange={(v: string) => set('isPaid', v === 'yes')} options={yesNo} />
              <Select label="Debited from balance" value={flag(form.isDebited)} searchable={false} onChange={(v: string) => set('isDebited', v === 'yes')} options={yesNo} />
              <Select label="Uses the balance of" value={form.debitFromTypeId} searchable={false} placeholder="Its own balance" error={Boolean(errors.debitFromTypeId)}
                onChange={(v: string) => { set('debitFromTypeId', v); if (v) set('isDebited', false); }}
                options={[{ label: 'Its own balance', value: '' }, ...data.types.filter((t) => t.isDebited && t.id !== editing?.id).map((t) => ({ label: t.name, value: t.id }))]} />
              {form.debitFromTypeId && (
                <Input label="Days used for each day taken" type="number" min={0.5} max={10} step="0.5" value={String(form.debitFactor)} error={errors.debitFactor} onChange={num('debitFactor')} />
              )}
              <Select label="Can be taken only after" value={form.afterExhaustedTypeId} searchable={false} placeholder="Any time" error={Boolean(errors.afterExhaustedTypeId)}
                onChange={(v: string) => set('afterExhaustedTypeId', v)}
                options={[{ label: 'Any time', value: '' }, ...data.types.filter((t) => t.isDebited && t.id !== editing?.id).map((t) => ({ label: `${t.name} is used up`, value: t.id }))]} />
            </FormSection>
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
