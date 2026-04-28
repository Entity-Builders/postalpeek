import React from 'react';
import { Link } from 'react-router-dom';
import { Map, Grid3X3 } from 'lucide-react';
import { useLang, t } from '../../../../utils/i18n';

export function GlobeHeader() {
  const lang = useLang();
  
  return (
    <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
      <div className="flex gap-2 p-1 bg-stone-900/60 backdrop-blur-md border border-white/10 rounded-full pointer-events-auto shadow-2xl">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full font-medium text-sm shadow-sm"
        >
          <Map size={16} />
          {t({ es: 'Explorar', en: 'Explorer' }, lang)}
        </Link>
        <Link
          to="/feed"
          className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-full font-medium text-sm transition-all"
        >
          <Grid3X3 size={16} />
          {t({ es: 'Ver Grilla', en: 'Grid Feed' }, lang)}
        </Link>
      </div>
    </div>
  );
}
