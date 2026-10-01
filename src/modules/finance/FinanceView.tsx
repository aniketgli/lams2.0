import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  IndianRupee,
  FileCheck,
  CreditCard,
  Building,
  UploadCloud,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface FinanceViewProps {
  onReturnToLobby: () => void;
}

interface ClaimRecord {
  id: string;
  claimNo: string;
  claimType: 'Tour TA/DA' | 'Field Contingency' | 'Consumables Bill';
  claimantName: string;
  department: string;
  associatedOdRef?: string;
  amountClaimed: number;
  amountSanctioned: number;
  submittedDate: string;
  status: 'In Audit' | 'DDO Approved' | 'Disbursed via PFMS';
  budgetHead: string;
}

const INITIAL_CLAIMS: ClaimRecord[] = [
  {
    id: 'CLM-01',
    claimNo: 'TA-2026-091',
    claimType: 'Tour TA/DA',
    claimantName: 'Dr. Y.V. Jhala',
    department: 'Animal Ecology',
    associatedOdRef: 'OD-2026-081',
    amountClaimed: 48500,
    amountSanctioned: 48500,
    submittedDate: '2026-09-01',
    status: 'Disbursed via PFMS',
    budgetHead: 'Grant Project WII-DST-2024-09'
  },
  {
    id: 'CLM-02',
    claimNo: 'TA-2026-088',
    claimType: 'Tour TA/DA',
    claimantName: 'Dr. S. Sathyakumar',
    department: 'Endangered Species',
    associatedOdRef: 'OD-2026-077',
    amountClaimed: 32000,
    amountSanctioned: 32000,
    submittedDate: '2026-08-29',
    status: 'DDO Approved',
    budgetHead: 'Grant Project WII-MOEF-2023-14'
  },
  {
    id: 'CLM-03',
    claimNo: 'CONT-2026-034',
    claimType: 'Field Contingency',
    claimantName: 'Amit Sharma',
    department: 'Tiger Cell',
    amountClaimed: 18400,
    amountSanctioned: 16500,
    submittedDate: '2026-09-02',
    status: 'In Audit',
    budgetHead: 'Institute Non-Plan Contingency'
  }
];

export const FinanceView: React.FC<FinanceViewProps> = ({ onReturnToLobby }) => {
  const { currentUser, odRequests } = useApp();
  const [claims, setClaims] = useState<ClaimRecord[]>(INITIAL_CLAIMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [claimType, setClaimType] = useState<'Tour TA/DA' | 'Field Contingency' | 'Consumables Bill'>('Tour TA/DA');
  const [claimAmount, setClaimAmount] = useState('');
  const [selectedOdRef, setSelectedOdRef] = useState(odRequests[0]?.id || 'OD-2026-081');
  const [budgetHead, setBudgetHead] = useState('Institute Grant Budget 2026-27');

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(claimAmount) || 12000;
    const newClaim: ClaimRecord = {
      id: `CLM-${String(claims.length + 1).padStart(2, '0')}`,
      claimNo: `TA-2026-${Math.floor(100 + Math.random() * 900)}`,
      claimType,
      claimantName: currentUser.name,
      department: currentUser.department,
      associatedOdRef: selectedOdRef,
      amountClaimed: amt,
      amountSanctioned: amt,
      submittedDate: new Date().toISOString().split('T')[0],
      status: 'In Audit',
      budgetHead
    };
    setClaims([newClaim, ...claims]);
    setShowModal(false);
    setClaimAmount('');
  };

  const filteredClaims = claims.filter((c) => {
    const matchesStatus = selectedStatus === 'ALL' || c.status === selectedStatus;
    const matchesSearch =
      c.claimNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claimantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.budgetHead.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalDisbursed = claims.filter((c) => c.status === 'Disbursed via PFMS').reduce((acc, c) => acc + c.amountSanctioned, 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-xs">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                WII-FinPay • Finance &amp; TA/DA Portal
              </h2>
              <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-900 border border-rose-200 px-2 py-0.5 rounded-full">
                MOD-FIN-05
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Tour TA/DA Reimbursement, Outdoor Duty (OD) Sync, Field Vouchers &amp; PFMS Disbursal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Submit TA/DA Bill</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claims Lodged</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{claims.length} Claims</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">TA/DA &amp; Field Vouchers</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audit Queue</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{claims.filter((c) => c.status === 'In Audit').length} Pending</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Drawing &amp; Disbursing Officer</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disbursed (Month)</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(totalDisbursed)}</div>
          <div className="text-[11px] text-emerald-800 font-semibold mt-1">Direct PFMS Transfer</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">OD Sync Status</div>
          <div className="text-2xl font-black text-blue-700 mt-1">100% Validated</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Outdoor Duty Cross-Checked</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search claim no, employee, budget head..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-rose-700 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {['ALL', 'In Audit', 'DDO Approved', 'Disbursed via PFMS'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                selectedStatus === st
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr className="h-10">
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[20%]">Claim No &amp; Type</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[22%]">Claimant</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[26%]">OD Reference / Budget Head</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[14%]">Claimed Amount</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[10%]">Submitted</th>
                <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[8%]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClaims.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 align-middle">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-900 border border-rose-200 block w-fit mb-0.5">
                      {c.claimType}
                    </span>
                    {c.claimNo}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-bold text-slate-800">{c.claimantName}</div>
                    <div className="text-[11px] text-slate-500">{c.department}</div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {c.associatedOdRef && (
                      <span className="font-mono text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded inline-block mb-0.5">
                        OD: {c.associatedOdRef}
                      </span>
                    )}
                    <div className="text-xs text-slate-700 font-medium">{c.budgetHead}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 align-middle">
                    <div className="text-sm font-black">{formatCurrency(c.amountClaimed)}</div>
                    <div className="text-[10px] text-slate-500">Sanctioned: {formatCurrency(c.amountSanctioned)}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 align-middle">
                    {c.submittedDate}
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        c.status === 'Disbursed via PFMS'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : c.status === 'DDO Approved'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TA/DA Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Submit Official Tour TA/DA Claim</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Claim Type</label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-600 focus:outline-none"
                >
                  <option value="Tour TA/DA">Official Tour TA / DA Bill</option>
                  <option value="Field Contingency">Field Tour Contingency Expenses</option>
                  <option value="Consumables Bill">Lab / Station Consumables Invoice</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Total Claim Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 18500"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-rose-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Sanctioned OD Reference</label>
                <input
                  type="text"
                  value={selectedOdRef}
                  onChange={(e) => setSelectedOdRef(e.target.value)}
                  placeholder="e.g. OD-2026-081"
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-rose-600 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Cross-references approved Outdoor Duty dates and funding sanction.</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chargeable Budget Head</label>
                <input
                  type="text"
                  value={budgetHead}
                  onChange={(e) => setBudgetHead(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Submit for DDO Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
