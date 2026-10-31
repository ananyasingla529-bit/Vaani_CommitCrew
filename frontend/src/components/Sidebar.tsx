import React from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Radio, 
  Users, 
  Terminal, 
  Settings, 
  Shield, 
  LogOut,
  ExternalLink,
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  openHighCount: number;
  pileOnCount: number;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  openHighCount,
  pileOnCount,
  onLogout,
}) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'feed',
      label: 'Flagged Feed',
      icon: ShieldAlert,
      badge: openHighCount > 0 ? `${openHighCount} urgent` : undefined,
      badgeColor: 'bg-red-500/20 text-red-200 border-red-400/30',
    },
    {
      id: 'sources',
      label: 'Connected Sources',
      icon: Radio,
    },
    {
      id: 'targets',
      label: 'Repeat Targets',
      icon: Users,
      badge: pileOnCount > 0 ? `${pileOnCount} alerts` : undefined,
      badgeColor: 'bg-amber-400/20 text-amber-200 border-amber-300/30',
    },
    {
      id: 'tryit',
      label: 'Try-it Classifier',
      icon: Terminal,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-[#14532D] text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-[#166534]">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#166534]/70 flex items-center gap-3">
        <div className="w-9 h-9 rounded bg-[#166534] border border-emerald-400/30 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-emerald-300" />
        </div>
        <div>
          <div className="font-semibold text-base tracking-tight text-white flex items-center gap-1.5">
            <span>Vaani</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-700/80 text-emerald-200 border border-emerald-500/30">
              Console
            </span>
          </div>
          <p className="text-xs text-emerald-200/70 font-normal">
            Multi-Platform Moderation
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 space-y-1 flex-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-emerald-300/60 uppercase tracking-wider">
          Moderation Core
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#166534] text-white shadow-subtle border border-emerald-500/30'
                  : 'text-emerald-100/80 hover:bg-[#166534]/50 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-emerald-200/70'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold tabular-nums ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Consent & Safety Status Note */}
      <div className="p-3 mx-3 mb-3 rounded bg-[#0F391E] border border-emerald-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-300 font-medium mb-1">
          <Lock className="w-3.5 h-3.5" />
          <span>Active Consent Protocol</span>
        </div>
        <p className="text-[11px] text-emerald-200/70 leading-relaxed">
          Authorized monitoring with human-in-the-loop review.
        </p>
      </div>

      {/* User / Session Footer */}
      <div className="p-3 border-t border-[#166534]/70 bg-[#0F391E]/60 flex items-center justify-between">
        <div className="truncate pr-2">
          <div className="text-xs font-medium text-white truncate">moderator@vaani.org</div>
          <div className="text-[11px] text-emerald-300/60">Community Admin</div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          className="p-1.5 rounded hover:bg-[#166534] text-emerald-200/70 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
