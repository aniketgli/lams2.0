import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';

/**
 * Where Aadhaar, PAN and bank details are kept (identity.ts says how they are checked, encrypted and shown):
 *   employee_identity        one row per employee: Aadhaar (encrypted + keyed hash + last 4), PAN
 *   employee_bank_accounts   bank accounts of an employee (one primary account today; room for more later)
 * Both have UNIQUE keys on the hashes / PAN, so the database itself refuses a number used by two employees.
 *
 * The rest of the code works with the "stored keys" object of identity.ts
 * (aadhaarEnc, aadhaarHash, aadhaarLast4, panNumber, bankName, bankIfsc, bankAccountEnc, bankAccountHash, bankAccountLast4).
 */

type Q = { query: typeof pool.query };
type Stored = Record<string, unknown>;

const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

/** Stored identity keys per biometric ID (all employees when `biometricIds` is null). */
export async function loadIdentities(q: Q, biometricIds: string[] | null): Promise<Map<string, Stored>> {
  const out = new Map<string, Stored>();
  if (biometricIds && biometricIds.length === 0) return out;
  const where = (col: string) => (biometricIds ? ` WHERE ${col} IN (${biometricIds.map(() => '?').join(',')})` : '');
  try {
    const [ids] = await q.query<RowDataPacket[]>(
      `SELECT biometric_id, aadhaar_enc, aadhaar_hash, aadhaar_last4, pan FROM employee_identity${where('biometric_id')}`, biometricIds ?? []);
    for (const r of ids) {
      out.set(String(r.biometric_id), {
        aadhaarEnc: text(r.aadhaar_enc), aadhaarHash: text(r.aadhaar_hash), aadhaarLast4: text(r.aadhaar_last4), panNumber: text(r.pan),
      });
    }
    const [banks] = await q.query<RowDataPacket[]>(
      `SELECT biometric_id, bank_name, ifsc, account_enc, account_hash, account_last4 FROM employee_bank_accounts${where('biometric_id')}
        ORDER BY is_primary DESC, id`, biometricIds ?? []);
    for (const r of banks) {
      const bio = String(r.biometric_id);
      const entry = out.get(bio) ?? {};
      if (entry.bankAccountHash) continue; // the primary (first) account only
      Object.assign(entry, {
        bankName: text(r.bank_name), bankIfsc: text(r.ifsc), bankAccountEnc: text(r.account_enc),
        bankAccountHash: text(r.account_hash), bankAccountLast4: text(r.account_last4),
      });
      out.set(bio, entry);
    }
  } catch (error) {
    // Before the migration has run the tables do not exist: no identity data yet.
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return out;
}

/** Writes the identity of one employee from the stored keys in `data` (missing keys clear the values). */
export async function saveIdentity(conn: PoolConnection, biometricId: string, data: Stored): Promise<void> {
  const aadhaar = text(data.aadhaarHash) ? { enc: text(data.aadhaarEnc), hash: text(data.aadhaarHash), last4: text(data.aadhaarLast4) } : null;
  const pan = text(data.panNumber);
  if (aadhaar || pan) {
    await conn.query(
      `INSERT INTO employee_identity (biometric_id, aadhaar_enc, aadhaar_hash, aadhaar_last4, pan) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE aadhaar_enc = VALUES(aadhaar_enc), aadhaar_hash = VALUES(aadhaar_hash),
                                 aadhaar_last4 = VALUES(aadhaar_last4), pan = VALUES(pan)`,
      [biometricId, aadhaar?.enc ?? null, aadhaar?.hash ?? null, aadhaar?.last4 ?? null, pan]);
  } else {
    await conn.query('DELETE FROM employee_identity WHERE biometric_id = ?', [biometricId]);
  }

  const hash = text(data.bankAccountHash);
  if (hash && text(data.bankName) && text(data.bankIfsc) && text(data.bankAccountEnc)) {
    const [current] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM employee_bank_accounts WHERE biometric_id = ? AND is_primary = 1 ORDER BY id LIMIT 1', [biometricId]);
    const values = [text(data.bankName), text(data.bankIfsc), text(data.bankAccountEnc), hash, text(data.bankAccountLast4)];
    if (current.length) {
      await conn.query(
        'UPDATE employee_bank_accounts SET bank_name = ?, ifsc = ?, account_enc = ?, account_hash = ?, account_last4 = ? WHERE id = ?',
        [...values, current[0].id]);
    } else {
      await conn.query(
        `INSERT INTO employee_bank_accounts (biometric_id, bank_name, ifsc, account_enc, account_hash, account_last4, is_primary)
         VALUES (?, ?, ?, ?, ?, ?, 1)`, [biometricId, ...values]);
    }
  } else {
    await conn.query('DELETE FROM employee_bank_accounts WHERE biometric_id = ? AND is_primary = 1', [biometricId]);
  }
}

/** Who already holds an Aadhaar hash / account hash / PAN (another employee than `biometricId`). */
export async function identityOwner(q: Q, kind: 'aadhaar' | 'account' | 'pan', value: string | null, biometricId: string): Promise<string | null> {
  if (!value) return null;
  const sql = kind === 'account'
    ? 'SELECT u.name, u.biometric_id FROM employee_bank_accounts b JOIN users u ON u.biometric_id = b.biometric_id WHERE b.account_hash = ? AND b.biometric_id <> ? LIMIT 1'
    : `SELECT u.name, u.biometric_id FROM employee_identity i JOIN users u ON u.biometric_id = i.biometric_id
        WHERE i.${kind === 'aadhaar' ? 'aadhaar_hash' : 'pan'} = ? AND i.biometric_id <> ? LIMIT 1`;
  const [found] = await q.query<RowDataPacket[]>(sql, [value, biometricId]);
  return found.length ? `${found[0].name} (B.I. ${found[0].biometric_id})` : null;
}
