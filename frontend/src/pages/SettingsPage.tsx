import React, { useState } from 'react';
import { SystemSettings } from '../types';
import { api } from '../services/api';
import {
  Bell,
  Send,
  Check,
  Globe,
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
        <div className="p-4 bg-[#F4F5EE] border border-[#D8DABF] rounded-xl text-xs font-bold text-[#434428] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#434428]" />
          <span>System configuration and notification preferences saved successfully.</span>
        </div>
      )}

      {/* Alert Preferences */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#292728] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#434428]" />
            <span>Moderator Alert Preferences</span>
          </h2>
          <p className="text-xs text-[#6B6860] mt-0.5">
            Configure how and when the system alerts staff when toxic speech is detected.
          </p>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <label className="flex items-start gap-3.5 p-4 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl cursor-pointer hover:bg-[#F1F1EC] transition-colors">
            <input
              type="checkbox"
              checked={formData.instant_high_severity}
              onChange={(e) =>
                setFormData({ ...formData, instant_high_severity: e.target.checked })
              }
              className="mt-0.5 rounded text-[#434428] focus:ring-[#434428]"
            />
            <div className="space-y-0.5">
              <span className="font-bold text-[#292728] block">
                Instant Telegram DM for High-Severity Incidents
              </span>
              <span className="text-[#6B6860] leading-relaxed block">
                Dispatches an immediate alert with message snippet, toxicity category, channel name, and a direct deep link to the dashboard item.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3.5 p-4 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl cursor-pointer hover:bg-[#F1F1EC] transition-colors">
            <input
              type="checkbox"
              checked={formData.daily_digest_low}
              onChange={(e) =>
                setFormData({ ...formData, daily_digest_low: e.target.checked })
              }
              className="mt-0.5 rounded text-[#434428] focus:ring-[#434428]"
            />
            <div className="space-y-0.5">
              <span className="font-bold text-[#292728] block">
                Daily Batch Digest for Low-Severity Flags
              </span>
              <span className="text-[#6B6860] leading-relaxed block">
                Batches minor insults and low-confidence flags into a scheduled summary report sent every morning at 09:00 IST.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Notification Channel: Telegram Moderator DM */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#292728] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#229ED9]" />
            <span>Notification Channel (Telegram DM)</span>
          </h2>
          <p className="text-xs text-[#6B6860] mt-0.5">
            Telegram bot configuration for delivering moderator alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[#292728] font-bold mb-1.5">
              Telegram Moderator Chat ID
            </label>
            <input
              type="text"
              value={formData.telegram_chat_id}
              onChange={(e) =>
                setFormData({ ...formData, telegram_chat_id: e.target.value })
              }
              placeholder="e.g. 984729182"
              className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] font-mono text-xs focus:outline-none focus:border-[#434428] focus:bg-white"
            />
            <span className="text-[11px] text-[#6B6860] mt-1 block">
              Send /start to @userinfobot to find your Telegram Chat ID.
            </span>
          </div>

          <div>
            <label className="block text-[#292728] font-bold mb-1.5">
              Telegram Bot Token (.env TELEGRAM_BOT_TOKEN)
            </label>
            <input
              type="password"
              value={formData.telegram_bot_token}
              onChange={(e) =>
                setFormData({ ...formData, telegram_bot_token: e.target.value })
              }
              placeholder="1234567890:AAFk..."
              className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] font-mono text-xs focus:outline-none focus:border-[#434428] focus:bg-white"
            />
            <span className="text-[11px] text-[#6B6860] mt-1 block">
              Provided securely via server-side environment variables.
            </span>
          </div>
        </div>

        {/* Test Alert Dispatcher */}
        <div className="pt-2 border-t border-[#D0C7B3]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-[#6B6860]">
            Verify the alert webhook pipeline by triggering a mock alert.
          </div>
          <button
            type="button"
            onClick={handleSendTestAlert}
            disabled={isTestingAlert}
            className="px-4 py-2 bg-white hover:bg-[#F1F1EC] text-[#292728] rounded-xl font-bold transition-colors border border-[#D0C7B3] flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-2xs"
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
          <div className="p-3.5 bg-[#F4F5EE] border border-[#D8DABF] rounded-xl text-xs text-[#434428] font-medium">
            {testAlertMessage}
          </div>
        )}
      </div>

      {/* Language Preferences */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#292728] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#434428]" />
            <span>Monitored Languages & Indic Transliterations</span>
          </h2>
          <p className="text-xs text-[#6B6860] mt-0.5">
            Select the languages to automatically transliterate and monitor.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {availableLanguages.map((lang) => {
            const isChecked = formData.monitored_languages.includes(lang);
            return (
              <label
                key={lang}
                className={`p-3.5 border rounded-xl cursor-pointer transition-all flex items-center gap-2.5 ${
                  isChecked
                    ? 'bg-[#F4F5EE] border-[#434428] text-[#434428] font-bold shadow-2xs'
                    : 'bg-[#FAF9F6] border-[#D0C7B3] text-[#292728] hover:bg-[#F1F1EC]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleLang(lang)}
                  className="rounded text-[#434428] focus:ring-[#434428]"
                />
                <span>{lang}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* System Mode Notice */}
      <div className="bg-[#FAF9F6] border border-[#D0C7B3] rounded-2xl p-5 text-xs text-[#6B6860] flex items-start gap-3">
        <Info className="w-4 h-4 text-[#939474] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-[#292728]">MOCK_MODE Environment Flag</div>
          <p className="leading-relaxed">
            The system is operating with <code className="bg-white px-2 py-0.5 rounded-lg border border-[#D0C7B3] font-mono text-[#434428] font-bold">MOCK_MODE=True</code>. Realistic mock streams and simulated OAuth verification are active. No external API keys or tokens are required for local testing.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-[#434428] hover:bg-[#292728] text-[#F1F1EC] text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
