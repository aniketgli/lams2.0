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

  // Pre-configured accounts for testing
  const dummyAccounts = [
    {
      id: 'usr-1',
      name: 'System Admin',
      email: 'admin@inst.org',
      role: 'Administrator',
      badgeVariant: 'neutral' as const,
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'usr-2',
      name: 'Anita Roy',
      email: 'anita.roy@inst.org',
      role: 'Reporting Manager',
      badgeVariant: 'info' as const,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'usr-3',
      name: 'Vikram Singh',
      email: 'vikram.singh@inst.org',
      role: 'HoD',
      badgeVariant: 'warning' as const,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'usr-4',
      name: 'Priya Verma',
      email: 'priya.verma@inst.org',
      role: 'user',
      badgeVariant: 'success' as const,
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200'
    }
  ];

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

  const handleQuickLogin = (userId: string) => {
    loginAsUser(userId);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center select-none">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs mb-3 flex items-center justify-center pointer-events-none w-full">
            <WIILogo variant="horizontal" size="md" align="center" />
          </div>
          <div className="inline-flex items-center space-x-2 bg-slate-900 text-white px-3.5 py-1 rounded-xl text-xs font-bold shadow-xs">
            <span>{orgBranding?.appName || 'Leave & Attendance Management System'}</span>
          </div>
          
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-100 pb-3.5">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Sign In to Your Account
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
              placeholder="e.g. rajesh.sharma@inst.org"
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

          {/* Registration Restricted Notice */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
            <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <span className="font-bold">Registration Note:</span> Self-registration is disabled. Account provisioning &amp; role allocation are strictly performed by System Administrators.
            </p>
          </div>
        </div>

        {/* Dummy Demo Accounts (Instant Test Login) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            <span>Select Demo Account to Test:</span>
            <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {dummyAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleQuickLogin(acc.id)}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-left transition-all hover:border-[#bfdbfe] hover:shadow-xs flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={acc.avatar}
                    alt={acc.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 truncate group-hover:text-[#2563eb] transition-colors">
                        {acc.name}
                      </span>
                      <Badge variant={acc.badgeVariant} size="sm">
                        {acc.role}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono truncate block">
                      {acc.email}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center space-x-1 text-[11px] font-bold text-[#2563eb] bg-[#eff6ff] px-2.5 py-1 rounded-lg border border-[#bfdbfe] group-hover:bg-[#2563eb] group-hover:text-white transition-all shrink-0">
                  <span>Login</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 text-[11px] text-center text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">
            {orgBranding?.copyrightText || `© ${new Date().getFullYear()} ${orgBranding?.orgName || 'Wildlife Institute of India'} • Integrated Enterprise Suite`}
          </p>
          <div className="flex items-center justify-center space-x-1 text-slate-500 text-[10.5px]">
            <MapPin className="w-3 h-3 text-[#2563eb] shrink-0" />
            <span>{formatOrgAddress(orgBranding)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
