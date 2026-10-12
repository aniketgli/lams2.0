import React, { useState } from 'react';
import { BookOpen, ShieldAlert, Award, Clock } from 'lucide-react';
import { CCS_LEAVE_RULES_SUMMARY } from '../data/ccsLeaveRulesData';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge,
  SearchBar
} from '../../../../shared/components';

interface CCSLeaveRulesModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

export const CCSLeaveRulesModal: React.FC<CCSLeaveRulesModalProps> = ({ isOpen = true, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | 'all'>('all');

  if (!isOpen) return null;

  const filteredCategories = CCS_LEAVE_RULES_SUMMARY.map((cat, idx) => {
    if (selectedCategoryIndex !== 'all' && selectedCategoryIndex !== idx) {
      return null;
    }
    const filteredItems = cat.items.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.rule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredItems.length === 0) return null;
    return {
      ...cat,
      items: filteredItems
    };
  }).filter(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader
        title="CCS (Leave) Rules, 1972 — Leave Rules Guidelines"
        subtitle="Official statutory provisions & guidelines for Government Servants"
        icon={BookOpen}
        onClose={onClose}
      />

      {/* Filter and Search Bar */}
      <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0">
        <div className="w-full sm:w-72">
          <SearchBar
            placeholder="Search rules (e.g. EL, CCL, Rule 26)..."
            value={searchTerm}
            onChange={setSearchTerm}
            size="sm"
          />
        </div>

        <div className="flex items-center flex-wrap gap-1.5 w-full sm:w-auto">
          <Button
            size="xs"
            variant={selectedCategoryIndex === 'all' ? 'primary' : 'outline'}
            onClick={() => setSelectedCategoryIndex('all')}
          >
            All Provisions
          </Button>
          {CCS_LEAVE_RULES_SUMMARY.map((cat, idx) => (
            <Button
              key={idx}
              size="xs"
              variant={selectedCategoryIndex === idx ? 'primary' : 'outline'}
              onClick={() => setSelectedCategoryIndex(idx)}
            >
              {cat.category.split(' ')[0]}
            </Button>
          ))}
        </div>
      </div>

      <ModalBody className="space-y-4 max-h-[62vh] overflow-y-auto">
        {/* Key Rule Highlight Banner */}
        <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3.5 flex items-start space-x-3 text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold block text-amber-950">
              Fundamental Rule 7(1): Right to Leave
            </span>
            <p className="text-amber-800 leading-relaxed font-normal">
              Leave cannot be claimed as a matter of right. The sanctioning authority may refuse, curtail, or revoke leave in the public interest. Leave applied for cannot be altered by the organization except on written request of the employee.
            </p>
          </div>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p className="text-xs font-medium">No matching leave rules found for "{searchTerm}"</p>
          </div>
        ) : (
          filteredCategories.map((cat, catIdx) => (
            cat && (
              <div key={catIdx} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                    <Award className="w-3.5 h-3.5 text-[#2563eb]" />
                    <span>{cat.category}</span>
                  </h3>
                  <Badge variant="neutral" size="sm">
                    {cat.items.length} {cat.items.length === 1 ? 'Rule' : 'Rules'}
                  </Badge>
                </div>

                <div className="divide-y divide-slate-100">
                  {cat.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="p-3.5 hover:bg-slate-50/50 transition-colors space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900">{item.name}</span>
                          <Badge variant="info" size="sm">
                            {item.rule}
                          </Badge>
                        </div>
                        <Badge
                          variant={item.debited ? 'error' : 'success'}
                          size="sm"
                        >
                          {item.debited ? 'Debited from Account' : 'NOT Debited from Account'}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {item.summary}
                      </p>

                      {item.details && item.details.length > 0 && (
                        <ul className="pl-4 text-[11px] text-slate-600 space-y-1 list-disc">
                          {item.details.map((det, dIdx) => (
                            <li key={dIdx}>{det}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ))
        )}
      </ModalBody>

      <ModalFooter>
        <div className="w-full flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Ref: CCS (Leave) Rules 1972 &amp; Executive Guidelines</span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={onClose}
          >
            Close Guidelines
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};
