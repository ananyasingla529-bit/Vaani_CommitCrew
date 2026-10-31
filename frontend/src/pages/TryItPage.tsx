import React, { useState } from 'react';
import { ClassificationResult } from '../types';
import { api } from '../services/api';
import {
  Terminal,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Code2
} from 'lucide-react';
import { SeverityBadge } from '../components/SeverityBadge';

export const TryItPage: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [targetUserInput, setTargetUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);

  const samplePresets = [
    {
      label: 'Direct Physical Threat (Hindi)',
      text: 'college aake dikha kal, tera vo haal karunga ki hospital me admit hona padega. m@r daloonga tujhe.',
      target: '@priya_sharma_du'
    },
    {
      label: 'Obfuscated Slur (Hinglish)',
      text: 'chup kar bsdk teri aukaat nahi hai voice channel pe aane ki. bhag ja yaha se k*tte.',
      target: ''
    },
    {
      label: 'False Positive Metaphor (Hindi)',
      text: 'bhai tu to aag laga di stage pe! kya performance thi maza aa gaya yaar bilkul faad diya!',
      target: ''
    },
    {
      label: 'Romanized Punjabi Threat',
      text: 'tu mil mainu Chandigarh ch, teri lattan bhan dunga kanj*r. bada chaud banna phirda.',
      target: '@arjun_v98'
    },
    {
      label: 'Sexual Extortion (English)',
      text: 'send me your private pics on snapchat or I will leak your phone number on this group @priya_sharma_du.',
      target: '@priya_sharma_du'
    },
    {
      label: 'Benign Unix Command',
      text: 'Just run pkill -9 to kill the rogue process immediately and restart.',
      target: ''
    }
  ];

  const handleClassify = async (textToClassify?: string, target?: string) => {
    const text = textToClassify !== undefined ? textToClassify : inputText;
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const res = await api.classify(text);
      if (target !== undefined && target.trim()) {
        res.target_user = target;
      }
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = (preset: { label: string; text: string; target: string }) => {
    setInputText(preset.text);
    setTargetUserInput(preset.target);
    handleClassify(preset.text, preset.target);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Intro Box */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle">
        <h2 className="text-base font-bold text-[#292728] flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#434428]" />
          <span>Interactive Classification Sandbox</span>
        </h2>
        <p className="text-xs text-[#6B6860] mt-1 leading-relaxed">
          Evaluate Romanized Hindi, Hinglish, Punjabi, and English text against the Vaani classification engine. Test phonetic spelling normalizations, obfuscated slurs, and false-positive handling.
        </p>

        {/* Preset Chips */}
        <div className="mt-4 pt-3.5 border-t border-[#D0C7B3]/40">
          <div className="text-[11px] font-bold text-[#292728] uppercase tracking-wider mb-2.5">
            Try a Preset Example:
          </div>
          <div className="flex flex-wrap gap-2">
            {samplePresets.map((preset, i) => (
              <button
                key={i}
                onClick={() => handleApplyPreset(preset)}
                className="text-xs px-3 py-1.5 rounded-xl border border-[#D0C7B3] bg-[#FAF9F6] hover:bg-[#F1F1EC] hover:border-[#434428] text-[#292728] transition-all font-medium text-left cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Box */}
      <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#292728] uppercase tracking-wider mb-2">
            Sentence or Message to Evaluate
          </label>
          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type any message in Hindi (e.g. 'tu bilkul bekar hai'), Hinglish, Punjabi (e.g. 'tainu kiven pata'), or English..."
            className="w-full p-3.5 text-sm bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] placeholder-[#939474]/70 focus:outline-none focus:border-[#434428] focus:bg-white focus:ring-1 focus:ring-[#434428] resize-none transition-all"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={targetUserInput}
              onChange={(e) => setTargetUserInput(e.target.value)}
              placeholder="Target handle (optional e.g. @user)"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] placeholder-[#939474]/70 focus:outline-none focus:border-[#434428]"
            />
          </div>

          <button
            onClick={() => handleClassify()}
            disabled={isLoading || !inputText.trim()}
            className="px-6 py-2.5 bg-[#434428] hover:bg-[#292728] text-[#F1F1EC] text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Classifying...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Run POST /classify</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Classification Result Card */}
      {result && (
        <div className="bg-white border border-[#D0C7B3] rounded-2xl p-6 shadow-subtle space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#D0C7B3]/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B6860]">
                Classification Result:
              </span>
              {result.flagged ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FDF2F0] text-[#B93829] border border-[#F5CAC4]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B93829]" />
                  FLAGGED AS HARMFUL
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#F4F5EE] text-[#434428] border border-[#D8DABF]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#434428]" />
                  BENIGN / PASSES MODERATION
                </span>
              )}
            </div>
            <div className="text-xs text-[#6B6860] font-mono">
              Confidence: {(result.confidence * 100).toFixed(1)}%
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[#6B6860] block mb-1">
                Detected Severity
              </span>
              <SeverityBadge severity={result.severity} />
            </div>

            <div className="p-3.5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[#6B6860] block mb-1">
                Toxicity Category
              </span>
              <span className="font-bold text-[#292728]">{result.category}</span>
            </div>

            <div className="p-3.5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[#6B6860] block mb-1">
                Detected Language
              </span>
              <span className="font-bold text-[#292728]">{result.language}</span>
            </div>
          </div>

          {/* Transliterated / Normalized Text */}
          <div className="space-y-1.5 text-xs">
            <span className="font-bold text-[#292728] uppercase tracking-wider">
              Transliterated / Phonetically Normalized Form:
            </span>
            <div className="p-3.5 bg-[#F4F5EE] border border-[#D8DABF] rounded-xl font-mono text-[#434428] text-xs">
              {result.normalized_text}
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1.5 text-xs">
            <span className="font-bold text-[#292728] uppercase tracking-wider">
              Classifier Rationale:
            </span>
            <div className="p-3.5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-[#292728] leading-relaxed">
              {result.explanation}
            </div>
          </div>

          {/* Backend Integration Note */}
          <div className="p-3.5 bg-[#FAF9F6] border border-[#D0C7B3] rounded-xl text-xs text-[#6B6860] flex items-start gap-2.5">
            <Code2 className="w-4 h-4 text-[#434428] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#292728]">Model Hook:</span>
              <span className="font-mono text-[11px] ml-1">backend/services/classifier.py {'->'} classify_with_external_model()</span>
              <p className="mt-0.5 text-[11px]">
                In production, this endpoint invokes your fine-tuned transformer or LLM inference service. In mock mode, it uses phonetic lexical normalization.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
