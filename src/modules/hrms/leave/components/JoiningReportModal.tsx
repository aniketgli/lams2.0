import React, { useState, useEffect } from 'react';
import {
  X,
  FileCheck,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Upload,
  Send,
  Printer,
  User,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { LeaveRequest } from '../../types/hrms.types';
import { useApp } from '../../../../context/AppContext';

interface JoiningReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  leave?: LeaveRequest | null;
  onSuccess?: () => void;
}

export const JoiningReportModal: React.FC<JoiningReportModalProps> = ({
  isOpen,
  onClose,
  leave: propLeave,
  onSuccess
}) => {
  const {
    currentUser,
    users,
    leaveRequests,
    submitJoiningReport,
    forwardJoiningReport,
    verifyJoiningReport
  } = useApp();

  // Pick current leave passed via props (or fallback to matching leave in leaveRequests state)
  const currentLeave =
    (propLeave ? leaveRequests.find((l) => l.id === propLeave.id) || propLeave : null) ||
    leaveRequests.find((l) => l.status === 'approved');

  // Check if this leave requires HoD approval
  const requiresHod = Boolean(
    currentLeave?.requiresLevel2 ||
      currentLeave?.level2Approval ||
      currentLeave?.reviewingManagerId
  );

  // Determine role access
  const isApplicant = currentLeave ? currentUser.id === currentLeave.userId : false;
  
  const isReportingManager = currentLeave
    ? currentUser.id === currentLeave.reportingManagerId ||
      currentUser.role === 'admin' ||
      currentUser.role === 'super_admin'
    : false;

  const isHod = currentLeave
    ? currentUser.id === currentLeave.reviewingManagerId ||
      currentUser.role === 'admin' ||
      currentUser.role === 'administrator' ||
      currentUser.role === 'super_admin' ||
      currentUser.role === 'director' ||
      currentUser.role === 'registrar' ||
      (currentUser.roles && currentUser.roles.includes('reviewing_manager'))
    : false;

  const reportingManagerUser = currentLeave
    ? users.find((u) => u.id === currentLeave.reportingManagerId)
    : null;
  const reviewingManagerUser = currentLeave
    ? users.find((u) => u.id === currentLeave.reviewingManagerId)
    : null;

  const reportingManagerName =
    currentLeave?.level1Approval?.approverName ||
    reportingManagerUser?.name ||
    'Reporting Officer';

  const reviewingManagerName =
    currentLeave?.level2Approval?.approverName ||
    reviewingManagerUser?.name ||
    'Head of Department (HoD)';

  const existingReport = currentLeave?.joiningReport;
  const isAlreadySubmitted = Boolean(existingReport);
  const isForwarded = existingReport?.status === 'forwarded';
  const isVerified = existingReport?.status === 'accepted';
  const isRejected = existingReport?.status === 'rejected';

  // Helper for leave type code badge (e.g. EL, CL, HPL, RH)
  const getLeaveTypeCode = (type?: string): string => {
    switch (type) {
      case 'casual': return 'CL';
      case 'earned': return 'EL';
      case 'half_pay': return 'HPL';
      case 'commuted': return 'COMM';
      case 'restricted': return 'RH';
      case 'compensatory_off': return 'C-OFF';
      case 'station': return 'STN';
      case 'maternity': return 'ML';
      case 'paternity': return 'PL';
      case 'child_care': return 'CCL';
      case 'extraordinary': return 'EOL';
      case 'study': return 'SL';
      case 'special_casual': return 'SCL';
      case 'leave_not_due': return 'LND';
      case 'hospital': return 'HL';
      default: return (type || 'LV').toUpperCase().slice(0, 4);
    }
  };

  // Safe auto-calculation: strictly parse YYYY-MM-DD components to prevent timezone shift bugs
  const computeAutoJoiningDate = (endDateStr?: string) => {
    if (!endDateStr) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const parts = endDateStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return endDateStr;
  };

  const [joiningDate, setJoiningDate] = useState<string>(() => {
    if (existingReport?.joiningDate) return existingReport.joiningDate;
    return computeAutoJoiningDate(currentLeave?.endDate);
  });

  const [joiningSession, setJoiningSession] = useState<'FN' | 'AN'>(
    existingReport?.joiningSession || 'FN'
  );
  const [stationReturned, setStationReturned] = useState<boolean>(
    existingReport ? existingReport.stationReturned : true
  );
  const [remarks, setRemarks] = useState<string>(existingReport?.remarks || '');
  const [fitnessAttached, setFitnessAttached] = useState<boolean>(
    existingReport
      ? Boolean(existingReport.fitnessCertificateAttached)
      : currentLeave
      ? Boolean(currentLeave.isCommuted || currentLeave.leaveType === 'commuted')
      : false
  );
  const [fitnessFileName, setFitnessFileName] = useState<string>(
    existingReport?.fitnessCertificateName ||
      (currentLeave?.prescriptionFileName
        ? `Fitness_${currentLeave.prescriptionFileName}`
        : 'Medical_Fitness_Certificate.pdf')
  );

  const [forwardRemarks, setForwardRemarks] = useState<string>(
    existingReport?.forwardRemarks || ''
  );
  const [verificationRemarks, setVerificationRemarks] = useState<string>(
    existingReport?.verificationRemarks || ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Sync state whenever the target leave or its joining report state changes
  useEffect(() => {
    if (currentLeave) {
      const rep = currentLeave.joiningReport;
      if (rep) {
        setJoiningDate(rep.joiningDate);
        setJoiningSession(rep.joiningSession);
        setStationReturned(rep.stationReturned);
        setRemarks(rep.remarks || '');
        setFitnessAttached(Boolean(rep.fitnessCertificateAttached));
        setFitnessFileName(rep.fitnessCertificateName || 'Medical_Fitness_Certificate.pdf');
        setForwardRemarks(rep.forwardRemarks || '');
        setVerificationRemarks(rep.verificationRemarks || '');
      } else {
        const autoDate = computeAutoJoiningDate(currentLeave.endDate);
        setJoiningDate(autoDate);
        setJoiningSession('FN');
        setStationReturned(true);
        setRemarks('');
        setFitnessAttached(Boolean(currentLeave.isCommuted || currentLeave.leaveType === 'commuted'));
        setFitnessFileName(
          currentLeave.prescriptionFileName
            ? `Fitness_${currentLeave.prescriptionFileName}`
            : 'Medical_Fitness_Certificate.pdf'
        );
        setForwardRemarks('');
        setVerificationRemarks('');
      }
      setFeedback(null);
    }
  }, [
    currentLeave?.id,
    currentLeave?.endDate,
    currentLeave?.joiningReport?.status,
    currentLeave?.joiningReport?.joiningDate,
    currentLeave?.joiningReport?.forwardedAt,
    currentLeave?.joiningReport?.verifiedAt
  ]);

  if (!isOpen) return null;

  if (!currentLeave) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl text-center space-y-4 border border-slate-200">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Approved Leave Found</h3>
          <p className="text-xs text-slate-600">
            A Post-Leave Joining Report can only be submitted for approved leaves. Please select an approved leave.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Check if leave requires HoD approval
  if (!requiresHod) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl text-center space-y-4 border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Joining Report Not Required</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Joining Report (कार्यग्रहण आख्या) केवल <strong>HoD approval</strong> वाली छुट्टियों के लिए आवश्यक होता है। यह अवकाश एकल-स्तरीय (Direct Single-Level) अनुमोदन के अंतर्गत स्वीकृत हुआ था, इसलिए इसमें कार्यग्रहण प्रपत्र आवश्यक नहीं है।
          </p>
          <div className="p-3 bg-slate-50 rounded-xl text-left text-[11px] text-slate-600 border border-slate-200">
            <p><strong>Leave Type:</strong> {currentLeave.leaveTypeName}</p>
            <p><strong>Sanctioned:</strong> {currentLeave.startDate} to {currentLeave.endDate} ({currentLeave.daysCount} days)</p>
            <p><strong>Approval Level:</strong> Direct Reporting Officer Approval</p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // 1. Employee Submit Handler
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isApplicant && !existingReport) {
      setFeedback({
        type: 'error',
        message: 'केवल आवेदक कर्मचारी ही कार्यग्रहण प्रपत्र सबमिट कर सकते हैं।'
      });
      return;
    }
    if (!joiningDate) {
      setFeedback({ type: 'error', message: 'Please select a valid joining date.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = submitJoiningReport(currentLeave.id, {
        joiningDate,
        joiningSession,
        stationReturned,
        remarks,
        fitnessCertificateAttached: fitnessAttached,
        fitnessCertificateName: fitnessAttached ? fitnessFileName : undefined
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to submit report' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Reporting Manager Forward Handler
  const handleForward = () => {
    if (!isReportingManager) {
      setFeedback({
        type: 'error',
        message: 'केवल रिपोर्टिंग मैनेजर ही कार्यग्रहण आख्या को HoD के लिए अग्रेषित कर सकते हैं।'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = forwardJoiningReport(currentLeave.id, forwardRemarks);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to forward report' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. HoD Verify & Approve Handler
  const handleVerify = (status: 'accepted' | 'rejected') => {
    if (!isHod) {
      setFeedback({
        type: 'error',
        message: 'केवल विभागाध्यक्ष (HoD / Reviewing Officer) ही कार्यग्रहण आख्या स्वीकृत कर सकते हैं।'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = verifyJoiningReport(currentLeave.id, status, verificationRemarks);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to verify report' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  // Current report inputs can only be edited if user is applicant and report is not yet verified
  const canEditEmployeeFields = isApplicant && !isVerified && (!isForwarded || isRejected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shadow-xs shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white tracking-tight">
                  Post-Leave Joining Report (कार्यग्रहण आख्या)
                </h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Report
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                3-Step Institutional Workflow: Employee Apply → Reporting Manager Forward → HoD Approve
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Visual Progress Stepper */}
        <div className="bg-slate-100/90 border-b border-slate-200/80 px-4 py-2.5 shrink-0">
          <div className="flex items-center justify-between text-xs">
            {/* Step 1: User Apply */}
            <div className="flex items-center space-x-1.5 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isAlreadySubmitted
                    ? 'bg-emerald-600 text-white'
                    : isApplicant
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {isAlreadySubmitted ? '✓' : '1'}
              </div>
              <div className="truncate">
                <span className="font-bold text-slate-800 block text-[11px]">1. Apply (User)</span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {isAlreadySubmitted ? 'Submitted' : 'Employee'}
                </span>
              </div>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mx-1" />

            {/* Step 2: Reporting Manager Forward */}
            <div className="flex items-center space-x-1.5 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isForwarded || isVerified
                    ? 'bg-emerald-600 text-white'
                    : isAlreadySubmitted
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 animate-pulse'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {isForwarded || isVerified ? '✓' : '2'}
              </div>
              <div className="truncate">
                <span className="font-bold text-slate-800 block text-[11px]">2. Forward</span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {isForwarded || isVerified
                    ? 'Forwarded'
                    : isAlreadySubmitted
                    ? 'Awaiting RM'
                    : 'Rep. Manager'}
                </span>
              </div>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mx-1" />

            {/* Step 3: HoD Approve */}
            <div className="flex items-center space-x-1.5 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isVerified
                    ? 'bg-emerald-600 text-white'
                    : isForwarded
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 animate-pulse'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {isVerified ? '✓' : '3'}
              </div>
              <div className="truncate">
                <span className="font-bold text-slate-800 block text-[11px]">3. Approve (HoD)</span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {isVerified ? 'Verified' : isForwarded ? 'Awaiting HoD' : 'HoD Sanction'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Form Body matching Pic 2 layout & spacing */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Role Status Guidance Banner */}
          {!existingReport ? (
            isApplicant ? (
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Step 1: Fill and submit your Joining Report</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Upon resumption of duty after sanctioned leave, confirm your date, session, and station. After you submit, it will be forwarded to your Reporting Manager ({reportingManagerName}) for recommendation to HoD.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Awaiting Employee Submission (कर्मचारी द्वारा सबमिट की प्रतीक्षा)</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    नियमानुसार कार्यग्रहण प्रपत्र केवल आवेदक कर्मचारी (<strong>{currentLeave.userName}</strong>) द्वारा ही सबमिट किया जा सकता है। कर्मचारी के सबमिट करने के बाद रिपोर्टिंग मैनेजर इसे HoD को अग्रेषित करेंगे।
                  </p>
                </div>
              </div>
            )
          ) : isForwarded ? (
            isHod ? (
              <div className="bg-purple-50/90 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Action Required: HoD Final Sanction &amp; Verification</p>
                  <p className="text-[11px] text-purple-800 mt-0.5">
                    This joining report has been forwarded by Reporting Manager ({existingReport.forwardedByName || reportingManagerName}). Please verify and approve duty resumption under CCS rules.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Forwarded to HoD (विभागाध्यक्ष को अग्रेषित)</p>
                  <p className="text-[11px] text-purple-800 mt-0.5">
                    Reporting Manager ({existingReport.forwardedByName || reportingManagerName}) has forwarded the joining report to HoD ({reviewingManagerName}) for final approval.
                  </p>
                </div>
              </div>
            )
          ) : !isVerified && !isRejected ? (
            isReportingManager ? (
              <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start space-x-2">
                <ArrowRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Action Required: Recommend &amp; Forward to HoD</p>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Employee {currentLeave.userName} has submitted duty resumption. As Reporting Officer, review and forward this report to HoD ({reviewingManagerName}).
                  </p>
                </div>
              </div>
            ) : isApplicant ? (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Submitted - Under Review by Reporting Manager</p>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Your joining report is currently with your Reporting Manager ({reportingManagerName}) to be forwarded to HoD.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Awaiting Reporting Manager Forwarding</p>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Report has been submitted by employee and awaits forwarding from Reporting Manager ({reportingManagerName}).
                  </p>
                </div>
              </div>
            )
          ) : null}

          {/* Section 1: Sanctioned Leave & Employee Details matching Pic 2 Top Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-bold text-slate-700 text-xs">
                Sanctioned Leave Details *
              </label>
              <span className="text-[11px] text-indigo-700 font-extrabold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200/80">
                Duration: {currentLeave.daysCount} {currentLeave.daysCount === 1 ? 'Day' : 'Days'}
              </span>
            </div>

            <div className="w-full bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
              {/* Employee Information */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-slate-900">{currentLeave.userName}</span>
                    <span className="text-slate-500 ml-1.5 text-[11px]">({currentLeave.department})</span>
                  </div>
                </div>

                <div className="shrink-0">
                  {existingReport ? (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        existingReport.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : existingReport.status === 'forwarded'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : existingReport.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {existingReport.status === 'accepted'
                        ? '✓ HoD Approved'
                        : existingReport.status === 'forwarded'
                        ? '➡️ Forwarded to HoD'
                        : existingReport.status === 'rejected'
                        ? 'Returned'
                        : '⏳ Submitted'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      Report Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Leave Type and Sanctioned Dates */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <span className="truncate text-slate-800 font-bold">
                    {currentLeave.leaveTypeName}
                  </span>
                </div>
                <div className="text-slate-600 font-medium text-[11px] shrink-0 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {currentLeave.startDate} to {currentLeave.endDate}
                </div>
              </div>

              {/* Reporting & HoD Mapping Info */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Reporting Manager (L1)</span>
                  <span className="font-semibold text-slate-800 truncate block">{reportingManagerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Reviewing Officer (HoD)</span>
                  <span className="font-semibold text-slate-800 truncate block">{reviewingManagerName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Side-by-Side Cards for Date & Session matching Pic 2 (From Date & To Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Resumption Date Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs">
                  Resumption (Joining Date) *
                </label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60">
                  Auto-picked
                </span>
              </div>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                disabled={!canEditEmployeeFields}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs transition-all disabled:opacity-75 disabled:bg-slate-100"
              />
              <p className="text-[10px] text-slate-500 font-medium">
                Expected: Next working day after leave ({currentLeave.endDate})
              </p>
            </div>

            {/* Joining Session Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs">
                  Joining Session *
                </label>
                <span className="text-[10px] text-slate-500 font-medium">Duty Shift</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center justify-center space-x-1.5 py-2 px-2 rounded-xl border cursor-pointer transition-all text-center ${
                    joiningSession === 'FN'
                      ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 font-medium'
                  } ${!canEditEmployeeFields ? 'pointer-events-none opacity-80' : ''}`}
                >
                  <input
                    type="radio"
                    name="joiningSessionOpt"
                    value="FN"
                    checked={joiningSession === 'FN'}
                    onChange={() => setJoiningSession('FN')}
                    disabled={!canEditEmployeeFields}
                    className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] whitespace-nowrap">FN (पूर्वाह्न)</span>
                </label>

                <label
                  className={`flex items-center justify-center space-x-1.5 py-2 px-2 rounded-xl border cursor-pointer transition-all text-center ${
                    joiningSession === 'AN'
                      ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 font-medium'
                  } ${!canEditEmployeeFields ? 'pointer-events-none opacity-80' : ''}`}
                >
                  <input
                    type="radio"
                    name="joiningSessionOpt"
                    value="AN"
                    checked={joiningSession === 'AN'}
                    onChange={() => setJoiningSession('AN')}
                    disabled={!canEditEmployeeFields}
                    className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] whitespace-nowrap">AN (अपराह्न)</span>
                </label>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                FN: Forenoon (Morning) | AN: Afternoon
              </p>
            </div>
          </div>

          {/* Section 3: Headquarter (HQ) Duty Station Status matching Pic 2 Section 3 */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2">
            <label className="block font-bold text-slate-800 text-xs flex items-center justify-between">
              <span>Headquarter (HQ) / Duty Station Status *</span>
              <span className="text-[10px] text-indigo-600 font-semibold">
                Default Station: Dehradun HQ
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-center ${
                  stationReturned
                    ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 font-medium'
                } ${!canEditEmployeeFields ? 'pointer-events-none opacity-80' : ''}`}
              >
                <input
                  type="radio"
                  name="stationReturnedOpt"
                  checked={stationReturned}
                  onChange={() => setStationReturned(true)}
                  disabled={!canEditEmployeeFields}
                  className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] whitespace-nowrap">Returned to HQ (Dehradun)</span>
              </label>

              <label
                className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-center ${
                  !stationReturned
                    ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 font-medium'
                } ${!canEditEmployeeFields ? 'pointer-events-none opacity-80' : ''}`}
              >
                <input
                  type="radio"
                  name="stationReturnedOpt"
                  checked={!stationReturned}
                  onChange={() => setStationReturned(false)}
                  disabled={!canEditEmployeeFields}
                  className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] whitespace-nowrap">Outstation / Relieved</span>
              </label>
            </div>
          </div>

          {/* Medical Fitness Certificate if Commuted/Half Pay/Medical */}
          {(currentLeave.isCommuted || currentLeave.leaveType === 'commuted' || currentLeave.leaveType === 'half_pay' || fitnessAttached) && (
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-800 text-xs">
                  Medical Fitness Certificate (चिकित्सा स्वस्थता प्रमाण-पत्र)
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-indigo-800">
                  <input
                    type="checkbox"
                    checked={fitnessAttached}
                    onChange={(e) => setFitnessAttached(e.target.checked)}
                    disabled={!canEditEmployeeFields}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Attached</span>
                </label>
              </div>
              {fitnessAttached && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    value={fitnessFileName}
                    onChange={(e) => setFitnessFileName(e.target.value)}
                    disabled={!canEditEmployeeFields}
                    placeholder="Fitness_Certificate_Filename.pdf"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    disabled={!canEditEmployeeFields}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Section 4: Employee Joining Remarks / Notes */}
          <div>
            <label className="block font-bold text-slate-800 text-xs mb-1.5 tracking-tight">
              Employee Joining Remarks / Resumption Notes
            </label>
            <textarea
              rows={2}
              placeholder="State remarks or notes for joining duty after leave..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={!canEditEmployeeFields}
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 shadow-2xs transition-all placeholder:text-slate-400 resize-y min-h-[60px] disabled:opacity-75 disabled:bg-slate-100"
            />
          </div>

          {/* Section 5: Forwarding Section (Reporting Manager) */}
          {/* If already forwarded, show card */}
          {existingReport?.forwardedBy && (
            <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3.5 text-xs space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-purple-900">
                <ArrowRight className="w-4 h-4 text-purple-600" />
                <span>Forwarded to HoD by Reporting Manager: {existingReport.forwardedByName || reportingManagerName}</span>
              </div>
              {existingReport.forwardedAt && (
                <p className="text-purple-700 text-[11px] pl-6">
                  Forwarded On: {existingReport.forwardedAt}
                </p>
              )}
              {existingReport.forwardRemarks && (
                <p className="text-purple-800 text-[11px] italic pl-6 border-t border-purple-200/60 pt-1">
                  Reporting Officer Note: "{existingReport.forwardRemarks}"
                </p>
              )}
            </div>
          )}

          {/* If currently in 'submitted' state and user is Reporting Manager, show Forwarding inputs */}
          {isAlreadySubmitted && !isForwarded && !isVerified && isReportingManager && (
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-blue-950 text-xs tracking-tight flex items-center space-x-1.5">
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                  <span>Reporting Manager (L1) Recommendation &amp; Forwarding</span>
                </label>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                  Action: Forward to HoD
                </span>
              </div>
              <textarea
                rows={2}
                value={forwardRemarks}
                onChange={(e) => setForwardRemarks(e.target.value)}
                placeholder="Enter recommendation remarks (e.g. Resumed duty on time in Forenoon. Recommended and forwarded to HoD for sanction.)..."
                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500 shadow-2xs transition-all placeholder:text-slate-400 resize-y"
              />
            </div>
          )}

          {/* Section 6: HoD Approval Card (If verified) */}
          {isVerified && existingReport && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Joining Report Approved &amp; Verified by: {existingReport.verifiedByName || reviewingManagerName}</span>
              </div>
              {existingReport.verifiedAt && (
                <p className="text-emerald-700 text-[11px] pl-6">
                  Verified On: {existingReport.verifiedAt}
                </p>
              )}
              {existingReport.verificationRemarks && (
                <p className="text-emerald-800 text-[11px] italic pl-6 border-t border-emerald-200/60 pt-1">
                  HoD Remarks: "{existingReport.verificationRemarks}"
                </p>
              )}
            </div>
          )}

          {/* If currently in 'forwarded' state and user is HoD, show HoD Approval inputs */}
          {isAlreadySubmitted && isForwarded && !isVerified && isHod && (
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-purple-950 text-xs tracking-tight flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>HoD / Reviewing Authority (L2) Final Sanction &amp; Approval</span>
                </label>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                  Action: HoD Approval
                </span>
              </div>
              <textarea
                rows={2}
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                placeholder="Enter HoD sanction/verification comments before accepting..."
                className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-500 shadow-2xs transition-all placeholder:text-slate-400 resize-y"
              />
            </div>
          )}

          {/* Section 7: If Rejected / Returned */}
          {isRejected && existingReport && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Joining Report Returned / Disapproved</span>
              </div>
              {existingReport.verificationRemarks && (
                <p className="text-rose-800 text-[11px] pl-6">
                  Reason / Remarks: "{existingReport.verificationRemarks}"
                </p>
              )}
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="shrink-0 bg-white/95 backdrop-blur-md pt-3.5 pb-1 mt-3 border-t border-slate-200/80 flex items-center justify-between sticky bottom-0 z-20">
            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer border border-slate-200/80 bg-white"
            >
              Close
            </button>

            <div className="flex items-center space-x-2">
              {isVerified ? (
                /* Stage 3 Completed: Print Slip */
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 active:scale-98 text-white transition-all shadow-md flex items-center space-x-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Joining Slip (प्रिंट स्लिप)</span>
                </button>
              ) : isForwarded ? (
                /* Stage 2 Completed, Awaiting Stage 3: HoD Actions */
                isHod ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVerify('rejected')}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      Return / Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify('accepted')}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>HoD Approve &amp; Verify (स्वीकार एवं अनुमोदित करें)</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 italic px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-medium">
                    Awaiting HoD Approval ({reviewingManagerName})
                  </span>
                )
              ) : isAlreadySubmitted ? (
                /* Stage 1 Completed, Awaiting Stage 2: Reporting Manager Actions */
                isReportingManager ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVerify('rejected')}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      Return to Employee
                    </button>
                    <button
                      type="button"
                      onClick={handleForward}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Forward to HoD (HoD को अग्रेषित करें)</span>
                    </button>
                  </>
                ) : isApplicant ? (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white transition-all shadow-md flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Update Submitted Report</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-medium">
                    Awaiting Reporting Manager Forwarding ({reportingManagerName})
                  </span>
                )
              ) : (
                /* Stage 0: Initial submission - ONLY applicant can submit */
                isApplicant ? (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Joining Report (कार्यग्रहण आख्या सबमिट करें)</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-amber-700 font-medium px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
                      Applicant ({currentLeave.userName}) must submit first
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
