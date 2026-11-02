import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { TtlCache } from '../lib/ttlCache';

/**
 * The organization's name, logo, address and copyright line. The login page, every
 * notification email and the settings page all read it, and the logo alone can be 2 MB,
 * so one copy is kept in memory instead of reading it from MySQL each time.
 * `clearOrganizationCache()` is called when the settings are saved.
 */
export interface OrganizationRow {
  orgName: string;
  logoData: string;
  address: string;
  copyrightText: string;
  updatedAt: string | null;
}

const cache = new TtlCache<OrganizationRow | null>(5 * 60_000, 1);

async function loadOrganization(): Promise<OrganizationRow | null> {
  const [list] = await pool.query<RowDataPacket[]>("SELECT org_name, logo_data, address, copyright_text, updated_at FROM organization_settings WHERE id = 'default' LIMIT 1");
  const row = list[0];
  if (!row) return null;
  return {
    orgName: String(row.org_name),
    logoData: String(row.logo_data ?? ''),
    address: String(row.address ?? ''),
    copyrightText: String(row.copyright_text ?? ''),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export const getOrganization = () => cache.getOrLoad('default', loadOrganization);
export const clearOrganizationCache = () => cache.clear();

/** Changes whenever the saved settings change (used as the ETag, so browsers re-download the logo only then). */
export function organizationTag(org: OrganizationRow): string {
  return `"org-${org.updatedAt ?? '0'}-${org.logoData.length}"`;
}
