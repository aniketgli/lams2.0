export interface SlackConfig {
  webhookUrl: string;
  defaultChannel: string;
  enableSlackNotifications: boolean;
  notifyOnLeaveRequest: boolean;
  notifyOnLeaveApproval: boolean;
  notifyOnODRequest: boolean;
  notifyOnODApproval: boolean;
  notifyOnLowAttendance: boolean;
}

export interface SlackNotification {
  id: string;
  timestamp: string;
  channel: string;
  sender: string;
  title: string;
  message: string;
  type: 'leave' | 'od' | 'attendance' | 'role_change' | 'system';
  deliveredStatus: 'simulated' | 'sent' | 'failed';
  actionableId?: string;
  actionType?: 'leave' | 'od';
}

export type EmailCategory = 
  | 'leave'
  | 'od'
  | 'attendance'
  | 'manual_attendance'
  | 'transfer'
  | 'user_management'
  | 'leave_workflow'
  | 'attendance_regularization'
  | 'outdoor_duty'
  | 'transfer_hierarchy'
  | 'general_notice'
  | 'system';

export type EmailDeliveryStatus = 'delivered' | 'sent' | 'simulated' | 'failed' | 'logged_only';

export interface EmailNotificationLog {
  id: string;
  timestamp: string;
  formattedDate: string;
  to: string;
  toName: string;
  toRole?: string;
  cc?: string[];
  from: string;
  subject: string;
  category: EmailCategory;
  eventType: string;
  bodyHtml: string;
  bodyText: string;
  status: EmailDeliveryStatus;
  deliveryStatus?: EmailDeliveryStatus;
  referenceId?: string;
  referenceType?: 'leave' | 'od' | 'manual_attendance' | 'user' | 'transfer';
  meta?: Record<string, any>;
}

export interface EmailConfig {
  enableEmailNotifications: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  senderName?: string;
  senderEmail?: string;
  adminCcEmail: string;
  adminEmail?: string;
  notifyOnUserCreation: boolean;
  notifyOnLeaveApplication: boolean;
  notifyOnLeaveApproval: boolean;
  notifyOnAttendanceRegularization: boolean;
  notifyOnOutdoorDuty: boolean;
  notifyOnTransfer: boolean;
  notifyOnPasswordReset: boolean;
}
