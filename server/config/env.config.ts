const parsedPort = Number(process.env.PORT || 3000);

export const envConfig = {
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
  // 0.0.0.0 makes the Express/Vite development server reachable from
  // other devices on the same LAN. Override with HOST=127.0.0.1 for
  // localhost-only development.
  host: process.env.HOST || '0.0.0.0',
  isProduction: process.env.NODE_ENV === 'production',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM || 'notifications@wii.gov.in',
  emailFromName: process.env.EMAIL_FROM_NAME || 'Wildlife Institute of India Notifications'
};
