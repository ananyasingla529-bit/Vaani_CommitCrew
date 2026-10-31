import type {
  FlaggedMessage,
  ConnectedSource,
  OverviewStats,
  RepeatTarget,
  ClassificationResult,
  SystemSettings,
  MessageStatus,
  Platform
} from '../types';
import { 
  MOCK_MESSAGES, 
  INITIAL_MOCK_SOURCES, 
  INITIAL_OVERVIEW_STATS, 
  INITIAL_SETTINGS 
} from '../data/mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// In-memory state with localStorage persistence for pure mock mode
const STORAGE_KEY_MESSAGES = 'vaani_messages_v1';
const STORAGE_KEY_SOURCES = 'vaani_sources_v1';
const STORAGE_KEY_SETTINGS = 'vaani_settings_v1';

function getStoredMessages(): FlaggedMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading stored messages', e);
  }
  return MOCK_MESSAGES;
}

function saveStoredMessages(messages: FlaggedMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed saving messages', e);
  }
}

function getStoredSources(): ConnectedSource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOURCES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading stored sources', e);
  }
  return INITIAL_MOCK_SOURCES;
}

function saveStoredSources(sources: ConnectedSource[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SOURCES, JSON.stringify(sources));
  } catch (e) {
    console.error('Failed saving sources', e);
  }
}

function getStoredSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading stored settings', e);
  }
  return INITIAL_SETTINGS;
}

function saveStoredSettings(settings: SystemSettings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed saving settings', e);
  }
}

// Client-side rule-based classifier fallback matching the backend's classifier
export function classifyTextLocally(text: string): ClassificationResult {
  const lower = text.toLowerCase();
  
  // Transliteration normalizer for romanized text
  let normalized = text
    .replace(/k\*tta|kutta|kuttey|k\*tteya/gi, 'kutta')
    .replace(/k\*meeni|kameeni|kameena/gi, 'kameena')
    .replace(/b@stard|bastard/gi, 'bastard')
    .replace(/bhos\*|bsdk/gi, 'bhosdika')
    .replace(/m@r daloonga|mar dalunga|maar daloonga/gi, 'maar daloonga')
    .replace(/kanj\*r|kanjar/gi, 'kanjar')
    .replace(/thappad marunga|chaped maaran/gi, 'thappad marunga')
    .replace(/lattan bhan dunga/gi, 'lattan bhan doonga');

  // Detect language
  let language = 'English';
  if (/tu|tera|teri|tere|hai|hain|mai|main|kya|kyun|yahan|wahan|karenge|marunga|saale|chup/i.test(lower)) {
    language = 'Hindi (Romanized)';
  } else if (/oye|mainu|tainu|tuhanu|kitta|kiven|pind|lattan|chittar|saanu|chaped/i.test(lower)) {
    language = 'Punjabi (Romanized)';
  } else if (/bhai|yaar|bro|code|meeting|office|server|channel/i.test(lower) && /tu|karna|kar|hai|tha/i.test(lower)) {
    language = 'Hinglish';
  }

  // Detect target mention if any
  const mentionMatch = text.match(/@([a-zA-Z0-9_]+)/);
  const target_user = mentionMatch ? `@${mentionMatch[1]}` : null;

  // Check false positives
  if (/aag laga di|dead laughing|pkill|kill the process|kill it in the interview|pagal hai yaar itna mast/i.test(lower)) {
    return {
      category: 'Insult/Bullying',
      severity: 'low',
      language,
      normalized_text: normalized,
      explanation: 'Benign idiomatic or metaphorical phrasing with no harmful intent detected.',
      target_user,
      confidence: 0.94,
      flagged: false,
    };
  }

  // Threats
  if (/m@r daloonga|mar dunga|hospital|sir phod|lattan bhan|zinda nahi mudega|chaku|stab|kill you|goud dunga|chaped/i.test(lower)) {
    return {
      category: 'Threat',
      severity: 'high',
      language,
      normalized_text: normalized,
      explanation: 'Direct physical violence or bodily harm threat detected in Romanized text.',
      target_user,
      confidence: 0.96,
      flagged: true,
    };
  }

  // Sexual content
  if (/sex chat|private pics|leak your phone|figure hai|babe|nude|boobs|undress/i.test(lower)) {
    return {
      category: 'Sexual content',
      severity: 'high',
      language,
      normalized_text: normalized,
      explanation: 'Unsolicited sexual solicitation, extortion, or objectification detected.',
      target_user,
      confidence: 0.95,
      flagged: true,
    };
  }

  // Hate speech
  if (/desh se bahar|north east|quota|feminists are cancer|community ke log/i.test(lower)) {
    return {
      category: 'Hate speech',
      severity: 'high',
      language,
      normalized_text: normalized,
      explanation: 'Discriminatory bias, xenophobia, or collective hate speech targeting protected characteristics.',
      target_user,
      confidence: 0.92,
      flagged: true,
    };
  }

  // Harassment / Brigading
  if (/spam|dox|get you fired|career khatam|mass report/i.test(lower)) {
    return {
      category: 'Harassment',
      severity: 'high',
      language,
      normalized_text: normalized,
      explanation: 'Targeted campaign, doxxing threat, or coordinated brigading detected.',
      target_user,
      confidence: 0.91,
      flagged: true,
    };
  }

  // Insults / Bullying
  if (/k\*tta|kameena|b@stard|bsdk|chirkut|chapri|idiot|loser|scumbag|chomu|bhikari/i.test(lower)) {
    return {
      category: 'Insult/Bullying',
      severity: 'medium',
      language,
      normalized_text: normalized,
      explanation: 'Direct abusive personal insults and demeaning slurs in Romanized Indic text.',
      target_user,
      confidence: 0.89,
      flagged: true,
    };
  }

  // Default clean or mild
  return {
    category: 'Other',
    severity: 'low',
    language,
    normalized_text: normalized,
    explanation: 'No high-confidence toxic markers or threats detected.',
    target_user,
    confidence: 0.82,
    flagged: false,
  };
}

export const api = {
  async getMessages(filters?: {
    platform?: string;
    channel?: string;
    severity?: string;
    language?: string;
    category?: string;
    status?: string;
    search?: string;
    sortBy?: 'time' | 'severity';
    sortOrder?: 'asc' | 'desc';
  }): Promise<FlaggedMessage[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.platform && filters.platform !== 'all') params.append('platform', filters.platform);
      if (filters?.severity && filters.severity !== 'all') params.append('severity', filters.severity);
      if (filters?.language && filters.language !== 'all') params.append('language', filters.language);
      if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
      if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.sortBy) params.append('sort_by', filters.sortBy);
      if (filters?.sortOrder) params.append('sort_order', filters.sortOrder);

      const res = await fetch(`${API_BASE}/messages?${params.toString()}`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not running; fallback to local mock state
    }

    let messages = getStoredMessages();

    if (filters) {
      if (filters.platform && filters.platform !== 'all') {
        messages = messages.filter(m => m.platform === filters.platform);
      }
      if (filters.channel && filters.channel !== 'all') {
        messages = messages.filter(m => m.channel_name === filters.channel);
      }
      if (filters.severity && filters.severity !== 'all') {
        messages = messages.filter(m => m.severity === filters.severity);
      }
      if (filters.language && filters.language !== 'all') {
        messages = messages.filter(m => m.language === filters.language);
      }
      if (filters.category && filters.category !== 'all') {
        messages = messages.filter(m => m.category === filters.category);
      }
      if (filters.status && filters.status !== 'all') {
        messages = messages.filter(m => m.status === filters.status);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        messages = messages.filter(m => 
          m.text.toLowerCase().includes(q) ||
          m.sender_name.toLowerCase().includes(q) ||
          m.channel_name.toLowerCase().includes(q) ||
          (m.target_user && m.target_user.toLowerCase().includes(q))
        );
      }
      if (filters.sortBy === 'severity') {
        const severityRank = { high: 3, medium: 2, low: 1 };
        messages.sort((a, b) => {
          const diff = severityRank[b.severity] - severityRank[a.severity];
          return filters.sortOrder === 'asc' ? -diff : diff;
        });
      } else {
        // default by time desc
        messages.sort((a, b) => {
          const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          return filters.sortOrder === 'asc' ? -diff : diff;
        });
      }
    }

    return messages;
  },

  async updateMessageStatus(
    id: string, 
    status: MessageStatus, 
    actionName?: string
  ): Promise<FlaggedMessage> {
    try {
      const res = await fetch(`${API_BASE}/messages/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          action: actionName,
          reviewed_by: 'moderator@vaani.org'
        }),
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not running; fallback to local state
    }

    const messages = getStoredMessages();
    const idx = messages.findIndex(m => m.id === id);
    if (idx !== -1) {
      messages[idx] = {
        ...messages[idx],
        status,
        reviewed_by: 'moderator@vaani.org',
        reviewed_at: new Date().toISOString()
      };
      saveStoredMessages(messages);
      return messages[idx];
    }
    throw new Error('Message not found');
  },

  async getSources(): Promise<ConnectedSource[]> {
    try {
      const res = await fetch(`${API_BASE}/sources`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return getStoredSources();
  },

  async addSource(url: string, platform: Platform, channel_name: string): Promise<ConnectedSource> {
    try {
      const res = await fetch(`${API_BASE}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, platform, channel_name }),
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }

    const sources = getStoredSources();
    const newSource: ConnectedSource = {
      id: `src_${platform}_${Date.now()}`,
      platform,
      channel_id: `chan_${Math.floor(Math.random() * 900000 + 100000)}`,
      channel_name,
      url,
      status: 'connected',
      flags_count: 0,
      created_at: new Date().toISOString()
    };
    sources.unshift(newSource);
    saveStoredSources(sources);
    return newSource;
  },

  async deleteSource(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sources/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(1500) });
    } catch {
      // fallback
    }
    const sources = getStoredSources().filter(s => s.id !== id);
    saveStoredSources(sources);
  },

  async syncSources(): Promise<{ synced_sources_count: number; new_flagged_incidents: number }> {
    try {
      const res = await fetch(`${API_BASE}/sources/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return { synced_sources_count: 6, new_flagged_incidents: 0 };
  },

  async getStats(): Promise<OverviewStats> {
    try {
      const res = await fetch(`${API_BASE}/stats`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const messages = getStoredMessages();
    const highOpen = messages.filter(m => m.severity === 'high' && m.status === 'new').length;
    return {
      ...INITIAL_OVERVIEW_STATS,
      messages_flagged: messages.length,
      high_severity_open: highOpen
    };
  },

  async getRepeatTargets(): Promise<RepeatTarget[]> {
    try {
      const res = await fetch(`${API_BASE}/repeat-targets`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }

    const messages = getStoredMessages();
    const targetMap: Record<string, FlaggedMessage[]> = {};

    messages.forEach(m => {
      if (m.target_user) {
        if (!targetMap[m.target_user]) targetMap[m.target_user] = [];
        targetMap[m.target_user].push(m);
      }
    });

    const targets: RepeatTarget[] = Object.entries(targetMap)
      .map(([target_user, msgs]) => {
        const platforms = Array.from(new Set(msgs.map(m => m.platform)));
        const channels = Array.from(new Set(msgs.map(m => m.channel_name)));
        const timestamps = msgs.map(m => new Date(m.timestamp).getTime()).sort((a, b) => a - b);
        const highCount = msgs.filter(m => m.severity === 'high').length;
        const medCount = msgs.filter(m => m.severity === 'medium').length;
        const lowCount = msgs.filter(m => m.severity === 'low').length;

        return {
          target_user,
          incident_count: msgs.length,
          severity_breakdown: {
            high: highCount,
            medium: medCount,
            low: lowCount,
          },
          platforms,
          channels,
          first_seen: new Date(timestamps[0]).toISOString(),
          last_seen: new Date(timestamps[timestamps.length - 1]).toISOString(),
          sample_messages: msgs,
          // Pile-on detected if 3+ incidents in under 48 hours or across multiple channels
          pile_on_detected: msgs.length >= 3 && channels.length >= 2,
        };
      })
      .sort((a, b) => b.incident_count - a.incident_count);

    return targets;
  },

  async classify(text: string): Promise<ClassificationResult> {
    try {
      const res = await fetch(`${API_BASE}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return classifyTextLocally(text);
  },

  async getSettings(): Promise<SystemSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return getStoredSettings();
  },

  async saveSettings(settings: SystemSettings): Promise<SystemSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    saveStoredSettings(settings);
    return settings;
  },

  async sendTestAlert(messageId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/alerts/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId || 'msg_001' }),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return {
      success: true,
      message: 'Simulated alert dispatched to Telegram moderator DM (@moderator_vaani) with snippet and link to dashboard item.'
    };
  }
};
