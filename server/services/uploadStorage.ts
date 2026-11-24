import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { prepareUploadRoot, sweepOrphans, uploadRoot, type FileKind } from '../lib/fileStore';

/** Table and column holding the storage paths of each kind of upload. */
const SOURCES: Record<FileKind, { table: string }> = {
  photos: { table: 'employee_photos' },
  certificates: { table: 'leave_certificates' },
  fitness: { table: 'leave_joining_certificates' },
  projects: { table: 'project_files' },
};

async function referenced(kind: FileKind): Promise<Set<string>> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT storage_path FROM ${SOURCES[kind].table} WHERE storage_path IS NOT NULL`);
    return new Set(rows.map((r) => String(r.storage_path)));
  } catch (error) {
    // A table a later migration adds (project_files): no row, so no file of that kind can be in use yet.
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return new Set();
    throw error;
  }
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Start-up: says in the log where uploads are kept, checks the folder is writable, and removes files no
 * record uses any more (now and once a day). A broken UPLOAD_DIR is reported loudly but does not stop the
 * portal: uploads then fail with an error until the folder is fixed, everything else keeps working.
 */
export function startUploadStorage(): void {
  let root: string | null;
  try {
    root = uploadRoot();
  } catch (error) {
    console.error(`[uploads] ${(error as Error).message}`);
    return;
  }
  if (!root) {
    console.log('[uploads] UPLOAD_DIR is not set: uploaded files are stored in the database.');
    return;
  }
  const sweep = async () => {
    try {
      const removed = await sweepOrphans(referenced, root);
      if (removed) console.log(`[uploads] removed ${removed} file(s) no record uses any more.`);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ER_BAD_FIELD_ERROR') console.error('[uploads] clean-up failed:', (error as Error).message);
      else console.error('[uploads] run migrations/20261214_upload_storage.sql: the storage_path columns are missing.');
    }
  };
  prepareUploadRoot(root)
    .then(() => {
      console.log(`[uploads] uploaded files are stored in ${root}`);
      void sweep();
      setInterval(() => void sweep(), DAY).unref();
    })
    .catch((error) => console.error(`[uploads] UPLOAD_DIR ${root} is not usable (${(error as Error).message}). Uploads will fail until it is fixed.`));
}
