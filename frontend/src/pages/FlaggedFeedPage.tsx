import React, { useState, useMemo } from 'react';
import type {
  FlaggedMessage,
  MessageStatus
} from '../types';
import {
  Search,
  X,
  User,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { PlatformIcon } from '../components/PlatformIcon';

interface FlaggedFeedPageProps {
  messages: FlaggedMessage[];
  selectedMessage: FlaggedMessage | null;
  onSelectMessage: (msg: FlaggedMessage | null) => void;
  onUpdateStatus: (id: string, status: MessageStatus, actionName?: string) => Promise<void>;
  initialSeverityFilter?: string;
}

export const FlaggedFeedPage: React.FC<FlaggedFeedPageProps> = ({
  messages,
  selectedMessage,
  onSelectMessage,
  onUpdateStatus,
  initialSeverityFilter = 'all',
}) => {
  // Simple, clean filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>(initialSeverityFilter);

  // Filtered & sorted messages: Unreviewed 'new' first, reviewed/dismissed piled up at the end
  const { unreviewedMessages, reviewedMessages } = useMemo(() => {
    const filtered = messages.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (severityFilter !== 'all' && m.severity !== severityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesText = m.text.toLowerCase().includes(q);
        const matchesSender = m.sender_name.toLowerCase().includes(q);
        const matchesTarget = m.target_user ? m.target_user.toLowerCase().includes(q) : false;
        if (!matchesText && !matchesSender && !matchesTarget) {
          return false;
        }
      }
      return true;
    });

    const unreviewed = filtered
      .filter((m) => m.status === 'new')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const reviewed = filtered
      .filter((m) => m.status !== 'new')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { unreviewedMessages: unreviewed, reviewedMessages: reviewed };
  }, [messages, statusFilter, severityFilter, search]);

  const allFiltered = [...unreviewedMessages, ...reviewedMessages];

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSeverityFilter('all');
  };

  const hasActiveFilters = search !== '' || statusFilter !== 'all' || severityFilter !== 'all';

  return (
    <div className="space-y-5 w-full">
      {/* Top Filter Bar - Clean, Spacious, Earthy */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl p-5 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#939474] absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by message text, sender name, or harassed person..."
              className="w-full pl-10 pr-9 py-2.5 text-xs bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] placeholder-[#939474]/70 focus:outline-none focus:border-[#434428] focus:bg-white focus:ring-1 focus:ring-[#434428] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-[#939474] hover:text-[#292728]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Clean Filters */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl py-2 px-3 text-[#292728] font-medium focus:outline-none focus:border-[#434428]"
            >
              <option value="all">All Statuses</option>
              <option value="new">New (Unreviewed)</option>
              <option value="reviewed">Reviewed</option>
              <option value="dismissed">Dismissed</option>
              <option value="escalated">Escalated</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl py-2 px-3 text-[#292728] font-medium focus:outline-none focus:border-[#434428]"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-[#434428] hover:text-[#292728] font-bold underline px-1 text-xs whitespace-nowrap cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Feed Table - 100% Fit in Single Screen with Zero Horizontal Scroll */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl shadow-subtle overflow-hidden w-full">
        <div className="px-6 py-4 border-b border-[#D0C7B3]/70 bg-[#FAF9F6] flex items-center justify-between text-xs text-[#6B6860]">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#292728]">Flagged Messages Queue</span>
            {unreviewedMessages.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#FDF2F0] text-[#B93829] border border-[#F5CAC4] text-[11px] font-bold">
                {unreviewedMessages.length} Unreviewed
              </span>
            )}
          </div>
          <span className="tabular-nums font-medium">
            Showing {allFiltered.length} of {messages.length} messages
          </span>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F6] border-b border-[#D0C7B3]/70 text-[#6B6860] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 w-[13%]">Sender</th>
                <th className="py-3 px-3.5 w-[15%]">Person Harassed</th>
                <th className="py-3 px-3.5 w-[11%]">Platform</th>
                <th className="py-3 px-3.5 w-[37%]">Message</th>
                <th className="py-3 px-3.5 w-[11%]">Date & Time</th>
                <th className="py-3 px-3.5 w-[10%]">Status</th>
                <th className="py-3 px-3.5 w-[13%] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D0C7B3]/40">
              {allFiltered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-[#6B6860]">
                    No flagged messages match your search or filter.
                  </td>
                </tr>
              ) : (
                allFiltered.map((msg, index) => {
                  const isFirstReviewed = index === unreviewedMessages.length && reviewedMessages.length > 0 && statusFilter === 'all';
                  const isReviewed = msg.status !== 'new';

                  return (
                    <React.Fragment key={msg.id}>
                      {/* Section Divider: Reviewed items piled up at the end */}
                      {isFirstReviewed && (
                        <tr className="bg-[#FAF9F6] border-y border-[#D0C7B3]">
                          <td colSpan={7} className="py-2.5 px-4 text-xs font-bold text-[#434428]">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#434428]" />
                                <span>Reviewed & Actioned Incidents ({reviewedMessages.length})</span>
                              </span>
                              <span className="text-[11px] font-normal text-[#6B6860]">Piled at the end</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      <tr
                        onClick={() => onSelectMessage(msg)}
                        className={`hover:bg-[#FAF9F6] cursor-pointer transition-colors ${
                          isReviewed ? 'bg-[#FAF9F6]/30 opacity-80' : 'bg-white'
                        }`}
                      >
                        {/* Sender */}
                        <td className="py-3.5 px-3.5 font-bold text-[#292728] truncate align-middle">
                          <span title={msg.sender_name} className="truncate block">
                            {msg.sender_name}
                          </span>
                        </td>

                        {/* Person Harassed */}
                        <td className="py-3.5 px-3.5 font-semibold text-[#434428] truncate align-middle">
                          <span className="inline-flex items-center gap-1.5 truncate max-w-full" title={msg.target_user || 'Channel Members'}>
                            <User className="w-3.5 h-3.5 text-[#939474] shrink-0" />
                            <span className="truncate">{msg.target_user || 'Channel Members'}</span>
                          </span>
                        </td>

                        {/* Platform */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <PlatformIcon platform={msg.platform} showLabel />
                        </td>

                        {/* Message Text - Fluid Wrapping without horizontal scroll */}
                        <td className="py-3.5 px-3.5 font-medium text-[#292728] leading-relaxed align-middle">
                          <p className="line-clamp-2 break-words" title={msg.text}>
                            "{msg.text}"
                          </p>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-3.5 text-[#6B6860] tabular-nums text-[11px] align-middle">
                          <div>
                            {new Date(msg.timestamp).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] text-[#6B6860]/80">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <StatusBadge status={msg.status} />
                        </td>

                        {/* Review Action Button */}
                        <td className="py-3.5 px-3.5 text-right align-middle">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectMessage(msg);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer ${
                              isReviewed
                                ? 'border border-[#D0C7B3] bg-white hover:bg-[#F1F1EC] text-[#434428]'
                                : 'bg-[#434428] hover:bg-[#292728] text-[#F1F1EC]'
                            }`}
                          >
                            <span>{isReviewed ? 'View' : 'Review'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
