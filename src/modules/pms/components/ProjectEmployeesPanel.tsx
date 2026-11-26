import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserCog, UserPlus, Users } from 'lucide-react';
import { Button, DataTable, Input, Modal } from '../../../shared/components';
import type { ColumnDef } from '../../../shared/components';
import { AppSelect } from '../../../shared/components/AppSelect';
import { ApiError } from '../../../shared/services/api';
import { Project, ProjectEmployee, ProjectEmployees, projectsApi } from '../projectsApi';
import { DateField, ErrorLine, Field, Panel } from './workspaceUi';

/**
 * Employees of a project: the PMS employees whose department is this project, with their reporting manager.
 * The PI (or the RC office) puts employees on the project and chooses who each reports to: the reporting manager
 * approves their leave, attendance and outdoor duty. Both are Employee Mapping orders (register + audit) on the server.
 */
interface Props { project: Project; canEdit: boolean; onMessage: (m: string) => void }

export const ProjectEmployeesPanel: React.FC<Props> = ({ project, canEdit, onMessage }) => {
  const [data, setData] = useState<ProjectEmployees | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [managerFor, setManagerFor] = useState<ProjectEmployee[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await projectsApi.employees(project.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The employees could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [project.id]);
  useEffect(() => { void load(); }, [load]);

  const employees = data?.employees ?? [];
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const columns: ColumnDef<ProjectEmployee>[] = [
    ...(canEdit ? [{ key: 'pick', header: '', width: '40px', render: (e: ProjectEmployee) => (
      <input type="checkbox" aria-label={`Select ${e.name}`} checked={selected.includes(e.id)} onChange={() => toggle(e.id)} onClick={(ev) => ev.stopPropagation()} />
    ) }] : []),
    { key: 'name', header: 'Employee', sortValue: (e) => e.name, render: (e) => (
      <div><div className="font-semibold text-slate-900">{e.name}</div><div className="text-[11px] text-slate-500">B.I. {e.biometricId}{e.status.toLowerCase() !== 'active' ? ` · ${e.status}` : ''}</div></div>
    ) },
    { key: 'designation', header: 'Designation', sortValue: (e) => e.designation ?? '', render: (e) => <span className="text-xs">{e.designation ?? '—'}</span> },
    { key: 'type', header: 'Employee type', sortValue: (e) => e.employmentType ?? '', render: (e) => <span className="text-xs">{e.employmentType ?? '—'}</span> },
    { key: 'rm', header: 'Reporting manager', sortValue: (e) => e.reportingManager?.name ?? '', render: (e) => (
      <span className="text-xs font-semibold">{e.reportingManager ? `${e.reportingManager.name} (B.I. ${e.reportingManager.biometricId})` : '—'}</span>
    ) },
    ...(canEdit ? [{ key: 'actions', header: '', align: 'right' as const, render: (e: ProjectEmployee) => (
      <button type="button" onClick={(ev) => { ev.stopPropagation(); setManagerFor([e]); }}
        className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Change RM</button>
    ) }] : []),
  ];

  return (
    <Panel
      title={<span className="flex items-center gap-1.5"><Users className="w-4 h-4" />Employees on the project ({employees.length})</span>}
      action={canEdit ? (
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button variant="outline" size="sm" leftIcon={<UserCog className="w-4 h-4" />}
              onClick={() => setManagerFor(employees.filter((e) => selected.includes(e.id)))}>Change RM ({selected.length})</Button>
          )}
          <Button variant="primary" size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => setAdding(true)}>Add employees</Button>
        </div>
      ) : undefined}
    >
      <div className="space-y-3">
        <p className="text-[11px] text-slate-500">
          The reporting manager approves the employee's leave, attendance and outdoor duty. Some employees can report to the PI,
          others to another PMS Reporting Manager.
        </p>
        <ErrorLine text={error} />
        <DataTable columns={columns} data={employees} loading={loading} keyExtractor={(e) => e.id}
          emptyTitle="No employees on this project yet" emptyDescription={canEdit ? 'Add PMS employees to the project.' : 'No employee profile names this project.'} />
      </div>
      {adding && data && (
        <AddEmployeesModal project={project} data={data} onClose={() => setAdding(false)}
          onDone={(m) => { setAdding(false); onMessage(m); void load(); }} />
      )}
      {managerFor && data && (
        <ManagerModal project={project} employees={managerFor} managers={data.managers} onClose={() => setManagerFor(null)}
          onDone={(m) => { setManagerFor(null); setSelected([]); onMessage(m); void load(); }} />
      )}
    </Panel>
  );
};

const AddEmployeesModal: React.FC<{ project: Project; data: ProjectEmployees; onClose: () => void; onDone: (m: string) => void }> = ({ project, data, onClose, onDone }) => {
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [rm, setRm] = useState('');
  const [effective, setEffective] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.candidates.filter((c) => !q || [c.name, c.biometricId, c.designation, c.department].some((v) => String(v ?? '').toLowerCase().includes(q))).slice(0, 200);
  }, [data.candidates, search]);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const r = await projectsApi.addEmployees(project.id, { userIds: chosen, reportingManagerId: rm || undefined, effectiveDate: effective || undefined });
      onDone(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The employees could not be added.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} size="xl" icon={UserPlus} title="Add employees to the project" subtitle={`${project.code} · ${project.title}`}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!chosen.length} onClick={() => void save()}>Add {chosen.length || ''} employee{chosen.length === 1 ? '' : 's'}</Button>
        </div>
      )}>
      <div className="space-y-3 text-xs">
        <ErrorLine text={error} />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PMS employees by name, B.I., designation or present project…" size="sm" />
        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          {list.length === 0 && <div className="px-3 py-4 text-center text-slate-500">No PMS employee to add.</div>}
          {list.map((c) => (
            <label key={c.id} className="flex items-start gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={chosen.includes(c.id)}
                onChange={() => setChosen((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
              <span>
                <span className="font-semibold text-slate-900">{c.name}</span> <span className="text-slate-500">B.I. {c.biometricId}</span>
                <span className="block text-[11px] text-slate-500">{c.designation ?? '—'}{c.department ? ` · now: ${c.department}` : ''}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Reporting manager (optional)">
            <AppSelect value={rm} onChange={setRm} searchable placeholder="Keep their present RM"
              options={[{ value: '', label: 'Keep their present RM' }, ...data.managers.map((m) => ({ value: m.id, label: `${m.name} (B.I. ${m.biometricId})` }))]} />
          </Field>
          <Field label="Effective from (optional)"><DateField value={effective} onChange={setEffective} placeholder="Today" /></Field>
        </div>
        <p className="text-[11px] text-slate-500">An employee already on another project moves to this one. The change is kept in the Employee Mapping register.</p>
      </div>
    </Modal>
  );
};

const ManagerModal: React.FC<{ project: Project; employees: ProjectEmployee[]; managers: ProjectEmployees['managers']; onClose: () => void; onDone: (m: string) => void }> = ({ project, employees, managers, onClose, onDone }) => {
  const [rm, setRm] = useState('');
  const [effective, setEffective] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const r = await projectsApi.changeManager(project.id, { userIds: employees.map((e) => e.id), reportingManagerId: rm, effectiveDate: effective || undefined });
      onDone(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The reporting manager could not be changed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} size="md" icon={UserCog} title="Change reporting manager" subtitle={employees.map((e) => e.name).join(', ')}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!rm} onClick={() => void save()}>Save</Button>
        </div>
      )}>
      <div className="space-y-3 text-xs">
        <ErrorLine text={error} />
        <Field label="New reporting manager" required>
          <AppSelect value={rm} onChange={setRm} searchable placeholder={managers.length ? 'Choose a PMS Reporting Manager' : 'No one has the PMS Reporting Manager role yet'}
            options={managers.map((m) => ({ value: m.id, label: `${m.name} (B.I. ${m.biometricId})` }))} />
        </Field>
        <Field label="Effective from (optional)"><DateField value={effective} onChange={setEffective} placeholder="Today" /></Field>
        <p className="text-[11px] text-slate-500">Only employees with the PMS Reporting Manager role (HRMS → User Controls) can be chosen. Project: {project.code}.</p>
      </div>
    </Modal>
  );
};
