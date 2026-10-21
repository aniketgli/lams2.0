import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import {
  Building2,
  Award,
  Layers,
  GraduationCap,
  Calendar,
  School,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  FolderKanban,
  Edit2,
  X,
  BookOpen,
} from 'lucide-react';

// Master Record Types
export interface MasterRecord {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'Inactive';
  type?: string;          // e.g. Department, Cell, Project
  empType?: string;       // e.g. Permanent, Contractual, Deputation (Designation)
  parentStream?: string;  // e.g. Fresh Water Ecology (MSc Batches)
  parentCourse?: string;  // e.g. Certificate (Trainee Batches)
  validity?: string;      // e.g. 2026–2028
  totalBatches?: number;  // e.g. 2 Batches
  category?: string;      // e.g. Conservation, Technical
  pi?: string;            // Principal Investigator for Projects
  group?: string;         // e.g. Cadre A, Research Cadre
}

export const ProfileMasterSection: React.FC = () => {
  const { users } = useApp();

  type MasterKey =
    | 'departments'
    | 'designations'
    | 'mscStreams'
    | 'mscBatches'
    | 'courses'
    | 'traineeBatches'
    | 'projects'
    | 'categories'
    | 'phdEnrollment';

  const [activeTab, setActiveTab] = useState<MasterKey>('departments');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MasterRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion Confirmation State (eliminates window.confirm sandbox issues)
  const [deletingRecord, setDeletingRecord] = useState<MasterRecord | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Derive Active Permanent and Deputation Users for PI Dropdown
  const activePermAndDepUsers = (users || []).filter((u) => {
    const empType = (u.employmentType || (u as any).employeeType || '').toLowerCase();
    const isPermOrDep = empType.includes('permanent') || empType.includes('deputation');
    const isActive = !u.status || u.status.toLowerCase() === 'active';
    return isPermOrDep && isActive;
  });

  // PI choices come only from active employee records in the database.
  const piDropdownOptions = Array.from(new Set(
    activePermAndDepUsers.map(
      (u) => `${u.name} (${u.designation || 'Scientist'}, ${u.employmentType || 'Permanent'})`
    )
  ));

  // Form Fields State
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    type: string;
    empType: string;
    parentStream: string;
    parentCourse: string;
    validity: string;
    category: string;
    pi: string;
    group: string;
    status: 'Active' | 'Inactive';
  }>({
    name: '',
    code: '',
    type: 'Department',
    empType: 'Permanent',
    parentStream: 'Fresh Water Ecology',
    parentCourse: 'Certificate',
    validity: '2026–2028',
    category: 'Conservation',
    pi: piDropdownOptions[0] || '',
    group: 'Cadre A',
    status: 'Active'
  });

  // All masters are loaded from MySQL. No localStorage/seed fallback is used.
  const [masterData, setMasterData] = useState<Record<MasterKey, MasterRecord[]>>({
    departments: [], designations: [], mscStreams: [], mscBatches: [], courses: [],
    traineeBatches: [], projects: [], categories: [], phdEnrollment: []
  });
  useEffect(() => {
    let cancelled = false;
    const keys: MasterKey[] = ['departments','designations','mscStreams','mscBatches','courses','traineeBatches','projects','categories','phdEnrollment'];
    const endpointKey: Record<MasterKey, string> = { departments: 'organizations', designations: 'designations', mscStreams: 'mscStreams', mscBatches: 'mscBatches', courses: 'courses', traineeBatches: 'traineeBatches', projects: 'projects', categories: 'categories', phdEnrollment: 'phdEnrollment' };
    const load = async () => {
      const loaded: Partial<Record<MasterKey, MasterRecord[]>> = {};
      const failures: string[] = [];
      await Promise.all(keys.map(async (key) => {
        try {
          const response = await fetch(`/api/hrms/profile-masters/${endpointKey[key]}`, { credentials: 'include', cache: 'no-store' });
          const payload = await response.json().catch(() => []);
          if (!response.ok) throw new Error(payload.error || 'Request failed');
          loaded[key] = (Array.isArray(payload) ? payload : []).map((row: any) => ({ id: String(row.id), name: String(row.name || ''), code: String(row.code || ''), status: String(row.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active', type: row.type || '', empType: row.empType || '', parentStream: row.parentStream || '', parentCourse: row.parentCourse || '', validity: row.validity || '', totalBatches: Number(row.totalBatches || 0), category: row.category || '', pi: row.pi || '', group: row.group || '' }));
        } catch (error) { failures.push(key); console.error('Failed loading profile master ' + key, error); }
      }));
      if (cancelled) return;
      setMasterData((prev) => ({ ...prev, ...loaded }));
      if (failures.length) showToast('Could not load some masters: ' + failures.join(', ') + '. Check database migration/server logs.');
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Configurations for each master view
  const getTabMeta = (key: MasterKey) => {
    switch (key) {
      case 'departments':
        return {
          title: 'Organizations',
          subtitle: 'Manage departments, divisions, cells, and project units.',
          buttonLabel: 'Add Organization Unit',
          categoryLabel: 'Organizations',
          icon: Building2,
          nameHeader: 'Organization Name',
          codeHeader: 'Organization Code',
          typeHeader: 'Type'
        };
      case 'designations':
        return {
          title: 'Designation Master',
          subtitle: 'Manage designations, role titles, and organizational positions.',
          buttonLabel: 'Add Designation',
          categoryLabel: 'Designation Master',
          icon: Award,
          nameHeader: 'Designation Name',
          codeHeader: 'Designation Code',
          typeHeader: 'Employment Type'
        };
      case 'mscStreams':
        return {
          title: 'Stream Master',
          subtitle: 'Manage academic disciplines and postgraduate streams.',
          buttonLabel: 'Add MSc Stream',
          categoryLabel: 'Stream Master',
          icon: GraduationCap,
          nameHeader: 'Stream Name',
          codeHeader: 'Stream Code',
          typeHeader: 'Total Batches'
        };
      case 'mscBatches':
        return {
          title: 'MSc Batch Master',
          subtitle: 'Manage academic batches, session years, and tenures.',
          buttonLabel: 'Add MSc Batch',
          categoryLabel: 'MSc Batch Master',
          icon: Calendar,
          nameHeader: 'Batch Name',
          codeHeader: 'Batch Code',
          typeHeader: 'Stream & Validity'
        };
      case 'courses':
        return {
          title: 'Course Master',
          subtitle: 'Manage diploma, certificate, and training course programs.',
          buttonLabel: 'Add Course',
          categoryLabel: 'Course Master',
          icon: BookOpen,
          nameHeader: 'Course Name',
          codeHeader: 'Course Code',
          typeHeader: 'Total Batches'
        };
      case 'traineeBatches':
        return {
          title: 'Trainee Batch Master',
          subtitle: 'Manage trainee batches, cohorts, and training schedules.',
          buttonLabel: 'Add Trainee Batch',
          categoryLabel: 'Trainee Batch Master',
          icon: Calendar,
          nameHeader: 'Batch Name',
          codeHeader: 'Batch Code',
          typeHeader: 'Course & Validity'
        };
      case 'projects':
        return {
          title: 'Project Master',
          subtitle: 'Manage research projects, conservation schemes, and grant units.',
          buttonLabel: 'Add Project',
          categoryLabel: 'Project Master',
          icon: FolderKanban,
          nameHeader: 'Project Name',
          codeHeader: 'Project Code',
          typeHeader: 'PI'
        };
      case 'categories':
        return {
          title: 'Employee Category Master',
          subtitle: 'Manage administrative, scientific, technical, and academic cadre categories.',
          buttonLabel: 'Add Category',
          categoryLabel: 'Employee Category Master',
          icon: Layers,
          nameHeader: 'Category Name',
          codeHeader: 'Category Code',
          typeHeader: 'Cadre Group'
        };
      case 'phdEnrollment':
        return {
          title: 'PhD Enrollment Master',
          subtitle: 'Manage fellowship sources, university affiliations, and enrollment types for PhD Scholars.',
          buttonLabel: 'Add Fellowship / Source',
          categoryLabel: 'PhD Enrollment Master',
          icon: School,
          nameHeader: 'Source / Fellowship Name',
          codeHeader: 'Source Code',
          typeHeader: 'Funding Category'
        };

    }
  };

  const currentMeta = getTabMeta(activeTab);
  const currentList = masterData[activeTab] || [];

  const filteredList = currentList.filter(
    (item) =>
      (item.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (item.code || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (item.pi ? item.pi.toLowerCase().includes(searchQuery.toLowerCase().trim()) : false)
  );

  const openAddModal = () => {
    setEditingRecord(null);
    setFormError(null);
    setFormData({
      name: '',
      code: '',
      type: 'Department',
      empType: 'Permanent',
      parentStream: masterData.mscStreams?.[0]?.name || 'Fresh Water Ecology',
      parentCourse: masterData.courses?.[0]?.name || 'Certificate',
      validity: activeTab === 'traineeBatches' ? '2026' : '2026–2028',
      category: 'National Fellowship',
      pi: piDropdownOptions[0] || 'Dr. Y. V. Jhala (Scientist-G, Permanent)',
      group: 'Cadre A',
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (record: MasterRecord) => {
    setEditingRecord(record);
    setFormError(null);
    setFormData({
      name: record.name || '',
      code: record.code || '',
      type: record.type || 'Department',
      empType: record.empType || 'Permanent',
      parentStream: record.parentStream || masterData.mscStreams?.[0]?.name || 'Fresh Water Ecology',
      parentCourse: record.parentCourse || masterData.courses?.[0]?.name || 'Certificate',
      validity: record.validity || '2026–2028',
      category: record.category || 'National Fellowship',
      pi: record.pi || piDropdownOptions[0] || 'Dr. Y. V. Jhala (Scientist-G, Permanent)',
      group: record.group || 'Cadre A',
      status: record.status || 'Active'
    });
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Please fill in both Name and Code fields.');
      return;
    }
    setFormError(null);

    if (activeTab === 'departments') {
      try {
        const body = { name: formData.name.trim(), code: formData.code.trim().toUpperCase(), type: formData.type, status: formData.status.toUpperCase() };
        const url = editingRecord ? `/api/hrms/profile-masters/organizations/${encodeURIComponent(editingRecord.id)}` : '/api/hrms/profile-masters/organizations';
        const response = await fetch(url, { method: editingRecord ? 'PUT' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Could not save organization.');
        const row = payload.organization || payload;
        const saved: MasterRecord = { id: String(row.id), name: row.name, code: row.code, type: row.type || 'Department', status: String(row.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active' };
        setMasterData((prev) => ({ ...prev, departments: editingRecord ? prev.departments.map((item) => item.id === editingRecord.id ? saved : item) : [...prev.departments, saved] }));
        window.dispatchEvent(new Event('hrms:profile-masters-updated'));
        setIsModalOpen(false);
        showToast(editingRecord ? 'Organization updated successfully.' : 'Organization added successfully.');
      } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save organization.'); }
      return;
    }

    try {
      const body = { name: formData.name.trim(), code: formData.code.trim().toUpperCase(), status: formData.status.toUpperCase(), type: formData.type, empType: formData.empType, parentStream: formData.parentStream, parentCourse: formData.parentCourse, validity: formData.validity, category: formData.category, pi: formData.pi, group: formData.group, totalBatches: 0 };
      const url = editingRecord ? `/api/hrms/profile-masters/${activeTab}/${encodeURIComponent(editingRecord.id)}` : `/api/hrms/profile-masters/${activeTab}`;
      const response = await fetch(url, { method: editingRecord ? 'PUT' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not save master record.');
      const saved: MasterRecord = { id: String(payload.id), name: payload.name, code: payload.code, status: String(payload.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active', type: payload.type || '', empType: payload.empType || '', parentStream: payload.parentStream || '', parentCourse: payload.parentCourse || '', validity: payload.validity || '', totalBatches: Number(payload.totalBatches || 0), category: payload.category || '', pi: payload.pi || '', group: payload.group || '' };
      setMasterData((prev) => ({ ...prev, [activeTab]: editingRecord ? prev[activeTab].map((item) => item.id === editingRecord.id ? saved : item) : [...prev[activeTab], saved] }));
      window.dispatchEvent(new Event('hrms:profile-masters-updated'));
      setIsModalOpen(false);
      showToast(editingRecord ? 'Master record updated successfully.' : 'Master record added successfully.');
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save master record.'); }
    return;

    setIsModalOpen(false);
  };

  const toggleOrganizationStatus = async (record: MasterRecord) => {
    if (statusUpdatingId) return;
    const nextStatus = record.status === 'Active' ? 'INACTIVE' : 'ACTIVE';
    setStatusUpdatingId(record.id);
    try {
      const endpointKey = activeTab === 'departments' ? 'organizations' : activeTab;
      const body = { name: record.name, code: record.code, status: nextStatus, type: record.type || 'Department', empType: record.empType || '', parentStream: record.parentStream || '', parentCourse: record.parentCourse || '', validity: record.validity || '', totalBatches: record.totalBatches || 0, category: record.category || '', pi: record.pi || '', group: record.group || '' };
      const response = await fetch(`/api/hrms/profile-masters/${endpointKey}/${encodeURIComponent(record.id)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not update master status.');
      const status: MasterRecord['status'] = String(payload.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active';
      setMasterData((prev) => ({ ...prev, [activeTab]: prev[activeTab].map((item) => item.id === record.id ? { ...item, status } : item) }));
      window.dispatchEvent(new Event('hrms:profile-masters-updated'));
      showToast(record.name + ' marked ' + status.toLowerCase() + '.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not update master status.'); }
    finally { setStatusUpdatingId(null); }
  };

  const confirmDeleteRecord = async (record: MasterRecord) => {
    try {
      const endpointKey = activeTab === 'departments' ? 'organizations' : activeTab;
      const response = await fetch(`/api/hrms/profile-masters/${endpointKey}/${encodeURIComponent(record.id)}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not delete master record.');
      setMasterData((prev) => ({ ...prev, [activeTab]: prev[activeTab].filter((item) => item.id !== record.id) }));
      window.dispatchEvent(new Event('hrms:profile-masters-updated'));
      showToast('Record "' + record.name + '" deleted successfully.');
      setDeletingRecord(null);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not delete master record.'); }
  };

  const tabPillsConfig: Array<{ id: MasterKey; label: string; icon: any }> = [
    { id: 'departments', label: 'Organizations', icon: Building2 },
    { id: 'designations', label: 'Designation', icon: Award },
    { id: 'mscStreams', label: 'Stream (MSc)', icon: GraduationCap },
    { id: 'mscBatches', label: 'MSc Batch', icon: Calendar },
    { id: 'courses', label: 'Course (Training)', icon: BookOpen },
    { id: 'traineeBatches', label: 'Trainee Batch', icon: Calendar },
    { id: 'projects', label: 'Project', icon: FolderKanban },
    { id: 'categories', label: 'Category', icon: Layers },
    { id: 'phdEnrollment', label: 'PhD Enrollment', icon: School },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs rounded-xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Master Sub-Tab Selector Pills Container (Header & Subheading removed per user request) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {tabPillsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = (masterData[tab.id] || []).length;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Master Table View */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
        {/* Header Title + Subtitle + Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{currentMeta.title}</h1>
            
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={openAddModal}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{currentMeta.buttonLabel}</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${currentMeta.title.toLowerCase()}...`}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            Showing <span className="font-bold text-slate-800">{filteredList.length}</span> of {currentList.length} records
          </div>
        </div>

        {/* Structured Data Table */}
        <div className="overflow-x-auto border border-slate-200/90 rounded-2xl shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                {activeTab !== 'departments' && <th className="py-3 px-4 w-12 text-center">ID</th>}
                <th className="py-3 px-4">{currentMeta.nameHeader}</th>
                <th className="py-3 px-4">{currentMeta.codeHeader}</th>
                <th className="py-3 px-4">{currentMeta.typeHeader}</th>
                <th className="py-3 px-4 w-28">Status</th>
                <th className="py-3 px-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'departments' ? 5 : 6} className="py-8 text-center text-slate-500 bg-slate-50/40">
                    No records found matching &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredList.map((row, idx) => {
                  const HeaderIcon = currentMeta.icon;
                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {activeTab !== 'departments' && <td className="py-3.5 px-4 text-center font-medium text-slate-500">{row.id}</td>}

                      {/* Name with Icon */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center shrink-0">
                            <HeaderIcon className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <span className="font-bold text-slate-900 text-xs">{row.name}</span>
                        </div>
                      </td>

                      {/* Code Badge */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block bg-blue-50 text-blue-700 font-mono font-bold text-[11px] px-2.5 py-1 rounded-md border border-blue-200/50">
                          {row.code}
                        </span>
                      </td>

                      {/* Type / Relationship / Attribute Badge */}
                      <td className="py-3.5 px-4">
                        {activeTab === 'departments' && (
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                              row.type === 'Cell'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : row.type === 'Project'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            <span>{row.type || 'Department'}</span>
                          </span>
                        )}

                        {activeTab === 'designations' && (
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                              row.empType === 'Contractual'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : row.empType === 'Deputation'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : row.empType?.includes('Researcher')
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : row.empType?.includes('Student')
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <span>{row.empType || 'Permanent'}</span>
                          </span>
                        )}

                        {activeTab === 'mscStreams' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <Calendar className="w-3 h-3" />
                            <span>{row.totalBatches ?? 2} Batches</span>
                          </span>
                        )}

                        {activeTab === 'mscBatches' && (
                          <div className="flex items-center space-x-2">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {row.parentStream || 'Fresh Water Ecology'}
                            </span>
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                              <Calendar className="w-3 h-3" />
                              <span>{row.validity || '2026–2028'}</span>
                            </span>
                          </div>
                        )}

                        {activeTab === 'courses' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <Calendar className="w-3 h-3" />
                            <span>{row.totalBatches ?? 2} Batches</span>
                          </span>
                        )}

                        {activeTab === 'traineeBatches' && (
                          <div className="flex items-center space-x-2">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {row.parentCourse || 'Certificate'}
                            </span>
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                              <Calendar className="w-3 h-3" />
                              <span>{row.validity || '2026'}</span>
                            </span>
                          </div>
                        )}

                        {activeTab === 'projects' && (
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {row.pi || 'Dr. Y. V. Jhala (Scientist-G, Permanent)'}
                          </span>
                        )}

                        {activeTab === 'categories' && (
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {row.group || 'Cadre A'}
                          </span>
                        )}

                        {activeTab === 'phdEnrollment' && (
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            {row.category || 'National Fellowship'}
                          </span>
                        )}

                        {false && (
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            {row.type || 'Headquarters'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button type="button" onClick={() => void toggleOrganizationStatus(row)} disabled={statusUpdatingId === row.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors disabled:opacity-60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${row.status === 'Inactive' ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                            title="Click to toggle status" aria-label={`Change status from ${row.status}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Inactive' ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                            {statusUpdatingId === row.id ? 'Saving…' : row.status}
                          </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="p-2 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                            title="Edit Record"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingRecord(row)}
                            className="p-2 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Record Deletion */}
      {deletingRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
                  <Trash2 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Confirm Deletion</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{currentMeta.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900">&ldquo;{deletingRecord.name}&rdquo;</span> from {currentMeta.title}?
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingRecord(null)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDeleteRecord(deletingRecord)}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: Add / Edit Master Record */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 rounded-t-2xl">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
                  {React.createElement(currentMeta.icon || FolderKanban, { className: 'w-5 h-5 text-blue-400' })}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white tracking-tight truncate">
                    {editingRecord ? 'Edit Master Record' : 'Add New Master Record'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                    Category: <span className="text-white font-bold">{currentMeta.categoryLabel}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">

            {/* Error Message inside Modal */}
            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {formError}
              </div>
            )}

            {/* Modal Form Content */}
            <form onSubmit={handleSaveRecord} className="space-y-4">
              {/* Conditional Anchor / Relationship Dropdown */}
              {activeTab === 'departments' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Organization Unit Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option value="Department">Department</option>
                    <option value="Cell">Cell</option>
                    <option value="Project">Project</option>
                    <option value="Division">Division</option>
                  </select>
                </div>
              )}

              {activeTab === 'designations' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    Employment Type (Anchor Relationship) *
                  </label>
                  <select
                    value={formData.empType}
                    onChange={(e) => setFormData({ ...formData, empType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option value="Permanent">Permanent (PERMANENT)</option>
                    <option value="Contractual">Contractual</option>
                    <option value="Deputation">Deputation</option>
                    <option value="Researcher / Project Staff">Researcher / Project Staff</option>
                    <option value="MSc Student">MSc Student</option>
                    <option value="PhD Scholar">PhD Scholar</option>
                    <option value="Trainee">Trainee</option>
                    <option value="Intern">Intern</option>
                  </select>
                  <p className="text-[11px] text-blue-600 font-medium mt-1">
                    This designation will only be shown to users with this Employment Type.
                  </p>
                </div>
              )}

              {activeTab === 'projects' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    Principal Investigator (PI) *
                  </label>
                  <select
                    value={formData.pi}
                    onChange={(e) => setFormData({ ...formData, pi: e.target.value, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    {piDropdownOptions.map((piName, idx) => (
                      <option key={idx} value={piName}>
                        {piName}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-blue-600 font-medium mt-1">
                    Select Active Permanent or Deputation faculty/scientists as PI.
                  </p>
                </div>
              )}

              {activeTab === 'categories' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    Cadre Group *
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option value="Cadre A">Cadre A (Administrative)</option>
                    <option value="Research Cadre">Research Cadre (Scientific)</option>
                    <option value="Technical Staff">Technical Staff</option>
                    <option value="Faculty / Student">Faculty / Student (Academic)</option>
                    <option value="Support Staff">Support Staff</option>
                  </select>
                </div>
              )}

              {activeTab === 'phdEnrollment' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    Funding Category / Type *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option value="National Fellowship">National Fellowship (UGC/CSIR)</option>
                    <option value="Govt Grant">Govt Grant (DST/DBT)</option>
                    <option value="Institutional">Institutional (WII Fellowship)</option>
                    <option value="Project Grant">Project Grant</option>
                    <option value="Self / External">Self / External Sponsored</option>
                  </select>
                </div>
              )}

              
              </div>

              {/* Primary Code Field */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">{currentMeta.codeHeader} *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value });
                    if (formError) setFormError(null);
                  }}
                  placeholder="E.G. WII, RSGIS, TA, SCI-B, FWE-21"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium uppercase focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Optional Validity / Tenure field for Batches */}
              {(activeTab === 'mscBatches' || activeTab === 'traineeBatches') && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    {activeTab === 'mscBatches' ? 'Validity / Academic Tenure *' : 'Validity / Year *'}
                  </label>
                  <input
                    type="text"
                    value={formData.validity}
                    onChange={(e) => setFormData({ ...formData, validity: e.target.value })}
                    placeholder="e.g. 2026–2028 or 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  />
                </div>
              )}

              {/* Status Select */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  {editingRecord ? 'Update Master Record' : 'Create Master Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
