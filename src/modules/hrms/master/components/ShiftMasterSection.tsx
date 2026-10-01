import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../context/AppContext';
import { Shift, parseTimeToMinutes } from '../../../../types';
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
            <p className="text-xs text-slate-500 mt-0.5">
              Design institutional work shifts, start/end hours, grace periods, and half-day thresholds.
            </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingShiftId ? `Edit Shift: ${formCode}` : 'Design New Work Shift'}
                </h3>
              </div>
              <button
                onClick={() => setShowShiftModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">
                    Shift Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GEN-01, MS-01, NS-01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">Short alphanumeric identifier</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">
                    Shift Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. General Office Shift, Lab Night Shift"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">Descriptive shift title</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">e.g. 09:30 (24-hr)</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">
                    End Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">e.g. 17:30 (24-hr)</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">Late Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formGracePeriod}
                    onChange={(e) => setFormGracePeriod(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">Punches within this window marked on-time</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">Half-Day Cutoff Time</label>
                  <input
                    type="time"
                    value={formHalfDayCutoff}
                    onChange={(e) => setFormHalfDayCutoff(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">Punch-in after this triggers half-day</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">Min Hours for Full-Day</label>
                  <input
                    type="number"
                    step="0.25"
                    min="1"
                    max="16"
                    value={formMinFullDayHours}
                    onChange={(e) => setFormMinFullDayHours(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">Normally 7.5 to 8.0 hours</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">Min Hours for Half-Day</label>
                  <input
                    type="number"
                    step="0.25"
                    min="1"
                    max="8"
                    value={formMinHalfDayHours}
                    onChange={(e) => setFormMinHalfDayHours(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 block">Normally 3.5 to 4.0 hours</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Description &amp; Operational Purpose</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Standard office shift for administrative, IT, finance and research staff."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="shiftIsActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
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
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="makeDefaultShift" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Designate as Institutional Default Shift (assigned to new staff)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer shadow-xs"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-100 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Work Shift?</h3>
                <p className="text-xs text-slate-500 font-mono font-bold">{deleteTargetShift.code}</p>
              </div>
            </div>

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
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Yes, Delete Shift
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

