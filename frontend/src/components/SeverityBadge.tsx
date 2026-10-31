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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F0] text-[#B93829] border border-[#F5CAC4] shadow-2xs">
          {showIcon && <AlertCircle className="w-3 h-3 text-[#B93829] shrink-0" />}
          <span>High</span>
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F4F5EE] text-[#434428] border border-[#D8DABF] shadow-2xs">
          {showIcon && <AlertTriangle className="w-3 h-3 text-[#939474] shrink-0" />}
          <span>Medium</span>
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F1F1EC] text-[#6B6860] border border-[#D0C7B3] shadow-2xs">
          {showIcon && <ShieldCheck className="w-3 h-3 text-[#6B6860] shrink-0" />}
          <span>Low</span>
        </span>
      );
  }
};
