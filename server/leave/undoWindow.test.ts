import { describe, expect, test } from 'bun:test';
import { withinUndoWindow } from './undoWindow';

describe('withinUndoWindow', () => {
  test('open for 10 minutes', () => {
    expect(withinUndoWindow(0)).toBe(true);
    expect(withinUndoWindow(600)).toBe(true);
    expect(withinUndoWindow(601)).toBe(false);
  });
  test('closed when the time is unknown', () => {
    expect(withinUndoWindow(null)).toBe(false);
    expect(withinUndoWindow(undefined)).toBe(false);
    expect(withinUndoWindow('x')).toBe(false);
  });
});
