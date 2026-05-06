import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedContext } from './FeedLayout';
import { WalkerGrid } from '../../components/WalkerGrid';
import { AnimatePresence, motion } from 'framer-motion';
import { ProfileWidget } from '../../components/ProfileWidget';

const AUTH_GATE_KEY = 'postalpeek_auth_gate';
const AUTH_GATE_CARDS_KEY = 'postalpeek_auth_cards';

export function FeedGridPage() {
  const navigate = useNavigate();
  const {
      items, isLoading, hasMore, isFetchingMore, fetchMoreFeed,
      availableCountries, selectedCountry, setSelectedCountry,
      showWelcome, spotlightResults, spotlightQuery, isSpotlightSearching,
      handleSpotlightSearch, handleSpotlightDismiss, isSpotlightMode,
      user, claimedIds, unlockedCountries,
      claim, refetchCollection, refetchAlbums, handleAuthRequiredAction
  } = useFeedContext();

  const [claimToast, setClaimToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleClaimPostcard = useCallback(async (id: string, rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common') => {
     const res = await claim(id, rarity);
     if (res.success) {
         setClaimToast({ type: 'success', message: `¡Postal Sellada!` });
         refetchCollection();
         refetchAlbums();
     } else {
         if (res.error === 'INSUFFICIENT_STAMPS') {
             setClaimToast({ type: 'error', message: `No tienes sellos ${rarity}s. ¡A Jugar!` });
         } else if (res.error === 'ALREADY_CLAIMED') {
             setClaimToast({ type: 'error', message: 'Ya tienes esta postal.' });
         } else {
             setClaimToast({ type: 'error', message: 'Ups! Hubo un error al sellar.' });
         }
     }
     setTimeout(() => setClaimToast(null), 4000);
  }, [claim, refetchCollection, refetchAlbums]);

  return (
    <>
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
          if (country) {
            navigate(`/feed/country/${encodeURIComponent(country).replace(/%20/g, '-')}`);
          } else {
            navigate('/feed');
          }
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
          const sourceItems =
            isSpotlightMode && spotlightResults.length > 0
              ? spotlightResults
              : items;
          const clickedItem = sourceItems[index];
          if (clickedItem) {
            navigate(`/feed/carousel?index=${index}${isSpotlightMode ? '&spotlight=1' : ''}`);
          }
        }}
        viewedItems={items.slice(0, 5)}
        user={user}
        claimedIds={user ? claimedIds : new Set()}
        unlockedCountries={unlockedCountries}
        viewMode="grid"
        onToggleViewMode={() => navigate('/feed/carousel')}
        onClaimPostcard={(id, rarity) => handleAuthRequiredAction(() => {
          if (user) handleClaimPostcard(id, rarity);
        })}
        profileWidgetNode={<ProfileWidget handleAuthRequiredAction={handleAuthRequiredAction} />}
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
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border pointer-events-none ${
              claimToast.type === 'success' ? 'bg-indigo-900/90 border-indigo-500/30 text-white' : 'bg-rose-900/90 border-rose-500/30 text-white'
            }`}
          >
            <div className='flex flex-col'>
              <span className='text-sm font-bold tracking-wide'>{claimToast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
