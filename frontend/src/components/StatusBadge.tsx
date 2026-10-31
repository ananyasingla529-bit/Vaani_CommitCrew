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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Clock className="w-3 h-3 text-emerald-600" />
          <span>New</span>
        </span>
      );
    case 'reviewed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <CheckCircle2 className="w-3 h-3 text-slate-600" />
          <span>Reviewed</span>
        </span>
      );
    case 'dismissed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 line-through">
          <XCircle className="w-3 h-3 text-slate-400" />
          <span>Dismissed</span>
        </span>
      );
    case 'escalated':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <ArrowUpRight className="w-3 h-3 text-red-600" />
          <span>Escalated</span>
        </span>
      );
    case 'connected':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          <span>Connected</span>
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Pending</span>
        </span>
      );
    case 'permission_missing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <AlertOctagon className="w-3 h-3 text-rose-600" />
          <span>Permission Missing</span>
        </span>
      );
  }
};
