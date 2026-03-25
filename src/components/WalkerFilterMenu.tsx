import React, { useRef, useState, useCallback } from 'react';
import { MapPin, Gem, Library, Search, X, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';

interface WalkerFilterMenuProps {
  isIdle?: boolean;
  availableCountries: string[];
  unlockedCountries: Set<string>;
  selectedCountry: string | null;
  onSelectCountry: (country: string | null) => void;
  isLoggedIn: boolean;
  onToggleCollection?: () => void;
  onOpenAlbumsModal: () => void;
  spotlightQuery?: string;
  isSpotlightSearching?: boolean;
  onSpotlightSearch?: (query: string) => void;
  onSpotlightDismiss?: () => void;
}

export function WalkerFilterMenu({
  isIdle,
  availableCountries,
  // unlockedCountries not destructured — restriction temporarily removed for MVP
  selectedCountry,
  onSelectCountry,
  isLoggedIn,
  onToggleCollection,
  onOpenAlbumsModal,
  spotlightQuery = '',
  isSpotlightSearching = false,
  onSpotlightSearch,
  onSpotlightDismiss,
}: WalkerFilterMenuProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [localQuery, setLocalQuery] = useState(spotlightQuery);
  React.useEffect(() => {
    setLocalQuery(spotlightQuery);
  }, [spotlightQuery]);

  const handleSearch = useCallback(() => {
    if (localQuery.trim() && onSpotlightSearch) {
      onSpotlightSearch(localQuery.trim());
    }
  }, [localQuery, onSpotlightSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape' && onSpotlightDismiss) {
      setLocalQuery('');
      onSpotlightDismiss();
    }
  };

  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Drag-to-scroll handlers for the horizontal menu on desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDraggingMenu(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseUp = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMenu || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div
      className={cn(
        'absolute top-3 left-0 right-0 z-50 px-4 md:px-8 transition-opacity duration-1000',
        isIdle ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div
        ref={scrollContainerRef}
        className='flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 cursor-grab active:cursor-grabbing w-full max-w-5xl mx-auto'
        style={{ WebkitOverflowScrolling: 'touch' }}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        
        {/* Country Selector */}
        <div className='relative shrink-0'>
          <select
            value={selectedCountry || ''}
            onChange={(e) => {
              onSelectCountry(e.target.value || null);
            }}
            className='h-full bg-black/40 text-stone-100 backdrop-blur-md rounded-full pl-4 pr-8 py-2.5 text-sm border border-white/15 focus:outline-none focus:ring-2 focus:ring-purple-400/60 appearance-none shadow-lg font-medium cursor-pointer'
          >
            <option value=''>Global</option>
            {availableCountries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          <MapPin className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none' />
        </div>

        {/* Search Input */}
        <div className='relative flex-1 min-w-[200px] md:min-w-[280px] shrink-0 md:shrink'>
          <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400' />
          <input
            type='text'
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Buscar postales. Ej: "gatos en tokio", "lluvia"'
            className='w-full h-full bg-black/40 backdrop-blur-md rounded-full border border-white/15 pl-10 pr-[72px] py-2.5 text-sm
              text-stone-100 placeholder:text-stone-400
              focus:outline-none focus:ring-2 focus:ring-purple-400/60
              focus:border-transparent transition-all shadow-lg'
          />
          {localQuery && (
            <button
              onClick={() => {
                setLocalQuery('');
                onSpotlightDismiss?.();
              }}
              className='absolute right-14 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-stone-400 transition-colors'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          )}

          <button
            onClick={handleSearch}
            disabled={isSpotlightSearching || !localQuery.trim()}
            className='absolute right-1 top-1 bottom-1 px-4 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg hover:bg-purple-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed z-10'
          >
            {isSpotlightSearching ? (
               <Sparkles className='w-4 h-4 animate-spin' />
            ) : (
              <span className='font-bold text-sm'>Ir</span>
            )}
          </button>
        </div>

        <button
          onClick={onOpenAlbumsModal}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap shrink-0 px-3 py-1.5 md:px-4 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all backdrop-blur-md border cursor-pointer',
            'bg-indigo-600/90 text-white border-indigo-400 shadow-lg hover:bg-indigo-500/90'
          )}
        >
          <Library className="w-3 h-3 md:w-3.5 md:h-3.5" />
          Álbumes
        </button>

        {isLoggedIn && onToggleCollection && (
          <button
            onClick={onToggleCollection}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap shrink-0 px-3 py-1.5 md:px-4 md:py-2.5 rounded-full text-xs md:text-sm font-medium transition-all backdrop-blur-md border cursor-pointer',
              'bg-black/30 text-white/70 border-white/10 hover:bg-amber-500/80 hover:text-white hover:border-amber-400',
            )}
          >
            <Gem className='w-3 h-3 md:w-3.5 md:h-3.5' />
            Mi Colección
          </button>
        )}
      </div>
    </div>
  );
}
