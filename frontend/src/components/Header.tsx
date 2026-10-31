import React from 'react';
import { ShieldAlert, CheckCircle, RefreshCw, GitBranch } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  urgentCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  activeBranch?: string;
  // Kept for backward compatibility if passed
  userEmail?: string;
  userRole?: string;
  isAuthenticated?: boolean;
  onLogout?: () => void;
  onSignInClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  urgentCount = 0,
  onRefresh,
  isRefreshing = false,
  activeBranch = 'main',
}) => {
  return (
    <header className="h-18 border-b border-[#D0C7B3]/70 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div>
        <h1 className="text-2xl font-extrabold text-[#292728] tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-[#434428]/80 font-normal mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Active Branch Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#D0C7B3] bg-[#F1F1EC] text-[#434428] text-xs font-mono font-medium shadow-2xs">
          <GitBranch className="w-3.5 h-3.5 text-[#939474]" />
          <span>{activeBranch}</span>
        </div>

        {/* Mock Mode Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#939474]/40 bg-[#939474]/15 text-[#434428] text-xs font-medium shadow-2xs">
          <CheckCircle className="w-3.5 h-3.5 text-[#434428]" />
          <span>MOCK_MODE: ON</span>
        </div>

        {/* High severity indicator */}
        {urgentCount > 0 && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#F5CAC4] bg-[#FDF2F0] text-[#B93829] text-xs font-semibold tabular-nums shadow-2xs">
            <ShieldAlert className="w-3.5 h-3.5 text-[#B93829]" />
            <span>{urgentCount} High-Severity Open</span>
          </div>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-[#D0C7B3] bg-white hover:bg-[#F1F1EC] text-[#434428] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#434428]' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
