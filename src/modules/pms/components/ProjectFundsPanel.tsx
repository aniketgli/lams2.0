import React, { useCallback, useEffect, useState } from 'react';
import { IndianRupee, Plus, Wallet } from 'lucide-react';
import { Button, DataTable, Input, Modal } from '../../../shared/components';
import type { ColumnDef } from '../../../shared/components';
import { AppSelect } from '../../../shared/components/AppSelect';
import { ApiError } from '../../../shared/services/api';
import { ConfirmDialog } from '../../hrms/master/components/masterUi';
import { BudgetHead, Expenditure, FundKind, Funds, Project, Receipt, formatDay, formatRupees, projectsApi } from '../projectsApi';
import { DateField, ErrorLine, Field, Panel, RowActions } from './workspaceUi';

/**
 * Funds of a project: the budget by head, the instalments received from the funding agency and what was spent
 * (by head). Totals: sanctioned, budgeted, received, spent and the balance in hand (received − spent).
 */
interface Props { project: Project; canEdit: boolean; onMessage: (m: string) => void }

type Editing = { kind: FundKind; entry: BudgetHead | Receipt | Expenditure | null };
const NOUN: Record<FundKind, string> = { heads: 'budget head', receipts: 'instalment received', expenditures: 'expenditure' };

export const ProjectFundsPanel: React.FC<Props> = ({ project, canEdit, onMessage }) => {
  const [funds, setFunds] = useState<Funds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<{ kind: FundKind; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setFunds(await projectsApi.funds(project.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The funds could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [project.id]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (reason: string) => {
    if (!removing) return;
    setBusy(true); setRemoveError(null);
    try {
      setFunds(await projectsApi.deleteFund(project.id, removing.kind, removing.id, reason));
      onMessage(`The ${NOUN[removing.kind]} was removed.`);
      setRemoving(null);
    } catch (e) {
      setRemoveError(e instanceof ApiError ? e.message : 'It could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  const t = funds?.totals;
  const cards = t ? [
    { label: 'Sanctioned', value: formatRupees(t.sanctioned), note: 'From the project record' },
    { label: 'Budgeted by head', value: formatRupees(t.budgeted), note: `${funds!.heads.length} head(s)` },
    { label: 'Received', value: formatRupees(t.received), note: `${funds!.receipts.length} instalment(s)` },
    { label: 'Spent', value: formatRupees(t.spent), note: `${funds!.expenditures.length} entr${funds!.expenditures.length === 1 ? 'y' : 'ies'}` },
    { label: 'Balance in hand', value: formatRupees(t.balance), note: 'Received − spent', warn: t.balance < 0 },
  ] : [];

  const add = (kind: FundKind) => (canEdit ? (
    <Button variant="outline" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setEditing({ kind, entry: null })}>Add</Button>
  ) : undefined);
  const actions = <T extends { id: string }>(kind: FundKind, labelOf: (x: T) => string) => (canEdit ? [{
    key: 'actions', header: '', align: 'right' as const,
    render: (x: T) => <RowActions onEdit={() => setEditing({ kind, entry: x as unknown as Editing['entry'] })} onDelete={() => setRemoving({ kind, id: x.id, label: labelOf(x) })} />,
  }] : []);

  const headCols: ColumnDef<BudgetHead>[] = [
    { key: 'name', header: 'Head', sortValue: (h) => h.name, render: (h) => <div><div className="font-semibold">{h.name}</div>{h.remarks && <div className="text-[11px] text-slate-500">{h.remarks}</div>}</div> },
    { key: 'sanctioned', header: 'Budget', align: 'right', sortValue: (h) => h.sanctioned, render: (h) => formatRupees(h.sanctioned) },
    { key: 'spent', header: 'Spent', align: 'right', sortValue: (h) => h.spent, render: (h) => formatRupees(h.spent) },
    { key: 'left', header: 'Left', align: 'right', sortValue: (h) => h.sanctioned - h.spent, render: (h) => (
      <span className={h.sanctioned - h.spent < 0 ? 'text-error font-bold' : 'font-semibold'}>{formatRupees(Math.round((h.sanctioned - h.spent) * 100) / 100)}</span>
    ) },
    ...actions<BudgetHead>('heads', (h) => h.name),
  ];
  const receiptCols: ColumnDef<Receipt>[] = [
    { key: 'date', header: 'Received on', sortValue: (r) => r.receivedOn, render: (r) => <span className="font-mono text-xs">{formatDay(r.receivedOn)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (r) => r.amount, render: (r) => <span className="font-semibold">{formatRupees(r.amount)}</span> },
    { key: 'ref', header: 'Reference / UTR', sortValue: (r) => r.reference ?? '', render: (r) => <span className="text-xs">{r.reference ?? '—'}</span> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="text-xs">{r.remarks ?? '—'}</span> },
    ...actions<Receipt>('receipts', (r) => `${formatRupees(r.amount)} on ${formatDay(r.receivedOn)}`),
  ];
  const spentCols: ColumnDef<Expenditure>[] = [
    { key: 'date', header: 'Date', sortValue: (x) => x.spentOn, render: (x) => <span className="font-mono text-xs">{formatDay(x.spentOn)}</span> },
    { key: 'head', header: 'Head', sortValue: (x) => x.head ?? '', render: (x) => <span className="text-xs">{x.head ?? '—'}</span> },
    { key: 'desc', header: 'Description', sortValue: (x) => x.description, render: (x) => <div className="text-xs"><div>{x.description}</div>{x.voucherNo && <div className="text-slate-500">Voucher {x.voucherNo}</div>}</div> },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (x) => x.amount, render: (x) => <span className="font-semibold">{formatRupees(x.amount)}</span> },
    ...actions<Expenditure>('expenditures', (x) => `${x.description} (${formatRupees(x.amount)})`),
  ];

  return (
    <div className="space-y-4">
      <ErrorLine text={error} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs min-w-0">
            <p className="text-[11px] font-semibold text-slate-500">{c.label}</p>
            <p className={`text-base font-extrabold truncate ${c.warn ? 'text-error' : 'text-slate-900'}`} title={c.value}>{c.value}</p>
            <p className="text-[11px] text-slate-500">{c.note}</p>
          </div>
        ))}
      </div>
      <Panel title={<span className="flex items-center gap-1.5"><Wallet className="w-4 h-4" />Budget by head</span>} action={add('heads')}>
        <DataTable columns={headCols} data={funds?.heads ?? []} loading={loading} keyExtractor={(h) => h.id} emptyTitle="No budget heads yet" emptyDescription="E.g. Manpower, Equipment, Travel, Contingency, Overheads." />
      </Panel>
      <Panel title={<span className="flex items-center gap-1.5"><IndianRupee className="w-4 h-4" />Instalments received</span>} action={add('receipts')}>
        <DataTable columns={receiptCols} data={funds?.receipts ?? []} loading={loading} keyExtractor={(r) => r.id} emptyTitle="No instalment received yet" />
      </Panel>
      <Panel title="Expenditure" action={add('expenditures')}>
        <DataTable columns={spentCols} data={funds?.expenditures ?? []} loading={loading} keyExtractor={(x) => x.id} emptyTitle="No expenditure yet" />
      </Panel>

      {editing && funds && (
        <FundModal project={project} editing={editing} heads={funds.heads} onClose={() => setEditing(null)}
          onSaved={(f) => { setFunds(f); onMessage(`The ${NOUN[editing.kind]} was saved.`); setEditing(null); }} />
      )}
      <ConfirmDialog open={removing !== null} title={`Remove this ${removing ? NOUN[removing.kind] : ''}?`} message={removing?.label ?? ''} confirmLabel="Remove" danger
        busy={busy} error={removeError} onConfirm={(r) => void remove(r)} onCancel={() => { setRemoving(null); setRemoveError(null); }} />
    </div>
  );
};

const FundModal: React.FC<{ project: Project; editing: Editing; heads: BudgetHead[]; onClose: () => void; onSaved: (f: Funds) => void }> = ({ project, editing, heads, onClose, onSaved }) => {
  const { kind, entry } = editing;
  const initial = (): Record<string, string> => {
    if (kind === 'heads') { const h = entry as BudgetHead | null; return { name: h?.name ?? '', sanctioned: h ? String(h.sanctioned) : '', remarks: h?.remarks ?? '' }; }
    if (kind === 'receipts') { const r = entry as Receipt | null; return { receivedOn: r?.receivedOn ?? '', amount: r ? String(r.amount) : '', reference: r?.reference ?? '', remarks: r?.remarks ?? '' }; }
    const x = entry as Expenditure | null;
    return { spentOn: x?.spentOn ?? '', amount: x ? String(x.amount) : '', headId: x?.headId ?? '', description: x?.description ?? '', voucherNo: x?.voucherNo ?? '' };
  };
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true); setError(null); setErrors({});
    try {
      onSaved(await projectsApi.saveFund(project.id, kind, entry?.id ?? null, form));
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.details ?? {}); setError(e.message); } else setError('It could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const text = (k: string, label: string, required = false, placeholder?: string, wide = false) => (
    <Field label={label} required={required} error={errors[k]} wide={wide}>
      <Input value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} size="sm" />
    </Field>
  );
  return (
    <Modal isOpen onClose={onClose} size="lg" title={`${entry ? 'Edit' : 'Add'} ${NOUN[kind]}`} subtitle={`${project.code} · ${project.title}`}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void save()}>Save</Button>
        </div>
      )}>
      <div className="space-y-3 text-xs">
        <ErrorLine text={error} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {kind === 'heads' && (<>
            {text('name', 'Head', true, 'e.g. Manpower')}
            {text('sanctioned', 'Budget (₹)', true, '0')}
            {text('remarks', 'Remarks', false, undefined, true)}
          </>)}
          {kind === 'receipts' && (<>
            <Field label="Received on" required error={errors.receivedOn}><DateField value={form.receivedOn} onChange={(v) => set('receivedOn', v)} /></Field>
            {text('amount', 'Amount (₹)', true)}
            {text('reference', 'Reference / UTR / sanction letter')}
            {text('remarks', 'Remarks')}
          </>)}
          {kind === 'expenditures' && (<>
            <Field label="Date" required error={errors.spentOn}><DateField value={form.spentOn} onChange={(v) => set('spentOn', v)} /></Field>
            {text('amount', 'Amount (₹)', true)}
            <Field label="Budget head" error={errors.headId}>
              <AppSelect value={form.headId} onChange={(v) => set('headId', v)} placeholder={heads.length ? 'Choose the head' : 'Add budget heads first'}
                options={[{ value: '', label: '—' }, ...heads.map((h) => ({ value: h.id, label: h.name }))]} />
            </Field>
            {text('voucherNo', 'Voucher / bill no.')}
            {text('description', 'Description', true, undefined, true)}
          </>)}
        </div>
      </div>
    </Modal>
  );
};
