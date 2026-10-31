import React from 'react';
import { MessageStatus, SourceStatus } from '../types';
import { CheckCircle2, Clock, XCircle, ArrowUpRight, AlertOctagon } from 'lucide-react';

interface StatusBadgeProps {
  status: MessageStatus | SourceStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'new':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F4F5EE] text-[#434428] border border-[#D8DABF] shadow-2xs">
          <Clock className="w-3 h-3 text-[#434428]" />
          <span>New</span>
        </span>
      );
    case 'reviewed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF9F6] text-[#292728] border border-[#D0C7B3] shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-[#434428]" />
          <span>Reviewed</span>
        </span>
      );
    case 'dismissed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FAF9F6] text-[#6B6860] border border-[#D0C7B3] line-through">
          <XCircle className="w-3 h-3 text-[#6B6860]" />
          <span>Dismissed</span>
        </span>
      );
    case 'escalated':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F0] text-[#B93829] border border-[#F5CAC4] shadow-2xs">
          <ArrowUpRight className="w-3.5 h-3.5 text-[#B93829]" />
          <span>Escalated</span>
        </span>
      );
    case 'connected':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F4F5EE] text-[#434428] border border-[#D8DABF] shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#434428] animate-pulse"></span>
          <span>Connected</span>
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FAF9F6] text-[#939474] border border-[#D0C7B3] shadow-2xs">
          <Clock className="w-3 h-3 text-[#939474]" />
          <span>Pending</span>
        </span>
      );
    case 'permission_missing':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F0] text-[#B93829] border border-[#F5CAC4] shadow-2xs">
          <AlertOctagon className="w-3 h-3 text-[#B93829]" />
          <span>Permission Missing</span>
        </span>
      );
  }
};
