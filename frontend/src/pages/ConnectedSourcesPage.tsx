import React, { useState } from 'react';
import type {
  ConnectedSource,
  Platform
} from '../types';
import {
  Radio,
  Link as LinkIcon,
  Shield,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { PlatformIcon } from '../components/PlatformIcon';
import { StatusBadge } from '../components/StatusBadge';

interface ConnectedSourcesPageProps {
  sources: ConnectedSource[];
  onAddSource: (url: string, platform: Platform, channelName: string) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
}

export const ConnectedSourcesPage: React.FC<ConnectedSourcesPageProps> = ({
  sources,
  onAddSource,
  onDeleteSource,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<Platform | null>(null);
  const [parsedIdentifier, setParsedIdentifier] = useState<string>('');
  const [step, setStep] = useState<'input' | 'authorize' | 'verifying' | 'completed'>('input');
  const [verificationProgress, setVerificationProgress] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Auto-detect platform from URL pattern
  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    const trimmed = value.trim();

    if (/t\.me|telegram\.me/i.test(trimmed)) {
      setDetectedPlatform('telegram');
      const match = trimmed.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_+]+)/i);
      setParsedIdentifier(match ? match[1] : 'Telegram Group');
    } else if (/discord\.(?:gg|com)/i.test(trimmed)) {
      setDetectedPlatform('discord');
      const match = trimmed.match(/(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9_-]+)/i);
      setParsedIdentifier(match ? `server/${match[1]}` : 'Discord Server');
    } else if (/youtube\.com|youtu\.be/i.test(trimmed)) {
      setDetectedPlatform('youtube');
      const match = trimmed.match(/(?:youtube\.com\/(?:@|channel\/|c\/)|youtu\.be\/)([a-zA-Z0-9_.-]+)/i);
      setParsedIdentifier(match ? `@${match[1]}` : 'YouTube Channel');
    } else {
      setDetectedPlatform(null);
      setParsedIdentifier('');
      setStep('input');
    }
  };

  const handleStartAuthorize = () => {
    if (!detectedPlatform) return;
    setStep('authorize');
  };

  const handleSimulateVerification = async () => {
    setStep('verifying');
    setVerificationProgress('Sending handshake ping to platform connector...');

    await new Promise((r) => setTimeout(r, 900));
    setVerificationProgress('Verifying bot presence in channel membership list...');

    await new Promise((r) => setTimeout(r, 900));
    setVerificationProgress('Validating moderator permissions and read scopes...');

    await new Promise((r) => setTimeout(r, 800));
    setVerificationProgress('Channel verified successfully!');

    // Add source to system
    const displayName = parsedIdentifier.startsWith('@')
      ? parsedIdentifier
      : parsedIdentifier.replace(/_/g, ' ').replace(/-/g, ' ');
    await onAddSource(urlInput, detectedPlatform!, displayName);

    setStep('completed');
    setTimeout(() => {
      setUrlInput('');
      setDetectedPlatform(null);
      setParsedIdentifier('');
      setStep('input');
    }, 1500);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to disconnect this community source? No further messages will be scanned.')) {
      setIsDeleting(id);
      await onDeleteSource(id);
      setIsDeleting(null);
    }
  };

  // Group sources by platform
  const groupedSources = {
    telegram: sources.filter((s) => s.platform === 'telegram'),
    discord: sources.filter((s) => s.platform === 'discord'),
    youtube: sources.filter((s) => s.platform === 'youtube'),
  };

  return (
    <div className="space-y-6">
      {/* Institutional Consent Guarantee Banner */}
      <div className="bg-[#F4F5EE] border border-[#D8DABF] rounded-2xl p-5 flex items-start gap-3.5 shadow-subtle">
        <Lock className="w-5 h-5 text-[#939474] shrink-0 mt-0.5" />
        <div className="text-xs text-[#292728] space-y-1">
          <div className="font-bold text-[#434428] text-sm">
            Administrative Consent & Privacy Protocol
          </div>
          <p className="leading-relaxed text-[#6B6860]">
            Vaani operates strictly on an opt-in basis. Channel administrators must authorize the Vaani safety bot with appropriate moderation permissions. No channel is ever monitored without explicit institutional consent.
          </p>
        </div>
      </div>

      {/* Connect New Source Card */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle space-y-5">
        <div>
          <h2 className="text-sm font-bold text-[#292728] flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#434428]" />
            <span>Connect a New Community Channel</span>
          </h2>
          <p className="text-xs text-[#6B6860] mt-0.5">
            Paste a public or managed group invite link from Telegram, Discord, or YouTube.
          </p>
        </div>

        {/* URL Input Form */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <LinkIcon className="w-4 h-4 text-[#939474] absolute left-3.5 top-3" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Paste link: e.g. https://t.me/student_council or https://discord.gg/campus-hub or https://youtube.com/@campus_news"
              className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] placeholder-[#939474]/70 focus:outline-none focus:border-[#434428] focus:bg-white focus:ring-1 focus:ring-[#434428] transition-all"
            />
          </div>
          <button
            onClick={handleStartAuthorize}
            disabled={!detectedPlatform || step !== 'input'}
            className="px-5 py-2.5 bg-[#434428] hover:bg-[#292728] text-[#F1F1EC] text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-2xs shrink-0 cursor-pointer"
          >
            <span>Proceed to Authorization</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step 1: Preview Card for Detected Platform */}
        {detectedPlatform && step === 'input' && (
          <div className="p-4 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#D0C7B3] flex items-center justify-center shadow-2xs">
                <PlatformIcon platform={detectedPlatform} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B6860] tracking-wider">
                  Recognized Platform
                </span>
                <div className="font-bold text-[#292728] capitalize">
                  {detectedPlatform}: <span className="font-mono text-[#434428]">{parsedIdentifier}</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#434428] bg-[#939474]/15 px-3 py-1 rounded-full border border-[#939474]/40">
              Ready for Setup
            </span>
          </div>
        )}

        {/* Step 2: Platform-Specific Authorization Step */}
        {step === 'authorize' && detectedPlatform && (
          <div className="p-5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#D0C7B3]/70 pb-3">
              <div className="font-bold text-[#292728] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#434428]" />
                <span>Step 2: Platform Authorization</span>
              </div>
              <span className="text-[11px] text-[#6B6860] font-mono">
                Source: {parsedIdentifier}
              </span>
            </div>

            {detectedPlatform === 'telegram' && (
              <div className="space-y-2.5 text-[#292728]">
                <p>
                  To enable automated classification on Telegram, invite the official Vaani bot to your group and promote it with message deletion and invite link rights.
                </p>
                <div className="p-3 bg-white border border-[#D0C7B3] rounded-xl font-mono text-[11px] text-[#292728]">
                  Bot Username: <span className="text-[#434428] font-bold">@VaaniSafetyBot</span>
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <a
                    href="https://t.me/VaaniSafetyBot?startgroup=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#229ED9] hover:bg-[#1E88E5] text-white rounded-xl font-semibold shadow-2xs transition-colors"
                  >
                    <span>Add Bot to Telegram Group</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleSimulateVerification}
                    className="px-4 py-2 bg-[#434428] hover:bg-[#292728] text-[#F1F1EC] rounded-xl font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>I Have Added the Bot (Verify Channel)</span>
                  </button>
                </div>
              </div>
            )}

            {detectedPlatform === 'discord' && (
              <div className="space-y-2.5 text-[#292728]">
                <p>
                  Authorize the Vaani Discord Application into your server with OAuth2 bot permissions (View Channels, Read Message History, Moderate Members).
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <a
                    href="https://discord.com/oauth2/authorize?client_id=1234567890&scope=bot&permissions=268435456"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-semibold shadow-2xs transition-colors"
                  >
                    <span>Add Bot to Discord Server</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleSimulateVerification}
                    className="px-4 py-2 bg-[#434428] hover:bg-[#292728] text-[#F1F1EC] rounded-xl font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>Verify Server Integration</span>
                  </button>
                </div>
              </div>
            )}

            {detectedPlatform === 'youtube' && (
              <div className="space-y-2.5 text-[#292728]">
                <p>
                  Connect your YouTube Channel via Google OAuth. Vaani requires read access to comment threads and moderation scope to flag toxic comments.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSimulateVerification}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#B93829] hover:bg-[#9E2E20] text-white rounded-xl font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Sign in with Google OAuth</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-[#6B6860]">
                    Requests scope: youtube.readonly, youtube.force-ssl
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Polling / Verification Progress */}
        {step === 'verifying' && (
          <div className="p-4.5 bg-[#F4F5EE] border border-[#D8DABF] rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#434428]">
              <Loader2 className="w-4 h-4 text-[#434428] animate-spin" />
              <span>Step 3: Polling Connector & Verifying Channel...</span>
            </div>
            <p className="text-[#434428] font-mono text-[11px]">
              {verificationProgress}
            </p>
          </div>
        )}

        {/* Step 4: Completed Banner */}
        {step === 'completed' && (
          <div className="p-4.5 bg-[#F4F5EE] border border-[#D8DABF] rounded-xl text-xs flex items-center gap-2 font-bold text-[#434428]">
            <CheckCircle2 className="w-4 h-4 text-[#434428]" />
            <span>Channel connection verified and activated!</span>
          </div>
        )}
      </div>

      {/* Connected Sources List Grouped by Platform */}
      <div className="space-y-6">
        {(['telegram', 'discord', 'youtube'] as Platform[]).map((platform) => {
          const items = groupedSources[platform];
          return (
            <div key={platform} className="bg-white border border-[#D0C7B3] rounded-2xl shadow-subtle overflow-hidden">
              <div className="px-6 py-4 bg-[#FAF9F6] border-b border-[#D0C7B3]/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={platform} showLabel />
                  <span className="text-xs text-[#6B6860]">({items.length} connected)</span>
                </div>
                <span className="text-xs text-[#6B6860] font-medium">
                  {platform === 'telegram' && 'Webhook Polling: 30s'}
                  {platform === 'discord' && 'Gateway Websocket: Live'}
                  {platform === 'youtube' && 'commentThreads API: 60s'}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B6860]">
                  No {platform} channels currently connected.
                </div>
              ) : (
                <div className="divide-y divide-[#D0C7B3]/40">
                  {items.map((src) => (
                    <div key={src.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#292728] text-sm">
                            {src.channel_name}
                          </span>
                          <StatusBadge status={src.status} />
                        </div>
                        <div className="text-[#6B6860] font-mono text-[11px] truncate max-w-lg">
                          {src.url}
                        </div>
                        {src.permission_hint && (
                          <div className="p-2.5 bg-[#FDF2F0] border border-[#F5CAC4] rounded-xl text-[#B93829] text-[11px] mt-1.5 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-[#B93829] shrink-0 mt-0.5" />
                            <span>{src.permission_hint}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0 sm:self-center">
                        <div className="text-right">
                          <div className="font-bold text-[#292728] tabular-nums">
                            {src.flags_count} flags
                          </div>
                          <div className="text-[11px] text-[#6B6860]">
                            Connected {new Date(src.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(src.id)}
                          disabled={isDeleting === src.id}
                          className="p-2 rounded-xl border border-[#D0C7B3] text-[#6B6860] hover:text-[#B93829] hover:border-[#F5CAC4] hover:bg-[#FDF2F0] transition-colors cursor-pointer"
                          title="Disconnect channel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
