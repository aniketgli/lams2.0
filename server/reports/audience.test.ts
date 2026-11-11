import { describe, expect, test } from 'bun:test';
import { EVERYONE_VIEWER, audienceKey, planAudience } from './audience';

describe('report audience', () => {
  test('people chosen by name get everyone', () => {
    const plan = planAudience([5], [], new Set());
    expect(plan.get(5)).toEqual({ userId: 5, viewer: EVERYONE_VIEWER, everyone: true });
  });

  test('role holders get the employees under them', () => {
    const plan = planAudience([], [
      { userId: 7, role: 'reporting_manager' },
      { userId: 8, role: 'reviewing_manager' },
      { userId: 9, role: 'general_staff' },
      { userId: 1, role: 'administrator' },
      { userId: 2, role: 'audit' },
    ], new Set(['reporting_manager', 'reviewing_manager', 'general_staff', 'administrator', 'audit']));
    expect(plan.get(7)?.viewer).toEqual({ id: 7, role: 'reporting_manager' });
    expect(plan.get(8)?.viewer).toEqual({ id: 8, role: 'reviewing_manager' });
    expect(plan.get(9)?.viewer).toEqual({ id: 9, role: 'general_staff' });
    expect(plan.get(1)?.everyone).toBe(true);
    expect(plan.get(2)?.everyone).toBe(true);
  });

  test('only the chosen roles count; the widest chosen role wins', () => {
    const holders = [{ userId: 7, role: 'general_staff' as const }, { userId: 7, role: 'reporting_manager' as const }, { userId: 7, role: 'administrator' as const }];
    expect(planAudience([], holders, new Set(['general_staff', 'reporting_manager'])).get(7)?.viewer).toEqual({ id: 7, role: 'reporting_manager' });
    expect(planAudience([], holders, new Set(['reporting_manager', 'administrator'])).get(7)?.everyone).toBe(true);
    expect(planAudience([], holders, new Set(['audit'])).size).toBe(0);
  });

  test('chosen by name and by role: the full report, once', () => {
    const plan = planAudience([7], [{ userId: 7, role: 'reporting_manager' }], new Set(['reporting_manager']));
    expect(plan.size).toBe(1);
    expect(plan.get(7)?.everyone).toBe(true);
  });

  test('one build for all full reports, one per person for teams', () => {
    const plan = planAudience([5, 6], [{ userId: 7, role: 'reporting_manager' }, { userId: 1, role: 'administrator' }], new Set(['reporting_manager', 'administrator']));
    const keys = [...plan.values()].map(audienceKey);
    expect(new Set(keys)).toEqual(new Set(['everyone', 'reporting_manager:7']));
  });
});
