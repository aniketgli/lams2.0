import { describe, expect, test } from 'bun:test';
import { PROFILE_DATA_KEYS } from './fields';
import { PROFILE_FIELDS, profileJsonSql, profileObject, profileValues } from './profileSql';

describe('profile columns', () => {
  test('every form key has a column or is worked out when reading', () => {
    const sql = profileJsonSql('p');
    for (const key of PROFILE_DATA_KEYS) expect(sql).toContain(`'${key}'`);
    expect(sql).toContain("CAST('true' AS JSON)");
    expect(new Set(PROFILE_FIELDS.map((f) => f.column)).size).toBe(PROFILE_FIELDS.length);
  });

  test('object → column values', () => {
    const v = profileValues({ gender: 'Male', dob: '1990-01-02', isPwd: true, reportingManagerId: '12', piName: '', validUntilDate: 'bad' });
    expect(v.gender).toBe('Male');
    expect(v.dob).toBe('1990-01-02');
    expect(v.is_pwd).toBe(1);
    expect(v.is_on_probation).toBe(0);
    expect(v.reporting_manager_id).toBe(12);
    expect(v.pi_name).toBeNull();
    expect(v.valid_until_date).toBeNull();
  });

  test('reading drops empty keys, from text or an object', () => {
    expect(profileObject('{"gender":"Male","piName":null,"x":""}')).toEqual({ gender: 'Male' });
    expect(profileObject({ isPwd: true, dob: null })).toEqual({ isPwd: true });
    expect(profileObject('not json')).toEqual({});
  });
});
