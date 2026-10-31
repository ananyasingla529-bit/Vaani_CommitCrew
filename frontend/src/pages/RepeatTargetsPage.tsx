import React from 'react';
import type { RepeatTarget, FlaggedMessage } from '../types';
import {
  Users,
  AlertTriangle,
  Clock,
  ArrowRight,
  Calendar,
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
      {/* Overview Banner - Earthy Palette */}
      <div className="bg-[#F4F5EE] border border-[#D8DABF] rounded-2xl p-5 flex items-start gap-3.5 shadow-subtle">
        <AlertTriangle className="w-5 h-5 text-[#939474] shrink-0 mt-0.5" />
        <div className="text-xs text-[#292728] space-y-1">
          <div className="font-bold text-[#434428] text-sm">
            Coordinated Harassment & Pile-On Monitoring
          </div>
          <p className="leading-relaxed text-[#6B6860]">
            When multiple hostile users target a single individual across different platforms and chat channels, Vaani aggregates the incidents to identify brigading and targeted cyber-mobbing before it causes real-world harm.
          </p>
        </div>
      </div>

      {/* Target Cards List */}
      <div className="space-y-6">
        {targets.map((target) => (
          <div
            key={target.target_user}
            className="bg-white border border-[#D0C7B3] rounded-2xl shadow-subtle overflow-hidden"
          >
            {/* Target Header */}
            <div className="p-6 border-b border-[#D0C7B3]/70 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FAF9F6]">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-8 h-8 rounded-xl bg-[#434428] text-[#F1F1EC] flex items-center justify-center font-bold text-xs shadow-2xs">
                    {target.target_user.charAt(1).toUpperCase()}
                  </div>
                  <h2 className="text-base font-bold text-[#292728]">
                    {target.target_user}
                  </h2>
                  {target.pile_on_detected && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FDF2F0] text-[#B93829] border border-[#F5CAC4]">
                      <AlertOctagon className="w-3.5 h-3.5 text-[#B93829]" />
                      Active Pile-on Detected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-[#6B6860] flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#939474]" />
                    <span>First seen: {new Date(target.first_seen).toLocaleDateString()}</span>
                  </span>
                  <span className="text-[#D0C7B3]">•</span>
                  <span>Last incident: {new Date(target.last_seen).toLocaleString()}</span>
                  <span className="text-[#D0C7B3]">•</span>
                  <span>Across {target.channels.length} channels</span>
                </div>
              </div>

              {/* Stats & Action */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <div className="px-3 py-1 rounded-full bg-[#FDF2F0] border border-[#F5CAC4] text-[#B93829] font-bold tabular-nums">
                    {target.severity_breakdown.high} High
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[#F4F5EE] border border-[#D8DABF] text-[#434428] font-bold tabular-nums">
                    {target.severity_breakdown.medium} Med
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[#F1F1EC] border border-[#D0C7B3] text-[#6B6860] font-bold tabular-nums">
                    {target.severity_breakdown.low} Low
                  </div>
                </div>

                <button
                  onClick={() => onSelectTargetFilter(target.target_user)}
                  className="px-4 py-2 bg-[#434428] hover:bg-[#292728] text-[#F1F1EC] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <span>Filter Feed for User</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Incident Timeline */}
            <div className="p-6">
              <div className="text-xs font-bold text-[#292728] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#939474]" />
                <span>Incident Timeline ({target.sample_messages.length} Flagged Messages)</span>
              </div>

              <div className="space-y-0">
                {target.sample_messages.map((msg, idx) => {
                  const isLast = idx === target.sample_messages.length - 1;
                  return (
                    <div key={msg.id} className="relative pb-4 last:pb-0">
                      {/* Continuous Connecting Line to Next Incident Dot */}
                      {!isLast && (
                        <div
                          className="absolute left-[11px] top-[26px] h-full w-[2px] bg-[#D0C7B3]"
                          aria-hidden="true"
                        />
                      )}

                      <div className="relative flex items-start gap-3.5 group">
                        {/* Node Dot - Centered at 12px horizontal and 26px vertical */}
                        <div className="relative z-10 w-6 shrink-0 flex justify-center mt-[19px]">
                          <div
                            className={`w-3.5 h-3.5 rounded-full border-2 border-white ring-2 shadow-xs shrink-0 transition-transform group-hover:scale-110 ${
                              msg.severity === 'high'
                                ? 'bg-[#B93829] ring-[#F5CAC4]'
                                : msg.severity === 'medium'
                                ? 'bg-[#939474] ring-[#D8DABF]'
                                : 'bg-[#D0C7B3] ring-[#F1F1EC]'
                            }`}
                          />
                        </div>

                        {/* Incident Card */}
                        <div
                          onClick={() => onSelectMessage(msg)}
                          className="flex-1 p-4 bg-[#FAF9F6] hover:bg-[#F1F1EC] border border-[#D0C7B3] rounded-xl cursor-pointer transition-colors text-xs space-y-2 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <SeverityBadge severity={msg.severity} showIcon={false} />
                              <span className="font-bold text-[#292728]">{msg.category}</span>
                              <PlatformIcon platform={msg.platform} showLabel />
                              <span className="text-[#D0C7B3]">•</span>
                              <span className="text-[#6B6860] font-medium">{msg.channel_name}</span>
                            </div>
                            <span className="text-[#6B6860] tabular-nums text-[11px]">
                              {new Date(msg.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="font-medium text-[#292728] leading-relaxed text-[13px]">
                            "{msg.text}"
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-[#6B6860] pt-1">
                            <span>Sender: <strong className="text-[#292728] font-bold">{msg.sender_name}</strong></span>
                            <span className="text-[#434428] font-bold group-hover:underline flex items-center gap-0.5">
                              <span>Open details</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
