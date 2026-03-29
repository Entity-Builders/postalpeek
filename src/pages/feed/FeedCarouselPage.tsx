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
      refetchCollection, refetchAlbums, handleAuthRequiredAction,
      showWelcome, setShowWelcome
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
  const [claimToast, setClaimToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const albumPostcardIds = new Set<string>();

  const handleClaimPostcard = useCallback(async (id: string, cost?: number) => {
     const res = await claim(id, cost);
     if (res.success) {
         setClaimToast({ type: 'success', message: `¡Postal Sellada! Costo: ${res.stamp_cost ?? 2} Sellos` });
         refetchCollection();
         refetchAlbums();
     } else {
         if (res.error === 'INSUFFICIENT_STAMPS') {
             setClaimToast({ type: 'error', message: `Necesitas ${res.stamp_cost ?? 2} Sellos (Tienes ${res.balance ?? 0}). ¡A Jugar!` });
         } else if (res.error === 'ALREADY_CLAIMED') {
             setClaimToast({ type: 'error', message: 'Ya tienes esta postal.' });
         } else {
             setClaimToast({ type: 'error', message: 'Ups! Hubo un error al sellar.' });
         }
     }
     setTimeout(() => setClaimToast(null), 4000);
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
          showWelcome={showWelcome}
          setShowWelcome={setShowWelcome}
          isOnWelcome={false}
          setIsOnWelcome={() => {}}
          favoriteIds={user ? favoriteIds : new Set()}
          toggleFavorite={user ? (id: string) => toggleFavorite(id) : async () => {}}
          setShowAuthGate={() => {}}
          setPendingFavoriteId={() => {}}
          hasSharedCard={false}
          claimedIds={user ? claimedIds : new Set()}
          onClaimPostcard={(id, cost) => handleAuthRequiredAction(() => {
            if (user) handleClaimPostcard(id, cost);
          })}
          isClaimLoading={isClaiming}
          albumPostcardIds={albumPostcardIds}
          packCards={user ? packCards : []}
          isPackAvailable={user ? isPackAvailable : false}
          isPackLoading={isPackLoading}
          onOpenPack={() => handleAuthRequiredAction(() => {
            if (user) handleOpenPack();
          })}
          onPackComplete={() => handleAuthRequiredAction(() => {
            if (user) {
               setShowPackDoneToast(true);
               setTimeout(() => {
                  setShowPackDoneToast(false);
                  clearPack();
                  refetchCollection();
                  refetchAlbums();
               }, 5000);
            }
          })}
      />

      {/* Claim Result Toast */}
      <AnimatePresence>
        {claimToast && (
          <motion.div
            key='claim-toast'
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border pointer-events-none ${
              claimToast.type === 'success' ? 'bg-indigo-900/90 border-indigo-500/30 text-white' : 'bg-rose-900/90 border-rose-500/30 text-white'
            }`}
          >
            <div className='flex flex-col'>
              <span className='text-sm font-bold tracking-wide'>{claimToast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
