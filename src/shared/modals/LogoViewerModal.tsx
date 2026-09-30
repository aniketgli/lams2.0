import React from 'react';
import { useApp } from '../../context/AppContext';
import { WIILogo } from '../components/WIILogo';
import { formatOrgAddress } from '../../types';
import {
  X,
  Download,
  Copy,
  Settings,
  ShieldCheck,
  Building2,
  Sparkles,
  Check,
  Calendar,
  User,
  Image as ImageIcon,
  MapPin,
  Phone,
  Mail,
  Globe
} from 'lucide-react';

interface LogoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMasterBranding?: () => void;
}

export const LogoViewerModal: React.FC<LogoViewerModalProps> = ({
  isOpen,
  onClose,
  onOpenMasterBranding
}) => {
  const { orgBranding, currentUser } = useApp();
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyDetails = () => {
    const details = `Organization: ${orgBranding.orgName}\nHindi Name: ${orgBranding.orgHindiName}\nSystem Name: ${orgBranding.appName}\nAddress: ${formatOrgAddress(orgBranding)}\nPhone: ${orgBranding.phone || 'N/A'}\nEmail: ${orgBranding.email || 'N/A'}\nWebsite: ${orgBranding.website || 'N/A'}\nCopyright: ${orgBranding.copyrightText || 'N/A'}`;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (orgBranding.logoUrl) {
      const a = document.createElement('a');
      a.href = orgBranding.logoUrl;
      a.download = `${(orgBranding.orgName || 'Organization').replace(/[^a-zA-Z0-9]/g, '_')}_Logo.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Organization Logo &amp; Brand Viewer</h3>
              <p className="text-[10px] text-slate-300 font-medium">Official Identity Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Logo Spotlight Showcase Card (Wide Horizontal Aspect Ratio ~3.3:1) */}
          <div className="bg-gradient-to-b from-amber-50/90 via-amber-50/40 to-white border border-amber-200/90 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-xs relative overflow-hidden group">
            <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-amber-100/90 border border-amber-300/80 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-[#701618] uppercase">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>{orgBranding.badgeText || 'HUB'}</span>
            </div>

            <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-2">
              Official Organization Logo
            </div>

            {/* Wide Horizontal Logo Display Canvas Box */}
            <div className="w-full max-w-md h-28 sm:h-32 rounded-xl bg-white border-2 border-amber-200/90 shadow-xs flex items-center justify-center p-4 mb-3 group-hover:scale-[1.02] transition-transform duration-300 overflow-hidden relative">
              {orgBranding.logoUrl ? (
                <img
                  src={orgBranding.logoUrl}
                  alt={orgBranding.orgName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <WIILogo variant="horizontal" size="lg" />
              )}
            </div>

            {/* Dynamic Titles */}
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              {orgBranding.orgName}
            </h2>
          </div>

          {/* RBAC Notice / Master Control Bar */}
          {currentUser?.role === 'administrator' ? (
            <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold">Admin Master Access Granted</span>
              </div>
              <span className="text-[10.5px] font-medium text-blue-700">You can update the logo in Master Settings</span>
            </div>
          ) : (
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center space-x-2 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-medium text-[11px]">
                <strong>View Only Mode:</strong> Only System Administrators can update the official logo in Master Settings.
              </span>
            </div>
          )}

          {/* Details Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Organization</span>
              </span>
              <span className="font-bold text-slate-900 text-right">{orgBranding.orgName}</span>
            </div>

            <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>System Title</span>
              </span>
              <span className="font-extrabold text-slate-900">{orgBranding.appName}</span>
            </div>

            <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Logo Status</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {orgBranding.logoType === 'custom' ? 'Custom Uploaded Logo' : 'Official Vector Mascot'}
              </span>
            </div>

            <div className="flex items-start justify-between text-xs border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5 shrink-0 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#701618]" />
                <span>Address</span>
              </span>
              <span className="font-semibold text-slate-800 text-right text-[11px] max-w-xs">
                {formatOrgAddress(orgBranding)}
              </span>
            </div>

            {(orgBranding.phone || orgBranding.email) && (
              <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contact</span>
                </span>
                <span className="font-semibold text-slate-700 text-right text-[11px]">
                  {[orgBranding.phone, orgBranding.email].filter(Boolean).join(' • ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Updated</span>
              </span>
              <span className="font-semibold text-slate-700">
                {orgBranding.updatedAt ? new Date(orgBranding.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Default System'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Updated By</span>
              </span>
              <span className="font-semibold text-slate-700">{orgBranding.updatedBy || 'System Administrator'}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download Logo</span>
            </button>

            <button
              onClick={handleCopyDetails}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied!' : 'Copy Info'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {currentUser?.role === 'administrator' && onOpenMasterBranding && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMasterBranding();
                }}
                className="px-3.5 py-1.5 bg-[#701618] hover:bg-[#561012] text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-amber-300" />
                <span>Manage in Organization Master</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
