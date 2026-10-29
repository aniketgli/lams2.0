import React, { useEffect, useState } from 'react';
import { Building2, Clock, Cpu, FileText, History, ListChecks, Sliders, Users } from 'lucide-react';
import { useSession } from '../../../../auth/SessionContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { LeavePolicyMaster } from '../components/LeavePolicyMaster';
import { ShiftsPanel } from '../components/ShiftsPanel';
import { BiometricMachinesPanel } from '../components/BiometricMachinesPanel';
import { MasterRegistryPanel } from '../components/MasterRegistryPanel';
import { OrganizationPanel } from '../components/OrganizationPanel';
import { AuditTrailPanel } from '../components/AuditTrailPanel';
import { ReadOnlyNotice, TabStrip } from '../components/masterUi';
import { MasterCatalog, masterApi } from '../masterApi';

type Section = 'shifts' | 'biometric' | 'leave' | 'profile' | 'lists' | 'organization' | 'audit';

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'shifts', label: 'Shifts', icon: Clock },
  { id: 'biometric', label: 'Biometric Machines', icon: Cpu },
  { id: 'leave', label: 'Leave Policy', icon: FileText },
  { id: 'profile', label: 'Profile Masters', icon: Users },
  { id: 'lists', label: 'Employee Form Lists', icon: ListChecks },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'audit', label: 'Audit Trail', icon: History },
];

/**
 * Master Settings. Administrators can change everything; Auditors see the
 * same screens read-only plus the Audit Trail. The server enforces both.
 */
export const MasterSettingsPage: React.FC = () => {
  const { session } = useSession();
  const readOnly = session?.activeRole !== 'administrator';
  const [section, setSection] = useState<Section>('shifts');
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    masterApi.catalog()
      .then((c) => !cancelled && setCatalog(c))
      .catch((error) => !cancelled && setCatalogError(error instanceof Error ? error.message : 'Could not load master definitions.'));
    return () => { cancelled = true; };
  }, []);

  const needsCatalog = section === 'profile' || section === 'lists' || section === 'audit';

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={Sliders}
        title="Master Settings"
        subtitle={readOnly ? 'Read-only view of all masters, with the full change history.' : 'Shifts, devices, profile masters, form lists and organization details.'}
      />

      {readOnly && <ReadOnlyNotice />}

      <TabStrip tabs={SECTIONS} value={section} onChange={setSection} />

      {section === 'shifts' && <ShiftsPanel readOnly={readOnly} />}
      {section === 'biometric' && <BiometricMachinesPanel readOnly={readOnly} />}
      {/* Leave Policy is unchanged in this step. */}
      {section === 'leave' && <LeavePolicyMaster />}
      {section === 'organization' && <OrganizationPanel readOnly={readOnly} />}

      {needsCatalog && !catalog && (
        <div className={`rounded-xl border px-4 py-6 text-center text-xs ${catalogError ? 'border-error-border bg-error-subtle text-error' : 'border-slate-200 bg-white text-slate-500'}`}>
          {catalogError ?? 'Loading…'}
        </div>
      )}
      {catalog && section === 'profile' && <MasterRegistryPanel key="profile" catalog={catalog} group="profile" readOnly={readOnly} />}
      {catalog && section === 'lists' && <MasterRegistryPanel key="lists" catalog={catalog} group="lists" readOnly={readOnly} />}
      {catalog && section === 'audit' && <AuditTrailPanel catalog={catalog} />}
    </div>
  );
};
