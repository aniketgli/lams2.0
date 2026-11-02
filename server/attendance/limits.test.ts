import { describe, expect, test } from 'bun:test';
import { MAX_EMPLOYEE_DAYS, sizeProblem } from './limits';

describe('sizeProblem', () => {
  test('one employee may ask for a whole year', () => {
    expect(sizeProblem(1, 366)).toBeNull();
  });
  test('several employees are limited to 93 days', () => {
    expect(sizeProblem(2, 93)).toBeNull();
    expect(sizeProblem(2, 94)).toContain('93');
  });
  test('the total employee-days is capped', () => {
    expect(sizeProblem(5000, 20)).toBeNull();
    expect(sizeProblem(5000, 21)).toContain('at most');
    expect(MAX_EMPLOYEE_DAYS).toBe(100_000);
  });
  test('nobody in scope is fine', () => {
    expect(sizeProblem(0, 30)).toBeNull();
  });
});
