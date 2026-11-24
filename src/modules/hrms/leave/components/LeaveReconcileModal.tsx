import React, { useEffect, useState } from 'react';
import { RefreshCw, Scale } from 'lucide-react';
import { Button, Modal } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { ReconcileRow, leaveApi } from '../leaveApi';

/**
 * Reconcile leave: the pro-rata quota of each employee for the leave year, worked out again from the rules, next to
 * the days credited. Only the rows that differ are listed; the ticked ones are set to the rule's value (audited).
 * Carry forward and the leave taken are not changed. Employees whose leave is not pro-rata (Permanent) are not
 * part of it: their balances come from Import leave.
 */
interface Props { open: boolean; year: number; onClose: () => void; onDone: (message: string) => void }

const days = (n: number | null) => (n === null ? '—' : String(Math.round(n * 10) / 10));
const key = (r: ReconcileRow) => `${r.userId}:${r.leaveTypeId}`;

export const LeaveReconcileModal: React.FC<Props> = ({ open, year, onClose, onDone }) => {
  const [rows, setRows] = useState<ReconcileRow[] | null>(null);
  const [checked, setChecked] = useState(0);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true); setError(null); setRows(null);
    try {
      const r = await leaveApi.reconcilePreview(year);
      setRows(r.rows);
      setChecked(r.checked);
      setTicked(new Set(r.rows.filter((x) => !x.problem).map(key)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not work out the balances.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { if (open) void load(); }, [open, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      const items = rows.filter((r) => ticked.has(key(r))).map((r) => ({ userId: r.userId, leaveTypeId: r.leaveTypeId }));
      const result = await leaveApi.reconcileApply(year, items);
      const skipped = result.skipped.length ? ` Skipped: ${result.skipped.map((s) => `${s.name} ${s.code} (${s.reason})`).join('; ')}` : '';
      onDone(`${result.message}${skipped}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The balances could not be corrected.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: string) => setTicked((t) => { const n = new Set(t); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const selectable = (rows ?? []).filter((r) => !r.problem);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="2xl"
      icon={Scale}
      title="Reconcile leave"
      subtitle={`Leave year ${year}: the pro-rata quota worked out again from the rules, against the days credited.`}
      footer={(
        <div className="flex items-center justify-between w-full gap-2">
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => void load()} disabled={busy}>Check again</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Close</Button>
            <Button variant="primary" size="sm" onClick={() => void apply()} loading={busy} disabled={!ticked.size || !rows?.length}>
              Correct {ticked.size} balance{ticked.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-3 text-xs">
        <p className="text-slate-600">
          Rule: yearly quota × the months from joining to <b>Valid up to</b> within the leave year ÷ 12 (a started month counts, nearest ½ day),
          for Contract, Project staff, PhD scholars and Interns. Carry forward and the leave taken are not changed; every correction is in the activity log.
          Permanent employees' balances are set with <b>Import leave</b> and are not part of this check.
        </p>
        {error && <div role="alert" className="px-3 py-2 rounded-xl border bg-error-subtle border-error-border text-error font-semibold">{error}</div>}
        {busy && !rows && <p className="text-slate-500">Working out the balances…</p>}
        {rows && !rows.length && (
          <div className="px-3 py-3 rounded-xl border bg-success-subtle border-success-border text-success font-semibold">
            Everything matches: {checked} employee(s) checked, no balance differs from the rule.
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto max-h-[55vh] border border-slate-200 rounded-xl">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-2">
                    <input type="checkbox" aria-label="Tick all" checked={selectable.length > 0 && selectable.every((r) => ticked.has(key(r)))}
                      onChange={(e) => setTicked(e.target.checked ? new Set(selectable.map(key)) : new Set())} />
                  </th>
                  <th className="py-2 px-2">Employee</th><th className="py-2 px-2">Leave</th><th className="py-2 px-2">Leave year · months</th>
                  <th className="py-2 px-2 text-right">Credited</th><th className="py-2 px-2 text-right">By rule</th><th className="py-2 px-2 text-right">Change</th>
                  <th className="py-2 px-2 text-right">Taken / waiting</th><th className="py-2 px-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={key(r)} className="border-b border-slate-100 align-top">
                    <td className="py-2 px-2"><input type="checkbox" aria-label={`Correct ${r.name} ${r.code}`} disabled={Boolean(r.problem)} checked={ticked.has(key(r))} onChange={() => toggle(key(r))} /></td>
                    <td className="py-2 px-2"><b className="text-slate-900">{r.name}</b><div className="text-slate-500">B.I. {r.biometricId}</div></td>
                    <td className="py-2 px-2">{r.code}<div className="text-slate-500">{days(r.yearlyQuota)} a year</div></td>
                    <td className="py-2 px-2">{r.cycle}<div className="text-slate-500">{r.period}</div></td>
                    <td className="py-2 px-2 text-right">{days(r.credited)}</td>
                    <td className="py-2 px-2 text-right font-bold">{days(r.expected)}</td>
                    <td className={`py-2 px-2 text-right font-bold ${r.difference < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{r.difference > 0 ? '+' : ''}{days(r.difference)}</td>
                    <td className="py-2 px-2 text-right">{days(r.usedOrPending)}</td>
                    <td className="py-2 px-2 text-slate-600">
                      {r.problem ?? (r.asOf ? `Balance was set by hand as on ${r.asOf}: check before correcting.` : r.credited === null ? 'No balance credited.' : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
