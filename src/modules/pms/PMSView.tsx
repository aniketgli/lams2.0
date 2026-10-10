import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PageHeader,
  Button,
  Badge,
  StatusBadge,
  MetricCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  TablePagination,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormField,
  Input,
  Select
} from '../../shared/components';
import {
  Briefcase,
  Plus,
  Search,
  Users,
  IndianRupee,
  TrendingUp,
  Download
} from 'lucide-react';

interface PMSViewProps {
  onReturnToLobby: () => void;
}

interface ProjectItem {
  id: string;
  code: string;
  title: string;
  piName: string;
  coPiName?: string;
  fundingAgency: string;
  sanctionAmount: number;
  spentAmount: number;
  startDate: string;
  endDate: string;
  status: 'Ongoing' | 'Completed' | 'Delayed' | 'Review';
  staffCount: number;
  milestonesTotal: number;
  milestonesCompleted: number;
}

const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'PRJ-01',
    code: 'WII-DST-2024-09',
    title: 'National Tiger & Mega-Herbivore Population Genetics & Corridor Viability',
    piName: 'Dr. Y.V. Jhala',
    coPiName: 'Dr. Qamar Qureshi',
    fundingAgency: 'National Tiger Conservation Authority (NTCA)',
    sanctionAmount: 38500000,
    spentAmount: 24200000,
    startDate: '2024-04-01',
    endDate: '2027-03-31',
    status: 'Ongoing',
    staffCount: 14,
    milestonesTotal: 8,
    milestonesCompleted: 5
  },
  {
    id: 'PRJ-02',
    code: 'WII-MOEF-2023-14',
    title: 'Himalayan High Altitude Alpine Ecosystems Biodiversity Monitoring & Climate Resilience',
    piName: 'Dr. S. Sathyakumar',
    coPiName: 'Dr. K. Ramesh',
    fundingAgency: 'MoEFCC - National Mission on Himalayan Studies',
    sanctionAmount: 49000000,
    spentAmount: 33100000,
    startDate: '2023-08-15',
    endDate: '2026-08-14',
    status: 'Ongoing',
    staffCount: 18,
    milestonesTotal: 10,
    milestonesCompleted: 7
  },
  {
    id: 'PRJ-03',
    code: 'WII-CAMPA-2024-03',
    title: 'Great Indian Bustard Recovery Program & Landscape Level Powerline Mitigation',
    piName: 'Dr. Sutirtha Dutta',
    coPiName: 'Dr. Bilal Habib',
    fundingAgency: 'National CAMPA Authority',
    sanctionAmount: 56000000,
    spentAmount: 41500000,
    startDate: '2024-01-01',
    endDate: '2028-12-31',
    status: 'Ongoing',
    staffCount: 22,
    milestonesTotal: 12,
    milestonesCompleted: 6
  },
  {
    id: 'PRJ-04',
    code: 'WII-GANGES-2023-01',
    title: 'Aquatic Biodiversity Assessment for Ganga Rejuvenation (Namami Gange Phase II)',
    piName: 'Dr. S.A. Hussain',
    coPiName: 'Dr. Ruchi Badola',
    fundingAgency: 'National Mission for Clean Ganga (NMCG)',
    sanctionAmount: 72000000,
    spentAmount: 68400000,
    startDate: '2023-02-01',
    endDate: '2025-12-31',
    status: 'Review',
    staffCount: 26,
    milestonesTotal: 14,
    milestonesCompleted: 13
  }
];

export const PMSView: React.FC<PMSViewProps> = ({ onReturnToLobby }) => {
  const { currentUser } = useApp();
  const [projects, setProjects] = useState<ProjectItem[]>(INITIAL_PROJECTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // New project form state
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newAgency, setNewAgency] = useState('');
  const [newSanction, setNewSanction] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [formError, setFormError] = useState('');

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) {
      setFormError('Please fill in required fields (Project Code and Project Title).');
      return;
    }

    const newProject: ProjectItem = {
      id: `PRJ-${String(projects.length + 1).padStart(2, '0')}`,
      code: newCode.trim(),
      title: newTitle.trim(),
      piName: currentUser.name,
      fundingAgency: newAgency.trim() || 'Institute Sponsored',
      sanctionAmount: Number(newSanction) || 1500000,
      spentAmount: 0,
      startDate: newStartDate || new Date().toISOString().split('T')[0],
      endDate: newEndDate || '2027-12-31',
      status: 'Ongoing',
      staffCount: 1,
      milestonesTotal: 4,
      milestonesCompleted: 0
    };

    setProjects([newProject, ...projects]);
    setShowAddModal(false);
    setNewTitle('');
    setNewCode('');
    setNewAgency('');
    setNewSanction('');
    setNewStartDate('');
    setNewEndDate('');
    setFormError('');
  };

  const handleExportCSV = () => {
    const headers = ['Project Code', 'Project Title', 'Principal Investigator', 'Funding Agency', 'Sanction Amount', 'Spent Amount', 'Start Date', 'End Date', 'Status'];
    const rows = filteredProjects.map((p) => [
      `"${p.code}"`,
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.piName}"`,
      `"${p.fundingAgency}"`,
      p.sanctionAmount,
      p.spentAmount,
      p.startDate,
      p.endDate,
      p.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WII_PMS_Projects_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.piName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.fundingAgency.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalSanction = projects.reduce((acc, p) => acc + p.sanctionAmount, 0);
  const totalSpent = projects.reduce((acc, p) => acc + p.spentAmount, 0);

  const getStatusBadge = (status: ProjectItem['status']) => {
    switch (status) {
      case 'Ongoing':
        return <Badge variant="info">Ongoing</Badge>;
      case 'Completed':
        return <Badge variant="success">Completed</Badge>;
      case 'Delayed':
        return <Badge variant="error">Delayed</Badge>;
      case 'Review':
        return <Badge variant="warning">Review</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Standardized Module PageHeader */}
      <PageHeader
        icon={Briefcase}
        title="Project Management System (PMS)"
        subtitle="Research grants, sanctions, Principal Investigator portfolios, deliverables & field staff allocations."
        breadcrumbs={[
          { label: 'Portal Hub', onClick: onReturnToLobby },
          { label: 'Project Management' }
        ]}
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setFormError('');
                setShowAddModal(true);
              }}
            >
              Add Project
            </Button>
          </div>
        }
      />

      {/* Metrics Row using Standardized MetricCard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Active Projects"
          value={projects.length}
          subtitle="Multi-year Research Grants"
          icon={Briefcase}
          variant="primary"
        />
        <MetricCard
          title="Total Sanctioned"
          value={formatCurrency(totalSanction)}
          subtitle="Approved Grant Corpus"
          icon={IndianRupee}
          variant="success"
        />
        <MetricCard
          title="Grant Utilization"
          value={`${Math.round((totalSpent / totalSanction) * 100)}%`}
          subtitle={`${formatCurrency(totalSpent)} disbursed`}
          icon={TrendingUp}
          variant="warning"
        />
        <MetricCard
          title="Field Scholars"
          value="80 Fellows"
          subtitle="JRF, SRF, Project Scientists"
          icon={Users}
          variant="info"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search title, code, PI name, agency..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={Search}
            size="sm"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end overflow-x-auto">
          <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">Status:</span>
          {['ALL', 'Ongoing', 'Review', 'Completed'].map((st) => (
            <Button
              key={st}
              size="xs"
              variant={selectedStatus === st ? 'primary' : 'outline'}
              onClick={() => {
                setSelectedStatus(st);
                setCurrentPage(1);
              }}
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Standardized Projects Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Project Code &amp; Title</TableHead>
              <TableHead className="w-[22%]">PI &amp; Funding Agency</TableHead>
              <TableHead className="w-[20%]">Sanction &amp; Spend</TableHead>
              <TableHead className="w-[14%]">Duration</TableHead>
              <TableHead align="center" className="w-[8%]">Milestones</TableHead>
              <TableHead align="center" className="w-[8%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProjects.length === 0 ? (
              <TableEmpty colSpan={6} message="No project charters found matching search criteria." />
            ) : (
              paginatedProjects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="align-top">
                    <span className="font-mono font-bold text-[#2563eb] bg-[#eff6ff] border border-[#bfdbfe] px-1.5 py-0.5 rounded text-[10px] inline-block mb-1">
                      {p.code}
                    </span>
                    <div className="font-bold text-slate-900 leading-snug">{p.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{p.staffCount} Staff Allocated</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    <div className="font-bold text-slate-800">{p.piName}</div>
                    {p.coPiName && <div className="text-[11px] text-slate-500">Co-PI: {p.coPiName}</div>}
                    <div className="text-[11px] text-[#2563eb] font-medium mt-1 truncate max-w-xs">{p.fundingAgency}</div>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    <div className="font-bold text-slate-900">{formatCurrency(p.sanctionAmount)}</div>
                    <div className="text-[11px] text-slate-500">Spent: {formatCurrency(p.spentAmount)}</div>
                    <div className="w-24 bg-slate-100 h-1.5 rounded-sm overflow-hidden mt-1.5 border border-slate-200">
                      <div
                        className="bg-[#2563eb] h-full rounded-sm"
                        style={{ width: `${Math.min(100, Math.round((p.spentAmount / p.sanctionAmount) * 100))}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-[11px] text-slate-600 font-mono">
                    <div>{p.startDate}</div>
                    <div className="text-slate-400 text-[10px]">to</div>
                    <div>{p.endDate}</div>
                  </TableCell>
                  <TableCell align="center" className="align-top whitespace-nowrap">
                    <span className="font-bold text-slate-800">
                      {p.milestonesCompleted} / {p.milestonesTotal}
                    </span>
                    <div className="text-[10px] text-slate-400">Deliverables</div>
                  </TableCell>
                  <TableCell align="center" className="align-top whitespace-nowrap">
                    {getStatusBadge(p.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filteredProjects.length > pageSize && (
          <div className="border-t border-slate-100">
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredProjects.length / pageSize)}
              totalItems={filteredProjects.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Standardized Add Project Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="lg"
      >
        <ModalHeader
          title="Register New Project Charter"
          subtitle="Enter research grant sanction details and Principal Investigator metadata."
          icon={Briefcase}
          onClose={() => setShowAddModal(false)}
        />
        <form onSubmit={handleCreateProject}>
          <ModalBody className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Project Code / Sanction No." required>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. WII-MOEF-2026-05"
                  required
                />
              </FormField>

              <FormField label="Funding Agency" required>
                <Input
                  value={newAgency}
                  onChange={(e) => setNewAgency(e.target.value)}
                  placeholder="e.g. MoEFCC / NTCA / DST"
                  required
                />
              </FormField>
            </div>

            <FormField label="Full Project Title" required>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Landscape Ecology & Spatial Modelling of Wildlife Corridors"
                required
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Sanction Amount (INR)">
                <Input
                  type="number"
                  value={newSanction}
                  onChange={(e) => setNewSanction(e.target.value)}
                  placeholder="e.g. 2500000"
                />
              </FormField>

              <FormField label="Start Date">
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </FormField>

              <FormField label="End Date">
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </FormField>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Save Changes
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
