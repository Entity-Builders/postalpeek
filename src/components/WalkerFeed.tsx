import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useWalkerFeed } from '../hooks/useWalkerFeed';
import { useClaimPostcard } from '../hooks/useClaimPostcard';
import { useCollection } from '../hooks/useCollection';
import { useAlbums } from '../hooks/useAlbums';
import { useAlbumDetail } from '../hooks/useAlbumDetail';
import { useDailyPack } from '../hooks/useDailyPack';
import type { FeedItem } from './Postcard';
import { WalkerCarousel } from './WalkerCarousel';
import { WalkerFilterMenu } from './WalkerFilterMenu';
import {
  WalkerLoadingState,
  WalkerEmptyState,
} from './WalkerFeedStates';
import { AuthGateModal } from './AuthGateModal';
import { AlbumsModal } from './AlbumsModal';
import { ClaimLimitModal } from './ClaimLimitModal';
import { CollectionGrid } from './CollectionGrid';
import { AlbumDetail } from './AlbumDetail';
import { PostcardDetailModal } from './PostcardDetailModal';
import { ImageLightbox } from './ImageLightbox';
import { DailyPackButton } from './DailyPackButton';
import { SpotlightPill } from './SpotlightPill';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import { WelcomeToast } from './WelcomeToast';
import { useFavorites } from '@eb-packages/logic/src/hooks/useFavorites';
import { analytics } from '../lib/analytics';
import { supabase } from '@eb-packages/logic/src/supabase';
import { AnimatePresence } from 'framer-motion';
import { AdminToolbar } from './AdminToolbar';
import { useLang, toggleLang } from '../utils/i18n';
import type { SmartSearchResult } from '../hooks/useSmartSearch';

const FREE_CARD_LIMIT = 5;
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
  const [isAlbumsModalOpen, setIsAlbumsModalOpen] = useState(false);

  const {
    items,
    availableCountries,
    isLoading,
    setIsLoading,
    selectedCountry,
    setSelectedCountry,
    hasSharedCard,
    hasMore,
    isFetchingMore,
    fetchMoreFeed,
    refetchFeed,
  } = useWalkerFeed();

  // ── Spotlight search state (needs items from useWalkerFeed) ──
  const [spotlightResults, setSpotlightResults] = useState<FeedItem[]>([]);
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [isSpotlightSearching, setIsSpotlightSearching] = useState(false);
  const spotlightAbortRef = useRef<AbortController | null>(null);

  const handleSpotlightSearch = useCallback(async (query: string) => {
    if (spotlightAbortRef.current) spotlightAbortRef.current.abort();
    const controller = new AbortController();
    spotlightAbortRef.current = controller;

    setSpotlightQuery(query);
    setIsSpotlightSearching(true);
    setSpotlightResults([]);

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

      const { data, error } = await supabase.rpc('postalpeek_spotlight_search', {
        p_tags: smartResult.tags,
        p_time_of_day: smartResult.time_of_day,
        p_weather: smartResult.weather,
        p_scene_type: smartResult.scene_type,
        p_country: smartResult.country,
        p_city: smartResult.city,
        p_rarity: smartResult.rarity,
        p_free_text: smartResult.freeTextSearch,
        p_limit: 4,
      });

      if (error) throw error;
      setSpotlightResults(data || []);
      analytics.track('spotlight_pill_searched', { query, results_count: (data || []).length });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.warn('[Spotlight] search failed:', err);
      setSpotlightResults([]);
    } finally {
      setIsSpotlightSearching(false);
    }
  }, [items]);

  const handleSpotlightDismiss = useCallback(() => {
    if (spotlightAbortRef.current) spotlightAbortRef.current.abort();
    setSpotlightResults([]);
    setSpotlightQuery('');
    setIsSpotlightSearching(false);
  }, []);


  const isFetchingRef = useRef<boolean>(false);
  useEffect(() => {
    isFetchingRef.current = isFetchingMore;
  }, [isFetchingMore]);

  const [showAuthGate, setShowAuthGate] = useState(() => {
    return !user && sessionStorage.getItem(AUTH_GATE_KEY) === 'true';
  });
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(
    null,
  );
  const [showWelcome] = useState(() => !hasSeenWelcome());
  const [isOnWelcome, setIsOnWelcome] = useState(showWelcome);

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
  const showCollection = location.pathname === '/collection';
  const urlAlbumId = location.pathname.startsWith('/album/') ? location.pathname.split('/')[2] : null;
  const [claimLimitInfo, setClaimLimitInfo] = useState<{
    type: 'daily' | 'monthly';
    used: number;
    limit: number;
  } | null>(null);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);

  // ── Daily Pack ──
  const {
    packCards,
    isPackAvailable,
    isLoading: isPackLoading,
    openPack,
    clearPack,
  } = useDailyPack(user?.id);

  const isPackMode = packCards.length > 0;
  // Focus mode: hide decorative chrome while spotlight search is active
  const isSpotlightMode = spotlightResults.length > 0 || isSpotlightSearching;



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

  return (
    <div className='w-full h-full flex flex-col items-center justify-center relative bg-[#e6e2da] overflow-hidden'>
      {!isOnWelcome && !isSpotlightMode && (
        <WalkerFilterMenu
          isIdle={isIdle}
          availableCountries={availableCountries}
          unlockedCountries={unlockedCountries}
          selectedCountry={selectedCountry}
          onSelectCountry={(country) => {
            if (country === selectedCountry) return;
            setIsLoading(true);
            if (country === null) {
              window.history.pushState({}, '', '/');
            } else {
              const countrySlug = encodeURIComponent(country).replace(/%20/g, '-');
              window.history.pushState({}, '', `/${countrySlug}`);
            }
          }}
          onOpenAlbumsModal={() => {
            setIsAlbumsModalOpen(true);
            analytics.track('albums_opened');
          }}
          isLoggedIn={!!user}
          onToggleCollection={
            user
              ? () => {
                  navigate('/collection');
                  refetchCollection();
                  analytics.track('collection_opened');
                }
              : undefined
          }
        />
      )}



      {isLoading && !showWelcome ? (
        <WalkerLoadingState />
      ) : items.length === 0 && !showWelcome ? (
        <WalkerEmptyState 
          onClearFilter={selectedCountry ? () => {
            setIsLoading(true);
            setSelectedCountry(null);
          } : undefined} 
          onUnlockMore={() => {
             alert('¡Vuelve pronto para ver más postales!');
             analytics.track('unlock_feed_clicked');
          }}
        />
      ) : (
        <WalkerCarousel
          items={items}
          displayItems={items}
          spotlightResults={spotlightResults}
          spotlightQuery={spotlightQuery}
          hasMore={hasMore}
          isFetchingMore={isFetchingMore}
          isFetchingRef={isFetchingRef}
          fetchMoreFeed={fetchMoreFeed}
          selectedCountry={selectedCountry}
          user={user}
          isAdmin={isAdmin}
          showWelcome={showWelcome}
          isOnWelcome={isOnWelcome}
          setIsOnWelcome={setIsOnWelcome}
          favoriteIds={favoriteIds}
          toggleFavorite={toggleFavorite}
          setShowAuthGate={setShowAuthGate}
          setPendingFavoriteId={setPendingFavoriteId}
          hasSharedCard={hasSharedCard}
          claimedIds={claimedIds}
          onClaimPostcard={handleClaimPostcard}
          isClaimLoading={isClaiming}
          albumPostcardIds={albumPostcardIds}
          packCards={packCards}
          onPackComplete={() => {
            clearPack();
            refetchCollection();
            refetchAlbums();
          }}
          onSelectPostcard={setSelectedPostcard}
        />
      )}

      {showAuthGate && (
        <AuthGateModal
          onSuccess={() => {
            setShowAuthGate(false);
            sessionStorage.removeItem(AUTH_GATE_KEY);
            sessionStorage.removeItem(AUTH_GATE_CARDS_KEY);
            if (pendingFavoriteId) {
              setTimeout(() => {
                toggleFavorite(pendingFavoriteId);
                setPendingFavoriteId(null);
              }, 500);
            }
            // First-time user: show welcome toast after a short delay
            if (showWelcome) {
              setTimeout(() => {
                setShowWelcomeToast(true);
                // Auto-dismiss after 8s
                setTimeout(() => setShowWelcomeToast(false), 8000);
              }, 1500);
            }
          }}
          viewedItems={
            items.length > 0
              ? items.slice(0, FREE_CARD_LIMIT)
              : (() => {
                  try {
                    const cached = sessionStorage.getItem(AUTH_GATE_CARDS_KEY);
                    return cached ? JSON.parse(cached) : [];
                  } catch {
                    return [];
                  }
                })()
          }
        />
      )}

      {/* Claim Limit Modal */}
      {claimLimitInfo && (
        <ClaimLimitModal
          type={claimLimitInfo.type}
          used={claimLimitInfo.used}
          limit={claimLimitInfo.limit}
          onClose={() => setClaimLimitInfo(null)}
        />
      )}

      {/* Collection Grid */}
      <AnimatePresence>
        {showCollection && (
          <CollectionGrid
            collection={collection}
            isLoading={isCollectionLoading}
            claimStatus={claimStatus}
            onClose={() => navigate('/')}
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
            onClose={() => navigate(showCollection ? '/collection' : '/')}
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
              // Open first album detail directly
              if (albums.length > 0) {
                navigate(`/album/${albums[0].id}`);
              } else {
                navigate('/collection');
                refetchCollection();
              }
              refetchAlbums();
              analytics.track('welcome_toast_albums_opened');
            }}
            onDismiss={() => setShowWelcomeToast(false)}
          />
        )}
      </AnimatePresence>

      {/* AI Spotlight Pill — floating between filter bar and card */}
      {!isPackMode && !showCollection && !isOnWelcome && (
        <div className='absolute z-[49] left-1/2 -translate-x-1/2'
          style={{ top: '64px', width: 'min(95vw, 480px)' }}>
          <SpotlightPill
            isVisible={!isIdle}
            isActive={spotlightResults.length > 0 || isSpotlightSearching}
            onSearch={handleSpotlightSearch}
            onDismiss={handleSpotlightDismiss}
            isSearching={isSpotlightSearching}
          />
        </div>
      )}

      {/* Daily Pack — floating button (hidden during pack mode and spotlight mode) */}
      {!isPackMode && !isSpotlightMode && (
        <DailyPackButton
          isAvailable={isPackAvailable}
          isLoading={isPackLoading}
          onOpen={handleOpenPack}
        />
      )}
      {/* Admin Toolbar — only visible when isAdmin */}
      <AdminToolbar
        isAdmin={isAdmin}
        user={user}
        onPostcardGenerated={refetchFeed}
      />

      {/* Language Toggle — hidden during spotlight focus mode */}
      {!isSpotlightMode && <LanguageToggle isIdle={isIdle} isOnWelcome={isOnWelcome} />}
    </div>
  );
}

/* ── Floating Language Toggle ─────────────────────── */
function LanguageToggle({ isIdle, isOnWelcome }: { isIdle?: boolean; isOnWelcome: boolean }) {
  const lang = useLang();
  return (
    <button
      className={`absolute bottom-6 left-4 z-50 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border transition-all duration-700 cursor-pointer
        bg-black/30 text-white/80 border-white/15 hover:bg-black/50 hover:text-white shadow-lg
        ${isIdle || isOnWelcome ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      onClick={() => toggleLang()}
      title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      <span className={lang === 'es' ? 'text-white' : 'text-white/40'}>ES</span>
      <span className='text-white/30'>|</span>
      <span className={lang === 'en' ? 'text-white' : 'text-white/40'}>EN</span>
    </button>
  );
}

