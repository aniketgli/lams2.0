import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sliders,
  Copy,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { LeaveType, EmploymentType, LeavePolicyRule } from '../../../../types';

export interface EmployeeCategoryColumn {
  id: string;
  label: string;
  short: string;
  color: string;
  isDefault?: boolean;
}

export const FIXED_EMPLOYEE_CATEGORIES: EmployeeCategoryColumn[] = [
  { id: 'permanent', label: 'Permanent', short: 'Permanent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', isDefault: true },
  { id: 'contractual', label: 'Contractual', short: 'Contractual', color: 'bg-blue-50 text-blue-700 border-blue-200', isDefault: true },
  { id: 'researcher', label: 'Researcher', short: 'Researcher', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isDefault: true },
  { id: 'diploma_trainee', label: 'Trainees', short: 'Trainees', color: 'bg-amber-50 text-amber-700 border-amber-200', isDefault: true },
  { id: 'intern', label: 'Interns', short: 'Interns', color: 'bg-orange-50 text-orange-700 border-orange-200', isDefault: true },
  { id: 'bsc_msc_student', label: 'MSc', short: 'MSc', color: 'bg-purple-50 text-purple-700 border-purple-200', isDefault: true },
  { id: 'phd_student', label: 'PhD', short: 'PhD', color: 'bg-teal-50 text-teal-700 border-teal-200', isDefault: true }
];

export const LeavePolicyMaster: React.FC = () => {
  const {
    leavePolicies,
    updateLeavePolicy,
    addLeavePolicy,
    deleteLeavePolicy,
    toggleEmployeeTypeForLeave,
    resetLeavePoliciesToDefault
  } = useApp();

  // Fixed Employee Categories (Permanent, Contractual, Researcher, Trainees, Interns, MSc, PhD)
  const employeeCategories = FIXED_EMPLOYEE_CATEGORIES;

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicyRule | null>(null);
  const [policyModalTab, setPolicyModalTab] = useState<'general' | 'quota' | 'eligibility' | 'rules'>('general');

  // Leave Policy Form Data
  const [formData, setFormData] = useState<Partial<LeavePolicyRule>>({
    type: 'casual',
    name: '',
    code: '',
    defaultQuota: 8,
    accrualFrequency: 'yearly',
    maxAccumulation: 8,
    carryForward: false,
    maxCarryForwardDays: 0,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 3,
    minNoticeDays: 0,
    halfDayAllowed: true,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['permanent', 'contractual', 'researcher'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 10,
    description: '',
    ccsRuleNumber: '',
    isDebited: false,
    ccsCategory: 'Short Absence / Holiday'
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Create Leave Policy (Row)
  const handleOpenCreatePolicy = () => {
    setEditingPolicy(null);
    const randomKey = `policy_${Date.now()}` as any;
    setFormData({
      type: randomKey,
      name: '',
      code: '',
      defaultQuota: 10,
      accrualFrequency: 'yearly',
      maxAccumulation: 10,
      carryForward: false,
      maxCarryForwardDays: 0,
      encashmentAllowed: false,
      requiresLevel2ForDaysMoreThan: 3,
      minNoticeDays: 1,
      halfDayAllowed: true,
      medicalCertRequiredForDaysMoreThan: 0,
      sandwichRule: 'excluded',
      allowedEmploymentTypes: ['permanent', 'contractual'],
      genderEligibility: 'all',
      minServiceMonths: 0,
      maxConsecutiveDays: 15,
      description: '',
      ccsRuleNumber: 'Executive Orders',
      isDebited: true,
      ccsCategory: 'Debited Leave'
    });
    setPolicyModalTab('general');
    setIsPolicyModalOpen(true);
  };

  // Open Edit Leave Policy (Row)
  const handleOpenEditPolicy = (policy: LeavePolicyRule) => {
    setEditingPolicy(policy);
    setFormData({ ...policy });
    setPolicyModalTab('general');
    setIsPolicyModalOpen(true);
  };

  // Clone / Duplicate Policy
  const handleDuplicatePolicy = (policy: LeavePolicyRule) => {
    const clonedType = `${policy.type}_copy_${Date.now().toString().slice(-4)}` as LeaveType;
    const clonedPolicy: LeavePolicyRule = {
      ...policy,
      type: clonedType,
      name: `${policy.name} (Copy)`,
      code: policy.code ? `${policy.code}-C` : 'COPY'
    };
    const res = addLeavePolicy(clonedPolicy);
    if (res.success) {
      showToast(`Cloned policy '${clonedPolicy.name}' created.`, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Save Policy (Create/Edit Row)
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast('Please enter a valid Leave Name.', 'error');
      return;
    }
    if (!formData.allowedEmploymentTypes || formData.allowedEmploymentTypes.length === 0) {
      showToast('Please select at least one eligible employee category.', 'error');
      return;
    }

    if (editingPolicy) {
      const res = updateLeavePolicy(editingPolicy.type, formData);
      if (res.success) {
        showToast(res.message, 'success');
        setIsPolicyModalOpen(false);
      } else {
        showToast(res.message, 'error');
      }
    } else {
      const newPolicy = formData as LeavePolicyRule;
      const res = addLeavePolicy(newPolicy);
      if (res.success) {
        showToast(res.message, 'success');
        setIsPolicyModalOpen(false);
      } else {
        showToast(res.message, 'error');
      }
    }
  };

  // Delete Policy (Row)
  const handleDeletePolicy = (type: LeaveType, name: string) => {
    if (confirm(`Are you sure you want to delete the leave rule "${name}"?`)) {
      const res = deleteLeavePolicy(type);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    }
  };

  // Reset all to standard defaults
  const handleResetDefaults = () => {
    if (confirm('Reset all leave policies to standard defaults?')) {
      resetLeavePoliciesToDefault();
      showToast('Reset to statutory standard defaults successfully.', 'info');
    }
  };

  // Filtered Policies
  const filteredPolicies = leavePolicies.filter((p) => {
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.ccsRuleNumber && p.ccsRuleNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-sm transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {toastMessage.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Leave Policy Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-slate-900" />
              <span>Leave Policy</span>
            </h3>
            
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleOpenCreatePolicy}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Leave Policy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Leave Policy Master Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs w-full">
        {/* Table Top Controls & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-slate-900">Leave Policies &amp; Entitlements</h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                {filteredPolicies.length} Rules • 7 Categories
              </span>
            </div>
            
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search leave name, code (e.g. EL, CL)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Matrix Table - Uniform with other Master tables, zero vertical borders */}
        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[9%]" />
              {employeeCategories.map((cat) => (
                <col key={cat.id} style={{ width: `${56 / Math.max(employeeCategories.length, 1)}%` }} />
              ))}
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr className="h-11">
                {/* Leave Rule (Row Header) */}
                <th className="px-4 py-2.5 align-middle">
                  <span>Leave</span>
                </th>

                {/* Quota Column */}
                <th className="px-2 py-2.5 align-middle text-center whitespace-nowrap">
                  Quota / Yr
                </th>

                {/* Fixed Category Columns */}
                {employeeCategories.map((cat) => (
                  <th
                    key={cat.id}
                    className="px-1 py-2.5 align-middle text-center"
                    title={cat.label}
                  >
                    <span className="font-bold text-slate-800 tracking-wider truncate max-w-full text-[11px]">
                      {cat.short.toUpperCase()}
                    </span>
                  </th>
                ))}

                {/* Row Actions Header */}
                <th className="px-4 py-2.5 text-right align-middle whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPolicies.map((pol) => {
                const isCore = ['casual', 'earned', 'half_pay', 'restricted', 'station'].includes(pol.type);

                return (
                  <tr key={pol.type} className="hover:bg-slate-50/80 transition-colors group/row">
                    {/* Row Title Cell */}
                    <td className="px-4 py-3 align-middle overflow-hidden">
                      <div className="flex items-center space-x-2.5">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-900 text-white shrink-0 shadow-2xs">
                          {pol.code || pol.type.toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-bold text-slate-900 text-xs truncate block" title={pol.name}>
                            {pol.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium block truncate mt-0.5">
                            {pol.ccsRuleNumber || 'Institutional Rules'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Quota with quick inline edit */}
                    <td className="px-2 py-3 align-middle text-center">
                      <input
                        type="number"
                        min="0"
                        max="730"
                        value={pol.defaultQuota}
                        onChange={(e) => updateLeavePolicy(pol.type, { defaultQuota: Number(e.target.value) || 0 })}
                        className="w-12 text-center font-bold text-slate-800 bg-white border border-slate-200 rounded-lg py-1 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs"
                        title="Click to edit annual quota directly"
                      />
                    </td>

                    {/* Dynamic Category Cells (Click to toggle) */}
                    {employeeCategories.map((cat) => {
                      const isAllotted = pol.allowedEmploymentTypes.includes(cat.id as EmploymentType);
                      return (
                        <td key={cat.id} className="px-1 py-3 align-middle text-center">
                          <button
                            onClick={() => toggleEmployeeTypeForLeave(pol.type, cat.id as EmploymentType)}
                            className={`w-6.5 h-6.5 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                              isAllotted
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95'
                                : 'bg-slate-100/90 hover:bg-slate-200 text-slate-300 hover:text-slate-500'
                            }`}
                            title={`${isAllotted ? 'Revoke entitlement from' : 'Grant entitlement to'} ${cat.label}`}
                          >
                            {isAllotted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5 stroke-[2]" />}
                          </button>
                        </td>
                      );
                    })}

                    {/* Row Action Buttons */}
                    <td className="px-4 py-3 align-middle text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleDuplicatePolicy(pol)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Duplicate Policy Row"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditPolicy(pol)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200/80 rounded-lg transition-colors cursor-pointer"
                          title="Edit Policy Parameters"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!isCore && (
                          <button
                            onClick={() => handleDeletePolicy(pol.type, pol.name)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200/80 rounded-lg transition-colors cursor-pointer"
                            title="Delete Policy Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 2: COMPREHENSIVE ADD / EDIT LEAVE POLICY (ROW) */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm font-bold">
                  <Sliders className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    {editingPolicy ? `Configure: ${editingPolicy.name}` : 'Add New Leave Policy (Row)'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsPolicyModalOpen(false)}
                className="relative z-10 text-blue-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50/70 px-5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setPolicyModalTab('general')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  policyModalTab === 'general'
                    ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Basic Info &amp; Rule #
              </button>
              <button
                onClick={() => setPolicyModalTab('quota')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  policyModalTab === 'quota'
                    ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Quota &amp; Accrual
              </button>
              <button
                onClick={() => setPolicyModalTab('eligibility')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  policyModalTab === 'eligibility'
                    ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. Eligible Categories
              </button>
              <button
                onClick={() => setPolicyModalTab('rules')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  policyModalTab === 'rules'
                    ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                4. Workflow &amp; Approvals
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePolicy} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* TAB 1: BASIC INFO */}
              {policyModalTab === 'general' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Leave Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Earned Leave (EL)"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Short Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. EL, CL, HPL"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold uppercase font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Statutory / Rule Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. Rule 26, Executive Orders"
                        value={formData.ccsRuleNumber || ''}
                        onChange={(e) => setFormData({ ...formData, ccsRuleNumber: e.target.value })}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Leave Nature</label>
                      <select
                        value={formData.ccsCategory || 'Debited Leave'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ccsCategory: e.target.value as any,
                            isDebited: e.target.value === 'Debited Leave'
                          })
                        }
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all cursor-pointer"
                      >
                        <option value="Debited Leave">Debited Leave (Deducts from Quota)</option>
                        <option value="Special Leave (Non-Debited)">Special Leave (Non-Debited Scheme)</option>
                        <option value="Short Absence / Holiday">Short Absence / Holiday Permission</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Description &amp; Guidelines</label>
                    <textarea
                      rows={3}
                      placeholder="Enter policy terms, eligibility conditions, and guidelines..."
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: QUOTA & ACCRUAL */}
              {policyModalTab === 'quota' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">
                        Annual Quota (Days / Year) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="730"
                        value={formData.defaultQuota ?? 8}
                        onChange={(e) => setFormData({ ...formData, defaultQuota: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold"
                      />
                      <p className="text-[10px] text-slate-400">Total days allotted per calendar or financial year.</p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">Accrual / Credit Frequency</label>
                      <select
                        value={formData.accrualFrequency || 'yearly'}
                        onChange={(e) => setFormData({ ...formData, accrualFrequency: e.target.value as any })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <option value="yearly">Yearly (Allotted on Jan 1st)</option>
                        <option value="half_yearly">Half-Yearly (Jan 1st &amp; July 1st)</option>
                        <option value="monthly">Monthly Pro-rata (Monthly Credit)</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="upfront">Upfront Entire Lifetime Grant</option>
                      </select>
                      <p className="text-[10px] text-slate-400">How quota is incrementally credited to employee balance.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">Max Accumulation Limit</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.maxAccumulation ?? 300}
                        onChange={(e) => setFormData({ ...formData, maxAccumulation: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold"
                      />
                      <p className="text-[10px] text-slate-400">e.g. 300 days for EL, 0 for unlimited.</p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">Carry Forward to Next Year</label>
                      <div className="flex items-center space-x-3 pt-1">
                        <label className="flex items-center space-x-1.5 cursor-pointer font-semibold">
                          <input
                            type="radio"
                            name="carryForward"
                            checked={formData.carryForward === true}
                            onChange={() => setFormData({ ...formData, carryForward: true })}
                            className="text-indigo-600"
                          />
                          <span>Allowed</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer font-semibold">
                          <input
                            type="radio"
                            name="carryForward"
                            checked={formData.carryForward === false}
                            onChange={() => setFormData({ ...formData, carryForward: false })}
                            className="text-indigo-600"
                          />
                          <span>Lapses on Dec 31</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ELIGIBILITY & CATEGORIES */}
              {policyModalTab === 'eligibility' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">
                      Allotted Employee Categories <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-slate-500 mb-3 text-[11px]">
                      Select which categories are entitled to apply for this leave:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {employeeCategories.map((cat) => {
                        const isChecked = formData.allowedEmploymentTypes?.includes(cat.id as EmploymentType) || false;
                        return (
                          <label
                            key={cat.id}
                            className={`p-2.5 border rounded-xl flex items-center space-x-2.5 cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-indigo-50/60 border-indigo-300 text-indigo-900'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const current = formData.allowedEmploymentTypes || [];
                                const updated = e.target.checked
                                  ? [...current, cat.id as EmploymentType]
                                  : current.filter((t) => t !== cat.id);
                                setFormData({ ...formData, allowedEmploymentTypes: updated });
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="font-bold">{cat.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Gender Eligibility</label>
                      <select
                        value={formData.genderEligibility || 'all'}
                        onChange={(e) => setFormData({ ...formData, genderEligibility: e.target.value as any })}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all cursor-pointer"
                      >
                        <option value="all">All Employees (Male, Female &amp; Other)</option>
                        <option value="female_only">Female Employees Only (e.g. Maternity, CCL)</option>
                        <option value="male_only">Male Employees Only (e.g. Paternity)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Minimum Service Requirement</label>
                      <select
                        value={formData.minServiceMonths ?? 0}
                        onChange={(e) => setFormData({ ...formData, minServiceMonths: Number(e.target.value) })}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all cursor-pointer"
                      >
                        <option value="0">Immediate upon joining (0 Months)</option>
                        <option value="6">After 6 Months Probation</option>
                        <option value="12">After 1 Year of Regular Service</option>
                        <option value="60">After 5 Years of Continuous Service</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RULES & APPROVAL WORKFLOW */}
              {policyModalTab === 'rules' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">
                        Level-2 Escalation Threshold
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.requiresLevel2ForDaysMoreThan ?? 3}
                        onChange={(e) =>
                          setFormData({ ...formData, requiresLevel2ForDaysMoreThan: Number(e.target.value) })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold"
                      />
                      <p className="text-[10px] text-slate-400">
                        Applications exceeding this duration automatically forward to Reviewing Manager (Level 2).
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">Minimum Prior Notice (Days)</label>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={formData.minNoticeDays ?? 0}
                        onChange={(e) => setFormData({ ...formData, minNoticeDays: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold"
                      />
                      <p className="text-[10px] text-slate-400">
                        0 = Emergency / Same Day, 7 days for EL, 30 days for Maternity.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">Half-Day Leave Allowed?</label>
                      <select
                        value={formData.halfDayAllowed ? 'yes' : 'no'}
                        onChange={(e) => setFormData({ ...formData, halfDayAllowed: e.target.value === 'yes' })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <option value="yes">Yes (Allow 1st or 2nd Half Day)</option>
                        <option value="no">No (Full Days Only)</option>
                      </select>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">Medical Certificate Upload Mandate</label>
                      <select
                        value={formData.medicalCertRequiredForDaysMoreThan ?? 0}
                        onChange={(e) =>
                          setFormData({ ...formData, medicalCertRequiredForDaysMoreThan: Number(e.target.value) })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <option value="0">Not Mandatory</option>
                        <option value="1">Mandatory for any duration (&gt; 0 days)</option>
                        <option value="2">Mandatory if exceeding 2 days</option>
                        <option value="3">Mandatory if exceeding 3 days</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="block font-bold text-slate-800">Sandwich Rule (Intervening Holidays / Sundays)</label>
                    <select
                      value={formData.sandwichRule || 'excluded'}
                      onChange={(e) => setFormData({ ...formData, sandwichRule: e.target.value as any })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value="excluded">Excluded (Sundays &amp; Holidays not debited from leave balance)</option>
                      <option value="included">Included / Sandwiched (Intervening holidays debited as leave)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Modal Actions Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>

                <div className="flex items-center space-x-2">
                  {policyModalTab !== 'rules' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (policyModalTab === 'general') setPolicyModalTab('quota');
                        else if (policyModalTab === 'quota') setPolicyModalTab('eligibility');
                        else if (policyModalTab === 'eligibility') setPolicyModalTab('rules');
                      }}
                      className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="submit"
                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingPolicy ? 'Save Policy Changes' : 'Create Leave Policy'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
