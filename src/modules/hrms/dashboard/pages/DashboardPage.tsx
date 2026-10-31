import React, { useEffect, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { useSession } from '../../../../auth/SessionContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { dashboardApi, type DashboardData } from '../dashboardApi';
import { ManagerDashboard } from '../components/ManagerDashboard';
import { StaffDashboard } from '../components/StaffDashboard';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onOpenSlackModal?: () => void;
}

/** Dashboard of the active role. Everything shown is read from the server; the server decides what each role sees. */
export const DashboardPage: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { session } = useSession();
  const role = session?.activeRole ?? null;
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    dashboardApi.get()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the dashboard.'));
    return () => { cancelled = true; };
  }, [role]);

  return (
    <div className="space-y-6 pb-6">
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Pending requests and action center for your role" />
      {error && <div className="rounded-xl border border-error-border bg-error-subtle px-4 py-6 text-center text-xs text-error">{error}</div>}
      {!data && !error && <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">Loading…</div>}
      {data && (data.role === 'general_staff' ? <StaffDashboard data={data} onNavigate={onNavigate} /> : <ManagerDashboard data={data} onNavigate={onNavigate} />)}
    </div>
  );
};
