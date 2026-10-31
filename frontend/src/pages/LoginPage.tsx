import React, { useState } from 'react';
import { Shield, ArrowRight, Lock, Mail, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('moderator@vaani.org');
  const [password, setPassword] = useState('moderator123');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(email);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#F6F8F6] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Institutional Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-[#14532D] text-emerald-300 shadow-card mb-4 border border-emerald-600">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vaani Moderation Console</h1>
          <p className="text-sm text-slate-600 mt-1.5">
            Cross-platform toxic speech & cyber-bullying moderation for Telegram, Discord, and YouTube
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-7">
          <div className="mb-5 pb-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Moderator Authentication
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Institutional SSO / Local
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  placeholder="name@institution.org"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-slate-400">Mock Auth Active</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-[#14532D] hover:bg-[#166534] text-white text-sm font-medium transition-colors shadow-subtle disabled:opacity-70"
              >
                <span>{isLoading ? 'Authenticating...' : 'Sign In to Moderation Console'}</span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* Preset Demo Credentials Notice */}
          <div className="mt-5 p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-medium text-slate-700">Demo Credentials (Prefilled):</div>
            <div className="font-mono text-[11px] text-slate-500">Email: moderator@vaani.org</div>
            <div className="font-mono text-[11px] text-slate-500">Password: moderator123</div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Access restricted to authorized community safety leads.
        </p>
      </div>
    </div>
  );
};
