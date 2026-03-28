import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedContext } from './FeedLayout';
import { WalkerGrid } from '../../components/WalkerGrid';
import { analytics } from '../../lib/analytics';

const AUTH_GATE_KEY = 'postalpeek_auth_gate';
const AUTH_GATE_CARDS_KEY = 'postalpeek_auth_cards';

export function FeedGridPage() {
  const navigate = useNavigate();
  const {
      items, isLoading, hasMore, isFetchingMore, fetchMoreFeed,
      availableCountries, selectedCountry, setSelectedCountry,
      showWelcome, spotlightResults, spotlightQuery, isSpotlightSearching,
      handleSpotlightSearch, handleSpotlightDismiss, isSpotlightMode,
      user, claimedIds, unlockedCountries, setIsAlbumsModalOpen
  } = useFeedContext();

  return (
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
        onOpenAlbumsModal={() => {
          setIsAlbumsModalOpen(true);
          analytics.track('albums_opened');
        }}
        viewMode="grid"
        onToggleViewMode={() => navigate('/feed/carousel')}
      />
  );
}
