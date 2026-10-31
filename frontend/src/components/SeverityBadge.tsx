import React from 'react';
import { Severity } from '../types';
import { AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SeverityBadgeProps {
  severity: Severity;
  showIcon?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, showIcon = true }) => {
  switch (severity) {
    case 'high':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          {showIcon && <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />}
          <span>High</span>
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          {showIcon && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
          <span>Medium</span>
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          {showIcon && <ShieldCheck className="w-3 h-3 text-slate-500 shrink-0" />}
          <span>Low</span>
        </span>
      );
  }
};
