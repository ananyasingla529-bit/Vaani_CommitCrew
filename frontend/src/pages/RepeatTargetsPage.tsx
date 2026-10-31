import React from 'react';
import type { RepeatTarget, FlaggedMessage } from '../types';
import { 
  Users, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  ArrowRight, 
  Calendar,
  MessageSquare,
  AlertOctagon
} from 'lucide-react';
import { SeverityBadge } from '../components/SeverityBadge';
import { PlatformIcon } from '../components/PlatformIcon';

interface RepeatTargetsPageProps {
  targets: RepeatTarget[];
  onSelectTargetFilter: (targetUser: string) => void;
  onSelectMessage: (msg: FlaggedMessage) => void;
}

export const RepeatTargetsPage: React.FC<RepeatTargetsPageProps> = ({
  targets,
  onSelectTargetFilter,
  onSelectMessage,
}) => {
  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 flex items-start gap-3 shadow-subtle">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 space-y-1">
          <div className="font-semibold text-amber-900">
            Coordinated Harassment & Pile-On Monitoring
          </div>
          <p className="leading-relaxed text-amber-800">
            When multiple hostile users target a single individual across different platforms and chat channels, Vaani aggregates the incidents to identify brigading and targeted cyber-mobbing before it causes real-world harm.
          </p>
        </div>
      </div>

      {/* Target Cards List */}
      <div className="space-y-6">
        {targets.map((target) => (
          <div
            key={target.target_user}
            className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden"
          >
            {/* Target Header */}
            <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-8 h-8 rounded bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    {target.target_user.charAt(1).toUpperCase()}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {target.target_user}
                  </h2>
                  {target.pile_on_detected && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                      <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                      Active Pile-on Detected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>First seen: {new Date(target.first_seen).toLocaleDateString()}</span>
                  </span>
                  <span>•</span>
                  <span>Last incident: {new Date(target.last_seen).toLocaleString()}</span>
                  <span>•</span>
                  <span>Across {target.channels.length} channels</span>
                </div>
              </div>

              {/* Stats & Action */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <div className="px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 font-semibold tabular-nums">
                    {target.severity_breakdown.high} High
                  </div>
                  <div className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold tabular-nums">
                    {target.severity_breakdown.medium} Med
                  </div>
                  <div className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold tabular-nums">
                    {target.severity_breakdown.low} Low
                  </div>
                </div>

                <button
                  onClick={() => onSelectTargetFilter(target.target_user)}
                  className="px-3 py-1.5 bg-[#14532D] hover:bg-[#166534] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 shadow-subtle"
                >
                  <span>Filter Feed for User</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Incident Timeline */}
            <div className="p-5">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Incident Timeline ({target.sample_messages.length} Flagged Messages)</span>
              </div>

              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {target.sample_messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => onSelectMessage(msg)}
                    className="relative group p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded cursor-pointer transition-colors text-xs space-y-1.5"
                  >
                    {/* Node Dot */}
                    <div
                      className={`absolute -left-[27px] top-3.5 w-3 h-3 rounded-full border-2 border-white ${
                        msg.severity === 'high'
                          ? 'bg-red-500'
                          : msg.severity === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    />

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={msg.severity} showIcon={false} />
                        <span className="font-semibold text-slate-700">{msg.category}</span>
                        <PlatformIcon platform={msg.platform} showLabel />
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 font-medium">{msg.channel_name}</span>
                      </div>
                      <span className="text-slate-400 tabular-nums text-[11px]">
                        {new Date(msg.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="font-medium text-slate-900 leading-relaxed">
                      "{msg.text}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Sender: <strong className="text-slate-700">{msg.sender_name}</strong></span>
                      <span className="text-emerald-800 font-medium group-hover:underline flex items-center gap-0.5">
                        <span>Open details</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
