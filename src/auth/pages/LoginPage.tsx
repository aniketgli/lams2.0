import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { WIILogo } from '../../shared/components/WIILogo';
import { formatOrgAddress } from '../../types';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  MapPin
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginAsUser, users, orgBranding, setIsLogoViewerOpen } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pre-configured dummy accounts for testing
  const dummyAccounts = [
    {
      id: 'usr-1',
      name: 'Dr. Rajesh Sharma',
      email: 'rajesh.sharma@inst.org',
      role: 'Administrator',
      roleBadge: 'bg-purple-100 text-purple-800 border-purple-200',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'usr-2',
      name: 'Anita Roy',
      email: 'anita.roy@inst.org',
      role: 'Reporting Manager',
      roleBadge: 'bg-blue-50 text-blue-800 border-blue-200',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'usr-3',
      name: 'Vikram Singh',
      email: 'vikram.singh@inst.org',
      role: 'HoD',
      roleBadge: 'bg-amber-50 text-amber-800 border-amber-200',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'usr-4',
      name: 'Priya Verma',
      email: 'priya.verma@inst.org',
      role: 'General Staff',
      roleBadge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs mb-3 flex items-center justify-center pointer-events-none w-full">
            <WIILogo variant="horizontal" size="md" align="center" />
          </div>
          <div className="inline-flex items-center space-x-2 bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-bold shadow-xs">
            <span>{orgBranding?.appName || 'Leave & Attendance Management System'}</span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-2">
            {orgBranding?.orgName || 'Wildlife Institute of India'} Official Employee Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-sm font-bold text-slate-900">Sign In to Your Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your official institute credentials to access attendance, leaves &amp; approvals.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Institute Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rajesh.sharma@inst.org"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </button>
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
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {dummyAccounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => handleQuickLogin(acc.id)}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 text-left transition-all hover:border-blue-300 hover:shadow-xs flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={acc.avatar}
                    alt={acc.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                        {acc.name}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${acc.roleBadge}`}>
                        {acc.role}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono truncate block">
                      {acc.email}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center space-x-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
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
            <MapPin className="w-3 h-3 text-[#701618] shrink-0" />
            <span>{formatOrgAddress(orgBranding)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
