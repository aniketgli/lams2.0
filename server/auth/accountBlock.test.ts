import { describe, expect, test } from 'bun:test';
import { todayInIndia } from '../lib/validate';

import { accountBlockReason } from './accountBlock';

const today = todayInIndia();
const day = (offset: number): string => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

describe('accountBlockReason (who may sign in)', () => {
  test('active and valid up to a future date or today may sign in', () => {
    expect(accountBlockReason({ status: 'active', validUpto: day(30), isSystem: false })).toBeNull();
    expect(accountBlockReason({ status: 'active', validUpto: today, isSystem: false })).toBeNull();
  });
  test('validity that ended yesterday is blocked', () => {
    expect(accountBlockReason({ status: 'active', validUpto: day(-1), isSystem: false })).toContain('expired');
  });
  test('no validity date is blocked for ordinary users', () => {
    expect(accountBlockReason({ status: 'active', validUpto: null, isSystem: false })).toContain('not configured');
  });
  test('inactive, expired and unknown statuses are blocked, whatever the case', () => {
    for (const status of ['inactive', 'INACTIVE', 'expired', 'suspended', '']) {
      expect(accountBlockReason({ status, validUpto: day(30), isSystem: false })).not.toBeNull();
    }
    expect(accountBlockReason({ status: 'ACTIVE', validUpto: day(30), isSystem: false })).toBeNull();
  });
  test('a deactivated system account is blocked, an active one needs no date', () => {
    expect(accountBlockReason({ status: 'inactive', validUpto: null, isSystem: true })).not.toBeNull();
    expect(accountBlockReason({ status: 'active', validUpto: null, isSystem: true })).toBeNull();
  });
});
