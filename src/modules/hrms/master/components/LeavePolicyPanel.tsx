import React, { useCallback, useEffect, useState } from 'react';
import { Copy, FileText, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { Badge, Button, DataTable, Input, Modal } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { ApiError } from '../../../../shared/services/api';
import { PolicyInput, PolicyList, PolicyRecord, leavePolicyApi } from '../../leave/leavePolicyApi';
import { LeavePolicyForm, blankPolicy } from './LeavePolicyForm';
import { ConfirmDialog, NoticeBar, PanelCard, useNotice } from './masterUi';

/**
 * Leave policies (category-wise): list, and the six-section form to add or edit a draft.
 * Active policies are locked; a change is made as a new version. Administrators change
 * policies; the auditor sees them read-only. The server decides and validates everything.
 */

const STATUS: Record<PolicyRecord['status'], { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: 'Draft', variant: 'warning' }, active: { label: 'Active', variant: 'success' }, inactive: { label: 'Inactive', variant: 'neutral' },
};

const toInput = (p: PolicyRecord): PolicyInput => {
  const { id: _id, editable: _editable, updatedAt: _updatedAt, status: _status, ...rest } = p;
  return { ...rest, status: 'draft' };
};

const fmt = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export const LeavePolicyPanel: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [data, setData] = useState<PolicyList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [notice, showNotice, clearNotice] = useNotice();

  const [form, setForm] = useState<{ initial: PolicyInput; editingId: string | null } | null>(null);

  const [statusFor, setStatusFor] = useState<PolicyRecord | null>(null);
  const [deleting, setDeleting] = useState<PolicyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [versionFor, setVersionFor] = useState<PolicyRecord | null>(null);
  const [versionForm, setVersionForm] = useState({ version: '', effectiveFrom: '' });
  const [versionErrors, setVersionErrors] = useState<Record<string, string>>({});
  const [versionMessage, setVersionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setData(await leavePolicyApi.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the leave policies.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const categoryName = (code: string) => data?.options.employeeTypes.find((t) => t.code === code)?.name ?? code;
  const roleName = (id: string) => data?.options.roles.find((r) => r.id === id)?.label ?? id;

  const run = async (work: () => Promise<{ message: string }>, close: () => void) => {
    setBusy(true);
    setDialogError(null);
    try {
      const result = await work();
      close();
      showNotice('success', result.message);
      await load();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'Could not complete this.');
    } finally {
      setBusy(false);
    }
  };

  const createVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionFor || busy) return;
    setBusy(true);
    setVersionMessage(null);
    try {
      const result = await leavePolicyApi.newVersion(versionFor.id, versionForm);
      setVersionFor(null);
      showNotice('success', result.message);
      await load();
    } catch (error) {
      if (error instanceof ApiError) { setVersionErrors(error.details ?? {}); setVersionMessage(error.message); } else setVersionMessage('Could not create the version.');
    } finally {
      setBusy(false);
    }
  };

  if (form && data) {
    return (
      <LeavePolicyForm options={data.options} initial={form.initial} editingId={form.editingId} onCancel={() => setForm(null)}
        onSaved={(message) => { setForm(null); showNotice('success', message); void load(); }} />
    );
  }

  const columns: ColumnDef<PolicyRecord>[] = [
    {
      key: 'name', header: 'Policy', width: '22%', sortValue: (p) => p.name,
      render: (p) => <div className="leading-tight"><div className="font-semibold text-slate-900">{p.name}</div><div className="font-mono text-[11px] text-slate-500">{p.code} · v{p.version}</div></div>,
    },
    { key: 'category', header: 'Category', width: '12%', sortValue: (p) => categoryName(p.employeeCategory), render: (p) => <span className="text-slate-700">{categoryName(p.employeeCategory)}</span> },
    {
      key: 'effective', header: 'Effective', width: '14%', sortValue: (p) => p.effectiveFrom,
      render: (p) => <div className="text-slate-700 text-xs leading-snug"><div>{fmt(p.effectiveFrom)}</div><div className="text-slate-500">{p.effectiveTo ? `to ${fmt(p.effectiveTo)}` : 'No end date'}</div></div>,
    },
    {
      key: 'items', header: 'Leave types', sortValue: (p) => p.items.length,
      render: (p) => <div className="whitespace-normal text-[11px] leading-snug text-slate-700">{p.items.length ? p.items.map((i) => `${i.leaveTypeCode} ${i.annualEntitlement}`).join(' · ') : '—'}</div>,
    },
    {
      key: 'approval', header: 'Approval', width: '14%', sortValue: (p) => p.approvalMode,
      render: (p) => (
        <div className="whitespace-normal text-[11px] leading-snug text-slate-700">
          {p.workflowStatus === 'disabled' ? 'Approved on application' : [p.l1Role && roleName(p.l1Role), p.approvalMode === 'two_level' && p.l2Role ? roleName(p.l2Role) : null].filter(Boolean).join(' → ')}
        </div>
      ),
    },
    { key: 'status', header: 'Status', width: '9%', sortValue: (p) => p.status, render: (p) => <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge> },
    ...(readOnly ? [] : [{
      key: 'actions', header: 'Actions', width: '150px', align: 'right' as const,
      render: (p: PolicyRecord) => (
        <div className="flex justify-end gap-1.5">
          {p.editable && <Button variant="icon" size="sm" leftIcon={Pencil} title="Edit" aria-label={`Edit ${p.name}`} onClick={() => setForm({ initial: toInput(p), editingId: p.id })} />}
          <Button variant="icon" size="sm" leftIcon={Copy} title="New version" aria-label={`New version of ${p.name}`}
            onClick={() => { setVersionErrors({}); setVersionMessage(null); setVersionForm({ version: '', effectiveFrom: '' }); setVersionFor(p); }} />
          <Button variant="icon" size="sm" leftIcon={Power} title={p.status === 'active' ? 'Make inactive' : 'Activate'} aria-label={`${p.status === 'active' ? 'Deactivate' : 'Activate'} ${p.name}`}
            onClick={() => { setDialogError(null); setStatusFor(p); }} />
          {p.editable && <Button variant="icon" size="sm" leftIcon={Trash2} title="Delete draft" aria-label={`Delete ${p.name}`} className="text-error hover:bg-error-subtle" onClick={() => { setDialogError(null); setDeleting(p); }} />}
        </div>
      ),
    }]),
  ];

  const activating = statusFor?.status !== 'active';

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><FileText className="w-4 h-4 text-primary" />Leave policies</>}
        count={data?.policies.length}
        actions={!readOnly && data && <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => setForm({ initial: blankPolicy(), editingId: null })}>Add leave policy</Button>}
      >
        <DataTable columns={columns} data={data?.policies ?? []} loading={loading} error={loadError} keyExtractor={(p) => p.id}
          emptyTitle="No leave policies yet" emptyDescription={readOnly ? 'Nothing has been added yet.' : 'Add the first leave policy for an employee category.'} />
      </PanelCard>

      <ConfirmDialog
        open={Boolean(statusFor)} busy={busy} error={dialogError} danger={!activating}
        title={activating ? 'Activate policy?' : 'Make policy inactive?'} confirmLabel={activating ? 'Activate' : 'Make inactive'}
        message={activating
          ? <>“{statusFor?.name}” v{statusFor?.version} will become active. An earlier active version of the same policy ends the day before it starts.</>
          : <>“{statusFor?.name}” v{statusFor?.version} will no longer be active. Its record is kept.</>}
        onConfirm={(reason) => statusFor && void run(() => leavePolicyApi.setStatus(statusFor.id, activating ? 'active' : 'inactive', reason || undefined), () => setStatusFor(null))}
        onCancel={() => !busy && setStatusFor(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)} danger busy={busy} error={dialogError} title="Delete draft policy?" confirmLabel="Delete"
        message={<>The draft “{deleting?.name}” v{deleting?.version} will be removed. Active and inactive policies are kept and cannot be deleted.</>}
        onConfirm={(reason) => deleting && void run(() => leavePolicyApi.remove(deleting.id, reason || undefined), () => setDeleting(null))}
        onCancel={() => !busy && setDeleting(null)}
      />

      <Modal
        isOpen={Boolean(versionFor)} onClose={() => !busy && setVersionFor(null)} size="sm" title="Create new version"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setVersionFor(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="policy-version" loading={busy}>Create draft</Button>
          </div>
        }
      >
        <form id="policy-version" onSubmit={createVersion} className="space-y-4" noValidate>
          <p className="text-xs text-slate-600">“{versionFor?.name}” v{versionFor?.version} is copied as a draft. Change the draft, then activate it; the earlier version ends the day before.</p>
          {versionMessage && <p role="alert" className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-xs text-error">{versionMessage}</p>}
          <Input label="New version" required maxLength={20} value={versionForm.version} placeholder="e.g. 2.0" error={versionErrors.version} onChange={(e) => setVersionForm((f) => ({ ...f, version: e.target.value }))} />
          <div>
            <AppDatePicker label="Effective from *" value={versionForm.effectiveFrom} placeholder="Select date" minDate={versionFor?.effectiveFrom} onChange={(d) => setVersionForm((f) => ({ ...f, effectiveFrom: d }))} />
            {versionErrors.effectiveFrom && <p className="text-xs text-error mt-1">{versionErrors.effectiveFrom}</p>}
          </div>
        </form>
      </Modal>
    </div>
  );
};
