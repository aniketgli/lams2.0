import React from 'react';
import { Briefcase } from 'lucide-react';
import { User } from '../../../../types';
import { useApp } from '../../../../context/AppContext';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge
} from '../../../../shared/components';

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
  const { getUserProjectHistories } = useApp();

  if (!isOpen || !user) return null;

  const userHistories = getUserProjectHistories(user.id);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title="Project & Posting History"
        subtitle={`Chronological research project postings for ${user.name}`}
        icon={Briefcase}
        onClose={onClose}
      />

      <ModalBody className="max-h-[65vh] overflow-y-auto space-y-3">
        {userHistories.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
            <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-800">No Project Records Found</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              No project postings recorded for this employee.
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
                  <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs hover:border-slate-300 transition-all">
                    {/* Row 1: Project Name & Status */}
                    <div className="border-b border-slate-100 pb-2">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                          <Badge
                            variant={item.isOngoing ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {item.isOngoing ? 'Active' : 'Past'}
                          </Badge>

                          {item.projectCode && (
                            <span className="font-mono text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded-md">
                              {item.projectCode}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 mt-1 leading-snug break-words">
                          {item.projectName}
                        </h4>
                      </div>
                    </div>

                    {/* Row 2: Timeline, Post, Pay, PI Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                      {/* 1. Timeline Duration */}
                      <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                          Duration / Timeline
                        </span>
                        <div className="font-bold text-slate-800 text-[11px] mt-0.5 flex items-center justify-between gap-1 flex-wrap">
                          <span>
                            {formatDateLabel(item.startDate)} → {item.isOngoing ? 'Present' : formatDateLabel(item.endDate || '')}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                            ⏱️ {durationText}
                          </span>
                        </div>
                      </div>

                      {/* 2. Post / Designation */}
                      <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                          Post / Designation
                        </span>
                        <div className="font-bold text-slate-900 text-[11px] mt-0.5 truncate">
                          {item.roleInProject || 'Project Staff'}
                        </div>
                      </div>

                      {/* 3. Pay / Fellowship */}
                      <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-emerald-800 block uppercase tracking-wider">
                          Pay / Fellowship
                        </span>
                        <div className="font-extrabold text-emerald-950 text-[11px] mt-0.5 truncate">
                          {displayPay ? displayPay : 'As per Project Norms'}
                        </div>
                      </div>

                      {/* 4. Principal Investigator */}
                      <div className="bg-blue-50/60 border border-blue-200/70 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-blue-800 block uppercase tracking-wider">
                          Principal Investigator (PI)
                        </span>
                        <div className="font-bold text-blue-950 text-[11px] mt-0.5 truncate">
                          {item.piName}
                          {item.piEmail && (
                            <span className="text-[10px] font-normal text-blue-700 ml-1">
                              ({item.piEmail})
                            </span>
                          )}
                        </div>
                      </div>
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
            Total {userHistories.length} record(s)
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
