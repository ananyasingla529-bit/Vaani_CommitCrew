import React, { useState } from 'react';
import type { FlaggedMessage, MessageStatus } from '../types';
import {
  X,
  Check,
  Ban,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#292728]/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white border border-[#D0C7B3] rounded-2xl shadow-elevated w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Spacious */}
        <div className="px-8 py-5 border-b border-[#D0C7B3]/70 bg-[#FAF9F6] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 flex-wrap">
            <h2 className="text-lg font-bold text-[#292728]">Review Flagged Item</h2>
            <div className="px-3 py-1 rounded-xl bg-white border border-[#D0C7B3] flex items-center gap-1.5 shadow-2xs text-xs font-semibold text-[#292728]">
              <span className="text-[#6B6860] font-normal">Platform:</span>
              <PlatformIcon platform={message.platform} showLabel />
            </div>
            <StatusBadge status={message.status} />
            <span className="text-xs text-[#6B6860] font-mono font-medium">#{message.id}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#F1F1EC] text-[#6B6860] hover:text-[#292728] transition-colors cursor-pointer"
            title="Close review"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className="px-8 py-3 bg-[#F4F5EE] border-b border-[#D8DABF] text-xs font-bold text-[#434428] flex items-center gap-2">
            <Check className="w-4 h-4 text-[#434428]" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Modal Content - Spacious & Open Layout */}
        <div className="p-8 space-y-6 overflow-y-auto flex-1">
          {/* Key Details Overview (Roomy 4 columns with space) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 p-5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-2xl text-xs">
            <div className="space-y-1">
              <span className="text-[#6B6860] block text-[11px] uppercase font-bold tracking-wider">
                Source Platform
              </span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <PlatformIcon platform={message.platform} showLabel />
              </div>
              <div className="text-[11px] text-[#6B6860] pt-0.5 break-words">
                {message.channel_name}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[#6B6860] block text-[11px] uppercase font-bold tracking-wider">
                Sender
              </span>
              <span className="font-bold text-[#292728] text-sm block pt-0.5">
                {message.sender_name}
              </span>
              <div className="text-[11px] text-[#6B6860] font-mono">
                ID: {message.sender_id}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[#6B6860] block text-[11px] uppercase font-bold tracking-wider">
                Person Harassed
              </span>
              <span className="font-bold text-[#434428] text-sm block pt-0.5">
                {message.target_user || 'Channel Members'}
              </span>
              <div className="text-[11px] text-[#939474] font-medium">
                Targeted Individual
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[#6B6860] block text-[11px] uppercase font-bold tracking-wider">
                Detected Issue
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <SeverityBadge severity={message.severity} showIcon={false} />
                <span className="font-bold text-[#292728] text-sm">{message.category}</span>
              </div>
            </div>
          </div>

          {/* Single Clean Message Box - Expansive & Open */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#6B6860]">
              <span className="font-bold uppercase tracking-wider text-[#292728]">Flagged Message Content</span>
              <span className="text-[#6B6860] tabular-nums font-medium">
                {new Date(message.timestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="p-6 bg-[#FDF2F0] border border-[#F5CAC4] rounded-2xl text-base text-[#292728] font-medium leading-relaxed shadow-2xs">
              "{message.text}"
            </div>
          </div>

          {/* Why this was flagged */}
          <div className="space-y-2">
            <span className="font-bold uppercase tracking-wider text-xs text-[#292728] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#939474]" />
              <span>Why this was flagged</span>
            </span>
            <div className="p-5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-2xl text-sm text-[#292728] leading-relaxed">
              {message.explanation}
            </div>
          </div>

          {/* Conversation Context */}
          {message.context && message.context.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold uppercase tracking-wider text-xs text-[#292728] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#939474]" />
                <span>Conversation Context (Before this message)</span>
              </span>
              <div className="bg-[#FAF9F6] border border-[#D0C7B3] rounded-2xl p-5 space-y-3 text-xs">
                {message.context.map((line, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="text-[11px] font-mono text-[#939474] font-bold shrink-0 mt-1">
                      -{message.context.length - idx}
                    </span>
                    <p className="text-[#292728] text-sm leading-relaxed font-normal bg-white p-3.5 rounded-xl border border-[#D0C7B3]/60 flex-1 shadow-2xs">
                      {line}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer - Spacious & Airy */}
        <div className="px-8 py-5.5 border-t border-[#D0C7B3]/70 bg-[#FAF9F6] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <span className="text-xs font-bold text-[#292728] uppercase tracking-wider">
            Select Moderator Decision:
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {/* Dismiss */}
            <button
              onClick={() => handleAction('dismissed', 'Dismiss')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#D0C7B3] bg-white hover:bg-[#F1F1EC] text-[#292728] text-xs sm:text-sm font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Ban className="w-4 h-4 text-[#6B6860]" />
              <span>Dismiss</span>
            </button>

            {/* False Positive */}
            <button
              onClick={() => handleAction('dismissed', 'Marked False Positive')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#D8DABF] bg-[#F4F5EE] hover:bg-[#EAECE3] text-[#434428] text-xs sm:text-sm font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#434428]" />
              <span>False Positive</span>
            </button>

            {/* Warn Sender */}
            <button
              onClick={() => handleAction('reviewed', 'Sender Warned')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#D0C7B3] bg-white hover:bg-[#FAF9F6] text-[#434428] text-xs sm:text-sm font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-[#939474]" />
              <span>Warn Sender</span>
            </button>

            {/* Escalate */}
            <button
              onClick={() => handleAction('escalated', 'Escalated to Safety Lead')}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#B93829] hover:bg-[#9E2E20] text-[#F1F1EC] text-xs sm:text-sm font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-white" />
              <span>Escalate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
