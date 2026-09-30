export interface StatusDefinition {
  code: string;
  label: string;
  description: string;
  badgeStyle: string;
}

export const ATTENDANCE_STATUS_MAP: Record<string, StatusDefinition> = {
  PP: {
    code: 'PP',
    label: 'Present',
    description: 'Present for full day',
    badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
  },
  AA: {
    code: 'AA',
    label: 'Absent',
    description: 'Absent for full day',
    badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200/90'
  },
  PA: {
    code: 'PA',
    label: '1st half Present 2nd half Absent',
    description: '1st half Present 2nd half Absent',
    badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200/90'
  },
  AP: {
    code: 'AP',
    label: '1st half Absent 2nd half Present',
    description: '1st half Absent 2nd half Present',
    badgeStyle: 'bg-orange-50 text-orange-800 border-orange-200/90'
  },
  WW: {
    code: 'WW',
    label: 'Weekend',
    description: 'Scheduled Weekend Off',
    badgeStyle: 'bg-slate-100 text-slate-600 border-slate-200'
  },
  'WW#': {
    code: 'WW#',
    label: 'Working on Weekend',
    description: 'Working on Weekend',
    badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200/90'
  },
  GH: {
    code: 'GH',
    label: 'Gazetted Holiday (GH)',
    description: 'Closed Gazetted Holiday',
    badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-300/90'
  },
  HH: {
    code: 'HH',
    label: 'Holiday (GH)',
    description: 'Scheduled Official Holiday',
    badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-300/90'
  },
  'HH#': {
    code: 'HH#',
    label: 'Working on Holiday',
    description: 'Working on Holiday',
    badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200/90'
  },
  RH: {
    code: 'RH',
    label: 'Restricted Holiday (RH)',
    description: 'Restricted Optional Holiday',
    badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200/90'
  },
  LW: {
    code: 'LW',
    label: 'Leave / LWP',
    description: 'Leave / Leave Without Pay / Loss of Pay',
    badgeStyle: 'bg-rose-50 text-rose-800 border-rose-300/90'
  },
  ST: {
    code: 'ST',
    label: 'Station Leave',
    description: 'Station Leave / Official Leave',
    badgeStyle: 'bg-purple-50 text-purple-800 border-purple-200/90'
  },
  OD: {
    code: 'OD',
    label: 'Out Door',
    description: 'Outdoor Duty / Field Visit',
    badgeStyle: 'bg-blue-50 text-blue-800 border-blue-200/90'
  }
};

export const ALL_STATUS_CODES: StatusDefinition[] = [
  ATTENDANCE_STATUS_MAP.PP,
  ATTENDANCE_STATUS_MAP.AA,
  ATTENDANCE_STATUS_MAP.PA,
  ATTENDANCE_STATUS_MAP.AP,
  ATTENDANCE_STATUS_MAP.WW,
  ATTENDANCE_STATUS_MAP['WW#'],
  ATTENDANCE_STATUS_MAP.GH,
  ATTENDANCE_STATUS_MAP.HH,
  ATTENDANCE_STATUS_MAP['HH#'],
  ATTENDANCE_STATUS_MAP.RH,
  ATTENDANCE_STATUS_MAP.LW,
  ATTENDANCE_STATUS_MAP.ST,
  ATTENDANCE_STATUS_MAP.OD
];

export const getNormalizedStatusCode = (status: string | undefined | null): string => {
  if (!status) return 'AA';
  const s = status.trim().toUpperCase();

  if (s === 'PP' || s === 'PRESENT' || s === 'LATE' || s === 'IN_OFFICE' || s === 'WFH') return 'PP';
  if (s === 'AA' || s === 'ABSENT') return 'AA';
  if (s === 'PA' || s === 'HALF_DAY' || s === 'HALF DAY') return 'PA';
  if (s === 'AP') return 'AP';
  if (s === 'WW' || s === 'WEEKEND') return 'WW';
  if (s === 'WW#' || s === 'WW_WORK' || s === 'WORKING_WEEKEND' || s === 'WORKING ON WEEKEND') return 'WW#';
  if (s === 'GH' || s === 'GAZETTED' || s === 'GAZETTED_HOLIDAY' || s === 'GAZETTED HOLIDAY') return 'GH';
  if (s === 'RH' || s === 'RESTRICTED' || s === 'RESTRICTED_HOLIDAY' || s === 'RESTRICTED HOLIDAY') return 'RH';
  if (s === 'HH' || s === 'HOLIDAY') return 'GH';
  if (s === 'HH#' || s === 'HH_WORK' || s === 'WORKING_HOLIDAY' || s === 'WORKING ON HOLIDAY') return 'HH#';
  if (s === 'LW' || s === 'LWP' || s === 'LEAVE_WITHOUT_PAY' || s === 'LEAVE WITHOUT PAY' || s === 'LOSS OF PAY') return 'LW';
  if (s === 'ST' || s === 'LEAVE' || s === 'STATION_LEAVE' || s === 'STATION LEAVE' || s === 'ON LEAVE') return 'ST';
  if (s === 'OD' || s === 'OUTDOOR' || s === 'OUT DOOR' || s === 'FIELD_OD' || s === 'OUTDOOR_DUTY') return 'OD';

  return 'PP';
};

export const getStatusLabel = (status: string | undefined | null): string => {
  const code = getNormalizedStatusCode(status);
  return ATTENDANCE_STATUS_MAP[code]?.label || 'Present';
};
