import { describe, expect, test } from 'bun:test';
import { databaseTarget, describeDatabase } from './connection';

const expected = { host: '172.16.30.250', port: 3306, user: 'lams2_app', password: 'Pa@ss#1', database: 'lams2_db' };

describe('databaseTarget', () => {
  test('reads DATABASE_URL with an encoded password', () => {
    expect(databaseTarget({ DATABASE_URL: 'mysql://lams2_app:Pa%40ss%231@172.16.30.250:3306/lams2_db' })).toEqual(expected);
  });

  test('an unencoded @ in the password still works', () => {
    expect(databaseTarget({ DATABASE_URL: 'mysql://lams2_app:Pa@ss%231@172.16.30.250/lams2_db' })).toEqual(expected);
  });

  test('separate DB_* settings need no encoding and win over DATABASE_URL', () => {
    expect(databaseTarget({
      DATABASE_URL: 'mysql://other:x@localhost/other',
      DB_HOST: '172.16.30.250', DB_USER: 'lams2_app', DB_PASSWORD: 'Pa@ss#1', DB_NAME: 'lams2_db',
    })).toEqual(expected);
  });

  test('the older LAMS_PROD_DB_URL name is still read', () => {
    expect(databaseTarget({ LAMS_PROD_DB_URL: 'mysql://lams2_app:Pa%40ss%231@172.16.30.250:3306/lams2_db' })).toEqual(expected);
  });

  test('missing or empty settings give a clear error', () => {
    expect(() => databaseTarget({})).toThrow('not configured');
    expect(() => databaseTarget({ DATABASE_URL: '' })).toThrow('not configured');
    expect(() => databaseTarget({ DB_HOST: 'db' })).toThrow('DB_USER and DB_NAME');
    expect(() => databaseTarget({ DATABASE_URL: 'mysql://172.16.30.250/lams2_db' })).toThrow('user, host and database');
  });

  test('the description never contains the password', () => {
    expect(describeDatabase(expected)).not.toContain('Pa@ss');
  });
});
