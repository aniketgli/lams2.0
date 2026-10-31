import React, { useRef, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../../shared/components';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { ApiError } from '../../../../shared/services/api';
import { PolicyInput, PolicyItem, PolicyOptions, leavePolicyApi } from '../../leave/leavePolicyApi';

/**
 * Leave policy form: six sections (details, entitlements, general rules, approval,
 * assignment, administrative information). Every dropdown is filled from the masters; the server
 * validates every field again and returns the message for each wrong one.
 */

export const blankItem = (): PolicyItem => ({
  leaveTypeId: '', annualEntitlement: 0, accrual: 'yearly', accrualQuantity: 0, maxBalance: 0, minApplication: 0, maxApplication: 0, carryForward: false, carryLimit: 0,
  encashment: false, encashLimit: 0, halfDay: false, documentRequired: false, probationApplicable: true, negativeBalance: false, conditions: '',
});

export const blankPolicy = (): PolicyInput => ({
  code: '', name: '', employeeCategory: '', version: '1.0', effectiveFrom: '', effectiveTo: '', yearCycle: '', status: 'draft', description: '', items: [],
  proRata: false, midYearJoining: '', backdatedLeave: '', noticePeriodLeave: '', sandwichRule: '', weeklyOff: '', publicHoliday: '', separationBalance: '', generalRemarks: '',
  approvalMode: '', workflowStatus: '', l1Role: '', l1Mandatory: true, l2Role: '', l2Mandatory: true,
  assignmentMethod: '', departmentScope: 'all', departments: [], designationScope: 'all', designations: [], assignmentRemarks: '', referenceNo: '', orderDate: '', officialRemarks: '',
});

const opts = (pairs: Array<[string, string]>) => pairs.map(([value, label]) => ({ value, label }));
const YEAR_CYCLES = opts([['calendar', 'Calendar year (Jan – Dec)'], ['financial', 'Financial year (Apr – Mar)']]);
const ACCRUALS = opts([['yearly', 'Yearly'], ['half_yearly', 'Half-yearly'], ['quarterly', 'Quarterly'], ['monthly', 'Monthly'], ['upfront', 'Upfront']]);
const YES_NO = opts([['yes', 'Yes'], ['no', 'No']]);
const ALLOWED = opts([['allowed', 'Allowed'], ['not_allowed', 'Not allowed']]);
const COUNTED = opts([['included', 'Counted as leave'], ['excluded', 'Not counted']]);
const SCOPES = opts([['all', 'All'], ['selected', 'Selected only']]);

const SECTIONS = [
  { id: 'details', label: 'Policy Details' },
  { id: 'entitlements', label: 'Entitlements' },
  { id: 'rules', label: 'General Rules' },
  { id: 'approval', label: 'Approval' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'admin', label: 'Administrative' },
];

const yn = (b: boolean) => (b ? 'yes' : 'no');
const num = (value: string) => (value === '' ? 0 : Number(value));

const Section: React.FC<{ id: string; no: number; title: string; children: React.ReactNode }> = ({ id, no, title, children }) => (
  <section id={`policy-${id}`} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 scroll-mt-4">
    <h3 className="text-sm font-bold text-slate-900"><span className="text-primary mr-2">{String(no).padStart(2, '0')}</span>{title}</h3>
    {children}
  </section>
);

const Grid: React.FC<{ cols?: 2 | 3 | 4; children: React.ReactNode }> = ({ cols = 3, children }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : cols === 4 ? 'lg:grid-cols-4' : ''} gap-4`}>{children}</div>
);

interface Props {
  options: PolicyOptions;
  initial: PolicyInput;
  /** Set when editing a draft. */
  editingId: string | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

export const LeavePolicyForm: React.FC<Props> = ({ options, initial, editingId, onCancel, onSaved }) => {
  const [form, setForm] = useState<PolicyInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'active' | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const set = <K extends keyof PolicyInput>(key: K, value: PolicyInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key as string] ? { ...er, [key as string]: '' } : er));
  };
  const setItem = <K extends keyof PolicyItem>(index: number, key: K, value: PolicyItem[K]) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, [key]: value } : it)) }));
    setErrors((er) => (er[`items.${index}.${key}`] ? { ...er, [`items.${index}.${key}`]: '' } : er));
  };
  const err = (key: string) => errors[key] || undefined;

  const save = async (status: 'draft' | 'active') => {
    if (saving) return;
    setSaving(status);
    setMessage(null);
    try {
      const body = { ...form, status };
      const result = editingId ? await leavePolicyApi.update(editingId, body) : await leavePolicyApi.create(body);
      onSaved(result.message);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setMessage(error.message);
      } else setMessage('Could not save the policy.');
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      setSaving(null);
    }
  };

  const twoLevel = form.workflowStatus === 'enabled' && form.approvalMode === 'two_level';
  const workflowOn = form.workflowStatus !== 'disabled';
  const taken = new Set(form.items.map((i) => i.leaveTypeId));
  const roleOptions = options.roles.map((r) => ({ value: r.id, label: r.label }));
  const jump = (id: string) => document.getElementById(`policy-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-4" ref={top}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft} onClick={onCancel} disabled={Boolean(saving)}>Back</Button>
          <h2 className="text-base font-bold text-slate-900 truncate">{editingId ? 'Edit leave policy' : 'Add new leave policy'}</h2>
        </div>
        <div className="flex flex-wrap gap-1">
          {SECTIONS.map((s, i) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)}
              className="h-7 px-2.5 rounded-lg text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:text-primary hover:border-primary/40 cursor-pointer">
              {String(i + 1).padStart(2, '0')} {s.label}
            </button>
          ))}
        </div>
      </div>

      {message && <p role="alert" className="rounded-xl border border-error-border bg-error-subtle px-4 py-3 text-xs text-error">{message}</p>}

      <Section id="details" no={1} title="Policy Details">
        <Grid>
          <Input label="Policy name" required maxLength={150} value={form.name} placeholder="e.g. Permanent staff leave policy" error={err('name')} onChange={(e) => set('name', e.target.value)} containerClassName="sm:col-span-2" />
          <Input label="Policy code" required maxLength={30} value={form.code} placeholder="e.g. PERM-LP" error={err('code')} onChange={(e) => set('code', e.target.value)} />
          <Select label="Employee category" required value={form.employeeCategory} searchable={false} placeholder="Select category" error={err('employeeCategory')}
            onChange={(v: string) => set('employeeCategory', v)} options={options.employeeTypes.map((t) => ({ value: t.code, label: t.name }))} />
          <Input label="Policy version" required maxLength={20} value={form.version} placeholder="e.g. 1.0" error={err('version')} onChange={(e) => set('version', e.target.value)} />
          <Select label="Leave year cycle" required value={form.yearCycle} searchable={false} placeholder="Select" error={err('yearCycle')}
            onChange={(v: string) => set('yearCycle', v as PolicyInput['yearCycle'])} options={YEAR_CYCLES} />
          <div>
            <AppDatePicker label="Effective from *" value={form.effectiveFrom} placeholder="Select date" onChange={(d) => set('effectiveFrom', d)} />
            {err('effectiveFrom') && <p className="text-xs text-error mt-1">{err('effectiveFrom')}</p>}
          </div>
          <div>
            <AppDatePicker label="Effective to" value={form.effectiveTo} placeholder="No end date" minDate={form.effectiveFrom || undefined} onChange={(d) => set('effectiveTo', d)} />
            {err('effectiveTo') && <p className="text-xs text-error mt-1">{err('effectiveTo')}</p>}
          </div>
        </Grid>
        <Textarea label="Policy description / remarks" rows={2} maxLength={1000} value={form.description} error={err('description')} onChange={(e) => set('description', e.target.value)} />
      </Section>

      <Section id="entitlements" no={2} title="Leave Entitlement Configuration">
        {err('items') && <p className="text-xs text-error">{err('items')}</p>}
        {form.items.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-6 text-center text-xs text-slate-500">No leave type added yet.</p>}
        {form.items.map((item, i) => {
          const e = (k: string) => err(`items.${i}.${k}`);
          const field = (key: keyof PolicyItem, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
            <Input label={label} type="number" min={0} step="0.5" value={String(item[key] as number)} error={e(key)} onChange={(ev) => setItem(i, key, num(ev.target.value) as never)} {...extra} />
          );
          const flag = (key: 'halfDay' | 'documentRequired' | 'probationApplicable' | 'negativeBalance' | 'carryForward' | 'encashment', label: string) => (
            <Select label={label} value={yn(item[key])} searchable={false} error={e(key)} onChange={(v: string) => setItem(i, key, v === 'yes' as never)} options={YES_NO} />
          );
          return (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800">Leave type {i + 1}</h4>
                <Button variant="icon" size="sm" leftIcon={Trash2} title="Remove leave type" aria-label={`Remove leave type ${i + 1}`} className="text-error hover:bg-error-subtle"
                  onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, n) => n !== i) }))} />
              </div>
              <Grid>
                <Select label="Leave type" required value={item.leaveTypeId} searchable={false} placeholder="Select leave type" error={e('leaveTypeId')} onChange={(v: string) => setItem(i, 'leaveTypeId', v)}
                  options={options.leaveTypes.filter((t) => t.id === item.leaveTypeId || !taken.has(t.id)).map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))} />
                {field('annualEntitlement', 'Annual entitlement (days) *', { max: 400 })}
                <Select label="Accrual frequency" required value={item.accrual} searchable={false} error={e('accrual')} onChange={(v: string) => setItem(i, 'accrual', v as PolicyItem['accrual'])} options={ACCRUALS} />
                {field('accrualQuantity', 'Accrual quantity (days each time)', { max: 400 })}
                {field('maxBalance', 'Maximum balance (0 = no limit)', { max: 1000 })}
                {field('minApplication', 'Minimum application (days)', { max: 365 })}
                {field('maxApplication', 'Maximum application (days, 0 = no limit)', { max: 730 })}
              </Grid>
              <Grid>
                {flag('carryForward', 'Carry forward allowed')}
                {item.carryForward && field('carryLimit', 'Carry forward limit (days)', { max: 1000 })}
                {flag('encashment', 'Encashment allowed')}
                {item.encashment && field('encashLimit', 'Encashment limit (days)', { max: 1000 })}
              </Grid>
              <Grid cols={4}>
                {flag('halfDay', 'Half day allowed')}
                {flag('documentRequired', 'Document required')}
                {flag('probationApplicable', 'Applicable during probation')}
                {flag('negativeBalance', 'Negative balance allowed')}
              </Grid>
              <Textarea label="Specific leave conditions" rows={2} maxLength={500} value={item.conditions} error={e('conditions')} onChange={(ev) => setItem(i, 'conditions', ev.target.value)} />
            </div>
          );
        })}
        <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }))}
          disabled={form.items.length >= options.leaveTypes.length}>Add leave type</Button>
      </Section>

      <Section id="rules" no={3} title="General Leave Rules">
        <Grid>
          <Select label="Pro-rata calculation" value={yn(form.proRata)} searchable={false} onChange={(v: string) => set('proRata', v === 'yes')} options={YES_NO} />
          <Select label="Mid-year joining" required value={form.midYearJoining} searchable={false} placeholder="Select" error={err('midYearJoining')} onChange={(v: string) => set('midYearJoining', v as PolicyInput['midYearJoining'])}
            options={opts([['prorata', 'Pro-rata from joining month'], ['full', 'Full entitlement'], ['none', 'No entitlement in the joining year']])} />
          <Select label="Backdated leave" required value={form.backdatedLeave} searchable={false} placeholder="Select" error={err('backdatedLeave')} onChange={(v: string) => set('backdatedLeave', v as PolicyInput['backdatedLeave'])} options={ALLOWED} />
          <Select label="Leave during notice period" required value={form.noticePeriodLeave} searchable={false} placeholder="Select" error={err('noticePeriodLeave')} onChange={(v: string) => set('noticePeriodLeave', v as PolicyInput['noticePeriodLeave'])} options={ALLOWED} />
          <Select label="Sandwich rule" required value={form.sandwichRule} searchable={false} placeholder="Select" error={err('sandwichRule')} onChange={(v: string) => set('sandwichRule', v as PolicyInput['sandwichRule'])} options={COUNTED} />
          <Select label="Weekly off calculation" required value={form.weeklyOff} searchable={false} placeholder="Select" error={err('weeklyOff')} onChange={(v: string) => set('weeklyOff', v as PolicyInput['weeklyOff'])} options={COUNTED} />
          <Select label="Public holiday calculation" required value={form.publicHoliday} searchable={false} placeholder="Select" error={err('publicHoliday')} onChange={(v: string) => set('publicHoliday', v as PolicyInput['publicHoliday'])} options={COUNTED} />
          <Select label="Balance at separation" required value={form.separationBalance} searchable={false} placeholder="Select" error={err('separationBalance')} onChange={(v: string) => set('separationBalance', v as PolicyInput['separationBalance'])}
            options={opts([['lapse', 'Lapses'], ['encash', 'Encashed'], ['adjust', 'Adjusted against dues']])} />
        </Grid>
        <Textarea label="Additional general rules / remarks" rows={2} maxLength={1000} value={form.generalRemarks} error={err('generalRemarks')} onChange={(e) => set('generalRemarks', e.target.value)} />
      </Section>

      <Section id="approval" no={4} title="Approval Workflow">
        <Grid>
          <Select label="Workflow status" required value={form.workflowStatus} searchable={false} placeholder="Select" error={err('workflowStatus')} onChange={(v: string) => set('workflowStatus', v as PolicyInput['workflowStatus'])}
            options={opts([['enabled', 'Enabled (approval needed)'], ['disabled', 'Disabled (approved on application)']])} />
          {workflowOn && (
            <Select label="Approval mode" required value={form.approvalMode} searchable={false} placeholder="Select" error={err('approvalMode')} onChange={(v: string) => set('approvalMode', v as PolicyInput['approvalMode'])}
              options={opts([['single_level', 'Single level'], ['two_level', 'Two levels']])} />
          )}
        </Grid>
        {workflowOn && (
          <>
            <Grid>
              <Select label="Approval level 1 · approver role" required value={form.l1Role} searchable={false} placeholder="Select role" error={err('l1Role')} onChange={(v: string) => set('l1Role', v)} options={roleOptions} />
              <Select label="Level 1 mandatory" value={yn(form.l1Mandatory)} searchable={false} onChange={(v: string) => set('l1Mandatory', v === 'yes')} options={YES_NO} />
            </Grid>
            {twoLevel && (
              <Grid>
                <Select label="Approval level 2 · approver role" required value={form.l2Role} searchable={false} placeholder="Select role" error={err('l2Role')} onChange={(v: string) => set('l2Role', v)} options={roleOptions} />
                <Select label="Level 2 mandatory" value={yn(form.l2Mandatory)} searchable={false} onChange={(v: string) => set('l2Mandatory', v === 'yes')} options={YES_NO} />
              </Grid>
            )}
          </>
        )}
      </Section>

      <Section id="assignment" no={5} title="Employee Assignment">
        <Grid>
          <Select label="Assignment method" required value={form.assignmentMethod} searchable={false} placeholder="Select" error={err('assignmentMethod')} onChange={(v: string) => set('assignmentMethod', v as PolicyInput['assignmentMethod'])}
            options={opts([['automatic', 'Automatic · based on employee category'], ['manual', 'Manual · administrator assigns policy'], ['default_override', 'Category default + administrator override']])} containerClassName="sm:col-span-2" />
        </Grid>
        <Grid>
          <Select label="Applicable departments" required value={form.departmentScope} searchable={false} onChange={(v: string) => set('departmentScope', v as PolicyInput['departmentScope'])} options={SCOPES} />
          {form.departmentScope === 'selected' && (
            <Select label="Departments" isMulti value={form.departments} placeholder="Select departments" error={err('departments')} onChange={(v: string[]) => set('departments', v)}
              options={options.departments.map((d) => ({ value: d, label: d }))} containerClassName="sm:col-span-2" />
          )}
        </Grid>
        <Grid>
          <Select label="Applicable designations" required value={form.designationScope} searchable={false} onChange={(v: string) => set('designationScope', v as PolicyInput['designationScope'])} options={SCOPES} />
          {form.designationScope === 'selected' && (
            <Select label="Designations" isMulti value={form.designations} placeholder="Select designations" error={err('designations')} onChange={(v: string[]) => set('designations', v)}
              options={options.designations.map((d) => ({ value: d, label: d }))} containerClassName="sm:col-span-2" />
          )}
        </Grid>
        <Textarea label="Assignment remarks" rows={2} maxLength={1000} value={form.assignmentRemarks} error={err('assignmentRemarks')} onChange={(e) => set('assignmentRemarks', e.target.value)} />
      </Section>

      <Section id="admin" no={6} title="Administrative Information">
        <Grid>
          <Input label="Policy reference number" maxLength={100} value={form.referenceNo} placeholder="e.g. order / file number" error={err('referenceNo')} onChange={(e) => set('referenceNo', e.target.value)} />
          <div>
            <AppDatePicker label="Approval / order date" value={form.orderDate} placeholder="Select date" onChange={(d) => set('orderDate', d)} />
            {err('orderDate') && <p className="text-xs text-error mt-1">{err('orderDate')}</p>}
          </div>
        </Grid>
        <Textarea label="Official remarks" rows={2} maxLength={1000} value={form.officialRemarks} error={err('officialRemarks')} onChange={(e) => set('officialRemarks', e.target.value)} />
      </Section>

      <div className="sticky bottom-0 -mx-1 px-1 py-3 bg-slate-50/90 backdrop-blur flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
        <p className="text-xs text-slate-500">* Mandatory fields</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={Boolean(saving)}>Cancel</Button>
          <Button variant="outline" size="sm" onClick={() => void save('draft')} loading={saving === 'draft'} disabled={Boolean(saving)}>Save as draft</Button>
          <Button variant="primary" size="sm" onClick={() => void save('active')} loading={saving === 'active'} disabled={Boolean(saving)}>Save &amp; activate</Button>
        </div>
      </div>
    </div>
  );
};
