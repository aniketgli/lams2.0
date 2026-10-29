import React from 'react';
import { WIILogo } from './WIILogo';

/** Full-page placeholder while the session is being checked. Prevents the login page flashing for signed-in users. */
export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Checking your session…' }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5" role="status" aria-live="polite">
    <WIILogo variant="horizontal" size="md" align="center" />
    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-brand animate-spin" aria-hidden="true" />
    <p className="text-xs font-medium text-slate-500">{label}</p>
  </div>
);
