import React from 'react';
import { Platform } from '../types';
import { MessageSquare, Video, Send } from 'lucide-react';

interface PlatformIconProps {
  platform: Platform;
  className?: string;
  showLabel?: boolean;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ 
  platform, 
  className = "w-4 h-4", 
  showLabel = false 
}) => {
  const getIcon = () => {
    switch (platform) {
      case 'telegram':
        return <Send className={`${className} text-[#229ED9]`} />;
      case 'discord':
        return <MessageSquare className={`${className} text-[#5865F2]`} />;
      case 'youtube':
        return <Video className={`${className} text-[#FF0000]`} />;
    }
  };

  const getLabel = () => {
    switch (platform) {
      case 'telegram':
        return 'Telegram';
      case 'discord':
        return 'Discord';
      case 'youtube':
        return 'YouTube';
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-xs text-slate-700">
      {getIcon()}
      {showLabel && <span>{getLabel()}</span>}
    </span>
  );
};
