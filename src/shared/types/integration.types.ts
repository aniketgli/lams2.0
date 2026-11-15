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

