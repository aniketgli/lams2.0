import React, { useState } from 'react';
import {
  X,
  Briefcase,
  Calendar,
  User as UserIcon,
  Search,
  Plus,
  Edit2,
  Trash2,
  Award,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Shield,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';
import { User, UserProjectHistory } from '../../../../types';
import { useApp } from '../../../../context/AppContext';

interface UserProjectHistoryModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserProjectHistoryModal: React.FC<UserProjectHistoryModalProps> = ({
  user,
  isOpen,
  onClose
}) => {
  const {
    currentUser,
    users,
    getUserProjectHistories,
    addProjectHistory,
    updateProjectHistory,
    deleteProjectHistory
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ongoing' | 'completed'>('all');

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserProjectHistory | null>(null);

  // Form Fields
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [piName, setPiName] = useState('');
  const [piEmail, setPiEmail] = useState('');
  const [roleInProject, setRoleInProject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isOngoing, setIsOngoing] = useState(true);
  const [department, setDepartment] = useState('');
  const [fundingAgency, setFundingAgency] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [remarks, setRemarks] = useState('');

  // Delete Confirmation
  const [itemToDelete, setItemToDelete] = useState<UserProjectHistory | null>(null);

  if (!isOpen || !user) return null;

  const isAdmin = currentUser.roles?.includes('administrator') || currentUser.role === 'administrator';

  const userHistories = getUserProjectHistories(user.id);

  // Filtered entries
  const filteredHistories = userHistories.filter((item) => {
    const matchesSearch =
      item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.piName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.projectCode && item.projectCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.fundingAgency && item.fundingAgency.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.roleInProject.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'ongoing') return matchesSearch && item.isOngoing;
    if (filterStatus === 'completed') return matchesSearch && !item.isOngoing;
    return matchesSearch;
  });

  const ongoingCount = userHistories.filter((h) => h.isOngoing).length;
  const completedCount = userHistories.filter((h) => !h.isOngoing).length;

  const openAddForm = () => {
    setEditingItem(null);
    setProjectName('');
    setProjectCode('');
    setPiName(user.piName || '');
    setPiEmail('');
    setRoleInProject(user.designation || 'Project Scientist');
    setStartDate(user.joiningDate || new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsOngoing(true);
    setDepartment(user.department || '');
    setFundingAgency('WII Core / MoEFCC');
    setGrantAmount('');
    setResponsibilities('');
    setRemarks('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: UserProjectHistory) => {
    setEditingItem(item);
    setProjectName(item.projectName);
    setProjectCode(item.projectCode || '');
    setPiName(item.piName);
    setPiEmail(item.piEmail || '');
    setRoleInProject(item.roleInProject);
    setStartDate(item.startDate);
    setEndDate(item.endDate || '');
    setIsOngoing(item.isOngoing);
    setDepartment(item.department);
    setFundingAgency(item.fundingAgency || '');
    setGrantAmount(item.grantAmount || '');
    setResponsibilities(item.responsibilities || '');
    setRemarks(item.remarks || '');
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !piName.trim() || !startDate) return;

    if (editingItem) {
      updateProjectHistory(editingItem.id, {
        projectName,
        projectCode,
        piName,
        piEmail,
        roleInProject,
        startDate,
        endDate: isOngoing ? '' : endDate,
        isOngoing,
        department,
        fundingAgency,
        grantAmount,
        responsibilities,
        remarks
      });
    } else {
      addProjectHistory({
        userId: user.id,
        userName: user.name,
        projectName,
        projectCode,
        piName,
        piEmail,
        roleInProject,
        startDate,
        endDate: isOngoing ? '' : endDate,
        isOngoing,
        department,
        fundingAgency,
        grantAmount,
        responsibilities,
        remarks,
        addedBy: currentUser.name,
        addedAt: new Date().toISOString().split('T')[0]
      });
    }

    setIsFormOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      deleteProjectHistory(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  const calculateDuration = (start: string, end?: string, ongoing?: boolean) => {
    const s = new Date(start);
    const e = ongoing || !end ? new Date() : new Date(end);
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    const yrs = Math.floor(months / 12);
    const m = months % 12;

    if (yrs === 0 && m === 0) return 'Less than 1 month';
    let res = '';
    if (yrs > 0) res += `${yrs} Year${yrs > 1 ? 's' : ''} `;
    if (m > 0) res += `${m} Month${m > 1 ? 's' : ''}`;
    return res.trim();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shadow-xs shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  User Project &amp; Assignment History
                </h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Service Record
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Principal Investigator (PI) history, project timeline, funding &amp; past postings
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Left: User Avatar & Meta */}
            <div className="flex items-center space-x-3.5">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-xs shrink-0"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold text-slate-900">{user.name}</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                    {user.employmentType}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-semibold mt-0.5">
                  {user.designation} • <span className="text-slate-800 font-bold">{user.department}</span>
                </p>
                <div className="flex items-center space-x-3 mt-1 text-[11px] text-slate-500 font-medium">
                  <span>Joined: <strong className="text-slate-700">{user.joiningDate || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Current PI: <strong className="text-slate-800">{user.piName || 'Direct HOD'}</strong></span>
                </div>
              </div>
            </div>

            {/* Right: Summary Statistics & Actions */}
            <div className="flex items-center space-x-2">
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Total Postings</span>
                <span className="text-sm font-black text-slate-900">{userHistories.length}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-extrabold text-emerald-600 block">Active Ongoing</span>
                <span className="text-sm font-black text-emerald-900">{ongoingCount}</span>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Completed Past</span>
                <span className="text-sm font-black text-slate-800">{completedCount}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Toolbar: Filters, Search & Add Button */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Projects ({userHistories.length})
            </button>
            <button
              onClick={() => setFilterStatus('ongoing')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'ongoing'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({ongoingCount})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'completed'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past Completed ({completedCount})
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search project, PI name, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {isAdmin && (
              <button
                onClick={openAddForm}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold cursor-pointer text-xs inline-flex items-center space-x-1.5 shadow-xs transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Record</span>
              </button>
            )}
          </div>

        </div>

        {/* Modal Content: Timeline & Cards */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
          
          {filteredHistories.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
              <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-extrabold text-slate-800">No Project History Records Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm || filterStatus !== 'all'
                  ? 'No matching project assignment records found for your current filter criteria.'
                  : 'No past or ongoing project postings have been recorded for this user yet.'}
              </p>
              {isAdmin && !searchTerm && filterStatus === 'all' && (
                <button
                  onClick={openAddForm}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Project Posting Entry</span>
                </button>
              )}
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
              {filteredHistories.map((item) => {
                const durationText = calculateDuration(item.startDate, item.endDate, item.isOngoing);

                return (
                  <div key={item.id} className="relative group">
                    {/* Timeline Node Badge */}
                    <div
                      className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 ring-4 ring-white ${
                        item.isOngoing
                          ? 'bg-emerald-500 border-emerald-600'
                          : 'bg-slate-400 border-slate-500'
                      }`}
                    />

                    {/* Card Container */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
                      
                      {/* Top Row: Title & Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            {item.isOngoing ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                <span>Active Project</span>
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                Completed Past Project
                              </span>
                            )}

                            {item.projectCode && (
                              <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
                                {item.projectCode}
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                            {item.projectName}
                          </h4>
                        </div>

                        {/* Admin Action Buttons */}
                        {isAdmin && (
                          <div className="flex items-center space-x-1 self-end sm:self-start shrink-0">
                            <button
                              onClick={() => openEditForm(item)}
                              title="Edit History Entry"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setItemToDelete(item)}
                              title="Delete History Entry"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Main Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                        
                        {/* Principal Investigator (PI) & Role */}
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-black tracking-wider text-blue-700 flex items-center space-x-1">
                            <UserIcon className="w-3 h-3 text-blue-600" />
                            <span>Principal Investigator (PI)</span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-900 mt-1">
                            {item.piName}
                          </div>
                          {item.piEmail && (
                            <div className="text-[11px] font-mono text-slate-500">{item.piEmail}</div>
                          )}
                          <div className="mt-2 pt-2 border-t border-blue-100/80">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Role in Project</span>
                            <span className="text-xs font-bold text-blue-900">{item.roleInProject}</span>
                          </div>
                        </div>

                        {/* Project Duration & Timeline */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-black tracking-wider text-slate-500 flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>Posting Duration</span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-900 mt-1">
                            {item.startDate} <span className="text-slate-400">→</span> {item.isOngoing ? 'Present' : (item.endDate || 'N/A')}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700 mt-1 inline-block bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ⏱️ {durationText}
                          </div>
                        </div>

                        {/* Funding Agency & Department */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="text-[10px] uppercase font-black tracking-wider text-slate-500 flex items-center space-x-1">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>Sponsor / Grant Agency</span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 mt-1">
                            {item.fundingAgency || 'Institute Core Funding'}
                          </div>
                          {item.grantAmount && (
                            <div className="text-[11px] font-mono text-slate-600 font-semibold mt-0.5">
                              Grant: <strong className="text-slate-900">{item.grantAmount}</strong>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Responsibilities & Remarks */}
                      {item.responsibilities && (
                        <div className="mt-3 bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
                          <span className="font-extrabold text-slate-900 block mb-0.5">Core Deliverables &amp; Responsibilities:</span>
                          <p className="leading-relaxed">{item.responsibilities}</p>
                        </div>
                      )}

                      {item.remarks && (
                        <div className="mt-2 text-[11px] text-slate-500 italic flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Remarks: {item.remarks}</span>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500 font-medium flex items-center space-x-1">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Official Institutional Service Record</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold cursor-pointer text-xs inline-flex items-center space-x-1.5 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer text-xs shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Add / Edit Form Modal Dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                <span>{editingItem ? 'Edit Project Posting Record' : 'Add New Project Posting Record'}</span>
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto text-xs">
              
              {/* Project Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Project Name / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAMPA Tiger Corridor Connectivity & Predator Dynamics Study"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Project Code & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Project Sanction Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CAMPA/TIGER/2021/04"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Role in Project <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Research Fellow / Co-PI"
                    value={roleInProject}
                    onChange={(e) => setRoleInProject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* PI Name & PI Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Principal Investigator (PI) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Vikram Singh"
                    value={piName}
                    onChange={(e) => setPiName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">PI Email</label>
                  <input
                    type="email"
                    placeholder="e.g. vikram.singh@inst.org"
                    value={piEmail}
                    onChange={(e) => setPiEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Dates & Ongoing Checkbox */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Posting Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Posting End Date</label>
                  <input
                    type="date"
                    disabled={isOngoing}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="isOngoingCheck"
                    checked={isOngoing}
                    onChange={(e) => setIsOngoing(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <label htmlFor="isOngoingCheck" className="text-slate-800 font-bold cursor-pointer">
                    Currently Active / Ongoing Project Assignment
                  </label>
                </div>
              </div>

              {/* Funding Agency & Grant Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Funding Agency / Sponsor</label>
                  <input
                    type="text"
                    placeholder="e.g. MoEFCC / NTCA / DST"
                    value={fundingAgency}
                    onChange={(e) => setFundingAgency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Project Grant Amount</label>
                  <input
                    type="text"
                    placeholder="e.g. ₹ 3.80 Cr"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Responsibilities */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Responsibilities &amp; Key Deliverables</label>
                <textarea
                  rows={2}
                  placeholder="Key responsibilities, field survey scopes, lab duties, research papers authored..."
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold cursor-pointer shadow-xs"
                >
                  {editingItem ? 'Save Changes' : 'Record Assignment'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-extrabold text-slate-900">Delete Project History Entry?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <strong className="text-slate-800">{itemToDelete.projectName}</strong> from service history? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer shadow-xs"
              >
                Yes, Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
