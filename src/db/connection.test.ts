import { describe, expect, test } from 'bun:test';
import { databaseTarget, describeDatabase } from './connection';

const expected = { host: 'db.example.invalid', port: 3306, user: 'app_user', password: 'Ex@mple#9', database: 'lams2_db' };

describe('databaseTarget', () => {
  test('reads DATABASE_URL with an encoded password', () => {
    expect(databaseTarget({ DATABASE_URL: 'mysql://app_user:Ex%40mple%239@db.example.invalid:3306/lams2_db' })).toEqual(expected);
  });

  test('an unencoded @ in the password still works', () => {
    expect(databaseTarget({ DATABASE_URL: 'mysql://app_user:Ex@mple%239@db.example.invalid/lams2_db' })).toEqual(expected);
  });

  test('separate DB_* settings need no encoding and win over DATABASE_URL', () => {
    expect(databaseTarget({
      DATABASE_URL: 'mysql://other:x@localhost/other',
      DB_HOST: 'db.example.invalid', DB_USER: 'app_user', DB_PASSWORD: 'Ex@mple#9', DB_NAME: 'lams2_db',
    })).toEqual(expected);
  });

  test('the older LAMS_PROD_DB_URL name is still read', () => {
    expect(databaseTarget({ LAMS_PROD_DB_URL: 'mysql://app_user:Ex%40mple%239@db.example.invalid:3306/lams2_db' })).toEqual(expected);
  });

  test('missing or empty settings give a clear error', () => {
    expect(() => databaseTarget({})).toThrow('not configured');
    expect(() => databaseTarget({ DATABASE_URL: '' })).toThrow('not configured');
    expect(() => databaseTarget({ DB_HOST: 'db' })).toThrow('DB_USER and DB_NAME');
    expect(() => databaseTarget({ DATABASE_URL: 'mysql://db.example.invalid/lams2_db' })).toThrow('user, host and database');
  });

  test('the description never contains the password', () => {
    expect(describeDatabase(expected)).not.toContain('Ex@mple');
  });
});
