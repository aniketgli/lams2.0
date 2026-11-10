import { describe, expect, test } from 'bun:test';
import { fittedWidths } from './Table';

describe('fittedWidths', () => {
  test('widths that fit are kept', () => {
    expect(fittedWidths(['20%', '30%', undefined], 64)).toEqual(['20%', '30%', undefined]);
  });
  test('percentages that would overflow with Sr. No. are scaled down', () => {
    const out = fittedWidths(['15%', '14%', '9%', '8%', '12%', '9%', '13%', '11%', '16%'], 64);
    const total = out.reduce((sum, w) => sum + parseFloat(w!), 0);
    expect(total).toBeLessThanOrEqual(92.0001); // 100% minus 64px of 800px
  });
  test('pixel columns are kept as they are', () => {
    expect(fittedWidths(['150px', '60%', '60%'], 0)[0]).toBe('150px');
  });
});
