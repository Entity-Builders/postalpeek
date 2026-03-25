import React, { useRef, useState, useCallback } from 'react';
import { Globe, Search, X, Sparkles, ChevronDown, Gem } from 'lucide-react';
import { cn } from '../utils/cn';
import { useLang, t } from '../utils/i18n';

/* ── Country → flag emoji helper ── */
const COUNTRY_FLAGS: Record<string, string> = {
  Argentina: '🇦🇷', France: '🇫🇷', Japan: '🇯🇵', Spain: '🇪🇸',
  Italy: '🇮🇹', Germany: '🇩🇪', Brazil: '🇧🇷', Mexico: '🇲🇽',
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', China: '🇨🇳',
  India: '🇮🇳', Australia: '🇦🇺', Canada: '🇨🇦', Chile: '🇨🇱',
  Colombia: '🇨🇴', Peru: '🇵🇪', Uruguay: '🇺🇾', Portugal: '🇵🇹',
  Netherlands: '🇳🇱', Belgium: '🇧🇪', Switzerland: '🇨🇭',
  Austria: '🇦🇹', Sweden: '🇸🇪', Norway: '🇳🇴', Denmark: '🇩🇰',
  Finland: '🇫🇮', Ireland: '🇮🇪', Greece: '🇬🇷', Turkey: '🇹🇷',
  'South Korea': '🇰🇷', Thailand: '🇹🇭', Vietnam: '🇻🇳',
  Indonesia: '🇮🇩', Philippines: '🇵🇭', Malaysia: '🇲🇾',
  Singapore: '🇸🇬', 'New Zealand': '🇳🇿', Egypt: '🇪🇬',
  Morocco: '🇲🇦', 'South Africa': '🇿🇦', Kenya: '🇰🇪',
  Nigeria: '🇳🇬', Israel: '🇮🇱', 'Czech Republic': '🇨🇿',
  Poland: '🇵🇱', Romania: '🇷🇴', Hungary: '🇭🇺', Croatia: '🇭🇷',
  Cuba: '🇨🇺', 'Costa Rica': '🇨🇷', Panama: '🇵🇦',
  Ecuador: '🇪🇨', Bolivia: '🇧🇴', Paraguay: '🇵🇾',
  Venezuela: '🇻🇪', 'Dominican Republic': '🇩🇴',
  Russia: '🇷🇺', Ukraine: '🇺🇦', Taiwan: '🇹🇼',
};

function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🏳️';
}

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
  selectedCountry,
  onSelectCountry,
  isLoggedIn,
  onToggleCollection,
  spotlightQuery = '',
  isSpotlightSearching = false,
  onSpotlightSearch,
  onSpotlightDismiss,
}: WalkerFilterMenuProps) {
  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

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

  return (
    <div
      className={cn(
        'absolute top-3 left-0 right-0 z-50 px-3 md:px-8 transition-opacity duration-1000',
        isIdle ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div
        ref={containerRef}
        className='flex items-center gap-2 w-full max-w-5xl mx-auto'
      >
        {/* ── Unified Search Bar with inline country chip ── */}
        <div className={cn(
          'relative flex-1 min-w-0 flex items-center bg-black/40 backdrop-blur-md rounded-full border shadow-lg overflow-hidden transition-all duration-300',
          isFocused ? 'border-purple-400/60 ring-2 ring-purple-400/30' : 'border-white/15',
        )}>

          {/* Country chip — collapses when input is focused */}
          <div className={cn(
            'relative shrink-0 flex items-center transition-all duration-300 overflow-hidden',
            isFocused ? 'max-w-0 opacity-0' : 'max-w-[60px] opacity-100',
          )}>
            <div className='flex items-center gap-0.5 pl-3 pr-1 py-2.5 cursor-pointer border-r border-white/10'>
              {selectedCountry ? (
                <span className='text-base leading-none'>{getCountryFlag(selectedCountry)}</span>
              ) : (
                <Globe className='w-4 h-4 text-stone-300' />
              )}
              <ChevronDown className='w-3 h-3 text-stone-400' />
            </div>
            {/* Invisible native select overlaying the chip */}
            <select
              value={selectedCountry || ''}
              onChange={(e) => onSelectCountry(e.target.value || null)}
              className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
              aria-label='Select country'
            >
              <option value=''>{t({ es: '🌍 Global', en: '🌍 Global' }, lang)}</option>
              {availableCountries.map((country) => (
                <option key={country} value={country}>
                  {getCountryFlag(country)} {country}
                </option>
              ))}
            </select>
          </div>

          {/* Search input */}
          <Search className={cn(
            'shrink-0 w-4 h-4 text-stone-400 transition-all duration-300',
            isFocused ? 'ml-3 mr-0 opacity-100' : 'ml-0 mr-0 w-0 opacity-0',
          )} />
          <input
            type='text'
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isFocused ? t({ es: 'Ej: "gatos en tokio", "lluvia", "noche"', en: 'Ex: "cats in tokyo", "rain", "night"' }, lang) : t({ es: 'Buscar postales...', en: 'Search postcards...' }, lang)}
            className={cn(
              'flex-1 min-w-0 bg-transparent pr-10 py-2.5 text-sm text-stone-100 placeholder:text-stone-400 focus:outline-none transition-all duration-300',
              isFocused ? 'pl-2' : 'pl-2.5',
            )}
          />

          {/* Clear button */}
          {localQuery && (
            <button
              onClick={() => {
                setLocalQuery('');
                onSpotlightDismiss?.();
              }}
              className='absolute right-11 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-stone-400 transition-colors'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          )}

          {/* Search / AI button */}
          <button
            onClick={handleSearch}
            disabled={isSpotlightSearching || !localQuery.trim()}
            className='absolute right-1 top-1 bottom-1 px-3 rounded-full bg-purple-500 text-white flex items-center justify-center hover:bg-purple-600 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10'
          >
            {isSpotlightSearching ? (
              <Sparkles className='w-4 h-4 animate-spin' />
            ) : (
              <Search className='w-4 h-4' />
            )}
          </button>
        </div>

        {/* Mi Colección — hides when search is focused */}
        {isLoggedIn && onToggleCollection && (
          <button
            onClick={onToggleCollection}
            className={cn(
              'shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 shadow-lg hover:bg-amber-500/80 hover:border-amber-400 transition-all duration-300 cursor-pointer',
              isFocused ? 'w-0 opacity-0 overflow-hidden p-0 border-0' : 'opacity-100',
            )}
            aria-label='Mi Colección'
            tabIndex={isFocused ? -1 : 0}
          >
            <Gem className='w-4 h-4 text-stone-300' />
          </button>
        )}
      </div>
    </div>
  );
}
