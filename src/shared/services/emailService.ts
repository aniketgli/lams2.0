import { EmailConfig, EmailNotificationLog, EmailCategory, EmailDeliveryStatus, OrgBranding } from '../../types';

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enableEmailNotifications: true,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  fromName: 'Wildlife Institute of India - E-Governance Notifications',
  fromEmail: 'notifications@wii.gov.in',
  adminCcEmail: 'admin@wii.gov.in',
  notifyOnUserCreation: true,
  notifyOnLeaveApplication: true,
  notifyOnLeaveApproval: true,
  notifyOnAttendanceRegularization: true,
  notifyOnOutdoorDuty: true,
  notifyOnTransfer: true,
  notifyOnPasswordReset: true
};

export interface HtmlEmailOptions {
  title: string;
  preheader?: string;
  badgeText: string;
  badgeBg?: string;
  badgeColor?: string;
  recipientName: string;
  greeting?: string;
  referenceNo?: string;
  leadParagraph: string;
  detailsTable?: { label: string; value: string | number }[];
  remarksBox?: { title?: string; text: string; alertType?: 'info' | 'warning' | 'success' | 'danger' };
  actionLink?: { label: string; url: string };
  org?: Partial<OrgBranding>;
}

/**
 * Generates an official, highly legible, accessible HTML email template
 * compatible with Gmail, Outlook, Thunderbird, and webmail clients.
 */
export const wrapOfficialEmailHtml = (options: HtmlEmailOptions): string => {
  const orgName = options.org?.orgName || 'Wildlife Institute of India (WII)';
  const orgHindi = options.org?.orgHindiName || 'भारतीय वन्यजीव संस्थान';
  const orgAddress = options.org?.address || 'Post Box #18, Chandrabani, Dehradun 248001, Uttarakhand, India';
  const themeColor = options.badgeBg || '#065f46'; // Forest Green
  const badgeTextColor = options.badgeColor || '#ffffff';

  const rowsHtml = (options.detailsTable || [])
    .map(
      (row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 10px 14px; font-weight: 600; color: #334155; font-size: 13px; width: 38%; border-bottom: 1px solid #e2e8f0;">${row.label}</td>
        <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${row.value}</td>
      </tr>`
    )
    .join('');

  let remarksHtml = '';
  if (options.remarksBox && options.remarksBox.text) {
    let boxBorder = '#cbd5e1';
    let boxBg = '#f1f5f9';
    let boxText = '#1e293b';

    if (options.remarksBox.alertType === 'success') {
      boxBorder = '#86efac';
      boxBg = '#f0fdf4';
      boxText = '#14532d';
    } else if (options.remarksBox.alertType === 'warning') {
      boxBorder = '#fde047';
      boxBg = '#fefce8';
      boxText = '#713f12';
    } else if (options.remarksBox.alertType === 'danger') {
      boxBorder = '#fca5a5';
      boxBg = '#fef2f2';
      boxText = '#7f1d1d';
    }

    remarksHtml = `
      <div style="margin-top: 18px; margin-bottom: 20px; padding: 14px 16px; background-color: ${boxBg}; border-left: 4px solid ${boxBorder}; border-radius: 4px;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: ${boxText}; text-transform: uppercase; letter-spacing: 0.5px;">${options.remarksBox.title || 'Official Remarks / Notes'}:</p>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${boxText}; white-space: pre-wrap;">${options.remarksBox.text}</p>
      </div>`;
  }

  let actionHtml = '';
  if (options.actionLink) {
    actionHtml = `
      <div style="margin-top: 24px; margin-bottom: 16px; text-align: center;">
        <a href="${options.actionLink.url}" style="display: inline-block; background-color: #065f46; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${options.actionLink.label} &rarr;
        </a>
      </div>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Container Table -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Government / Institution Crest Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 20px 24px; border-bottom: 3px solid #f59e0b; color: #ffffff;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a7f3d0; margin-bottom: 2px;">Govt. of India &bull; MoEF&CC</div>
                    <div style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px;">${orgName}</div>
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 1px;">${orgHindi}</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      E-Governance
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sub-Header Status Strip -->
          <tr>
            <td style="background-color: #f8fafc; padding: 12px 24px; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: ${themeColor}; color: ${badgeTextColor}; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${options.badgeText}
                    </span>
                  </td>
                  <td align="right" style="font-size: 12px; color: #64748b;">
                    ${options.referenceNo ? `Ref: <strong>${options.referenceNo}</strong>` : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Email Body -->
          <tr>
            <td style="padding: 24px 28px;">
              <h2 style="margin: 0 0 14px 0; color: #0f172a; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">
                ${options.title}
              </h2>
              
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Dear <strong>${options.recipientName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                ${options.leadParagraph}
              </p>

              <!-- Data Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
                ${rowsHtml}
              </table>

              ${remarksHtml}
              ${actionHtml}

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                  Regards,<br>
                  <strong style="color: #1e293b;">E-Governance Administration &amp; Establishment Cell</strong><br>
                  ${orgName}
                </p>
              </div>
            </td>
          </tr>

          <!-- Institutional Disclaimer Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #94a3b8;">
                ${orgAddress} &bull; Web: <a href="https://wii.gov.in" style="color: #065f46; text-decoration: none;">wii.gov.in</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                This is an automated system notification dispatched directly to your registered official email address. Please do not reply directly to this mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// --- EMAIL BUILDERS FOR SPECIFIC WORKFLOWS ---

export const buildUserWelcomeEmail = (newUser: {
  name: string;
  email: string;
  designation: string;
  department: string;
  biometricId?: string;
  reportingManagerName?: string;
  tempPassword?: string;
}) => {
  const subject = `Welcome to Wildlife Institute of India E-Governance Portal - Account Registration (${newUser.name})`;
  const html = wrapOfficialEmailHtml({
    title: 'New Official Account Provisioned',
    badgeText: 'Account Created',
    badgeBg: '#059669',
    recipientName: newUser.name,
    referenceNo: `USR-${Date.now().toString().slice(-5)}`,
    leadParagraph: `Your official employee account on the Wildlife Institute of India (WII) E-Governance Leave & Attendance Management System has been successfully created and activated.`,
    detailsTable: [
      { label: 'Employee Name', value: newUser.name },
      { label: 'Registered Email', value: newUser.email },
      { label: 'Designation', value: newUser.designation },
      { label: 'Department / Unit', value: newUser.department },
      { label: 'Biometric Punch ID', value: newUser.biometricId || 'Assigned automatically' },
      { label: 'Reporting Officer (L1)', value: newUser.reportingManagerName || 'Under Assignment' },
      { label: 'Initial Access Password', value: newUser.tempPassword ? `<code>${newUser.tempPassword}</code>` : 'Use your institutional single-sign-on or default credentials' }
    ],
    remarksBox: {
      title: 'Action Required',
      text: 'Please log in to the portal at your earliest convenience to complete your profile verification, configure your notification preferences, and change your temporary password.',
      alertType: 'info'
    }
  });

  const text = `Dear ${newUser.name},\n\nYour account on the WII E-Governance Portal has been created.\nDesignation: ${newUser.designation}\nDepartment: ${newUser.department}\nBiometric ID: ${newUser.biometricId || 'N/A'}\nReporting Manager: ${newUser.reportingManagerName || 'N/A'}\n\nPlease login to verify your records.`;

  return { subject, html, text };
};

export const buildSupervisorNewReporteeEmail = (arg1: any, arg2?: any) => {
  let managerName = '';
  let employeeName = '';
  let designation = '';
  let department = '';
  if (arg2) {
    managerName = arg1.name;
    employeeName = arg2.name;
    designation = arg2.designation;
    department = arg2.department;
  } else {
    managerName = arg1.managerName || arg1.name;
    employeeName = arg1.employeeName || arg1.name;
    designation = arg1.designation || '';
    department = arg1.department || '';
  }

  const subject = `Notice: New Direct Reportee Assigned (${employeeName} - ${designation})`;
  const html = wrapOfficialEmailHtml({
    title: 'New Reportee Assigned to Your Hierarchy',
    badgeText: 'Hierarchy Assignment',
    badgeBg: '#2563eb',
    recipientName: managerName,
    leadParagraph: `A new official reportee has been placed under your supervision as Reporting Officer (Level 1) in the WII establishment roster.`,
    detailsTable: [
      { label: 'Employee Name', value: employeeName },
      { label: 'Designation', value: designation },
      { label: 'Department / Unit', value: department },
      { label: 'Assigned Role', value: 'Reporting Officer (L1 Approval Authority)' }
    ],
    remarksBox: {
      title: 'Workflow Scope',
      text: `You will receive all leave requests, manual attendance regularizations, and outdoor duty applications submitted by ${employeeName} for your scrutiny and Level-1 approval.`,
      alertType: 'info'
    }
  });

  const text = `Dear ${managerName},\n\n${employeeName} (${designation}, ${department}) has been assigned as your direct reportee. You will be responsible for their Level-1 approvals.`;

  return { subject, html, text };
};

export const buildLeaveAppliedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    const isManager = Boolean(arg4);
    p = {
      applicantName: arg2,
      recipientName: isManager ? arg3 : arg2,
      isManager,
      leaveType: rec.leaveTypeName || rec.leaveType || 'Official Leave',
      startDate: rec.startDate,
      endDate: rec.endDate,
      daysCount: rec.daysCount,
      reason: rec.reason || '',
      requiresLevel2: Boolean(rec.requiresLevel2),
      leaveId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = p.isManager
    ? `Action Required: Leave Application from ${p.applicantName} (${p.leaveType}, ${p.daysCount} Day${p.daysCount > 1 ? 's' : ''})`
    : `Leave Application Submitted: ${p.leaveType} (${p.daysCount} Day${p.daysCount > 1 ? 's' : ''}) [Ref: ${p.leaveId}]`;

  const html = wrapOfficialEmailHtml({
    title: p.isManager ? 'Leave Approval Request Pending' : 'Leave Application Registered',
    badgeText: p.isManager ? 'Action Required' : 'Application Received',
    badgeBg: p.isManager ? '#d97706' : '#2563eb',
    recipientName: p.recipientName,
    referenceNo: p.leaveId,
    leadParagraph: p.isManager
      ? `A new leave requisition has been submitted by <strong>${p.applicantName}</strong> and is currently awaiting your review as Reporting Officer (Level 1).`
      : `Your leave application for <strong>${p.leaveType}</strong> has been submitted successfully and routed to your Reporting Officer for review.`,
    detailsTable: [
      { label: 'Applicant Employee', value: p.applicantName },
      { label: 'Leave Type / Nature', value: p.leaveType },
      { label: 'Start Date', value: p.startDate },
      { label: 'End Date', value: p.endDate },
      { label: 'Total Duration', value: `${p.daysCount} calendar day(s)` },
      { label: 'Approval Workflow', value: p.requiresLevel2 ? 'Requires 2 Levels (Reporting Officer + HoD/Reviewing Officer)' : 'Level-1 Direct Sanction' }
    ],
    remarksBox: {
      title: 'Reason Stated by Applicant',
      text: p.reason || 'No specific reason entered.',
      alertType: 'info'
    }
  });

  const text = `Leave Application ${p.leaveId}\nApplicant: ${p.applicantName}\nType: ${p.leaveType}\nDates: ${p.startDate} to ${p.endDate} (${p.daysCount} days)\nReason: ${p.reason}`;

  return { subject, html, text };
};

export const buildLeaveForwardedL2Email = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    p = {
      applicantName: arg2,
      recommenderName: arg3,
      reviewerName: arg4,
      leaveType: rec.leaveTypeName || rec.leaveType || 'Leave Requisition',
      startDate: rec.startDate,
      endDate: rec.endDate,
      daysCount: rec.daysCount,
      reason: rec.reason || '',
      l1Comments: rec.level1Approval?.comments,
      leaveId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = `Action Required (Level 2): Leave Recommendation for ${p.applicantName} [Ref: ${p.leaveId}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Leave Application Forwarded for Final Sanction',
    badgeText: 'Level-2 Review (HoD)',
    badgeBg: '#7c3aed',
    recipientName: p.reviewerName,
    referenceNo: p.leaveId,
    leadParagraph: `Reporting Officer <strong>${p.recommenderName}</strong> has granted Level-1 recommendation for <strong>${p.applicantName}</strong>. As this application spans ${p.daysCount} days, it is forwarded for your final authorization as Reviewing Officer / Head of Department.`,
    detailsTable: [
      { label: 'Applicant Employee', value: p.applicantName },
      { label: 'Leave Nature', value: p.leaveType },
      { label: 'Leave Period', value: `${p.startDate} to ${p.endDate} (${p.daysCount} days)` },
      { label: 'Level-1 Recommender', value: p.recommenderName },
      { label: 'Status', value: 'Pending Level-2 Final Approval' }
    ],
    remarksBox: {
      title: 'Level-1 Endorsement Comments',
      text: p.l1Comments || 'Recommended for sanction.',
      alertType: 'success'
    }
  });

  const text = `Level-2 Action Required: Leave for ${p.applicantName} (${p.leaveType}, ${p.daysCount} days) recommended by ${p.recommenderName}.\nApplicant Reason: ${p.reason}\nL1 Comments: ${p.l1Comments || 'N/A'}`;

  return { subject, html, text };
};

export const buildLeaveApprovedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    p = {
      applicantName: arg2,
      approverName: arg3,
      leaveType: rec.leaveTypeName || rec.leaveType || 'Leave Sanction',
      startDate: rec.startDate,
      endDate: rec.endDate,
      daysCount: rec.daysCount,
      comments: arg4 || rec.level1Approval?.comments || rec.level2Approval?.comments,
      leaveId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = `Sanction Order: Leave Approved for ${p.applicantName} (${p.leaveType}) [Ref: ${p.leaveId}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Official Leave Sanction Order',
    badgeText: 'Sanctioned / Approved',
    badgeBg: '#059669',
    recipientName: p.applicantName,
    referenceNo: p.leaveId,
    leadParagraph: `Your application for <strong>${p.leaveType}</strong> for the period from <strong>${p.startDate}</strong> to <strong>${p.endDate}</strong> (${p.daysCount} days) has been formally <strong>SANCTIONED</strong> by the Competent Authority.`,
    detailsTable: [
      { label: 'Sanction Reference', value: p.leaveId },
      { label: 'Sanctioned Leave Type', value: p.leaveType },
      { label: 'Commencement Date', value: p.startDate },
      { label: 'Conclusion Date', value: p.endDate },
      { label: 'Total Number of Days', value: `${p.daysCount} day(s)` },
      { label: 'Sanctioning Authority', value: p.approverName },
      { label: 'Attendance Ledger', value: 'Attendance calendar auto-updated to "On Approved Leave"' }
    ],
    remarksBox: {
      title: 'Approver Order Remarks',
      text: p.comments || 'Leave sanctioned as per CCS Leave Rules.',
      alertType: 'success'
    }
  });

  const text = `SANCTION ORDER: Your leave (${p.leaveType}, ${p.daysCount} days from ${p.startDate} to ${p.endDate}) has been APPROVED by ${p.approverName}. Ref: ${p.leaveId}`;

  return { subject, html, text };
};

export const buildLeaveRejectedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    p = {
      applicantName: arg2,
      rejectorName: arg3,
      leaveType: rec.leaveTypeName || rec.leaveType || 'Leave Application',
      startDate: rec.startDate,
      endDate: rec.endDate,
      daysCount: rec.daysCount,
      comments: arg4,
      leaveId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = `Notice: Leave Application Not Sanctioned (${p.leaveType}) [Ref: ${p.leaveId}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Leave Application Decision Notice',
    badgeText: 'Not Sanctioned / Rejected',
    badgeBg: '#dc2626',
    recipientName: p.applicantName,
    referenceNo: p.leaveId,
    leadParagraph: `We regret to inform you that your leave request for <strong>${p.leaveType}</strong> (${p.startDate} to ${p.endDate}) could not be sanctioned by the reviewing officer.`,
    detailsTable: [
      { label: 'Reference Number', value: p.leaveId },
      { label: 'Requested Nature', value: p.leaveType },
      { label: 'Dates Requested', value: `${p.startDate} to ${p.endDate} (${p.daysCount} days)` },
      { label: 'Reviewing Authority', value: p.rejectorName },
      { label: 'Leave Quota Impact', value: 'Debited pending balance has been restored to your leave account' }
    ],
    remarksBox: {
      title: 'Officer Reason / Grounds for Rejection',
      text: p.comments || 'Due to urgent administrative/operational exigencies of institutional duties.',
      alertType: 'danger'
    }
  });

  const text = `NOTICE: Your leave application (${p.leaveType}, ${p.daysCount} days) was REJECTED by ${p.rejectorName}.\nReason: ${p.comments || 'Administrative requirements'}.\nPending quota restored.`;

  return { subject, html, text };
};

export const buildManualAttendanceAppliedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    const isManager = Boolean(arg4);
    p = {
      applicantName: arg2,
      recipientName: isManager ? arg3 : arg2,
      isManager,
      attendanceDate: rec.date,
      inTime: rec.requestedInTime || rec.requestedClockIn || '--:--',
      outTime: rec.requestedOutTime || rec.requestedClockOut || '--:--',
      reasonCategory: rec.reasonCategory || rec.reason,
      reason: rec.reason || '',
      requestId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = p.isManager
    ? `Action Required: Attendance Regularization Request for ${p.applicantName} (${p.attendanceDate})`
    : `Attendance Regularization Submitted: ${p.attendanceDate} [Ref: ${p.requestId}]`;

  const html = wrapOfficialEmailHtml({
    title: p.isManager ? 'Manual Punch Regularization Pending' : 'Attendance Regularization Submitted',
    badgeText: p.isManager ? 'Action Required' : 'Under Review',
    badgeBg: p.isManager ? '#d97706' : '#2563eb',
    recipientName: p.recipientName,
    referenceNo: p.requestId,
    leadParagraph: p.isManager
      ? `<strong>${p.applicantName}</strong> has applied for manual attendance regularization for the date <strong>${p.attendanceDate}</strong>, requesting your approval as Reporting Officer.`
      : `Your request for manual punch regularization for <strong>${p.attendanceDate}</strong> has been logged and forwarded to your Reporting Officer for verification.`,
    detailsTable: [
      { label: 'Employee Name', value: p.applicantName },
      { label: 'Target Date', value: p.attendanceDate },
      { label: 'Requested In-Time', value: p.inTime },
      { label: 'Requested Out-Time', value: p.outTime },
      { label: 'Reason Category', value: p.reasonCategory || 'Forget to punch' }
    ],
    remarksBox: {
      title: 'Detailed Justification',
      text: p.reason,
      alertType: 'info'
    }
  });

  const text = `Manual Attendance Regularization: ${p.applicantName} for ${p.attendanceDate} (${p.inTime} - ${p.outTime}). Category: ${p.reasonCategory || 'N/A'}. Reason: ${p.reason}`;

  return { subject, html, text };
};

export const buildManualAttendanceApprovedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    p = {
      applicantName: arg2,
      approverName: arg3,
      attendanceDate: rec.date,
      inTime: rec.requestedInTime || rec.requestedClockIn || '--:--',
      outTime: rec.requestedOutTime || rec.requestedClockOut || '--:--',
      comments: arg4,
      requestId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = `Confirmation: Attendance Regularized for ${p.attendanceDate} [Ref: ${p.requestId}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Manual Attendance Regularized',
    badgeText: 'Attendance Regularized',
    badgeBg: '#059669',
    recipientName: p.applicantName,
    referenceNo: p.requestId,
    leadParagraph: `Your manual attendance punch entry for <strong>${p.attendanceDate}</strong> has been approved and confirmed by your Reporting Officer.`,
    detailsTable: [
      { label: 'Regularized Date', value: p.attendanceDate },
      { label: 'Approved In-Time', value: p.inTime },
      { label: 'Approved Out-Time', value: p.outTime },
      { label: 'Authorizing Officer', value: p.approverName },
      { label: 'Attendance Record', value: 'Updated to PRESENT in the official biometric registry' }
    ],
    remarksBox: {
      title: 'Officer Endorsement',
      text: p.comments || 'Punch regularized upon review.',
      alertType: 'success'
    }
  });

  const text = `CONFIRMED: Attendance for ${p.attendanceDate} has been regularized by ${p.approverName}. In-time: ${p.inTime}, Out-time: ${p.outTime}.`;

  return { subject, html, text };
};

export const buildManualAttendanceRejectedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    p = {
      applicantName: arg2,
      rejectorName: arg3,
      attendanceDate: rec.date,
      comments: arg4,
      requestId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = `Notice: Attendance Regularization Rejected (${p.attendanceDate}) [Ref: ${p.requestId}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Attendance Regularization Request Rejected',
    badgeText: 'Regularization Rejected',
    badgeBg: '#dc2626',
    recipientName: p.applicantName,
    referenceNo: p.requestId,
    leadParagraph: `Your manual attendance request for <strong>${p.attendanceDate}</strong> could not be approved by your Reporting Officer.`,
    detailsTable: [
      { label: 'Target Date', value: p.attendanceDate },
      { label: 'Reviewing Officer', value: p.rejectorName },
      { label: 'Status', value: 'Unregularized / Rejected' }
    ],
    remarksBox: {
      title: 'Reason for Rejection',
      text: p.comments || 'Insufficient proof or mismatched biometric logs.',
      alertType: 'danger'
    }
  });

  const text = `NOTICE: Manual attendance for ${p.attendanceDate} was REJECTED by ${p.rejectorName}. Comments: ${p.comments || 'N/A'}`;

  return { subject, html, text };
};

export const buildODAppliedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    const isManager = Boolean(arg4);
    p = {
      applicantName: arg2,
      recipientName: isManager ? arg3 : arg2,
      isManager,
      location: rec.location || rec.destination || 'Field Station',
      startDate: rec.startDate,
      endDate: rec.endDate,
      daysCount: rec.daysCount,
      purpose: rec.purpose || '',
      odType: rec.odType || 'Official Field Duty',
      fundingSource: rec.fundingSource,
      estimatedFunds: rec.estimatedExpenditure || rec.estimatedFunds,
      odId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = p.isManager
    ? `Action Required: Outdoor Duty (OD) Tour Request: ${p.applicantName} (${p.location})`
    : `Outdoor Duty Tour Requisition Submitted: ${p.location} (${p.daysCount} Days) [Ref: ${p.odId}]`;

  const html = wrapOfficialEmailHtml({
    title: p.isManager ? 'Outdoor Duty Movement Approval Required' : 'Outdoor Duty Requisition Logged',
    badgeText: p.isManager ? 'Action Required' : 'Requisition Pending',
    badgeBg: p.isManager ? '#d97706' : '#2563eb',
    recipientName: p.recipientName,
    referenceNo: p.odId,
    leadParagraph: p.isManager
      ? `<strong>${p.applicantName}</strong> has submitted an Outdoor Duty (OD) / Field Tour requisition to <strong>${p.location}</strong> for your authorization.`
      : `Your Outdoor Duty (OD) tour application to <strong>${p.location}</strong> has been received and forwarded to your Reporting Officer for review.`,
    detailsTable: [
      { label: 'Officer / Researcher', value: p.applicantName },
      { label: 'Station / Tour Destination', value: p.location },
      { label: 'Tour Category', value: p.odType },
      { label: 'Commencement Date', value: p.startDate },
      { label: 'Return Date', value: p.endDate },
      { label: 'Total Duration', value: `${p.daysCount} calendar day(s)` },
      { label: 'Funding Project / Head', value: p.fundingSource || 'Institutional Core / Project Grant' },
      { label: 'Estimated Expenditure', value: p.estimatedFunds ? `₹${Number(p.estimatedFunds).toLocaleString('en-IN')}` : 'N/A' }
    ],
    remarksBox: {
      title: 'Official Purpose of Visit',
      text: p.purpose,
      alertType: 'info'
    }
  });

  const text = `Outdoor Duty Requisition ${p.odId}\nApplicant: ${p.applicantName}\nStation: ${p.location}\nDates: ${p.startDate} to ${p.endDate}\nPurpose: ${p.purpose}`;

  return { subject, html, text };
};

export const buildODApprovedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    p = {
      applicantName: arg2,
      approverName: arg3,
      location: rec.location || rec.destination || 'Field Station',
      startDate: rec.startDate,
      endDate: rec.endDate,
      daysCount: rec.daysCount,
      purpose: rec.purpose || '',
      odId: rec.id,
      comments: arg4
    };
  } else {
    p = arg1;
  }

  const subject = `Official Tour Order: Outdoor Duty Sanctioned for ${p.applicantName} (${p.location}) [Ref: ${p.odId}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Official Tour / Movement Order',
    badgeText: 'Tour Order Sanctioned',
    badgeBg: '#059669',
    recipientName: p.applicantName,
    referenceNo: p.odId,
    leadParagraph: `Sanction of the Competent Authority is hereby conveyed for official Outdoor Duty / Field Movement to <strong>${p.location}</strong> from <strong>${p.startDate}</strong> to <strong>${p.endDate}</strong> (${p.daysCount} days).`,
    detailsTable: [
      { label: 'Sanction Order Ref', value: p.odId },
      { label: 'Officer Name', value: p.applicantName },
      { label: 'Field Station / Location', value: p.location },
      { label: 'Tour Span', value: `${p.startDate} to ${p.endDate} (${p.daysCount} days)` },
      { label: 'Sanctioning Officer', value: p.approverName },
      { label: 'TA/DA Entitlement', value: 'Admissible as per Govt. of India / WII Institutional Rules' },
      { label: 'Biometric Status', value: 'Marked as "Official Outdoor Duty (OD)" on attendance records' }
    ],
    remarksBox: {
      title: 'Officer Tour Sanction Remarks',
      text: p.comments || 'Movement approved. Tour report to be submitted within 7 working days of return.',
      alertType: 'success'
    }
  });

  const text = `OFFICIAL TOUR ORDER: Outdoor Duty to ${p.location} (${p.startDate} to ${p.endDate}, ${p.daysCount} days) has been APPROVED by ${p.approverName}. Ref: ${p.odId}`;

  return { subject, html, text };
};

export const buildODRejectedEmail = (arg1: any, arg2?: any, arg3?: any, arg4?: any) => {
  let p: any = {};
  if (arg2 !== undefined) {
    const rec = arg1;
    p = {
      applicantName: arg2,
      rejectorName: arg3,
      location: rec.location || rec.destination || 'Field Station',
      startDate: rec.startDate,
      endDate: rec.endDate,
      comments: arg4,
      odId: rec.id
    };
  } else {
    p = arg1;
  }

  const subject = `Notice: Outdoor Duty Tour Request Not Sanctioned (${p.location}) [Ref: ${p.odId}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Outdoor Duty Tour Decision Notice',
    badgeText: 'Tour Requisition Rejected',
    badgeBg: '#dc2626',
    recipientName: p.applicantName,
    referenceNo: p.odId,
    leadParagraph: `Your Outdoor Duty (OD) requisition to <strong>${p.location}</strong> (${p.startDate} to ${p.endDate}) could not be approved at this time.`,
    detailsTable: [
      { label: 'Order Reference', value: p.odId },
      { label: 'Requested Station', value: p.location },
      { label: 'Dates Requested', value: `${p.startDate} to ${p.endDate}` },
      { label: 'Reviewing Authority', value: p.rejectorName }
    ],
    remarksBox: {
      title: 'Reason for Decision',
      text: p.comments || 'Field visit deferred or disapproved due to conflicting project priorities.',
      alertType: 'danger'
    }
  });

  const text = `NOTICE: Outdoor duty to ${p.location} was REJECTED by ${p.rejectorName}. Remarks: ${p.comments || 'N/A'}`;

  return { subject, html, text };
};

export const buildTransferOrderEmail = (arg1: any, arg2?: any) => {
  let p: any = {};
  if (typeof arg2 === 'string') {
    const roleType = arg2;
    const data = arg1;
    const isEmp = roleType === 'employee';
    const isIncoming = roleType === 'incoming_manager';
    p = {
      employeeName: data.employeeName,
      recipientName: isEmp ? data.employeeName : (isIncoming ? data.newManagerName : data.previousManagerName),
      recipientRoleDescription: isEmp ? 'Transferred Official' : (isIncoming ? 'Newly Assigned Reporting Officer' : 'Relieving Reporting Officer'),
      previousDept: data.previousDepartment || data.previousDept || 'Relieving Division',
      newDept: data.newDepartment || data.newDept || 'Assigned Division',
      previousManagerName: data.previousManagerName || 'Relieving Officer',
      newManagerName: data.newManagerName || 'New Reporting Officer',
      effectiveDate: data.effectiveDate,
      notes: data.remarks || data.notes || '',
      transferredBy: data.issuingAuthority || 'Director / Establishment Officer',
      orderNumber: data.orderNumber || `WII/EST/TRF/${Date.now().toString().slice(-4)}`
    };
  } else {
    p = arg1;
  }

  const subject = `Administrative Office Order: Transfer & Posting of ${p.employeeName} [Order No: ${p.orderNumber}]`;
  const html = wrapOfficialEmailHtml({
    title: 'Office Order: Departmental Transfer & Posting',
    badgeText: 'Official Office Order',
    badgeBg: '#4f46e5',
    recipientName: p.recipientName,
    referenceNo: p.orderNumber,
    leadParagraph: `The Competent Authority has ordered the departmental transfer and posting of <strong>${p.employeeName}</strong> as detailed below. This communication serves as the formal administrative notification to you as <em>${p.recipientRoleDescription}</em>.`,
    detailsTable: [
      { label: 'Office Order Number', value: p.orderNumber },
      { label: 'Transferred Employee', value: p.employeeName },
      { label: 'Relieving Department', value: p.previousDept },
      { label: 'New Posting Department', value: p.newDept },
      { label: 'Previous Reporting Officer', value: p.previousManagerName },
      { label: 'New Reporting Officer', value: p.newManagerName },
      { label: 'Effective Date of Posting', value: p.effectiveDate },
      { label: 'Order Authorized By', value: p.transferredBy }
    ],
    remarksBox: {
      title: 'Administrative Directives & Handover Instructions',
      text: p.notes || 'The official is directed to complete all charge handover formalities and report for duty in the newly assigned department on the effective date.',
      alertType: 'warning'
    }
  });

  const text = `OFFICE ORDER ${p.orderNumber}\nTransfer of ${p.employeeName} from ${p.previousDept} to ${p.newDept}.\nNew Manager: ${p.newManagerName}.\nEffective: ${p.effectiveDate}.\nNotes: ${p.notes || 'Standard posting order'}`;

  return { subject, html, text };
};

export const buildManagerMigrationEmail = (params: {
  incomingManagerName: string;
  outgoingManagerName: string;
  effectiveDate: string;
  recipientName?: string;
  reassignType?: string;
  reporteesCount?: number;
  reporteeNames?: string[];
  affectedCount?: number;
  adminName?: string;
  notes?: string;
  isIncomingManager?: boolean;
}) => {
  const count = params.reporteesCount ?? params.affectedCount ?? 0;
  const subject = `Administrative Order: Assumption of Reporting Hierarchy (${count} Staff Reassigned)`;

  const html = wrapOfficialEmailHtml({
    title: 'Office Order: Supervisory Hierarchy Reassignment',
    badgeText: 'Hierarchy Restructuring',
    badgeBg: '#0284c7',
    recipientName: params.recipientName || params.incomingManagerName,
    referenceNo: `MGR-REMAP-${Date.now().toString().slice(-4)}`,
    leadParagraph: `As per official administrative re-mapping, you have been designated as the Reporting Authority for <strong>${count} employee(s)</strong> previously reporting to <strong>${params.outgoingManagerName}</strong>.`,
    detailsTable: [
      { label: 'Incoming Reporting Officer', value: params.incomingManagerName },
      { label: 'Outgoing Officer', value: params.outgoingManagerName },
      { label: 'Effective Date', value: params.effectiveDate },
      { label: 'Scope of Transfer', value: `${count} Direct Reportees Re-mapped` },
      { label: 'Workflow Routing', value: 'All pending and future leave & attendance requests routed to new officer' }
    ],
    remarksBox: {
      title: 'Administrative Memorandum',
      text: params.notes || 'Hierarchy re-assignment executed as part of departmental re-structuring.',
      alertType: 'info'
    }
  });

  const text = `NOTICE: Reporting hierarchy reassignment. Incoming: ${params.incomingManagerName}, Outgoing: ${params.outgoingManagerName}. Effective: ${params.effectiveDate}.`;

  return { subject, html, text };
};

export const buildRelievingManagerNoticeEmail = (params: {
  outgoingManagerName: string;
  incomingManagerName: string;
  effectiveDate: string;
  reassignType?: string;
  reporteesCount?: number;
  reporteeNames?: string[];
  affectedCount?: number;
  adminName?: string;
  notes?: string;
}) => {
  const count = params.reporteesCount ?? params.affectedCount ?? 0;
  const subject = `Administrative Notice: Relinquishment of Reporting Hierarchy (${count} Staff Reassigned)`;
  const html = wrapOfficialEmailHtml({
    title: 'Relinquishment of Reporting Supervision',
    badgeText: 'Hierarchy Transition',
    badgeBg: '#475569',
    recipientName: params.outgoingManagerName,
    referenceNo: `REL-MGR-${Date.now().toString().slice(-4)}`,
    leadParagraph: `This is to formally notify you that effective <strong>${params.effectiveDate}</strong>, supervisory responsibility for <strong>${count} direct reportee(s)</strong> has been reassigned to <strong>${params.incomingManagerName}</strong>.`,
    detailsTable: [
      { label: 'Outgoing Reporting Officer', value: params.outgoingManagerName },
      { label: 'Incoming Reporting Officer', value: params.incomingManagerName },
      { label: 'Effective Date', value: params.effectiveDate },
      { label: 'Reassigned Staff Count', value: `${count} Employees` }
    ],
    remarksBox: {
      title: 'Administrative Directives',
      text: params.notes || 'Reporting authority successfully transferred in the institutional database.',
      alertType: 'info'
    }
  });

  const text = `NOTICE: Relinquishment of reporting hierarchy. ${count} staff reassigned to ${params.incomingManagerName} effective ${params.effectiveDate}.`;
  return { subject, html, text };
};

export const buildReporteeManagerTransitionEmail = (params: {
  employeeName: string;
  incomingManagerName: string;
  outgoingManagerName: string;
  effectiveDate: string;
  reassignType?: string;
  notes?: string;
}) => {
  const subject = `Official Notice: Change in Your Reporting Officer (Reporting to ${params.incomingManagerName})`;
  const html = wrapOfficialEmailHtml({
    title: 'Official Notification: Reporting Officer Transition',
    badgeText: 'Reporting Officer Update',
    badgeBg: '#2563eb',
    recipientName: params.employeeName,
    referenceNo: `RO-UPD-${Date.now().toString().slice(-4)}`,
    leadParagraph: `Please note that in accordance with official establishment orders, your Reporting Officer (Level-1 Sanctioning Authority) has been transitioned from <strong>${params.outgoingManagerName}</strong> to <strong>${params.incomingManagerName}</strong>.`,
    detailsTable: [
      { label: 'Employee Name', value: params.employeeName },
      { label: 'Newly Assigned Reporting Officer', value: params.incomingManagerName },
      { label: 'Relieved Officer', value: params.outgoingManagerName },
      { label: 'Effective Date', value: params.effectiveDate }
    ],
    remarksBox: {
      title: 'Workflow Directives',
      text: params.notes || 'All future leave requisitions, outdoor duty tours, and attendance regularization requests should now be routed to your new Reporting Officer.',
      alertType: 'info'
    }
  });

  const text = `NOTICE: Your reporting officer has changed to ${params.incomingManagerName} effective ${params.effectiveDate}.`;
  return { subject, html, text };
};

export const buildPasswordResetEmail = (employee: { name: string; email: string; tempPass: string; adminName: string; reason?: string }) => {
  const subject = `Security Alert: Temporary Password Reset for ${employee.name}`;
  const html = wrapOfficialEmailHtml({
    title: 'Official Account Credentials Reset',
    badgeText: 'Credentials Updated',
    badgeBg: '#ea580c',
    recipientName: employee.name,
    leadParagraph: `Your account credentials on the WII E-Governance Portal have been reset by System Administrator <strong>${employee.adminName}</strong>.`,
    detailsTable: [
      { label: 'Employee Name', value: employee.name },
      { label: 'Account Username', value: employee.email },
      { label: 'Temporary Passcode', value: `<code style="font-size: 15px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 4px 8px; border-radius: 4px;">${employee.tempPass}</code>` },
      { label: 'Issued Timestamp', value: new Date().toLocaleString('en-IN') }
    ],
    remarksBox: {
      title: 'Mandatory Security Requirement',
      text: `Reason: ${employee.reason || 'Administrative password refresh'}.\n\nFor security reasons, this temporary passcode must be changed immediately upon your next login. Do not share your login credentials with anyone.`,
      alertType: 'danger'
    }
  });

  const text = `SECURITY ALERT: Password reset for ${employee.name}.\nUsername: ${employee.email}\nTemporary Password: ${employee.tempPass}\nPlease login and update your password immediately.`;

  return { subject, html, text };
};

// --- CORE DISPATCH FUNCTION ---

export interface DispatchEmailPayload {
  to: string;
  toName: string;
  toRole?: string;
  cc?: string[];
  subject: string;
  category: EmailCategory;
  eventType: string;
  bodyHtml: string;
  bodyText: string;
  referenceId?: string;
  referenceType?: 'leave' | 'od' | 'manual_attendance' | 'user' | 'transfer';
  meta?: Record<string, any>;
}

export const dispatchSystemEmail = async (
  payload: DispatchEmailPayload,
  config: EmailConfig,
  addLogCallback?: (log: EmailNotificationLog) => void,
  toastCallback?: (info: { to: string; subject: string; status: EmailDeliveryStatus }) => void
): Promise<EmailNotificationLog> => {
  const now = new Date();
  const logId = `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newLog: EmailNotificationLog = {
    id: logId,
    timestamp: now.toISOString(),
    formattedDate: now.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    to: payload.to,
    toName: payload.toName,
    toRole: payload.toRole,
    cc: payload.cc,
    from: `${config.fromName} <${config.fromEmail}>`,
    subject: payload.subject,
    category: payload.category,
    eventType: payload.eventType,
    bodyHtml: payload.bodyHtml,
    bodyText: payload.bodyText,
    status: 'simulated',
    referenceId: payload.referenceId,
    referenceType: payload.referenceType,
    meta: payload.meta
  };

  // Check if email notification system is enabled
  if (config.enableEmailNotifications) {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          toName: payload.toName,
          cc: payload.cc,
          subject: payload.subject,
          html: payload.bodyHtml,
          text: payload.bodyText,
          category: payload.category,
          eventType: payload.eventType,
          referenceId: payload.referenceId,
          smtpConfig: config.smtpHost
            ? {
                host: config.smtpHost,
                port: config.smtpPort,
                secure: config.smtpSecure,
                user: config.smtpUser,
                pass: config.smtpPass,
                fromEmail: config.fromEmail,
                fromName: config.fromName
              }
            : undefined
        })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.status === 'delivered') {
          newLog.status = 'delivered';
        } else {
          newLog.status = 'sent';
        }
      } else {
        newLog.status = 'simulated';
      }
    } catch (err) {
      console.warn('[EMAIL SERVICE] Network dispatch exception, fallback to simulated audit entry:', err);
      newLog.status = 'simulated';
    }
  }

  // Record into logs
  if (addLogCallback) {
    addLogCallback(newLog);
  }

  // Trigger floating visual feedback toast
  if (toastCallback) {
    toastCallback({
      to: payload.to,
      subject: payload.subject,
      status: newLog.status
    });
  }

  return newLog;
};

export const INITIAL_EMAIL_LOGS: EmailNotificationLog[] = [
  {
    id: 'mail-init-1',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 2).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    to: 'sunita.rao@wii.gov.in',
    toName: 'Dr. Sunita Rao',
    toRole: 'Applicant / Scientist',
    cc: ['rajesh.sharma@wii.gov.in', 'admin@wii.gov.in'],
    from: 'Wildlife Institute of India Notifications <notifications@wii.gov.in>',
    subject: 'Sanction Order: Leave Approved for Dr. Sunita Rao (Commuted Leave) [Ref: lv-104]',
    category: 'leave_workflow',
    eventType: 'LEAVE_APPROVED',
    bodyHtml: wrapOfficialEmailHtml({
      title: 'Official Leave Sanction Order',
      badgeText: 'Sanctioned / Approved',
      badgeBg: '#059669',
      recipientName: 'Dr. Sunita Rao',
      referenceNo: 'lv-104',
      leadParagraph: 'Your application for <strong>Commuted Leave (Rule 30)</strong> for the period from <strong>2025-05-02</strong> to <strong>2025-05-06</strong> (5 days) has been formally <strong>SANCTIONED</strong> by the Competent Authority.',
      detailsTable: [
        { label: 'Sanction Reference', value: 'lv-104' },
        { label: 'Sanctioned Leave Type', value: 'Commuted Leave (Rule 30)' },
        { label: 'Commencement Date', value: '2025-05-02' },
        { label: 'Conclusion Date', value: '2025-05-06' },
        { label: 'Total Number of Days', value: '5 day(s)' },
        { label: 'Sanctioning Authority', value: 'Dr. Rajesh Sharma' },
        { label: 'Attendance Ledger', value: 'Attendance calendar auto-updated to "On Approved Leave"' }
      ],
      remarksBox: {
        title: 'Approver Order Remarks',
        text: 'Medical certificate verified and sanctioned under Central Civil Services (Leave) Rules.',
        alertType: 'success'
      }
    }),
    bodyText: 'SANCTION ORDER: Commuted Leave for Dr. Sunita Rao (5 days) has been APPROVED by Dr. Rajesh Sharma.',
    status: 'delivered',
    referenceId: 'lv-104',
    referenceType: 'leave'
  },
  {
    id: 'mail-init-2',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 5).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    to: 'priya.verma@wii.gov.in',
    toName: 'Priya Verma',
    toRole: 'Applicant / Researcher',
    cc: ['rajesh.sharma@wii.gov.in', 'finance@wii.gov.in'],
    from: 'Wildlife Institute of India Notifications <notifications@wii.gov.in>',
    subject: 'Official Tour Order: Outdoor Duty Sanctioned for Priya Verma (New Delhi) [Ref: OD-102]',
    category: 'outdoor_duty',
    eventType: 'OD_APPROVED',
    bodyHtml: wrapOfficialEmailHtml({
      title: 'Official Tour / Movement Order',
      badgeText: 'Tour Order Sanctioned',
      badgeBg: '#059669',
      recipientName: 'Priya Verma',
      referenceNo: 'OD-102',
      leadParagraph: 'Sanction of the Competent Authority is hereby conveyed for official Outdoor Duty / Field Movement to <strong>State Biodiversity Board HQ, New Delhi</strong> (2 days).',
      detailsTable: [
        { label: 'Sanction Order Ref', value: 'OD-102' },
        { label: 'Officer Name', value: 'Priya Verma' },
        { label: 'Field Station / Location', value: 'State Biodiversity Board HQ, New Delhi' },
        { label: 'Sanctioning Officer', value: 'Anita Roy' },
        { label: 'Funding Project / Head', value: 'National Biodiversity Authority (NBA)' },
        { label: 'TA/DA Entitlement', value: 'Admissible as per Govt. of India Rules' }
      ],
      remarksBox: {
        title: 'Officer Tour Sanction Remarks',
        text: 'Movement approved. Tour report and vouchers to be submitted within 7 working days.',
        alertType: 'success'
      }
    }),
    bodyText: 'TOUR ORDER: Outdoor Duty to State Biodiversity Board HQ approved by Anita Roy.',
    status: 'delivered',
    referenceId: 'OD-102',
    referenceType: 'od'
  },
  {
    id: 'mail-init-3',
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 8).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    to: 'vikash.meena@wii.gov.in',
    toName: 'Vikash Meena',
    toRole: 'Applicant / Employee',
    cc: ['rajesh.sharma@wii.gov.in'],
    from: 'Wildlife Institute of India Notifications <notifications@wii.gov.in>',
    subject: 'Confirmation: Attendance Regularized for 2025-05-10 [Ref: man_att_02]',
    category: 'attendance_regularization',
    eventType: 'MANUAL_PUNCH_APPROVED',
    bodyHtml: wrapOfficialEmailHtml({
      title: 'Manual Attendance Regularized',
      badgeText: 'Attendance Regularized',
      badgeBg: '#059669',
      recipientName: 'Vikash Meena',
      referenceNo: 'man_att_02',
      leadParagraph: 'Your manual attendance punch entry for <strong>2025-05-10</strong> has been approved and confirmed by your Reporting Officer.',
      detailsTable: [
        { label: 'Regularized Date', value: '2025-05-10' },
        { label: 'Approved In-Time', value: '09:20' },
        { label: 'Approved Out-Time', value: '17:35' },
        { label: 'Authorizing Officer', value: 'Dr. Rajesh Sharma' },
        { label: 'Attendance Record', value: 'Updated to PRESENT in official biometric registry' }
      ],
      remarksBox: {
        title: 'Officer Endorsement',
        text: 'Approved upon verification of biometric sensor fault report.',
        alertType: 'success'
      }
    }),
    bodyText: 'CONFIRMED: Manual attendance regularized for 2025-05-10 by Dr. Rajesh Sharma.',
    status: 'delivered',
    referenceId: 'man_att_02',
    referenceType: 'manual_attendance'
  },
  {
    id: 'mail-init-4',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 24).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    to: 'priya.verma@wii.gov.in',
    toName: 'Priya Verma',
    toRole: 'Transferred Official',
    cc: ['rajesh.sharma@wii.gov.in', 'anita.roy@wii.gov.in', 'admin@wii.gov.in'],
    from: 'Wildlife Institute of India Notifications <notifications@wii.gov.in>',
    subject: 'Administrative Office Order: Transfer & Posting of Priya Verma [Order No: WII/EST/TRF/2025/082]',
    category: 'transfer_hierarchy',
    eventType: 'TRANSFER_POSTING',
    bodyHtml: wrapOfficialEmailHtml({
      title: 'Office Order: Departmental Transfer & Posting',
      badgeText: 'Official Office Order',
      badgeBg: '#4f46e5',
      recipientName: 'Priya Verma',
      referenceNo: 'WII/EST/TRF/2025/082',
      leadParagraph: 'The Competent Authority has ordered the departmental transfer and posting of <strong>Priya Verma</strong> to Wildlife Forensics Cell with immediate effect.',
      detailsTable: [
        { label: 'Office Order Number', value: 'WII/EST/TRF/2025/082' },
        { label: 'Transferred Employee', value: 'Priya Verma' },
        { label: 'Relieving Department', value: 'Habitat Ecology' },
        { label: 'New Posting Department', value: 'Wildlife Forensics Cell' },
        { label: 'Previous Reporting Officer', value: 'Dr. Dhananjai Mohan' },
        { label: 'New Reporting Officer', value: 'Dr. Rajesh Sharma' },
        { label: 'Effective Date of Posting', value: '2025-05-01' },
        { label: 'Order Authorized By', value: 'Director, WII' }
      ],
      remarksBox: {
        title: 'Administrative Directives',
        text: 'The official is directed to complete charge handover formalities and report for duty in the Wildlife Forensics Cell.',
        alertType: 'warning'
      }
    }),
    bodyText: 'OFFICE ORDER WII/EST/TRF/2025/082: Transfer of Priya Verma to Wildlife Forensics Cell.',
    status: 'delivered',
    referenceId: 'WII/EST/TRF/2025/082',
    referenceType: 'transfer'
  },
  {
    id: 'mail-init-5',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 48).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    to: 'priya.verma@wii.gov.in',
    toName: 'Priya Verma',
    toRole: 'New Employee',
    cc: ['admin@wii.gov.in'],
    from: 'Wildlife Institute of India Notifications <notifications@wii.gov.in>',
    subject: 'Welcome to Wildlife Institute of India E-Governance Portal - Account Registration (Priya Verma)',
    category: 'user_management',
    eventType: 'USER_CREATED',
    bodyHtml: wrapOfficialEmailHtml({
      title: 'New Official Account Provisioned',
      badgeText: 'Account Created',
      badgeBg: '#059669',
      recipientName: 'Priya Verma',
      referenceNo: 'USR-8902',
      leadParagraph: 'Your official employee account on the Wildlife Institute of India (WII) E-Governance Leave & Attendance Management System has been successfully created and activated.',
      detailsTable: [
        { label: 'Employee Name', value: 'Priya Verma' },
        { label: 'Registered Email', value: 'priya.verma@wii.gov.in' },
        { label: 'Designation', value: 'Senior Research Fellow (SRF)' },
        { label: 'Department / Unit', value: 'Wildlife Forensics Cell' },
        { label: 'Biometric Punch ID', value: 'WII-BIO-1002' },
        { label: 'Reporting Officer (L1)', value: 'Dr. Rajesh Sharma' }
      ],
      remarksBox: {
        title: 'Action Required',
        text: 'Please log in to the portal to verify your leave balances and profile information.',
        alertType: 'info'
      }
    }),
    bodyText: 'Welcome to WII E-Governance Portal. Your account is active.',
    status: 'delivered',
    referenceId: 'usr-2',
    referenceType: 'user'
  }
];

