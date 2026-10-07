import React, { useState, useEffect } from 'react';
import {
  X,
  FileCheck,
  Clock,
  Calendar,
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
import { AppDatePicker } from '../../../../shared/components/AppDatePicker';
import { INITIAL_HOLIDAYS } from '../../holidays/data/holidayData';

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

  // Helper to find the next official working day (skipping weekends & Gazetted Holidays)
  const getNextWorkingDay = (afterDateStr?: string): string => {
    if (!afterDateStr) {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }
    const parts = afterDateStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return afterDateStr;
    }
    const curr = new Date(parts[0], parts[1] - 1, parts[2] + 1);

    for (let i = 0; i < 30; i++) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isGH = INITIAL_HOLIDAYS.some((h) => h.date === dateStr && h.type === 'gazetted');

      if (!isWeekend && !isGH) {
        return dateStr;
      }
      curr.setDate(curr.getDate() + 1);
    }
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Safe auto-calculation: strictly parse YYYY-MM-DD components
  // Duty resumes on the next official working day after suffixTo or endDate
  const computeAutoJoiningDate = (leave?: LeaveRequest | null) => {
    if (!leave) {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }
    const effectiveEndStr = leave.suffixTo || leave.endDate;
    return getNextWorkingDay(effectiveEndStr);
  };

  const [joiningDate, setJoiningDate] = useState<string>(() => {
    if (existingReport?.joiningDate) return existingReport.joiningDate;
    return computeAutoJoiningDate(currentLeave);
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
        const autoDate = computeAutoJoiningDate(currentLeave);
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
    currentLeave?.suffixTo,
    currentLeave?.prefixFrom,
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto sm:my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-4 sm:px-5 py-3 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md shrink-0">
              <Calendar className="w-4.5 h-4.5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-wide">
                Joining Form
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form id="joining-report-form" onSubmit={handleSubmit} className="p-3.5 sm:p-4.5 space-y-2.5 sm:space-y-3 overflow-y-auto flex-1 custom-table-scrollbar">
          {feedback && (
            <div
              className={`p-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
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

          {/* 1st Section: Sanctioned Leave Details * Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Sanctioned Leave Details *
              </label>
              <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Duration: {currentLeave.daysCount} {currentLeave.daysCount === 1 ? 'Day' : 'Days'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
              {/* Employee Information */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 text-xs gap-2">
                <div className="flex items-center space-x-2 min-w-0 pr-1">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                    <User className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <div className="truncate min-w-0">
                    <span className="font-bold text-slate-900 text-xs">{currentLeave.userName}</span>
                    <span className="text-slate-500 ml-1 text-[11px] hidden xs:inline">({currentLeave.department})</span>
                  </div>
                </div>

                <div className="shrink-0">
                  {existingReport ? (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                        existingReport.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : existingReport.status === 'forwarded'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : existingReport.status === 'rejected'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      {existingReport.status === 'accepted'
                        ? '✓ HoD Approved'
                        : existingReport.status === 'forwarded'
                        ? 'Forwarded to HoD'
                        : existingReport.status === 'rejected'
                        ? 'Returned'
                        : 'Submitted'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Leave Type and Sanctioned Dates */}
              <div className="flex items-center justify-between text-xs pt-0.5 gap-2">
                <span className="truncate text-slate-800 font-bold text-xs">
                  {currentLeave.leaveTypeName}
                </span>
                <span className="text-slate-700 font-semibold text-[11px] shrink-0 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs whitespace-nowrap">
                  {currentLeave.startDate} to {currentLeave.endDate}
                </span>
              </div>

              {/* Suffix and Prefix Details if availed */}
              {(currentLeave.prefixFrom || currentLeave.suffixTo) && (
                <div className="pt-1.5 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                  {currentLeave.prefixFrom && (
                    <div className="flex items-center justify-between bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      <span className="text-slate-500 font-medium">Prefix (Holidays):</span>
                      <span className="font-bold text-indigo-700 font-mono text-[10.5px]">
                        {currentLeave.prefixFrom === currentLeave.prefixTo
                          ? currentLeave.prefixFrom
                          : `${currentLeave.prefixFrom} to ${currentLeave.prefixTo}`}
                      </span>
                    </div>
                  )}
                  {currentLeave.suffixTo && (
                    <div className="flex items-center justify-between bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      <span className="text-slate-500 font-medium">Suffix (Holidays):</span>
                      <span className="font-bold text-indigo-700 font-mono text-[10.5px]">
                        {currentLeave.suffixFrom === currentLeave.suffixTo
                          ? currentLeave.suffixTo
                          : `${currentLeave.suffixFrom} to ${currentLeave.suffixTo}`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2nd Row: Side-by-Side Cards for Joining Date & Session */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 text-xs">
            {/* Joining Date Card with AppDatePicker */}
            <div>
              <AppDatePicker
                label="Joining Date *"
                value={joiningDate}
                minDate={currentLeave ? computeAutoJoiningDate(currentLeave) : undefined}
                onChange={(dStr) => {
                  if (canEditEmployeeFields) setJoiningDate(dStr);
                }}
              />
              {currentLeave?.suffixTo && (
                <p className="text-[10px] text-indigo-700 mt-0.5 font-semibold flex items-center gap-1">
                  <span>ℹ️ Joining after suffix ({computeAutoJoiningDate(currentLeave)})</span>
                </p>
              )}
            </div>

            {/* Joining Session Card */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Joining Session *</span>
                <span className="text-[10px] text-slate-500 font-normal">Duty Shift</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canEditEmployeeFields}
                  onClick={() => setJoiningSession('FN')}
                  className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs truncate ${
                    joiningSession === 'FN'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  } ${!canEditEmployeeFields ? 'opacity-80 pointer-events-none' : ''}`}
                >
                  Morning
                </button>

                <button
                  type="button"
                  disabled={!canEditEmployeeFields}
                  onClick={() => setJoiningSession('AN')}
                  className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs truncate ${
                    joiningSession === 'AN'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  } ${!canEditEmployeeFields ? 'opacity-80 pointer-events-none' : ''}`}
                >
                  Afternoon
                </button>
              </div>
            </div>
          </div>

          {/* 3rd Row: Status * */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Status *
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                disabled={!canEditEmployeeFields}
                onClick={() => setStationReturned(true)}
                className={`py-1.5 px-2 sm:px-2.5 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs truncate ${
                  stationReturned
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                } ${!canEditEmployeeFields ? 'opacity-80 pointer-events-none' : ''}`}
              >
                Returned to HQ
              </button>

              <button
                type="button"
                disabled={!canEditEmployeeFields}
                onClick={() => setStationReturned(false)}
                className={`py-1.5 px-2 sm:px-2.5 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer text-xs truncate ${
                  !stationReturned
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                } ${!canEditEmployeeFields ? 'opacity-80 pointer-events-none' : ''}`}
              >
                Outstation
              </button>
            </div>
          </div>

          {/* Medical Fitness Certificate if Commuted/Half Pay/Medical */}
          {(currentLeave.isCommuted || currentLeave.leaveType === 'commuted' || currentLeave.leaveType === 'half_pay' || fitnessAttached) && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800">
                  Medical Fitness Certificate (चिकित्सा स्वस्थता प्रमाण-पत्र)
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-blue-800">
                  <input
                    type="checkbox"
                    checked={fitnessAttached}
                    onChange={(e) => setFitnessAttached(e.target.checked)}
                    disabled={!canEditEmployeeFields}
                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
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
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    disabled={!canEditEmployeeFields}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center space-x-1 hover:bg-blue-700 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4th Row: Employee Joining Remarks / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Employee Joining Remarks / Resumption Notes
            </label>
            <textarea
              rows={2}
              placeholder="State remarks or notes for joining duty after leave..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={!canEditEmployeeFields}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none disabled:opacity-75"
            />
          </div>

          {/* 5th Row: Action / Recommendation Section */}
          {/* A. If Reporting Manager reviewing submitted report */}
          {isAlreadySubmitted && !isForwarded && !isVerified && isReportingManager && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-blue-950 text-xs tracking-tight flex items-center space-x-1.5">
                  <ArrowRight className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Reporting Manager (L1) Recommendation &amp; Forwarding</span>
                </label>
                <span className="text-[10px] font-bold text-blue-800 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded">
                  Action: Forward
                </span>
              </div>
              <textarea
                rows={2}
                value={forwardRemarks}
                onChange={(e) => setForwardRemarks(e.target.value)}
                placeholder="Enter recommendation remarks (e.g. Resumed duty on time in Forenoon. Recommended and forwarded to HoD for sanction.)..."
                className="w-full px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {/* B. If HoD reviewing forwarded report */}
          {isAlreadySubmitted && isForwarded && !isVerified && isHod && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-purple-950 text-xs tracking-tight flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>HoD / Reviewing Authority (L2) Final Sanction &amp; Approval</span>
                </label>
                <span className="text-[10px] font-bold text-purple-800 bg-purple-100/80 border border-purple-200 px-2 py-0.5 rounded">
                  Action: HoD Sanction
                </span>
              </div>
              <textarea
                rows={2}
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                placeholder="Enter HoD sanction/verification comments before accepting..."
                className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          )}

          {/* C. If already forwarded */}
          {existingReport?.forwardedBy && (
            <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-purple-900">
                <ArrowRight className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Forwarded to HoD by Reporting Manager: {existingReport.forwardedByName || reportingManagerName}</span>
              </div>
              {existingReport.forwardedAt && (
                <p className="text-purple-700 text-[11px] pl-5 font-medium">
                  Forwarded On: {existingReport.forwardedAt}
                </p>
              )}
              {existingReport.forwardRemarks && (
                <p className="text-purple-800 text-[11px] italic pl-5 border-t border-purple-200/60 pt-1">
                  Reporting Officer Note: "{existingReport.forwardRemarks}"
                </p>
              )}
            </div>
          )}

          {/* D. If Approved / Verified */}
          {isVerified && existingReport && (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span>Joining Report Approved &amp; Verified by: {existingReport.verifiedByName || reviewingManagerName}</span>
              </div>
              {existingReport.verifiedAt && (
                <p className="text-emerald-700 text-[11px] pl-5 font-medium">
                  Verified On: {existingReport.verifiedAt}
                </p>
              )}
              {existingReport.verificationRemarks && (
                <p className="text-emerald-800 text-[11px] italic pl-5 border-t border-emerald-200/60 pt-1">
                  HoD Remarks: "{existingReport.verificationRemarks}"
                </p>
              )}
            </div>
          )}

          {/* E. If Returned / Rejected */}
          {isRejected && existingReport && (
            <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-rose-900">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                <span>Joining Report Returned / Disapproved</span>
              </div>
              {existingReport.verificationRemarks && (
                <p className="text-rose-800 text-[11px] pl-5 font-medium">
                  Reason / Remarks: "{existingReport.verificationRemarks}"
                </p>
              )}
            </div>
          )}
        </form>

        {/* Form Action Buttons Footer - Cleanly docked outside scrollable container */}
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Close
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {isVerified ? (
              /* Stage 3 Completed: Simple Print Slip */
              <button
                type="button"
                onClick={handlePrintSlip}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 active:scale-98 text-white transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>
            ) : isForwarded ? (
              /* Stage 2 Completed, Awaiting HoD */
              isHod ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleVerify('rejected')}
                    disabled={isSubmitting}
                    className="px-3.5 sm:px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerify('accepted')}
                    disabled={isSubmitting}
                    className="px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-500 italic px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 font-medium truncate max-w-[170px] sm:max-w-none">
                  Awaiting HoD ({reviewingManagerName})
                </span>
              )
            ) : isAlreadySubmitted ? (
              /* Stage 1 Completed, Awaiting Reporting Manager */
              isReportingManager ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleVerify('rejected')}
                    disabled={isSubmitting}
                    className="px-3.5 sm:px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    Return
                  </button>
                  <button
                    type="button"
                    onClick={handleForward}
                    disabled={isSubmitting}
                    className="px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Forward to HoD</span>
                  </button>
                </>
              ) : isApplicant ? (
                <button
                  type="submit"
                  form="joining-report-form"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-98 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  Submit
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 italic px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 font-medium truncate max-w-[170px] sm:max-w-none">
                  Awaiting RM ({reportingManagerName})
                </span>
              )
            ) : (
              /* Stage 0: Simple Submit button */
              isApplicant ? (
                <button
                  type="submit"
                  form="joining-report-form"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-98 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  Submit
                </button>
              ) : (
                <span className="text-[11px] text-amber-800 font-semibold px-2.5 py-1.5 bg-amber-50 rounded-xl border border-amber-200 truncate">
                  Applicant must submit first
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
