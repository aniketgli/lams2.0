import { describe, expect, test } from 'bun:test';
import * as R from './schedule';

const KEYS = ['attendance', 'leave_balance'];
const body = (o: any = {}) => ({ name: 'Daily attendance', reportKey: 'attendance', frequency: 'daily', sendTime: '09:00', formats: ['pdf'], userIds: [2], roles: [], ...o });

describe('schedule rules', () => {
  test('input is checked: report, time, day, formats and recipients', () => {
    const bad = (o: any) => { try { R.parseScheduleInput(body(o), KEYS); return null; } catch (e: any) { return Object.keys(e.details ?? {}); } };
    expect(bad({ name: 'ab' })).toContain('name');
    expect(bad({ reportKey: 'nope' })).toContain('reportKey');
    expect(bad({ sendTime: '25:00' })).toContain('sendTime');
    expect(bad({ frequency: 'weekly' })).toContain('weekday');
    expect(bad({ frequency: 'weekly', weekday: 8 })).toContain('weekday');
    expect(bad({ frequency: 'monthly', monthDay: 29 })).toContain('monthDay');
    expect(bad({ frequency: 'yearly' })).toContain('frequency');
    expect(bad({ formats: [] })).toContain('formats');
    expect(bad({ formats: ['doc'] })).toContain('formats');
    expect(bad({ userIds: [], roles: [] })).toContain('recipients');
    expect(bad({ userIds: ['x'] })).toContain('recipients');
    expect(bad({ userIds: [], roles: ['boss'] })).toContain('recipients');
    const ok = R.parseScheduleInput(body({ frequency: 'weekly', weekday: 1, formats: ['csv', 'pdf', 'csv'], userIds: [2, 2, 3], roles: ['audit'] }), KEYS);
    expect(ok).toMatchObject({ frequency: 'weekly', weekday: 1, monthDay: null, formats: ['csv', 'pdf'], userIds: [2, 3], roles: ['audit'] });
  });
  test('occurrence, due time and the days a report covers', () => {
    expect(R.isoWeekday('2026-11-02')).toBe(1); expect(R.isoWeekday('2026-11-01')).toBe(7);
    const daily = { frequency: 'daily', weekday: null, monthDay: null, sendTime: '09:00', lastSlot: null, status: 'active' };
    expect(R.isDue(daily, '2026-11-02', '08:59')).toBe(false);
    expect(R.isDue(daily, '2026-11-02', '09:00')).toBe(true);
    expect(R.isDue(daily, '2026-11-02', '14:00')).toBe(true); // a late start still sends the same day
    expect(R.isDue({ ...daily, lastSlot: '2026-11-02' }, '2026-11-02', '14:00')).toBe(false);
    expect(R.isDue({ ...daily, status: 'paused' }, '2026-11-02', '14:00')).toBe(false);
    const weekly = { ...daily, frequency: 'weekly', weekday: 1 };
    expect(R.isDue(weekly, '2026-11-02', '10:00')).toBe(true); expect(R.isDue(weekly, '2026-11-03', '10:00')).toBe(false);
    const monthly = { ...daily, frequency: 'monthly', monthDay: 1 };
    expect(R.isDue(monthly, '2026-12-01', '10:00')).toBe(true); expect(R.isDue(monthly, '2026-12-02', '10:00')).toBe(false);
    expect(R.periodFor('daily', '2026-11-02')).toEqual({ from: '2026-11-01', to: '2026-11-01' });
    expect(R.periodFor('weekly', '2026-11-02')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(R.periodFor('monthly', '2026-11-01')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(R.periodFor('monthly', '2027-01-05')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(R.describeTiming({ frequency: 'weekly', weekday: 5, monthDay: null, sendTime: '17:30' })).toBe('Every Friday at 17:30 IST');
    expect(R.describeTiming({ frequency: 'monthly', weekday: null, monthDay: 1, sendTime: '09:00' })).toBe('On the 1st of every month at 09:00 IST');
    expect(R.describeTiming({ frequency: 'daily', weekday: null, monthDay: null, sendTime: '09:00' })).toBe('Every day at 09:00 IST');
  });
});
