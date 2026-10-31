import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/70 py-3.5 px-6 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-medium text-slate-700">Vaani Institutional Privacy Guarantee:</span>
          <span>
            Only flagged content is stored. Only moderators of connected channels can view it, and the system recommends actions but a human always decides.
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 shrink-0">
          <span className="inline-flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>MOCK_MODE Active</span>
          </span>
          <span>•</span>
          <span>v1.0.4</span>
        </div>
      </div>
    </footer>
  );
};
