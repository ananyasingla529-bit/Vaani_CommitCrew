import React, { useState } from 'react';
import type { FlaggedMessage, MessageStatus } from '../types';
import { 
  X, 
  Check, 
  Ban, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowUpRight, 
  User, 
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import { StatusBadge } from './StatusBadge';
import { PlatformIcon } from './PlatformIcon';

interface MessageReviewModalProps {
  message: FlaggedMessage | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: MessageStatus, actionName?: string) => Promise<void>;
}

export const MessageReviewModal: React.FC<MessageReviewModalProps> = ({
  message,
  onClose,
  onUpdateStatus,
}) => {
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!message) return null;

  const handleAction = async (status: MessageStatus, actionName: string) => {
    setIsSubmitting(true);
    try {
      await onUpdateStatus(message.id, status, actionName);
      setActionFeedback(`Action recorded: ${actionName}`);
      setTimeout(() => {
        setActionFeedback(null);
        onClose();
      }, 700);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-slate-900">Review Flagged Item</h2>
            <div className="px-2.5 py-1 rounded bg-white border border-slate-200 flex items-center gap-1.5 shadow-subtle text-xs font-semibold">
              <span className="text-slate-400 font-normal">Platform:</span>
              <PlatformIcon platform={message.platform} showLabel />
            </div>
            <StatusBadge status={message.status} />
            <span className="text-xs text-slate-400 font-mono">#{message.id}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
            title="Close review"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Modal Content - Scrollable */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Key Details Overview (Prominently displaying Platform, Sender, Harassed, and Threat) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Source Platform
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <PlatformIcon platform={message.platform} showLabel />
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {message.channel_name}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Sender
              </span>
              <span className="font-bold text-slate-900 truncate block mt-1">
                {message.sender_name}
              </span>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                ID: {message.sender_id}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Person Harassed
              </span>
              <span className="font-bold text-amber-900 truncate block mt-1">
                {message.target_user || 'Channel Members'}
              </span>
              <div className="text-[11px] text-amber-700 mt-0.5">
                Target User
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Detected Issue
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <SeverityBadge severity={message.severity} showIcon={false} />
                <span className="font-bold text-slate-800">{message.category}</span>
              </div>
            </div>
          </div>

          {/* Single Clean Message Box (No redundant duplicated normalized box) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold uppercase tracking-wide text-slate-700">Message</span>
              <span className="text-slate-400 tabular-nums">
                {new Date(message.timestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="p-4 bg-red-50/60 border border-red-200 rounded text-sm text-slate-900 font-medium leading-relaxed">
              "{message.text}"
            </div>
          </div>

          {/* Why this was flagged (Renamed from Model Classification Rationale) */}
          <div className="space-y-1.5">
            <span className="font-bold uppercase tracking-wide text-xs text-slate-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Why this was flagged</span>
            </span>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed font-normal">
              {message.explanation}
            </div>
          </div>

          {/* Conversation Context (Prior 3 messages) */}
          {message.context && message.context.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-bold uppercase tracking-wide text-xs text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                <span>Conversation Context (Before this message)</span>
              </span>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2 text-xs">
                {message.context.map((line, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                      -{message.context.length - idx}
                    </span>
                    <p className="text-slate-600 leading-relaxed font-normal bg-white p-2 rounded border border-slate-100 flex-1">
                      {line}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Select Moderator Decision:
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {/* Dismiss */}
            <button
              onClick={() => handleAction('dismissed', 'Dismiss')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-subtle disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5 text-slate-500" />
              <span>Dismiss</span>
            </button>

            {/* False Positive */}
            <button
              onClick={() => handleAction('dismissed', 'Marked False Positive')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-subtle disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>False Positive</span>
            </button>

            {/* Warn Sender */}
            <button
              onClick={() => handleAction('reviewed', 'Sender Warned')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors shadow-subtle disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Warn Sender</span>
            </button>

            {/* Escalate */}
            <button
              onClick={() => handleAction('escalated', 'Escalated to Safety Lead')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-4 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors shadow-subtle disabled:opacity-50"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-white" />
              <span>Escalate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
