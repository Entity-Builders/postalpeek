import React from 'react';

// ── The PostalPeek Postmark (matches WalkerWelcome intro) ───────────
export function PostalPeekStampSVG({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer solid border */}
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="6" opacity="0.6" />
      
      {/* Inner dashed border */}
      <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="3" strokeDasharray="6 4" opacity="0.5" />
      
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
