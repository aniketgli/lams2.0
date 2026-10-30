export interface HolidayItem {
  id: string;
  name: string;
  hindiName?: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  type: 'gazetted' | 'restricted' | 'local';
  category: 'National' | 'Religious' | 'Cultural' | 'Institutional' | 'International' | 'Other';
  description: string;
  year: number;
  month: number; // 1-12
  isLongWeekend?: boolean;
}

// Holidays live in the database (table `holidays`, migration 20261030_holidays.sql) and are
// loaded through AppContext / holidayApi. There is no built-in list any more.

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
