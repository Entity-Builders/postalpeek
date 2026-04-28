import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { useLang, t } from '../../../../utils/i18n';

interface GlobeZoomControlsProps {
  onZoom: (direction: 'in' | 'out') => void;
}

export function GlobeZoomControls({ onZoom }: GlobeZoomControlsProps) {
  const lang = useLang();
  
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <div className="bg-stone-900/60 backdrop-blur-md border border-white/10 rounded-full p-1 flex flex-col pointer-events-auto shadow-2xl">
        <button 
          onClick={() => onZoom('in')}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title={t({ es: 'Acercar', en: 'Zoom In' }, lang)}
        >
          <Plus size={20} />
        </button>
        <div className="w-full h-px bg-white/10 my-1"></div>
        <button 
          onClick={() => onZoom('out')}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title={t({ es: 'Alejar', en: 'Zoom Out' }, lang)}
        >
          <Minus size={20} />
        </button>
      </div>
    </div>
  );
}
