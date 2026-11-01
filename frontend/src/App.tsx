import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaggedMessage,
  ConnectedSource,
  OverviewStats,
  RepeatTarget,
  SystemSettings,
  MessageStatus,
  Platform
} from './types';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { FlaggedFeedPage } from './pages/FlaggedFeedPage';
import { ConnectedSourcesPage } from './pages/ConnectedSourcesPage';
import { RepeatTargetsPage } from './pages/RepeatTargetsPage';
import { TryItPage } from './pages/TryItPage';
import { SettingsPage } from './pages/SettingsPage';
import { MessageReviewModal } from './components/MessageReviewModal';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string>('moderator@vaani.org');
  const [currentTab, setCurrentTab] = useState<string>('overview');

  // Data states
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [sources, setSources] = useState<ConnectedSource[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [repeatTargets, setRepeatTargets] = useState<RepeatTarget[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<FlaggedMessage | null>(null);
  const [initialSeverityFilter, setInitialSeverityFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [msgs, srcs, st, targets, sett] = await Promise.all([
        api.getMessages(),
        api.getSources(),
        api.getStats(),
        api.getRepeatTargets(),
        api.getSettings(),
      ]);
      setMessages(msgs);
      setSources(srcs);
      setStats(st);
      setRepeatTargets(targets);
      setSettings(sett);
      setErrorBanner(null);
      setLastUpdated(new Date().toLocaleTimeString('en-GB'));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const isMixedContent = typeof window !== 'undefined' && window.location.protocol === 'https:' && apiUrl.startsWith('http://');
      const msg = isMixedContent
        ? `Backend URL (${apiUrl}) is insecure HTTP while Vercel is HTTPS. Set VITE_API_URL to your deployed HTTPS backend (e.g. Render) in Vercel settings, or click Explore in Demo Mode below.`
        : `Cannot reach the Vaani backend at ${apiUrl}. Retrying...`;
      setErrorBanner(msg);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Status update handler
  const handleUpdateStatus = async (id: string, status: MessageStatus, actionName?: string) => {
    try {
      const updated = await api.updateMessageStatus(id, status, actionName);
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
      if (selectedMessage && selectedMessage.id === id) {
        setSelectedMessage(updated);
      }
      // Refresh stats
      const newStats = await api.getStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Add source handler
  const handleAddSource = async (url: string, platform: Platform, channelName: string) => {
    try {
      const newSource = await api.addSource(url, platform, channelName);
      setSources((prev) => [newSource, ...prev]);
    } catch (err) {
      console.error('Failed to add source:', err);
    }
  };

  // Delete source handler
  const handleDeleteSource = async (id: string) => {
    try {
      await api.deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete source:', err);
    }
  };

  // Save settings handler
  const handleSaveSettings = async (newSettings: SystemSettings) => {
    try {
      const saved = await api.saveSettings(newSettings);
      setSettings(saved);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  // Quick navigation helpers
  const handleNavigateToFeed = (severityFilter?: string) => {
    setInitialSeverityFilter(severityFilter || 'all');
    setCurrentTab('feed');
  };

  const handleSelectMessageFromElsewhere = (msg: FlaggedMessage) => {
    setSelectedMessage(msg);
  };

  const handleSelectTargetFilter = (targetUser: string) => {
    setCurrentTab('feed');
  };

  const openHighCount = messages.filter((m) => m.severity === 'high' && m.status === 'new').length;
  const pileOnCount = repeatTargets.filter((t) => t.pile_on_detected).length;

  const getPageTitle = () => {
    switch (currentTab) {
      case 'overview':
        return {
          title: 'Moderation Overview',
          subtitle: 'System-wide metrics and incoming cyber-bullying incident tracking',
        };
      case 'feed':
        return {
          title: 'Flagged Feed',
          subtitle: 'Active toxic speech queue across Telegram, Discord, and YouTube',
        };
      case 'sources':
        return {
          title: 'Connected Sources',
          subtitle: 'Managed communities and platform connector authorization status',
        };
      case 'targets':
        return {
          title: 'Repeat Targets',
          subtitle: 'Targeted individuals and coordinated pile-on tracking',
        };
      case 'tryit':
        return {
          title: 'Classification Sandbox',
          subtitle: 'Live transliteration and cyber-bullying scoring for Romanized Indic text',
        };
      case 'settings':
        return {
          title: 'Console Settings',
          subtitle: 'Alert thresholds, Telegram webhook configuration, and monitored languages',
        };
      default:
        return { title: 'Vaani Moderation', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex h-screen overflow-hidden bg-[#F1F1EC] text-[#292728] font-sans relative">
      {/* Sidebar Navigation - Fixed 100vh height, never scrolls away */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        openHighCount={openHighCount}
        pileOnCount={pileOnCount}
        userEmail={userEmail}
        userRole="Community Admin"
        onLogout={() => setIsAuthenticated(false)}
      />

      {/* Main Content Area - Independently scrollable viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Header
          title={title}
          subtitle={subtitle}
          urgentCount={openHighCount}
          onRefresh={loadData}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          userEmail={userEmail}
          userRole="Community Admin"
          isAuthenticated={isAuthenticated}
          onLogout={() => setIsAuthenticated(false)}
          onSignInClick={() => setIsAuthenticated(false)}
        />

        {errorBanner && (
          <div className="mx-6 lg:mx-8 mt-4 px-4 py-2.5 rounded-xl border border-[#D0C7B3] bg-[#E9E9E2] text-[#434428] text-xs font-medium text-center shadow-2xs">
            {errorBanner}
          </div>
        )}

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {currentTab === 'overview' && (
            stats ? (
              <OverviewPage
                stats={stats}
                recentUrgentMessages={messages.filter((m) => m.severity === 'high')}
                onNavigateToFeed={handleNavigateToFeed}
                onSelectMessage={handleSelectMessageFromElsewhere}
              />
            ) : errorBanner ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#6B6860] text-center max-w-lg mx-auto px-4">
                <div className="w-12 h-12 rounded-full bg-[#FDF2F0] border border-[#F5CAC4] text-[#B93829] flex items-center justify-center mb-4 text-xl font-bold shadow-2xs">
                  !
                </div>
                <p className="text-base font-bold text-[#292728]">Backend Connection Notice</p>
                <p className="text-xs text-[#6B6860] mt-2 leading-relaxed">
                  {errorBanner}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => loadData()}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#434428] text-[#F1F1EC] hover:bg-[#292728] transition-colors cursor-pointer shadow-2xs"
                  >
                    Retry Connection
                  </button>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('vaani_use_mock_override', 'true');
                      window.location.reload();
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#D0C7B3] bg-white text-[#434428] hover:bg-[#F1F1EC] transition-colors cursor-pointer shadow-2xs"
                  >
                    Explore in Demo / Mock Mode
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-[#6B6860]">
                <div className="w-8 h-8 border-2 border-[#434428] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium text-[#292728]">Connecting to Vaani backend...</p>
                <p className="text-xs text-[#939474] mt-1">Fetching live moderation metrics and sources</p>
              </div>
            )
          )}

          {currentTab === 'feed' && (
            <FlaggedFeedPage
              messages={messages}
              selectedMessage={selectedMessage}
              onSelectMessage={setSelectedMessage}
              onUpdateStatus={handleUpdateStatus}
              initialSeverityFilter={initialSeverityFilter}
            />
          )}

          {currentTab === 'sources' && (
            <ConnectedSourcesPage
              sources={sources}
              onAddSource={handleAddSource}
              onDeleteSource={handleDeleteSource}
            />
          )}

          {currentTab === 'targets' && (
            <RepeatTargetsPage
              targets={repeatTargets}
              onSelectTargetFilter={handleSelectTargetFilter}
              onSelectMessage={handleSelectMessageFromElsewhere}
            />
          )}

          {currentTab === 'tryit' && <TryItPage />}

          {currentTab === 'settings' && settings && (
            <SettingsPage
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}
        </main>

        {/* Global Main Review Modal */}
        {selectedMessage && (
          <MessageReviewModal
            message={selectedMessage}
            onClose={() => setSelectedMessage(null)}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        <Footer />
      </div>

      {/* User Login Modal - Directly visible on the same screen as the dashboard */}
      {!isAuthenticated && (
        <LoginPage
          isModal={true}
          onLogin={(email) => {
            setUserEmail(email);
            setIsAuthenticated(true);
          }}
          onClose={() => setIsAuthenticated(true)}
        />
      )}
    </div>
  );
}
export default App;
