import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Button, Badge, Input } from '../../../../shared/components';
import { WIILogo } from '../../../../shared/components/WIILogo';
import { ShiftMasterSection } from '../components/ShiftMasterSection';
import { LeavePolicyMaster } from '../components/LeavePolicyMaster';
import { ProfileMasterSection } from '../components/ProfileMasterSection';
import { formatOrgAddress } from '../../../../types';
import { AppSelect } from '../../../../shared/components/AppSelect';
import {
  Sliders,
  Clock,
  MapPin,
  FileText,
  Building2,
  CheckCircle,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  Sparkles,
  Eye,
  Check,
  Cpu,
  Fingerprint,
  Radio,
  Search,
  Power,
  ToggleLeft,
  ToggleRight,
  Server,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Pencil,
  Edit2,
  Phone,
  Mail,
  Globe,
  Landmark,
  Download
} from 'lucide-react';
import { exportHRMSToCSV, exportHRMSToPDF, HRMSExportColumn, HRMSFilterTag } from '../../utils/hrmsExportUtils';

export interface BiometricMachine {
  id: string; // DeviceId (e.g. BIO-01)
  name: string; // DeviceName (e.g. HQ Main Gate Turnstile A)
  deviceSR: string; // DeviceSR (Serial No, e.g. SRN-88492012)
  deviceModel: string;
  ipOrSerial: string;
  location: string;
  punchMode: 'BOTH' | 'IN_ONLY' | 'OUT_ONLY';
  countForAttendance: boolean; // CRITICAL: Determines if punches count for official attendance
  status: 'ACTIVE' | 'INACTIVE';
  purpose: 'ATTENDANCE' | 'ACCESS' | 'BOTH';
  lastSync: string;
  gateType?: string;
}

export const MasterSettingsPage: React.FC = () => {
  const { currentUser, orgBranding, updateOrgBranding, resetOrgBranding, setIsLogoViewerOpen, shifts } = useApp();

  const [activeSubMaster, setActiveSubMaster] = useState<
    'attendance' | 'biometric' | 'leave' | 'departments' | 'organization'
  >('attendance');

  // Organization Master State (Clean & Essential Only: Name, Logo, Address, Copyright)
  const [brandingOrgName, setBrandingOrgName] = useState(orgBranding.orgName || 'Wildlife Institute of India');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState(orgBranding.logoUrl || '');
  const [orgAddress, setOrgAddress] = useState(orgBranding.address || formatOrgAddress(orgBranding) || 'Chandrabani, Dehradun - 248001, Uttarakhand, India');
  const [orgCopyrightText, setOrgCopyrightText] = useState(
    orgBranding.copyrightText || `© ${new Date().getFullYear()} ${orgBranding.orgName || 'Wildlife Institute of India'} • Integrated Enterprise Suite`
  );

  useEffect(() => {
    setBrandingOrgName(orgBranding.orgName || 'Wildlife Institute of India');
    setBrandingLogoUrl(orgBranding.logoUrl || '');
    setOrgAddress(orgBranding.address || formatOrgAddress(orgBranding) || 'Chandrabani, Dehradun - 248001, Uttarakhand, India');
    setOrgCopyrightText(
      orgBranding.copyrightText || `© ${new Date().getFullYear()} ${orgBranding.orgName || 'Wildlife Institute of India'} • Integrated Enterprise Suite`
    );
  }, [orgBranding]);


  useEffect(() => {
    let cancelled = false;
    setIsLoadingMachines(true);
    fetch('/api/hrms/biometric-machines', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not load biometric machines.');
        return response.json();
      })
      .then((rows: any[]) => {
        if (cancelled) return;
        setBiometricMachines(rows.map((row) => ({
          id: row.id, name: row.fullName, deviceSR: row.serialNumber, deviceModel: row.shortName,
          ipOrSerial: row.ipAddress, location: '', punchMode: 'BOTH' as const,
          countForAttendance: row.purpose !== 'ACCESS', status: (row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE', purpose: (row.purpose || 'ATTENDANCE') as 'ATTENDANCE' | 'ACCESS' | 'BOTH', lastSync: '—'
        })));
      })
      .catch((error) => { if (!cancelled) showToast(error.message || 'Could not load biometric machines.'); })
      .finally(() => { if (!cancelled) setIsLoadingMachines(false); });

    fetch('/api/hrms/organization', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not load organization settings.');
        return response.json();
      })
      .then((row) => {
        if (cancelled || !row) return;
        const logo = row.logoData || '';
        setBrandingOrgName(row.orgName || '');
        setBrandingLogoUrl(logo);
        setOrgAddress(row.address || '');
        setOrgCopyrightText(row.copyrightText || '');
        updateOrgBranding({ orgName: row.orgName || '', logoUrl: logo, address: row.address || '', copyrightText: row.copyrightText || '' });
      })
      .catch((error) => { if (!cancelled) showToast(error.message || 'Could not load organization settings.'); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [toastMessage, setToastMessage] = useState<string>('');
  const [machineFormError, setMachineFormError] = useState<string>('');

  // Department & Location Master State
  const [departments, setDepartments] = useState([
    'Executive Administration',
    'IT & Systems',
    'Wildlife Research & Conservation',
    'HR & Finance',
    'Field Operations & Eco-Development'
  ]);
  const [newDepartment, setNewDepartment] = useState('');
  const [locations, setLocations] = useState([
    'Main Campus HQ, Dehradun',
    'Regional Station A, New Delhi',
    'North Division Camp, Tehri'
  ]);
  const [newLocation, setNewLocation] = useState('');

  // Biometric Machines Master State (database is the source of truth)
  const [biometricMachines, setBiometricMachines] = useState<BiometricMachine[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);


  // Biometric Machine Filters & Modal State
  const [machineSearchQuery, setMachineSearchQuery] = useState('');
  const [machineFilterCount, setMachineFilterCount] = useState<'ALL' | 'COUNTED' | 'EXCLUDED'>('ALL');

  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<BiometricMachine | null>(null);

  const [newMachineId, setNewMachineId] = useState('');
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineSR, setNewMachineSR] = useState('');
  const [newMachineModel, setNewMachineModel] = useState('');
  const [newMachineIp, setNewMachineIp] = useState('');
  const [newMachineLocation, setNewMachineLocation] = useState('Main Campus HQ, Dehradun');
  const [newMachinePunchMode, setNewMachinePunchMode] = useState<'BOTH' | 'IN_ONLY' | 'OUT_ONLY'>('BOTH');
  const [newMachineCountForAttendance, setNewMachineCountForAttendance] = useState(true);
  const [newMachineStatus, setNewMachineStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [newMachinePurpose, setNewMachinePurpose] = useState<'ATTENDANCE' | 'ACCESS' | 'BOTH'>('ATTENDANCE');
  const [newMachineGateType, setNewMachineGateType] = useState('General Entry Gate');

  // Filtered Biometric Machines List
  const filteredMachines = useMemo(() => {
    return biometricMachines.filter((m) => {
      const query = machineSearchQuery.toLowerCase();
      const matchesSearch =
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query) ||
        (m.deviceSR && m.deviceSR.toLowerCase().includes(query)) ||
        m.ipOrSerial.toLowerCase().includes(query) ||
        m.location.toLowerCase().includes(query) ||
        m.deviceModel.toLowerCase().includes(query);

      if (machineFilterCount === 'COUNTED' && !m.countForAttendance) return false;
      if (machineFilterCount === 'EXCLUDED' && m.countForAttendance) return false;

      return matchesSearch;
    });
  }, [biometricMachines, machineSearchQuery, machineFilterCount]);

  const getBiometricMachinesExportConfig = () => {
    const activeFiltersList: HRMSFilterTag[] = [
      {
        label: 'Attendance Counting Status',
        value: machineFilterCount === 'ALL' ? 'All Machines' : machineFilterCount === 'COUNTED' ? 'Counted Only' : 'Excluded Only'
      }
    ];
    if (machineSearchQuery.trim()) {
      activeFiltersList.push({ label: 'Search Query', value: machineSearchQuery.trim() });
    }

    const columns: HRMSExportColumn[] = [
      { header: '#', key: 'sno', width: 10, align: 'center' },
      { header: 'Device ID', key: 'deviceId', width: 22 },
      { header: 'Device Name', key: 'name', width: 38 },
      { header: 'Location / Area', key: 'location', width: 34 },
      { header: 'IP / Terminal Address', key: 'ipOrSerial', width: 28 },
      { header: 'Device Serial (SR)', key: 'deviceSR', width: 28 },
      { header: 'Count for Attendance', key: 'attendanceCountStr', width: 22, align: 'center' },
      { header: 'Status', key: 'statusStr', width: 18, align: 'center' }
    ];

    const exportData = filteredMachines.map((m, idx) => ({
      sno: idx + 1,
      deviceId: m.id,
      name: m.name,
      location: m.location,
      ipOrSerial: m.ipOrSerial,
      deviceSR: m.deviceSR || '-',
      attendanceCountStr: m.countForAttendance ? 'Counted' : 'Excluded',
      statusStr: m.status
    }));

    return {
      title: 'Biometric Machines & Hardware Terminals Register',
      subtitle: 'Central Hardware Gate Punch Readers, Terminal Mapping & IP Network Configuration',
      category: 'HRMS • Hardware & Device Management',
      institution: 'WILDLIFE INSTITUTE OF INDIA (WII)',
      generatedBy: {
        name: currentUser.name,
        designation: currentUser.designation,
        department: currentUser.department,
        email: currentUser.email
      },
      filters: activeFiltersList,
      summaryItems: [
        { label: 'Total Machines', value: filteredMachines.length },
        { label: 'Counted for Attendance', value: filteredMachines.filter((m) => m.countForAttendance).length },
        { label: 'Excluded Devices', value: filteredMachines.filter((m) => !m.countForAttendance).length }
      ],
      columns,
      data: exportData,
      fileName: `WII_Biometric_Machines_Register_${new Date().toISOString().split('T')[0]}`
    };
  };

  const handleExportMachinesCSV = () => {
    if (filteredMachines.length === 0) {
      showToast('No machines match current filters.');
      return;
    }
    const config = getBiometricMachinesExportConfig();
    exportHRMSToCSV(config);
    showToast('Biometric machines register exported to CSV successfully.');
  };

  const handleExportMachinesPDF = () => {
    if (filteredMachines.length === 0) {
      showToast('No machines match current filters.');
      return;
    }
    const config = getBiometricMachinesExportConfig();
    exportHRMSToPDF({
      ...config,
      orientation: 'landscape'
    });
    showToast('Biometric machines register PDF report downloaded.');
  };

  // Biometric Machine Handlers
  const handleToggleCountForAttendance = (id: string) => {
    setBiometricMachines((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextVal = !m.countForAttendance;
          showToast(
            `Machine "${m.name}" punches will now be ${nextVal ? 'COUNTED for daily attendance' : 'EXCLUDED / IGNORED for attendance'}`
          );
          return { ...m, countForAttendance: nextVal };
        }
        return m;
      })
    );
  };

  const handleToggleStatus = async (machine: BiometricMachine) => {
    const newStatus: 'ACTIVE' | 'INACTIVE' = machine.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const response = await fetch(`/api/hrms/biometric-machines/${encodeURIComponent(machine.id)}/status`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not update machine status.');
      setBiometricMachines((prev) => prev.map((m) => m.id === machine.id ? { ...m, status: newStatus } : m));
      showToast(`Machine "${machine.name}" is now ${newStatus.toLowerCase()}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update machine status.');
    }
  };

  const handleDeleteMachine = async (id: string) => {
    try {
      const response = await fetch(`/api/hrms/biometric-machines/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not delete biometric machine.');
      setBiometricMachines((prev) => prev.filter((m) => m.id !== id));
      showToast('Biometric machine deleted from database.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete biometric machine.');
    }
  };

  const handleOpenEditMachineModal = (machine: BiometricMachine) => {
    setEditingMachine(machine);
    setNewMachineId(machine.id);
    setNewMachineName(machine.name);
    setNewMachineSR(machine.deviceSR || '');
    setNewMachineModel(machine.deviceModel);
    setNewMachineIp(machine.ipOrSerial);
    setNewMachineLocation(machine.location);
    setNewMachinePunchMode(machine.punchMode);
    setNewMachineCountForAttendance(machine.countForAttendance);
    setNewMachineStatus(machine.status);
    setNewMachinePurpose(machine.purpose || 'ATTENDANCE');
    setNewMachineGateType(machine.gateType || 'General Entry Gate');
  };

  const handleCreateOrUpdateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newMachineId.trim();
    const fullName = newMachineName.trim();
    const shortName = newMachineModel.trim();
    const serialNumber = newMachineSR.trim();
    const ipAddress = newMachineIp.trim();
    setMachineFormError('');
    if (!id || !fullName || !shortName || !serialNumber || !ipAddress) {
      setMachineFormError('Please fill all required fields before saving.');
      return;
    }
    const payload = { id, fullName, shortName, serialNumber, ipAddress, status: newMachineStatus, purpose: newMachinePurpose };
    try {
      const response = await fetch(
        editingMachine ? `/api/hrms/biometric-machines/${encodeURIComponent(editingMachine.id)}` : '/api/hrms/biometric-machines',
        { method: editingMachine ? 'PUT' : 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save biometric machine.');
      const saved: BiometricMachine = {
        id, name: fullName, deviceSR: serialNumber, deviceModel: shortName, ipOrSerial: ipAddress,
        location: '', punchMode: 'BOTH', countForAttendance: newMachinePurpose !== 'ACCESS', status: newMachineStatus, purpose: newMachinePurpose, lastSync: '—'
      };
      setBiometricMachines((prev) => editingMachine
        ? prev.map((machine) => machine.id === editingMachine.id ? saved : machine)
        : [...prev, saved]);
      setShowAddMachineModal(false);
      setEditingMachine(null);
      setMachineFormError('');
      showToast(editingMachine ? 'Biometric machine updated successfully.' : 'Biometric machine saved successfully.');
    } catch (error) {
      setMachineFormError(error instanceof Error ? error.message : 'Could not save biometric machine.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDepartment.trim()) {
      setDepartments([...departments, newDepartment.trim()]);
      setNewDepartment('');
      showToast('New department added!');
    }
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocation.trim()) {
      setLocations([...locations, newLocation.trim()]);
      setNewLocation('');
      showToast('New office location added!');
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Uniform Page Header */}
      <PageHeader
        icon={Sliders}
        title="Master Configuration"
        subtitle="Manage sub-masters for Attendance Timings, Leave Policies, Departments & Organization Master"
      />

      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center space-x-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sub-Master Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-wrap gap-1">
        <button
          onClick={() => setActiveSubMaster('attendance')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubMaster === 'attendance'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Attendance Master</span>
        </button>

        <button
          onClick={() => setActiveSubMaster('biometric')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubMaster === 'biometric'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Biometric Machines Master</span>
        </button>

        <button
          onClick={() => setActiveSubMaster('leave')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubMaster === 'leave'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Leave Policy Master</span>
        </button>

        <button
          onClick={() => setActiveSubMaster('departments')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubMaster === 'departments'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Profile Master</span>
        </button>

        <button
          onClick={() => setActiveSubMaster('organization')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubMaster === 'organization'
              ? 'bg-[#2563eb] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Organization Master</span>
        </button>
      </div>

      {/* SUB-MASTER 1: ATTENDANCE & SHIFT MASTER */}
      {activeSubMaster === 'attendance' && <ShiftMasterSection />}

      {/* SUB-MASTER 2: BIOMETRIC MACHINES MASTER */}
      {activeSubMaster === 'biometric' && (
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-600" />
                Biometric Machine
                <span className="text-xs font-semibold text-slate-500">({biometricMachines.length})</span>
              </h3>
              <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingMachine(null); setMachineFormError(''); setNewMachineId(''); setNewMachineName('');
                  setNewMachineSR(''); setNewMachineModel(''); setNewMachineIp('');
                  setNewMachineStatus('ACTIVE'); setNewMachinePurpose('ATTENDANCE'); setShowAddMachineModal(true);
                }}>
                New Biometric Machine
              </Button>
            </div>
          </section>
          <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="w-[8%] px-3 py-3 font-bold whitespace-nowrap">Device ID</th>
                    <th className="w-[19%] px-3 py-3 font-bold">Device Full Name</th>
                    <th className="w-[10%] px-3 py-3 font-bold whitespace-nowrap">Short Name</th>
                    <th className="w-[15%] px-3 py-3 font-bold whitespace-nowrap">Serial Number</th>
                    <th className="w-[14%] px-3 py-3 font-bold whitespace-nowrap">IP Address</th>
                    <th className="w-[12%] px-3 py-3 font-bold whitespace-nowrap">Purpose</th>
                    <th className="w-[10%] px-3 py-3 font-bold whitespace-nowrap">Status</th>
                    <th className="w-[12%] px-3 py-3 font-bold text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingMachines ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading biometric machines…</td></tr>
                  ) : filteredMachines.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No biometric machines found. Use “New Biometric Machine” to add one.</td></tr>
                  ) : filteredMachines.map((machine) => (
                    <tr key={machine.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono font-semibold bg-slate-100 border border-slate-200 rounded px-2 py-1">{machine.id}</span></td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{machine.name}</td>
                      <td className="px-3 py-3 font-mono">{machine.deviceModel}</td>
                      <td className="px-3 py-3 font-mono">{machine.deviceSR}</td>
                      <td className="px-3 py-3 font-mono">{machine.ipOrSerial}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${machine.purpose === 'ACCESS' ? 'bg-violet-50 text-violet-700 border-violet-200' : machine.purpose === 'BOTH' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {machine.purpose === 'BOTH' ? 'Attendance & Access' : machine.purpose === 'ACCESS' ? 'Access' : 'Attendance'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => handleToggleStatus(machine)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${machine.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'}`} title="Click to toggle active/inactive">
                          <span className={`h-1.5 w-1.5 rounded-full ${machine.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {machine.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => { handleOpenEditMachineModal(machine); setShowAddMachineModal(true); }} className="h-8 w-8 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center justify-center" title="Edit machine"><Pencil className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => handleDeleteMachine(machine.id)} className="h-8 w-8 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 inline-flex items-center justify-center" title="Delete machine"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {showAddMachineModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
              <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-5 py-4 bg-[#101c3a] text-white flex items-center justify-between">
                  <div><h3 className="font-bold text-base">{editingMachine ? `Edit Biometric Machine · ${editingMachine.id}` : 'New Biometric Machine'}</h3><p className="text-xs text-slate-300 mt-1">Configure device details, purpose and availability</p></div>
                  <button type="button" onClick={() => { setShowAddMachineModal(false); setEditingMachine(null); setMachineFormError(''); }} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10" aria-label="Close"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleCreateOrUpdateMachine} className="p-5 space-y-4 overflow-y-auto">
                  {machineFormError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div className="flex-1">{machineFormError}</div><button type="button" onClick={() => setMachineFormError('')} className="text-rose-700 hover:text-rose-900" aria-label="Dismiss error"><X className="w-4 h-4" /></button></div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">Device ID *
                      <input required value={newMachineId} disabled={!!editingMachine} onChange={(e) => setNewMachineId(e.target.value)} placeholder="e.g. BIO-01" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">Short Name *
                      <input required value={newMachineModel} onChange={(e) => setNewMachineModel(e.target.value)} placeholder="e.g. MAIN-GATE" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">Device Full Name *
                      <input required value={newMachineName} onChange={(e) => setNewMachineName(e.target.value)} placeholder="e.g. Main Office Attendance Device" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">Serial Number *
                      <input required value={newMachineSR} onChange={(e) => setNewMachineSR(e.target.value)} placeholder="Enter serial number" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">IP Address *
                      <input required value={newMachineIp} onChange={(e) => setNewMachineIp(e.target.value)} placeholder="192.168.1.100" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">Purpose *
                      <select value={newMachinePurpose} onChange={(e) => setNewMachinePurpose(e.target.value as 'ATTENDANCE' | 'ACCESS' | 'BOTH')} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
                        <option value="ATTENDANCE">Attendance</option><option value="ACCESS">Access</option><option value="BOTH">Attendance &amp; Access</option>
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">Status *
                      <select value={newMachineStatus} onChange={(e) => setNewMachineStatus(e.target.value as 'ACTIVE' | 'INACTIVE')} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
                        <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => { setShowAddMachineModal(false); setEditingMachine(null); }} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">Cancel</button>
                    <button type="submit" className="h-10 px-5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 inline-flex items-center gap-2"><Save className="w-4 h-4" />{editingMachine ? 'Save Changes' : 'Add Machine'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-MASTER 3: LEAVE POLICY & ENTITLEMENT MASTER */}
      {activeSubMaster === 'leave' && <LeavePolicyMaster />}

      {/* SUB-MASTER 4: PROFILE MASTER (DEPARTMENTS, DESIGNATIONS, PROJECTS, COURSES, BATCHES, CATEGORIES, LOCATIONS) */}
      {activeSubMaster === 'departments' && <ProfileMasterSection />}

      {/* SUB-MASTER 5: ORGANIZATION MASTER */}
      {activeSubMaster === 'organization' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-[#2563eb]" />
                  <span>Organization Master</span>
                </h2>
                
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLogoViewerOpen(true)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Preview Logo Viewer Modal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetOrgBranding();
                    showToast('Organization settings reset to default Wildlife Institute of India specifications!');
                  }}
                  className="px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Reset Default</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Focused Essential Settings (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* 1. Organization Name */}
                <div className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 space-y-3">
                  <span className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Building2 className="w-4 h-4 text-[#2563eb]" />
                    <span>Organization Name</span>
                  </span>
                  <div>
                    <input
                      type="text"
                      required
                      value={brandingOrgName}
                      onChange={(e) => setBrandingOrgName(e.target.value)}
                      placeholder="e.g. Wildlife Institute of India"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      The official legal title of your institution/organization.
                    </p>
                  </div>
                </div>

                {/* 2. Logo Upload & Configuration */}
                <div className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5 uppercase tracking-wider">
                      <ImageIcon className="w-4 h-4 text-[#2563eb]" />
                      <span>Upload Logo</span>
                    </span>
                    <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                      Linked to all pages
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center space-x-2 shadow-2xs">
                        <Upload className="w-4 h-4 text-amber-300" />
                        <span>Upload Logo File</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
                                showToast('Please choose PNG, JPG or WEBP logo under 2 MB.');
                                e.currentTarget.value = '';
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result) {
                                  setBrandingLogoUrl(evt.target.result as string);
                                  showToast('Logo uploaded and updated in preview!');
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {brandingLogoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setBrandingLogoUrl('');
                            showToast('Logo cleared!');
                          }}
                          className="px-3 py-2 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center space-x-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Logo</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Or enter direct Image URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={brandingLogoUrl}
                        onChange={(e) => setBrandingLogoUrl(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                      />
                    </div>

                    {/* Logo Active Preview Box */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                          Current Logo Status
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {brandingLogoUrl ? 'Custom Logo Uploaded' : 'No Logo Uploaded (Default dynamic mark active)'}
                        </span>
                      </div>
                      <div className="h-12 w-28 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center p-1.5 overflow-hidden">
                        {brandingLogoUrl ? (
                          <img src={brandingLogoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">No Image</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Institutional Address */}
                <div className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5 uppercase tracking-wider">
                      <MapPin className="w-4 h-4 text-[#2563eb]" />
                      <span>Organization Address</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Footer Right
                    </span>
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      required
                      value={orgAddress}
                      onChange={(e) => setOrgAddress(e.target.value)}
                      placeholder="e.g. Chandrabani, Dehradun - 248001, Uttarakhand, India"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      This address is displayed on the right side of the footer across all screens.
                    </p>
                  </div>
                </div>

                {/* 4. Footer Copyright Notice */}
                <div className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5 uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-[#2563eb]" />
                      <span>Footer Copyright Notice</span>
                    </span>
                    <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                      Footer Left
                    </span>
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      value={orgCopyrightText}
                      onChange={(e) => setOrgCopyrightText(e.target.value)}
                      placeholder="e.g. © 2026 Wildlife Institute of India • Integrated Enterprise Suite"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      This notice is displayed on the left side of the footer across all screens.
                    </p>
                  </div>
                </div>

                {/* Save & Reset Actions */}
                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/hrms/organization', {
                          method: 'PUT', credentials: 'same-origin',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orgName: brandingOrgName, logoData: brandingLogoUrl, address: orgAddress, copyrightText: orgCopyrightText })
                        });
                        const result = await response.json().catch(() => ({}));
                        if (!response.ok) throw new Error(result.error || 'Could not save organization settings.');
                        updateOrgBranding({
                          orgName: result.orgName, logoUrl: result.logoData || '', logoType: 'custom',
                          address: result.address || '', copyrightText: result.copyrightText || ''
                        });
                        showToast('Organization settings saved to database.');
                      } catch (error) {
                        showToast(error instanceof Error ? error.message : 'Could not save organization settings.');
                      }
                    }}
                    className="px-6 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-amber-300" />
                    <span>Save Organization Settings</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live Interactive Previews (5 cols) */}
              <div className="lg:col-span-5 bg-slate-100 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Live Real-time Previews</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Real-time
                  </span>
                </div>

                {/* Simulated Sidebar Header */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">
                    Sidebar / Header Logo Preview
                  </p>
                  <WIILogo
                    variant="horizontal"
                    size="md"
                    customLogoUrl={brandingLogoUrl}
                  />
                </div>

                {/* Simulated Live Footer Preview (Copyright on left, Address on right) */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">
                      Live Portal Footer Layout
                    </p>
                    <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      Linked
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-[11px] space-y-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="font-semibold text-slate-700 text-[10.5px]">
                        {orgCopyrightText || `© 2026 ${brandingOrgName || 'Organization'}`}
                      </div>
                      <div className="flex items-center space-x-1 text-[#2563eb] font-semibold text-[10.5px]">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{orgAddress || 'Address not specified'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 font-medium space-y-1">
                  <p className="font-bold flex items-center space-x-1">
                    <span>💡 Dynamic Integration Notice</span>
                  </p>
                  <p>
                    Any logo uploaded or address edited here immediately synchronizes with all application screens (Sidebar, Header, Login, and Footers) with zero hardcoding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

