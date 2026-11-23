import React, { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { User } from '../../../../types';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge
} from '../../../../shared/components';

/** The present posting, taken from the employee's profile (shown above the history records). */
export interface CurrentPosting { typeLabel: string | null; layout: string; managerName: string | null }

interface UserProjectHistoryModalProps {
  user: User | null;
  current?: CurrentPosting | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserProjectHistoryModal: React.FC<UserProjectHistoryModalProps> = ({
  user,
  current,
  isOpen,
  onClose
}) => {
  const [userHistories, setUserHistories] = useState<UserProjectHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const biometricId = String((user as any)?.biometricId ?? (user as any)?.biometric_id ?? '').trim();

  useEffect(() => {
    if (!isOpen || !user) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    const resolveBiometricId = async (): Promise<string> => {
      if (/^[A-Za-z0-9]{1,10}$/.test(biometricId)) return biometricId;
      // The profile list can contain a user without the canonical biometric field.
      // Resolve it from the server's employee directory using the stable account ID/email.
      const response = await fetch('/api/hrms/employees', {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload.error || 'Could not resolve employee biometric ID.');
      const employees = Array.isArray(payload) ? payload : (Array.isArray(payload.employees) ? payload.employees : []);
      const match = employees.find((employee: any) =>
        String(employee.id) === String(user.id) ||
        (user.email && String(employee.email || '').toLowerCase() === String(user.email).toLowerCase())
      );
      const resolved = String(match?.biometricId ?? match?.biometric_id ?? '').trim();
      if (!/^\d{1,4}$/.test(resolved)) {
        throw new Error('A valid biometric ID could not be found for this employee. Check the employee account record.');
      }
      return resolved;
    };
    resolveBiometricId()
      .then((resolvedId) => {
        return fetch(`/api/hrms/employees/${encodeURIComponent(resolvedId)}/project-history`, {
          credentials: 'include',
          signal: controller.signal
        });
      })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Failed to load project history.');
        return Array.isArray(payload.records) ? payload.records : [];
      })
      .then((records) => {
        setUserHistories(records.map((item: any) => ({
          ...item,
          id: String(item.id),
          userId: user.id,
          userName: user.name,
          startDate: String(item.startDate || '').slice(0, 10),
          endDate: item.endDate ? String(item.endDate).slice(0, 10) : undefined,
          isOngoing: Boolean(item.isOngoing)
        })));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadError(error.message || 'Failed to load project history.');
          setUserHistories([]);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen, user?.id, user?.email, biometricId]);

  const calculateDuration = (start: string, end?: string, ongoing?: boolean) => {
    const s = new Date(start);
    const e = ongoing || !end ? new Date() : new Date(end);
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    const yrs = Math.floor(months / 12);
    const m = months % 12;

    if (yrs === 0 && m === 0) return 'Less than 1 mo';
    let res = '';
    if (yrs > 0) res += `${yrs}y `;
    if (m > 0) res += `${m}m`;
    return res.trim();
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen || !user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title="Project & Posting History"
        subtitle={`Current posting and earlier project postings of ${user?.name || 'employee'}`}
        icon={Briefcase}
        onClose={onClose}
      />

      <ModalBody className="max-h-[65vh] overflow-y-auto space-y-3">
        {current && <CurrentPostingCard user={user} current={current} formatDate={formatDateLabel} duration={calculateDuration} />}
        {loading ? (
          <div className="text-center py-10 text-xs text-slate-500">Loading project history from database…</div>
        ) : loadError ? (
          <div role="alert" className="text-center py-6 px-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">{loadError}</div>
        ) : userHistories.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
            <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-800">No Earlier Postings Recorded</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              No earlier project postings are recorded for this employee.
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-2.5 sm:ml-3 pl-4 sm:pl-5 space-y-3.5">
            {userHistories.map((item) => {
              const durationText = calculateDuration(item.startDate, item.endDate, item.isOngoing);
              const displayPay = item.pay || item.grantAmount;

              return (
                <div key={item.id} className="relative">
                  {/* Timeline Node Dot */}
                  <div
                    className={`absolute -left-[23px] sm:-left-[27px] top-2.5 w-3.5 h-3.5 rounded-full border-2 ring-2 ring-white ${
                      item.isOngoing
                        ? 'bg-emerald-500 border-emerald-600'
                        : 'bg-slate-400 border-slate-500'
                    }`}
                  />

                  {/* Timeline Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
                    {/* Row 1: Project Name & Status */}
                    <div className="border-b border-slate-100 pb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                          <Badge variant={item.isOngoing ? 'success' : 'neutral'} size="sm">
                            {item.isOngoing ? 'Ongoing' : 'Earlier posting'}
                          </Badge>

                          {item.projectCode && (
                            <Tag mono>{item.projectCode}</Tag>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 mt-1 leading-snug break-words">
                          {item.projectName}
                        </h4>
                      </div>
                      <DurationChip text={durationText} />
                    </div>

                    {/* Same layout as the current posting card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                      <Cell label="Period" value={`${formatDateLabel(item.startDate)} → ${item.isOngoing ? 'Present' : formatDateLabel(item.endDate || '')}`} />
                      <Cell label="Post / Designation" value={item.roleInProject || 'Project Staff'} />
                      <Cell label="Pay / Fellowship" value={displayPay ? String(displayPay) : 'As per project norms'} />
                      <Cell label="Principal Investigator (PI)" value={[item.piName, item.piEmail ? `(${item.piEmail})` : ''].filter(Boolean).join(' ')} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="w-full flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            {userHistories.length} earlier record(s)
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

/** One labelled value: the same box on every card of this popup. */
const Cell: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg px-2.5 py-1.5 min-w-0">
    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{label}</span>
    <div className="font-bold text-slate-900 text-[11px] mt-0.5 break-words">{value || 'Not recorded'}</div>
  </div>
);

const Tag: React.FC<{ children: React.ReactNode; mono?: boolean }> = ({ children, mono }) => (
  <span className={`${mono ? 'font-mono ' : ''}text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md`}>{children}</span>
);

const DurationChip: React.FC<{ text: string }> = ({ text }) => (
  <span className="shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200">{text}</span>
);

/** The employee's present posting, from the profile: type, place of work, post, period and reporting person. */
const CurrentPostingCard: React.FC<{
  user: User;
  current: CurrentPosting;
  formatDate: (d: string) => string;
  duration: (start: string, end?: string, ongoing?: boolean) => string;
}> = ({ user, current, formatDate, duration }) => {
  const student = current.layout === 'diploma_trainee' || current.layout === 'bsc_msc_student';
  const active = user.status !== 'deactivated';
  const permanentDirect = current.layout === 'permanent' && (user as { permanentEmploymentType?: string }).permanentEmploymentType !== 'Deputation';
  const place = student
    ? [user.courseProgram, user.courseBatch].filter(Boolean).join(' · ')
    : user.department;
  const placeLabel = student ? 'Course / Batch' : current.layout === 'researcher' ? 'Project' : current.layout === 'intern' ? 'Project / Department' : 'Department / Section';
  const post = student ? 'Student' : current.layout === 'phd_student' ? 'PhD Scholar' : user.designation;
  const managerLabel = current.layout === 'researcher' ? 'Principal Investigator (PI)' : 'Reporting Manager';
  const end = permanentDirect ? undefined : user.validUntilDate;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={active ? 'success' : 'neutral'} size="sm">{active ? 'Current posting' : 'Last posting (inactive)'}</Badge>
          {current.typeLabel && <Tag>{current.typeLabel}</Tag>}
          {user.institute && <Tag mono>{user.institute}</Tag>}
        </div>
        {user.joiningDate && (
          <DurationChip text={duration(user.joiningDate, end, !end || end > new Date().toISOString().slice(0, 10))} />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
        <Cell label={placeLabel} value={place} />
        <Cell label="Post / Designation" value={post} />
        <Cell
          label={permanentDirect ? 'Joined on' : 'Period'}
          value={user.joiningDate ? (permanentDirect ? formatDate(user.joiningDate) : `${formatDate(user.joiningDate)} → ${end ? formatDate(end) : 'Present'}`) : null}
        />
        <Cell label={managerLabel} value={current.managerName} />
      </div>
    </div>
  );
};
