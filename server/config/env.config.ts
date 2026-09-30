export const envConfig = {
  port: 3000,
  host: '0.0.0.0',
  isProduction: process.env.NODE_ENV === 'production',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM || 'notifications@wii.gov.in',
  emailFromName: process.env.EMAIL_FROM_NAME || 'Wildlife Institute of India Notifications'
};
