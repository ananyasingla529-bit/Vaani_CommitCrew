import React, { useState } from 'react';
import { Shield, ArrowRight, Lock, Mail, CheckCircle2, X } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isModal = false, onClose }) => {
  const [email, setEmail] = useState('moderator@vaani.org');
  const [password, setPassword] = useState('moderator123');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(email);
    }, 300);
  };

  const handleQuickDemoLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin('moderator@vaani.org');
    }, 200);
  };

  const content = (
    <div className="w-full max-w-md">
      {/* Institutional Branding */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#434428] text-[#F1F1EC] shadow-card mb-3.5 border border-[#939474]/40">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-[#292728] tracking-tight">Vaani Moderation Console</h1>
        <p className="text-xs sm:text-sm text-[#434428]/80 mt-1 max-w-sm mx-auto">
          Authorized monitoring and cyber-bullying mitigation across Telegram, Discord, and YouTube
        </p>
      </div>

      {/* Card */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl shadow-elevated p-7 sm:p-8 relative">
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-[#6B6860] hover:text-[#292728] hover:bg-[#F1F1EC] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="mb-5 pb-4 border-b border-[#D0C7B3]/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#292728] uppercase tracking-wider">
            Moderator Authentication
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#434428] bg-[#939474]/15 px-2.5 py-0.5 rounded-full border border-[#939474]/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#434428]" />
            Active SSO Session
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#292728] mb-1.5">
              Staff Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#939474] absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] placeholder-[#939474]/70 focus:outline-none focus:border-[#434428] focus:bg-white focus:ring-1 focus:ring-[#434428] transition-all"
                placeholder="moderator@vaani.org"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#292728]">
                Security Passcode
              </label>
              <span className="text-[11px] text-[#939474] font-mono">Mock Auth Active</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#939474] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] placeholder-[#939474]/70 focus:outline-none focus:border-[#434428] focus:bg-white focus:ring-1 focus:ring-[#434428] transition-all"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#434428] hover:bg-[#292728] text-[#F1F1EC] text-sm font-medium transition-colors shadow-2xs disabled:opacity-60 cursor-pointer"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleQuickDemoLogin}
              disabled={isLoading}
              className="w-full py-2 px-3 rounded-xl border border-[#D0C7B3] bg-white hover:bg-[#F1F1EC] text-[#434428] text-xs font-medium transition-colors cursor-pointer"
            >
              Instant Demo Access (moderator@vaani.org)
            </button>
          </div>
        </form>

        {/* Demo Credentials */}
        <div className="mt-5 p-3 rounded-xl bg-[#F1F1EC] border border-[#D0C7B3]/80 text-xs text-[#292728]">
          <div className="font-semibold text-[#434428] mb-1">Preloaded Demo Credentials:</div>
          <div className="flex items-center justify-between text-[11px] font-mono text-[#6B6860]">
            <span>Email: moderator@vaani.org</span>
            <span>Password: moderator123</span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[#6B6860] mt-5">
        Session managed under institutional safety governance protocol.
      </p>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292728]/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F1EC] flex flex-col justify-center items-center px-4 py-12">
      {content}
    </div>
  );
};
