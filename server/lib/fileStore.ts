/**
 * Where uploaded files live.
 *
 * With UPLOAD_DIR set (the RAID 5 data disk on the server, e.g. UPLOAD_DIR=/data/lams2-uploads), every new
 * upload (profile photos, leave medical certificates, joining fitness certificates) is written there as a
 * file, and the database row keeps only its relative path in `storage_path`. Without UPLOAD_DIR the file
 * stays in the row's `data` column, as before. Old rows that still hold `data` keep working either way.
 *
 *   <UPLOAD_DIR>/photos/0336-1731650000000-1a2b3c4d.jpg
 *   <UPLOAD_DIR>/certificates/leave-12-1731650000000-....pdf
 *   <UPLOAD_DIR>/fitness/report-4-1731650000000-....pdf
 *
 * Files are written to a temporary name and renamed (never half-written), readable only by the app user
 * (0640, folders 0750), and every read checks that the path stays inside UPLOAD_DIR. A file is written
 * before its database row; if the transaction fails, or a row is later replaced or deleted, the old file
 * is left behind and removed by `sweepOrphans` (at start-up and once a day) after a day's grace.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type FileKind = 'photos' | 'certificates' | 'fitness';
export const FILE_KINDS: readonly FileKind[] = ['photos', 'certificates', 'fitness'];

const SAFE_REL = /^(photos|certificates|fitness)\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;
const SAFE_PREFIX = /^[A-Za-z0-9-]{1,40}$/;
const SAFE_EXT = /^[a-z0-9]{1,5}$/;

/** The configured upload folder (absolute), or null when files are kept in the database. */
export function uploadRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = String(env.UPLOAD_DIR ?? '').trim();
  if (!raw) return null;
  if (!path.isAbsolute(raw)) throw new Error('UPLOAD_DIR must be an absolute path, e.g. /data/lams2-uploads');
  return path.resolve(raw);
}

/** Absolute path of a stored file; refuses anything that would leave the upload folder. */
export function resolveStored(root: string, rel: string): string {
  if (!SAFE_REL.test(rel)) throw new Error('Invalid stored file path.');
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid stored file path.');
  return full;
}

export interface StoredBlob {
  /** Bytes for the `data` column (when no upload folder is configured), otherwise null. */
  data: Buffer | null;
  /** Relative path for the `storage_path` column, or null when the bytes go to the database. */
  storagePath: string | null;
}

/** Stores the bytes on disk when UPLOAD_DIR is set; otherwise returns them for the database row. */
export async function storeBlob(kind: FileKind, prefix: string, ext: string, bytes: Buffer, root = uploadRoot()): Promise<StoredBlob> {
  if (!root) return { data: bytes, storagePath: null };
  if (!SAFE_PREFIX.test(prefix) || !SAFE_EXT.test(ext)) throw new Error('Invalid file name parts.');
  const name = `${prefix}-${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  const rel = `${kind}/${name}`;
  const full = resolveStored(root, rel);
  await mkdir(path.dirname(full), { recursive: true, mode: 0o750 });
  const tmp = `${full}.tmp-${randomBytes(4).toString('hex')}`;
  await writeFile(tmp, bytes, { mode: 0o640, flag: 'wx' });
  await rename(tmp, full);
  return { data: null, storagePath: rel };
}

/** The bytes of a row: from its file when it has a storage_path, otherwise from its data column. */
export async function readBlob(source: object, root = uploadRoot()): Promise<Buffer | null> {
  const row = source as { data?: unknown; storage_path?: unknown };
  const rel = typeof row.storage_path === 'string' && row.storage_path ? row.storage_path : null;
  if (rel) {
    if (!root) throw new Error('This file is on the upload disk, but UPLOAD_DIR is not set.');
    try {
      return await readFile(resolveStored(root, rel));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  if (row.data === null || row.data === undefined) return null;
  return Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data as ArrayBuffer);
}

/** Checks at start-up that the upload folder exists (creating the sub-folders) and is writable. */
export async function prepareUploadRoot(root = uploadRoot()): Promise<string | null> {
  if (!root) return null;
  for (const kind of FILE_KINDS) await mkdir(path.join(root, kind), { recursive: true, mode: 0o750 });
  const probe = path.join(root, `.write-test-${process.pid}`);
  await writeFile(probe, 'ok', { mode: 0o600 });
  await unlink(probe);
  return root;
}

/**
 * Deletes files no database row points to any more (replaced or deleted uploads, failed saves).
 * `referenced` returns the storage paths in use for one kind. Files younger than `graceMs` are kept,
 * so a save that is still in its transaction is never touched.
 */
export async function sweepOrphans(
  referenced: (kind: FileKind) => Promise<Set<string>>, root = uploadRoot(), graceMs = 24 * 60 * 60 * 1000, now = Date.now(),
): Promise<number> {
  if (!root) return 0;
  let removed = 0;
  for (const kind of FILE_KINDS) {
    let names: string[];
    try { names = await readdir(path.join(root, kind)); } catch { continue; }
    const used = await referenced(kind);
    for (const name of names) {
      const rel = `${kind}/${name}`;
      if (used.has(rel)) continue;
      const full = path.join(root, kind, name);
      try {
        const info = await stat(full);
        if (!info.isFile() || now - info.mtimeMs < graceMs) continue;
        await unlink(full);
        removed += 1;
      } catch { /* already gone */ }
    }
  }
  return removed;
}
