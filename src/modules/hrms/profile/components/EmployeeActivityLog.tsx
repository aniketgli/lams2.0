import React from 'react';
import { ActivityLogPanel, ActivitySource } from '../../../../shared/components/ActivityLogPanel';
import { auditorApi } from '../employeeApi';

/**
 * Auditor: who did what to employee records — profiles created, changed,
 * deactivated or deleted, roles changed, passwords reset, photos changed and
 * data downloaded.
 */
const EMPLOYEE_SOURCE: ActivitySource = {
  title: 'Employee activity log',
  recordLabel: 'Employee / record',
  searchPlaceholder: 'Employee, biometric ID, done by, reason…',
  areas: [
    { value: 'employee', label: 'Employee profile' },
    { value: 'user_roles', label: 'Module roles' },
    { value: 'employee_password', label: 'Password' },
    { value: 'employee_photo', label: 'Profile photo' },
    { value: 'employee_export', label: 'Data download' },
  ],
  list: auditorApi.activity,
  downloadCsv: auditorApi.downloadActivity,
  forPdf: auditorApi.activityForPdf,
};

export const EmployeeActivityLog: React.FC<{ toolbarStart?: React.ReactNode }> = ({ toolbarStart }) => (
  <ActivityLogPanel source={EMPLOYEE_SOURCE} toolbarStart={toolbarStart} />
);
