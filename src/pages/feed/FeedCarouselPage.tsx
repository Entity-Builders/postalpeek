import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFeedContext } from './FeedLayout';
import { WalkerCarousel } from '../../components/WalkerCarousel';
import { useDailyPack } from '../../hooks/useDailyPack';
import { useLang, t } from '../../utils/i18n';
import { analytics } from '../../lib/analytics';
import { FeatureFlags } from '../../lib/featureFlags';
import { useGameMode } from '../../contexts/GameModeContext';
import { AnimatePresence, motion } from 'framer-motion';

function FeedBackButton({
  isFullscreen,
  navigate,
  lang,
}: {
  isFullscreen: boolean;
  navigate: ReturnType<typeof useNavigate>;
  lang: ReturnType<typeof useLang>;
}) {
  const { isGameActive } = useGameMode();
  if (isFullscreen) return null;

  return (
    <button
      onClick={() => navigate('/feed')}
      className='absolute top-3 left-3 z-[60] flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-xs font-semibold border border-white/15 hover:bg-black/60 transition-all shadow-lg cursor-pointer'
    >
      {t(
        isGameActive
          ? { es: '← Salir', en: '← Exit' }
          : { es: '← Explorar', en: '← Explore' },
        lang,
      )}
    </button>
  );
}

export function FeedCarouselPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lang = useLang();
  
  const focusedIndex = parseInt(searchParams.get('index') || '0', 10);
  const isSpotlightFilter = searchParams.get('spotlight') === '1';

  const {
      items, hasMore, isFetchingMore, fetchMoreFeed,
      selectedCountry,
      spotlightResults, isSpotlightMode,
      user, isAdmin, favoriteIds, toggleFavorite,
      claimedIds, claim, isClaiming,
      refetchCollection, refetchAlbums
  } = useFeedContext();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFetchingRef = useRef(isFetchingMore);
  useEffect(() => { isFetchingRef.current = isFetchingMore; }, [isFetchingMore]);

  useEffect(() => {
    const handler = (e: Event) => {
      setIsFullscreen((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('postalpeek:fullscreen', handler);
    return () => window.removeEventListener('postalpeek:fullscreen', handler);
  }, []);

  // Compute feed items based on where user entered
  const sourceItems = (isSpotlightMode || isSpotlightFilter) && spotlightResults.length > 0 
      ? spotlightResults 
      : items;
  
  const feedItems = sourceItems.slice(focusedIndex);

  // Pack specific logic (moved here since it was highly coupled to carousel rendering before)
  const dailyPackFlag = analytics.getFeatureFlag(FeatureFlags.DAILY_PACK);
  const isDailyPackEnabled = dailyPackFlag === true || dailyPackFlag === 'true';
  const dailyPack = useDailyPack(user?.id);
  const packCards = isDailyPackEnabled ? dailyPack.packCards : [];
  const isPackAvailable = isDailyPackEnabled ? dailyPack.isPackAvailable : false;
  const isPackLoading = dailyPack.isLoading;
  const openPack = dailyPack.openPack;
  const clearPack = dailyPack.clearPack;

  const handleOpenPack = useCallback(async () => {
    await openPack();
  }, [openPack]);

  const [showPackDoneToast, setShowPackDoneToast] = useState(false);
  // Removed unused state hook here and just defaulting
  const albumPostcardIds = new Set<string>();

  const handleClaimPostcard = useCallback(async (id: string) => {
     // Re-implementing the simple version or delegating to the context logic
     // Context provides `claim`, we just invoke it and handle simple side-effect refetches.
     const res = await claim(id);
     if (res.success) {
         refetchCollection();
         refetchAlbums();
     }
  }, [claim, refetchCollection, refetchAlbums]);

  return (
    <div className='w-full h-full flex flex-col relative bg-[#e6e2da] overflow-hidden'>
      <FeedBackButton isFullscreen={isFullscreen} navigate={navigate} lang={lang} />
      
      <WalkerCarousel
          items={feedItems}
          displayItems={feedItems}
          hasMore={hasMore}
          isFetchingMore={isFetchingMore}
          isFetchingRef={isFetchingRef}
          fetchMoreFeed={fetchMoreFeed}
          selectedCountry={selectedCountry}
          user={user}
          isAdmin={isAdmin}
          showWelcome={false}
          isOnWelcome={false}
          setIsOnWelcome={() => {}}
          favoriteIds={user ? favoriteIds : new Set()}
          toggleFavorite={user ? (id: string) => toggleFavorite(id, !favoriteIds.has(id)) : async () => {}}
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
             setShowPackDoneToast(true);
             setTimeout(() => {
                setShowPackDoneToast(false);
                clearPack();
                refetchCollection();
                refetchAlbums();
             }, 5000);
          } : undefined}
      />

      {/* Pack Done Toast */}
      <AnimatePresence>
        {showPackDoneToast && (
          <motion.div
            key='pack-done-toast'
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className='fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-stone-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md'
          >
            <span className='text-xl'>🎉</span>
            <div><p className='text-sm font-semibold'>¡Sobre abierto!</p></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
