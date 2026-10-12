import React, { useState, useEffect } from 'react';
import { AttendanceView } from '../components/AttendanceView';
import { ManualAttendanceView } from '../components/ManualAttendanceView';
import { OutdoorDutyView } from '../components/OutdoorDutyView';
import { Clock, MapPin, CheckCircle2 } from 'lucide-react';

interface AttendanceManagementPageProps {
  initialTab?: string;
}

export const AttendanceManagementPage: React.FC<AttendanceManagementPageProps> = ({ initialTab = 'attendance' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'manual_attendance' | 'od'>(() => {
    if (initialTab === 'manual_attendance') return 'manual_attendance';
    if (initialTab === 'od') return 'od';
    return 'attendance';
  });

  useEffect(() => {
    if (initialTab === 'manual_attendance') {
      setActiveSubTab('manual_attendance');
    } else if (initialTab === 'od') {
      setActiveSubTab('od');
    } else if (initialTab === 'attendance') {
      setActiveSubTab('attendance');
    }
  }, [initialTab]);

  return (
    <div className="space-y-4">
      {/* Render Active View */}
      {activeSubTab === 'attendance' && <AttendanceView />}
      {activeSubTab === 'manual_attendance' && <ManualAttendanceView />}
      {activeSubTab === 'od' && <OutdoorDutyView />}
    </div>
  );
};

