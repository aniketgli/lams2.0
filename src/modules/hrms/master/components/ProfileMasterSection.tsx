import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import {
  Building2,
  Award,
  Layers,
  GraduationCap,
  Calendar,
  School,
  MapPin,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  FolderKanban,
  Edit2,
  X,
  BookOpen
} from 'lucide-react';

// Master Record Types
export interface MasterRecord {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'Inactive';
  type?: string;          // e.g. Department, Cell, Project (Organization) or Location Type
  empType?: string;       // e.g. Permanent, Contractual, Deputation (Designation)
  parentStream?: string;  // e.g. Fresh Water Ecology (MSc Batches)
  parentCourse?: string;  // e.g. Certificate (Trainee Batches)
  validity?: string;      // e.g. 2026–2028
  totalBatches?: number;  // e.g. 2 Batches
  category?: string;      // e.g. Conservation, Technical
  pi?: string;            // Principal Investigator for Projects
  group?: string;         // e.g. Cadre A, Research Cadre
}

// Default Seed Data matching exact user screenshots & WII structure
const SEED_ORGANIZATION_MASTER: MasterRecord[] = [
  { id: '1', name: 'Wildlife Institute of India', code: 'WII', type: 'Department', status: 'Active' },
  { id: '2', name: 'RS/GIS & AV Cell', code: 'RSGIS', type: 'Cell', status: 'Active' },
  { id: '3', name: 'IT Cell', code: 'IT', type: 'Cell', status: 'Active' },
  { id: '4', name: 'Project Tiger', code: 'PT', type: 'Project', status: 'Active' },
  { id: '5', name: 'Research Laboratories Division', code: 'RLD', type: 'Department', status: 'Active' },
  { id: '6', name: 'National Tiger Conservation Project', code: 'NTCP', type: 'Project', status: 'Active' },
  { id: '7', name: 'Wildlife Ecology & Management', code: 'WEM', type: 'Department', status: 'Active' },
  { id: '8', name: 'Habitat Ecology', code: 'HE', type: 'Department', status: 'Active' }
];

const SEED_DESIGNATION_MASTER: MasterRecord[] = [
  { id: '1', name: 'Technical Assistant', code: 'TA', empType: 'Permanent', status: 'Active' },
  { id: '2', name: 'Scientist-B', code: 'SCI-B', empType: 'Permanent', status: 'Active' },
  { id: '3', name: 'Project Associate', code: 'PA', empType: 'Contractual', status: 'Active' },
  { id: '4', name: 'Assistant Director', code: 'AD', empType: 'Deputation', status: 'Active' },
  { id: '5', name: 'Scientist-C', code: 'SCI-C', empType: 'Permanent', status: 'Active' },
  { id: '6', name: 'Scientist-E', code: 'SCI-E', empType: 'Permanent', status: 'Active' },
  { id: '7', name: 'Senior Project Associate', code: 'SPA', empType: 'Contractual', status: 'Active' },
  { id: '8', name: 'Junior Research Fellow', code: 'JRF', empType: 'Researcher / Project Staff', status: 'Active' },
  { id: '9', name: 'Senior Research Fellow', code: 'SRF', empType: 'Researcher / Project Staff', status: 'Active' },
  { id: '10', name: 'Project Fellow', code: 'PF', empType: 'Researcher / Project Staff', status: 'Active' },
  { id: '11', name: 'MSc Scholar', code: 'MSC-SCH', empType: 'MSc Student', status: 'Active' }
];

const SEED_STREAM_MASTER: MasterRecord[] = [
  { id: '1', name: 'Fresh Water Ecology', code: 'FWE', totalBatches: 2, status: 'Active' },
  { id: '2', name: 'Wildlife Sciences', code: 'WS', totalBatches: 2, status: 'Active' },
  { id: '3', name: 'Conservation Biology', code: 'CB', totalBatches: 1, status: 'Active' }
];

const SEED_MSC_BATCH_MASTER: MasterRecord[] = [
  { id: '1', name: '21st Batch', parentStream: 'Fresh Water Ecology', code: 'FWE-21', validity: '2026–2028', status: 'Active' },
  { id: '2', name: '22nd Batch', parentStream: 'Fresh Water Ecology', code: 'FWE-22', validity: '2027–2029', status: 'Active' },
  { id: '3', name: '2nd Batch', parentStream: 'Wildlife Sciences', code: 'WS-02', validity: '2026–2028', status: 'Active' },
  { id: '4', name: '3rd Batch', parentStream: 'Wildlife Sciences', code: 'WS-03', validity: '2027–2029', status: 'Active' },
  { id: '5', name: '15th Batch', parentStream: 'Conservation Biology', code: 'CB-15', validity: '2026–2028', status: 'Active' }
];

const SEED_COURSE_MASTER: MasterRecord[] = [
  { id: '1', name: 'Certificate', code: 'CERT', totalBatches: 2, status: 'Active' },
  { id: '2', name: 'Diploma', code: 'DIP', totalBatches: 2, status: 'Active' },
  { id: '3', name: 'PG Diploma in Wildlife Management', code: 'PGDWM', totalBatches: 0, status: 'Active' }
];

const SEED_TRAINEE_BATCH_MASTER: MasterRecord[] = [
  { id: '1', name: '46th Batch', parentCourse: 'Certificate', code: 'CERT-46', validity: '2026', status: 'Active' },
  { id: '2', name: '47th Batch', parentCourse: 'Certificate', code: 'CERT-47', validity: '2027', status: 'Active' },
  { id: '3', name: '20th Batch', parentCourse: 'Diploma', code: 'DIP-20', validity: '2026', status: 'Active' },
  { id: '4', name: '21st Batch', parentCourse: 'Diploma', code: 'DIP-21', validity: '2027', status: 'Active' }
];

const SEED_PROJECT_MASTER: MasterRecord[] = [
  { id: '1', name: 'National Tiger Conservation Authority (NTCA) Project', code: 'NTCA', pi: 'Dr. Y. V. Jhala (Scientist-G, Permanent)', status: 'Active' },
  { id: '2', name: 'CAMPA - Recovery Program for Bustard', code: 'CAMPA-GIB', pi: 'Dr. Sutirtha Dutta (Scientist-E, Permanent)', status: 'Active' },
  { id: '3', name: 'Ganga Rejuvenation & River Biodiversity Project', code: 'NMCG-GRP', pi: 'Dr. Ruchi Badola (Scientist-G, Permanent)', status: 'Active' },
  { id: '4', name: 'All India Synchronized Elephant Population Estimation', code: 'AISEPE', pi: 'Dr. Qamar Qureshi (Scientist-G, Permanent)', status: 'Active' },
  { id: '5', name: 'Snow Leopard Population Assessment in India (SPAI)', code: 'SPAI', pi: 'Dr. S. Sathyakumar (Scientist-G, Permanent)', status: 'Active' }
];

const SEED_CATEGORY_MASTER: MasterRecord[] = [
  { id: '1', name: 'Administrative', code: 'ADMIN', group: 'Cadre A', status: 'Active' },
  { id: '2', name: 'Scientific', code: 'SCI', group: 'Research Cadre', status: 'Active' },
  { id: '3', name: 'Technical', code: 'TECH', group: 'Technical Staff', status: 'Active' },
  { id: '4', name: 'Academic', code: 'ACAD', group: 'Faculty / Student', status: 'Active' }
];

const SEED_PHD_ENROLLMENT_MASTER: MasterRecord[] = [
  { id: '1', name: 'UGC-NET JRF', code: 'UGC-JRF', category: 'National Fellowship', status: 'Active' },
  { id: '2', name: 'CSIR-NET JRF', code: 'CSIR-JRF', category: 'National Fellowship', status: 'Active' },
  { id: '3', name: 'DST-INSPIRE Fellowship', code: 'INSPIRE', category: 'Govt Grant', status: 'Active' },
  { id: '4', name: 'WII Institutional Fellowship', code: 'WII-FEL', category: 'Institutional', status: 'Active' },
  { id: '5', name: 'Project Funded PhD Fellowship', code: 'PRJ-PhD', category: 'Project Grant', status: 'Active' }
];

const SEED_LOCATION_MASTER: MasterRecord[] = [
  { id: '1', name: 'Dehradun Campus (HQ)', code: 'DDN-HQ', type: 'Headquarters', status: 'Active' },
  { id: '2', name: 'Southern Regional Center - Bengaluru', code: 'SRC-BLR', type: 'Regional Office', status: 'Active' },
  { id: '3', name: 'High Altitude Field Station - Leh', code: 'HAFS-LEH', type: 'Field Station', status: 'Active' },
  { id: '4', name: 'Ganga Biodiversity Center - Rishikesh', code: 'GBC-RSK', type: 'Research Center', status: 'Active' }
];

export const ProfileMasterSection: React.FC = () => {
  const { users, addProfileMasterItem, deleteProfileMasterItem } = useApp();

  type MasterKey =
    | 'departments'
    | 'designations'
    | 'mscStreams'
    | 'mscBatches'
    | 'courses'
    | 'traineeBatches'
    | 'projects'
    | 'categories'
    | 'phdEnrollment'
    | 'locations';

  const [activeTab, setActiveTab] = useState<MasterKey>('departments');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MasterRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion Confirmation State (eliminates window.confirm sandbox issues)
  const [deletingRecord, setDeletingRecord] = useState<MasterRecord | null>(null);

  // Derive Active Permanent and Deputation Users for PI Dropdown
  const activePermAndDepUsers = (users || []).filter((u) => {
    const empType = (u.employmentType || (u as any).employeeType || '').toLowerCase();
    const isPermOrDep = empType.includes('permanent') || empType.includes('deputation');
    const isActive = !u.status || u.status.toLowerCase() === 'active';
    return isPermOrDep && isActive;
  });

  const defaultSeedPIs = [
    'Dr. S. A. Hussain (Scientist-G, Permanent)',
    'Dr. Ruchi Badola (Scientist-G, Permanent)',
    'Dr. Bilal Habib (Scientist-E, Permanent)',
    'Dr. Y. V. Jhala (Scientist-G, Permanent)',
    'Dr. K. Sankar (Scientist-G, Deputation)',
    'Dr. G. S. Rawat (Scientist-G, Permanent)',
    'Dr. Dhananjai Mohan (IFS, Deputation)',
    'Dr. B. S. Adhikari (Scientist-F, Permanent)'
  ];

  const piDropdownOptions = Array.from(
    new Set([
      ...activePermAndDepUsers.map(
        (u) => `${u.name} (${u.designation || 'Scientist'}, ${u.employmentType || 'Permanent'})`
      ),
      ...defaultSeedPIs
    ])
  );

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
    pi: piDropdownOptions[0] || 'Dr. Y. V. Jhala (Scientist-G, Permanent)',
    group: 'Cadre A',
    status: 'Active'
  });

  // Master Data State with safe localStorage persistence and fallback defaults
  const [masterData, setMasterData] = useState<Record<MasterKey, MasterRecord[]>>(() => {
    const defaults: Record<MasterKey, MasterRecord[]> = {
      departments: SEED_ORGANIZATION_MASTER,
      designations: SEED_DESIGNATION_MASTER,
      mscStreams: SEED_STREAM_MASTER,
      mscBatches: SEED_MSC_BATCH_MASTER,
      courses: SEED_COURSE_MASTER,
      traineeBatches: SEED_TRAINEE_BATCH_MASTER,
      projects: SEED_PROJECT_MASTER,
      categories: SEED_CATEGORY_MASTER,
      phdEnrollment: SEED_PHD_ENROLLMENT_MASTER,
      locations: SEED_LOCATION_MASTER
    };
    try {
      const saved = localStorage.getItem('wii_profile_masters_table_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            departments: Array.isArray(parsed.departments) && parsed.departments.length ? parsed.departments : defaults.departments,
            designations: Array.isArray(parsed.designations) && parsed.designations.length ? parsed.designations : defaults.designations,
            mscStreams: Array.isArray(parsed.mscStreams) && parsed.mscStreams.length ? parsed.mscStreams : defaults.mscStreams,
            mscBatches: Array.isArray(parsed.mscBatches) && parsed.mscBatches.length ? parsed.mscBatches : defaults.mscBatches,
            courses: Array.isArray(parsed.courses) && parsed.courses.length ? parsed.courses : defaults.courses,
            traineeBatches: Array.isArray(parsed.traineeBatches) && parsed.traineeBatches.length ? parsed.traineeBatches : defaults.traineeBatches,
            projects: Array.isArray(parsed.projects) && parsed.projects.length
              ? parsed.projects.map((p: any, idx: number) => ({
                  ...p,
                  pi: p.pi || defaults.projects[idx % defaults.projects.length]?.pi || 'Dr. Y. V. Jhala (Scientist-G, Permanent)'
                }))
              : defaults.projects,
            categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : defaults.categories,
            phdEnrollment: Array.isArray(parsed.phdEnrollment) && parsed.phdEnrollment.length ? parsed.phdEnrollment : defaults.phdEnrollment,
            locations: Array.isArray(parsed.locations) && parsed.locations.length ? parsed.locations : defaults.locations
          };
        }
      }
    } catch (e) {
      console.error(e);
    }
    return defaults;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wii_profile_masters_table_v3', JSON.stringify(masterData));
    } catch (e) {
      console.error(e);
    }
  }, [masterData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Configurations for each master view
  const getTabMeta = (key: MasterKey) => {
    switch (key) {
      case 'departments':
        return {
          title: 'Organization Master',
          subtitle: 'Manage departments, divisions, cells, and project units.',
          buttonLabel: 'Add Organization Unit',
          categoryLabel: 'Organization Master',
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
      case 'locations':
        return {
          title: 'Locations & Field Camps Master',
          subtitle: 'Manage headquarters, regional offices, research stations, and field camps.',
          buttonLabel: 'Add Location',
          categoryLabel: 'Locations Master',
          icon: MapPin,
          nameHeader: 'Location Name',
          codeHeader: 'Location Code',
          typeHeader: 'Facility Type'
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

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Please fill in both Name and Code fields.');
      return;
    }
    setFormError(null);

    if (editingRecord) {
      // Update Record
      const updatedList = currentList.map((rec) =>
        rec.id === editingRecord.id
          ? {
              ...rec,
              name: formData.name.trim(),
              code: formData.code.trim().toUpperCase(),
              status: formData.status,
              type: formData.type,
              empType: formData.empType,
              parentStream: formData.parentStream,
              parentCourse: formData.parentCourse,
              validity: formData.validity,
              category: formData.category,
              pi: formData.pi,
              group: formData.group
            }
          : rec
      );
      setMasterData((prev) => ({ ...prev, [activeTab]: updatedList }));
      showToast(`Master record "${formData.name}" updated successfully!`);
    } else {
      // Create New Record
      const newRec: MasterRecord = {
        id: String(Date.now()),
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        status: formData.status,
        type: formData.type,
        empType: formData.empType,
        parentStream: formData.parentStream,
        parentCourse: formData.parentCourse,
        validity: formData.validity,
        category: formData.category,
        pi: formData.pi,
        group: formData.group,
        totalBatches: 0
      };
      setMasterData((prev) => ({ ...prev, [activeTab]: [...currentList, newRec] }));

      // Sync with AppContext master list so dropdowns pick it up
      const contextKeyMap: Record<MasterKey, any> = {
        departments: 'departments',
        designations: 'designations',
        mscStreams: 'courses',
        mscBatches: 'batches',
        courses: 'courses',
        traineeBatches: 'batches',
        projects: 'projects',
        categories: 'categories',
        phdEnrollment: 'phdEnrollment',
        locations: 'locations'
      };
      addProfileMasterItem(contextKeyMap[activeTab], formData.name.trim());

      showToast(`New record "${formData.name}" added to ${currentMeta.title}!`);
    }

    setIsModalOpen(false);
  };

  const confirmDeleteRecord = (record: MasterRecord) => {
    const updatedList = currentList.filter((rec) => rec.id !== record.id);
    setMasterData((prev) => ({ ...prev, [activeTab]: updatedList }));

    const contextKeyMap: Record<MasterKey, any> = {
      departments: 'departments',
      designations: 'designations',
      mscStreams: 'courses',
      mscBatches: 'batches',
      courses: 'courses',
      traineeBatches: 'batches',
      projects: 'projects',
      categories: 'categories',
      phdEnrollment: 'phdEnrollment',
      locations: 'locations'
    };
    deleteProfileMasterItem(contextKeyMap[activeTab], record.name);

    showToast(`Record "${record.name}" deleted successfully.`);
    setDeletingRecord(null);
  };

  const tabPillsConfig: Array<{ id: MasterKey; label: string; icon: any }> = [
    { id: 'departments', label: 'Organization Master', icon: Building2 },
    { id: 'designations', label: 'Designation Master', icon: Award },
    { id: 'mscStreams', label: 'Stream Master (MSc)', icon: GraduationCap },
    { id: 'mscBatches', label: 'MSc Batch Master', icon: Calendar },
    { id: 'courses', label: 'Course Master (Training)', icon: BookOpen },
    { id: 'traineeBatches', label: 'Trainee Batch Master', icon: Calendar },
    { id: 'projects', label: 'Project Master', icon: FolderKanban },
    { id: 'categories', label: 'Category Master', icon: Layers },
    { id: 'phdEnrollment', label: 'PhD Enrollment Master', icon: School },
    { id: 'locations', label: 'Locations Master', icon: MapPin }
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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
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

          <button
            type="button"
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{currentMeta.buttonLabel}</span>
          </button>
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
                <th className="py-3 px-4 w-12 text-center">ID</th>
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
                  <td colSpan={6} className="py-8 text-center text-slate-500 bg-slate-50/40">
                    No records found matching &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredList.map((row, idx) => {
                  const HeaderIcon = currentMeta.icon;
                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID */}
                      <td className="py-3.5 px-4 text-center font-medium text-slate-500">{row.id}</td>

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

                        {activeTab === 'locations' && (
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            {row.type || 'Headquarters'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {row.status === 'Inactive' ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Inactive</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingRecord(row)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
            <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-rose-300 shrink-0 shadow-sm">
                  <Trash2 className="w-4.5 h-4.5 text-rose-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Confirm Deletion</h3>
                  <p className="text-xs text-blue-200/80 mt-0.5">{currentMeta.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 min-w-0">
                <h3 className="text-base font-bold text-white tracking-tight truncate">
                  {editingRecord ? 'Edit Master Record' : 'Add New Master Record'}
                </h3>
                <p className="text-xs text-blue-200/80 font-medium mt-0.5">
                  Category: <span className="text-white font-bold">{currentMeta.categoryLabel}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="relative z-10 p-1.5 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
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

              {activeTab === 'locations' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    Facility / Location Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option value="Headquarters">Headquarters</option>
                    <option value="Regional Office">Regional Office</option>
                    <option value="Field Station">Field Station</option>
                    <option value="Research Center">Research Center</option>
                    <option value="Field Camp">Field Camp</option>
                  </select>
                </div>
              )}

              {activeTab === 'mscBatches' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    Parent Stream (Relationship) *
                  </label>
                  <select
                    value={formData.parentStream}
                    onChange={(e) => setFormData({ ...formData, parentStream: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    {(masterData.mscStreams || []).map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'traineeBatches' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    Parent Course (Relationship) *
                  </label>
                  <select
                    value={formData.parentCourse}
                    onChange={(e) => setFormData({ ...formData, parentCourse: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    {(masterData.courses || []).map((cr) => (
                      <option key={cr.id} value={cr.name}>
                        {cr.name} ({cr.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Primary Name Field */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">{currentMeta.nameHeader} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formError) setFormError(null);
                  }}
                  placeholder={`e.g. ${
                    activeTab === 'departments'
                      ? 'Wildlife Institute of India, IT Cell, Project Tiger'
                      : activeTab === 'designations'
                      ? 'Technical Assistant, Scientist-B, Project Associate'
                      : activeTab === 'mscStreams'
                      ? 'Fresh Water Ecology, Wildlife Sciences'
                      : activeTab === 'mscBatches'
                      ? '21st Batch, 2nd Batch'
                      : activeTab === 'courses'
                      ? 'Certificate, Diploma, PG Diploma in Wildlife Management'
                      : activeTab === 'projects'
                      ? 'National Tiger Conservation Project'
                      : 'New Record Title...'
                  }`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 focus:outline-none transition-all"
                  required
                />
                {activeTab === 'mscBatches' && (
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    Numbering is stream-specific (Fresh Water Ecology &rarr; 21st Batch, Wildlife Sciences &rarr; 2nd Batch).
                  </p>
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
