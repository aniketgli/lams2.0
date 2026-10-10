import React from 'react';
import { useApp } from '../../context/AppContext';
import { WIILogo } from '../components/WIILogo';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge
} from '../components';
import { formatOrgAddress } from '../../types';
import {
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
  Phone
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
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader
        title="Organization Logo & Brand Details"
        subtitle="Official institutional identity assets and headquarters records"
        icon={ImageIcon}
        onClose={onClose}
      />

      <ModalBody className="space-y-5">
        {/* Logo Spotlight Showcase Card */}
        <div className="bg-gradient-to-b from-amber-50/70 via-amber-50/20 to-white border border-amber-200/90 rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-2xs relative">
          <div className="absolute top-3 right-3 flex items-center space-x-1.5">
            <Badge variant="primary" size="sm">
              <Sparkles className="w-3 h-3 text-[#2563eb] mr-1" />
              {orgBranding.badgeText || 'HUB'}
            </Badge>
          </div>

          <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-2">
            Official Organization Logo
          </div>

          {/* Logo Container */}
          <div className="w-full max-w-sm h-28 rounded-xl bg-white border border-amber-200/80 shadow-2xs flex items-center justify-center p-3 mb-2 overflow-hidden">
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

          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            {orgBranding.orgName}
          </h2>
        </div>

        {/* RBAC Notice */}
        {currentUser?.role === 'administrator' ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-bold">Admin Master Access Granted</span>
            </div>
            <span className="text-[11px] font-medium text-blue-700">Editable via Master Settings</span>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-2 text-xs text-slate-700">
            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="font-medium text-[11px]">
              <strong>View Only:</strong> Only System Administrators can configure official logos in Master Settings.
            </span>
          </div>
        )}

        {/* Details Table */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-slate-500 font-medium flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Organization</span>
            </span>
            <span className="font-bold text-slate-900 text-right">{orgBranding.orgName}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-slate-500 font-medium flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>System Title</span>
            </span>
            <span className="font-bold text-slate-900">{orgBranding.appName}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-slate-500 font-medium flex items-center space-x-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Logo Type</span>
            </span>
            <Badge variant="info" size="sm">
              {orgBranding.logoType === 'custom' ? 'Custom Uploaded' : 'Vector Brand Mascot'}
            </Badge>
          </div>

          <div className="flex items-start justify-between border-b border-slate-200/80 pb-2">
            <span className="text-slate-500 font-medium flex items-center space-x-1.5 shrink-0 pt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>Address</span>
            </span>
            <span className="font-medium text-slate-800 text-right text-[11px] max-w-xs">
              {formatOrgAddress(orgBranding)}
            </span>
          </div>

          {(orgBranding.phone || orgBranding.email) && (
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Contact</span>
              </span>
              <span className="font-medium text-slate-700 text-right text-[11px]">
                {[orgBranding.phone, orgBranding.email].filter(Boolean).join(' • ')}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-slate-500 font-medium flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Updated</span>
            </span>
            <span className="font-medium text-slate-700">
              {orgBranding.updatedAt ? new Date(orgBranding.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'System Default'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Updated By</span>
            </span>
            <span className="font-medium text-slate-700">{orgBranding.updatedBy || 'System Administrator'}</span>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="xs"
              onClick={handleDownload}
              leftIcon={<Download className="w-3 h-3 text-slate-500" />}
            >
              Download Logo
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={handleCopyDetails}
              leftIcon={copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
            >
              {copied ? 'Copied!' : 'Copy Info'}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {currentUser?.role === 'administrator' && onOpenMasterBranding && (
              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  onClose();
                  onOpenMasterBranding();
                }}
                leftIcon={<Settings className="w-3 h-3" />}
              >
                Manage in Master
              </Button>
            )}
            <Button
              variant="secondary"
              size="xs"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
};
