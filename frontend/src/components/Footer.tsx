import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[#D0C7B3]/70 bg-white/70 py-4 px-8 text-xs text-[#6B6860]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#434428] shrink-0" />
          <span className="font-bold text-[#292728]">Vaani Institutional Privacy Guarantee:</span>
          <span>
            Only flagged content is stored. Only moderators of connected channels can view it, and the system recommends actions but a human always decides.
          </span>
        </div>
        <div className="flex items-center gap-4 text-[#6B6860] shrink-0">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#434428]">
            <Info className="w-3.5 h-3.5 text-[#939474]" />
            <span>MOCK_MODE Active</span>
          </span>
          <span className="text-[#D0C7B3]">•</span>
          <span>v1.0.4</span>
        </div>
      </div>
    </footer>
  );
};
