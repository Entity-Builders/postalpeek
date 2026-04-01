import React from 'react';

// ── The PostalPeek Postmark (matches WalkerWelcome intro) ───────────
export function PostalPeekStampSVG({ className, rarity = 'common' }: { className?: string, rarity?: 'common' | 'rare' | 'epic' | 'legendary' }) {
  const getColors = () => {
    switch (rarity) {
      case 'legendary': return { base: 'text-[#ef4444]', stroke: '#b91c1c' }; // Red base for legendary 
      case 'epic': return { base: 'text-[#10b981]', stroke: '#047857' }; // Green base for epic
      case 'rare': return { base: 'text-[#3b82f6]', stroke: '#1d4ed8' }; // Blue base for rare
      case 'common': 
      default: return { base: 'text-gray-500', stroke: 'currentColor' };
    }
  };
  const colors = getColors();
  
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className} ${colors.base}`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer solid border */}
      <circle cx="50" cy="50" r="46" stroke={colors.stroke} strokeWidth="6" opacity="0.6" />
      
      {/* Inner dashed border */}
      <circle cx="50" cy="50" r="38" stroke={colors.stroke} strokeWidth="3" strokeDasharray="6 4" opacity="0.5" />
      
      {/* Background fill */}
      <circle cx="50" cy="50" r="38" fill="currentColor" opacity="0.1" />
      
      {/* Text: Postal Peek */}
      <text 
        x="50" 
        y="46" 
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" 
        fontSize="17" 
        fontWeight="bold" 
        fill="currentColor" 
        textAnchor="middle" 
        opacity="0.85"
        letterSpacing="2"
      >
        POSTAL
      </text>
      <text 
        x="50" 
        y="68" 
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" 
        fontSize="17" 
        fontWeight="bold" 
        fill="currentColor" 
        textAnchor="middle" 
        opacity="0.85"
        letterSpacing="2"
      >
        PEEK
      </text>
    </svg>
  );
}
