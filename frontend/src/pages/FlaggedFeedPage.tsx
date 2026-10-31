import React, { useState, useMemo } from 'react';
import type { 
  FlaggedMessage, 
  MessageStatus, 
  Severity 
} from '../types';
import { 
  Search, 
  X, 
  User, 
  ArrowRight
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

  // Filtered & sorted messages
  const filteredMessages = useMemo(() => {
    return messages
      .filter((m) => {
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
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [messages, statusFilter, severityFilter, search]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSeverityFilter('all');
  };

  const hasActiveFilters = search !== '' || statusFilter !== 'all' || severityFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Top Filter Bar - Clean, Simple, Uncluttered */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by message text, sender name, or harassed person..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Clean Filters */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded py-1.5 px-3 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
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
              className="bg-slate-50 border border-slate-200 rounded py-1.5 px-3 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-slate-500 hover:text-slate-900 font-medium underline px-1 text-xs whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Feed Table - Clean, Spacious, and Legible */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Flagged Messages Queue</span>
          <span className="tabular-nums">
            Showing {filteredMessages.length} of {messages.length} messages
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-36">Sender</th>
                <th className="py-3 px-4 w-44">Person Harassed</th>
                <th className="py-3 px-4 w-28">Platform</th>
                <th className="py-3 px-4 min-w-[300px]">Message</th>
                <th className="py-3 px-4 w-32">Date & Time</th>
                <th className="py-3 px-4 w-28">Status</th>
                <th className="py-3 px-4 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No flagged messages match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => (
                  <tr
                    key={msg.id}
                    onClick={() => onSelectMessage(msg)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    {/* Sender */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap align-top">
                      {msg.sender_name}
                    </td>

                    {/* Person Harassed */}
                    <td className="py-3.5 px-4 font-medium text-amber-900 whitespace-nowrap align-top">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{msg.target_user || 'Channel Members'}</span>
                      </span>
                    </td>

                    {/* Platform */}
                    <td className="py-3.5 px-4 whitespace-nowrap align-top">
                      <PlatformIcon platform={msg.platform} showLabel />
                    </td>

                    {/* Message Text */}
                    <td className="py-3.5 px-4 font-normal text-slate-800 leading-relaxed align-top">
                      "{msg.text}"
                    </td>

                    {/* Date & Time */}
                    <td className="py-3.5 px-4 text-slate-400 tabular-nums whitespace-nowrap align-top">
                      {new Date(msg.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap align-top">
                      <StatusBadge status={msg.status} />
                    </td>

                    {/* Review Action Button */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMessage(msg);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#14532D] hover:bg-[#166534] text-white text-xs font-semibold rounded shadow-subtle transition-colors"
                      >
                        <span>Review</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
