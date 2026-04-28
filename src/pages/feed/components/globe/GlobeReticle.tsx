import React from 'react';

export function GlobeReticle() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 opacity-70">
      <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-white/40 rounded-full flex items-center justify-center relative">
        <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
        {/* Tick marks */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1 w-0.5 h-2 bg-white/40"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-[-4px] w-0.5 h-2 bg-white/40"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 h-0.5 w-2 bg-white/40"></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 mr-[-4px] h-0.5 w-2 bg-white/40"></div>
      </div>
    </div>
  );
}
