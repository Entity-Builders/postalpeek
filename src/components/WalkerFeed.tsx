import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import type { User } from '@supabase/supabase-js';
import { useWalkerFeed } from '../hooks/useWalkerFeed';
import { useClaimPostcard } from '../hooks/useClaimPostcard';
import { useCollection } from '../hooks/useCollection';
import { useAlbums } from '../hooks/useAlbums';
import { useAlbumDetail } from '../hooks/useAlbumDetail';
import { useDailyPack } from '../hooks/useDailyPack';
import type { FeedItem } from './Postcard';
import { WalkerCarousel } from './WalkerCarousel';
import { WalkerGrid } from './WalkerGrid';
import { AlbumsModal } from './AlbumsModal';
import { ClaimLimitModal } from './ClaimLimitModal';
import { CollectionGrid } from './CollectionGrid';
import { AlbumDetail } from './AlbumDetail';
import { PostcardDetailModal } from './PostcardDetailModal';
import { StatusBar } from './StatusBar';
import { PostcardGameSelector, type GameMode } from './PostcardGameSelector';

import { ImageLightbox } from './ImageLightbox';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import { WelcomeToast } from './WelcomeToast';
import { SearchX } from 'lucide-react';
import { useFavorites } from '@eb-packages/logic/src/hooks/useFavorites';
import { analytics } from '../lib/analytics';
import { useLang, t } from '../utils/i18n';
import { FeatureFlags } from '../lib/featureFlags';
import { supabase } from '@eb-packages/logic/src/supabase';
import { AnimatePresence, motion } from 'framer-motion';
import type { SmartSearchResult } from '../hooks/useSmartSearch';

const AUTH_GATE_KEY = 'postalpeek_auth_gate';
const AUTH_GATE_CARDS_KEY = 'postalpeek_auth_cards';

export function WalkerFeed({
  isIdle,
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
  const [isAlbumsModalOpen, setIsAlbumsModalOpen] = useState(false);
  const [statusBarGameOpen, setStatusBarGameOpen] = useState(false);

  const {
    items: baseItems,
    availableCountries,
    isLoading,
    selectedCountry,
    setSelectedCountry,
    hasSharedCard,
    hasMore,
    isFetchingMore,
    fetchMoreFeed,
  } = useWalkerFeed();

  // DEBUG INJECT MOCK TRIVIA
  const items = React.useMemo(() => {
    return baseItems.map((item, i) => {
      if (i === 0 && !item.generation_metadata?.trivia) {
        return {
          ...item,
          generation_metadata: {
            ...(item.generation_metadata || {}),
            trivia: {
              question: { en: 'What is the traditional drink in Argentina?', es: '¿Cuál es la bebida tradicional en Argentina?' },
              options: { en: ['Mate', 'Coffee', 'Tea'], es: ['Mate', 'Café', 'Té'] },
              correct_answer: { en: 'Mate', es: 'Mate' },
              factLink: 'It is a caffeinated drink widely consumed in South America.'
            }
          }
        };
      }
      return item;
    });
  }, [baseItems]);

  // ── Spotlight search state (needs items from useWalkerFeed) ──
  const [spotlightResults, setSpotlightResults] = useState<FeedItem[]>([]);
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [isSpotlightSearching, setIsSpotlightSearching] = useState(false);
  const [smartSearchIntent, setSmartSearchIntent] = useState<SmartSearchResult | null>(null);
  const [isFetchingMoreSpotlight, setIsFetchingMoreSpotlight] = useState(false);
  const [hasMoreSpotlight, setHasMoreSpotlight] = useState(false);
  const [showNoResultsToast, setShowNoResultsToast] = useState(false);
  const spotlightAbortRef = useRef<AbortController | null>(null);
  const SPOTLIGHT_PAGE_SIZE = 30;

  const handleSpotlightSearch = useCallback(async (query: string) => {
    if (spotlightAbortRef.current) spotlightAbortRef.current.abort();
    const controller = new AbortController();
    spotlightAbortRef.current = controller;

    setSpotlightQuery(query);
    setIsSpotlightSearching(true);
    setSpotlightResults([]);
    setSmartSearchIntent(null);
    setHasMoreSpotlight(false);

    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';

      const tagSet = new Set<string>();
      items.forEach((item) => {
        if (item.detailed_tags?.length) {
          item.detailed_tags.forEach((dt: { label?: string | Record<string, string> }) => {
            const lbl = dt.label;
            const name = typeof lbl === 'object' && lbl !== null ? lbl.en || lbl.es || '' : String(lbl || '');
            if (name) tagSet.add(name);
          });
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
      });

      if (error) throw error;
      const results = data || [];
      setSpotlightResults(results);
      setSmartSearchIntent(smartResult);
      if (results.length === SPOTLIGHT_PAGE_SIZE) {
        setHasMoreSpotlight(true);
      }
      
      if (results.length === 0) {
        setShowNoResultsToast(true);
        setTimeout(() => setShowNoResultsToast(false), 4000);
      }
      
      analytics.track('spotlight_pill_searched', { query, results_count: results.length });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.warn('[Spotlight] search failed:', err);
      setSpotlightResults([]);
      setSmartSearchIntent(null);
    } finally {
      setIsSpotlightSearching(false);
    }
  }, [items]);

  const fetchMoreSpotlight = useCallback(async () => {
    if (!smartSearchIntent || isFetchingMoreSpotlight || !hasMoreSpotlight || spotlightResults.length === 0) return;
    
    setIsFetchingMoreSpotlight(true);
    const excludeIds = spotlightResults.map(i => i.id);

    try {
      const { data, error } = await supabase.rpc('postalpeek_spotlight_search_v2', {
        p_tags: smartSearchIntent.tags,
        p_time_of_day: smartSearchIntent.time_of_day,
        p_weather: smartSearchIntent.weather,
        p_scene_type: smartSearchIntent.scene_type,
        p_country: smartSearchIntent.country,
        p_city: smartSearchIntent.city,
        p_rarity: smartSearchIntent.rarity,
        p_free_text: smartSearchIntent.freeTextSearch,
        p_limit: SPOTLIGHT_PAGE_SIZE,
        p_exclude_ids: excludeIds,
        p_require_illustration_tags: true,
      });

      if (error) throw error;
      
      const newItems = (data as FeedItem[]) || [];
      if (newItems.length === 0) {
        setHasMoreSpotlight(false);
        return;
      }
      if (newItems.length < SPOTLIGHT_PAGE_SIZE) {
        setHasMoreSpotlight(false);
      }
      
      setSpotlightResults(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const filteredNew = newItems.filter(p => !existingIds.has(p.id));
        return [...prev, ...filteredNew];
      });
    } catch (error) {
      console.error('Error loading more spotlight results:', error);
      analytics.captureError(error, { context: 'fetch_more_spotlight', query: spotlightQuery });
    } finally {
      setIsFetchingMoreSpotlight(false);
    }
  }, [smartSearchIntent, isFetchingMoreSpotlight, hasMoreSpotlight, spotlightResults, spotlightQuery]);

  const handleSpotlightDismiss = useCallback(() => {
    if (spotlightAbortRef.current) spotlightAbortRef.current.abort();
    setSpotlightResults([]);
    setSpotlightQuery('');
    setSmartSearchIntent(null);
    setIsSpotlightSearching(false);
    setHasMoreSpotlight(false);
    setShowNoResultsToast(false);
  }, []);


  const isFetchingRef = useRef<boolean>(false);
  useEffect(() => {
    isFetchingRef.current = isFetchingMore || isFetchingMoreSpotlight;
  }, [isFetchingMore, isFetchingMoreSpotlight]);


  const [showWelcome] = useState(() => !hasSeenWelcome());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isOnWelcome, _setIsOnWelcome] = useState(showWelcome);

  useEffect(() => {
    onWelcomeChange?.(isOnWelcome);
    if (showWelcome && !isOnWelcome) {
      analytics.track('welcome_scroll_started');
    }
  }, [isOnWelcome, onWelcomeChange, showWelcome]);

  const {
    favoriteIds,
    favoriteItems,
    toggle: toggleFavorite,
  } = useFavorites(user ?? null);

  // ── Collectibles ──
  const { claim, isClaiming, claimStatus, claimedIds } = useClaimPostcard(
    user?.id,
  );
  const {
    collection,
    isLoading: isCollectionLoading,
    refetch: refetchCollection,
  } = useCollection(user?.id);
  // URL-driven navigation
  const navigate = useNavigate();
  const [selectedPostcard, setSelectedPostcard] = useState<FeedItem | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    items: FeedItem[];
    initialIndex: number;
    sourceRect?: DOMRect;
  } | null>(null);
  const location = useLocation();
  const showCollection = location.pathname === '/feed/collection';
  const urlAlbumId = location.pathname.startsWith('/feed/album/') ? location.pathname.split('/')[3] : null;
  const [claimLimitInfo, setClaimLimitInfo] = useState<{
    type: 'daily' | 'monthly';
    used: number;
    limit: number;
  } | null>(null);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);

  // ── Daily Pack (gated by feature flag) ──
  const dailyPackFlag = analytics.getFeatureFlag(FeatureFlags.DAILY_PACK);
  const isDailyPackEnabled = dailyPackFlag === true || dailyPackFlag === 'true';

  const dailyPack = useDailyPack(user?.id);
  // When the flag is off, suppress all daily-pack state
  const packCards = isDailyPackEnabled ? dailyPack.packCards : [];
  const isPackAvailable = isDailyPackEnabled ? dailyPack.isPackAvailable : false;
  const isPackLoading = dailyPack.isLoading;
  const openPack = dailyPack.openPack;
  const clearPack = dailyPack.clearPack;

  // PackDone toast — shown after the last card is revealed, stays 5 seconds
  // Focus mode: hide decorative chrome while spotlight search is active
  const isSpotlightMode = Boolean(spotlightQuery.trim().length > 0 || isSpotlightSearching || spotlightResults.length > 0);



  const handleOpenPack = useCallback(async () => {
    const result = await openPack();
    if (result.success && result.postcards && result.postcards.length > 0) {
      // Pack cards are now handled inline by WalkerCarousel
    }
  }, [openPack]);


  // ── Albums ──
  const {
    albums,
    isLoading: isLoadingAlbums,
    refetch: refetchAlbums,
  } = useAlbums(user?.id);

  // Derived unlocked countries from completed albums
  const unlockedCountries = React.useMemo(() => {
    const set = new Set<string>();
    albums.forEach((album) => {
      if (album.completed_at && album.country) {
        set.add(album.country);
      }
    });
    return set;
  }, [albums]);
  const {
    detail: albumDetail,
    isLoading: isAlbumDetailLoading,
    fetchDetail: fetchAlbumDetail,
    reset: resetAlbumDetail,
  } = useAlbumDetail();
  const [albumPostcardIds, setAlbumPostcardIds] = useState<Set<string>>(
    new Set(),
  );

  // Fetch which postcards belong to albums (slot-based + dynamic match_rules)
  useEffect(() => {
    supabase
      .rpc('postalpeek_get_album_postcard_ids')
      .then(({ data }: { data: string[] | null }) => {
        if (data && Array.isArray(data))
          setAlbumPostcardIds(
            new Set(data),
          );
      });
  }, [albums]);

  // PackDone toast state — declared after albumPostcardIds so inline callbacks compile
  const [showPackDoneToast, setShowPackDoneToast] = useState(false);
  const [packDoneAlbumCount, setPackDoneAlbumCount] = useState(0);

  // Auto-open album detail when URL is /album/:id
  useEffect(() => {
    if (urlAlbumId && !albumDetail) {
      fetchAlbumDetail(urlAlbumId);
    } else if (!urlAlbumId && albumDetail) {
      resetAlbumDetail();
    }
  }, [urlAlbumId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClaimPostcard = useCallback(
    async (postcardId: string) => {
      const result = await claim(postcardId);
      if (result.success) {
        refetchCollection();
        refetchAlbums(); // album progress may have changed

        // Show album toast whenever an album postcard is claimed
        if (albumPostcardIds.has(postcardId)) {
          setShowWelcomeToast(true);
          setTimeout(() => setShowWelcomeToast(false), 8000);
        }
      } else if (result.error === 'DAILY_LIMIT_REACHED') {
        setClaimLimitInfo({
          type: 'daily',
          used: result.daily_used ?? 10,
          limit: result.daily_limit ?? 10,
        });
      } else if (result.error === 'MONTHLY_LIMIT_REACHED') {
        setClaimLimitInfo({
          type: 'monthly',
          used: result.monthly_used ?? 200,
          limit: result.monthly_limit ?? 200,
        });
      }
    },
    [claim, refetchCollection, refetchAlbums, albumPostcardIds],
  );

  // ── Unified flow: Grid (default) → Feed (carousel) ────────────
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);

  // Auto-enter carousel mode for share links
  React.useEffect(() => {
    if (hasSharedCard && items.length > 0 && focusedIndex === null) {
      setFocusedIndex(0);
    }
  }, [hasSharedCard, items.length]);

  // Feed mode: user tapped a card in the grid → show fullscreen carousel
  // Track fullscreen overlay state to hide chrome
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  React.useEffect(() => {
    const handler = (e: Event) => {
      setIsFullscreen((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('postalpeek:fullscreen', handler);
    return () => window.removeEventListener('postalpeek:fullscreen', handler);
  }, []);

  if (focusedIndex !== null) {
    const feedItems = isSpotlightMode && spotlightResults.length > 0
      ? spotlightResults.slice(focusedIndex)
      : items.slice(focusedIndex);

    return (
      <div className='w-full h-full flex flex-col relative bg-[#e6e2da] overflow-hidden'>
        {/* Back button — hidden during fullscreen overlay */}
        {!isFullscreen && (
          <button
            onClick={() => { setFocusedIndex(null); navigate('/feed'); }}
            className='absolute top-3 left-3 z-[60] flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-xs font-semibold border border-white/15 hover:bg-black/60 transition-all shadow-lg cursor-pointer'
          >
            {t({ es: '← Explorar', en: '← Explore' }, lang)}
          </button>
        )}
        <WalkerCarousel
          items={feedItems}
          displayItems={feedItems}

          hasMore={isSpotlightMode && spotlightResults.length > 0 ? hasMoreSpotlight : hasMore}
          isFetchingMore={isSpotlightMode && spotlightResults.length > 0 ? isFetchingMoreSpotlight : isFetchingMore}
          isFetchingRef={isFetchingRef}
          fetchMoreFeed={isSpotlightMode && spotlightResults.length > 0 ? fetchMoreSpotlight : fetchMoreFeed}
          selectedCountry={selectedCountry}
          user={user}
          isAdmin={isAdmin}
          showWelcome={false}
          isOnWelcome={false}
          setIsOnWelcome={() => {}}
          favoriteIds={user ? favoriteIds : new Set()}
          toggleFavorite={user ? toggleFavorite : () => {}}
          setShowAuthGate={() => {}}
          setPendingFavoriteId={() => {}}
          hasSharedCard={false}
          claimedIds={user ? claimedIds : new Set()}
          onClaimPostcard={user ? handleClaimPostcard : undefined}
          isClaimLoading={isClaiming}
          albumPostcardIds={albumPostcardIds}
          packCards={user ? packCards : []}
          isPackAvailable={user ? isPackAvailable : false}
          isPackLoading={isPackLoading}
          onOpenPack={user ? handleOpenPack : undefined}
          onPackComplete={user ? () => {
            const albumCount = packCards.filter(c => albumPostcardIds.has(c.id)).length;
            setPackDoneAlbumCount(albumCount);
            setShowPackDoneToast(true);
            setTimeout(() => {
              setShowPackDoneToast(false);
              clearPack();
              refetchCollection();
              refetchAlbums();
            }, 5000);
          } : undefined}
        />

        {/* Claim Limit Modal */}
        {claimLimitInfo && (
          <ClaimLimitModal
            type={claimLimitInfo.type}
            used={claimLimitInfo.used}
            limit={claimLimitInfo.limit}
            onClose={() => setClaimLimitInfo(null)}
          />
        )}

        {/* Pack Done Toast — lightweight, non-blocking */}
        <AnimatePresence>
          {showPackDoneToast && (
            <motion.div
              key='pack-done-toast'
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className='fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3
                bg-stone-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md
                border border-white/10 max-w-[90vw]'
            >
              <span className='text-xl'>🎉</span>
              <div>
                <p className='text-sm font-semibold leading-tight'>{t({ es: '¡Sobre abierto!', en: 'Envelope opened!' }, lang)}</p>
                {packDoneAlbumCount > 0 && (
                  <p className='text-xs text-amber-400 mt-0.5'>
                    {packDoneAlbumCount === 1 ? t({ es: '1 carta de álbum', en: '1 album card' }, lang) : t({ es: `${packDoneAlbumCount} cartas de álbum`, en: `${packDoneAlbumCount} album cards` }, lang)}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isFullscreen && <LanguageToggle isIdle={isIdle} isOnWelcome={false} />}


      </div>
    );
  }

  // ── Grid mode (default for all users) ───────────────────────────────
  return (
    <div className='w-full h-full flex flex-col relative bg-[#e6e2da] overflow-hidden'>
      <WalkerGrid
        items={items}
        isLoading={isLoading}
        hasMore={hasMore}
        isFetchingMore={isFetchingMore}
        fetchMoreFeed={fetchMoreFeed}
        availableCountries={availableCountries}
        selectedCountry={selectedCountry}
        showWelcome={showWelcome}
        previewCards={items.slice(0, 3)}
        onSelectCountry={(country) => {
          if (country === selectedCountry) return;
          handleSpotlightDismiss();
          setSelectedCountry(country);
          window.history.pushState({}, '', country ? `/feed/country/${encodeURIComponent(country).replace(/%20/g, '-')}` : '/feed');
        }}
        spotlightResults={spotlightResults}
        spotlightQuery={spotlightQuery}
        isSpotlightSearching={isSpotlightSearching}
        onSpotlightSearch={handleSpotlightSearch}
        onSpotlightDismiss={handleSpotlightDismiss}
        onAuthSuccess={() => {
          sessionStorage.removeItem(AUTH_GATE_KEY);
          sessionStorage.removeItem(AUTH_GATE_CARDS_KEY);
        }}
        onCardClick={(index) => {
          setFocusedIndex(index);
          const sourceItems = isSpotlightMode && spotlightResults.length > 0 ? spotlightResults : items;
          const clickedItem = sourceItems[index];
          if (clickedItem) {
            const hash = encodeUuidToHash(clickedItem.id);
            window.history.replaceState(null, '', `/${hash}`);
          }
        }}
        viewedItems={items.slice(0, 5)}
        user={user}
        claimedIds={user ? claimedIds : new Set()}
        unlockedCountries={unlockedCountries}
        onOpenAlbumsModal={() => {
          setIsAlbumsModalOpen(true);
          analytics.track('albums_opened');
        }}
        onToggleCollection={
          user
            ? () => {
                navigate('/feed/collection');
                refetchCollection();
                analytics.track('collection_opened');
              }
            : undefined
        }
      />

      {/* Collection Grid */}
      <AnimatePresence>
        {showCollection && (
          <CollectionGrid
            collection={collection}
            isLoading={isCollectionLoading}
            claimStatus={claimStatus}
            onClose={() => navigate('/feed')}
            onSelectPostcard={setSelectedPostcard}
            albums={albums}
            isLoadingAlbums={isLoadingAlbums}
            favoriteItems={favoriteItems}
            favoriteIds={favoriteIds}
          />
        )}
      </AnimatePresence>

      {/* Album Detail */}
      <AnimatePresence>
        {albumDetail && (
          <AlbumDetail
            detail={albumDetail}
            isLoading={isAlbumDetailLoading}
            onClose={() => navigate(showCollection ? '/feed/collection' : '/feed')}
          />
        )}
      </AnimatePresence>

      {/* Image Lightbox — fullscreen swipeable gallery */}
      <AnimatePresence>
        {lightboxState && (
          <ImageLightbox
            items={lightboxState.items}
            initialIndex={lightboxState.initialIndex}
            sourceRect={lightboxState.sourceRect}
            onClose={() => setLightboxState(null)}
            onOpenDetail={(item) => {
              setLightboxState(null);
              setSelectedPostcard(item);
            }}
          />
        )}
      </AnimatePresence>

      {/* Postcard Detail / Validation Modal */}
      <AnimatePresence>
        {selectedPostcard && (
          <PostcardDetailModal
            item={selectedPostcard}
            onClose={() => setSelectedPostcard(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAlbumsModalOpen && (
          <AlbumsModal
            albums={albums}
            isLoading={isLoadingAlbums}
            onClose={() => setIsAlbumsModalOpen(false)}
            onSelectAlbum={(album) => {
              setIsAlbumsModalOpen(false);
              navigate(`/album/${album.id}`);
            }}
          />
        )}
      </AnimatePresence>

      {/* Welcome Toast — after first login */}
      <AnimatePresence>
        {showWelcomeToast && (
          <WelcomeToast
            onOpenAlbums={() => {
              setShowWelcomeToast(false);
              if (albums.length > 0) {
                navigate(`/album/${albums[0].id}`);
              } else {
                navigate('/feed/collection');
                refetchCollection();
              }
              refetchAlbums();
              analytics.track('welcome_toast_albums_opened');
            }}
            onDismiss={() => setShowWelcomeToast(false)}
          />
        )}
      </AnimatePresence>

      {/* Search No Results Toast */}
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
              <p className='text-sm font-semibold leading-tight'>{t({ es: 'Sin resultados', en: 'No results' }, lang)}</p>
              <p className='text-xs text-stone-300 mt-0.5 max-w-[200px] truncate'>
                {t({ es: 'Mostrando sugerencias', en: 'Showing suggestions' }, lang)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status Bar (logged-in users, grid mode only) ── */}
      <AnimatePresence>
        {user && !isSpotlightMode && !showWelcome && (
          <StatusBar
            albums={albums}
            collectionCount={collection.length}
            onAlbumTap={(album) => {
              navigate(`/album/${album.id}`);
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

      {/* Game Selector from Status Bar */}
      <PostcardGameSelector
        open={statusBarGameOpen}
        hasHuntMode={false}
        onSelect={(mode: GameMode) => {
          setStatusBarGameOpen(false);
          // Pick a random postcard from collection to play with
          if (collection.length > 0) {
            const randomIndex = Math.floor(Math.random() * collection.length);
            setFocusedIndex(randomIndex);
            analytics.track('statusbar_game_started', { mode });
          }
        }}
        onClose={() => setStatusBarGameOpen(false)}
      />

      {/* Language Toggle */}
      <LanguageToggle isIdle={isIdle} isOnWelcome={false} />
    </div>
  );
}

import { LanguageToggle } from './ui/LanguageToggle';

