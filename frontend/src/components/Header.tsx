import React from 'react';
import { ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  urgentCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  urgentCount = 0,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-xs px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-normal">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Mock Mode Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-medium">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>MOCK_MODE: ON</span>
        </div>

        {/* High severity indicator */}
        {urgentCount > 0 && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-semibold tabular-nums">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            <span>{urgentCount} High-Severity Open</span>
          </div>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
