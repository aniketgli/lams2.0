import React, { useState } from 'react';
import { X, BookOpen, Search, ShieldAlert, Award, Clock } from 'lucide-react';
import { CCS_LEAVE_RULES_SUMMARY } from '../data/ccsLeaveRulesData';

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
    const filteredItems = cat.items.filter(item => 
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shadow-xs shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  CCS (Leave) Rules, 1972 — Leave Rules Guidelines
                </h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Provisions
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Official Rules &amp; Provisions for Government Servants
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

        {/* Filter and Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search rules (e.g. EL, CCL, Rule 26)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center flex-wrap gap-1.5 w-full sm:w-auto text-xs">
            <button
              onClick={() => setSelectedCategoryIndex('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                selectedCategoryIndex === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Provisions
            </button>
            {CCS_LEAVE_RULES_SUMMARY.map((cat, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedCategoryIndex(idx)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedCategoryIndex === idx
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.category.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Content / Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Key Rule Highlight Banner */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex items-start space-x-3 text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold block text-amber-950">
                Fundamental Rule 7(1): Right to Leave
              </span>
              <p className="text-amber-800 leading-relaxed">
                Leave cannot be claimed as a matter of right. The sanctioning authority may refuse, curtail, or revoke leave in the public interest. Leave applied for cannot be altered by the organization except on written request of the employee.
              </p>
            </div>
          </div>

          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-medium">No matching leave rules found for "{searchTerm}"</p>
            </div>
          ) : (
            filteredCategories.map((cat, catIdx) => (
              cat && (
                <div key={catIdx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                      <Award className="w-4 h-4 text-indigo-600" />
                      <span>{cat.category}</span>
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                      {cat.items.length} {cat.items.length === 1 ? 'Rule' : 'Rules'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {cat.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-slate-900">{item.name}</span>
                            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
                              {item.rule}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              item.debited
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {item.debited ? 'Debited from Account' : 'NOT Debited from Account'}
                          </span>
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
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center space-x-2 text-slate-500">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Ref: CCS (Leave) Rules 1972 & Executive Guidelines</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors shadow-sm"
          >
            Close Guidelines
          </button>
        </div>
      </div>
    </div>
  );
};
