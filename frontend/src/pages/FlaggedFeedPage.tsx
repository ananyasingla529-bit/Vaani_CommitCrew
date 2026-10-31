import React, { useState, useMemo } from 'react';
import type {
  FlaggedMessage,
  MessageStatus,
  Severity,
  Category,
  Platform
} from '../types';
import { 
  Search, 
  Filter, 
  X, 
  ArrowUpDown, 
  Check, 
  AlertTriangle, 
  ArrowUpRight, 
  Ban, 
  ShieldCheck, 
  User, 
  MessageSquare,
  Clock,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { SeverityBadge } from '../components/SeverityBadge';
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
  // Filter states
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>(initialSeverityFilter);
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'severity'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Derive unique channels for dropdown
  const uniqueChannels = useMemo(() => {
    return Array.from(new Set(messages.map((m) => m.channel_name)));
  }, [messages]);

  // Unique languages
  const uniqueLanguages = useMemo(() => {
    return Array.from(new Set(messages.map((m) => m.language)));
  }, [messages]);

  // Filtered & sorted messages
  const filteredMessages = useMemo(() => {
    return messages
      .filter((m) => {
        if (platformFilter !== 'all' && m.platform !== platformFilter) return false;
        if (channelFilter !== 'all' && m.channel_name !== channelFilter) return false;
        if (severityFilter !== 'all' && m.severity !== severityFilter) return false;
        if (languageFilter !== 'all' && m.language !== languageFilter) return false;
        if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && m.status !== statusFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchesText = m.text.toLowerCase().includes(q);
          const matchesSender = m.sender_name.toLowerCase().includes(q);
          const matchesChannel = m.channel_name.toLowerCase().includes(q);
          const matchesTarget = m.target_user ? m.target_user.toLowerCase().includes(q) : false;
          const matchesNorm = m.normalized_text.toLowerCase().includes(q);
          if (!matchesText && !matchesSender && !matchesChannel && !matchesTarget && !matchesNorm) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const rank: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
          const diff = rank[b.severity] - rank[a.severity];
          return sortOrder === 'asc' ? -diff : diff;
        } else {
          const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          return sortOrder === 'asc' ? -diff : diff;
        }
      });
  }, [
    messages,
    platformFilter,
    channelFilter,
    severityFilter,
    languageFilter,
    categoryFilter,
    statusFilter,
    search,
    sortBy,
    sortOrder,
  ]);

  const handleAction = async (status: MessageStatus, actionName: string) => {
    if (!selectedMessage) return;
    await onUpdateStatus(selectedMessage.id, status, actionName);
    setActionFeedback(`Action recorded: ${actionName}`);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const clearAllFilters = () => {
    setSearch('');
    setPlatformFilter('all');
    setChannelFilter('all');
    setSeverityFilter('all');
    setLanguageFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSortBy('time');
    setSortOrder('desc');
  };

  const hasActiveFilters =
    search !== '' ||
    platformFilter !== 'all' ||
    channelFilter !== 'all' ||
    severityFilter !== 'all' ||
    languageFilter !== 'all' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all';

  return (
    <div className="flex h-full min-h-[calc(100vh-12rem)] relative">
      {/* Main Table Column */}
      <div className={`flex-1 transition-all duration-200 ${selectedMessage ? 'pr-0 lg:pr-[460px]' : ''}`}>
        <div className="space-y-4">
          {/* Top Controls Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-card space-y-3">
            {/* Row 1: Search & Sort */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search in flagged text, transliteration, sender, target user..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
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

              {/* Sort By Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500 font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'time' | 'severity')}
                  className="text-xs bg-slate-50 border border-slate-200 rounded py-1 px-2.5 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
                >
                  <option value="time">Timestamp</option>
                  <option value="severity">Severity Rank</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                  title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 underline px-2"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Filter Selects */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>

              {/* Platform Filter */}
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded py-1 px-2 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
              >
                <option value="all">All Platforms</option>
                <option value="telegram">Telegram</option>
                <option value="discord">Discord</option>
                <option value="youtube">YouTube</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded py-1 px-2 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
              >
                <option value="all">All Severities</option>
                <option value="high">High Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="low">Low Severity</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded py-1 px-2 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
              >
                <option value="all">All Categories</option>
                <option value="Threat">Threat</option>
                <option value="Harassment">Harassment</option>
                <option value="Insult/Bullying">Insult/Bullying</option>
                <option value="Hate speech">Hate speech</option>
                <option value="Sexual content">Sexual content</option>
                <option value="Other">Other</option>
              </select>

              {/* Language Filter */}
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded py-1 px-2 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
              >
                <option value="all">All Languages</option>
                {uniqueLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>

              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded py-1 px-2 text-slate-700 font-medium focus:outline-none focus:border-emerald-600 max-w-[170px] truncate"
              >
                <option value="all">All Channels</option>
                {uniqueChannels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded py-1 px-2 text-slate-700 font-medium focus:outline-none focus:border-emerald-600"
              >
                <option value="all">All Statuses</option>
                <option value="new">New (Unreviewed)</option>
                <option value="reviewed">Reviewed</option>
                <option value="dismissed">Dismissed</option>
                <option value="escalated">Escalated</option>
              </select>

              <span className="ml-auto text-slate-400 tabular-nums">
                Showing {filteredMessages.length} of {messages.length} messages
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-20">Severity</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Flagged Message Snippet</th>
                    <th className="py-2.5 px-3 w-24">Language</th>
                    <th className="py-2.5 px-3 w-28">Category</th>
                    <th className="py-2.5 px-3 w-24">Platform</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Channel</th>
                    <th className="py-2.5 px-3 w-28">Sender</th>
                    <th className="py-2.5 px-3 w-20">Time</th>
                    <th className="py-2.5 px-3 w-24 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMessages.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No flagged messages match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isSelected = selectedMessage?.id === msg.id;
                      return (
                        <tr
                          key={msg.id}
                          onClick={() => onSelectMessage(msg)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/70 hover:bg-emerald-50'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Severity Badge */}
                          <td className="py-3 px-3 align-top">
                            <SeverityBadge severity={msg.severity} showIcon={false} />
                          </td>

                          {/* Message Snippet */}
                          <td className="py-3 px-3 align-top">
                            <div className="font-medium text-slate-900 line-clamp-1 mb-0.5">
                              {msg.text}
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1">
                              {msg.explanation}
                            </div>
                            {msg.target_user && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  <User className="w-2.5 h-2.5 text-amber-600" />
                                  Target: {msg.target_user}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Language */}
                          <td className="py-3 px-3 align-top text-slate-600 whitespace-nowrap">
                            {msg.language}
                          </td>

                          {/* Category */}
                          <td className="py-3 px-3 align-top">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium whitespace-nowrap">
                              {msg.category}
                            </span>
                          </td>

                          {/* Platform Icon */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <PlatformIcon platform={msg.platform} showLabel />
                          </td>

                          {/* Channel */}
                          <td className="py-3 px-3 align-top text-slate-600 truncate max-w-[150px]">
                            {msg.channel_name}
                          </td>

                          {/* Sender */}
                          <td className="py-3 px-3 align-top font-medium text-slate-700 truncate max-w-[110px]">
                            {msg.sender_name}
                          </td>

                          {/* Time */}
                          <td className="py-3 px-3 align-top text-slate-400 tabular-nums whitespace-nowrap">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            <StatusBadge status={msg.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Slideout Detail Panel (Right Side) */}
      {selectedMessage && (
        <div className="fixed top-16 right-0 w-full sm:w-[460px] h-[calc(100vh-4rem)] bg-white border-l border-slate-200 shadow-xl z-20 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={selectedMessage.severity} />
              <StatusBadge status={selectedMessage.status} />
              <span className="text-xs text-slate-400 font-mono">#{selectedMessage.id}</span>
            </div>
            <button
              onClick={() => onSelectMessage(null)}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Feedback Banner */}
          {actionFeedback && (
            <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Detail Body */}
          <div className="p-5 space-y-5 flex-1">
            {/* Metadata Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 border border-slate-200 rounded p-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Platform & Channel</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PlatformIcon platform={selectedMessage.platform} showLabel />
                </div>
                <div className="font-medium text-slate-700 truncate mt-0.5">
                  {selectedMessage.channel_name}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sender</span>
                <div className="font-medium text-slate-800 truncate mt-0.5">
                  {selectedMessage.sender_name}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  ID: {selectedMessage.sender_id}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Category</span>
                <span className="font-medium text-slate-800 mt-0.5 inline-block">
                  {selectedMessage.category}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Language</span>
                <span className="font-medium text-slate-800 mt-0.5 inline-block">
                  {selectedMessage.language}
                </span>
              </div>
            </div>

            {/* Target User Alert if detected */}
            {selectedMessage.target_user && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs flex items-start gap-2.5">
                <User className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-900">
                    Targeted User: {selectedMessage.target_user}
                  </div>
                  <p className="text-amber-800/80 text-[11px] mt-0.5">
                    This user has received multiple flagged toxic messages across connected channels.
                  </p>
                </div>
              </div>
            )}

            {/* Conversation Thread Context (Previous 3 messages) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                <span>Conversation Context (Prior Messages)</span>
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2.5 text-xs">
                {selectedMessage.context.map((line, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                      -{3 - idx}
                    </span>
                    <p className="text-slate-600 leading-relaxed font-normal bg-white p-2 rounded border border-slate-100 flex-1">
                      {line}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Flagged Message (Highlight) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-900 uppercase tracking-wide flex items-center justify-between">
                <span>Flagged Message</span>
                <span className="text-[10px] font-normal text-slate-400">
                  {new Date(selectedMessage.timestamp).toLocaleString()}
                </span>
              </label>
              <div className="p-3.5 bg-red-50/50 border border-red-200 rounded text-sm text-red-950 font-medium leading-relaxed">
                "{selectedMessage.text}"
              </div>
            </div>

            {/* Normalized / Transliterated Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span>Transliterated / Normalized Text</span>
              </label>
              <div className="p-3 bg-emerald-50/40 border border-emerald-200/80 rounded text-xs text-slate-800 leading-relaxed font-mono">
                {selectedMessage.normalized_text}
              </div>
              <p className="text-[11px] text-slate-400">
                Obfuscated Romanized characters and phonetic spellings normalized for classifier evaluation.
              </p>
            </div>

            {/* Model's Short Explanation */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Model Classification Rationale
              </label>
              <div className="p-3 bg-white border border-slate-200 rounded text-xs text-slate-700 leading-relaxed">
                {selectedMessage.explanation}
              </div>
            </div>

            {/* Review History if any */}
            {selectedMessage.reviewed_by && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500 flex items-center justify-between">
                <span>Reviewed by: {selectedMessage.reviewed_by}</span>
                <span className="tabular-nums">
                  {selectedMessage.reviewed_at ? new Date(selectedMessage.reviewed_at).toLocaleTimeString() : ''}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/90 space-y-2 sticky bottom-0">
            <span className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Moderator Actions
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Dismiss */}
              <button
                onClick={() => handleAction('dismissed', 'Dismiss')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-subtle"
              >
                <Ban className="w-3.5 h-3.5 text-slate-500" />
                <span>Dismiss</span>
              </button>

              {/* Mark as False Positive */}
              <button
                onClick={() => handleAction('dismissed', 'Marked False Positive')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors shadow-subtle"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>False Positive</span>
              </button>

              {/* Warn Sender */}
              <button
                onClick={() => handleAction('reviewed', 'Sender Warned')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-medium transition-colors shadow-subtle"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Warn Sender</span>
              </button>

              {/* Escalate */}
              <button
                onClick={() => handleAction('escalated', 'Escalated to Safety Lead')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors shadow-subtle"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                <span>Escalate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
