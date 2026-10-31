import React, { useState } from 'react';
import { ClassificationResult } from '../types';
import { api } from '../services/api';
import { 
  Terminal, 
  Send, 
  Loader2, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
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
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-700" />
          <span>Interactive Classification Sandbox</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Evaluate Romanized Hindi, Hinglish, Punjabi, and English text against the Vaani classification engine. Test phonetic spelling normalizations, obfuscated slurs, and false-positive handling.
        </p>

        {/* Preset Chips */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Try a Preset Example:
          </div>
          <div className="flex flex-wrap gap-2">
            {samplePresets.map((preset, i) => (
              <button
                key={i}
                onClick={() => handleApplyPreset(preset)}
                className="text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900 text-slate-700 transition-colors font-medium text-left"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Box */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            Sentence or Message to Evaluate
          </label>
          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type any message in Hindi (e.g. 'tu bilkul bekar hai'), Hinglish, Punjabi (e.g. 'tainu kiven pata'), or English..."
            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white resize-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={targetUserInput}
              onChange={(e) => setTargetUserInput(e.target.value)}
              placeholder="Target handle (optional e.g. @user)"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            onClick={() => handleClassify()}
            disabled={isLoading || !inputText.trim()}
            className="px-5 py-2 bg-[#14532D] hover:bg-[#166534] text-white text-xs font-medium rounded transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
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
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Classification Result:
              </span>
              {result.flagged ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  FLAGGED AS HARMFUL
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  BENIGN / PASSES MODERATION
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Confidence: {(result.confidence * 100).toFixed(1)}%
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Detected Severity
              </span>
              <SeverityBadge severity={result.severity} />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Toxicity Category
              </span>
              <span className="font-semibold text-slate-800">{result.category}</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Detected Language
              </span>
              <span className="font-semibold text-slate-800">{result.language}</span>
            </div>
          </div>

          {/* Transliterated / Normalized Text */}
          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-slate-700 uppercase tracking-wide">
              Transliterated / Phonetically Normalized Form:
            </span>
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded font-mono text-slate-800 text-xs">
              {result.normalized_text}
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-slate-700 uppercase tracking-wide">
              Classifier Rationale:
            </span>
            <div className="p-3 bg-white border border-slate-200 rounded text-slate-700 leading-relaxed">
              {result.explanation}
            </div>
          </div>

          {/* Backend Integration Note */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 flex items-start gap-2">
            <Code2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700">Model Hook:</span>
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
