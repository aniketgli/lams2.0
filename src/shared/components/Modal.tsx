import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

const renderModalIcon = (iconItem: any, className = 'w-5 h-5 text-blue-600') => {
  if (!iconItem) return null;
  if (React.isValidElement(iconItem)) return iconItem;
  if (
    typeof iconItem === 'function' ||
    (typeof iconItem === 'object' && iconItem !== null && ('$$typeof' in iconItem || 'render' in iconItem))
  ) {
    const Component = iconItem;
    return <Component className={className} />;
  }
  return null;
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  children,
  footer,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  className = ''
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    full: 'max-w-[95vw]'
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in-95 duration-150 ${sizeClasses[size]} ${className}`}
      >
        {/* Header if props provided */}
        {title && (
          <div className="relative overflow-hidden px-5 py-4 border-b border-blue-900/60 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] rounded-t-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center space-x-3 min-w-0 pr-3">
              {icon && (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 text-blue-200 flex items-center justify-center shrink-0 shadow-sm">
                  {renderModalIcon(icon, 'w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200')}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white tracking-tight truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-blue-200/80 mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        {title || footer ? (
          <>
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-700 text-xs sm:text-sm">
              {children}
            </div>
            {footer && (
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
                {footer}
              </div>
            )}
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

/* -------------------------------------------------------------------------- */
/* Compound Modal Components                                                  */
/* -------------------------------------------------------------------------- */

export interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: any;
  onClose?: () => void;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  icon,
  onClose,
  className = ''
}) => {
  return (
    <div className={`relative overflow-hidden px-5 py-4 border-b border-blue-900/60 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#091224] via-[#0f214a] to-[#1a3675] rounded-t-2xl ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 flex items-center space-x-3 min-w-0 pr-3">
        {icon && (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#183063] to-[#0c1938] border border-blue-700/60 text-blue-200 flex items-center justify-center shrink-0 shadow-sm">
            {renderModalIcon(icon, 'w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-200')}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white tracking-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-blue-200/80 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="relative z-10 p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '' }) => (
  <div className={`p-5 overflow-y-auto space-y-4 flex-1 text-slate-700 text-xs sm:text-sm ${className}`}>
    {children}
  </div>
);

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => (
  <div className={`px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0 ${className}`}>
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Confirm Dialog                                                             */
/* -------------------------------------------------------------------------- */

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}) => {
  const icon =
    variant === 'danger' ? (
      <AlertTriangle className="w-5 h-5 text-rose-300" />
    ) : variant === 'warning' ? (
      <AlertTriangle className="w-5 h-5 text-amber-300" />
    ) : (
      <HelpCircle className="w-5 h-5 text-blue-200" />
    );

  const confirmButtonVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={confirmButtonVariant}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-xs text-slate-600 leading-relaxed py-1">
        {message}
      </div>
    </Modal>
  );
};

/* -------------------------------------------------------------------------- */
/* Alert Dialog                                                               */
/* -------------------------------------------------------------------------- */

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  type?: 'success' | 'info' | 'error';
  buttonText?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  buttonText = 'Understood'
}) => {
  const icon =
    type === 'success' ? (
      <CheckCircle className="w-5 h-5 text-emerald-300" />
    ) : type === 'error' ? (
      <AlertTriangle className="w-5 h-5 text-rose-300" />
    ) : (
      <Info className="w-5 h-5 text-blue-200" />
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      size="sm"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          {buttonText}
        </Button>
      }
    >
      <div className="text-xs text-slate-600 leading-relaxed py-1">
        {message}
      </div>
    </Modal>
  );
};
