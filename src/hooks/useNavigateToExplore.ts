/**
 * useNavigateToExplore.ts
 *
 * Hook that wraps "navigate to /explore" with a Street View availability
 * preflight check. If no imagery is available at a given location, the
 * navigation is aborted and an onUnavailable callback is triggered instead
 * (so the caller can show a toast, pick a different destination, etc.).
 *
 * Uses the Street View Metadata API (free tier, no billable call).
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkStreetViewAvailability } from '../components/explorer-utils';
import type { FeedItem } from '../components/Postcard';
import { getStreetViewPanoId } from '../utils/streetViewPov';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

interface UseNavigateToExploreOptions {
  /** Called when imagery is confirmed unavailable (not on network error). */
  onUnavailable?: (item: FeedItem) => void;
  /** Called while the preflight check is running. */
  onChecking?: () => void;
  /** Called once the check is resolved (regardless of outcome). */
  onCheckDone?: () => void;
}

export function useNavigateToExplore(options: UseNavigateToExploreOptions = {}) {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);

  const navigateToExplore = useCallback(
    async (item: FeedItem) => {
      setIsChecking(true);
      options.onChecking?.();

      const available = await checkStreetViewAvailability({
        panoId: getStreetViewPanoId(item.streetview_pov),
        lat: item.lat,
        lng: item.lng,
        mapsKey: MAPS_KEY,
      });

      setIsChecking(false);
      options.onCheckDone?.();

      if (!available) {
        options.onUnavailable?.(item);
        return;
      }

      navigate(`/explore?id=${item.id}`);
    },
    [navigate, options],
  );

  return { navigateToExplore, isChecking };
}
