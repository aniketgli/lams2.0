import React, { useState } from 'react';
import {
  Upload,
  X,
  FileDown,
  ClipboardPaste,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Check,
  Layers,
  Info,
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
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [csvImportStrategy, setCsvImportStrategy] = useState<'set' | 'add' | 'less'>('set');

  // CSV File / Paste States
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvFileSize, setCsvFileSize] = useState<string>('');
  const [csvParseError, setCsvParseError] = useState<string>('');
  const [affectedRecords, setAffectedRecords] = useState<AffectedImportRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setInputMode('file');
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
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Application Theme Dark Header */}
        <div className="shrink-0 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-b border-slate-800 px-5 py-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="font-bold text-base text-white tracking-tight">
                  {step === 'upload' ? 'Import Leave' : 'Verify & Confirm Import'}
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border bg-blue-500/20 text-blue-300 border-blue-400/30">
                  Session {selectedYear}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {step === 'upload'
                  ? 'Bulk update staff leave balances via CSV file or copy-paste'
                  : 'Review staged leave quota adjustments before committing updates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload Form View (Themed & Clean without scrollbar clutter) */}
        {step === 'upload' ? (
          <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            
            {/* Section 1: Pre-Formatted CSV Templates */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">
                    1
                  </div>
                  <span className="font-bold text-slate-800 text-xs">
                    Download Pre-Formatted Templates
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                  Optional starter files
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  className="p-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 rounded-xl text-left transition-all cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-xs group-hover:text-blue-600">
                    <FileDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
                    <span className="truncate">Sample CSV</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Blank schema template</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportRosterCSV('CY')}
                  className="p-2.5 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl text-left transition-all cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-1.5 text-blue-800 font-bold text-xs">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Regular (CY)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Permanent staff (Jan-Dec)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportRosterCSV('FY')}
                  className="p-2.5 bg-white border border-teal-200 hover:border-teal-400 hover:bg-teal-50/40 rounded-xl text-left transition-all cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-1.5 text-teal-800 font-bold text-xs">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">Project (FY)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Project staff (Apr-Mar)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportRosterCSV('all')}
                  className="p-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-xl text-left transition-all cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center space-x-1.5 text-slate-900 font-bold text-xs">
                    <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">All Staff</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Complete employee list</p>
                </button>
              </div>
            </div>

            {/* Section 2: Import Strategy Selector */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">
                  2
                </div>
                <label className="font-bold text-slate-800 text-xs">
                  Choose Import Strategy
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCsvImportStrategy('set')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    csvImportStrategy === 'set'
                      ? 'border-blue-600 bg-blue-50/70 shadow-2xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                      <RefreshCw className={`w-3.5 h-3.5 ${csvImportStrategy === 'set' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>Set Quota</span>
                    </div>
                    {csvImportStrategy === 'set' && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Overwrite total with CSV values directly
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCsvImportStrategy('add')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    csvImportStrategy === 'add'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-2xs ring-1 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                      <Plus className={`w-3.5 h-3.5 ${csvImportStrategy === 'add' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>Add (+)</span>
                    </div>
                    {csvImportStrategy === 'add' && (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Add CSV values to current balances (Credit)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCsvImportStrategy('less')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    csvImportStrategy === 'less'
                      ? 'border-rose-600 bg-rose-50/70 shadow-2xs ring-1 ring-rose-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                      <Minus className={`w-3.5 h-3.5 ${csvImportStrategy === 'less' ? 'text-rose-600' : 'text-slate-400'}`} />
                      <span>Deduct (-)</span>
                    </div>
                    {csvImportStrategy === 'less' && (
                      <Check className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Subtract CSV values from quota (Debit)
                  </p>
                </button>
              </div>
            </div>

            {/* Section 3: Data Upload / Paste Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">
                    3
                  </div>
                  <label className="font-bold text-slate-800 text-xs">
                    Provide CSV Data
                  </label>
                </div>

                {/* Sub-mode switcher */}
                <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInputMode('file')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                      inputMode === 'file'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                      inputMode === 'paste'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>Paste Text</span>
                  </button>
                </div>
              </div>

              {inputMode === 'file' ? (
                /* File Dropzone */
                <label className="block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 sm:p-5 text-center bg-slate-50/50 hover:bg-blue-50/20 transition-all relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleCSVUploadChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform shadow-2xs border border-blue-200/60">
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
                  <div className="mt-2">
                    <span className="inline-block text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md px-2.5 py-0.5 shadow-2xs">
                      Required Headers: Biometric_ID, Leave_Code, Total_Quota
                    </span>
                  </div>
                </label>
              ) : (
                /* Paste Text Area */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Paste comma or tab-separated text:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = `Biometric_ID,Employee_Name,Leave_Code,Total_Quota\n1001,Aniket Verma,CL,12\n1002,Priya Sharma,EL,30\n1003,Rahul Mehta,HPL,20`;
                        setCsvRawText(sample);
                      }}
                      className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      + Insert Sample Data
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    placeholder={`Biometric_ID,Leave_Code,Total_Quota\n1001,CL,12\n1002,EL,30`}
                    value={csvRawText}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    className="w-full p-2.5 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                  />
                </div>
              )}

              {/* Error Message */}
              {csvParseError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 flex items-center space-x-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{csvParseError}</span>
                </div>
              )}
            </div>

            {/* Informational Guidance Box */}
            <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-2.5 flex items-start space-x-2 text-[11px] text-slate-700">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Accounting Cycle Guidelines: </span>
                Regular staff follow Calendar Year (Jan - Dec), while Project staff follow Financial Year (Apr - Mar).
                Supported leave codes: <strong className="text-blue-900">CL, EL, HPL, RH, C-OFF, COMM, ML, PL, CCL</strong>.
              </div>
            </div>

          </div>
        ) : (
          /* Step 2: Verification View (Table without Department & with No Scrollbar Clutter) */
          <div className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            
            {/* Status Summary Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
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

            {/* Review Table (Department column omitted as per user instruction) */}
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
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

          <div className="flex items-center space-x-2.5">
            {step === 'upload' ? (
              <>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessCsvForVerification}
                  disabled={!csvRawText.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-2 cursor-pointer active:scale-95 disabled:cursor-not-allowed"
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl flex items-center space-x-1.5 cursor-pointer transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Edit</span>
                </button>
                <button
                  type="button"
                  onClick={handleCommitVerification}
                  disabled={isSubmitting || validCount === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer active:scale-95 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Applying...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Commit Quota Updates</span>
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
