import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { WIILogo } from '../../shared/components/WIILogo';
import { Button, Input, Alert, Badge } from '../../shared/components';
import { formatOrgAddress } from '../../types';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  KeyRound,
  MapPin
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginAsUser, orgBranding } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleQuickLogin = (userId: string) => {
    loginAsUser(userId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }
    const res = login(email, password);
    if (!res.success) {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center select-none">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs mb-3 flex items-center justify-center pointer-events-none w-full">
            <WIILogo variant="horizontal" size="md" align="center" />
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-100 pb-3.5">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Sign In
            </h2>
            
          </div>

          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Institute Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. user@organization.org"
              leftIcon={Mail}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={Lock}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Forgot Password Link */}
          <div className="text-center text-xs text-slate-500 pt-2">
            <span className="font-bold text-slate-700">Forgot Password?</span> Contact your Administrator.
          </div>
        </div>

        <div className="pt-2 text-[11px] text-center text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">
            {orgBranding?.copyrightText || `© ${new Date().getFullYear()} ${orgBranding?.orgName || 'Organization'} • Integrated Enterprise Suite`}
          </p>
          <div className="flex items-center justify-center space-x-1 text-slate-500 text-[10.5px]">
            <MapPin className="w-3 h-3 text-[#2563eb] shrink-0" />
            <span>{formatOrgAddress(orgBranding) || 'Office Location'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
