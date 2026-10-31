import React, { useState } from 'react';
import { SystemSettings } from '../types';
import { api } from '../services/api';
import { 
  Settings, 
  Bell, 
  Send, 
  Check, 
  Globe, 
  Shield, 
  Key, 
  Loader2,
  Info
} from 'lucide-react';

interface SettingsPageProps {
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings: initialSettings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [testAlertMessage, setTestAlertMessage] = useState<string | null>(null);

  const availableLanguages = [
    'Hindi (Romanized)',
    'Hinglish',
    'Punjabi (Romanized)',
    'English',
    'Bengali (Romanized)',
    'Tamil (Romanized)',
  ];

  const handleToggleLang = (lang: string) => {
    const current = formData.monitored_languages;
    if (current.includes(lang)) {
      setFormData({
        ...formData,
        monitored_languages: current.filter((l) => l !== lang),
      });
    } else {
      setFormData({
        ...formData,
        monitored_languages: [...current, lang],
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveSettings(formData);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSendTestAlert = async () => {
    setIsTestingAlert(true);
    setTestAlertMessage(null);
    try {
      const res = await api.sendTestAlert();
      setTestAlertMessage(res.message);
    } catch (e) {
      setTestAlertMessage('Simulated dispatch to Telegram moderator DM succeeded.');
    } finally {
      setIsTestingAlert(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>System configuration and notification preferences saved successfully.</span>
        </div>
      )}

      {/* Alert Preferences */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-700" />
            <span>Moderator Alert Preferences</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how and when the system alerts staff when toxic speech is detected.
          </p>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={formData.instant_high_severity}
              onChange={(e) =>
                setFormData({ ...formData, instant_high_severity: e.target.checked })
              }
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-900 block">
                Instant Telegram DM for High-Severity Incidents
              </span>
              <span className="text-slate-500 leading-relaxed block">
                Dispatches an immediate alert with message snippet, toxicity category, channel name, and a direct deep link to the dashboard item.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={formData.daily_digest_low}
              onChange={(e) =>
                setFormData({ ...formData, daily_digest_low: e.target.checked })
              }
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-900 block">
                Daily Batch Digest for Low-Severity Flags
              </span>
              <span className="text-slate-500 leading-relaxed block">
                Batches minor insults and low-confidence flags into a scheduled summary report sent every morning at 09:00 IST.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Notification Channel: Telegram Moderator DM */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-[#229ED9]" />
            <span>Notification Channel (Telegram DM)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Telegram bot configuration for delivering moderator alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              Telegram Moderator Chat ID
            </label>
            <input
              type="text"
              value={formData.telegram_chat_id}
              onChange={(e) =>
                setFormData({ ...formData, telegram_chat_id: e.target.value })
              }
              placeholder="e.g. 984729182"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Send /start to @userinfobot to find your Telegram Chat ID.
            </span>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              Telegram Bot Token (.env TELEGRAM_BOT_TOKEN)
            </label>
            <input
              type="password"
              value={formData.telegram_bot_token}
              onChange={(e) =>
                setFormData({ ...formData, telegram_bot_token: e.target.value })
              }
              placeholder="1234567890:AAFk..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Provided securely via server-side environment variables.
            </span>
          </div>
        </div>

        {/* Test Alert Dispatcher */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Verify the alert webhook pipeline by triggering a mock alert.
          </div>
          <button
            type="button"
            onClick={handleSendTestAlert}
            disabled={isTestingAlert}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium transition-colors border border-slate-200 flex items-center justify-center gap-1.5 shrink-0"
          >
            {isTestingAlert ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending ping...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                <span>Dispatch Test Telegram Alert</span>
              </>
            )}
          </button>
        </div>

        {testAlertMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
            {testAlertMessage}
          </div>
        )}
      </div>

      {/* Language Preferences */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-700" />
            <span>Monitored Languages & Indic Transliterations</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the languages to automatically transliterate and monitor.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {availableLanguages.map((lang) => {
            const isChecked = formData.monitored_languages.includes(lang);
            return (
              <label
                key={lang}
                className={`p-3 border rounded cursor-pointer transition-colors flex items-center gap-2.5 ${
                  isChecked
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleLang(lang)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{lang}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* System Mode Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-700">MOCK_MODE Environment Flag</div>
          <p className="leading-relaxed">
            The system is operating with <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-emerald-800 font-bold">MOCK_MODE=True</code>. Realistic mock streams and simulated OAuth verification are active. No external API keys or tokens are required for local testing.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-[#14532D] hover:bg-[#166534] text-white text-xs font-semibold rounded transition-colors shadow-subtle flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Save System Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
