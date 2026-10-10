import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PageHeader,
  Button,
  Badge,
  MetricCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  TablePagination,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormField,
  Input,
  Select
} from '../../shared/components';
import {
  Receipt,
  Plus,
  Search,
  IndianRupee,
  CreditCard,
  Building,
  Download
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form state
  const [claimType, setClaimType] = useState<'Tour TA/DA' | 'Field Contingency' | 'Consumables Bill'>('Tour TA/DA');
  const [claimAmount, setClaimAmount] = useState('');
  const [selectedOdRef, setSelectedOdRef] = useState(odRequests[0]?.id || 'OD-2026-081');
  const [budgetHead, setBudgetHead] = useState('Institute Grant Budget 2026-27');
  const [formError, setFormError] = useState('');

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(claimAmount);
    if (!amt || amt <= 0) {
      setFormError('Please enter a valid claim amount greater than 0.');
      return;
    }

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
    setFormError('');
  };

  const handleExportCSV = () => {
    const headers = ['Claim No', 'Claim Type', 'Claimant Name', 'Department', 'Associated OD Ref', 'Amount Claimed', 'Amount Sanctioned', 'Submitted Date', 'Budget Head', 'Status'];
    const rows = filteredClaims.map((c) => [
      `"${c.claimNo}"`,
      `"${c.claimType}"`,
      `"${c.claimantName}"`,
      `"${c.department}"`,
      `"${c.associatedOdRef || ''}"`,
      c.amountClaimed,
      c.amountSanctioned,
      c.submittedDate,
      `"${c.budgetHead}"`,
      `"${c.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WII_FinPay_Claims_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredClaims = claims.filter((c) => {
    const matchesStatus = selectedStatus === 'ALL' || c.status === selectedStatus;
    const matchesSearch =
      c.claimNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claimantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.budgetHead.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const paginatedClaims = filteredClaims.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalDisbursed = claims.filter((c) => c.status === 'Disbursed via PFMS').reduce((acc, c) => acc + c.amountSanctioned, 0);
  const totalAudit = claims.filter((c) => c.status === 'In Audit').reduce((acc, c) => acc + c.amountClaimed, 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Standardized Module PageHeader */}
      <PageHeader
        icon={Receipt}
        title="Finance & TA/DA Claims Management (FinPay)"
        subtitle="Tour TA/DA reimbursement, Outdoor Duty (OD) sync, field expense vouchers & PFMS e-disbursement."
        breadcrumbs={[
          { label: 'Portal Hub', onClick: onReturnToLobby },
          { label: 'Finance & TA/DA' }
        ]}
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setFormError('');
                setShowModal(true);
              }}
            >
              Submit TA/DA Claim
            </Button>
          </div>
        }
      />

      {/* Metrics Row using Standardized MetricCard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Disbursed via PFMS"
          value={formatCurrency(totalDisbursed)}
          subtitle="Direct Beneficiary Transfer"
          icon={IndianRupee}
          variant="success"
        />
        <MetricCard
          title="Audit Queue"
          value={formatCurrency(totalAudit)}
          subtitle={`${claims.filter((c) => c.status === 'In Audit').length} Bills Under Scrutiny`}
          icon={CreditCard}
          variant="warning"
        />
        <MetricCard
          title="Claims Reconciled"
          value={`${claims.length} Records`}
          subtitle="Tour TA/DA & Contingency"
          icon={Receipt}
          variant="primary"
        />
        <MetricCard
          title="Grant Corpus"
          value="₹14.8 Cr"
          subtitle="Annual Sanction Head"
          icon={Building}
          variant="info"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search claim no, claimant name, budget head..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={Search}
            size="sm"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end overflow-x-auto">
          <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">Status:</span>
          {['ALL', 'In Audit', 'DDO Approved', 'Disbursed via PFMS'].map((st) => (
            <Button
              key={st}
              size="xs"
              variant={selectedStatus === st ? 'primary' : 'outline'}
              onClick={() => {
                setSelectedStatus(st);
                setCurrentPage(1);
              }}
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Standardized Claims Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Claim Voucher No</TableHead>
              <TableHead className="w-[20%]">Claimant &amp; Department</TableHead>
              <TableHead className="w-[22%]">Type &amp; Budget Head</TableHead>
              <TableHead className="w-[16%]">Claimed vs Sanctioned</TableHead>
              <TableHead className="w-[12%]">Submission Date</TableHead>
              <TableHead align="center" className="w-[12%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClaims.length === 0 ? (
              <TableEmpty colSpan={6} message="No finance claims found matching search criteria." />
            ) : (
              paginatedClaims.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="align-middle font-mono font-bold text-slate-800 text-xs">
                    {c.claimNo}
                    {c.associatedOdRef && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Ref: {c.associatedOdRef}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="font-bold text-slate-900 leading-snug">{c.claimantName}</div>
                    <div className="text-[11px] text-slate-500">{c.department}</div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge variant="neutral" size="sm" className="mb-0.5">
                      {c.claimType}
                    </Badge>
                    <div className="text-[11px] text-slate-600 truncate max-w-xs">{c.budgetHead}</div>
                  </TableCell>
                  <TableCell className="align-middle font-medium text-slate-900">
                    <div className="font-bold text-slate-900">{formatCurrency(c.amountSanctioned)}</div>
                    {c.amountClaimed !== c.amountSanctioned && (
                      <div className="text-[10px] text-slate-400">Claimed: {formatCurrency(c.amountClaimed)}</div>
                    )}
                  </TableCell>
                  <TableCell className="align-middle font-mono text-slate-700 text-xs whitespace-nowrap">
                    {c.submittedDate}
                  </TableCell>
                  <TableCell align="center" className="align-middle whitespace-nowrap">
                    {c.status === 'Disbursed via PFMS' ? (
                      <Badge variant="success">PFMS Disbursed</Badge>
                    ) : c.status === 'DDO Approved' ? (
                      <Badge variant="info">DDO Approved</Badge>
                    ) : (
                      <Badge variant="warning">In Audit</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filteredClaims.length > pageSize && (
          <div className="border-t border-slate-100">
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredClaims.length / pageSize)}
              totalItems={filteredClaims.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Standardized Submit Claim Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="md"
      >
        <ModalHeader
          title="Submit Tour TA/DA or Expense Claim"
          subtitle="Attach bill amounts against approved Outdoor Duty (OD) or institutional budget heads."
          icon={Receipt}
          onClose={() => setShowModal(false)}
        />
        <form onSubmit={handleCreateClaim}>
          <ModalBody className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800">
                {formError}
              </div>
            )}

            <FormField label="Claim Category" required>
              <Select
                value={claimType}
                onChange={(val) => setClaimType(String(val) as any)}
                options={[
                  { value: 'Tour TA/DA', label: 'Tour TA / DA Requisition' },
                  { value: 'Field Contingency', label: 'Field Expedition Contingency' },
                  { value: 'Consumables Bill', label: 'Lab Consumables / Store Voucher' }
                ]}
              />
            </FormField>

            <FormField label="Associated Outdoor Duty (OD) Reference">
              <Select
                value={selectedOdRef}
                onChange={(val) => setSelectedOdRef(String(val))}
                options={odRequests.map((od) => ({
                  value: od.id,
                  label: `${od.id} — ${od.location} (${od.startDate} to ${od.endDate})`
                }))}
              />
            </FormField>

            <FormField label="Claim Amount (INR)" required>
              <Input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                placeholder="e.g. 18500"
                required
              />
            </FormField>

            <FormField label="Accounting Budget Head">
              <Input
                value={budgetHead}
                onChange={(e) => setBudgetHead(e.target.value)}
                placeholder="e.g. Institute Non-Plan Travel Head / CAMPA Project"
              />
            </FormField>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Submit Voucher
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
