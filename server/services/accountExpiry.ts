import { pool } from '../../src/db';
import { todayInIndia } from '../lib/validate';

/**
 * Keeps users.status in step with users.valid_upto, so the directory shows what sign-in enforces
 * (accountBlock.statusForValidity): active accounts past their validity become `expired`. Runs at start-up and every hour.
 */
export async function expireAccounts(today = todayInIndia()): Promise<number> {
  const [result] = await pool.query(
    `UPDATE users SET status = 'expired', last_updated_at = NOW(), last_update_summary = CONCAT('Validity ended on ', DATE_FORMAT(valid_upto, '%d %b %Y'))
      WHERE LOWER(status) = 'active' AND is_system = 0 AND valid_upto IS NOT NULL AND valid_upto < ?`, [today]);
  return Number((result as { affectedRows?: number }).affectedRows ?? 0);
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAccountExpiryJob(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const n = await expireAccounts();
      if (n) console.log(`[accounts] ${n} account${n === 1 ? '' : 's'} marked expired (validity date passed).`);
    } catch (error) {
      console.warn('[accounts] Could not check account validity:', error instanceof Error ? error.message : error);
    }
  };
  void tick();
  timer = setInterval(() => void tick(), 60 * 60_000);
  timer.unref?.();
}
