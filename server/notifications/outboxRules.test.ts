import { describe, expect, test } from 'bun:test';
import { MAX_ATTEMPTS, afterFailure, canResend, isPermanent } from './outboxRules';

describe('outbox rules', () => {
  test('retries after 1, 5, 15 and 60 minutes, then fails', () => {
    expect([1, 2, 3, 4].map((n) => afterFailure(n).retryInMinutes)).toEqual([1, 5, 15, 60]);
    expect(afterFailure(MAX_ATTEMPTS)).toEqual({ status: 'failed', retryInMinutes: null });
  });
  test('a wrong address or refused sign-in is not retried', () => {
    expect(isPermanent('550 5.1.1 <x@wii.gov.in>: Recipient address rejected')).toBe(true);
    expect(isPermanent('535 5.7.8 Authentication credentials invalid')).toBe(true);
    expect(isPermanent('connect ETIMEDOUT 10.0.0.5:587')).toBe(false);
    expect(isPermanent('421 4.7.0 Try again later')).toBe(false);
  });
  test('only a kept mail that did not go out can be sent again', () => {
    expect(canResend({ status: 'failed', hasBody: true })).toBe(true);
    expect(canResend({ status: 'not_sent', hasBody: true })).toBe(true);
    expect(canResend({ status: 'sent', hasBody: true })).toBe(false);
    expect(canResend({ status: 'failed', hasBody: false })).toBe(false);
  });
});
