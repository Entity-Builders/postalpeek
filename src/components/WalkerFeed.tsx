import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { useWalkerFeed } from '../hooks/useWalkerFeed';
import { useClaimPostcard } from '../hooks/useClaimPostcard';
import { useCollection } from '../hooks/useCollection';
import { WalkerCarousel } from './WalkerCarousel';
import { WalkerFilterMenu } from './WalkerFilterMenu';
import {
  WalkerLoadingState,
  TripCoverLoadingState,
  WalkerEmptyState,
  WalkerFavoritesEmptyState,
  WalkerTripsEmptyState,
} from './WalkerFeedStates';
import { AuthGateModal } from './AuthGateModal';
import { ClaimLimitModal } from './ClaimLimitModal';
import { CollectionGrid } from './CollectionGrid';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import { useFavorites } from '@eb-packages/logic/src/hooks/useFavorites';
import { analytics } from '../lib/analytics';
import { preSignUrls } from '../utils/imageUtils';
import { AnimatePresence } from 'framer-motion';

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
  const [showTripsOnly, setShowTripsOnly] = useState(false);

  const {
    items,
    availableCountries,
    isLoading,
    setIsLoading,
    selectedCountry,
    setSelectedCountry,
    isFetchingMore,
    hasMore,
    fetchMoreFeed,
    prefetchCountry,
    loadedIdsRef,
    isFetchingRef,
    hasSharedCard,
  } = useWalkerFeed(showTripsOnly);

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
  }, [isOnWelcome, onWelcomeChange]);

  const {
    favoriteIds,
    favoriteItems,
    toggle: toggleFavorite,
  } = useFavorites(user ?? null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // ── Collectibles ──
  const { claim, isClaiming, claimStatus, claimedIds } = useClaimPostcard(user?.id);
  const { collection, isLoading: isCollectionLoading, refetch: refetchCollection } = useCollection(user?.id);
  const [showCollection, setShowCollection] = useState(false);
  const [claimLimitInfo, setClaimLimitInfo] = useState<{ type: 'daily' | 'monthly'; used: number; limit: number } | null>(null);

  const handleClaimPostcard = useCallback(async (postcardId: string) => {
    const result = await claim(postcardId);
    if (result.success) {
      // Refetch collection in background
      refetchCollection();
    } else if (result.error === 'DAILY_LIMIT_REACHED') {
      setClaimLimitInfo({ type: 'daily', used: result.daily_used ?? 10, limit: result.daily_limit ?? 10 });
    } else if (result.error === 'MONTHLY_LIMIT_REACHED') {
      setClaimLimitInfo({ type: 'monthly', used: result.monthly_used ?? 200, limit: result.monthly_limit ?? 200 });
    }
  }, [claim, refetchCollection]);

  useEffect(() => {
    if (!user) setShowFavoritesOnly(false);
    // trips filter is independent of auth, no reset needed
  }, [user]);

  useEffect(() => {
    if (favoriteItems.length > 0) {
      preSignUrls(
        favoriteItems.flatMap((i) =>
          [i.illustration_url, i.original_image_url].filter(Boolean),
        ),
      ).catch((err) =>
        console.error('Failed to pre-sign favorite items URLs', err),
      );
    }
  }, [favoriteItems]);

  const displayItems = useMemo(() => {
    if (showFavoritesOnly) return favoriteItems;
    if (showTripsOnly) return items.filter((item) => item.trip_id);
    return items;
  }, [items, showFavoritesOnly, showTripsOnly, favoriteItems]);

  return (
    <div className='w-full h-full flex flex-col items-center justify-center relative bg-[#e6e2da] overflow-hidden'>
      {!isOnWelcome && (
        <WalkerFilterMenu
          isIdle={isIdle}
          availableCountries={availableCountries}
          selectedCountry={selectedCountry}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => {
            setShowFavoritesOnly((prev) => {
              const next = !prev;
              if (next) setShowTripsOnly(false);
              analytics.track('filter_changed', { favorites_only: next });
              return next;
            });
          }}
          showTripsOnly={showTripsOnly}
          onToggleTrips={() => {
            setShowTripsOnly((prev) => {
              const next = !prev;
              if (next) setShowFavoritesOnly(false);
              analytics.track('filter_changed', { trips_only: next });
              return next;
            });
          }}
          isLoggedIn={!!user}
          onToggleCollection={user ? () => {
            setShowCollection(true);
            refetchCollection();
            analytics.track('collection_opened');
          } : undefined}
          onHoverCountry={prefetchCountry}
          onSelectCountry={(country) => {
            if (country === selectedCountry) {
              setShowFavoritesOnly(false);
              return;
            }
            setShowFavoritesOnly(false);
            setShowTripsOnly(false);
            setIsLoading(true);
            loadedIdsRef.current = [];
            isFetchingRef.current = false;

            setSelectedCountry((prev) => {
              analytics.track('filter_changed', {
                previous_country: prev,
                country: country,
              });
              return country;
            });

            if (country === null) {
              window.history.pushState({}, '', '/');
            } else {
              const countrySlug = encodeURIComponent(country).replace(
                /%20/g,
                '-',
              );
              window.history.pushState({}, '', `/${countrySlug}`);
            }
          }}
        />
      )}

      {isLoading && !showWelcome ? (
        showTripsOnly ? <TripCoverLoadingState /> : <WalkerLoadingState />
      ) : displayItems.length === 0 && !showWelcome ? (
        showFavoritesOnly ? (
          <WalkerFavoritesEmptyState />
        ) : showTripsOnly ? (
          <WalkerTripsEmptyState />
        ) : (
          <WalkerEmptyState />
        )
      ) : (
        <WalkerCarousel
          items={items}
          displayItems={displayItems}
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
          showFavoritesOnly={showFavoritesOnly}
          showTripsOnly={showTripsOnly}
          hasSharedCard={hasSharedCard}
          claimedIds={claimedIds}
          onClaimPostcard={handleClaimPostcard}
          isClaimLoading={isClaiming}
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
            onClose={() => setShowCollection(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
