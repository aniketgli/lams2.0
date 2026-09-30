import React from 'react';
import { useApp } from '../../../../context/AppContext';
import { StaffDashboard } from '../components/StaffDashboard';
import { ReportingManagerDashboard } from '../components/ReportingManagerDashboard';
import { ReviewingManagerDashboard } from '../components/ReviewingManagerDashboard';
import { AdminDashboard } from '../components/AdminDashboard';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { LayoutDashboard } from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onOpenSlackModal: () => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ onNavigate, onOpenSlackModal }) => {
  const { currentUser } = useApp();

  const renderRoleDashboard = () => {
    switch (currentUser.role) {
      case 'administrator':
        return <AdminDashboard onNavigate={onNavigate} onOpenSlackModal={onOpenSlackModal} />;
      case 'reporting_manager':
        return <ReportingManagerDashboard onNavigate={onNavigate} />;
      case 'reviewing_manager':
        return <ReviewingManagerDashboard onNavigate={onNavigate} />;
      case 'general_staff':
      default:
        return <StaffDashboard onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Real-time attendance overview, leave status, outdoor duty requisitions & action center"
      />
      {renderRoleDashboard()}
    </div>
  );
};

