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
  ArrowRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid
} from 'recharts';
import { SeverityBadge } from '../components/SeverityBadge';
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
      {/* Stat Cards Grid */}
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Flags Over Time */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Flagged Messages Over Time</h3>
              <p className="text-xs text-slate-500">7-day trend across all connected platforms</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]"></span>
                Total
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></span>
                High
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.flags_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderColor: '#e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                  }} 
                />
                <Line type="monotone" dataKey="flags" stroke="#16A34A" strokeWidth={2} dot={{ r: 3, fill: '#16A34A' }} />
                <Line type="monotone" dataKey="high" stroke="#DC2626" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: '#DC2626' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Flags by Category */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Flags by Toxicity Category</h3>
              <p className="text-xs text-slate-500">Breakdown of cyber-bullying classification</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.flags_by_category} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" stroke="#64748b" fontSize={11} tickLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderColor: '#e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px'
                  }} 
                />
                <Bar dataKey="count" fill="#166534" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Flags by Language */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Flags by Romanized Language</h3>
              <p className="text-xs text-slate-500">Distribution across Indic script transliterations</p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.flags_by_language} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="language" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderColor: '#e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px' 
                  }} 
                />
                <Bar dataKey="count" fill="#15803D" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Flags by Platform */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Flags by Monitored Platform</h3>
              <p className="text-xs text-slate-500">Incident volume across connectors</p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.flags_by_platform} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="platform" stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => val.toUpperCase()} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderColor: '#e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px' 
                  }} 
                />
                <Bar dataKey="count" fill="#047857" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Urgent Open Flags Action Queue */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Urgent Open Incidents Requiring Moderator Action</span>
            </h3>
            <p className="text-xs text-slate-500">Prioritized threats and high-severity attacks awaiting review</p>
          </div>
          <button
            onClick={() => onNavigateToFeed('high')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 transition-colors"
          >
            <span>View all flagged messages</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentUrgentMessages.slice(0, 5).map((msg) => (
            <div
              key={msg.id}
              onClick={() => onSelectMessage(msg)}
              className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 max-w-3xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityBadge severity={msg.severity} />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {msg.category}
                  </span>
                  <PlatformIcon platform={msg.platform} showLabel />
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-medium text-slate-600">{msg.channel_name}</span>
                  {msg.target_user && (
                    <span className="text-xs font-medium px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Target: {msg.target_user}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-900 line-clamp-1">
                  "{msg.text}"
                </p>
                <p className="text-xs text-slate-500 line-clamp-1">
                  Transliteration: {msg.normalized_text}
                </p>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 text-right">
                <span className="text-xs font-medium text-slate-700">{msg.sender_name}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1 mt-1">
                  <span>Review item</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
