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

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Trigger background sync across live connectors
      await api.syncSources().catch(() => { });

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
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
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
          userEmail={userEmail}
          userRole="Community Admin"
          isAuthenticated={isAuthenticated}
          onLogout={() => setIsAuthenticated(false)}
          onSignInClick={() => setIsAuthenticated(false)}
        />

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {currentTab === 'overview' && stats && (
            <OverviewPage
              stats={stats}
              recentUrgentMessages={messages.filter((m) => m.severity === 'high')}
              onNavigateToFeed={handleNavigateToFeed}
              onSelectMessage={handleSelectMessageFromElsewhere}
            />
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
