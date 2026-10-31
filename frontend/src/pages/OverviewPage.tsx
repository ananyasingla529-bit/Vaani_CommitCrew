import React, { useMemo } from 'react';
import type {
  OverviewStats,
  FlaggedMessage
} from '../types';
import {
  MessageSquare,
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  User,
  CheckCircle2
} from 'lucide-react';
import { PlatformIcon } from '../components/PlatformIcon';
import { StatusBadge } from '../components/StatusBadge';

interface OverviewPageProps {
  stats: OverviewStats;
  recentUrgentMessages: FlaggedMessage[];
  onNavigateToFeed: (filterSeverity?: string) => void;
  onSelectMessage: (msg: FlaggedMessage) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  stats,
  recentUrgentMessages,
  onNavigateToFeed,
  onSelectMessage,
}) => {
  // Pile up reviewed incidents at the end (unreviewed 'new' items first)
  const { unreviewedMessages, reviewedMessages } = useMemo(() => {
    const unreviewed = recentUrgentMessages.filter((m) => m.status === 'new');
    const reviewed = recentUrgentMessages.filter((m) => m.status !== 'new');
    return { unreviewedMessages: unreviewed, reviewedMessages: reviewed };
  }, [recentUrgentMessages]);

  const displayList = [...unreviewedMessages, ...reviewedMessages];

  return (
    <div className="space-y-8">
      {/* Stat Cards Grid with User's Exact Palette */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Messages Scanned */}
        <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle hover:border-[#939474] transition-all">
          <div className="flex items-center justify-between text-[#6B6860] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B6860]">Messages Scanned</span>
            <div className="w-9 h-9 rounded-xl bg-[#F1F1EC] border border-[#D0C7B3] flex items-center justify-center text-[#434428]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#292728] tabular-nums">
            {stats.messages_scanned.toLocaleString()}
          </div>
          <div className="text-xs text-[#6B6860] mt-2 flex items-center gap-1.5">
            <span className="text-[#434428] font-bold">+1,240</span>
            <span>across 6 connected channels today</span>
          </div>
        </div>

        {/* Messages Flagged */}
        <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle hover:border-[#939474] transition-all">
          <div className="flex items-center justify-between text-[#6B6860] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B6860]">Messages Flagged</span>
            <div className="w-9 h-9 rounded-xl bg-[#F4F5EE] border border-[#D8DABF] flex items-center justify-center text-[#939474]">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#292728] tabular-nums">
            {stats.messages_flagged}
          </div>
          <div className="text-xs text-[#6B6860] mt-2 flex items-center gap-1.5">
            <span className="text-[#434428] font-bold">0.24%</span>
            <span>overall flag rate</span>
          </div>
        </div>

        {/* High Severity Open */}
        <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle hover:border-[#939474] transition-all">
          <div className="flex items-center justify-between text-[#6B6860] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B6860]">High-Severity Open</span>
            <div className="w-9 h-9 rounded-xl bg-[#FDF2F0] border border-[#F5CAC4] flex items-center justify-center text-[#B93829]">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#B93829] tabular-nums">
            {stats.high_severity_open}
          </div>
          <div className="text-xs text-[#6B6860] mt-2 flex items-center gap-1.5">
            <span className="text-[#B93829] font-bold">Immediate Action</span>
            <span>requires moderator review</span>
          </div>
        </div>

        {/* Average Review Time */}
        <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle hover:border-[#939474] transition-all">
          <div className="flex items-center justify-between text-[#6B6860] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B6860]">Avg Review Time</span>
            <div className="w-9 h-9 rounded-xl bg-[#F1F1EC] border border-[#D0C7B3] flex items-center justify-center text-[#434428]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#292728] tabular-nums">
            {stats.avg_review_time_mins} <span className="text-sm font-normal text-[#6B6860]">mins</span>
          </div>
          <div className="text-xs text-[#6B6860] mt-2 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-[#434428]" />
            <span>Well within 15 min SLA</span>
          </div>
        </div>
      </div>

      {/* Urgent Incidents to Review - Clean Layout As Before with Dominant Heading */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl shadow-subtle overflow-hidden">
        {/* Card Header with Prominent Larger Heading */}
        <div className="px-8 py-6 border-b border-[#D0C7B3]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF9F6]">
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#292728] tracking-tight flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-[#B93829]" />
              <span>Urgent Incidents to Review</span>
              {unreviewedMessages.length > 0 && (
                <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-[#FDF2F0] text-[#B93829] border border-[#F5CAC4]">
                  {unreviewedMessages.length} Pending
                </span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6860]">
              Select an item to view full threat details, conversation context, and take action
            </p>
          </div>
          <button
            onClick={() => onNavigateToFeed('high')}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#434428] hover:text-[#292728] transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>View all in flagged feed</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Context under Heading (Restored format: Sender • Harassed • Platform and unboxed text) */}
        <div className="divide-y divide-[#D0C7B3]/40">
          {displayList.slice(0, 10).map((msg, idx) => {
            const isFirstReviewed = idx === unreviewedMessages.length && reviewedMessages.length > 0;
            const isReviewed = msg.status !== 'new';

            return (
              <React.Fragment key={msg.id}>
                {/* Visual section divider for reviewed items piled up at the end */}
                {isFirstReviewed && (
                  <div className="px-8 py-3 bg-[#FAF9F6]/90 border-y border-[#D0C7B3]/60 flex items-center justify-between text-xs text-[#6B6860]">
                    <span className="font-bold uppercase tracking-wider text-[#434428] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#434428]" />
                      <span>Reviewed & Actioned Incidents ({reviewedMessages.length})</span>
                    </span>
                    <span className="text-[11px] text-[#6B6860]">Piled at the end</span>
                  </div>
                )}

                <div
                  onClick={() => onSelectMessage(msg)}
                  className={`p-6 sm:p-7 hover:bg-[#FAF9F6] cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${
                    isReviewed ? 'opacity-70 bg-[#FAF9F6]/30' : 'bg-white'
                  }`}
                >
                  {/* Clean context as before: Sender • Harassed • Platform directly followed by message */}
                  <div className="space-y-2 flex-1 pr-4">
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      <span className="font-semibold text-[#292728]">
                        Sender: <span className="font-bold text-[#292728]">{msg.sender_name}</span>
                      </span>
                      <span className="text-[#D0C7B3]">•</span>
                      <span className="font-medium text-[#434428] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#939474]" />
                        <span>Harassed:</span>
                        <strong className="font-bold text-[#292728]">{msg.target_user || 'Channel Members'}</strong>
                      </span>
                      <span className="text-[#D0C7B3]">•</span>
                      <span className="font-medium text-[#292728] flex items-center gap-1.5">
                        <span className="text-[#6B6860] font-semibold">Platform:</span>
                        <PlatformIcon platform={msg.platform} showLabel />
                      </span>
                      {isReviewed && (
                        <>
                          <span className="text-[#D0C7B3]">•</span>
                          <StatusBadge status={msg.status} />
                        </>
                      )}
                    </div>

                    <p className="text-sm text-[#292728] font-normal leading-relaxed">
                      "{msg.text}"
                    </p>
                  </div>

                  {/* Review Action Button */}
                  <div className="shrink-0 self-start sm:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMessage(msg);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer ${
                        isReviewed
                          ? 'border border-[#D0C7B3] bg-white hover:bg-[#F1F1EC] text-[#434428]'
                          : 'bg-[#434428] hover:bg-[#292728] text-[#F1F1EC]'
                      }`}
                    >
                      <span>{isReviewed ? 'View' : 'Review item'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
