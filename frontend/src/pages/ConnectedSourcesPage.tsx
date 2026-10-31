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
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 flex items-start gap-3 shadow-subtle">
        <Lock className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 space-y-1">
          <div className="font-semibold text-emerald-900">
            Administrative Consent & Privacy Protocol
          </div>
          <p className="leading-relaxed text-emerald-800">
            Vaani operates strictly on an opt-in basis. Channel administrators must authorize the Vaani safety bot with appropriate moderation permissions. No channel is ever monitored without explicit institutional consent.
          </p>
        </div>
      </div>

      {/* Connect New Source Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-700" />
            <span>Connect a New Community Channel</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Paste a public or managed group invite link from Telegram, Discord, or YouTube.
          </p>
        </div>

        {/* URL Input Form */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Paste link: e.g. https://t.me/student_council or https://discord.gg/campus-hub or https://youtube.com/@campus_news"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>
          <button
            onClick={handleStartAuthorize}
            disabled={!detectedPlatform || step !== 'input'}
            className="px-4 py-2 bg-[#14532D] hover:bg-[#166534] text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 shadow-subtle shrink-0"
          >
            <span>Proceed to Authorization</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step 1: Preview Card for Detected Platform */}
        {detectedPlatform && step === 'input' && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center">
                <PlatformIcon platform={detectedPlatform} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Recognized Platform
                </span>
                <div className="font-semibold text-slate-800 capitalize">
                  {detectedPlatform}: <span className="font-mono text-emerald-800">{parsedIdentifier}</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Ready for Setup
            </span>
          </div>
        )}

        {/* Step 2: Platform-Specific Authorization Step */}
        {step === 'authorize' && detectedPlatform && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="font-semibold text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-700" />
                <span>Step 2: Platform Authorization</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Source: {parsedIdentifier}
              </span>
            </div>

            {detectedPlatform === 'telegram' && (
              <div className="space-y-2 text-slate-700">
                <p>
                  To enable automated classification on Telegram, invite the official Vaani bot to your group and promote it with message deletion and invite link rights.
                </p>
                <div className="p-3 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-600">
                  Bot Username: <span className="text-emerald-700 font-bold">@VaaniSafetyBot</span>
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <a
                    href="https://t.me/VaaniSafetyBot?startgroup=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#229ED9] hover:bg-[#1E88E5] text-white rounded font-medium shadow-subtle transition-colors"
                  >
                    <span>Add Bot to Telegram Group</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleSimulateVerification}
                    className="px-3 py-1.5 bg-[#14532D] hover:bg-[#166534] text-white rounded font-medium transition-colors"
                  >
                    <span>I Have Added the Bot (Verify Channel)</span>
                  </button>
                </div>
              </div>
            )}

            {detectedPlatform === 'discord' && (
              <div className="space-y-2 text-slate-700">
                <p>
                  Authorize the Vaani Discord Application into your server with OAuth2 bot permissions (View Channels, Read Message History, Moderate Members).
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <a
                    href="https://discord.com/oauth2/authorize?client_id=1234567890&scope=bot&permissions=268435456"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded font-medium shadow-subtle transition-colors"
                  >
                    <span>Add Bot to Discord Server</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleSimulateVerification}
                    className="px-3 py-1.5 bg-[#14532D] hover:bg-[#166534] text-white rounded font-medium transition-colors"
                  >
                    <span>Verify Server Integration</span>
                  </button>
                </div>
              </div>
            )}

            {detectedPlatform === 'youtube' && (
              <div className="space-y-2 text-slate-700">
                <p>
                  Connect your YouTube Channel via Google OAuth. Vaani requires read access to comment threads and moderation scope to flag toxic comments.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSimulateVerification}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium shadow-subtle transition-colors"
                  >
                    <span>Sign in with Google OAuth</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Requests scope: youtube.readonly, youtube.force-ssl
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Polling / Verification Progress */}
        {step === 'verifying' && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <Loader2 className="w-4 h-4 text-emerald-700 animate-spin" />
              <span>Step 3: Polling Connector & Verifying Channel...</span>
            </div>
            <p className="text-emerald-800 font-mono text-[11px]">
              {verificationProgress}
            </p>
          </div>
        )}

        {/* Step 4: Completed Banner */}
        {step === 'completed' && (
          <div className="p-4 bg-emerald-100 border border-emerald-300 rounded text-xs flex items-center gap-2 font-semibold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Channel connection verified and activated!</span>
          </div>
        )}
      </div>

      {/* Connected Sources List Grouped by Platform */}
      <div className="space-y-6">
        {(['telegram', 'discord', 'youtube'] as Platform[]).map((platform) => {
          const items = groupedSources[platform];
          return (
            <div key={platform} className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={platform} showLabel />
                  <span className="text-xs text-slate-400">({items.length} connected)</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {platform === 'telegram' && 'Webhook Polling: 30s'}
                  {platform === 'discord' && 'Gateway Websocket: Live'}
                  {platform === 'youtube' && 'commentThreads API: 60s'}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No {platform} channels currently connected.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((src) => (
                    <div key={src.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {src.channel_name}
                          </span>
                          <StatusBadge status={src.status} />
                        </div>
                        <div className="text-slate-500 font-mono text-[11px] truncate max-w-lg">
                          {src.url}
                        </div>
                        {src.permission_hint && (
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px] mt-1 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.2" />
                            <span>{src.permission_hint}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0 sm:self-center">
                        <div className="text-right">
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {src.flags_count} flags
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Connected {new Date(src.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(src.id)}
                          disabled={isDeleting === src.id}
                          className="p-1.5 rounded border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
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
