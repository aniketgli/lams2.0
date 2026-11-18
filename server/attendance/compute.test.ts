import { describe, expect, test } from 'bun:test';
import { employeeCodeVariants, normalizeEmployeeCode } from './compute';

describe('employee codes from the punch table', () => {
  test('eSSL 5-digit codes match the 4-digit biometric ID', () => {
    expect(normalizeEmployeeCode('02477')).toBe('2477');
    expect(normalizeEmployeeCode('0128')).toBe('0128');
    expect(normalizeEmployeeCode('00128')).toBe('0128');
    expect(employeeCodeVariants('2477')).toContain('02477');
    expect(employeeCodeVariants('0128')).toEqual(expect.arrayContaining(['0128', '128', '00128']));
    expect(employeeCodeVariants('0128')).toHaveLength(8); // 128, then 0128 … 0000000128
    expect(employeeCodeVariants('EMP1')).toEqual(['EMP1']);
  });
});
