import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, Outlet, useOutletContext } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useWalkerFeed } from '../../hooks/useWalkerFeed';
import { useClaimPostcard } from '../../hooks/useClaimPostcard';
import { useCollection } from '../../hooks/useCollection';
import { useAlbums } from '../../hooks/useAlbums';
import { useAlbumDetail } from '../../hooks/useAlbumDetail';
import { useStampContext } from '../../contexts/StampContext';

import type { FeedItem } from '../../components/Postcard';
import { AlbumsModal } from '../../components/AlbumsModal';
import { StatusBar } from '../../components/StatusBar';
import { PostcardGameSelector, type GameMode } from '../../components/PostcardGameSelector';
import { hasSeenWelcome } from '../../utils/welcomeStorage';
import { WelcomeToast } from '../../components/WelcomeToast';
import { SearchX } from 'lucide-react';
import { useFavorites } from '@eb-packages/logic/src/hooks/useFavorites';
import { analytics } from '../../lib/analytics';
import { useLang, t } from '../../utils/i18n';
import { supabase } from '@eb-packages/logic/src/supabase';
import { AnimatePresence, motion } from 'framer-motion';
import type { SmartSearchResult } from '../../hooks/useSmartSearch';
import { LanguageToggle } from '../../components/ui/LanguageToggle';

// --- Types ---
export type FeedLayoutContextType = {
  items: FeedItem[];
  availableCountries: string[];
  isLoading: boolean;
  selectedCountry: string | null;
  setSelectedCountry: (c: string | null) => void;
  hasSharedCard: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  fetchMoreFeed: () => Promise<void>;
  
  spotlightResults: FeedItem[];
  spotlightQuery: string;
  isSpotlightSearching: boolean;
  handleSpotlightSearch: (q: string) => Promise<void>;
  handleSpotlightDismiss: () => void;
  isSpotlightMode: boolean;
  
  claim: any;
  isClaiming: boolean;
  claimStatus: any;
  claimedIds: Set<string>;
  
  collection: any[];
  isCollectionLoading: boolean;
  refetchCollection: () => void;
  
  albums: any[];
  isLoadingAlbums: boolean;
  refetchAlbums: () => void;
  albumDetail: any;
  isAlbumDetailLoading: boolean;
  fetchAlbumDetail: (id: string) => void;
  resetAlbumDetail: () => void;
  unlockedCountries: Set<string>;
  
  favoriteIds: Set<string>;
  favoriteItems: any[];
  toggleFavorite: (id: string, isFav: boolean) => Promise<void>;
  
  user: User | null;
  isAdmin: boolean;
  isIdle: boolean;
  showWelcome: boolean;
  
  viewMode: 'grid' | 'feed';
  setViewMode: React.Dispatch<React.SetStateAction<'grid' | 'feed'>>;
  isAlbumsModalOpen: boolean;
  setIsAlbumsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useFeedContext() {
  return useOutletContext<FeedLayoutContextType>();
}

export function FeedLayout({
  isIdle = false,
  isAdmin = false,
  user = null,
  onWelcomeChange,
}: {
  isIdle?: boolean;
  isAdmin?: boolean;
  user?: User | null;
  onWelcomeChange?: (isOnWelcome: boolean) => void;
}) {
  const lang = useLang();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('grid');
  const [isAlbumsModalOpen, setIsAlbumsModalOpen] = useState(false);
  const [statusBarGameOpen, setStatusBarGameOpen] = useState(false);

  const {
    items,
    availableCountries,
    isLoading,
    selectedCountry,
    setSelectedCountry,
    hasSharedCard,
    hasMore,
    isFetchingMore,
    fetchMoreFeed,
  } = useWalkerFeed();

  // ── Spotlight search state ──
  const [spotlightResults, setSpotlightResults] = useState<FeedItem[]>([]);
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [isSpotlightSearching, setIsSpotlightSearching] = useState(false);
  const [smartSearchIntent, setSmartSearchIntent] = useState<SmartSearchResult | null>(null);
  const [showNoResultsToast, setShowNoResultsToast] = useState(false);
  const spotlightAbortRef = useRef<AbortController | null>(null);
  const SPOTLIGHT_PAGE_SIZE = 30;

  const handleSpotlightSearch = useCallback(
    async (query: string) => {
      if (spotlightAbortRef.current) spotlightAbortRef.current.abort();
      const controller = new AbortController();
      spotlightAbortRef.current = controller;

      setSpotlightQuery(query);
      setIsSpotlightSearching(true);
      setSpotlightResults([]);
      setSmartSearchIntent(null);

      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';

        const tagSet = new Set<string>();
        items.forEach((item) => {
          if (item.detailed_tags?.length) {
            item.detailed_tags.forEach((dt: any) => {
                const lbl = dt.label;
                const name = typeof lbl === 'object' && lbl !== null ? lbl.en || lbl.es || '' : String(lbl || '');
                if (name) tagSet.add(name);
              },
            );
          }
          (item.visual_tags || []).forEach((t: string) => tagSet.add(t));
        });

        const response = await fetch(`${baseUrl}/functions/v1/postalpeek-search-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ query, availableTags: Array.from(tagSet).slice(0, 100) }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Search failed: ${response.status}`);
        const smartResult: SmartSearchResult = await response.json();

        const { data, error } = await supabase.rpc('postalpeek_spotlight_search_v2', {
            p_tags: smartResult.tags,
            p_time_of_day: smartResult.time_of_day,
            p_weather: smartResult.weather,
            p_scene_type: smartResult.scene_type,
            p_country: smartResult.country,
            p_city: smartResult.city,
            p_rarity: smartResult.rarity,
            p_free_text: smartResult.freeTextSearch,
            p_limit: SPOTLIGHT_PAGE_SIZE,
            p_require_illustration_tags: true,
          },
        );

        if (error) throw error;
        const results = data || [];
        setSpotlightResults(results);

        if (results.length === 0) {
          setShowNoResultsToast(true);
          setTimeout(() => setShowNoResultsToast(false), 4000);
        }

        analytics.track('spotlight_pill_searched', { query, results_count: results.length });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSpotlightResults([]);
        setSmartSearchIntent(null);
      } finally {
        setIsSpotlightSearching(false);
      }
    },
    [items],
  );

  const handleSpotlightDismiss = useCallback(() => {
    if (spotlightAbortRef.current) spotlightAbortRef.current.abort();
    setSpotlightResults([]);
    setSpotlightQuery('');
    setSmartSearchIntent(null);
    setIsSpotlightSearching(false);
    setShowNoResultsToast(false);
  }, []);

  const [showWelcome] = useState(() => !hasSeenWelcome());

  useEffect(() => {
    onWelcomeChange?.(showWelcome);
    if (showWelcome) {
      analytics.track('welcome_scroll_started');
    }
  }, [onWelcomeChange, showWelcome]);

  const { favoriteIds, favoriteItems, toggle: toggleFavorite } = useFavorites(user ?? null);
  const { collection, isLoading: isCollectionLoading, refetch: refetchCollection } = useCollection(user?.id);
  const { albums, isLoading: isLoadingAlbums, refetch: refetchAlbums } = useAlbums(user?.id);
  const { detail: albumDetail, isLoading: isAlbumDetailLoading, fetchDetail: fetchAlbumDetail, reset: resetAlbumDetail } = useAlbumDetail();
  
  const unlockedCountries = useMemo(() => {
    const set = new Set<string>();
    albums.forEach((album) => {
      if (album.completed_at && album.country) set.add(album.country);
    });
    return set;
  }, [albums]);

  const { stampBalance, claimDailyStamps, addLocalStamps, setLocalStamps } = useStampContext();
  useEffect(() => { if (user?.id) claimDailyStamps(); }, [user?.id, claimDailyStamps]);

  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  
  const isSpotlightMode = Boolean(
    spotlightQuery.trim().length > 0 || isSpotlightSearching || spotlightResults.length > 0,
  );

  const { claim, isClaiming, claimStatus, claimedIds } = useClaimPostcard(user?.id, addLocalStamps, setLocalStamps);

  const contextValue = useMemo<FeedLayoutContextType>(() => ({
    items, availableCountries, isLoading, selectedCountry, setSelectedCountry, hasSharedCard, hasMore, isFetchingMore, fetchMoreFeed,
    spotlightResults, spotlightQuery, isSpotlightSearching, handleSpotlightSearch, handleSpotlightDismiss, isSpotlightMode,
    claim, isClaiming, claimStatus, claimedIds,
    collection, isCollectionLoading, refetchCollection,
    albums, isLoadingAlbums, refetchAlbums, albumDetail, isAlbumDetailLoading, fetchAlbumDetail, resetAlbumDetail, unlockedCountries,
    favoriteIds, favoriteItems, toggleFavorite,
    user, isAdmin, isIdle, showWelcome,
    viewMode, setViewMode, isAlbumsModalOpen, setIsAlbumsModalOpen
  }), [
    items, availableCountries, isLoading, selectedCountry, setSelectedCountry, hasSharedCard, hasMore, isFetchingMore, fetchMoreFeed,
    spotlightResults, spotlightQuery, isSpotlightSearching, handleSpotlightSearch, handleSpotlightDismiss, isSpotlightMode,
    claim, isClaiming, claimStatus, claimedIds,
    collection, isCollectionLoading, refetchCollection,
    albums, isLoadingAlbums, refetchAlbums, albumDetail, isAlbumDetailLoading, fetchAlbumDetail, resetAlbumDetail, unlockedCountries,
    favoriteIds, favoriteItems, toggleFavorite,
    user, isAdmin, isIdle, showWelcome,
    viewMode, setViewMode, isAlbumsModalOpen, setIsAlbumsModalOpen
  ]);

  return (
    <div className='w-full h-full flex flex-col relative bg-[#e6e2da] overflow-hidden'>
      {/* ── Child Route Content ── */}
      <Outlet context={contextValue} />

      {/* ── Global Overlays ── */}
      <AnimatePresence>
        {isAlbumsModalOpen && (
          <AlbumsModal
            albums={albums}
            isLoading={isLoadingAlbums}
            onClose={() => setIsAlbumsModalOpen(false)}
            onSelectAlbum={(album) => {
              setIsAlbumsModalOpen(false);
              navigate(`/feed/album/${album.id}`);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcomeToast && (
          <WelcomeToast
            onOpenAlbums={() => {
              setShowWelcomeToast(false);
              if (albums.length > 0) navigate(`/feed/album/${albums[0].id}`);
              else { navigate('/feed/collection'); refetchCollection(); }
              refetchAlbums();
              analytics.track('welcome_toast_albums_opened');
            }}
            onDismiss={() => setShowWelcomeToast(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNoResultsToast && (
          <motion.div
            key='no-results-toast'
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className='fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3
              bg-stone-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md
              border border-white/10 max-w-[90vw]'
          >
            <SearchX className='w-5 h-5 text-amber-500' strokeWidth={2} />
            <div>
              <p className='text-sm font-semibold leading-tight'>
                {t({ es: 'Sin resultados', en: 'No results' }, lang)}
              </p>
              <p className='text-xs text-stone-300 mt-0.5 max-w-[200px] truncate'>
                {t({ es: 'Mostrando sugerencias', en: 'Showing suggestions' }, lang)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {user && !isSpotlightMode && !showWelcome && (
          <StatusBar
            albums={albums}
            collectionCount={collection.length}
            stampBalance={stampBalance}
            onAlbumTap={(album) => {
              navigate(`/feed/album/${album.id}`);
              analytics.track('statusbar_album_tapped', { album_id: album.id });
            }}
            onPlayTap={() => {
              setStatusBarGameOpen(true);
              analytics.track('statusbar_play_tapped');
            }}
            onCollectionTap={() => {
              navigate('/feed/collection');
              refetchCollection();
              analytics.track('statusbar_collection_tapped');
            }}
          />
        )}
      </AnimatePresence>

      <PostcardGameSelector
        open={statusBarGameOpen}
        hasHuntMode={false}
        hasTriviaMode={false}
        onStart={() => {
          setStatusBarGameOpen(false);
          // Currently just opens a random card in carousel mode.
          // In the new layout, we navigate to the carousel route with a random index.
          if (collection.length > 0) {
            const randomIndex = Math.floor(Math.random() * collection.length);
            navigate(`/game/${collection[randomIndex].id}`);
            analytics.track('statusbar_game_started', { mode: 'random' });
          }
        }}
        onSelect={(mode: GameMode) => {}}
        onClose={() => setStatusBarGameOpen(false)}
      />

      <LanguageToggle isIdle={isIdle} isOnWelcome={false} />
    </div>
  );
}
