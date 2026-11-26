import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useSession } from '../../auth/SessionContext';
import { PageHeader } from '../../shared/components/PageHeader';
import { MasterRegistryPanel } from '../hrms/master/components/MasterRegistryPanel';
import { MasterCatalog, masterApi } from '../hrms/master/masterApi';

/**
 * PMS Master Settings: only the masters PMS uses: the designations of PMS employee types (no cadre) and the
 * M.Sc / PhD masters. The server lists and changes only these (masters.routes.ts PMS_MASTER_KEYS). Leave types,
 * leave groups, shifts, holidays and the other shared masters are kept in HRMS and apply to PMS from there
 * (leave/moduleScope.ts). The PMS Administrator changes them; the PMS Auditor reads.
 */
export const PmsMasterSettingsPage: React.FC = () => {
  const { session } = useSession();
  const readOnly = session?.activeRole !== 'administrator';
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    masterApi.catalog()
      .then((c) => !cancelled && setCatalog(c))
      .catch((error) => !cancelled && setCatalogError(error instanceof Error ? error.message : 'Could not load master definitions.'));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={Settings}
        title="Master Settings"
        subtitle={readOnly ? 'Read-only view of the PMS masters.' : 'The masters PMS uses: designations, M.Sc and PhD masters. Leave types, leave groups and shifts come from HRMS.'}
      />
      {!catalog && (
        <div className={`rounded-xl border px-4 py-6 text-center text-xs ${catalogError ? 'border-error-border bg-error-subtle text-error' : 'border-slate-200 bg-white text-slate-500'}`}>
          {catalogError ?? 'Loading…'}
        </div>
      )}
      {catalog && <MasterRegistryPanel catalog={catalog} readOnly={readOnly} />}
    </div>
  );
};
