import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Users,
  Calendar,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ChevronRight,
  TrendingUp,
  MapPin,
  Sparkles
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

  // New project form state
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newAgency, setNewAgency] = useState('');
  const [newSanction, setNewSanction] = useState('');

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) return;

    const newProject: ProjectItem = {
      id: `PRJ-${String(projects.length + 1).padStart(2, '0')}`,
      code: newCode.trim(),
      title: newTitle.trim(),
      piName: currentUser.name,
      fundingAgency: newAgency.trim() || 'Institute Sponsored',
      sanctionAmount: Number(newSanction) || 1500000,
      spentAmount: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '2027-12-31',
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

  const totalSanction = projects.reduce((acc, p) => acc + p.sanctionAmount, 0);
  const totalSpent = projects.reduce((acc, p) => acc + p.spentAmount, 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                WII-PMS • Project Management System
              </h2>
              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                MOD-PMS-02
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Research Grants, Sanctions, PI Portfolios, Deliverables &amp; Field Staff Rosters
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Project Charter</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Projects</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{projects.length}</div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1">Multi-year Research Grants</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sanctioned</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(totalSanction)}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Approved Grant Corpus</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Utilization</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{Math.round((totalSpent / totalSanction) * 100)}%</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">{formatCurrency(totalSpent)} disbursed</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Field Scholars</div>
          <div className="text-2xl font-black text-purple-700 mt-1">80 Fellows</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">JRF, SRF, Research Associates</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search title, code, PI name, agency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-700 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {['ALL', 'Ongoing', 'Review', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                selectedStatus === st
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr className="h-10">
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[26%]">Project Code &amp; Title</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[20%]">PI &amp; Agency</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[20%]">Sanction &amp; Spend</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[14%]">Duration</th>
                <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[10%]">Milestones</th>
                <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[10%]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 align-top max-w-sm">
                    <span className="font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] inline-block mb-1">
                      {p.code}
                    </span>
                    <div className="font-bold text-slate-900 leading-snug">{p.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {p.staffCount} Staff Allocated
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <div className="font-bold text-slate-800">{p.piName}</div>
                    {p.coPiName && <div className="text-[10px] text-slate-500">Co-PI: {p.coPiName}</div>}
                    <div className="text-[11px] text-blue-700 font-medium mt-1">{p.fundingAgency}</div>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <div className="font-bold text-slate-900">{formatCurrency(p.sanctionAmount)}</div>
                    <div className="text-[10px] text-slate-500">Spent: {formatCurrency(p.spentAmount)}</div>
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5 border border-slate-200">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.round((p.spentAmount / p.sanctionAmount) * 100))}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-[11px] text-slate-600 font-mono">
                    <div>{p.startDate}</div>
                    <div className="text-slate-400">to</div>
                    <div>{p.endDate}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-center whitespace-nowrap">
                    <span className="font-bold text-slate-800">
                      {p.milestonesCompleted} / {p.milestonesTotal}
                    </span>
                    <div className="text-[10px] text-slate-400">Deliverables Done</div>
                  </td>
                  <td className="px-4 py-3 align-top text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        p.status === 'Ongoing'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : p.status === 'Review'
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-sm">Register New Project Charter</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Project Code / Sanction No.</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., WII-NTCA-2026-01"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Project Title</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter sanctioned research project title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Funding Agency</label>
                  <input
                    type="text"
                    placeholder="e.g. MoEFCC / NTCA / DST"
                    value={newAgency}
                    onChange={(e) => setNewAgency(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Sanction Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2500000"
                    value={newSanction}
                    onChange={(e) => setNewSanction(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Register Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
