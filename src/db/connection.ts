/**
 * Where the MySQL database is. The same settings work on a developer's PC and on the
 * server, so both can use one shared database. Put ONE of these in .env:
 *
 *   DATABASE_URL=mysql://user:password@host:3306/dbname
 *
 * or the separate parts (no special handling needed for @ or other symbols in the password):
 *
 *   DB_HOST=172.16.30.250
 *   DB_PORT=3306
 *   DB_USER=lams2_app
 *   DB_PASSWORD=...
 *   DB_NAME=lams2_db
 *
 * The separate parts win when DB_HOST is set.
 */
export interface DatabaseTarget {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const HELP = 'In .env set DATABASE_URL=mysql://user:password@host:3306/dbname, or set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME (see .env.example).';

/** Decodes %40 etc.; a password that is not percent-encoded is used as written. */
function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function port(raw: string | undefined, name: string): number {
  const value = Number(raw || 3306);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a port number such as 3306.`);
  return value;
}

export function databaseTarget(env: NodeJS.ProcessEnv = process.env): DatabaseTarget {
  const host = env.DB_HOST?.trim();
  if (host) {
    const missing = ['DB_USER', 'DB_NAME'].filter((key) => !env[key]?.trim());
    if (missing.length) throw new Error(`${missing.join(' and ')} must be set together with DB_HOST. ${HELP}`);
    return {
      host,
      port: port(env.DB_PORT, 'DB_PORT'),
      user: env.DB_USER!.trim(),
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME!.trim(),
    };
  }

  // LAMS_PROD_DB_URL is an older name for the same setting; it is still read so existing .env files keep working.
  const url = (env.DATABASE_URL || env.LAMS_PROD_DB_URL || '').trim();
  if (!url) throw new Error(`The database is not configured. ${HELP}`);

  let parsed: URL;
  try {
    // The URL parser splits user and host at the LAST "@", so an unencoded "@" in the password still works.
    parsed = new URL(url);
  } catch {
    throw new Error(`DATABASE_URL is not a valid address. Expected mysql://user:password@host:3306/dbname. ${HELP}`);
  }
  const database = decodePart(parsed.pathname.replace(/^\/+/, ''));
  if (parsed.protocol !== 'mysql:' || !parsed.username || !parsed.hostname || !database) {
    throw new Error(`DATABASE_URL must look like mysql://user:password@host:3306/dbname (user, host and database name are required). ${HELP}`);
  }
  return {
    host: parsed.hostname,
    port: port(parsed.port, 'The port in DATABASE_URL'),
    user: decodePart(parsed.username),
    password: decodePart(parsed.password),
    database,
  };
}

/** For log messages: who and where, never the password. */
export function describeDatabase(target: DatabaseTarget): string {
  return `database "${target.database}" at ${target.host}:${target.port} as user "${target.user}"`;
}
