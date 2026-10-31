export type Platform = 'telegram' | 'discord' | 'youtube';
export type Severity = 'high' | 'medium' | 'low';
export type Category = 
  | 'Insult/Bullying'
  | 'Harassment'
  | 'Hate speech'
  | 'Threat'
  | 'Sexual content'
  | 'Other';

export type MessageStatus = 'new' | 'reviewed' | 'dismissed' | 'escalated';

export type SourceStatus = 'pending' | 'connected' | 'permission_missing';

export interface FlaggedMessage {
  id: string;
  platform: Platform;
  source_id: string;
  channel_name: string;
  sender_id: string;
  sender_name: string;
  text: string;
  normalized_text: string;
  language: string;
  timestamp: string;
  context: string[]; // 3 messages before
  category: Category;
  severity: Severity;
  explanation: string;
  target_user?: string | null;
  status: MessageStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface ConnectedSource {
  id: string;
  platform: Platform;
  channel_id: string;
  channel_name: string;
  url: string;
  status: SourceStatus;
  flags_count: number;
  created_at: string;
  permission_hint?: string;
}

export interface ClassificationResult {
  category: Category;
  severity: Severity;
  language: string;
  normalized_text: string;
  explanation: string;
  target_user?: string | null;
  confidence: number;
  flagged: boolean;
}

export interface RepeatTarget {
  target_user: string;
  incident_count: number;
  severity_breakdown: {
    high: number;
    medium: number;
    low: number;
  };
  platforms: Platform[];
  channels: string[];
  first_seen: string;
  last_seen: string;
  sample_messages: FlaggedMessage[];
  pile_on_detected: boolean;
}

export interface OverviewStats {
  messages_scanned: number;
  messages_flagged: number;
  high_severity_open: number;
  avg_review_time_mins: number;
  flags_over_time: { date: string; flags: number; high: number; medium: number; low: number }[];
  flags_by_category: { category: string; count: number }[];
  flags_by_language: { language: string; count: number }[];
  flags_by_platform: { platform: string; count: number }[];
}

export interface SystemSettings {
  instant_high_severity: boolean;
  daily_digest_low: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  monitored_languages: string[];
  mock_mode: boolean;
}
