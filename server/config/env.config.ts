/**
 * The ONE place the server reads environment variables (.env in development, the host's settings in production).
 * Everything else imports `envConfig` from here, so the full list of settings, their defaults and their limits is
 * in a single file, and no secret is read (or accidentally logged) from scattered places.
 * `.env.example` must list every variable used here (checked by env.config.test.ts).
 *
 * Values are read when asked for, not once at start-up, so they are always the current environment
 * (dotenv has loaded by the time the server runs, and tests can change a value).
 * Only build tools (vite.config.ts, drizzle.config.ts) and scripts/ read the environment themselves.
 */
const env = (name: string): string | undefined => {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
};

/** A positive number from the environment, kept inside [min, max]; the fallback when missing or invalid. */
function numberFrom(name: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const raw = Number(env(name));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.max(raw, min), max);
}

function cliArg(names: string[]): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    for (const name of names) {
      if (args[i] === name && i + 1 < args.length) return args[i + 1];
      if (args[i].startsWith(`${name}=`)) return args[i].slice(name.length + 1);
    }
  }
  return undefined;
}

export const envConfig = {
  // --- Server -----------------------------------------------------------------------------------
  get isProduction(): boolean { return env('NODE_ENV') === 'production'; },
  /** PORT, else --port on the command line, else 3000. */
  get port(): number { return numberFrom('PORT', Number(cliArg(['--port', '-p'])) || 3000); },
  /** Listens on every network interface, so local and containerised setups both work. */
  host: '0.0.0.0',
  /** Public address of the portal, used for the button in notification emails (no button when unset). */
  get appUrl(): string { return (env('APP_URL') ?? '').trim().replace(/\/+$/, ''); },

  // --- Database (the connection string is a secret) ---------------------------------------------------
  get databaseUrl(): string | undefined { return env('DATABASE_URL'); },
  /** Connections kept open to MySQL per server process. */
  get dbPoolSize(): number { return numberFrom('DB_POOL_SIZE', 40); },
  /** Requests allowed to wait for a free connection; more are refused at once. */
  get dbQueueLimit(): number { return numberFrom('DB_QUEUE_LIMIT', 500); },
  /** A SELECT running longer than this is stopped by MySQL. */
  get dbQueryTimeoutMs(): number { return numberFrom('DB_QUERY_TIMEOUT_MS', 30_000, 1000); },

  // --- Sign-in and sessions --------------------------------------------------------------------
  /** Secret used to sign sessions and the sign-in CAPTCHA. At least 32 characters in production. */
  get sessionSecret(): string | undefined { return env('SESSION_SECRET'); },
  /** "memory" keeps sessions in RAM (local development only). */
  get sessionStore(): string | undefined { return env('SESSION_STORE'); },
  get sessionIdleMinutes(): number { return numberFrom('SESSION_IDLE_MINUTES', 15, 2, 240); },
  get sessionMaxHours(): number { return numberFrom('SESSION_MAX_HOURS', 8, 1, 24); },
  /** Comma-separated email domains allowed to sign in (parsed and validated in auth.config.ts). */
  get loginEmailDomains(): string | undefined { return env('LOGIN_EMAIL_DOMAINS'); },
  /** The sign-in CAPTCHA is on unless this is "off" (local development only). */
  get loginCaptcha(): boolean { return (env('LOGIN_CAPTCHA') ?? 'on').toLowerCase() !== 'off'; },
  /** Fallback default password for new employees, used only until an administrator saves one in Master Settings. */
  get defaultEmployeePassword(): string | undefined { return env('DEFAULT_EMPLOYEE_PASSWORD'); },
  /** Key that encrypts saved settings such as the SMTP password; falls back to SESSION_SECRET. */
  get settingsEncryptionKey(): string | undefined { return env('SETTINGS_ENCRYPTION_KEY') ?? env('SESSION_SECRET'); },

  // --- Email: fallbacks used only until the settings are saved in the database -----------------------
  get smtpHost(): string | undefined { return env('SMTP_HOST'); },
  get smtpPort(): number { return numberFrom('SMTP_PORT', 587); },
  get smtpSecure(): boolean { return env('SMTP_SECURE') === 'true'; },
  get smtpUser(): string | undefined { return env('SMTP_USER'); },
  get smtpPass(): string | undefined { return env('SMTP_PASS'); },
  get smtpAllowSelfSigned(): boolean { return env('SMTP_ALLOW_SELF_SIGNED') === 'true'; },
  get emailFrom(): string { return env('EMAIL_FROM') ?? 'notifications@wii.gov.in'; },
  get emailFromName(): string { return env('EMAIL_FROM_NAME') ?? 'Wildlife Institute of India Notifications'; },
};

/** Names of every variable above, in one list, so a test can confirm .env.example documents them all. */
export const ENV_VARIABLES = [
  'NODE_ENV', 'PORT', 'APP_URL', 'DATABASE_URL', 'DB_POOL_SIZE', 'DB_QUEUE_LIMIT', 'DB_QUERY_TIMEOUT_MS',
  'SESSION_SECRET', 'SESSION_STORE', 'SESSION_IDLE_MINUTES', 'SESSION_MAX_HOURS', 'LOGIN_EMAIL_DOMAINS', 'LOGIN_CAPTCHA',
  'DEFAULT_EMPLOYEE_PASSWORD', 'SETTINGS_ENCRYPTION_KEY',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_ALLOW_SELF_SIGNED', 'EMAIL_FROM', 'EMAIL_FROM_NAME',
] as const;
