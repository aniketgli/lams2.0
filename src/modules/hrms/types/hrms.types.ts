import { EmploymentType } from '../../../shared/types/auth.types';

export type LeaveType = 
  | 'casual'           // Casual Leave (CL)
  | 'earned'           // Earned Leave (EL - Rule 26)
  | 'half_pay'         // Half Pay Leave (HPL - Rule 29)
  | 'station'          // Station Leave / Station Permission (STN)
  | 'commuted'         // Commuted Leave (Rule 30)
  | 'leave_not_due'    // Leave Not Due (LND - Rule 31)
  | 'extra_ordinary'   // Extra Ordinary Leave (EOL - Rule 32)
  | 'sick'             // Sick Leave (SL)
  | 'restricted'       // Restricted Holiday (RH)
  | 'maternity'        // Maternity Leave (Rule 43)
  | 'paternity'        // Paternity Leave (Rule 43-A)
  | 'child_care'       // Child Care Leave (CCL - Rule 43-C)
  | 'study'            // Study Leave (Rule 50)
  | 'special_casual'   // Special Casual Leave
  | 'compensatory_off' // Compensatory Off (C-Off)
  | 'field_work'       // Field Work Leave (FWL)
  | 'academic'         // Academic Leave (AL)
  | 'contingency'      // Contingency Off
  | 'stipend_off';     // Stipend Off

export type WorkMode = 'in_office' | 'wfh' | 'field_od' | 'on_leave' | 'absent';

export type AttendanceStatus =
  | 'PP'   // Present
  | 'AA'   // Absent
  | 'PA'   // 1st half Present 2nd half Absent
  | 'AP'   // 1st half Absent 2nd half Present
  | 'WW'   // Weekend
  | 'WW#'  // Working on Weekend
  | 'HH'   // Holiday
  | 'HH#'  // Working on Holiday
  | 'GH'   // Gazetted Holiday (Green)
  | 'RH'   // Restricted Holiday
  | 'LW'   // Leave / LWP (Red)
  | 'ST'   // Station Leave
  | 'OD'   // Out Door
  | 'present' | 'late' | 'half_day' | 'absent' | 'od' | 'leave' | 'weekend' | 'holiday';

export interface UserTransferLog {
  id: string;
  userId: string;
  userName: string;
  previousDept: string;
  newDept: string;
  previousManagerName: string;
  newManagerName: string;
  effectiveDate: string;
  notes: string;
  transferredBy: string;
  timestamp: string;
}

export interface UserProjectHistory {
  id: string;
  userId: string;
  userName?: string;
  projectName: string;
  projectCode?: string;
  piName: string; // Principal Investigator
  piEmail?: string;
  roleInProject: string; // e.g. "Senior Project Associate", "Junior Research Fellow", "Project Scientist II"
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD or empty for Ongoing
  isOngoing: boolean;
  department: string;
  fundingAgency?: string; // e.g. "MoEFCC", "DST-SERB", "CAMPA", "National Biodiversity Authority"
  grantAmount?: string;
  responsibilities?: string;
  remarks?: string;
  addedBy?: string;
  addedAt?: string;
}

export interface LeavePolicyRule {
  type: LeaveType;
  name: string;
  code?: string; // e.g. "EL", "CL", "HPL", "CCL", "RH", "STN", "SL", "FWL"
  defaultQuota: number; // Days per year
  accrualFrequency?: 'yearly' | 'half_yearly' | 'monthly' | 'quarterly' | 'upfront';
  maxAccumulation?: number; // e.g. 300, 360, 0
  carryForward?: boolean;
  maxCarryForwardDays?: number;
  encashmentAllowed?: boolean;
  requiresLevel2ForDaysMoreThan: number; // e.g. > 3 days requires Level 2
  minNoticeDays?: number; // e.g. 0, 7, 30 days
  halfDayAllowed?: boolean; // e.g. true for CL, false for EL
  medicalCertRequiredForDaysMoreThan?: number; // e.g. > 2 days
  sandwichRule?: 'included' | 'excluded'; // included: holidays count as leave; excluded: only working days count
  allowedEmploymentTypes: EmploymentType[];
  genderEligibility?: 'all' | 'female_only' | 'male_only';
  minServiceMonths?: number; // Minimum service required in months (0 = immediate, 60 = 5 yrs)
  maxConsecutiveDays?: number; // Absolute max per application
  description: string;
  ccsRuleNumber?: string;
  isDebited?: boolean;
  ccsCategory?: 'Debited Leave' | 'Special Leave (Non-Debited)' | 'Short Absence / Holiday';
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  clockIn?: string; // e.g. "09:15 AM"
  clockOut?: string; // e.g. "05:30 PM"
  shiftCode?: string; // e.g. "GEN-01 (09:30 - 17:30)"
  workMode: WorkMode;
  status: AttendanceStatus;
  totalHours?: number;
  location?: string;
  notes?: string;
  remark?: string;
}

export interface OutdoorDutyRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  department: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  daysCount: number;
  odType: 'Domestic' | 'International';
  location: string;
  estimatedFunds: number;
  fundingSource: string;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedDate: string;
  reportingManagerId: string;
  approverComments?: string;
  actionBy?: string;
  actionAt?: string;
}

export interface ManualAttendanceRegularizationRequest {
  id: string;
  userId: string;
  userName: string;
  userDesignation?: string;
  userDepartment: string;
  date: string; // Forgotten attendance date (strictly <= yesterday)
  requestedInTime: string;
  requestedOutTime: string;
  originalInTime?: string;
  originalOutTime?: string;
  reasonCategory?: string; // 'Forgot to Punch' | 'Biometric Issue' | 'Not Registered Yet' | 'Registration Day' | 'Urgent OD' | 'Other'
  reason: string;
  reportingManagerId: string;
  reportingManagerName: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  actionDate?: string;
  actionBy?: string;
  managerComment?: string;
}

export interface LeaveApprovalStep {
  approverId: string;
  approverName: string;
  status: 'approved' | 'rejected' | 'pending';
  comments?: string;
  actionAt?: string;
}

export interface JoiningReport {
  id: string;
  leaveId: string;
  userId: string;
  userName: string;
  designation?: string;
  department?: string;
  joiningDate: string; // YYYY-MM-DD
  joiningSession: 'FN' | 'AN'; // Forenoon or Afternoon
  joiningStatus: 'on_time' | 'early' | 'delayed';
  stationReturned: boolean;
  remarks?: string;
  fitnessCertificateAttached?: boolean;
  fitnessCertificateName?: string;
  fitnessCertificateUrl?: string;
  submittedAt: string;
  status: 'submitted' | 'forwarded' | 'accepted' | 'rejected';
  forwardedBy?: string;
  forwardedByName?: string;
  forwardedAt?: string;
  forwardRemarks?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  verificationRemarks?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  employmentType: EmploymentType;
  department: string;
  leaveType: LeaveType;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'pending_level_1' | 'pending_level_2' | 'approved' | 'rejected' | 'cancelled';
  requiresLevel2: boolean;
  reportingManagerId: string;
  reviewingManagerId?: string;
  level1Approval?: LeaveApprovalStep;
  level2Approval?: LeaveApprovalStep;
  appliedDate: string;
  ltcType?: 'none' | 'ltc' | 'ex_india';
  stationAddress?: string;
  encashLtc?: boolean;
  encashDays?: number;
  isCommuted?: boolean;
  prescriptionUrl?: string;
  prescriptionFileName?: string;
  joiningReport?: JoiningReport;
  prefixFrom?: string;
  prefixTo?: string;
  suffixFrom?: string;
  suffixTo?: string;
}

// --- SHIFT & TIMING DESIGN TYPES ---
export interface Shift {
  id: string;
  code: string; // e.g. "GEN-01", "MS-01", "ES-01", "FLD-01", "NS-01"
  name: string; // e.g. "General Administrative Shift"
  startTime: string; // "09:30" (24-hour format)
  endTime: string; // "17:30" (24-hour format)
  gracePeriodMins: number; // e.g. 15 (minutes after startTime considered on-time)
  halfDayHours: number; // e.g. 4.0 (minimum hours to qualify as Half Day)
  fullDayHours: number; // e.g. 8.0 (minimum hours to qualify as Full Day)
  minHalfDayHours?: number; // alias for halfDayHours
  minFullDayHours?: number; // alias for fullDayHours
  halfDayCutoffTime?: string; // e.g. "13:30" (punches after this marked as half day/late)
  isDefault?: boolean;
  isActive?: boolean;
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'indigo' | 'rose' | 'slate';
  description?: string;
  applicableDays?: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  activeStaffCount?: number;
}

export interface ShiftTimingCalculation {
  shift: Shift;
  isLate: boolean;
  lateMinutes: number;
  isEarlyDeparture: boolean;
  earlyMinutes: number;
  totalHours: number;
  calculatedStatus: AttendanceStatus;
  statusLabel: string;
  onTime: boolean;
}

// Convert time string (either 12-hour "09:15 AM" or 24-hour "09:15") to minutes from 00:00
export const parseTimeToMinutes = (timeStr?: string): number | null => {
  if (!timeStr || timeStr.trim() === '' || timeStr === '-' || timeStr === '--:--') {
    return null;
  }
  const clean = timeStr.trim();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const mins = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
  }

  const match24 = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    return hours * 60 + mins;
  }

  return null;
};

// Format 24-hour "09:30" to 12-hour "09:30 AM"
export const formatTime24to12 = (time24?: string): string => {
  if (!time24) return '--:--';
  const match = time24.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time24;
  let hours = parseInt(match[1], 10);
  const mins = match[2];
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${mins} ${meridiem}`;
};

// Calculate attendance and punctuality according to assigned shift
export const evaluateAttendanceByShift = (
  clockIn?: string,
  clockOut?: string,
  shift?: Shift | null,
  workMode?: WorkMode
): ShiftTimingCalculation => {
  const defaultShift: Shift = {
    id: 'shift-default',
    code: 'GEN-01',
    name: 'General Administrative Shift',
    startTime: '09:30',
    endTime: '17:30',
    gracePeriodMins: 15,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    isDefault: true,
    color: 'blue'
  };

  const activeShift = shift || defaultShift;
  const inMins = parseTimeToMinutes(clockIn);
  const outMins = parseTimeToMinutes(clockOut);
  const shiftStartMins = parseTimeToMinutes(activeShift.startTime) ?? 9 * 60 + 30;
  let shiftEndMins = parseTimeToMinutes(activeShift.endTime) ?? 17 * 60 + 30;

  const isOvernight = shiftEndMins < shiftStartMins;
  if (isOvernight) {
    shiftEndMins += 24 * 60;
  }

  if (inMins === null) {
    return {
      shift: activeShift,
      isLate: false,
      lateMinutes: 0,
      isEarlyDeparture: false,
      earlyMinutes: 0,
      totalHours: 0,
      calculatedStatus: workMode === 'field_od' ? 'OD' : workMode === 'on_leave' ? 'LW' : 'AA',
      statusLabel: workMode === 'field_od' ? 'Outdoor Duty' : workMode === 'on_leave' ? 'On Leave' : 'Absent',
      onTime: false
    };
  }

  const graceCutoff = shiftStartMins + (activeShift.gracePeriodMins || 0);
  const lateMinutes = inMins > shiftStartMins ? inMins - shiftStartMins : 0;
  const isLate = inMins > graceCutoff;
  const onTime = !isLate;

  let effectiveOutMins = outMins;
  if (effectiveOutMins !== null && isOvernight && effectiveOutMins < inMins) {
    effectiveOutMins += 24 * 60;
  }

  let totalHours = 0;
  let isEarlyDeparture = false;
  let earlyMinutes = 0;

  if (effectiveOutMins !== null) {
    const diffMinutes = Math.max(0, effectiveOutMins - inMins);
    totalHours = Math.round((diffMinutes / 60) * 10) / 10;
    if (effectiveOutMins < shiftEndMins) {
      isEarlyDeparture = true;
      earlyMinutes = shiftEndMins - effectiveOutMins;
    }
  }

  let calculatedStatus: AttendanceStatus = 'PP';
  let statusLabel = 'Present';

  if (workMode === 'field_od') {
    calculatedStatus = 'OD';
    statusLabel = 'Outdoor Duty';
  } else if (workMode === 'on_leave') {
    calculatedStatus = 'LW';
    statusLabel = 'On Leave';
  } else if (effectiveOutMins === null) {
    calculatedStatus = isLate ? 'PA' : 'PP';
    statusLabel = isLate ? 'Late Arrival (In Progress)' : 'Present (In Progress)';
  } else {
    if (totalHours >= activeShift.fullDayHours) {
      calculatedStatus = isLate ? 'PP' : 'PP';
      statusLabel = isLate ? `Present (Late ${lateMinutes}m)` : 'Full Day Present';
    } else if (totalHours >= activeShift.halfDayHours) {
      calculatedStatus = 'PA';
      statusLabel = `Half Day (${totalHours} hrs)`;
    } else {
      calculatedStatus = 'AA';
      statusLabel = `Absent (Short Hours: ${totalHours} hrs)`;
    }
  }

  return {
    shift: activeShift,
    isLate,
    lateMinutes,
    isEarlyDeparture,
    earlyMinutes,
    totalHours,
    calculatedStatus,
    statusLabel,
    onTime
  };
};
