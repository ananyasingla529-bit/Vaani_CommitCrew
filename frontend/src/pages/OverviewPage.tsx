import React from 'react';
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
  User
} from 'lucide-react';
import { PlatformIcon } from '../components/PlatformIcon';

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
  return (
    <div className="space-y-6">
      {/* Stat Cards Grid (Graphs removed as requested) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Messages Scanned */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Messages Scanned</span>
            <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {stats.messages_scanned.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-700 font-semibold">+1,240</span>
            <span>across 6 connected channels today</span>
          </div>
        </div>

        {/* Messages Flagged */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Messages Flagged</span>
            <div className="w-8 h-8 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {stats.messages_flagged}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-amber-800 font-semibold">0.24%</span>
            <span>overall flag rate</span>
          </div>
        </div>

        {/* High Severity Open */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">High-Severity Open</span>
            <div className="w-8 h-8 rounded bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 tabular-nums">
            {stats.high_severity_open}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-red-600 font-semibold">Immediate Action</span>
            <span>requires moderator review</span>
          </div>
        </div>

        {/* Average Review Time */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Review Time</span>
            <div className="w-8 h-8 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {stats.avg_review_time_mins} <span className="text-sm font-normal text-slate-500">mins</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Well within 15 min SLA</span>
          </div>
        </div>
      </div>

      {/* Urgent Open Incidents Requiring Moderator Action */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Urgent Incidents to Review</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an item to view full threat details, conversation context, and take action
            </p>
          </div>
          <button
            onClick={() => onNavigateToFeed('high')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors"
          >
            <span>View all in flagged feed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Clean Simplified List: Only Sender, Harassed Person, Message, and Review Action */}
        <div className="divide-y divide-slate-100">
          {recentUrgentMessages.slice(0, 8).map((msg) => (
            <div
              key={msg.id}
              onClick={() => onSelectMessage(msg)}
              className="p-5 hover:bg-slate-50/90 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              {/* Sender, Harassed Target & Message */}
              <div className="space-y-1.5 flex-1 pr-4">
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="font-semibold text-slate-900">
                    Sender: <span className="font-bold text-slate-950">{msg.sender_name}</span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-amber-900 flex items-center gap-1">
                    <User className="w-3 h-3 text-amber-700" />
                    Harassed: <strong className="font-bold">{msg.target_user || 'Channel Members'}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold">Platform:</span>
                    <PlatformIcon platform={msg.platform} showLabel />
                  </span>
                </div>

                <p className="text-sm text-slate-800 font-medium leading-relaxed">
                  "{msg.text}"
                </p>
              </div>

              {/* Review Item Action Button */}
              <div className="shrink-0 self-start sm:self-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMessage(msg);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#14532D] hover:bg-[#166534] text-white text-xs font-semibold rounded shadow-subtle transition-colors"
                >
                  <span>Review item</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
