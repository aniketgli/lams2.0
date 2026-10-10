import React, { useState } from 'react';
import {
  Upload,
  X,
  FileDown,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Check,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import {
  isCalendarYearCadre,
  getAccountingCycleLabel,
  getAccountingCycleMeta
} from '../utils/leaveCycleUtils';

interface LeaveQuotaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: string;
  onSuccess?: (message: string) => void;
}

interface AffectedImportRecord {
  id: string;
  userId: string;
  userName: string;
  biometricId: string;
  employmentType: string;
  avatar?: string;
  leaveType: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: string;
  currentTotal: number;
  newTotal: number;
  delta: number;
  used: number;
  pending: number;
  carryForward: number;
  status: 'valid' | 'warning' | 'error';
  message: string;
}

export const LeaveQuotaImportModal: React.FC<LeaveQuotaImportModalProps> = ({
  isOpen,
  onClose,
  selectedYear,
  onSuccess
}) => {
  const { users, leavePolicies, batchUpdateLeaveBalances } = useApp();

  const [step, setStep] = useState<'upload' | 'verify'>('upload');
  const [csvImportStrategy, setCsvImportStrategy] = useState<'set' | 'add' | 'less'>('set');

  // CSV File States
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvFileSize, setCsvFileSize] = useState<string>('');
  const [csvParseError, setCsvParseError] = useState<string>('');
  const [affectedRecords, setAffectedRecords] = useState<AffectedImportRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setCsvImportStrategy('set');
    setCsvRawText('');
    setCsvFileName('');
    setCsvFileSize('');
    setCsvParseError('');
    setAffectedRecords([]);
    setIsSubmitting(false);
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  // Sample CSV generator with standard format
  const handleDownloadSampleCSV = () => {
    const sampleStaff = users.slice(0, 4);
    const rows = [
      'Biometric_ID,Employee_Name,Leave_Code,Total_Quota,Year',
      ...sampleStaff.map((u, idx) => {
        const code = idx % 2 === 0 ? 'CL' : 'EL';
        const quota = idx % 2 === 0 ? 12 : 30;
        return `"${u.biometricId || u.id}","${u.name}",${code},${quota},${selectedYear}`;
      })
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sample_Leave_Import_${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export cadre specific staff roster CSV
  const handleExportRosterCSV = (targetCadre: 'all' | 'CY' | 'FY' = 'all') => {
    const headers = [
      'Biometric_ID',
      'Employee_Name',
      'Employment_Type',
      'Accounting_Cycle',
      'Year',
      'Leave_Code',
      'Total_Quota'
    ];

    const rows: string[] = [headers.join(',')];

    users.forEach((u) => {
      const isCY = isCalendarYearCadre(u.employmentType);
      if (targetCadre === 'CY' && !isCY) return;
      if (targetCadre === 'FY' && isCY) return;

      leavePolicies.forEach((pol) => {
        const isApplicable =
          !pol.allowedEmploymentTypes || pol.allowedEmploymentTypes.includes(u.employmentType);
        if (!isApplicable) return;

        const cycleLabel = getAccountingCycleLabel(u.employmentType, selectedYear);
        const userYearly = u.yearlyLeaveBalances || {};
        const yearBal = userYearly[selectedYear] || u.leaveBalances || {};
        const currentCell = yearBal[pol.type];
        const total = currentCell?.total ?? pol.defaultQuota;

        rows.push(
          [
            `"${u.biometricId || u.id}"`,
            `"${u.name}"`,
            `"${u.employmentType}"`,
            `"${cycleLabel}"`,
            selectedYear,
            pol.code || pol.type.toUpperCase(),
            total
          ].join(',')
        );
      });
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cadreName = targetCadre === 'CY' ? 'Regular_CY' : targetCadre === 'FY' ? 'Project_FY' : 'All_Staff';
    a.download = `Staff_Leave_Roster_${cadreName}_${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCSVUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvRawText(text);
      setCsvParseError('');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleProcessCsvForVerification = () => {
    setCsvParseError('');

    if (!csvRawText.trim()) {
      setCsvParseError('Please upload a CSV file or paste tabular data first.');
      return;
    }

    const lines = csvRawText
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    if (lines.length < 2) {
      setCsvParseError('The file contains no data rows or is missing the header line.');
      return;
    }

    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const rawHeaders = parseCSVLine(lines[0], delimiter).map((h) =>
      h.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    const idIdx = rawHeaders.findIndex((h) =>
      ['userid', 'user_id', 'id', 'biometricid', 'biometric_id', 'bioid', 'empid', 'employeeid', 'staffid', 'empcode', 'employeecode'].includes(h)
    );
    const nameIdx = rawHeaders.findIndex((h) =>
      ['employeename', 'name', 'staffname', 'fullname', 'email'].includes(h)
    );
    const codeIdx = rawHeaders.findIndex((h) =>
      ['leavetypecode', 'leavecode', 'code', 'leavetype', 'leave_type', 'type'].includes(h)
    );
    const quotaIdx = rawHeaders.findIndex((h) =>
      ['totalquota', 'quota', 'total', 'entitlement', 'days', 'amount', 'balance', 'allocated'].includes(h)
    );
    const yearIdx = rawHeaders.findIndex((h) =>
      ['year', 'period', 'calendaryear', 'session'].includes(h)
    );

    if (codeIdx === -1 || quotaIdx === -1) {
      setCsvParseError('Could not find required columns (Leave Code and Quota/Days) in the header row.');
      return;
    }

    const affectedList: AffectedImportRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      const idVal = idIdx !== -1 ? cols[idIdx] : '';
      const nameVal = nameIdx !== -1 ? cols[nameIdx] : '';
      const codeVal = cols[codeIdx]?.toUpperCase() || '';
      const numVal = Number(cols[quotaIdx]);
      const recordYear = yearIdx !== -1 && cols[yearIdx] ? cols[yearIdx] : selectedYear;

      // Find matched user
      const matchedUser = users.find(
        (u) =>
          (idVal && u.id.toLowerCase() === idVal.toLowerCase()) ||
          (idVal && u.biometricId && u.biometricId.toLowerCase() === idVal.toLowerCase()) ||
          (nameVal && u.name.toLowerCase() === nameVal.toLowerCase()) ||
          (nameVal && u.email && u.email.toLowerCase() === nameVal.toLowerCase())
      );

      // Find matched policy
      const matchedPolicy = leavePolicies.find(
        (p) =>
          (p.code && p.code.toUpperCase() === codeVal) ||
          (p.type && p.type.toUpperCase() === codeVal) ||
          (codeVal === 'CL' && p.type === 'casual') ||
          (codeVal === 'EL' && p.type === 'earned') ||
          (codeVal === 'HPL' && p.type === 'half_pay') ||
          (codeVal === 'RH' && p.type === 'restricted') ||
          ((codeVal === 'C-OFF' || codeVal === 'COFF' || codeVal === 'COMP_OFF') && p.type === 'compensatory_off') ||
          (codeVal === 'COMM' && p.type === 'commuted') ||
          ((codeVal === 'MAT' || codeVal === 'ML') && p.type === 'maternity') ||
          ((codeVal === 'PAT' || codeVal === 'PL') && p.type === 'paternity') ||
          (codeVal === 'CCL' && p.type === 'child_care') ||
          ((codeVal === 'SCL' || codeVal === 'SPECIAL_CASUAL') && p.type === 'special_casual') ||
          ((codeVal === 'SL' || codeVal === 'SICK') && p.type === 'sick') ||
          ((codeVal === 'LND' || codeVal === 'LEAVE_NOT_DUE') && p.type === 'leave_not_due') ||
          ((codeVal === 'STL' || codeVal === 'STUDY') && p.type === 'study') ||
          ((codeVal === 'EOL' || codeVal === 'EXTRAORDINARY') && p.type === 'extraordinary') ||
          ((codeVal === 'SAB' || codeVal === 'SABBATICAL') && p.type === 'sabbatical')
      );

      let status: 'valid' | 'warning' | 'error' = 'valid';
      let message = 'Ready to apply';

      if (!matchedUser) {
        status = 'error';
        message = `Staff not found: "${idVal || nameVal || `Row ${i}`}"`;
      } else if (!matchedPolicy) {
        status = 'error';
        message = `Invalid leave code: "${codeVal}"`;
      } else if (isNaN(numVal) || numVal < 0) {
        status = 'error';
        message = `Quota must be a valid non-negative number`;
      }

      const userYearly = matchedUser?.yearlyLeaveBalances || {};
      const yearBal = (userYearly && userYearly[recordYear]) || matchedUser?.leaveBalances || {};
      const currentCell = matchedPolicy ? yearBal[matchedPolicy.type] : null;

      const currentTotal = currentCell?.total ?? (matchedPolicy?.defaultQuota || 0);
      const used = currentCell?.used ?? 0;
      const pending = currentCell?.pending ?? 0;
      const carryForward = currentCell?.carryForward ?? 0;

      let newTotal = numVal;
      if (csvImportStrategy === 'add') {
        newTotal = currentTotal + (isNaN(numVal) ? 0 : numVal);
      } else if (csvImportStrategy === 'less') {
        newTotal = Math.max(0, currentTotal - (isNaN(numVal) ? 0 : numVal));
      }

      const delta = newTotal - currentTotal;

      affectedList.push({
        id: `affected-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: matchedUser?.id || '',
        userName: matchedUser?.name || nameVal || 'Unknown Employee',
        biometricId: matchedUser?.biometricId || matchedUser?.id || idVal || '',
        employmentType: matchedUser?.employmentType || '',
        avatar: matchedUser?.avatar,
        leaveType: matchedPolicy?.type || codeVal.toLowerCase(),
        leaveTypeCode: matchedPolicy?.code || codeVal,
        leaveTypeName: matchedPolicy?.name || codeVal,
        year: recordYear,
        currentTotal,
        newTotal: isNaN(newTotal) ? 0 : newTotal,
        delta,
        used,
        pending,
        carryForward,
        status,
        message
      });
    }

    if (affectedList.length === 0) {
      setCsvParseError('No records could be identified from the uploaded content.');
      return;
    }

    setAffectedRecords(affectedList);
    setStep('verify');
  };

  const handleRemoveRecord = (id: string) => {
    setAffectedRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRecordQuota = (id: string, newTarget: number) => {
    setAffectedRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const val = Math.max(0, isNaN(newTarget) ? 0 : newTarget);
        return {
          ...r,
          newTotal: val,
          delta: val - r.currentTotal,
          status: 'valid',
          message: 'Manually adjusted'
        };
      })
    );
  };

  const handleCommitVerification = () => {
    const validRecords = affectedRecords.filter((r) => r.status === 'valid' || r.status === 'warning');

    if (validRecords.length === 0) {
      alert('There are no valid records to import. Please check errors or upload a valid file.');
      return;
    }

    const payload = validRecords.map((r) => ({
      userId: r.userId,
      year: r.year,
      leaveType: r.leaveType,
      total: r.newTotal,
      used: r.used,
      pending: r.pending,
      carryForward: r.carryForward
    }));

    setIsSubmitting(true);
    const res = batchUpdateLeaveBalances(payload);
    setIsSubmitting(false);

    if (res.success) {
      const msg = `Successfully imported leave quotas for ${validRecords.length} staff records in Session ${selectedYear}.`;
      onSuccess?.(msg);
      handleModalClose();
    } else {
      alert(res.message || 'Failed to update leave quotas.');
    }
  };

  const validCount = affectedRecords.filter((r) => r.status === 'valid').length;
  const errorCount = affectedRecords.filter((r) => r.status === 'error').length;

  return (
    <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto sm:my-6 flex flex-col max-h-[90vh]">
        
        {/* Standard Modal Header */}
        <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white rounded-t-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
              <Upload className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {step === 'upload' ? 'Import Leave Quotas' : 'Verify & Confirm Import'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload Form View */}
        {step === 'upload' ? (
          <div className="p-3.5 sm:p-4.5 space-y-3 text-xs overflow-y-auto flex-1 custom-table-scrollbar">
            
            {/* Section 1: Pre-Formatted CSV Templates */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Download Pre-Formatted Templates
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  className="py-2 px-2 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl text-center transition-all cursor-pointer shadow-2xs flex items-center justify-center space-x-1.5 text-slate-700 font-bold text-xs"
                >
                  <FileDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">Sample CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportRosterCSV('CY')}
                  className="py-2 px-2 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl text-center transition-all cursor-pointer shadow-2xs flex items-center justify-center space-x-1.5 text-blue-800 font-bold text-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">Regular (CY)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportRosterCSV('FY')}
                  className="py-2 px-2 bg-white border border-teal-200 hover:border-teal-400 hover:bg-teal-50/40 rounded-xl text-center transition-all cursor-pointer shadow-2xs flex items-center justify-center space-x-1.5 text-teal-800 font-bold text-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="truncate">Project (FY)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportRosterCSV('all')}
                  className="py-2 px-2 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-xl text-center transition-all cursor-pointer shadow-2xs flex items-center justify-center space-x-1.5 text-slate-900 font-bold text-xs"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">All Staff</span>
                </button>
              </div>
            </div>

            {/* Section 2: Import Strategy Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Choose Import Strategy
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCsvImportStrategy('set')}
                  className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer text-xs truncate ${
                    csvImportStrategy === 'set'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Set Quota</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCsvImportStrategy('add')}
                  className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer text-xs truncate ${
                    csvImportStrategy === 'add'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Add (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCsvImportStrategy('less')}
                  className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer text-xs truncate ${
                    csvImportStrategy === 'less'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Deduct (-)</span>
                </button>
              </div>
            </div>

            {/* Section 3: Data Upload */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Provide CSV Data
              </label>

              {/* File Dropzone */}
              <label className="block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 sm:p-5 text-center bg-slate-50/50 hover:bg-blue-50/20 transition-all relative cursor-pointer group">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleCSVUploadChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1.5 group-hover:scale-105 transition-transform shadow-2xs border border-blue-200/60">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="font-bold text-slate-800 text-xs sm:text-sm">
                  {csvFileName ? (
                    <span className="text-emerald-700 flex items-center justify-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{csvFileName} ({csvFileSize})</span>
                    </span>
                  ) : (
                    'Click to upload or drag & drop CSV file'
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Accepts standard CSV or Tab-delimited files (.csv, .tsv, .txt)
                </p>
                <div className="mt-1.5">
                  <span className="inline-block text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md px-2 py-0.5 shadow-2xs">
                    Required Headers: Biometric_ID, Leave_Code, Total_Quota
                  </span>
                </div>
              </label>

              {/* Error Message */}
              {csvParseError && (
                <div className="p-2.5 mt-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 flex items-center space-x-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{csvParseError}</span>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Step 2: Verification View */
          <div className="p-3.5 sm:p-4.5 space-y-3 text-xs overflow-y-auto flex-1 custom-table-scrollbar">
            
            {/* Status Summary Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800">
                  Rows Detected: {affectedRecords.length}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {validCount} Ready
                </span>
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                    {errorCount} Errors
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                <span>Active Strategy:</span>
                <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
                  {csvImportStrategy === 'set' ? 'Set Exact Quotas' : csvImportStrategy === 'add' ? 'Credit (+ Add)' : 'Debit (- Deduct)'}
                </span>
              </div>
            </div>

            {/* Review Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Staff &amp; Bio ID</th>
                    <th className="p-2.5">Cycle</th>
                    <th className="p-2.5">Leave Code</th>
                    <th className="p-2.5 text-center">Current</th>
                    <th className="p-2.5 text-center">New Quota</th>
                    <th className="p-2.5 text-center">Delta</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {affectedRecords.map((r) => {
                    const isCY = isCalendarYearCadre(r.employmentType);
                    const cycleMeta = getAccountingCycleMeta(r.employmentType, r.year || selectedYear);
                    return (
                      <tr key={r.id} className={r.status === 'error' ? 'bg-rose-50/50' : 'hover:bg-slate-50/70'}>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{r.userName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{r.biometricId}</div>
                          {r.status === 'error' && (
                            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">{r.message}</div>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                              isCY ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-teal-50 text-teal-700 border-teal-200'
                            }`}
                            title={cycleMeta.ruleSetText}
                          >
                            {cycleMeta.badgeLabel}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-700">{r.leaveTypeCode}</td>
                        <td className="p-2.5 text-center font-semibold text-slate-600">{r.currentTotal}</td>
                        <td className="p-2.5 text-center">
                          {r.status === 'error' ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={r.newTotal}
                              onChange={(e) => handleUpdateRecordQuota(r.id, Number(e.target.value))}
                              className="w-14 text-center font-bold px-1.5 py-0.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {r.status === 'error' ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span
                              className={`font-bold text-[11px] px-1.5 py-0.5 rounded ${
                                r.delta > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.delta < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r.delta > 0 ? `+${r.delta}` : r.delta}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRecord(r.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {step === 'upload' && csvRawText && (
              <button
                type="button"
                onClick={() => {
                  setCsvFileName('');
                  setCsvRawText('');
                  setCsvFileSize('');
                  setCsvParseError('');
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                Clear Data
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {step === 'upload' ? (
              <>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessCsvForVerification}
                  disabled={!csvRawText.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95 disabled:cursor-not-allowed"
                >
                  <span>Review &amp; Verify</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Edit</span>
                </button>
                <button
                  type="button"
                  onClick={handleCommitVerification}
                  disabled={isSubmitting || validCount === 0}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Applying...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Commit Updates</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
