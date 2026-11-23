import React, { useMemo, useState } from 'react';
import { FileCheck2, FileDown } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { Alert, AppDatePicker, AppSelect, Button } from '../../../../shared/components';
import { FilterToolbar } from '../../../../shared/components/FilterToolbar';
import { ApiError, api } from '../../../../shared/services/api';
import { buildTablePdf, pdfText, reportFileName } from '../../../../shared/services/printTable';

/**
 * No Dues — leave clearance of a Contract / Project staff / PhD scholar / Intern who is leaving. The server works out,
 * per leave year and leave type, the leave entitled up to the relieving date (pro-rata) and the leave used beyond it
 * (to be recovered from salary). Leave records are not changed. "Issue" records the clearance in the audit log and
 * downloads the certificate as a PDF. Administrator only (server/leave/noDues.ts).
 */
interface ClearanceRow {
  cycleYear: number; cycle: string; workedPeriod: string; code: string; name: string; yearlyQuota: number;
  credited: number; notWorkedDays: number; entitled: number; used: number; pending: number; excess: number;
}
interface Clearance {
  employee: { id: string; biometricId: string; name: string; designation: string; department: string; employmentType: string; joiningDate: string | null; validUpto: string | null };
  relievingDate: string; rows: ClearanceRow[]; totalExcess: number; pendingRequests: number;
  leaveAfterRelieving: Array<{ code: string; from: string; to: string; days: number }>; warnings: string[]; issuedAt?: string;
}

const PRO_RATA_LAYOUTS = new Set(['contractual', 'researcher', 'phd_student', 'intern']);
const fmt = (d: string | null) => (d ? d.split('-').reverse().join('-') : '—');
const days = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function certificatePdf(c: Clearance): void {
  const e = c.employee;
  const doc = buildTablePdf({
    title: 'No Dues — Leave Clearance',
    subtitle: [
      `${e.name} (B.I. ${e.biometricId}) · ${e.designation || '—'} · ${e.department || '—'} · ${e.employmentType}`,
      `Joining ${fmt(e.joiningDate)} · Relieving ${fmt(c.relievingDate)} · Valid up to ${fmt(e.validUpto)}`,
    ],
    headers: ['Leave year', 'Months worked', 'Leave type', 'Balance credited', 'Months not worked (days)', 'Entitled', 'Used', 'Excess'],
    rows: c.rows.map((r) => [r.cycle, r.workedPeriod, `${r.code} — ${r.name}`, days(r.credited), days(r.notWorkedDays), days(r.entitled), days(r.used), days(r.excess)]),
    landscape: true,
  });
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = last + 14;
  if (y + 45 > pageHeight - 15) { doc.addPage(); y = 20; }
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const verdict = c.totalExcess > 0
    ? `Excess leave availed beyond the pro-rata entitlement: ${days(c.totalExcess)} day(s), to be recovered from salary.`
    : 'No excess leave: the leave availed is within the pro-rata entitlement.';
  doc.text(pdfText(verdict), 12, y, { maxWidth: pageWidth - 24 });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(pdfText('Entitled = balance credited for the year (with days carried forward) less the pro-rata days of the months after the relieving date (a started month counts as worked).'), 12, y, { maxWidth: pageWidth - 24 });
  y += 22;
  doc.text('Dealing Assistant', 20, y);
  doc.text('Administrative Officer', pageWidth / 2 - 20, y);
  doc.text('Head of Office', pageWidth - 60, y);
  doc.save(`${reportFileName(`No_Dues_Leave_${e.biometricId}`)}.pdf`);
}

export const NoDuesPanel: React.FC<{ toolbarStart?: React.ReactNode }> = ({ toolbarStart }) => {
  const { users, masterOptions } = useApp();
  const [userId, setUserId] = useState('');
  const [relievingDate, setRelievingDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [result, setResult] = useState<Clearance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only the employee types whose leave is credited pro-rata.
  const options = useMemo(() => {
    const layoutOf = new Map((masterOptions.employeeType ?? []).map((t) => [t.code, String(t.fields?.formLayout ?? '')]));
    return users
      .filter((u) => PRO_RATA_LAYOUTS.has(layoutOf.get(String((u as { employmentType?: string }).employmentType ?? '')) ?? ''))
      .map((u) => ({ label: `${u.name} (B.I. ${(u as { biometricId?: string }).biometricId ?? ''})`, value: String(u.id) }));
  }, [users, masterOptions.employeeType]);

  const run = async (issue: boolean) => {
    if (!userId || !relievingDate) { setError('Choose the employee and the relieving date.'); return; }
    setBusy(true); setError(null);
    try {
      const c = issue
        ? await api<Clearance>('/hrms/leave/no-dues', { method: 'POST', body: { userId, relievingDate } })
        : await api<Clearance>(`/hrms/leave/no-dues?userId=${encodeURIComponent(userId)}&relievingDate=${encodeURIComponent(relievingDate)}`);
      setResult(c);
      if (issue) certificatePdf(c);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'Could not work out the clearance.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {toolbarStart && <FilterToolbar start={toolbarStart} />}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">No Dues — leave clearance</h2>
          <p className="text-xs text-slate-500 mt-0.5">For Contract, Project staff, PhD scholars and Interns who are leaving: leave entitled up to the relieving date (pro-rata) and leave used beyond it, to be recovered. Leave records are not changed.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-slate-700 font-bold mb-1 text-xs">Employee</label>
            <AppSelect value={userId} onChange={(v) => { setUserId(v); setResult(null); }} options={options} placeholder="Choose an employee" searchable className="w-full" />
          </div>
          <AppDatePicker label="Relieving date" required value={relievingDate} isOpen={dateOpen} onToggle={() => setDateOpen((o) => !o)}
            onChange={(d) => { setRelievingDate(d); setDateOpen(false); setResult(null); }} placeholder="Last working day" />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void run(false)} loading={busy} disabled={!userId || !relievingDate}>Work out</Button>
          <Button variant="primary" size="sm" leftIcon={FileCheck2} onClick={() => void run(true)} disabled={busy || !result || result.pendingRequests > 0}>
            Issue and download PDF
          </Button>
          {result?.issuedAt && (
            <Button variant="ghost" size="sm" leftIcon={FileDown} onClick={() => certificatePdf(result)}>Download again</Button>
          )}
        </div>
        {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      </div>

      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="text-xs text-slate-600">
            <b className="text-slate-900">{result.employee.name}</b> (B.I. {result.employee.biometricId}) · {result.employee.designation || '—'} · {result.employee.employmentType}
            <br />Joining {fmt(result.employee.joiningDate)} · Relieving {fmt(result.relievingDate)} · Valid up to {fmt(result.employee.validUpto)}
          </div>
          {result.warnings.map((w) => <Alert key={w} variant="warning">{w}</Alert>)}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Leave year</th><th className="py-2 pr-3">Months worked</th><th className="py-2 pr-3">Leave type</th>
                  <th className="py-2 pr-3 text-right">Credited</th><th className="py-2 pr-3 text-right">Not worked (days)</th>
                  <th className="py-2 pr-3 text-right">Entitled</th><th className="py-2 pr-3 text-right">Used</th><th className="py-2 text-right">Excess</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={`${r.cycleYear}-${r.code}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{r.cycle}</td><td className="py-2 pr-3">{r.workedPeriod}</td><td className="py-2 pr-3">{r.code} — {r.name}</td>
                    <td className="py-2 pr-3 text-right">{days(r.credited)}</td><td className="py-2 pr-3 text-right">{days(r.notWorkedDays)}</td>
                    <td className="py-2 pr-3 text-right">{days(r.entitled)}</td><td className="py-2 pr-3 text-right">{days(r.used)}</td>
                    <td className={`py-2 text-right font-bold ${r.excess > 0 ? 'text-red-600' : 'text-slate-700'}`}>{days(r.excess)}</td>
                  </tr>
                ))}
                {!result.rows.length && <tr><td colSpan={8} className="py-4 text-center text-slate-500">No leave credited or used.</td></tr>}
              </tbody>
            </table>
          </div>
          <Alert variant={result.totalExcess > 0 ? 'error' : 'success'}>
            {result.totalExcess > 0
              ? `Excess leave beyond the pro-rata entitlement: ${days(result.totalExcess)} day(s), to be recovered from salary.`
              : 'No excess leave: the leave availed is within the pro-rata entitlement.'}
          </Alert>
          {result.issuedAt && <p className="text-[11px] text-slate-500">Issued {new Date(result.issuedAt).toLocaleString('en-IN')} — recorded in the leave activity log.</p>}
        </div>
      )}
    </div>
  );
};
