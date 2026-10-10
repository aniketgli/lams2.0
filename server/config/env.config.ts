function getCliArg(names: string[]): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    for (const name of names) {
      if (args[i] === name && i + 1 < args.length) {
        return args[i + 1];
      }
      if (args[i].startsWith(`${name}=`)) {
        return args[i].slice(name.length + 1);
      }
    }
  }
  return undefined;
}

const cliPort = getCliArg(['--port', '-p']);
const cliHost = getCliArg(['--host', '-h']);

const parsedPort = Number(process.env.PORT || cliPort || 3000);

export const envConfig = {
  port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
  // Bind to 0.0.0.0 to safely accept connections across local and containerized environments
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
