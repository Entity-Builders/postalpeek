import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Heart, Mic } from 'lucide-react';
import { useLang } from '../utils/i18n';
import type { SearchMode } from '../hooks/useSearchStrategy';

interface CollectionFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: string[];
  onToggleFilter: (filter: string) => void;
  suggestedTags: string[];
  /** Full list of tag display names for typeahead */
  allTagNames?: string[];
  showOnlyFavorites: boolean;
  onToggleFavorites: () => void;
  favoritesCount?: number;
  /** Smart search state */
  isSmartSearching?: boolean;
  smartSearchActive?: boolean;
  /** Current search mode (PostHog flag) */
  searchMode?: SearchMode;
}

// ── Rotating placeholder examples ──────────────────────────────────
const PLACEHOLDER_EXAMPLES_ES = [
  'Buscá por nombre, etiqueta, o preguntame...',
  '"postales de gatos al atardecer"',
  '"arquitectura brutalista en Europa"',
  '"vibes cyberpunk con neon"',
  '"todas las playas tropicales"',
  '"calles de noche con lluvia"',
];

const PLACEHOLDER_EXAMPLES_EN = [
  'Search by name, tag, or ask me...',
  '"sunset postcards with dogs"',
  '"brutalist architecture in Europe"',
  '"cyberpunk vibes with neon"',
  '"all tropical beaches"',
  '"rainy night streets"',
];

// ── Voice recognition hook ─────────────────────────────────────────
function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = document.documentElement.lang === 'es' ? 'es-AR' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}

export function CollectionFilterBar({
  searchQuery,
  onSearchChange,
  activeFilters,
  onToggleFilter,
  suggestedTags,
  allTagNames = [],
  showOnlyFavorites,
  onToggleFavorites,
  favoritesCount = 0,
  isSmartSearching = false,
  smartSearchActive = false,
  searchMode = 'classic',
}: CollectionFilterBarProps) {
  const lang = useLang();
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Rotating placeholders ──────────────────────────────────────
  const examples =
    lang === 'es' ? PLACEHOLDER_EXAMPLES_ES : PLACEHOLDER_EXAMPLES_EN;

  useEffect(() => {
    if (isFocused || activeFilters.length > 0 || searchQuery) return;
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % examples.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isFocused, activeFilters, searchQuery, examples.length]);

  // ── Voice input ────────────────────────────────────────────────
  const { isListening, isSupported: voiceSupported, startListening, stopListening } =
    useVoiceInput(
      useCallback(
        (text: string) => {
          onSearchChange(text);
          inputRef.current?.focus();
        },
        [onSearchChange],
      ),
    );

  // ── Typeahead matches ──────────────────────────────────────────
  const typeaheadMatches = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2 || allTagNames.length === 0) return [];

    return allTagNames
      .filter(
        (tag) =>
          tag.toLowerCase().includes(q) &&
          !activeFilters.some((f) => f.toLowerCase() === tag.toLowerCase()),
      )
      .slice(0, 8);
  }, [searchQuery, allTagNames, activeFilters]);

  const showDropdown = searchMode === 'classic' && isFocused && typeaheadMatches.length > 0 && !isSmartSearching;

  // Close when clicking outside the whole container
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Actions ────────────────────────────────────────────────────
  const addFilter = useCallback(
    (tag: string) => {
      if (!activeFilters.some((f) => f.toLowerCase() === tag.toLowerCase())) {
        onToggleFilter(tag);
      }
      onSearchChange('');
      setSelectedIdx(-1);
      inputRef.current?.focus();
    },
    [activeFilters, onToggleFilter, onSearchChange],
  );

  const removeLastFilter = useCallback(() => {
    if (activeFilters.length > 0) {
      onToggleFilter(activeFilters[activeFilters.length - 1]);
    }
  }, [activeFilters, onToggleFilter]);

  // ── Keyboard ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Backspace on empty input → remove last pill
      if (e.key === 'Backspace' && searchQuery === '' && activeFilters.length > 0) {
        e.preventDefault();
        removeLastFilter();
        return;
      }

      if (!showDropdown) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) =>
          prev < typeaheadMatches.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) =>
          prev > 0 ? prev - 1 : typeaheadMatches.length - 1,
        );
      } else if (e.key === 'Enter' && selectedIdx >= 0) {
        e.preventDefault();
        addFilter(typeaheadMatches[selectedIdx]);
      } else if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    },
    [searchQuery, activeFilters, showDropdown, typeaheadMatches, selectedIdx, addFilter, removeLastFilter],
  );

  const placeholder =
    activeFilters.length > 0 ? '' : examples[placeholderIdx];

  return (
    <div className="px-4 pb-4" ref={containerRef}>
      {/* ── Combined Input with Pills ─────────────────────────── */}
      <div className="relative mb-3">
        <div
          className={`flex flex-wrap items-center gap-1.5 bg-white border rounded-2xl px-3 py-1.5 min-h-[38px] transition-shadow cursor-text ${
            isFocused
              ? 'border-stone-400 ring-1 ring-stone-400 shadow-sm'
              : 'border-stone-200 shadow-sm'
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Search icon / AI thinking animation */}
          {isSmartSearching ? (
            <div className="w-4 h-4 shrink-0 flex items-center justify-center gap-[3px]">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block w-[4px] h-[4px] rounded-full bg-amber-500"
                  style={{
                    animation: `smart-search-dot 1s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
              <style>{`
                @keyframes smart-search-dot {
                  0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
                  40% { transform: scale(1); opacity: 1; }
                }
              `}</style>
            </div>
          ) : smartSearchActive ? (
            <div className="w-4 h-4 shrink-0 flex items-center justify-center">
              <span className="block w-[6px] h-[6px] rounded-full bg-amber-500 animate-ping opacity-75" />
              <span className="block w-[5px] h-[5px] rounded-full bg-amber-500 absolute" />
            </div>
          ) : (
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          )}

          {/* Active filter pills inside the input */}
          {activeFilters.map((filter) => (
            <span
              key={filter}
              className="inline-flex items-center gap-1 bg-stone-800 text-white text-[11px] font-medium pl-2.5 pr-1.5 py-0.5 rounded-full animate-in fade-in zoom-in-95 duration-150"
            >
              {filter}
              <button
                className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFilter(filter);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Text input — grows to fill remaining space */}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setSelectedIdx(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            className="flex-1 min-w-[80px] bg-transparent text-sm text-stone-700 placeholder-stone-400 outline-none"
          />

          {/* Voice input button */}
          {voiceSupported && (
            <button
              className={`shrink-0 p-1 rounded-full transition-all ${
                isListening
                  ? 'bg-rose-100 text-rose-500 animate-pulse'
                  : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (isListening) stopListening();
                else startListening();
              }}
              title={lang === 'es' ? 'Buscar con voz' : 'Voice search'}
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Clear all */}
          {(searchQuery || activeFilters.length > 0) && (
            <button
              className="shrink-0 p-0.5 hover:bg-stone-100 rounded-full transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSearchChange('');
                // Remove all filters
                activeFilters.forEach((f) => onToggleFilter(f));
                inputRef.current?.focus();
              }}
            >
              <X className="w-3.5 h-3.5 text-stone-400" />
            </button>
          )}
        </div>


        {/* ── Typeahead Dropdown ──────────────────────────────── */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-[240px] overflow-y-auto">
            {typeaheadMatches.map((tag, i) => (
              <button
                key={tag}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                  i === selectedIdx
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addFilter(tag);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span className="text-stone-300 text-xs">#</span>
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick-add Chips ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {/* ♥ Favoritos */}
        {favoritesCount > 0 && (
          <>
            <button
              onClick={onToggleFavorites}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5 ${
                showOnlyFavorites
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-white text-rose-400 border-rose-200 hover:bg-rose-50 hover:text-rose-500'
              }`}
            >
              <Heart className={`w-3 h-3 ${showOnlyFavorites ? 'fill-white' : 'fill-rose-200'}`} />
              {lang === 'es' ? 'Favoritos' : 'Favorites'}
            </button>
            <div className="w-px bg-stone-200 shrink-0 my-1" />
          </>
        )}

        {/* Suggested tags — tapping adds them as a pill in the input */}
        {suggestedTags.map((tag) => {
          const isActive = activeFilters.some(
            (f) => f.toLowerCase() === tag.toLowerCase(),
          );
          return (
            <button
              key={tag}
              onClick={() => {
                if (isActive) {
                  onToggleFilter(tag);
                } else {
                  addFilter(tag);
                }
              }}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isActive
                  ? 'bg-stone-800 text-white border-stone-800 scale-95'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-800'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
