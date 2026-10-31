import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { DataTable, Modal } from '../../../../shared/components';
import type { ColumnDef } from '../../../../shared/components';
import { ApiError } from '../../../../shared/services/api';
import { LeaveHistory, leaveApi } from '../leaveApi';

/** Every leave year of one employee: the days granted and what was taken, per leave type. Read from the server. */

interface Row { key: string; cycle: string; cycleType: 'CY' | 'FY'; code: string; name: string; isDebited: boolean; total: number; used: number; pending: number; available: number }
const days = (n: number) => String(Math.round(n * 10) / 10);

export const LeaveHistoryModal: React.FC<{ userId: string | null; name: string; onClose: () => void }> = ({ userId, name, onClose }) => {
  const [history, setHistory] = useState<LeaveHistory | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setHistory(null); return; }
    let live = true;
    setLoading(true); setError(undefined); setHistory(null);
    leaveApi.history(userId)
      .then((h) => { if (live) setHistory(h); })
      .catch((e) => { if (live) setError(e instanceof ApiError ? e.message : 'The history could not be loaded.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [userId]);

  const rows: Row[] = (history?.years ?? []).flatMap((y) => y.types.map((t) => ({
    key: `${y.year}:${t.code}`, cycle: y.cycle, cycleType: y.cycleType, code: t.code, name: t.name, isDebited: t.isDebited,
    total: t.total + t.carryForward, used: t.used, pending: t.pending, available: t.available,
  })));

  const columns: ColumnDef<Row>[] = [
    { key: 'cycle', header: 'Leave year', width: '22%', sortValue: (r) => r.cycle, render: (r) => <span className="font-semibold text-slate-900">{r.cycle} <span className="text-[10px] font-bold text-slate-500">{r.cycleType}</span></span> },
    { key: 'type', header: 'Leave type', sortValue: (r) => r.name, render: (r) => <div className="leading-tight"><div className="font-semibold">{r.name}</div><div className="font-mono text-[11px] text-slate-500">{r.code}</div></div> },
    { key: 'total', header: 'Granted', align: 'center', render: (r) => (r.isDebited ? days(r.total) : 'No limit') },
    { key: 'used', header: 'Taken', align: 'center', render: (r) => days(r.used) },
    { key: 'pending', header: 'Pending', align: 'center', render: (r) => days(r.pending) },
    { key: 'available', header: 'Available', align: 'center', render: (r) => (r.isDebited ? <b className={r.available <= 0 ? 'text-rose-600' : ''}>{days(r.available)}</b> : '—') },
  ];

  return (
    <Modal isOpen={Boolean(userId)} onClose={onClose} size="xl" icon={History} title="Leave history" subtitle={history ? `${history.employee.name} · B.I. ${history.employee.biometricId}` : name}>
      <DataTable columns={columns} data={rows} loading={loading} error={error} keyExtractor={(r) => r.key}
        emptyTitle="No leave history yet" emptyDescription="No balance has been set and no leave taken in any year." />
    </Modal>
  );
};
