import React, { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Pencil, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Button, Input, Modal } from '../../../shared/components';
import { AppSelect } from '../../../shared/components/AppSelect';
import { AppDatePicker } from '../../../shared/components/AppDatePicker';
import { Textarea } from '../../../shared/components/forms/Textarea';
import { ApiError } from '../../../shared/services/api';
import { Agency, Category, Project, ProjectForm, Stage, projectsApi } from '../projectsApi';

/**
 * Create / edit a project (RC office). Grouped as on paper: basic, sanction, people, work. A new project's stage is
 * chosen here (default Proposed); an existing project's stage is changed from its details (with the stage rules).
 */
interface Props {
  open: boolean;
  project: Project | null;
  agencies: Agency[];
  stages: Record<Stage, string>;
  categories: Record<Category, string>;
  onClose: () => void;
  onSaved: (project: Project, message: string) => void;
}

const EMPTY: ProjectForm = {
  code: '', title: '', shortName: '', category: '', fundingAgencyId: '', scheme: '', sanctionOrderNo: '', sanctionDate: '',
  sanctionedAmount: '', startDate: '', endDate: '', piUserId: '', piName: '', coPiUserIds: [], department: '', sites: '', objectives: '', remarks: '', stage: 'proposed',
};

const fromProject = (p: Project): ProjectForm => ({
  code: p.code, title: p.title, shortName: p.shortName ?? '', category: p.category ?? '', fundingAgencyId: p.fundingAgencyId ?? '',
  scheme: p.scheme ?? '', sanctionOrderNo: p.sanctionOrderNo ?? '', sanctionDate: p.sanctionDate ?? '',
  sanctionedAmount: p.sanctionedAmount === null ? '' : String(p.sanctionedAmount), startDate: p.startDate ?? '', endDate: p.endDate ?? '',
  piUserId: p.pi?.id ?? '', piName: p.pi ? '' : p.piName ?? '', coPiUserIds: p.coPis.map((c) => c.id), department: p.department ?? '', sites: p.sites ?? '',
  objectives: p.objectives ?? '', remarks: p.remarks ?? '', stage: p.stage,
});

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <fieldset className="border border-slate-200 rounded-2xl p-4 space-y-3">
    <legend className="px-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</legend>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
  </fieldset>
);

const Label: React.FC<{ text: string; required?: boolean; children: React.ReactNode; wide?: boolean; error?: string }> = ({ text, required, children, wide, error }) => (
  <div className={wide ? 'md:col-span-2' : ''}>
    <label className="block text-slate-700 font-bold mb-1 text-xs">{text}{required && <span className="text-blue-600 font-bold ml-0.5">*</span>}</label>
    {children}
    {error && <p className="mt-1 text-[11px] font-semibold text-error">{error}</p>}
  </div>
);

export const ProjectFormModal: React.FC<Props> = ({ open, project, agencies, stages, categories, onClose, onSaved }) => {
  const { users } = useApp();
  const [form, setForm] = useState<ProjectForm>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openDate, setOpenDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(project ? fromProject(project) : EMPTY);
    setErrors({}); setMessage(null); setOpenDate(null);
  }, [open, project]);

  const set = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => { if (!e[key]) return e; const n = { ...e }; delete n[key]; return n; });
  };

  // Any active employee can be PI or Co-PI (an HRMS scientist too).
  const people = useMemo(() => users
    .filter((u) => !u.isSystem && (u.status ?? 'active') === 'active')
    .map((u) => ({ value: String(u.id), label: `${u.name} (B.I. ${(u as { biometricId?: string }).biometricId ?? ''})${u.designation ? ` · ${u.designation}` : ''}` }))
    .sort((a, b) => a.label.localeCompare(b.label)), [users]);
  const labelOf = (id: string) => people.find((p) => p.value === id)?.label ?? id;
  const agencyOptions = agencies.filter((a) => a.status === 'ACTIVE' || a.id === form.fundingAgencyId).map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }));

  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      const result = project ? await projectsApi.update(project.id, form) : await projectsApi.create(form);
      onSaved(result.project, result.message);
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.details ?? {}); setMessage(e.message); }
      else setMessage('The project could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const date = (key: 'sanctionDate' | 'startDate' | 'endDate', text: string, minDate?: string) => (
    <Label text={text} error={errors[key]}>
      <AppDatePicker value={form[key]} minDate={minDate} isOpen={openDate === key} onToggle={() => setOpenDate((o) => (o === key ? null : key))}
        onChange={(d) => { set(key, d); setOpenDate(null); }} placeholder="DD-MM-YYYY" />
    </Label>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="2xl"
      icon={project ? Pencil : FolderPlus}
      title={project ? `Edit project ${project.code}` : 'New project'}
      subtitle="RC office: the project's record. Only the title is required; the rest can be filled in later."
      footer={(
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => void save()} loading={busy}>{project ? 'Save' : 'Create project'}</Button>
        </div>
      )}
    >
      <div className="space-y-4 text-xs">
        {message && <div role="alert" className="px-3 py-2 rounded-xl border bg-error-subtle border-error-border text-error font-semibold">{message}</div>}
        <Section title="Basic">
          <Label text="Project code" error={errors.code}>
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder={project ? 'e.g. WII-DST-2024-09' : 'Blank: given automatically (WII-PRJ-0001 …)'} size="sm" />
          </Label>
          <Label text="Short name" error={errors.shortName}>
            <Input value={form.shortName} onChange={(e) => set('shortName', e.target.value)} placeholder="e.g. Tiger Genetics" size="sm" />
          </Label>
          <Label text="Title" required wide error={errors.title}>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Full title of the project" size="sm" />
          </Label>
          <Label text="Category" error={errors.category}>
            <AppSelect value={form.category} onChange={(v) => set('category', v as Category | '')} placeholder="Choose the category"
              options={[{ value: '', label: '—' }, ...Object.entries(categories).map(([value, label]) => ({ value, label }))]} />
          </Label>
          <Label text="Funding agency" error={errors.fundingAgencyId}>
            <AppSelect value={form.fundingAgencyId} onChange={(v) => set('fundingAgencyId', v)} searchable placeholder={agencies.length ? 'Choose the agency' : 'Add agencies in Funding Agencies first'}
              options={[{ value: '', label: '—' }, ...agencyOptions]} />
          </Label>
          <Label text="Scheme / programme" wide error={errors.scheme}>
            <Input value={form.scheme} onChange={(e) => set('scheme', e.target.value)} size="sm" />
          </Label>
        </Section>

        <Section title="Sanction">
          <Label text="Sanction order no." error={errors.sanctionOrderNo}>
            <Input value={form.sanctionOrderNo} onChange={(e) => set('sanctionOrderNo', e.target.value)} size="sm" />
          </Label>
          {date('sanctionDate', 'Sanction date')}
          <Label text="Sanctioned amount (₹)" error={errors.sanctionedAmount}>
            <Input value={form.sanctionedAmount} inputMode="decimal" onChange={(e) => set('sanctionedAmount', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="e.g. 38500000" size="sm" />
          </Label>
          <div />
          {date('startDate', 'Start date')}
          {date('endDate', 'End date', form.startDate || undefined)}
        </Section>

        <Section title="People">
          <Label text="PI (Principal Investigator)" error={errors.piUserId}>
            <AppSelect value={form.piUserId} onChange={(v) => { set('piUserId', v); if (v) set('piName', ''); }} searchable placeholder="Choose the PI from the employees" options={[{ value: '', label: '—' }, ...people]} />
          </Label>
          {!form.piUserId && (
            <Label text="…or the PI's name" error={errors.piName}>
              <Input value={form.piName} onChange={(e) => set('piName', e.target.value)} placeholder="When the PI is not in the employee list" size="sm" />
            </Label>
          )}
          <Label text="Department / Faculty" error={errors.department}>
            <Input value={form.department} onChange={(e) => set('department', e.target.value)} size="sm" />
          </Label>
          <Label text="Co-PI(s)" wide error={errors.coPiUserIds}>
            <AppSelect value="" onChange={(v) => { if (v && !form.coPiUserIds.includes(v) && v !== form.piUserId) set('coPiUserIds', [...form.coPiUserIds, v]); }}
              searchable placeholder="Add a Co-PI" options={people.filter((p) => p.value !== form.piUserId && !form.coPiUserIds.includes(p.value))} />
            {form.coPiUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.coPiUserIds.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
                    {labelOf(id)}
                    <button type="button" aria-label={`Remove ${labelOf(id)}`} onClick={() => set('coPiUserIds', form.coPiUserIds.filter((x) => x !== id))} className="text-slate-400 hover:text-red-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Label>
        </Section>

        <Section title="Work">
          <Label text="Site / State(s)" wide error={errors.sites}>
            <Input value={form.sites} onChange={(e) => set('sites', e.target.value)} placeholder="e.g. Madhya Pradesh; Maharashtra" size="sm" />
          </Label>
          <div className="md:col-span-2">
            <Textarea label="Objectives / abstract" value={form.objectives} onChange={(e) => set('objectives', e.target.value)} rows={4} maxCharacters={5000} error={errors.objectives} />
          </div>
          <div className="md:col-span-2">
            <Textarea label="Remarks" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} rows={2} maxCharacters={2000} error={errors.remarks} />
          </div>
          {!project && (
            <Label text="Stage" error={errors.stage}>
              <AppSelect value={form.stage} onChange={(v) => set('stage', v as Stage)} options={Object.entries(stages).map(([value, label]) => ({ value, label }))} />
            </Label>
          )}
        </Section>
        <p className="text-[11px] text-slate-500">The proposal and the sanction order (PDF) are uploaded from the project's details after saving.</p>
      </div>
    </Modal>
  );
};
