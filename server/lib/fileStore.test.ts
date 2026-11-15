import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readBlob, resolveStored, storeBlob, sweepOrphans, uploadRoot } from './fileStore';

const root = mkdtempSync(path.join(tmpdir(), 'lams2-uploads-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('upload storage on disk (UPLOAD_DIR)', () => {
  test('without UPLOAD_DIR the bytes stay with the database row', async () => {
    const stored = await storeBlob('photos', '0336', 'jpg', Buffer.from('abc'), null);
    expect(stored).toEqual({ data: Buffer.from('abc'), storagePath: null });
    expect(await readBlob({ data: Buffer.from('abc'), storage_path: null }, null)).toEqual(Buffer.from('abc'));
  });

  test('with UPLOAD_DIR the file is written under its kind and read back; the row keeps only the path', async () => {
    const stored = await storeBlob('certificates', 'leave-12', 'pdf', Buffer.from('%PDF-1.4 test'), root);
    expect(stored.data).toBeNull();
    expect(stored.storagePath).toMatch(/^certificates\/leave-12-\d+-[0-9a-f]{12}\.pdf$/);
    expect(await readBlob({ data: null, storage_path: stored.storagePath }, root)).toEqual(Buffer.from('%PDF-1.4 test'));
    const mode = statSync(path.join(root, stored.storagePath!)).mode & 0o777;
    expect(mode & 0o007).toBe(0); // not readable by other users
    expect(readdirSync(path.join(root, 'certificates')).some((n) => n.includes('.tmp-'))).toBe(false);
  });

  test('stored paths cannot leave the upload folder', () => {
    for (const bad of ['../etc/passwd', 'photos/../../etc/passwd', '/etc/passwd', 'photos/', 'other/x.jpg', 'photos/a/b.jpg']) {
      expect(() => resolveStored(root, bad)).toThrow();
    }
  });

  test('a missing file reads as "no file", not a crash', async () => {
    expect(await readBlob({ storage_path: 'photos/0001-1-aaaaaaaaaaaa.jpg' }, root)).toBeNull();
  });

  test('UPLOAD_DIR must be absolute', () => {
    expect(uploadRoot({ UPLOAD_DIR: '' } as never)).toBeNull();
    expect(() => uploadRoot({ UPLOAD_DIR: 'uploads' } as never)).toThrow();
    expect(uploadRoot({ UPLOAD_DIR: '/data/lams2-uploads/' } as never)).toBe('/data/lams2-uploads');
  });

  test('files no record uses are removed after the grace period; used and recent files stay', async () => {
    const used = await storeBlob('photos', '1001', 'png', Buffer.from('used'), root);
    const old = await storeBlob('photos', '1002', 'png', Buffer.from('old'), root);
    const recent = await storeBlob('photos', '1003', 'png', Buffer.from('recent'), root);
    const twoDaysAgo = (Date.now() - 2 * 86_400_000) / 1000;
    utimesSync(path.join(root, used.storagePath!), twoDaysAgo, twoDaysAgo);
    utimesSync(path.join(root, old.storagePath!), twoDaysAgo, twoDaysAgo);
    writeFileSync(path.join(root, 'photos', 'notes.txt'), 'x');
    utimesSync(path.join(root, 'photos', 'notes.txt'), twoDaysAgo, twoDaysAgo);
    const removed = await sweepOrphans(async (kind) => new Set(kind === 'photos' ? [used.storagePath!] : []), root);
    expect(removed).toBe(2);
    expect(existsSync(path.join(root, used.storagePath!))).toBe(true);
    expect(existsSync(path.join(root, old.storagePath!))).toBe(false);
    expect(existsSync(path.join(root, recent.storagePath!))).toBe(true);
  });
});
