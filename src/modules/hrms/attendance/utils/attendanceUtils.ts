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
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-300'
  },
  AA: {
    code: 'AA',
    label: 'Absent',
    description: 'Absent for full day',
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-300'
  },
  PA: {
    code: 'PA',
    label: '1st Half Present / 2nd Half Absent',
    description: '1st Half Present / 2nd Half Absent',
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-300'
  },
  AP: {
    code: 'AP',
    label: '1st Half Absent / 2nd Half Present',
    description: '1st Half Absent / 2nd Half Present',
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-300'
  },
  WW: {
    code: 'WW',
    label: 'Weekend',
    description: 'Scheduled Weekend Off',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-300'
  },
  'WW#': {
    code: 'WW#',
    label: 'Working on Weekend',
    description: 'Working on Weekend',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-300'
  },
  GH: {
    code: 'GH',
    label: 'Gazetted Holiday (GH)',
    description: 'Closed Gazetted Holiday',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-300'
  },
  HH: {
    code: 'HH',
    label: 'Holiday (GH)',
    description: 'Scheduled Official Holiday',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-300'
  },
  'HH#': {
    code: 'HH#',
    label: 'Working on Holiday',
    description: 'Working on Holiday',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-300'
  },
  RH: {
    code: 'RH',
    label: 'Restricted Holiday (RH)',
    description: 'Restricted Optional Holiday',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-300'
  },
  LW: {
    code: 'LW',
    label: 'Leave / LWP',
    description: 'Leave / Leave Without Pay / Loss of Pay',
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-300'
  },
  ST: {
    code: 'ST',
    label: 'Station Leave',
    description: 'Station Leave / Official Leave',
    badgeStyle: 'bg-purple-50 text-purple-700 border-purple-300'
  },
  OD: {
    code: 'OD',
    label: 'Out Door',
    description: 'Outdoor Duty / Field Visit',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-300'
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

// Formats any time string ("09:05 AM", "06:10 PM", "9:05", "18:10") into strict 24-hr "HH:mm"
export const formatTo24H = (timeStr?: string | null): string => {
  if (!timeStr || timeStr.trim() === '' || timeStr.trim() === '--:--' || timeStr.trim() === '-') return '-';
  const str = timeStr.trim();
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  const match24 = str.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  return timeStr;
};
