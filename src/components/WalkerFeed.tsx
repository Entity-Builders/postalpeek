import React, { useState, useEffect, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { useWalkerFeed } from '../hooks/useWalkerFeed';
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
import { hasSeenWelcome } from '../utils/welcomeStorage';
import { useFavorites } from '@eb-packages/logic/src/hooks/useFavorites';
import { analytics } from '../lib/analytics';
import { preSignUrls } from '../utils/imageUtils';

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
    </div>
  );
}
