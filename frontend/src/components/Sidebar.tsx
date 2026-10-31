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
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  openHighCount: number;
  pileOnCount: number;
  onLogout: () => void;
  userEmail?: string;
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  openHighCount,
  pileOnCount,
  onLogout,
  userEmail = 'moderator@vaani.org',
  userRole = 'Community Admin',
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
      badgeColor: 'bg-[#B93829]/25 text-[#F5CAC4] border-[#B93829]/40',
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
      badgeColor: 'bg-[#939474]/30 text-[#F1F1EC] border-[#939474]/50',
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
    <aside className="w-68 bg-[#292728] text-[#F1F1EC] flex flex-col shrink-0 h-screen sticky top-0 border-r border-[#D0C7B3]/20 select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#D0C7B3]/15 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#434428] border border-[#939474]/40 flex items-center justify-center shrink-0 shadow-2xs">
          <Shield className="w-5 h-5 text-[#F1F1EC]" />
        </div>
        <div>
          <div className="font-semibold text-base tracking-tight text-[#F1F1EC] flex items-center gap-1.5">
            <span>Vaani</span>
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#939474]/25 text-[#D0C7B3] border border-[#939474]/40">
              Console
            </span>
          </div>
          <p className="text-xs text-[#D0C7B3]/75 font-normal">
            Multi-Platform Safety
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
        <div className="px-3.5 py-1 text-[11px] font-semibold text-[#D0C7B3]/60 uppercase tracking-wider">
          Moderation Core
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#434428] text-[#F1F1EC] shadow-2xs border border-[#939474]/40'
                  : 'text-[#D0C7B3]/85 hover:text-[#F1F1EC] hover:bg-[#383536]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#D0C7B3]' : 'text-[#939474]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold tabular-nums ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Safety Protocol Badge */}
      <div className="p-3 mx-3 mb-2 rounded-xl bg-[#222021] border border-[#D0C7B3]/20 text-xs">
        <div className="flex items-center gap-2 text-[#D0C7B3] font-medium mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#939474] animate-pulse" />
          <Lock className="w-3.5 h-3.5 text-[#939474]" />
          <span>Active Consent Protocol</span>
        </div>
        <p className="text-[11px] text-[#D0C7B3]/70 leading-relaxed">
          Authorized monitoring with human-in-the-loop review.
        </p>
      </div>

      {/* User Login & Session Card - Always Pinned on Screen */}
      <div className="p-3.5 border-t border-[#D0C7B3]/15 bg-[#222021]/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-[#434428] border border-[#939474]/50 text-[#F1F1EC] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#939474] border border-[#292728]" />
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-[#F1F1EC] truncate">{userEmail}</div>
            <div className="text-[11px] text-[#939474] font-medium truncate">{userRole}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out / Switch account"
          className="p-1.5 rounded-lg hover:bg-[#383536] text-[#D0C7B3] hover:text-white transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
