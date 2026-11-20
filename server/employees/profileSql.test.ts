import { describe, expect, test } from 'bun:test';
import { PROFILE_DATA_KEYS } from './fields';
import { PROFILE_FIELDS, placementValues, profileJsonSql, profileObject, profileValues } from './profileSql';

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
    // worked out when reading, never stored
    expect('valid_until_date' in v).toBe(false);
    expect('retirement_date' in v).toBe(false);
  });

  test('derived values come from other data', () => {
    const sql = profileJsonSql('p');
    expect(sql).toContain('vu.valid_upto');
    expect(sql).toContain('LAST_DAY(DATE_SUB(DATE_ADD(p.dob, INTERVAL 60 YEAR)');
    expect(sql).toContain("COALESCE(p.pi_name, IF(");
    expect(sql).toContain('COALESCE(p.training_course_name, p.msc_stream_name)');
  });

  test('placement goes to the column of the right master', () => {
    expect(placementValues('permanent', { department: 'IT Cell', departmentIsOrgUnit: true, designation: 'TA' }))
      .toMatchObject({ org_unit_name: 'IT Cell', project_name: null, designation_name: 'TA', training_course_name: null, msc_stream_name: null });
    expect(placementValues('researcher', { department: 'Tiger', departmentIsOrgUnit: false })).toMatchObject({ org_unit_name: null, project_name: 'Tiger' });
    expect(placementValues('bsc_msc_student', { courseProgram: 'WS', courseBatch: 'WS 26' }))
      .toMatchObject({ msc_stream_name: 'WS', msc_batch_name: 'WS 26', training_course_name: null, trainee_batch_name: null, org_unit_name: null });
    expect(placementValues('diploma_trainee', { courseProgram: 'Dip', courseBatch: 'D26' }))
      .toMatchObject({ training_course_name: 'Dip', trainee_batch_name: 'D26', msc_stream_name: null });
    expect(placementValues('permanent', { department: '  ', designation: '' })).toMatchObject({ org_unit_name: null, project_name: null, designation_name: null });
  });

  test('reading drops empty keys, from text or an object', () => {
    expect(profileObject('{"gender":"Male","piName":null,"x":""}')).toEqual({ gender: 'Male' });
    expect(profileObject({ isPwd: true, dob: null })).toEqual({ isPwd: true });
    expect(profileObject('not json')).toEqual({});
  });
});
