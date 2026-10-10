import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { Shift, parseTimeToMinutes } from '../../../../types';
import { AppTimePicker } from '../../../../shared/components/AppTimePicker';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Star,
  Users,
  X,
  CheckCircle
} from 'lucide-react';

export const ShiftMasterSection: React.FC = () => {
  const {
    shifts,
    addShift,
    updateShift,
    deleteShift,
    setDefaultShift,
    users
  } = useApp();

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string>('');
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Modal State for Shift Create/Edit & Delete
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [deleteTargetShift, setDeleteTargetShift] = useState<Shift | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:30');
  const [formEndTime, setFormEndTime] = useState('17:30');
  const [formGracePeriod, setFormGracePeriod] = useState(15);
  const [formHalfDayCutoff, setFormHalfDayCutoff] = useState('13:30');
  const [formMinFullDayHours, setFormMinFullDayHours] = useState(7.5);
  const [formMinHalfDayHours, setFormMinHalfDayHours] = useState(4.0);
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingShiftId(null);
    setFormCode(`SH-${shifts.length + 1}`);
    setFormName('');
    setFormStartTime('09:30');
    setFormEndTime('17:30');
    setFormGracePeriod(15);
    setFormHalfDayCutoff('13:30');
    setFormMinFullDayHours(7.5);
    setFormMinHalfDayHours(4.0);
    setFormDescription('');
    setFormIsDefault(false);
    setFormIsActive(true);
    setShowShiftModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (shift: Shift) => {
    setEditingShiftId(shift.id);
    setFormCode(shift.code);
    setFormName(shift.name);
    setFormStartTime(shift.startTime);
    setFormEndTime(shift.endTime);
    setFormGracePeriod(shift.gracePeriodMins);
    setFormHalfDayCutoff(shift.halfDayCutoffTime || '13:30');
    setFormMinFullDayHours(shift.fullDayHours ?? shift.minFullDayHours ?? 7.5);
    setFormMinHalfDayHours(shift.halfDayHours ?? shift.minHalfDayHours ?? 4.0);
    setFormDescription(shift.description || '');
    setFormIsDefault(Boolean(shift.isDefault));
    setFormIsActive(shift.isActive ?? true);
    setShowShiftModal(true);
  };

  // Submit Shift Modal Form
  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      showToast('Shift Code and Shift Name are required.');
      return;
    }

    if (editingShiftId) {
      const res = updateShift(editingShiftId, {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        startTime: formStartTime,
        endTime: formEndTime,
        gracePeriodMins: Number(formGracePeriod) || 0,
        halfDayCutoffTime: formHalfDayCutoff,
        fullDayHours: Number(formMinFullDayHours) || 7.5,
        halfDayHours: Number(formMinHalfDayHours) || 4.0,
        minFullDayHours: Number(formMinFullDayHours) || 7.5,
        minHalfDayHours: Number(formMinHalfDayHours) || 4.0,
        description: formDescription.trim(),
        isDefault: formIsDefault,
        isActive: formIsActive
      });
      showToast(res.message);
    } else {
      const res = addShift({
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        startTime: formStartTime,
        endTime: formEndTime,
        gracePeriodMins: Number(formGracePeriod) || 0,
        halfDayCutoffTime: formHalfDayCutoff,
        fullDayHours: Number(formMinFullDayHours) || 7.5,
        halfDayHours: Number(formMinHalfDayHours) || 4.0,
        minFullDayHours: Number(formMinFullDayHours) || 7.5,
        minHalfDayHours: Number(formMinHalfDayHours) || 4.0,
        description: formDescription.trim(),
        isDefault: formIsDefault,
        isActive: formIsActive
      });
      showToast(res.message);
    }

    setShowShiftModal(false);
  };

  // Toggle Active / Inactive Status
  const handleToggleActive = (shift: Shift) => {
    const isCurrentlyActive = shift.isActive ?? true;
    if (isCurrentlyActive && shift.isDefault) {
      showToast('Institutional default shift cannot be set to inactive. Set another shift as default first.');
      return;
    }
    const nextState = !isCurrentlyActive;
    const res = updateShift(shift.id, { isActive: nextState });
    showToast(`Shift ${shift.code} is now ${nextState ? 'Active' : 'Inactive'}.`);
  };

  // Confirm Delete Handler
  const handleConfirmDelete = () => {
    if (!deleteTargetShift) return;
    const res = deleteShift(deleteTargetShift.id);
    showToast(res.message);
    setDeleteTargetShift(null);
  };

  // Calculate Shift Duration
  const getShiftDurationHours = (start: string, end: string): string => {
    const startM = parseTimeToMinutes(start);
    const endM = parseTimeToMinutes(end);
    let diff = endM - startM;
    if (diff < 0) diff += 24 * 60; // overnight shift
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}h ${mins > 0 ? `${mins}m` : '00m'}`;
  };

  // Staff Count per Shift
  const shiftStaffCountMap = useMemo(() => {
    const map = new Map<string, number>();
    shifts.forEach((s) => map.set(s.id, 0));
    const defaultShiftId = shifts.find((s) => s.isDefault)?.id || shifts[0]?.id;

    users.forEach((u) => {
      const sid = u.shiftId || defaultShiftId;
      if (sid && map.has(sid)) {
        map.set(sid, (map.get(sid) || 0) + 1);
      }
    });
    return map;
  }, [shifts, users]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center space-x-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Shift Master Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-700" />
              <span>Shift Master &amp; Timing Rules</span>
            </h3>
            
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleOpenCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Shift</span>
            </button>
          </div>
        </div>
      </div>

      {/* DEFINED SHIFTS LIST */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shifts.map((shift) => {
            const staffCount = shiftStaffCountMap.get(shift.id) || 0;
            const duration = getShiftDurationHours(shift.startTime, shift.endTime);

            return (
              <div
                key={shift.id}
                className={`bg-white border rounded-xl p-4.5 shadow-xs flex flex-col justify-between transition-all hover:border-indigo-300 relative ${
                  shift.isDefault ? 'border-amber-300 ring-1 ring-amber-200/60 bg-amber-50/10' : 'border-slate-200'
                } ${shift.isActive === false ? 'opacity-75 bg-slate-50/50' : ''}`}
              >
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-white shadow-2xs tracking-wider">
                        {shift.code}
                      </span>
                      {shift.isDefault && (
                        <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs">
                          <Star className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                          <span>Default</span>
                        </span>
                      )}
                      <button
                        onClick={() => handleToggleActive(shift)}
                        className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                          shift.isActive !== false
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'
                        }`}
                        title={shift.isActive !== false ? 'Active shift. Click to set Inactive' : 'Inactive shift. Click to set Active'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${shift.isActive !== false ? 'bg-emerald-600' : 'bg-slate-500'}`}></span>
                        <span>{shift.isActive !== false ? 'Active' : 'Inactive'}</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(shift)}
                        className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit Shift"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!shift.isDefault && (
                        <button
                          onClick={() => {
                            const res = setDefaultShift(shift.id);
                            showToast(res.message);
                          }}
                          className="p-1 text-slate-500 hover:text-amber-600 rounded hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Set as Default Shift"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!shift.isDefault && (
                        <button
                          onClick={() => {
                            if (shifts.length <= 1) {
                              showToast('At least one work shift must remain in the system.');
                              return;
                            }
                            setDeleteTargetShift(shift);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Shift"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Shift Name & Description */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{shift.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      {shift.description || 'Standard institutional work shift configuration.'}
                    </p>
                  </div>

                  {/* Timings Strip */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Shift Timing:</span>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {shift.startTime} - {shift.endTime} ({duration})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400 block font-medium">Late Grace:</span>
                        <span className="font-bold text-slate-700">+{shift.gracePeriodMins} mins</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Half-Day Cutoff:</span>
                        <span className="font-bold text-slate-700">{shift.halfDayCutoffTime}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Full Day Min:</span>
                        <span className="font-bold text-slate-700">{shift.minFullDayHours} hrs</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Half Day Min:</span>
                        <span className="font-bold text-slate-700">{shift.minHalfDayHours} hrs</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer with Staff Count */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      <strong className="text-slate-900 font-bold">{staffCount}</strong> staff assigned
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SHIFT CREATE / EDIT MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto">
            {/* Dedicated Modal Header */}
            <div className="relative overflow-hidden px-5 py-4 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60 rounded-t-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-blue-200 shrink-0 shadow-sm">
                  <Clock className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-white tracking-tight">
                    {editingShiftId ? `Edit Shift: ${formCode}` : 'Design New Work Shift'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowShiftModal(false)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shift Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GEN-01, MS-01, NS-01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all text-xs"
                  />
                  <span className="text-[10px] text-slate-400 block">Short alphanumeric identifier</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shift Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. General Office Shift, Lab Night Shift"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all text-xs"
                  />
                  <span className="text-[10px] text-slate-400 block">Descriptive shift title</span>
                </div>

                <div className="space-y-1.5">
                  <AppTimePicker
                    label="Start Time"
                    required={true}
                    value={formStartTime}
                    onChange={(val) => setFormStartTime(val)}
                    presets={['08:00', '08:30', '09:00', '09:30', '10:00']}
                  />
                  <span className="text-[10px] text-slate-400 block">e.g. 09:30 (24-hr)</span>
                </div>

                <div className="space-y-1.5">
                  <AppTimePicker
                    label="End Time"
                    required={true}
                    value={formEndTime}
                    onChange={(val) => setFormEndTime(val)}
                    presets={['17:00', '17:30', '18:00', '18:30', '19:00']}
                  />
                  <span className="text-[10px] text-slate-400 block">e.g. 17:30 (24-hr)</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Late Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formGracePeriod}
                    onChange={(e) => setFormGracePeriod(Number(e.target.value))}
                    className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all text-xs"
                  />
                  <span className="text-[10px] text-slate-400 block">Punches within this window marked on-time</span>
                </div>

                <div className="space-y-1.5">
                  <AppTimePicker
                    label="Half-Day Cutoff Time"
                    value={formHalfDayCutoff}
                    onChange={(val) => setFormHalfDayCutoff(val)}
                    presets={['12:00', '13:00', '13:30', '14:00']}
                  />
                  <span className="text-[10px] text-slate-400 block">Punch-in after this triggers half-day</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Hours for Full-Day</label>
                  <input
                    type="number"
                    step="0.25"
                    min="1"
                    max="16"
                    value={formMinFullDayHours}
                    onChange={(e) => setFormMinFullDayHours(Number(e.target.value))}
                    className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all text-xs"
                  />
                  <span className="text-[10px] text-slate-400 block">Normally 7.5 to 8.0 hours</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Hours for Half-Day</label>
                  <input
                    type="number"
                    step="0.25"
                    min="1"
                    max="8"
                    value={formMinHalfDayHours}
                    onChange={(e) => setFormMinHalfDayHours(Number(e.target.value))}
                    className="h-9 w-full bg-slate-50 border border-slate-200/90 rounded-xl px-3 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all text-xs"
                  />
                  <span className="text-[10px] text-slate-400 block">Normally 3.5 to 4.0 hours</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 mb-1">Description &amp; Operational Purpose</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Standard office shift for administrative, IT, finance and research staff."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 shadow-2xs transition-all"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="shiftIsActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="shiftIsActive" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Shift Active (Available for staff assignment &amp; attendance evaluation)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="makeDefaultShift"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="makeDefaultShift" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Designate as Institutional Default Shift (assigned to new staff)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 active:scale-95"
                >
                  {editingShiftId ? 'Save Changes' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] text-white flex items-center justify-between shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 flex items-center justify-center text-rose-300 shrink-0 shadow-sm">
                  <Trash2 className="w-4.5 h-4.5 text-rose-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Delete Work Shift</h3>
                  <p className="text-xs text-blue-200/80 mt-0.5">Shift Configuration Master</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTargetShift(null)}
                className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete shift <strong className="text-slate-900 font-bold">{deleteTargetShift.name} ({deleteTargetShift.code})</strong>?
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed font-medium">
                ⚠️ All staff members assigned to this shift will be automatically transferred to the default shift.
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteTargetShift(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Yes, Delete Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

