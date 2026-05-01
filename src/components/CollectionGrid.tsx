import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Trophy } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import { AlbumList } from './AlbumList';
import { CollectionFilterBar } from './CollectionFilterBar';
import type { FeedItem } from './Postcard';
import type { Album } from '../hooks/useAlbums';
import { t, useLang, getLang } from '../utils/i18n';
import { analytics } from '../lib/analytics';
import { useSearchStrategy } from '../hooks/useSearchStrategy';

type SectionId = 'albums' | 'postcards';

interface CollectionGridProps {
  collection: FeedItem[];
  isLoading: boolean;
  claimStatus: {
    daily_used: number;
    daily_limit: number;
    monthly_used: number;
    monthly_limit: number;
  };
  onClose: () => void;
  onSelectPostcard?: (item: FeedItem) => void;
  /** Favorites */
  favoriteItems?: FeedItem[];
  favoriteIds?: Set<string>;
  albums?: Album[];
  isLoadingAlbums?: boolean;
  onOpenAlbum?: (album: Album) => void;
}

const SECTIONS: { key: SectionId; label: string; icon: React.ReactNode }[] = [
  { key: 'albums', label: 'Álbumes', icon: <Trophy className='w-3.5 h-3.5' /> },
  {
    key: 'postcards',
    label: 'Postales',
    icon: <Package className='w-3.5 h-3.5' />,
  },
];

/* ── Lazy-rendered grid card ─────────────────────────────────────── */

function CollectionCard({
  item,
  index,
  onClick,
}: {
  item: FeedItem;
  index: number;
  onClick?: () => void;
}) {
  const imgUrl = useSignedImage(item.illustration_url, {
    width: WIDTHS.albumSlot,
  });

  // Track postcards with missing images in PostHog Error Tracking
  React.useEffect(() => {
    if (!imgUrl && item.illustration_url) {
      console.warn(`[CollectionCard] Image failed to sign: ${item.id}`);
      analytics.captureError(
        new Error(`Postcard image sign failed: ${item.id}`),
        {
          postcard_id: item.id,
          error_type: 'sign_failed',
          illustration_url: item.illustration_url,
          city: item.city,
          country: item.country,
        },
      );
    } else if (!item.illustration_url) {
      console.warn(`[CollectionCard] No illustration_url: ${item.id}`);
      analytics.captureError(
        new Error(`Postcard missing illustration_url: ${item.id}`),
        {
          postcard_id: item.id,
          error_type: 'missing_url',
          city: item.city,
          country: item.country,
        },
      );
    }
  }, [imgUrl, item.id, item.illustration_url, item.city, item.country]);

  const rarityColors: Record<string, string> = {
    common: 'bg-stone-100 text-stone-500',
    rare: 'bg-blue-50 text-blue-600',
    epic: 'bg-purple-50 text-purple-600',
    legendary: 'bg-amber-50 text-amber-600',
  };

  return (
    <motion.div
      className='relative group cursor-pointer'
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
    >
      <div className='bg-white p-1.5 pb-3 rounded-sm shadow-md hover:shadow-lg transition-shadow hover:-translate-y-0.5 transition-transform'>
        <div className='aspect-[3/4] overflow-hidden rounded-[2px] bg-stone-100 relative'>
          {imgUrl && (
            <img
              src={imgUrl}
              alt={t(item.category)}
              loading='lazy'
              decoding='async'
              className='w-full h-full object-cover'
            />
          )}

          {item.rarity && item.rarity !== 'common' && (
            <span
              className={`absolute top-1.5 right-1.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${rarityColors[item.rarity] || rarityColors.common}`}
            >
              {item.rarity}
            </span>
          )}
        </div>

        <p className='text-center font-handwriting text-[9px] sm:text-[10px] text-stone-500 mt-1 truncate px-0.5'>
          {item.city}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Lazy grid — renders items in batches for large collections ── */

const BATCH_SIZE = 18; // 3 cols × 6 rows

function LazyGrid({
  items,
  isLoading,
  emptyState,
  onSelectPostcard,
}: {
  items: FeedItem[];
  isLoading: boolean;
  emptyState: React.ReactNode;
  onSelectPostcard?: (item: FeedItem) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [prevItems, setPrevItems] = useState(items);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when items change (render-time pattern)
  if (items !== prevItems) {
    setPrevItems(items);
    setVisibleCount(BATCH_SIZE);
  }

  // IntersectionObserver to load more items when scrolling
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= items.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, items.length));
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, items.length]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-32'>
        <div className='w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin' />
      </div>
    );
  }

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  const visible = items.slice(0, visibleCount);

  return (
    <>
      <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3'>
        {visible.map((item, i) => (
          <CollectionCard
            key={item.id}
            item={item}
            index={i}
            onClick={() => onSelectPostcard?.(item)}
          />
        ))}
      </div>
      {/* Sentinel for infinite scroll within section */}
      {visibleCount < items.length && <div ref={sentinelRef} className='h-8' />}
    </>
  );
}

/* ── Main component ──────────────────────────────────────────────── */

export function CollectionGrid({
  collection,
  isLoading,
  claimStatus,
  onClose,
  onSelectPostcard,
  favoriteItems = [],
  favoriteIds = new Set(),
  albums = [],
  isLoadingAlbums = false,
  onOpenAlbum,
}: CollectionGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Merge collection + favorites (deduped, favorites that aren't in collection get added)
  const allItems = React.useMemo(() => {
    const seen = new Set(collection.map((c) => c.id));
    const extras = favoriteItems.filter((f) => !seen.has(f.id));
    return [...collection, ...extras];
  }, [collection, favoriteItems]);



  // Dynamically calculate the top tags present in the unified collection
  const lang = useLang();
  const { suggestedTags, allTagNames, tagDisplayNames } = React.useMemo(() => {
    if (!allItems || allItems.length === 0) return { suggestedTags: [], allTagNames: [], tagDisplayNames: {} };

    const tagCounts: Record<string, number> = {};
    const tagDisplayNames: Record<string, string> = {};
    const currentLang = getLang();

    allItems.forEach((item) => {
      // Prefer detailed_tags labels (high weight only) for cleaner chips
      let itemTags: string[] = [];

      if (item.detailed_tags && item.detailed_tags.length > 0) {
        itemTags = item.detailed_tags
          .filter((dt: any) => (dt.weight ?? 0) >= 6)
          .map((dt: any) => {
            const lbl = dt.label;
            if (typeof lbl === 'object' && lbl !== null) {
              return lbl[currentLang] || lbl.es || lbl.en || '';
            }
            return String(lbl || '');
          });
      } else {
        // Fallback to flat tags for old postcards
        itemTags = [
          ...(item.visual_tags || []),
          ...(item.aesthetic_vibes || []),
          item.architecture_style,
          item.color_palette,
          t(item.category),
        ].filter((v): v is string => typeof v === 'string' && v.length > 0);
      }

      // Add scene-level fields as chips too
      if (item.scene_type) itemTags.push(item.scene_type);
      if (item.time_of_day) itemTags.push(item.time_of_day);
      if (item.weather) itemTags.push(item.weather);

      itemTags.forEach((tag) => {
        const normalized = tag.toLowerCase().trim();
        if (normalized.length > 25 || normalized.length < 2) return;

        if (!tagCounts[normalized]) {
          tagCounts[normalized] = 0;
          let display = tag.replace(/_/g, ' ');
          if (display.length > 0) {
            display = display.charAt(0).toUpperCase() + display.slice(1);
          }
          tagDisplayNames[normalized] = display;
        }
        tagCounts[normalized]++;
      });
    });

    const sortedTags = Object.keys(tagCounts).sort(
      (a, b) => tagCounts[b] - tagCounts[a],
    );
    return {
      suggestedTags: sortedTags
        .slice(0, 15)
        .map((normalized) => tagDisplayNames[normalized]),
      allTagNames: sortedTags.map((normalized) => tagDisplayNames[normalized]),
      tagDisplayNames,
    };
  }, [allItems, lang]);

  const [activeSection, setActiveSection] = useState<SectionId>('albums');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    albums: null,
    postcards: null,
  });
  const isManualScroll = useRef(false);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const ratios = new Map<SectionId, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualScroll.current) return;

        for (const entry of entries) {
          for (const section of SECTIONS) {
            if (entry.target === sectionRefs.current[section.key]) {
              ratios.set(section.key, entry.intersectionRatio);
            }
          }
        }

        // Pick the section with the highest visibility ratio
        let best: SectionId = 'albums';
        let bestRatio = -1;
        for (const section of SECTIONS) {
          const ratio = ratios.get(section.key) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = section.key;
          }
        }
        setActiveSection(best);
      },
      {
        root: container,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const section of SECTIONS) {
      const el = sectionRefs.current[section.key];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);


  // Scroll to section when tapping a nav pill
  const scrollToSection = useCallback((sectionId: SectionId) => {
    const el = sectionRefs.current[sectionId];
    if (!el) return;

    isManualScroll.current = true;
    setActiveSection(sectionId);

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Re-enable observer tracking after animation completes
    setTimeout(() => {
      isManualScroll.current = false;
    }, 600);
  }, []);

  // ── Search strategy (PostHog flag decides classic vs AI) ──────
  const { mode: searchMode, filterItems, checkAutoFallback, isSmartSearching, smartSearchActive } =
    useSearchStrategy({ allTagNames, searchQuery, activeFilters });

  // Debounced search tracking
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      analytics.track('collection_searched', {
        query: searchQuery.trim(),
        search_mode: searchMode,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);

  // Apply filters to the unified list, then optionally narrow to favorites-only
  const filteredItems = React.useMemo(() => {
    let base = filterItems(allItems);
    if (showOnlyFavorites) {
      base = base.filter((item) => favoriteIds.has(item.id));
    }
    return base;
  }, [filterItems, allItems, showOnlyFavorites, favoriteIds]);

  // Dynamic pills: show top tags from filtered results when searching
  const activeSuggestedTags = React.useMemo(() => {
    const isFiltering = searchQuery.trim() || activeFilters.length > 0;
    if (!isFiltering || filteredItems.length === 0 || filteredItems.length === allItems.length) {
      return suggestedTags;
    }

    // Count tags in filtered items
    const counts: Record<string, number> = {};
    const currentLang = getLang();
    filteredItems.forEach((item) => {
      const tags: string[] = [];
      if (item.detailed_tags?.length) {
        item.detailed_tags
          .filter((dt: any) => (dt.weight ?? 0) >= 6)
          .forEach((dt: any) => {
            const lbl = dt.label;
            const display = typeof lbl === 'object' && lbl !== null
              ? lbl[currentLang] || lbl.es || lbl.en || ''
              : String(lbl || '');
            if (display) tags.push(display);
          });
      }
      if (item.scene_type) tags.push(item.scene_type);
      if (item.time_of_day) tags.push(item.time_of_day);
      if (item.weather) tags.push(item.weather);

      tags.forEach((tag) => {
        const norm = tag.toLowerCase().trim();
        if (norm.length >= 2 && norm.length <= 25) {
          const display = tagDisplayNames[norm] || (tag.charAt(0).toUpperCase() + tag.slice(1));
          counts[display] = (counts[display] || 0) + 1;
        }
      });
    });

    // Exclude already-active filters from suggestions
    const activeSet = new Set(activeFilters.map((f) => f.toLowerCase()));
    return Object.entries(counts)
      .filter(([tag]) => !activeSet.has(tag.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag]) => tag);
  }, [filteredItems, allItems, searchQuery, activeFilters, suggestedTags, tagDisplayNames]);

  // Scroll to top when search results settle (debounced to avoid jump while typing)
  const prevQueryRef = useRef('');
  useEffect(() => {
    const q = searchQuery.trim();
    // Only scroll when the query meaningfully changes (start or clear)
    if (q !== prevQueryRef.current) {
      prevQueryRef.current = q;
      if (!q) {
        // Cleared the search — scroll to top immediately
        scrollContainerRef.current?.scrollTo({ top: 0 });
      }
      // Don't scroll during typing — let the user browse while debouncing
    }
  }, [searchQuery]);

  // Auto-fallback: 0 classic results in smart mode → force AI
  useEffect(() => {
    checkAutoFallback(filteredItems.length);
  }, [filteredItems.length, checkAutoFallback]);

  return (
    <motion.div
      className='fixed inset-0 z-[150] bg-[#e6e2da] overflow-hidden flex flex-col'
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className='shrink-0 px-4 pt-4 pb-2 flex items-center justify-between'>
        <button
          onClick={onClose}
          className='p-2 rounded-full bg-white/60 hover:bg-white/80 text-stone-500 hover:text-stone-700 transition-colors'
        >
          <ArrowLeft className='w-5 h-5' />
        </button>

        <h2 className='font-serif text-lg text-stone-800 tracking-tight'>
          {t({ es: 'Mi Colección', en: 'My Collection' }, lang)}
        </h2>

        <div className='text-right'>
          <span className='text-xs text-stone-400 font-mono'>
            {t({ es: `${claimStatus.daily_used}/${claimStatus.daily_limit} hoy`, en: `${claimStatus.daily_used}/${claimStatus.daily_limit} today` }, lang)}
          </span>
        </div>
      </div>

      {/* Sticky nav pills */}
      <div className='shrink-0 px-4 pb-3 sticky top-0 z-10'>
        <div className='flex gap-1 bg-stone-200/60 backdrop-blur-md rounded-xl p-1'>
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => scrollToSection(section.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeSection === section.key
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {section.icon}
              {section.key === 'albums' ? t({ es: 'Álbumes', en: 'Albums' }, lang) : t({ es: 'Postales', en: 'Postcards' }, lang)}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content — all sections stacked */}
      <div
        ref={scrollContainerRef}
        className='flex-1 overflow-y-auto pb-8'
      >
        {/* ── Albums section ── */}
        <div
          ref={(el) => {
            sectionRefs.current.albums = el;
          }}
          className='pb-6'
        >
          {/* My Albums Section */}
          <div className='px-4 pt-2'>
            <h3 className='font-serif text-lg text-stone-800 flex items-center gap-2 mb-4'>
              <Trophy className='w-5 h-5 text-amber-500' />
              {t({ es: 'Mis Álbumes', en: 'My Albums' }, lang)}
            </h3>
            {albums.filter(a => a.collected_slots > 0).length > 0 || isLoadingAlbums ? (
              <AlbumList
                albums={albums.filter(a => a.collected_slots > 0)}
                isLoading={isLoadingAlbums}
                onOpenAlbum={(a) => onOpenAlbum?.(a)}
              />
            ) : (
              <div className='flex flex-col items-center py-8 text-center bg-stone-50 rounded-2xl border border-stone-200'>
                <span className='text-4xl mb-3'>📚</span>
                <p className='text-sm text-stone-400 max-w-xs'>
                  {t({ es: 'Tus álbumes en progreso y completados aparecerán aquí.', en: 'Your in-progress and completed albums will appear here.' }, lang)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className='mx-4 border-t border-stone-300/40' />

        {/* ── Filter Bar (Sticky below nav if desired, or static) ── */}
        <div className='pt-4 sticky top-0 z-[5] bg-[#e6e2da]'>
          <CollectionFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilters={activeFilters}
            onToggleFilter={(f) => {
              analytics.track('collection_filtered', {
                filter_tag: f,
                search_mode: searchMode,
              });
              setActiveFilters((prev) =>
                prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
              );
            }}
            suggestedTags={activeSuggestedTags}
            allTagNames={allTagNames}
            showOnlyFavorites={showOnlyFavorites}
            onToggleFavorites={() => {
              setShowOnlyFavorites((prev) => !prev);
              analytics.track('collection_filtered', { filter_tag: '♥ Favoritos' });
            }}
            favoritesCount={favoriteItems.length}
            isSmartSearching={isSmartSearching}
            smartSearchActive={smartSearchActive}
            searchMode={searchMode}
          />
        </div>

        {/* ── Postcards section ── */}
        <div
          ref={(el) => {
            sectionRefs.current.postcards = el;
          }}
          className='px-4 pb-6'
        >
          <div className='flex items-center justify-between mb-3'>
            <h3 className='font-serif text-base text-stone-700 flex items-center gap-2'>
              <Package className='w-4 h-4 text-stone-500' />
              {showOnlyFavorites ? t({ es: 'Favoritos', en: 'Favorites' }, lang) : t({ es: 'Postales', en: 'Postcards' }, lang)}
            </h3>
            <span className='text-xs text-stone-400 font-mono'>
              {filteredItems.length}{' '}
              {filteredItems.length !== allItems.length
                ? t({ es: `de ${showOnlyFavorites ? favoriteIds.size : allItems.length}`, en: `of ${showOnlyFavorites ? favoriteIds.size : allItems.length}` }, lang)
                : showOnlyFavorites ? t({ es: 'favoritos', en: 'favorites' }, lang) : t({ es: 'postales', en: 'postcards' }, lang)}
            </span>
          </div>

          <LazyGrid
            items={filteredItems}
            isLoading={isLoading}
            onSelectPostcard={onSelectPostcard}
            emptyState={
              searchQuery.trim() && !isSmartSearching ? (
                <div className='flex flex-col items-center py-10 text-center'>
                  <span className='text-5xl mb-4'>🔍</span>
                  <h3 className='font-serif text-lg text-stone-700 mb-2'>
                    {t({ es: `No encontramos "${searchQuery.trim()}"`, en: `We couldn't find "${searchQuery.trim()}"` }, lang)}
                  </h3>
                  <p className='text-sm text-stone-400 max-w-xs mb-6'>
                    {t({ es: 'Probá con otras palabras o explorá el feed para descubrir nuevas postales.', en: 'Try other words or explore the feed to discover new postcards.' }, lang)}
                  </p>
                  <div className='flex gap-3'>
                    <button
                      onClick={() => setSearchQuery('')}
                      className='px-5 py-2 rounded-full border border-stone-300 text-stone-600 text-sm font-medium hover:bg-stone-100 transition-colors'
                    >
                      {t({ es: 'Limpiar búsqueda', en: 'Clear search' }, lang)}
                    </button>
                    <button
                      onClick={onClose}
                      className='px-5 py-2 rounded-full bg-stone-800 text-white text-sm font-medium hover:bg-stone-900 transition-colors'
                    >
                      {t({ es: 'Ir al feed', en: 'Go to feed' }, lang)}
                    </button>
                  </div>
                </div>
              ) : showOnlyFavorites ? (
                <div className='flex flex-col items-center py-10 text-center'>
                  <span className='text-5xl mb-4'>♥</span>
                  <h3 className='font-serif text-lg text-stone-700 mb-2'>
                    {t({ es: 'Sin favoritos todavía', en: 'No favorites yet' }, lang)}
                  </h3>
                  <p className='text-sm text-stone-400 max-w-xs'>
                    {t({ es: 'Tocá el ♥ en las postales que te gusten.', en: 'Tap the ♥ on the postcards you like.' }, lang)}
                  </p>
                </div>
              ) : (
                <div className='flex flex-col items-center py-10 text-center'>
                  <span className='text-5xl mb-4'>🃏</span>
                  <h3 className='font-serif text-lg text-stone-700 mb-2'>
                    {t({ es: 'Tu colección está vacía', en: 'Your collection is empty' }, lang)}
                  </h3>
                  <p className='text-sm text-stone-400 max-w-xs'>
                    {t({ es: '¡Empezá a reclamar postales del feed para llenar tu colección!', en: 'Start claiming postcards from the feed to fill your collection!' }, lang)}
                  </p>
                  <button
                    onClick={onClose}
                    className='mt-4 px-5 py-2 rounded-full bg-stone-800 text-white text-sm font-medium hover:bg-stone-900 transition-colors'
                  >
                    {t({ es: 'Explorar postales', en: 'Explore postcards' }, lang)}
                  </button>
                </div>
              )
            }
          />
        </div>
      </div>
    </motion.div>
  );
}
