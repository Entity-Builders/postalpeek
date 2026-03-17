import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Heart, Trophy } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS, preSignUrls } from '../utils/imageUtils';
import { AlbumList } from './AlbumList';
import { SmartAlbumCarousel } from './SmartAlbumCarousel';
import type { FeedItem } from './Postcard';
import type { Album } from '../hooks/useAlbums';
import type { SmartAlbum } from '../hooks/useSmartAlbums';

type SectionId = 'albums' | 'postcards' | 'favorites';

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
  isFavoritesLoading?: boolean;
  albums?: Album[];
  isLoadingAlbums?: boolean;
  onOpenAlbum?: (album: Album) => void;
  /** Smart Albums */
  smartAlbums?: SmartAlbum[];
  isLoadingSmartAlbums?: boolean;
  onOpenSmartAlbum?: (album: SmartAlbum) => void;
}

const SECTIONS: { key: SectionId; label: string; icon: React.ReactNode }[] = [
  { key: 'albums', label: 'Álbumes', icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: 'postcards', label: 'Postales', icon: <Package className="w-3.5 h-3.5" /> },
  { key: 'favorites', label: 'Favoritos', icon: <Heart className="w-3.5 h-3.5" /> },
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
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.mobile });

  const rarityColors: Record<string, string> = {
    common: 'bg-stone-100 text-stone-500',
    rare: 'bg-blue-50 text-blue-600',
    epic: 'bg-purple-50 text-purple-600',
    legendary: 'bg-amber-50 text-amber-600',
  };

  return (
    <motion.div
      className="relative group cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
    >
      <div className="bg-white p-1.5 pb-3 rounded-sm shadow-md hover:shadow-lg transition-shadow hover:-translate-y-0.5 transition-transform">
        <div className="aspect-[3/4] overflow-hidden rounded-[2px] bg-stone-100 relative">
          {imgUrl && (
            <img
              src={imgUrl}
              alt={item.category}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
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

        <p className="text-center font-handwriting text-[9px] sm:text-[10px] text-stone-500 mt-1 truncate px-0.5">
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
      <div className="flex items-center justify-center h-32">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  const visible = items.slice(0, visibleCount);

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
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
      {visibleCount < items.length && (
        <div ref={sentinelRef} className="h-8" />
      )}
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
  isFavoritesLoading = false,
  albums = [],
  isLoadingAlbums = false,
  onOpenAlbum,
  smartAlbums = [],
  isLoadingSmartAlbums = false,
  onOpenSmartAlbum,
}: CollectionGridProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('albums');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    albums: null,
    postcards: null,
    favorites: null,
  });
  const isManualScroll = useRef(false);
  const favPreSigned = useRef(false);

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

  // Lazy pre-sign favorite URLs when favorites section comes into view
  useEffect(() => {
    if (favPreSigned.current || favoriteItems.length === 0) return;

    const favSection = sectionRefs.current.favorites;
    const container = scrollContainerRef.current;
    if (!favSection || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !favPreSigned.current) {
          favPreSigned.current = true;
          preSignUrls(
            favoriteItems.flatMap((i) =>
              [i.illustration_url, i.original_image_url].filter(Boolean),
            ),
          ).catch((err) => console.error('Failed to pre-sign fav URLs', err));
          observer.disconnect();
        }
      },
      { root: container, rootMargin: '300px' },
    );

    observer.observe(favSection);
    return () => observer.disconnect();
  }, [favoriteItems]);

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

  return (
    <motion.div
      className="fixed inset-0 z-[150] bg-[#e6e2da] overflow-hidden flex flex-col"
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/60 hover:bg-white/80 text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h2 className="font-serif text-lg text-stone-800 tracking-tight">
          Mi Colección
        </h2>

        <div className="text-right">
          <span className="text-xs text-stone-400 font-mono">
            {claimStatus.daily_used}/{claimStatus.daily_limit} hoy
          </span>
        </div>
      </div>

      {/* Sticky nav pills */}
      <div className="shrink-0 px-4 pb-3 sticky top-0 z-10">
        <div className="flex gap-1 bg-stone-200/60 backdrop-blur-md rounded-xl p-1">
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
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content — all sections stacked */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pb-8 scroll-smooth"
      >
        {/* ── Albums section ── */}
        <div
          ref={(el) => { sectionRefs.current.albums = el; }}
          className="pb-6"
        >
          {/* Smart Albums Section (Top) */}
          {(smartAlbums.length > 0 || isLoadingSmartAlbums) && (
            <div className="mb-6 bg-stone-100/50 py-4 border-b border-stone-200/50">
              <div className="px-4 mb-2">
                <h3 className="font-serif text-lg text-stone-800 flex items-center gap-2">
                  <span className="text-xl">✨</span> Smart Albums
                </h3>
              </div>
              <SmartAlbumCarousel
                albums={smartAlbums}
                isLoading={isLoadingSmartAlbums}
                onOpenAlbum={(a) => onOpenSmartAlbum?.(a)}
              />
            </div>
          )}

          {/* Curated Albums Section */}
          <div className="px-4 pt-2">
            <h3 className="font-serif text-lg text-stone-800 flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              Álbumes Curados
            </h3>
            {(albums.length > 0 || isLoadingAlbums) ? (
              <AlbumList
                albums={albums}
                isLoading={isLoadingAlbums}
                onOpenAlbum={(a) => onOpenAlbum?.(a)}
              />
            ) : (
              <div className="flex flex-col items-center py-8 text-center bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-4xl mb-3">📚</span>
                <p className="text-sm text-stone-400 max-w-xs">
                  Los álbumes curados irán apareciendo aquí.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mx-4 border-t border-stone-300/40" />

        {/* ── Postcards section ── */}
        <div
          ref={(el) => { sectionRefs.current.postcards = el; }}
          className="px-4 pt-5 pb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-base text-stone-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-stone-500" />
              Postales
            </h3>
            <span className="text-xs text-stone-400 font-mono">
              {collection.length} postales
            </span>
          </div>

          <LazyGrid
            items={collection}
            isLoading={isLoading}
            onSelectPostcard={onSelectPostcard}
            emptyState={
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-5xl mb-4">🃏</span>
                <h3 className="font-serif text-lg text-stone-700 mb-2">
                  Tu colección está vacía
                </h3>
                <p className="text-sm text-stone-400 max-w-xs">
                  ¡Empezá a reclamar postales del feed para llenar tu colección!
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-5 py-2 rounded-full bg-stone-800 text-white text-sm font-medium hover:bg-stone-900 transition-colors"
                >
                  Explorar postales
                </button>
              </div>
            }
          />
        </div>

        <div className="mx-4 border-t border-stone-300/40" />

        {/* ── Favorites section ── */}
        <div
          ref={(el) => { sectionRefs.current.favorites = el; }}
          className="px-4 pt-5 pb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-base text-stone-700 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              Favoritos
            </h3>
            <span className="text-xs text-stone-400 font-mono">
              {favoriteItems.length} favoritos
            </span>
          </div>

          <LazyGrid
            items={favoriteItems}
            isLoading={isFavoritesLoading}
            onSelectPostcard={onSelectPostcard}
            emptyState={
              <div className="flex flex-col items-center py-10 text-center">
                <Heart className="w-14 h-14 mb-3 text-rose-300/80 fill-rose-200/40" />
                <h3 className="font-serif text-lg text-stone-700 mb-2">
                  Sin favoritos todavía
                </h3>
                <p className="text-sm text-stone-400 max-w-xs">
                  Tocá el <span className="text-rose-400">♥</span> en las postales que te gusten.
                </p>
              </div>
            }
          />
        </div>
      </div>
    </motion.div>
  );
}
