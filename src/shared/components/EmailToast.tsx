import React from 'react';
import { useApp } from '../../context/AppContext';
import { Mail, AlertCircle, X, Check } from 'lucide-react';

export const EmailToast: React.FC = () => {
  const { latestEmailToast, dismissEmailToast } = useApp();

  if (!latestEmailToast) return null;

  const isSuccess = latestEmailToast.status === 'delivered' || latestEmailToast.status === 'sent' || latestEmailToast.status === 'logged_only';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700/80 flex items-start space-x-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
          isSuccess 
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
        }`}>
          {isSuccess ? <Mail className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-1.5">
              <span>Email Notification Sent</span>
              <span className="inline-flex items-center space-x-0.5 bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded text-[9px]">
                <Check className="w-2.5 h-2.5" />
                <span>Dispatched</span>
              </span>
            </span>
            <button
              onClick={dismissEmailToast}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-100 truncate mt-0.5">
            {latestEmailToast.subject}
          </p>

          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            To: <span className="text-slate-200 font-medium">{latestEmailToast.recipientName}</span> ({latestEmailToast.recipientEmail})
          </p>
        </div>
      </div>
    </div>
  );
};
