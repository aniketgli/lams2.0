import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Clock, Cpu, FileText, Layers, Sliders, Users } from 'lucide-react';
import { useSession } from '../../../../auth/SessionContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { ActivityLogPanel, ActivitySource } from '../../../../shared/components/ActivityLogPanel';
import { activityEndpoints } from '../../../../shared/services/activityApi';
import { LeavePolicyMaster } from '../components/LeavePolicyMaster';
import { ShiftsPanel } from '../components/ShiftsPanel';
import { BiometricMachinesPanel } from '../components/BiometricMachinesPanel';
import { MasterRegistryPanel } from '../components/MasterRegistryPanel';
import { OrganizationPanel } from '../components/OrganizationPanel';
import { NotificationRecipientsCard } from '../components/NotificationRecipientsCard';
import { EmailSettingsCard } from '../components/EmailSettingsCard';
import { DefaultPasswordCard } from '../components/DefaultPasswordCard';
import { TabStrip } from '../components/masterUi';
import { MasterCatalog, masterApi } from '../masterApi';

type LeaveTab = 'types' | 'groups';
const LEAVE_TABS: { id: LeaveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'types', label: 'Leave types', icon: FileText },
  { id: 'groups', label: 'Leave groups', icon: Layers },
];

type Section = 'shifts' | 'biometric' | 'leave' | 'profile' | 'organization' | 'activity';

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'shifts', label: 'Shifts', icon: Clock },
  { id: 'biometric', label: 'Biometric Machines', icon: Cpu },
  { id: 'leave', label: 'Leave Policy', icon: FileText },
  { id: 'profile', label: 'Profile Masters', icon: Users },
  { id: 'organization', label: 'Organization', icon: Building2 },
];
const ACTIVITY_SECTION = { id: 'activity' as Section, label: 'Activity log', icon: FileText };

/**
 * Master Settings. Administrators can change everything; Auditors see the
 * same screens read-only plus an Activity log of every change (who, what, when,
 * with CSV / PDF downloads that are logged too). The server enforces both.
 */
export const MasterSettingsPage: React.FC = () => {
  const { session } = useSession();
  const readOnly = session?.activeRole !== 'administrator';
  const [section, setSection] = useState<Section>('shifts');
  const [leaveTab, setLeaveTab] = useState<LeaveTab>('types');
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    masterApi.catalog()
      .then((c) => !cancelled && setCatalog(c))
      .catch((error) => !cancelled && setCatalogError(error instanceof Error ? error.message : 'Could not load master definitions.'));
    return () => { cancelled = true; };
  }, []);

  const isAudit = session?.activeRole === 'audit';
  const needsCatalog = section === 'profile' || section === 'activity' || (section === 'leave' && leaveTab === 'groups');
  const activitySource = useMemo<ActivitySource | null>(() => !catalog ? null : ({
    title: 'Master settings activity log',
    recordLabel: 'Record',
    searchPlaceholder: 'Record, done by, reason…',
    areas: catalog.activityAreas.filter((a) => a.value !== 'master_export'),
    actions: ['CREATE', 'UPDATE', 'STATUS', 'DELETE', 'EXPORT'],
    ...activityEndpoints('/hrms/masters/activity', 'WII_Master_Settings_Activity.csv'),
  }), [catalog]);

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        icon={Sliders}
        title="Master Settings"
        subtitle={readOnly ? 'Read-only view of all masters.' : 'Shifts, devices, profile masters and organization details.'}
      />

      <TabStrip tabs={isAudit ? [...SECTIONS, ACTIVITY_SECTION] : SECTIONS} value={section} onChange={setSection} />

      {section === 'shifts' && <ShiftsPanel readOnly={readOnly} />}
      {section === 'biometric' && <BiometricMachinesPanel readOnly={readOnly} />}
      {section === 'leave' && (
        <>
          <TabStrip tabs={LEAVE_TABS} value={leaveTab} onChange={setLeaveTab} size="sm" />
          {leaveTab === 'types' && <LeavePolicyMaster readOnly={readOnly} />}
          {leaveTab === 'groups' && catalog && <MasterRegistryPanel catalog={catalog} group="leave" readOnly={readOnly} />}
        </>
      )}
      {section === 'organization' && (
        <>
          <OrganizationPanel readOnly={readOnly} />
          <EmailSettingsCard readOnly={readOnly} />
          <DefaultPasswordCard readOnly={readOnly} />
          <NotificationRecipientsCard readOnly={readOnly} />
        </>
      )}

      {needsCatalog && !catalog && (
        <div className={`rounded-xl border px-4 py-6 text-center text-xs ${catalogError ? 'border-error-border bg-error-subtle text-error' : 'border-slate-200 bg-white text-slate-500'}`}>
          {catalogError ?? 'Loading…'}
        </div>
      )}
      {/* Profile masters and the employee-form lists (salutation, gender, …) in one place. */}
      {catalog && section === 'activity' && isAudit && activitySource && <ActivityLogPanel source={activitySource} />}
      {catalog && section === 'profile' && <MasterRegistryPanel catalog={catalog} readOnly={readOnly} />}
    </div>
  );
};
