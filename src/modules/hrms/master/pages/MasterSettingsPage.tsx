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
  Landmark
} from 'lucide-react';

export interface BiometricMachine {
  id: string; // DeviceId (e.g. BIO-01)
  name: string; // DeviceName (e.g. HQ Main Gate Turnstile A)
  deviceSR: string; // DeviceSR (Serial No, e.g. SRN-88492012)
  deviceModel: string;
  ipOrSerial: string;
  location: string;
  punchMode: 'BOTH' | 'IN_ONLY' | 'OUT_ONLY';
  countForAttendance: boolean; // CRITICAL: Determines if punches count for official attendance
  status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
  lastSync: string;
  gateType?: string;
}

export const MasterSettingsPage: React.FC = () => {
  const { orgBranding, updateOrgBranding, resetOrgBranding, setIsLogoViewerOpen, shifts } = useApp();

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

  const [toastMessage, setToastMessage] = useState<string>('');

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

  // Biometric Machines Master State
  const [biometricMachines, setBiometricMachines] = useState<BiometricMachine[]>([
    {
      id: 'BIO-01',
      name: 'HQ Main Gate Turnstile A',
      deviceSR: 'SRN-88492012',
      deviceModel: 'eSSL SilkBio-101TC',
      ipOrSerial: '192.168.1.101',
      location: 'Main Campus HQ, Dehradun',
      punchMode: 'BOTH',
      countForAttendance: true,
      status: 'ACTIVE',
      lastSync: 'Today, 08:30',
      gateType: 'Main Entry / Exit Gate'
    },
    {
      id: 'BIO-02',
      name: 'Admin Block Reception Bio-Reader',
      deviceSR: 'SRN-88492013',
      deviceModel: 'ZKTeco uFace800',
      ipOrSerial: '192.168.1.102',
      location: 'Main Campus HQ, Dehradun',
      punchMode: 'BOTH',
      countForAttendance: true,
      status: 'ACTIVE',
      lastSync: 'Today, 08:28',
      gateType: 'Administration Wing'
    },
    {
      id: 'BIO-03',
      name: 'Research Wing B Lab Turnstile',
      deviceSR: 'SRN-88492015',
      deviceModel: 'Matrix COSEC Door',
      ipOrSerial: '192.168.1.105',
      location: 'Research Wing B',
      punchMode: 'IN_ONLY',
      countForAttendance: true,
      status: 'ACTIVE',
      lastSync: 'Today, 08:15',
      gateType: 'Research Laboratory'
    },
    {
      id: 'BIO-04',
      name: 'Central Cafeteria / Mess Entrance',
      deviceSR: 'SRN-88492020',
      deviceModel: 'Realtime T502',
      ipOrSerial: '192.168.1.110',
      location: 'Central Cafeteria',
      punchMode: 'BOTH',
      countForAttendance: false, // Excluded from official attendance calculation
      status: 'ACTIVE',
      lastSync: 'Today, 08:00',
      gateType: 'Cafeteria / Mess Counter'
    },
    {
      id: 'BIO-05',
      name: 'Regional Station A Main Door',
      deviceSR: 'SRN-88492025',
      deviceModel: 'eSSL MB20',
      ipOrSerial: '10.0.4.15',
      location: 'Regional Station A, New Delhi',
      punchMode: 'BOTH',
      countForAttendance: true,
      status: 'ACTIVE',
      lastSync: 'Yesterday, 18:45',
      gateType: 'Regional Gate'
    },
    {
      id: 'BIO-06',
      name: 'IT Lab Test & Demo Device',
      deviceSR: 'SRN-88492030',
      deviceModel: 'ZKTeco K40',
      ipOrSerial: '192.168.1.200',
      location: 'IT Server Room',
      punchMode: 'BOTH',
      countForAttendance: false, // Excluded from official attendance calculation
      status: 'MAINTENANCE',
      lastSync: '2 days ago',
      gateType: 'Testing Lab'
    }
  ]);

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
  const [newMachineStatus, setNewMachineStatus] = useState<'ACTIVE' | 'MAINTENANCE' | 'DISABLED'>('ACTIVE');
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

  const handleToggleStatus = (id: string, newStatus: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED') => {
    setBiometricMachines((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          showToast(`Machine "${m.name}" status set to ${newStatus}`);
          return { ...m, status: newStatus };
        }
        return m;
      })
    );
  };

  const handleDeleteMachine = (id: string) => {
    setBiometricMachines((prev) => prev.filter((m) => m.id !== id));
    showToast('Biometric machine removed from master list.');
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
    setNewMachineGateType(machine.gateType || 'General Entry Gate');
  };

  const handleCreateOrUpdateMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName.trim()) return;

    if (editingMachine) {
      // Update existing machine
      setBiometricMachines((prev) =>
        prev.map((m) => {
          if (m.id === editingMachine.id) {
            return {
              ...m,
              name: newMachineName.trim(),
              deviceSR: newMachineSR.trim() || `SRN-${Math.floor(10000000 + Math.random() * 90000000)}`,
              deviceModel: newMachineModel.trim() || 'eSSL / ZKTeco Reader',
              ipOrSerial: newMachineIp.trim() || '192.168.1.150',
              location: newMachineLocation,
              punchMode: newMachinePunchMode,
              countForAttendance: newMachineCountForAttendance,
              status: newMachineStatus,
              gateType: newMachineGateType || 'General Entry Gate'
            };
          }
          return m;
        })
      );
      showToast(`Biometric Machine "${newMachineName.trim()}" updated successfully!`);
      setEditingMachine(null);
    } else {
      // Create new machine
      const newMachine: BiometricMachine = {
        id: newMachineId.trim() || `BIO-0${biometricMachines.length + 1}`,
        name: newMachineName.trim(),
        deviceSR: newMachineSR.trim() || `SRN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        deviceModel: newMachineModel.trim() || 'eSSL / ZKTeco Reader',
        ipOrSerial: newMachineIp.trim() || '192.168.1.150',
        location: newMachineLocation,
        punchMode: newMachinePunchMode,
        countForAttendance: newMachineCountForAttendance,
        status: newMachineStatus,
        lastSync: 'Just now',
        gateType: newMachineGateType || 'General Entry Gate'
      };

      setBiometricMachines([...biometricMachines, newMachine]);
      showToast(`New Biometric Machine "${newMachine.name}" added successfully!`);
    }

    setShowAddMachineModal(false);
    setEditingMachine(null);
    setNewMachineId('');
    setNewMachineName('');
    setNewMachineSR('');
    setNewMachineModel('');
    setNewMachineIp('');
    setNewMachineCountForAttendance(true);
    setNewMachineStatus('ACTIVE');
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
    <div className="space-y-6">
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
        <div className="space-y-5">
          {/* Top Banner & Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-emerald-700" />
                  <span>Biometric Machines &amp; Punch Devices Master</span>
                </h3>
                
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingMachine(null);
                  setNewMachineId(`BIO-0${biometricMachines.length + 1}`);
                  setNewMachineName('');
                  setNewMachineSR(`SRN-${Math.floor(10000000 + Math.random() * 90000000)}`);
                  setNewMachineModel('');
                  setNewMachineIp('');
                  setNewMachineLocation('Main Campus HQ, Dehradun');
                  setNewMachinePunchMode('BOTH');
                  setNewMachineCountForAttendance(true);
                  setNewMachineStatus('ACTIVE');
                  setNewMachineGateType('General Entry Gate');
                  setShowAddMachineModal(true);
                }}
              >
                Add Biometric Machine
              </Button>
            </div>

            {/* Summary KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Machines</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">{biometricMachines.length}</span>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-lg">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Counted for Attendance</span>
                <span className="text-lg font-black text-emerald-700 mt-0.5 block flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4 inline text-emerald-600 mr-1" />
                  {biometricMachines.filter((m) => m.countForAttendance).length}
                </span>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-lg">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Excluded / Informational</span>
                <span className="text-lg font-black text-amber-800 mt-0.5 block flex items-center space-x-1">
                  <XCircle className="w-4 h-4 inline text-amber-600 mr-1" />
                  {biometricMachines.filter((m) => !m.countForAttendance).length}
                </span>
              </div>

              <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-lg">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">Active Devices</span>
                <span className="text-lg font-black text-blue-700 mt-0.5 block flex items-center space-x-1">
                  <Server className="w-4 h-4 inline text-blue-600 mr-1" />
                  {biometricMachines.filter((m) => m.status === 'ACTIVE').length}
                </span>
              </div>
            </div>

            {/* Search & Uniform Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="w-full sm:w-80">
                <Input
                  placeholder="Search Device Name, Device SR, Device ID, IP, location..."
                  value={machineSearchQuery}
                  onChange={(e) => setMachineSearchQuery(e.target.value)}
                  leftIcon={Search}
                  size="sm"
                />
              </div>

              <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end">
                <span className="text-xs font-semibold text-slate-500 mr-1">Filter:</span>
                <Button
                  size="xs"
                  variant={machineFilterCount === 'ALL' ? 'primary' : 'outline'}
                  onClick={() => setMachineFilterCount('ALL')}
                >
                  All ({biometricMachines.length})
                </Button>
                <Button
                  size="xs"
                  variant={machineFilterCount === 'COUNTED' ? 'primary' : 'outline'}
                  onClick={() => setMachineFilterCount('COUNTED')}
                >
                  Counted ({biometricMachines.filter((m) => m.countForAttendance).length})
                </Button>
                <Button
                  size="xs"
                  variant={machineFilterCount === 'EXCLUDED' ? 'primary' : 'outline'}
                  onClick={() => setMachineFilterCount('EXCLUDED')}
                >
                  Excluded ({biometricMachines.filter((m) => !m.countForAttendance).length})
                </Button>
              </div>
            </div>
          </div>

          {/* Biometric Machines Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs w-full">
            <div className="w-full overflow-hidden">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr className="h-10">
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[18%]">Device ID</th>
                    <th className="px-4 py-2.5 align-middle w-[36%]">Location / IP</th>
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[22%]">Device SR</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[14%]">Status</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap align-middle w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMachines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                        No biometric machines found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMachines.map((machine) => (
                      <tr key={machine.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Device ID */}
                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg shrink-0 ${machine.countForAttendance ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-600'}`}>
                              <Cpu className="w-4 h-4" />
                            </div>
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs inline-block">
                              {machine.id}
                            </span>
                          </div>
                        </td>

                        {/* 2. Location / IP */}
                        <td className="px-4 py-3 align-middle">
                          <div className="font-bold text-slate-900 leading-snug">{machine.location}</div>
                          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] border border-slate-200/80">
                              IP: {machine.ipOrSerial}
                            </span>
                          </div>
                        </td>

                        {/* 3. Device SR */}
                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                          <span className="font-mono font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-xs inline-block">
                            {machine.deviceSR || 'SRN-88492012'}
                          </span>
                        </td>

                        {/* 4. Status */}
                        <td className="px-4 py-3 text-center whitespace-nowrap align-middle">
                          <select
                            value={machine.status}
                            onChange={(e) => handleToggleStatus(machine.id, e.target.value as any)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none cursor-pointer text-center ${
                              machine.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : machine.status === 'MAINTENANCE'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="MAINTENANCE">MAINTENANCE</option>
                            <option value="DISABLED">DISABLED</option>
                          </select>
                        </td>

                        {/* 5. Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenEditMachineModal(machine);
                                setShowAddMachineModal(true);
                              }}
                              className="h-7 w-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold cursor-pointer text-xs inline-flex items-center justify-center border border-blue-200/80 transition-all shrink-0 active:scale-95 shadow-2xs"
                              title="Edit Biometric Machine Details"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-600 stroke-[2]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMachine(machine.id)}
                              className="h-7 w-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold cursor-pointer text-xs inline-flex items-center justify-center border border-rose-200/80 transition-all shrink-0 active:scale-95 shadow-2xs"
                              title="Delete Machine"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600 stroke-[2]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Register / Edit Biometric Machine Modal */}
          {showAddMachineModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
                <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
                  <div className="relative z-10 flex items-center space-x-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                      <Cpu className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                        {editingMachine ? `Edit Machine (${editingMachine.id})` : 'Register New Biometric Machine'}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddMachineModal(false);
                      setEditingMachine(null);
                    }}
                    className="relative z-10 p-1.5 text-blue-300 hover:text-white rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateOrUpdateMachine} className="p-5 space-y-3.5 text-xs overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Device ID (Machine ID) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. BIO-01"
                        value={newMachineId}
                        onChange={(e) => setNewMachineId(e.target.value)}
                        disabled={!!editingMachine}
                        className={`h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none shadow-2xs transition-all ${
                          editingMachine ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Device Serial No. (DeviceSR) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SRN-88492012"
                        value={newMachineSR}
                        onChange={(e) => setNewMachineSR(e.target.value)}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none shadow-2xs transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Device Name (DeviceName) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HQ Main Gate Turnstile A"
                      value={newMachineName}
                      onChange={(e) => setNewMachineName(e.target.value)}
                      className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none shadow-2xs transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Device Model / Brand</label>
                      <input
                        type="text"
                        placeholder="e.g. eSSL SilkBio-101TC"
                        value={newMachineModel}
                        onChange={(e) => setNewMachineModel(e.target.value)}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none shadow-2xs transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">IP Address / Serial</label>
                      <input
                        type="text"
                        placeholder="e.g. 192.168.1.120"
                        value={newMachineIp}
                        onChange={(e) => setNewMachineIp(e.target.value)}
                        className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none shadow-2xs transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Campus Location</label>
                      <AppSelect
                        value={newMachineLocation}
                        onChange={(val) => setNewMachineLocation(val)}
                        options={locations.map((loc) => ({ label: loc, value: loc }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Direction Mode</label>
                      <AppSelect
                        value={newMachinePunchMode}
                        onChange={(val) => setNewMachinePunchMode(val as any)}
                        options={[
                          { label: 'IN & OUT (Both Directions)', value: 'BOTH' },
                          { label: 'IN Only (Entry Gate)', value: 'IN_ONLY' },
                          { label: 'OUT Only (Exit Gate)', value: 'OUT_ONLY' }
                        ]}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Gate / Location Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Administration Wing Entry Turnstile"
                      value={newMachineGateType}
                      onChange={(e) => setNewMachineGateType(e.target.value)}
                      className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none shadow-2xs transition-all"
                    />
                  </div>

                  {/* CRITICAL ATTENDANCE COUNT TOGGLE */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-extrabold text-blue-950 text-xs block">Count Punches for Official Attendance?</label>
                        <span className="text-[10.5px] text-blue-800 block mt-0.5">
                          Uncheck for cafeteria readers, test devices, or non-attendance access gates.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={newMachineCountForAttendance}
                        onChange={(e) => setNewMachineCountForAttendance(e.target.checked)}
                        className="w-4.5 h-4.5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMachineModal(false);
                        setEditingMachine(null);
                      }}
                      className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-9 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 active:scale-95"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingMachine ? 'Save Changes' : 'Register Machine'}</span>
                    </button>
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
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
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
                    onClick={() => {
                      updateOrgBranding({
                        orgName: brandingOrgName,
                        logoUrl: brandingLogoUrl,
                        logoType: 'custom',
                        address: orgAddress,
                        copyrightText: orgCopyrightText
                      });
                      showToast('Organization settings saved successfully!');
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

