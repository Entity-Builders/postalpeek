import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, Outlet, useOutletContext } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useWalkerFeed } from '../../hooks/useWalkerFeed';
import { useClaimPostcard } from '../../hooks/useClaimPostcard';
import { useCollection } from '../../hooks/useCollection';
import { useAlbums, type Album } from '../../hooks/useAlbums';
import { useAlbumDetail } from '../../hooks/useAlbumDetail';
import { useStampContext } from '../../contexts/StampContext';

import type { FeedItem } from '../../components/Postcard';
import { AlbumsModal } from '../../components/AlbumsModal';
import { StatusBar } from '../../components/StatusBar';
import { PostcardGameSelector } from '../../components/PostcardGameSelector';
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
import { AuthGateModal } from '../../components/AuthGateModal';

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
  
  claim: (id: string, cost: number) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  isClaiming: boolean;
  claimStatus: any;
  claimedIds: Set<string>;
  
  collection: unknown[];
  isCollectionLoading: boolean;
  refetchCollection: () => void;
  
  albums: Album[];
  isLoadingAlbums: boolean;
  refetchAlbums: () => void;
  albumDetail: unknown;
  isAlbumDetailLoading: boolean;
  fetchAlbumDetail: (id: string) => void;
  resetAlbumDetail: () => void;
  unlockedCountries: Set<string>;
  
  favoriteIds: Set<string>;
  favoriteItems: unknown[];
  toggleFavorite: (id: string) => Promise<void>;
  
  user: User | null;
  isAdmin: boolean;
  isIdle: boolean;
  showWelcome: boolean;
  setShowWelcome: React.Dispatch<React.SetStateAction<boolean>>;
  
  viewMode: 'grid' | 'feed';
  setViewMode: React.Dispatch<React.SetStateAction<'grid' | 'feed'>>;
  isAlbumsModalOpen: boolean;
  setIsAlbumsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleAuthRequiredAction: (action: () => void) => void;
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
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Read guest claim status for optimistic UI
  const hasGuestClaim = Boolean(sessionStorage.getItem('postalpeek_guest_claim'));

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


      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';

        const tagSet = new Set<string>();
        items.forEach((item) => {
          if (item.detailed_tags?.length) {
            item.detailed_tags.forEach((dt: { label: string | { es?: string; en?: string } }) => {
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

    setIsSpotlightSearching(false);
    setShowNoResultsToast(false);
  }, []);

  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  useEffect(() => {
    const handleWelcomeSeen = () => setShowWelcome(false);
    window.addEventListener('postalpeek_welcome_seen', handleWelcomeSeen);
    return () => window.removeEventListener('postalpeek_welcome_seen', handleWelcomeSeen);
  }, []);

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

  // ── Sync guest claim from tutorial ──
  useEffect(() => {
    if (user?.id && claim) {
      const guestClaimedId = sessionStorage.getItem('postalpeek_guest_claim');
      if (guestClaimedId) {
        sessionStorage.removeItem('postalpeek_guest_claim');
        // Assume 0 cost since it was the tutorial freebie
        claim(guestClaimedId, 0).then((res) => {
          if (res.success) {
            refetchCollection();
            refetchAlbums();
          }
        });
      }
    }
  }, [user?.id, claim, refetchCollection, refetchAlbums]);

  const handleAuthRequiredAction = useCallback((action: () => void) => {
    if (!user) {
      setShowAuthGate(true);
    } else {
      action();
    }
  }, [user]);

  // ── Mock data for guest optimistic UI ──

  const displayAlbums = useMemo(() => {
    if (user) return albums;
    if (hasGuestClaim) {
      return [{
        id: 'guest-album',
        title: t({ es: 'Primer Álbum', en: 'First Album' }, lang),
        description: null,
        cover_image_url: null,
        category: 'general',
        country: 'Global',
        city: null,
        difficulty: 'easy' as const,
        total_slots: 6,
        collected_slots: 1,
        reward_claims: 2,
        completed_at: null,
      }];
    }
    return [{
      id: 'guest-album',
      title: t({ es: 'Primer Álbum', en: 'First Album' }, lang),
      description: null,
      cover_image_url: null,
      category: 'general',
      country: 'Global',
      city: null,
      difficulty: 'easy' as const,
      total_slots: 6,
      collected_slots: 0,
      reward_claims: 2,
      completed_at: null,
    }];
  }, [user, hasGuestClaim, albums, lang]);

  const displayCollectionCount = useMemo(() => {
    if (user) return collection.length;
    if (hasGuestClaim) return 1;
    return 0;
  }, [user, hasGuestClaim, collection.length]);

  const displayStampBalance = useMemo(() => {
    if (user) return stampBalance;
    if (hasGuestClaim) return 17;
    return 20;
  }, [user, hasGuestClaim, stampBalance]);

  const contextValue = useMemo<FeedLayoutContextType>(() => ({
    items, availableCountries, isLoading, selectedCountry, setSelectedCountry, hasSharedCard, hasMore, isFetchingMore, fetchMoreFeed,
    spotlightResults, spotlightQuery, isSpotlightSearching, handleSpotlightSearch, handleSpotlightDismiss, isSpotlightMode,
    claim, isClaiming, claimStatus, claimedIds,
    collection, isCollectionLoading, refetchCollection,
    albums, isLoadingAlbums, refetchAlbums, albumDetail, isAlbumDetailLoading, fetchAlbumDetail, resetAlbumDetail, unlockedCountries,
    favoriteIds, favoriteItems, toggleFavorite,
    user, isAdmin, isIdle, showWelcome, setShowWelcome,
    viewMode, setViewMode, isAlbumsModalOpen, setIsAlbumsModalOpen,
    handleAuthRequiredAction
  }), [
    items, availableCountries, isLoading, selectedCountry, setSelectedCountry, hasSharedCard, hasMore, isFetchingMore, fetchMoreFeed,
    spotlightResults, spotlightQuery, isSpotlightSearching, handleSpotlightSearch, handleSpotlightDismiss, isSpotlightMode,
    claim, isClaiming, claimStatus, claimedIds,
    collection, isCollectionLoading, refetchCollection,
    albums, isLoadingAlbums, refetchAlbums, albumDetail, isAlbumDetailLoading, fetchAlbumDetail, resetAlbumDetail, unlockedCountries,
    favoriteIds, favoriteItems, toggleFavorite,
    user, isAdmin, isIdle, showWelcome, setShowWelcome,
    viewMode, isAlbumsModalOpen,
    handleAuthRequiredAction
  ]);

  const effectiveViewedItems = useMemo(() => {
    const ad = albumDetail as any;
    if (ad?.slots?.length > 0) {
      // We are in an album, extract the items shown here.
      return ad.slots
        .filter((s: any) => s.illustration_url)
        .map((s: any) => ({
          id: s.postcard_id || s.slot_label,
          illustration_url: s.illustration_url,
          city: s.city || '',
          country: s.country || '',
          category: s.category || '',
        })) as FeedItem[];
    }
    return items;
  }, [albumDetail, items]);

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
        {!isSpotlightMode && !showWelcome && (
          <StatusBar
            albums={displayAlbums}
            collectionCount={displayCollectionCount}
            stampBalance={displayStampBalance}
            onAlbumTap={(album) => handleAuthRequiredAction(() => {
              navigate(`/feed/album/${album.id}`);
              analytics.track('statusbar_album_tapped', { album_id: album.id });
            })}
            onPlayTap={() => handleAuthRequiredAction(() => {
              setStatusBarGameOpen(true);
              analytics.track('statusbar_play_tapped');
            })}
            onCollectionTap={() => handleAuthRequiredAction(() => {
              navigate('/feed/collection');
              refetchCollection();
              analytics.track('statusbar_collection_tapped');
            })}
            onStampTap={() => handleAuthRequiredAction(() => {
              analytics.track('statusbar_stamp_tapped');
            })}
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
        onSelect={() => {}}
        onClose={() => setStatusBarGameOpen(false)}
      />

      <LanguageToggle isIdle={isIdle} isOnWelcome={false} />

      {/* ── Auth Gate ── */}
      <AnimatePresence>
        {showAuthGate && (
          <AuthGateModal
            onSuccess={() => setShowAuthGate(false)}
            onClose={() => setShowAuthGate(false)}
            viewedItems={effectiveViewedItems}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

