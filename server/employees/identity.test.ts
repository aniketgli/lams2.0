import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Validator } from '../lib/validate';
import {
  aadhaarProblem, accountKey, decryptValue, encryptValue, identityAudit, identityHash, identityView, parseIdentity, storeIdentity, verhoeffValid,
} from './identity';
import { columnsFor } from './bulkImportRules';

// A number with a valid Verhoeff check digit (not a real person's).
const AADHAAR = '234123412346';

describe('employee identity details', () => {
  const saved = process.env.SETTINGS_ENCRYPTION_KEY;
  beforeAll(() => { process.env.SETTINGS_ENCRYPTION_KEY = 'test-key-at-least-16-characters'; });
  afterAll(() => { if (saved === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY; else process.env.SETTINGS_ENCRYPTION_KEY = saved; });

  test('Aadhaar format and check digit', () => {
    expect(verhoeffValid(AADHAAR)).toBe(true);
    expect(aadhaarProblem('2341 2341 2346')).toBeNull();
    expect(aadhaarProblem('234123412345')).toContain('check digit');
    expect(aadhaarProblem('123412341234')).toContain('start with 0 or 1');
    expect(aadhaarProblem('12345')).toContain('12-digit');
    expect(aadhaarProblem('2.34123E+11')).toContain('spreadsheet');
  });

  test('form fields: formats, bank details all or none, none for M.Sc students', () => {
    const ok = new Validator({ aadhaarNumber: '2341-2341-2346', panNumber: 'abcde1234f', bankName: ' State  Bank ', bankIfsc: 'sbin0001234', bankAccountNumber: '0012 3456 789' });
    expect(parseIdentity(ok, 'contractual')).toEqual({ aadhaar: AADHAAR, pan: 'ABCDE1234F', bankName: 'State Bank', ifsc: 'SBIN0001234', account: '00123456789' });
    expect(ok.errors).toEqual({});

    const partial = new Validator({ bankName: 'SBI', panNumber: 'ABC' });
    parseIdentity(partial, 'permanent');
    expect(Object.keys(partial.errors).sort()).toEqual(['bankAccountNumber', 'bankIfsc', 'panNumber']);

    const msc = new Validator({ aadhaarNumber: AADHAAR, panNumber: 'bad' });
    expect(parseIdentity(msc, 'bsc_msc_student')).toEqual({ aadhaar: AADHAAR, pan: null, bankName: null, ifsc: null, account: null });
    expect(msc.errors).toEqual({});
  });

  test('stored encrypted, shown masked unless full', () => {
    const data: Record<string, unknown> = {};
    const keys = storeIdentity(data, { aadhaar: AADHAAR, pan: 'ABCDE1234F', bankName: 'SBI', ifsc: 'SBIN0001234', account: '123456789' }, {}, 'permanent');
    expect(JSON.stringify(data)).not.toContain(AADHAAR);
    expect(JSON.stringify(data)).not.toContain('123456789');
    expect(keys.aadhaarHash).toBe(identityHash('aadhaar', AADHAAR));
    expect(keys.accountHash).toBe(identityHash('account', accountKey('SBIN0001234', '123456789')));
    expect(identityView(data, false)).toEqual({ aadhaarNumber: 'XXXX XXXX 2346', panNumber: 'ABCDE1234F', bankName: 'SBI', bankIfsc: 'SBIN0001234', bankAccountNumber: 'XXXXXX6789' });
    expect(identityView(data, true).aadhaarNumber).toBe(AADHAAR);
    expect(identityView(data, true).bankAccountNumber).toBe('123456789');
    expect(String(identityAudit(data).aadhaar)).toStartWith('XXXX XXXX 2346 #');

    // Saving the same number again keeps the stored cipher text.
    const again: Record<string, unknown> = {};
    storeIdentity(again, { aadhaar: AADHAAR, pan: null, bankName: null, ifsc: null, account: null }, data, 'permanent');
    expect(again.aadhaarEnc).toBe(data.aadhaarEnc);
    expect(again.bankAccountEnc).toBeUndefined();
  });

  test('a leading-zero account at the same bank is the same account', () => {
    expect(accountKey('SBIN0001234', '000123')).toBe(accountKey('SBIN0009999', '123'));
    expect(accountKey('HDFC0001234', '123')).not.toBe(accountKey('SBIN0001234', '123'));
  });

  test('no key: nothing is encrypted and the message says what to set', () => {
    const before = process.env.SETTINGS_ENCRYPTION_KEY;
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    expect(() => encryptValue('x')).toThrow('SETTINGS_ENCRYPTION_KEY');
    process.env.SETTINGS_ENCRYPTION_KEY = before;
    expect(decryptValue(encryptValue('hello'))).toBe('hello');
  });

  test('import templates: Aadhaar for all, bank details except M.Sc students', () => {
    const headers = (l: Parameters<typeof columnsFor>[0]) => columnsFor(l).map((c) => c.header);
    expect(headers('intern')).toEqual(expect.arrayContaining(['Aadhaar', 'PAN', 'Bank_Name', 'IFSC', 'Account_Number']));
    expect(headers('bsc_msc_student')).toContain('Aadhaar');
    expect(headers('bsc_msc_student')).not.toContain('PAN');
    expect(columnsFor('permanent').find((c) => c.header === 'Aadhaar')?.required).toBe(true);
  });
});
