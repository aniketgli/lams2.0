import React, { useEffect, useState } from 'react';
import { FileText, Layers, Settings, Users } from 'lucide-react';
import { useSession } from '../../auth/SessionContext';
import { PageHeader } from '../../shared/components/PageHeader';
import { LeavePolicyMaster } from '../hrms/master/components/LeavePolicyMaster';
import { LeaveGroupsPanel } from '../hrms/master/components/LeaveGroupsPanel';
import { MasterRegistryPanel } from '../hrms/master/components/MasterRegistryPanel';
import { TabStrip } from '../hrms/master/components/masterUi';
import { MasterCatalog, masterApi } from '../hrms/master/masterApi';

type Section = 'leaveTypes' | 'leaveGroups' | 'profile';
const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'leaveTypes', label: 'Leave Types', icon: FileText },
  { id: 'leaveGroups', label: 'Leave Groups', icon: Layers },
  { id: 'profile', label: 'Profile Masters', icon: Users },
];

/**
 * PMS Master Settings: only the masters PMS uses. Leave types for PMS employee types, leave groups made of them,
 * the designations of PMS employee types and the M.Sc / PhD masters. The server lists and changes only these
 * (masters.routes.ts PMS_MASTER_KEYS, leave/moduleScope.ts); shared masters (shifts, holidays, banks …) stay in HRMS.
 * The PMS Administrator changes them; the PMS Auditor reads.
 */
export const PmsMasterSettingsPage: React.FC = () => {
  const { session } = useSession();
  const readOnly = session?.activeRole !== 'administrator';
  const [section, setSection] = useState<Section>('leaveTypes');
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
        subtitle={readOnly ? 'Read-only view of the PMS masters.' : 'The masters PMS uses: leave types and groups of PMS employees, designations, M.Sc and PhD masters.'}
      />
      <TabStrip tabs={SECTIONS} value={section} onChange={setSection} />
      {section === 'leaveTypes' && <LeavePolicyMaster readOnly={readOnly} />}
      {section === 'leaveGroups' && <LeaveGroupsPanel readOnly={readOnly} />}
      {section === 'profile' && !catalog && (
        <div className={`rounded-xl border px-4 py-6 text-center text-xs ${catalogError ? 'border-error-border bg-error-subtle text-error' : 'border-slate-200 bg-white text-slate-500'}`}>
          {catalogError ?? 'Loading…'}
        </div>
      )}
      {section === 'profile' && catalog && <MasterRegistryPanel catalog={catalog} readOnly={readOnly} />}
    </div>
  );
};
