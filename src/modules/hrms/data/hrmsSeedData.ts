import { 
  Shift, 
  LeavePolicyRule, 
  OutdoorDutyRequest, 
  LeaveRequest, 
  ManualAttendanceRegularizationRequest, 
  AttendanceRecord 
} from "../types/hrms.types";
import { INITIAL_USERS } from "../../../shared/data/coreUsersSeedData";

export const INITIAL_SHIFTS: Shift[] = [
  {
    id: 'shift-gen',
    code: 'GEN-01',
    name: 'General Administrative Shift',
    startTime: '09:30',
    endTime: '17:30',
    gracePeriodMins: 15,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    halfDayCutoffTime: '13:30',
    isDefault: true,
    color: 'blue',
    description: 'Standard institutional work hours for administrative officers, general staff, and faculty.',
    applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  },
  {
    id: 'shift-ms',
    code: 'MS-01',
    name: 'Morning Research & Lab Shift',
    startTime: '07:00',
    endTime: '15:30',
    gracePeriodMins: 15,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    halfDayCutoffTime: '11:00',
    isDefault: false,
    color: 'emerald',
    description: 'Early morning biological laboratory procedures, animal enclosure rounds, and greenhouse sampling.',
    applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  },
  {
    id: 'shift-es',
    code: 'ES-01',
    name: 'Evening Lab & IT Support Shift',
    startTime: '14:00',
    endTime: '22:00',
    gracePeriodMins: 15,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    halfDayCutoffTime: '18:00',
    isDefault: false,
    color: 'amber',
    description: 'Evening research laboratory procedures, server room monitoring, and campus facilities operations.',
    applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  },
  {
    id: 'shift-fld',
    code: 'FLD-01',
    name: 'Field Wildlife Tracking Shift',
    startTime: '08:00',
    endTime: '18:00',
    gracePeriodMins: 30,
    halfDayHours: 4.5,
    fullDayHours: 8.0,
    halfDayCutoffTime: '13:00',
    isDefault: false,
    color: 'purple',
    description: 'Flexible timing for wildlife field tracking, camera trap deployment, and remote ecological surveys.',
    applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  },
  {
    id: 'shift-ns',
    code: 'NS-01',
    name: 'Night Patrolling & Census Shift',
    startTime: '22:00',
    endTime: '06:00',
    gracePeriodMins: 15,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    halfDayCutoffTime: '02:00',
    isDefault: false,
    color: 'indigo',
    description: 'Nocturnal wildlife census, radiotelemetry tracking, and nighttime campus security surveillance.',
    applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  }
];

export const INITIAL_LEAVE_POLICIES: LeavePolicyRule[] = [
  // Permanent Staff Policies (CCS Leave Rules 1972)
  {
    type: 'earned',
    name: 'Earned Leave (EL)',
    code: 'EL',
    defaultQuota: 30,
    accrualFrequency: 'half_yearly',
    maxAccumulation: 300,
    carryForward: true,
    maxCarryForwardDays: 300,
    encashmentAllowed: true,
    requiresLevel2ForDaysMoreThan: 2,
    minNoticeDays: 7,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 180,
    description: 'Credited @ 15 days on 1st Jan & 1st July each year. Max accumulation 300+15 days. (CCS Rule 26)',
    ccsRuleNumber: 'Rule 26',
    isDebited: true,
    ccsCategory: 'Debited Leave'
  },
  {
    type: 'half_pay',
    name: 'Half Pay Leave (HPL)',
    code: 'HPL',
    defaultQuota: 20,
    accrualFrequency: 'half_yearly',
    maxAccumulation: 0,
    carryForward: true,
    maxCarryForwardDays: 999,
    encashmentAllowed: true,
    requiresLevel2ForDaysMoreThan: 3,
    minNoticeDays: 3,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 2,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 90,
    description: 'Credited @ 10 days on 1st Jan & 1st July. Half pay + full HRA/DA. (CCS Rule 29)',
    ccsRuleNumber: 'Rule 29',
    isDebited: true,
    ccsCategory: 'Debited Leave'
  },
  {
    type: 'commuted',
    name: 'Commuted Leave',
    code: 'COMM',
    defaultQuota: 10,
    accrualFrequency: 'half_yearly',
    maxAccumulation: 0,
    carryForward: true,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 3,
    minNoticeDays: 0,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 1,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 90,
    description: 'Granted on Medical Certificate or up to 90 days for approved studies. Debited 2x against HPL. (CCS Rule 30)',
    ccsRuleNumber: 'Rule 30',
    isDebited: true,
    ccsCategory: 'Debited Leave'
  },
  {
    type: 'leave_not_due',
    name: 'Leave Not Due (LND)',
    code: 'LND',
    defaultQuota: 360,
    accrualFrequency: 'upfront',
    maxAccumulation: 360,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 5,
    minNoticeDays: 7,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 1,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent'],
    genderEligibility: 'all',
    minServiceMonths: 12,
    maxConsecutiveDays: 360,
    description: 'Max 360 days in entire service on Medical Certificate. Debited against future HPL. (CCS Rule 31)',
    ccsRuleNumber: 'Rule 31',
    isDebited: true,
    ccsCategory: 'Debited Leave'
  },
  {
    type: 'extra_ordinary',
    name: 'Extra Ordinary Leave (EOL)',
    code: 'EOL',
    defaultQuota: 90,
    accrualFrequency: 'upfront',
    maxAccumulation: 1825,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 5,
    minNoticeDays: 15,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 3,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent', 'contractual'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 1825,
    description: 'Granted in special circumstances without leave salary. Continuous limit up to 5 yrs. (CCS Rule 32)',
    ccsRuleNumber: 'Rule 32',
    isDebited: true,
    ccsCategory: 'Debited Leave'
  },
  {
    type: 'casual',
    name: 'Casual Leave (CL)',
    code: 'CL',
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
    maxConsecutiveDays: 5,
    description: 'Short absences (8 days/yr for normal staff, 12 for differently-abled). Can be half-day.',
    ccsRuleNumber: 'Executive Orders',
    isDebited: false,
    ccsCategory: 'Short Absence / Holiday'
  },
  {
    type: 'restricted',
    name: 'Restricted Holiday (RH)',
    code: 'RH',
    defaultQuota: 2,
    accrualFrequency: 'yearly',
    maxAccumulation: 2,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 1,
    minNoticeDays: 1,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['permanent', 'contractual'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 2,
    description: 'Max 2 days per calendar year from approved RH list.',
    ccsRuleNumber: 'Executive Orders',
    isDebited: false,
    ccsCategory: 'Short Absence / Holiday'
  },
  {
    type: 'station',
    name: 'Station Leave / HQ Permission (STN)',
    code: 'STN',
    defaultQuota: 10,
    accrualFrequency: 'upfront',
    maxAccumulation: 0,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 2,
    minNoticeDays: 2,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['permanent', 'contractual', 'researcher', 'diploma_trainee', 'intern', 'bsc_msc_student', 'phd_student'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 15,
    description: 'Permission to leave headquarters / station during holidays, weekends, or short absences.',
    ccsRuleNumber: 'HQ Leave Rules',
    isDebited: false,
    ccsCategory: 'Short Absence / Holiday'
  },

  // Special Kinds of Leave (CCS Rules 43, 43-A, 43-C, 50 - NOT Debited)
  {
    type: 'maternity',
    name: 'Maternity Leave',
    code: 'MAT',
    defaultQuota: 180,
    accrualFrequency: 'upfront',
    maxAccumulation: 180,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 5,
    minNoticeDays: 30,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 1,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent', 'contractual', 'researcher'],
    genderEligibility: 'female_only',
    minServiceMonths: 0,
    maxConsecutiveDays: 180,
    description: '180 days for child birth/adoption (<2 surviving children). Additional 45 days for miscarriage. (CCS Rule 43)',
    ccsRuleNumber: 'Rule 43',
    isDebited: false,
    ccsCategory: 'Special Leave (Non-Debited)'
  },
  {
    type: 'paternity',
    name: 'Paternity Leave',
    code: 'PAT',
    defaultQuota: 15,
    accrualFrequency: 'upfront',
    maxAccumulation: 15,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 3,
    minNoticeDays: 7,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 1,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent', 'contractual', 'researcher'],
    genderEligibility: 'male_only',
    minServiceMonths: 0,
    maxConsecutiveDays: 15,
    description: '15 days during confinement of wife or adoption (<2 surviving children). (CCS Rule 43-A)',
    ccsRuleNumber: 'Rule 43-A',
    isDebited: false,
    ccsCategory: 'Special Leave (Non-Debited)'
  },
  {
    type: 'child_care',
    name: 'Child Care Leave (CCL)',
    code: 'CCL',
    defaultQuota: 730,
    accrualFrequency: 'upfront',
    maxAccumulation: 730,
    carryForward: true,
    maxCarryForwardDays: 730,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 5,
    minNoticeDays: 15,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent'],
    genderEligibility: 'female_only',
    minServiceMonths: 0,
    maxConsecutiveDays: 120,
    description: '730 days in entire service for female staff for up to 2 minor children below 18 yrs. (CCS Rule 43-C)',
    ccsRuleNumber: 'Rule 43-C',
    isDebited: false,
    ccsCategory: 'Special Leave (Non-Debited)'
  },
  {
    type: 'study',
    name: 'Study Leave',
    code: 'STUDY',
    defaultQuota: 365,
    accrualFrequency: 'upfront',
    maxAccumulation: 730,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 10,
    minNoticeDays: 60,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'included',
    allowedEmploymentTypes: ['permanent'],
    genderEligibility: 'all',
    minServiceMonths: 60,
    maxConsecutiveDays: 365,
    description: 'Ordinarily 12 months at one time & 24 months total in service. Requires 5 yrs service & bond. (CCS Rule 50)',
    ccsRuleNumber: 'Rule 50',
    isDebited: false,
    ccsCategory: 'Special Leave (Non-Debited)'
  },
  {
    type: 'special_casual',
    name: 'Special Casual Leave',
    code: 'SCL',
    defaultQuota: 15,
    accrualFrequency: 'yearly',
    maxAccumulation: 30,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 3,
    minNoticeDays: 3,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['permanent', 'contractual'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 15,
    description: 'Participation in Sports/Cultural events, Family Planning, Natural Calamities.',
    ccsRuleNumber: 'Executive Orders',
    isDebited: false,
    ccsCategory: 'Special Leave (Non-Debited)'
  },
  {
    type: 'compensatory_off',
    name: 'Compensatory Off (C-Off)',
    code: 'C-OFF',
    defaultQuota: 5,
    accrualFrequency: 'monthly',
    maxAccumulation: 5,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 2,
    minNoticeDays: 1,
    halfDayAllowed: true,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['permanent', 'contractual'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 3,
    description: 'Off in lieu of working on holidays without financial incentives.',
    ccsRuleNumber: 'Executive Orders',
    isDebited: false,
    ccsCategory: 'Short Absence / Holiday'
  },

  // Contractual & Researchers Specific Policies
  {
    type: 'sick',
    name: 'Sick Leave (SL)',
    code: 'SL',
    defaultQuota: 6,
    accrualFrequency: 'yearly',
    maxAccumulation: 6,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 2,
    minNoticeDays: 0,
    halfDayAllowed: true,
    medicalCertRequiredForDaysMoreThan: 2,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['contractual'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 6,
    description: 'Medical absence allowance for contractual personnel.',
    ccsRuleNumber: 'Contract Terms',
    isDebited: true,
    ccsCategory: 'Debited Leave'
  },
  {
    type: 'field_work',
    name: 'Field Work Leave (FWL)',
    code: 'FWL',
    defaultQuota: 30,
    accrualFrequency: 'yearly',
    maxAccumulation: 30,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 5,
    minNoticeDays: 5,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['researcher'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 30,
    description: 'Dedicated leave for off-site field sample collection and research trials.',
    ccsRuleNumber: 'Research Terms',
    isDebited: false,
    ccsCategory: 'Special Leave (Non-Debited)'
  },
  {
    type: 'academic',
    name: 'Academic Leave (AL)',
    code: 'AL',
    defaultQuota: 15,
    accrualFrequency: 'yearly',
    maxAccumulation: 15,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 3,
    minNoticeDays: 7,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['researcher'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 15,
    description: 'Conferences, symposia, and thesis writing offs.',
    ccsRuleNumber: 'Research Terms',
    isDebited: false,
    ccsCategory: 'Special Leave (Non-Debited)'
  },

  // Trainees & Students
  {
    type: 'stipend_off',
    name: 'Academic/Stipend Off',
    code: 'ACAD',
    defaultQuota: 6,
    accrualFrequency: 'yearly',
    maxAccumulation: 6,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 2,
    minNoticeDays: 3,
    halfDayAllowed: false,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['diploma_trainee', 'intern', 'bsc_msc_student', 'phd_student'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 6,
    description: 'Approved study or exam leave allowance.',
    ccsRuleNumber: 'Academic Terms',
    isDebited: false,
    ccsCategory: 'Short Absence / Holiday'
  },
  {
    type: 'contingency',
    name: 'Contingency Off',
    code: 'CONT',
    defaultQuota: 5,
    accrualFrequency: 'yearly',
    maxAccumulation: 5,
    carryForward: false,
    encashmentAllowed: false,
    requiresLevel2ForDaysMoreThan: 2,
    minNoticeDays: 0,
    halfDayAllowed: true,
    medicalCertRequiredForDaysMoreThan: 0,
    sandwichRule: 'excluded',
    allowedEmploymentTypes: ['diploma_trainee', 'intern', 'bsc_msc_student', 'phd_student'],
    genderEligibility: 'all',
    minServiceMonths: 0,
    maxConsecutiveDays: 3,
    description: 'Emergency leave allowance for student interns.',
    ccsRuleNumber: 'Academic Terms',
    isDebited: false,
    ccsCategory: 'Short Absence / Holiday'
  }
];

// Seed OD requests
export const INITIAL_OD_REQUESTS: OutdoorDutyRequest[] = [
  {
    id: 'od-101',
    userId: 'usr-6',
    userName: 'Rahul Kumar',
    userEmail: 'rahul.kumar@inst.org',
    department: 'Wildlife Ecology & Research',
    startDate: '2026-08-18',
    endDate: '2026-08-20',
    startTime: '08:00',
    endTime: '18:00',
    daysCount: 3,
    odType: 'Domestic',
    location: 'Jim Corbett Tiger Reserve, Zone 3, Uttarakhand',
    estimatedFunds: 12500,
    fundingSource: 'CAMPA Tiger Research Grant',
    purpose: 'Camera trap grid setup and nocturnal species camera monitoring along riverine tracts',
    status: 'pending',
    appliedDate: '2026-08-09',
    reportingManagerId: 'usr-2'
  },
  {
    id: 'od-102',
    userId: 'usr-4',
    userName: 'Priya Verma',
    userEmail: 'priya.verma@inst.org',
    department: 'Wildlife Ecology & Research',
    startDate: '2026-08-05',
    endDate: '2026-08-06',
    startTime: '09:00',
    endTime: '17:30',
    daysCount: 2,
    odType: 'Domestic',
    location: 'State Biodiversity Board HQ, New Delhi',
    estimatedFunds: 4500,
    fundingSource: 'Institutional Travel Grant',
    purpose: 'Official stakeholder meeting regarding state wildlife corridor notification draft',
    status: 'approved',
    appliedDate: '2026-08-01',
    reportingManagerId: 'usr-2',
    approverComments: 'Approved. Please submit travel vouchers and meeting summary upon return.',
    actionBy: 'Anita Roy',
    actionAt: '2026-08-02 10:30'
  },
  {
    id: 'od-103',
    userId: 'usr-5',
    userName: 'Amit Patel',
    userEmail: 'amit.patel@inst.org',
    department: 'IT & BioInformatics',
    startDate: '2026-08-22',
    endDate: '2026-08-23',
    startTime: '09:30',
    endTime: '17:00',
    daysCount: 2,
    odType: 'Domestic',
    location: 'NIC Data Center & Supercomputing Node, Cyber City',
    estimatedFunds: 2000,
    fundingSource: 'IT Hardware Maintenance Fund',
    purpose: 'Hardware server maintenance, database mirror sync, and biometric node firmware patch',
    status: 'pending',
    appliedDate: '2026-08-10',
    reportingManagerId: 'usr-2'
  },
  {
    id: 'od-104',
    userId: 'usr-8',
    userName: 'Dr. Sunita Rao',
    userEmail: 'sunita.rao@inst.org',
    department: 'Landscape Ecology & GIS',
    startDate: '2026-08-12',
    endDate: '2026-08-15',
    startTime: '09:00',
    endTime: '18:00',
    daysCount: 4,
    odType: 'Domestic',
    location: 'ISRO National Remote Sensing Centre (NRSC), Hyderabad',
    estimatedFunds: 18500,
    fundingSource: 'ISRO-WII Earth Observation Collaboration',
    purpose: 'Participating in high-resolution LISS-IV geospatial ground-truthing and landcover validation',
    status: 'approved',
    appliedDate: '2026-08-04',
    reportingManagerId: 'usr-3',
    approverComments: 'Approved. Essential technical collaboration for the National Elephant Corridor Project.',
    actionBy: 'Vikram Singh',
    actionAt: '2026-08-05 14:45'
  },
  {
    id: 'od-105',
    userId: 'usr-10',
    userName: 'Neha Joshi',
    userEmail: 'neha.joshi@inst.org',
    department: 'Climate Change & Spatial Ecology',
    startDate: '2026-08-24',
    endDate: '2026-08-29',
    startTime: '07:30',
    endTime: '19:00',
    daysCount: 6,
    odType: 'Domestic',
    location: 'Spiti Valley & Pin Valley National Park, Himachal Pradesh',
    estimatedFunds: 28000,
    fundingSource: 'MoEFCC National Mission on Himalayan Studies',
    purpose: 'High-altitude alpine vegetation sampling and climate data logger sensor retrieval',
    status: 'pending',
    appliedDate: '2026-08-11',
    reportingManagerId: 'usr-8'
  },
  {
    id: 'od-106',
    userId: 'usr-9',
    userName: 'Dr. Sanjay Verma',
    userEmail: 'sanjay.verma@inst.org',
    department: 'Wildlife Health & Forensic Sciences',
    startDate: '2026-08-08',
    endDate: '2026-08-09',
    startTime: '08:30',
    endTime: '18:30',
    daysCount: 2,
    odType: 'Domestic',
    location: 'Wildlife Crime Control Bureau (WCCB) Eastern Region, Kolkata',
    estimatedFunds: 9200,
    fundingSource: 'Inter-Agency Forensic Coordination Fund',
    purpose: 'Forensic ballistics and ivory DNA sample verification in ongoing wildlife contraband investigation',
    status: 'approved',
    appliedDate: '2026-08-02',
    reportingManagerId: 'usr-1',
    approverComments: 'Approved. Deputation mandated under Section 50 of Wildlife Protection Act.',
    actionBy: 'Dr. Rajesh Sharma',
    actionAt: '2026-08-03 11:15'
  },
  {
    id: 'od-107',
    userId: 'usr-12',
    userName: 'Kavita Deshmukh',
    userEmail: 'kavita.deshmukh@inst.org',
    department: 'Ecodevelopment & Community',
    startDate: '2026-08-26',
    endDate: '2026-08-30',
    startTime: '08:00',
    endTime: '17:30',
    daysCount: 5,
    odType: 'Domestic',
    location: 'Kaziranga Tiger Reserve Buffer Villages, Golaghat, Assam',
    estimatedFunds: 16000,
    fundingSource: 'NTCA Ecodevelopment Project',
    purpose: 'Focal group interviews on human-elephant conflict mitigation and crop insurance awareness',
    status: 'pending',
    appliedDate: '2026-08-12',
    reportingManagerId: 'usr-8'
  },
  {
    id: 'od-108',
    userId: 'usr-11',
    userName: 'Anand Mishra',
    userEmail: 'anand.mishra@inst.org',
    department: 'Accounts & Finance',
    startDate: '2026-08-06',
    endDate: '2026-08-07',
    startTime: '09:00',
    endTime: '17:30',
    daysCount: 2,
    odType: 'Domestic',
    location: 'Ministry of Environment, Forest and Climate Change, Indira Paryavaran Bhawan, New Delhi',
    estimatedFunds: 6000,
    fundingSource: 'Institutional Administrative Budget',
    purpose: 'Annual statutory budget reconciliation and quarterly grant release documentation meeting',
    status: 'approved',
    appliedDate: '2026-08-01',
    reportingManagerId: 'usr-1',
    approverComments: 'Approved. Ensure PFMS expenditure sheets are fully endorsed.',
    actionBy: 'Dr. Rajesh Sharma',
    actionAt: '2026-08-02 09:30'
  },
  {
    id: 'od-109',
    userId: 'usr-1',
    userName: 'Dr. Rajesh Sharma',
    userEmail: 'rajesh.sharma@inst.org',
    department: 'Executive Administration',
    startDate: '2026-09-07',
    endDate: '2026-09-11',
    startTime: '09:00',
    endTime: '18:00',
    daysCount: 5,
    odType: 'International',
    location: 'International Environment House, Geneva, Switzerland',
    estimatedFunds: 215000,
    fundingSource: 'Union Ministry Delegation Grant',
    purpose: 'Representing institutional scientific delegation at the CITES Standing Committee Working Group',
    status: 'approved',
    appliedDate: '2026-08-01',
    reportingManagerId: 'usr-1',
    approverComments: 'Approved under Ministry official deputation order #MOEF-CITES-2026-89.',
    actionBy: 'Director General',
    actionAt: '2026-08-03 16:00'
  },
  {
    id: 'od-110',
    userId: 'usr-7',
    userName: 'Maya Patel',
    userEmail: 'maya.patel@inst.org',
    department: 'Wildlife Ecology & Research',
    startDate: '2026-08-03',
    endDate: '2026-08-05',
    startTime: '08:30',
    endTime: '17:00',
    daysCount: 3,
    odType: 'Domestic',
    location: 'Keoladeo National Park, Bharatpur, Rajasthan',
    estimatedFunds: 4000,
    fundingSource: 'Student Dissertation Fund',
    purpose: 'Waterfowl counting and aquatic macroinvertebrate sampling for M.Sc. dissertation',
    status: 'rejected',
    appliedDate: '2026-07-28',
    reportingManagerId: 'usr-2',
    approverComments: 'Please attach written supervisor recommendation letter and resubmit.',
    actionBy: 'Anita Roy',
    actionAt: '2026-07-30 15:20'
  }
];

// Seed Leave Requests
export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'lv-el-101',
    userId: 'usr-1',
    userName: 'Dr. Rajesh Sharma',
    userEmail: 'rajesh.sharma@wii.gov.in',
    employmentType: 'permanent',
    department: 'Directorate & Administration',
    leaveType: 'earned',
    leaveTypeName: 'Earned Leave (EL)',
    startDate: '2026-09-02',
    endDate: '2026-09-08',
    daysCount: 6,
    reason: 'Earned Leave availed with LTC for annual family tour to Himachal Pradesh.',
    status: 'approved',
    requiresLevel2: true,
    ltcType: 'ltc',
    stationAddress: 'Shimla & Manali, HP',
    reportingManagerId: 'usr-3',
    reviewingManagerId: 'usr-3',
    level1Approval: {
      approverId: 'usr-3',
      approverName: 'Dr. Sanjay Verma',
      status: 'approved',
      comments: 'Recommended for sanction under CCS Leave Rules.',
      actionAt: '2026-08-28 11:30'
    },
    level2Approval: {
      approverId: 'usr-3',
      approverName: 'Dr. Sanjay Verma',
      status: 'approved',
      comments: 'Earned Leave sanctioned with LTC permission per delegation of powers.',
      actionAt: '2026-08-29 14:15'
    },
    appliedDate: '2026-08-25'
  },
  {
    id: 'lv-el-102',
    userId: 'usr-2',
    userName: 'Anita Roy',
    userEmail: 'anita.roy@inst.org',
    employmentType: 'permanent',
    department: 'Wildlife Ecology & Research',
    leaveType: 'earned',
    leaveTypeName: 'Earned Leave (EL)',
    startDate: '2026-09-07',
    endDate: '2026-09-12',
    daysCount: 5,
    reason: 'Earned leave for daughter university admission counseling and personal work.',
    status: 'approved',
    requiresLevel2: true,
    reportingManagerId: 'usr-1',
    reviewingManagerId: 'usr-3',
    level1Approval: {
      approverId: 'usr-1',
      approverName: 'Dr. Rajesh Sharma',
      status: 'approved',
      comments: 'Recommended for sanction.',
      actionAt: '2026-09-01 10:00'
    },
    level2Approval: {
      approverId: 'usr-3',
      approverName: 'Dr. Vikram Singh',
      status: 'approved',
      comments: 'Sanctioned under CCS (Leave) Rules.',
      actionAt: '2026-09-01 16:30'
    },
    joiningReport: {
      id: 'jr-el-102',
      leaveId: 'lv-el-102',
      userId: 'usr-2',
      userName: 'Anita Roy',
      designation: 'Senior Principal Scientist',
      department: 'Wildlife Ecology & Research',
      joiningDate: '2026-09-13',
      joiningSession: 'FN',
      joiningStatus: 'on_time',
      stationReturned: true,
      remarks: 'Returned from personal leave and reported on duty in Forenoon session.',
      submittedAt: '2026-09-13 09:30',
      status: 'submitted'
    },
    appliedDate: '2026-08-30'
  },
  {
    id: 'lv-201',
    userId: 'usr-4',
    userName: 'Priya Verma',
    userEmail: 'priya.verma@inst.org',
    employmentType: 'permanent',
    department: 'Wildlife Ecology & Research',
    leaveType: 'casual',
    leaveTypeName: 'Casual Leave (CL)',
    startDate: '2026-08-14',
    endDate: '2026-08-14',
    daysCount: 1,
    reason: 'Personal urgent family commitment.',
    status: 'pending_level_1',
    requiresLevel2: false,
    reportingManagerId: 'usr-2',
    reviewingManagerId: 'usr-3',
    appliedDate: '2026-08-10'
  },
  {
    id: 'lv-202',
    userId: 'usr-6',
    userName: 'Rahul Kumar',
    userEmail: 'rahul.kumar@inst.org',
    employmentType: 'researcher',
    department: 'Wildlife Ecology & Research',
    leaveType: 'field_work',
    leaveTypeName: 'Field Work Leave (FWL)',
    startDate: '2026-08-20',
    endDate: '2026-08-27',
    daysCount: 7,
    reason: 'Avian tagging and migration tracking campaign in Chilika lagoon region.',
    status: 'pending_level_2',
    requiresLevel2: true,
    reportingManagerId: 'usr-2',
    reviewingManagerId: 'usr-3',
    level1Approval: {
      approverId: 'usr-2',
      approverName: 'Anita Roy',
      status: 'approved',
      comments: 'Recommended for scientific field expedition approval under project charter.',
      actionAt: '2026-08-10 15:15'
    },
    appliedDate: '2026-08-08'
  },
  {
    id: 'lv-203',
    userId: 'usr-2',
    userName: 'Anita Roy',
    userEmail: 'anita.roy@inst.org',
    employmentType: 'permanent',
    department: 'Wildlife Ecology & Research',
    leaveType: 'earned',
    leaveTypeName: 'Earned Leave (EL)',
    startDate: '2026-08-25',
    endDate: '2026-08-28',
    daysCount: 4,
    reason: 'Annual family vacation leave with All India LTC concession.',
    status: 'pending_level_1',
    requiresLevel2: true,
    ltcType: 'ltc',
    stationAddress: 'Kolkata, West Bengal',
    reportingManagerId: 'usr-3',
    reviewingManagerId: 'usr-1',
    appliedDate: '2026-08-09'
  },
  {
    id: 'lv-204',
    userId: 'usr-7',
    userName: 'Maya Patel',
    userEmail: 'maya.patel@inst.org',
    employmentType: 'bsc_msc_student',
    department: 'Wildlife Ecology & Research',
    leaveType: 'stipend_off',
    leaveTypeName: 'Academic/Stipend Off',
    startDate: '2026-08-01',
    endDate: '2026-08-01',
    daysCount: 1,
    reason: 'University semester viva exam and thesis synopsis submission.',
    status: 'approved',
    requiresLevel2: false,
    reportingManagerId: 'usr-2',
    level1Approval: {
      approverId: 'usr-2',
      approverName: 'Anita Roy',
      status: 'approved',
      comments: 'Exam permission granted.',
      actionAt: '2026-07-30 11:00'
    },
    appliedDate: '2026-07-28'
  },
  {
    id: 'lv-205',
    userId: 'usr-8',
    userName: 'Dr. Sunita Rao',
    userEmail: 'sunita.rao@inst.org',
    employmentType: 'permanent',
    department: 'Landscape Ecology & GIS',
    leaveType: 'commuted',
    leaveTypeName: 'Commuted Leave',
    startDate: '2026-08-03',
    endDate: '2026-08-07',
    daysCount: 5,
    reason: 'Post-viral acute bronchospasm and doctor-prescribed bed rest. Medical certificate attached.',
    status: 'approved',
    requiresLevel2: true,
    isCommuted: true,
    prescriptionFileName: 'Medical_Fitness_Cert_DrRao.pdf',
    reportingManagerId: 'usr-3',
    reviewingManagerId: 'usr-1',
    level1Approval: {
      approverId: 'usr-3',
      approverName: 'Vikram Singh',
      status: 'approved',
      comments: 'Medical certificate verified from CMO panel hospital.',
      actionAt: '2026-08-02 16:30'
    },
    level2Approval: {
      approverId: 'usr-1',
      approverName: 'Dr. Rajesh Sharma',
      status: 'approved',
      comments: 'Commuted leave debited 10 days against HPL per CCS Rule 30.',
      actionAt: '2026-08-03 09:15'
    },
    joiningReport: {
      id: 'jr-205',
      leaveId: 'lv-205',
      userId: 'usr-4',
      userName: 'Sunita Rao',
      designation: 'Scientist D',
      department: 'Landscape Ecology & GIS',
      joiningDate: '2026-08-08',
      joiningSession: 'FN',
      joiningStatus: 'on_time',
      stationReturned: true,
      fitnessCertificateAttached: true,
      fitnessCertificateName: 'Medical_Fitness_Cert_DrRao.pdf',
      remarks: 'Resumed duty in Forenoon after recovery. Fitness certificate submitted to Medical Officer.',
      submittedAt: '2026-08-08 09:45',
      status: 'accepted',
      forwardedBy: 'usr-2',
      forwardedByName: 'Anita Roy',
      forwardedAt: '2026-08-08 10:15',
      forwardRemarks: 'Reported on duty on time in Forenoon session. Recommended and forwarded to HoD for acceptance.',
      verifiedBy: 'usr-1',
      verifiedByName: 'Dr. Rajesh Sharma',
      verifiedAt: '2026-08-08 11:30',
      verificationRemarks: 'Fitness certificate verified and joining accepted on record.'
    },
    appliedDate: '2026-08-01'
  },
  {
    id: 'lv-206',
    userId: 'usr-10',
    userName: 'Neha Joshi',
    userEmail: 'neha.joshi@inst.org',
    employmentType: 'researcher',
    department: 'Climate Change & Spatial Ecology',
    leaveType: 'academic',
    leaveTypeName: 'Academic Leave (AL)',
    startDate: '2026-08-26',
    endDate: '2026-08-28',
    daysCount: 3,
    reason: 'Oral paper presentation on Himalayan treeline shifts at National Geospatial Conference.',
    status: 'pending_level_1',
    requiresLevel2: false,
    reportingManagerId: 'usr-8',
    reviewingManagerId: 'usr-3',
    appliedDate: '2026-08-11'
  },
  {
    id: 'lv-207',
    userId: 'usr-11',
    userName: 'Anand Mishra',
    userEmail: 'anand.mishra@inst.org',
    employmentType: 'permanent',
    department: 'Accounts & Finance',
    leaveType: 'restricted',
    leaveTypeName: 'Restricted Holiday (RH)',
    startDate: '2026-08-19',
    endDate: '2026-08-19',
    daysCount: 1,
    reason: 'Observance of regional cultural holiday from approved institutional RH gazette.',
    status: 'approved',
    requiresLevel2: false,
    reportingManagerId: 'usr-1',
    level1Approval: {
      approverId: 'usr-1',
      approverName: 'Dr. Rajesh Sharma',
      status: 'approved',
      comments: 'RH verified from 2026 roster.',
      actionAt: '2026-08-12 11:30'
    },
    appliedDate: '2026-08-10'
  },
  {
    id: 'lv-208',
    userId: 'usr-12',
    userName: 'Kavita Deshmukh',
    userEmail: 'kavita.deshmukh@inst.org',
    employmentType: 'contractual',
    department: 'Ecodevelopment & Community',
    leaveType: 'sick',
    leaveTypeName: 'Sick Leave (SL)',
    startDate: '2026-08-11',
    endDate: '2026-08-12',
    daysCount: 2,
    reason: 'Sudden seasonal viral flu and fever.',
    status: 'approved',
    requiresLevel2: false,
    reportingManagerId: 'usr-8',
    level1Approval: {
      approverId: 'usr-8',
      approverName: 'Dr. Sunita Rao',
      status: 'approved',
      comments: 'Get well soon. Approved.',
      actionAt: '2026-08-11 08:30'
    },
    appliedDate: '2026-08-11'
  },
  {
    id: 'lv-209',
    userId: 'usr-9',
    userName: 'Dr. Sanjay Verma',
    userEmail: 'sanjay.verma@inst.org',
    employmentType: 'permanent',
    department: 'Wildlife Health & Forensic Sciences',
    leaveType: 'earned',
    leaveTypeName: 'Earned Leave (EL)',
    startDate: '2026-08-10',
    endDate: '2026-08-17',
    daysCount: 8,
    reason: 'Home Town Leave Travel Concession (LTC) to attend family reunion.',
    status: 'approved',
    requiresLevel2: true,
    ltcType: 'ltc',
    encashLtc: true,
    encashDays: 10,
    stationAddress: 'Jaipur, Rajasthan',
    reportingManagerId: 'usr-1',
    reviewingManagerId: 'usr-1',
    level1Approval: {
      approverId: 'usr-1',
      approverName: 'Dr. Rajesh Sharma',
      status: 'approved',
      comments: 'LTC block 2026-2029 entitlement checked. Approved with 10 days EL encashment.',
      actionAt: '2026-08-03 14:30'
    },
    appliedDate: '2026-08-01'
  },
  {
    id: 'lv-210',
    userId: 'usr-5',
    userName: 'Amit Patel',
    userEmail: 'amit.patel@inst.org',
    employmentType: 'contractual',
    department: 'IT & BioInformatics',
    leaveType: 'casual',
    leaveTypeName: 'Casual Leave (CL)',
    startDate: '2026-08-17',
    endDate: '2026-08-18',
    daysCount: 2,
    reason: 'Attending younger brother wedding in Ahmedabad.',
    status: 'approved',
    requiresLevel2: false,
    reportingManagerId: 'usr-2',
    level1Approval: {
      approverId: 'usr-2',
      approverName: 'Anita Roy',
      status: 'approved',
      comments: 'Server on-call backup handed over to Rahul Kumar. Approved.',
      actionAt: '2026-08-12 16:00'
    },
    appliedDate: '2026-08-10'
  },
  {
    id: 'lv-211',
    userId: 'usr-4',
    userName: 'Priya Verma',
    userEmail: 'priya.verma@inst.org',
    employmentType: 'permanent',
    department: 'Wildlife Ecology & Research',
    leaveType: 'child_care',
    leaveTypeName: 'Child Care Leave (CCL)',
    startDate: '2026-09-01',
    endDate: '2026-09-12',
    daysCount: 12,
    reason: 'Care for daughter convalescing from viral surgery and school midterm exam supervision.',
    status: 'pending_level_2',
    requiresLevel2: true,
    reportingManagerId: 'usr-2',
    reviewingManagerId: 'usr-3',
    level1Approval: {
      approverId: 'usr-2',
      approverName: 'Anita Roy',
      status: 'approved',
      comments: 'CCL spell #01 recommended for approval per CCS Rule 43-C.',
      actionAt: '2026-08-11 11:45'
    },
    appliedDate: '2026-08-08'
  },
  {
    id: 'lv-212',
    userId: 'usr-3',
    userName: 'Vikram Singh',
    userEmail: 'vikram.singh@inst.org',
    employmentType: 'permanent',
    department: 'Research & Development',
    leaveType: 'compensatory_off',
    leaveTypeName: 'Compensatory Off (C-Off)',
    startDate: '2026-08-21',
    endDate: '2026-08-21',
    daysCount: 1,
    reason: 'Off in lieu of performing duty on Sunday 2026-08-02 for Wildlife Trust board audit.',
    status: 'approved',
    requiresLevel2: false,
    reportingManagerId: 'usr-1',
    level1Approval: {
      approverId: 'usr-1',
      approverName: 'Dr. Rajesh Sharma',
      status: 'approved',
      comments: 'Sunday duty attendance verified in security register.',
      actionAt: '2026-08-05 10:00'
    },
    appliedDate: '2026-08-03'
  },
  {
    id: 'lv-213',
    userId: 'usr-6',
    userName: 'Rahul Kumar',
    userEmail: 'rahul.kumar@inst.org',
    employmentType: 'researcher',
    department: 'Wildlife Ecology & Research',
    leaveType: 'casual',
    leaveTypeName: 'Casual Leave (CL)',
    startDate: '2026-08-06',
    endDate: '2026-08-06',
    daysCount: 1,
    reason: 'Urgent passport verification appointment at Regional Passport Office.',
    status: 'rejected',
    requiresLevel2: false,
    reportingManagerId: 'usr-2',
    level1Approval: {
      approverId: 'usr-2',
      approverName: 'Anita Roy',
      status: 'rejected',
      comments: 'Clashes with scheduled MoEFCC CAMPA tiger advisory project review. Please reschedule.',
      actionAt: '2026-08-04 14:15'
    },
    appliedDate: '2026-08-02'
  },
  {
    id: 'lv-214',
    userId: 'usr-10',
    userName: 'Neha Joshi',
    userEmail: 'neha.joshi@inst.org',
    employmentType: 'researcher',
    department: 'Climate Change & Spatial Ecology',
    leaveType: 'special_casual',
    leaveTypeName: 'Special Casual Leave',
    startDate: '2026-08-28',
    endDate: '2026-08-29',
    daysCount: 2,
    reason: 'Institute sports team representative at All India Forest Sports Meet table tennis tournament.',
    status: 'approved',
    requiresLevel2: false,
    reportingManagerId: 'usr-8',
    level1Approval: {
      approverId: 'usr-8',
      approverName: 'Dr. Sunita Rao',
      status: 'approved',
      comments: 'Approved per institutional sports nomination guidelines.',
      actionAt: '2026-08-12 15:30'
    },
    appliedDate: '2026-08-10'
  }
];

export const INITIAL_MANUAL_ATTENDANCE_REQUESTS: ManualAttendanceRegularizationRequest[] = [
  {
    id: 'man_att_101',
    userId: 'usr-3',
    userName: 'Vikram Singh',
    userDesignation: 'Director of Research',
    userDepartment: 'Research & Development',
    date: '2026-08-11',
    requestedInTime: '09:15',
    requestedOutTime: '17:45',
    originalInTime: '09:15',
    reasonCategory: 'Biometric Issue',
    reason: 'Biometric Gate-02 scanner hardware error during morning punch; lab specimen transfer in evening.',
    reportingManagerId: 'usr-1',
    reportingManagerName: 'Dr. Rajesh Sharma',
    status: 'pending',
    appliedAt: '2026-08-12'
  },
  {
    id: 'man_att_102',
    userId: 'usr-4',
    userName: 'Priya Verma',
    userDesignation: 'Scientific Officer',
    userDepartment: 'Wildlife Ecology & Research',
    date: '2026-08-07',
    requestedInTime: '09:30',
    requestedOutTime: '18:00',
    originalInTime: '09:30',
    reasonCategory: 'Urgent OD',
    reason: 'Attended urgent institutional GIS server maintenance with IT team off-station.',
    reportingManagerId: 'usr-2',
    reportingManagerName: 'Anita Roy',
    status: 'approved',
    appliedAt: '2026-08-08',
    actionDate: '2026-08-08',
    actionBy: 'Anita Roy',
    managerComment: 'Verified with IT server maintenance logs. Regularization approved.'
  },
  {
    id: 'man_att_103',
    userId: 'usr-5',
    userName: 'Amit Patel',
    userDesignation: 'Database Analyst (Contract)',
    userDepartment: 'IT & BioInformatics',
    date: '2026-08-10',
    requestedInTime: '09:00',
    requestedOutTime: '17:30',
    reasonCategory: 'Forgot to Punch',
    reason: 'Campus ID card forgotten at hostel accommodation; attended full work hours in laboratory.',
    reportingManagerId: 'usr-2',
    reportingManagerName: 'Anita Roy',
    status: 'pending',
    appliedAt: '2026-08-11'
  },
  {
    id: 'man_att_104',
    userId: 'usr-9',
    userName: 'Dr. Sanjay Verma',
    userDesignation: 'Scientist-E & Head',
    userDepartment: 'Wildlife Health & Forensic Sciences',
    date: '2026-08-04',
    requestedInTime: '09:00',
    requestedOutTime: '18:30',
    reasonCategory: 'Urgent OD',
    reason: 'Emergency post-mortem sample analysis in high-containment biosafety lab without access to phone/card.',
    reportingManagerId: 'usr-1',
    reportingManagerName: 'Dr. Rajesh Sharma',
    status: 'approved',
    appliedAt: '2026-08-05',
    actionDate: '2026-08-05',
    actionBy: 'Dr. Rajesh Sharma',
    managerComment: 'Biosafety lab entry register verified.'
  },
  {
    id: 'man_att_105',
    userId: 'usr-6',
    userName: 'Rahul Kumar',
    userDesignation: 'Senior Research Fellow',
    userDepartment: 'Wildlife Ecology & Research',
    date: '2026-07-30',
    requestedInTime: '09:30',
    requestedOutTime: '17:30',
    reasonCategory: 'Forgot to Punch',
    reason: 'Missed evening punch out while finalizing quarterly CAMPA Tiger progress report in library.',
    reportingManagerId: 'usr-2',
    reportingManagerName: 'Anita Roy',
    status: 'approved',
    appliedAt: '2026-07-31',
    actionDate: '2026-07-31',
    actionBy: 'Anita Roy',
    managerComment: 'Progress report submission verified.'
  },
  {
    id: 'man_att_106',
    userId: 'usr-8',
    userName: 'Dr. Sunita Rao',
    userDesignation: 'Principal Scientist & HoD',
    userDepartment: 'Landscape Ecology & GIS',
    date: '2026-08-06',
    requestedInTime: '09:10',
    requestedOutTime: '17:50',
    reasonCategory: 'Other',
    reason: 'Power disruption at Administrative Block North Wing terminal during evening checkout.',
    reportingManagerId: 'usr-3',
    reportingManagerName: 'Vikram Singh',
    status: 'approved',
    appliedAt: '2026-08-07',
    actionDate: '2026-08-07',
    actionBy: 'Vikram Singh',
    managerComment: 'Electrical maintenance fault confirmed.'
  },
  {
    id: 'man_att_107',
    userId: 'usr-10',
    userName: 'Neha Joshi',
    userDesignation: 'Project Scientist',
    userDepartment: 'Climate Change & Spatial Ecology',
    date: '2026-08-12',
    requestedInTime: '09:05',
    requestedOutTime: '18:00',
    reasonCategory: 'Urgent OD',
    reason: 'Emergency air quality sensor calibration and battery swap at Mussoorie ridge monitoring station.',
    reportingManagerId: 'usr-8',
    reportingManagerName: 'Dr. Sunita Rao',
    status: 'pending',
    appliedAt: '2026-08-13'
  },
  {
    id: 'man_att_108',
    userId: 'usr-11',
    userName: 'Anand Mishra',
    userDesignation: 'Senior Accounts Officer',
    userDepartment: 'Accounts & Finance',
    date: '2026-08-05',
    requestedInTime: '09:30',
    requestedOutTime: '18:30',
    reasonCategory: 'Forgot to Punch',
    reason: 'Engaged in late-night Ministry grant utilization reconciliation in accounts section with auditors.',
    reportingManagerId: 'usr-1',
    reportingManagerName: 'Dr. Rajesh Sharma',
    status: 'approved',
    appliedAt: '2026-08-06',
    actionDate: '2026-08-06',
    actionBy: 'Dr. Rajesh Sharma',
    managerComment: 'Reconciliation work verified in Finance Department.'
  },
  {
    id: 'man_att_109',
    userId: 'usr-12',
    userName: 'Kavita Deshmukh',
    userDesignation: 'Research Associate',
    userDepartment: 'Ecodevelopment & Community',
    date: '2026-08-13',
    requestedInTime: '09:15',
    requestedOutTime: '17:30',
    reasonCategory: 'Not Registered Yet',
    reason: 'Newly renewed contract tenure biometric profile re-enrollment pending in IT division.',
    reportingManagerId: 'usr-8',
    reportingManagerName: 'Dr. Sunita Rao',
    status: 'pending',
    appliedAt: '2026-08-14'
  },
  {
    id: 'man_att_110',
    userId: 'usr-7',
    userName: 'Maya Patel',
    userDesignation: 'PG Student Intern',
    userDepartment: 'Wildlife Ecology & Research',
    date: '2026-08-03',
    requestedInTime: '09:45',
    requestedOutTime: '17:15',
    reasonCategory: 'Forgot to Punch',
    reason: 'Morning entry punch missed due to early field vehicle loading and herbarium specimen transport.',
    reportingManagerId: 'usr-2',
    reportingManagerName: 'Anita Roy',
    status: 'rejected',
    appliedAt: '2026-08-04',
    actionDate: '2026-08-04',
    actionBy: 'Anita Roy',
    managerComment: 'Morning loading register shows departure was at 11:30, not 09:45. Request rejected.'
  },
  {
    id: 'man_att_111',
    userId: 'usr-1',
    userName: 'Dr. Rajesh Sharma',
    userDesignation: 'Chief Administrative Officer',
    userDepartment: 'Executive Administration',
    date: '2026-07-28',
    requestedInTime: '09:00',
    requestedOutTime: '18:15',
    reasonCategory: 'Biometric Issue',
    reason: 'Executive block reader optical sensor was undergoing lens cleaning; manual sign-in recorded in logbook.',
    reportingManagerId: 'usr-1',
    reportingManagerName: 'Director General',
    status: 'approved',
    appliedAt: '2026-07-29',
    actionDate: '2026-07-29',
    actionBy: 'Director General',
    managerComment: 'Approved per Executive Logbook.'
  },
  {
    id: 'man_att_112',
    userId: 'usr-1',
    userName: 'Dr. Rajesh Sharma',
    userDesignation: 'Chief Administrative Officer',
    userDepartment: 'Executive Administration',
    date: '2026-07-31',
    requestedInTime: '09:30',
    requestedOutTime: '17:30',
    reasonCategory: 'Biometric Issue',
    reason: 'Biometric facial scanner timed out during evening rain; security gate register signed manually.',
    reportingManagerId: 'usr-2',
    reportingManagerName: 'Anita Roy',
    status: 'pending',
    appliedAt: '2026-08-18'
  }
];

// Helper to generate seed attendance records for August 2026 (biometric sync)
export const generateSeedAttendance = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const users = INITIAL_USERS;

  // Generate for days 1 through 31 of August 2026
  for (let day = 1; day <= 31; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const date = `2026-08-${dayStr}`;
    const dateObj = new Date(`2026-08-${dayStr}T10:00:00`);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

    users.forEach((u, userIdx) => {
      const userShift = INITIAL_SHIFTS.find((s) => s.id === u.shiftId) || INITIAL_SHIFTS[0];
      let status: AttendanceRecord['status'] = 'present';
      let workMode: AttendanceRecord['workMode'] = 'in_office';
      let clockIn = '09:14';
      let clockOut = '17:35';
      let shiftCode = `${userShift.code} (${userShift.startTime} - ${userShift.endTime})`;
      let totalHours = 8.0;
      let remark = `Biometric Punch IN via Terminal #BIO-GATE-01. Shift: ${userShift.code}. Facial match verified. Punch OUT captured at Exit Gate.`;

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        status = 'weekend';
        workMode = 'in_office';
        clockIn = '-';
        clockOut = '-';
        totalHours = 0;
        remark = 'Scheduled Weekend Off. No biometric logs captured.';
      } else if (day === 15) {
        status = 'holiday';
        workMode = 'in_office';
        clockIn = '-';
        clockOut = '-';
        totalHours = 0;
        remark = 'Independence Day (Gazetted National Holiday - Closed).';
      } else if (day === 5 && u.id === 'usr-4') {
        status = 'od';
        workMode = 'field_od';
        clockIn = '08:45';
        clockOut = '18:15';
        shiftCode = 'FLD-01 (08:30 - 18:00)';
        totalHours = 9.5;
        remark = 'Approved Outdoor Duty requisition #OD-102 at State Biodiversity Board HQ, New Delhi. Mobile geo-fenced biometric check-in verified by GPS coordinate 28.6139° N, 77.2090° E.';
      } else if (day === 1 && u.id === 'usr-7') {
        status = 'leave';
        workMode = 'on_leave';
        clockIn = '-';
        clockOut = '-';
        totalHours = 0;
        remark = 'Approved Academic/Stipend Off for University semester viva exam. Attendance regularized via HR Portal Leave Approval #LV-204.';
      } else if (day >= 3 && day <= 7 && u.id === 'usr-8') {
        status = 'leave';
        workMode = 'on_leave';
        clockIn = '-';
        clockOut = '-';
        totalHours = 0;
        remark = 'Approved Commuted Leave on Medical Grounds. Regularized via HR Leave Approval #LV-205.';
      } else if (day >= 10 && day <= 17 && u.id === 'usr-9') {
        status = 'leave';
        workMode = 'on_leave';
        clockIn = '-';
        clockOut = '-';
        totalHours = 0;
        remark = 'On Approved Earned Leave (EL) with Home Town LTC concession (#LV-209).';
      } else if (day === 8 && u.id === 'usr-5') {
        status = 'late';
        workMode = 'in_office';
        clockIn = '09:52';
        clockOut = '17:40';
        totalHours = 7.8;
        remark = 'Late Punch IN recorded at Terminal #BIO-GATE-02 (22 minutes past grace period limit). Automated email alert dispatched to reporting manager Anita Roy.';
      } else if (day === 12 && u.id === 'usr-6') {
        status = 'od';
        workMode = 'field_od';
        clockIn = '08:30';
        clockOut = '18:30';
        shiftCode = 'FLD-01 (08:30 - 18:00)';
        totalHours = 10.0;
        remark = 'Field Survey Outdoor Duty at Jim Corbett Reserve. Biometric handheld device #BIO-MOBILE-04 synced via satellite link.';
      } else if (day === 14 && u.id === 'usr-4') {
        status = 'leave';
        workMode = 'on_leave';
        clockIn = '-';
        clockOut = '-';
        totalHours = 0;
        remark = 'On Approved Casual Leave (CL). Regularized by HR.';
      } else if (day === 18 && (u.id === 'usr-6' || u.id === 'usr-10')) {
        status = 'od';
        workMode = 'field_od';
        clockIn = '08:00';
        clockOut = '18:00';
        shiftCode = 'FLD-01 (08:00 - 18:00)';
        totalHours = 10.0;
        remark = 'On Approved Field Outdoor Duty. Geo-fenced mobile biometric log verified.';
      } else if (day === 11 && u.id === 'usr-12') {
        status = 'leave';
        workMode = 'on_leave';
        clockIn = '-';
        clockOut = '-';
        totalHours = 0;
        remark = 'Approved Sick Leave (SL) per Medical Intimation #LV-208.';
      } else if (day === 10 && u.id === 'usr-11') {
        status = 'late';
        workMode = 'in_office';
        clockIn = '09:55';
        clockOut = '18:30';
        totalHours = 8.58;
        remark = 'Late Punch IN at Main Gate Terminal. Total shift hours fulfilled with evening extension.';
      } else if (day === 4 && u.id === 'usr-2') {
        status = 'half_day';
        workMode = 'in_office';
        clockIn = '09:10';
        clockOut = '13:30';
        totalHours = 4.33;
        remark = 'Half-day duty recorded. First half present, second half afternoon session off.';
      } else if (day === 3 && u.id === 'usr-1') {
        clockIn = '09:05';
        clockOut = '18:10';
        totalHours = 9.08;
        remark = 'Executive Gate Biometric Terminal #BIO-EXEC-01 punch log.';
      } else {
        // Vary punch times slightly for realistic biometric look
        const inMins = 10 + ((day * 3 + userIdx * 7) % 18);
        const outMins = 30 + ((day * 5 + userIdx * 11) % 25);
        clockIn = `09:${inMins < 10 ? '0' + inMins : inMins}`;
        clockOut = `17:${outMins < 10 ? '0' + outMins : outMins}`;
        totalHours = Number((8 + (outMins - inMins) / 60).toFixed(2));
        remark = `Biometric fingerprint & iris scan verified at Terminal #BIO-GATE-0${(day % 3) + 1}. Entry card #EMP-${u.id.replace('usr-', '90')}. Log ID #BIO-LOG-${date.replace(/-/g, '')}-${u.id}.`;
      }

      records.push({
        id: `att-${u.id}-${date}`,
        userId: u.id,
        date,
        clockIn,
        clockOut,
        shiftCode,
        workMode,
        status,
        totalHours,
        location: workMode === 'field_od' ? 'External Field Site' : 'Main Campus HQ',
        remark
      });
    });
  }

  return records;
};
