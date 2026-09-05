/**
 * ExplorePage.tsx
 *
 * Minimal full-screen page that loads ViewfinderPanel directly.
 * Replaces the heavy 3D Globe with instant Street View access.
 *
 * Features a "Teleport Intro" — a globe zoom animation that plays
 * before the Street View loads, giving the user the sensation of
 * zooming into the planet.
 *
 * Usage:
 *   /explore?id=<postcard-id>   → opens that specific location
 *   /explore                    → picks a random location from the feed
 *
 * ref #97
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFeedContext } from './FeedLayout';
import { ViewfinderPanel } from '../../components/viewfinder/ViewfinderPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang, t } from '../../utils/i18n';
import { analytics } from '../../lib/analytics';
import { MapPinOff } from 'lucide-react';
import { supabase } from '@entity-builders/logic/src/supabase';
import type { FeedItem } from '../../components/Postcard';
import {
  getStreetViewPanoId,
  type StreetViewPovLike,
} from '../../utils/streetViewPov';

function pickRandomWithPano(items: any[]) {
  // Any item with coordinates
  const withCoords = items.filter((i) => i.lat != null && i.lng != null);
  if (withCoords.length > 0) {
    return withCoords[Math.floor(Math.random() * withCoords.length)];
  }
  return null;
}

type UserPostcardRow = {
  id: string;
  country: string | null;
  city: string | null;
  location_name: string | null;
  lat: number;
  lng: number;
  original_image_url: string;
  illustration_url: string | null;
  category: string | null;
  description: string | null;
  created_at: string;
  creator_name: string | null;
  heading: number | null;
  pitch: number | null;
  fov: number | null;
  generation_metadata: Record<string, unknown> | null;
  source?: Partial<FeedItem> | Partial<FeedItem>[] | null;
};

function sourceFromUserPostcard(row: UserPostcardRow) {
  return Array.isArray(row.source) ? row.source[0] : row.source;
}

function userPostcardToFeedItem(row: UserPostcardRow): FeedItem {
  const source = sourceFromUserPostcard(row);
  const storedPov = row.generation_metadata?.streetview_pov as
    | StreetViewPovLike
    | undefined;
  const sourcePov = source?.streetview_pov as StreetViewPovLike | undefined;
  const panoId = getStreetViewPanoId(storedPov) || getStreetViewPanoId(sourcePov);

  return {
    id: row.id,
    country: row.country || source?.country || '',
    city: row.city || source?.city || '',
    location_name: row.location_name || source?.location_name,
    lat: row.lat,
    lng: row.lng,
    original_image_url: row.original_image_url,
    illustration_url: row.illustration_url || '',
    category: row.category || source?.category || 'Arte generado',
    description: row.description || source?.description || '',
    created_at: row.created_at,
    creator_name: row.creator_name,
    streetview_pov: {
      heading: row.heading ?? (storedPov?.heading as number | undefined) ?? sourcePov?.heading,
      pitch: row.pitch ?? (storedPov?.pitch as number | undefined) ?? sourcePov?.pitch,
      fov: row.fov ?? (storedPov?.fov as number | undefined) ?? sourcePov?.fov,
      ...(panoId ? { pano_id: panoId } : {}),
    },
    generation_metadata: row.generation_metadata || {},
    is_user_generated: true,
  };
}

async function fetchExploreTarget(targetId: string): Promise<FeedItem | null> {
  const { data: postcardData, error: postcardError } = await supabase
    .from('postcards')
    .select('*')
    .eq('id', targetId)
    .maybeSingle();

  if (postcardError) {
    console.warn('[Explore] Failed to fetch postcard target:', postcardError);
  }

  if (postcardData) return postcardData as FeedItem;

  const { data: userPostcardData, error: userPostcardError } = await supabase
    .from('user_postcards')
    .select('*, source:source_postcard_id(*)')
    .eq('id', targetId)
    .maybeSingle();

  if (userPostcardError) {
    console.warn('[Explore] Failed to fetch user postcard target:', userPostcardError);
  }

  return userPostcardData
    ? userPostcardToFeedItem(userPostcardData as UserPostcardRow)
    : null;
}

/* ──────────────────────────────────────────────────────────────────
   Teleport Intro — globe zoom-in animation
   ────────────────────────────────────────────────────────────────── */

function TeleportIntro({
  city,
  country,
  onComplete,
}: {
  city?: string;
  country?: string;
  onComplete: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const destination = city || country || '???';

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0e] overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[2px] h-[2px] bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{
              duration: 1.5 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 1.5,
            }}
          />
        ))}
      </div>

      {/* Globe zooming in */}
      <motion.div
        className="text-[100px] leading-none select-none"
        initial={{ scale: 0.4, opacity: 0, y: 0 }}
        animate={{
          scale: [0.4, 1.2, 8],
          opacity: [0, 1, 0],
          y: [0, 0, 0],
        }}
        transition={{
          duration: 2.2,
          times: [0, 0.4, 1],
          ease: 'easeInOut',
        }}
      >
        🌍
      </motion.div>

      {/* Destination text */}
      <motion.div
        className="absolute flex flex-col items-center gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <motion.p
          className="text-white/40 text-xs uppercase tracking-[0.3em] font-medium"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {t({ es: 'Teletransportando a...', en: 'Teleporting to...' }, 'es')}
        </motion.p>
        <motion.h2
          className="text-white text-2xl font-bold tracking-tight"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.4, type: 'spring' }}
        >
          📍 {destination}
        </motion.h2>
      </motion.div>

      {/* Radial zoom lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 2.2, times: [0, 0.5, 1] }}
        style={{
          background:
            'radial-gradient(circle at center, transparent 20%, rgba(255,255,255,0.05) 40%, transparent 60%)',
        }}
      />
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Teleport Outro — globe zoom-out animation
   ────────────────────────────────────────────────────────────────── */

function TeleportOutro({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0e] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[2px] h-[2px] bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{
              duration: 1.5 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 1.5,
            }}
          />
        ))}
      </div>

      {/* Globe zooming out */}
      <motion.div
        className="text-[100px] leading-none select-none"
        initial={{ scale: 8, opacity: 0, y: 0 }}
        animate={{
          scale: [8, 1.2, 0.4],
          opacity: [0, 1, 0],
          y: [0, 0, 0],
        }}
        transition={{
          duration: 1.8,
          times: [0, 0.4, 1],
          ease: 'easeInOut',
        }}
      >
        🌍
      </motion.div>

      {/* Return text */}
      <motion.div
        className="absolute flex flex-col items-center gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <motion.p
          className="text-white/60 text-sm uppercase tracking-[0.2em] font-medium"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {t({ es: 'Volviendo al feed...', en: 'Returning to feed...' }, 'es')}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   ExplorePage
   ────────────────────────────────────────────────────────────────── */

export function ExplorePage() {
  const lang = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, setItems, user, handleAuthRequiredAction } = useFeedContext();
  const [showIntro, setShowIntro] = useState(true);
  const [showOutro, setShowOutro] = useState(false);
  const [targetLookup, setTargetLookup] = useState<{
    id: string;
    target: FeedItem | null;
  } | null>(null);

  const targetId = searchParams.get('id');

  const feedTarget = useMemo(() => {
    if (targetId) {
      const found = items.find((i) => i.id === targetId);
      if (found) return found;
    }
  }, [targetId, items]);

  const lookupResolved = targetLookup?.id === targetId;
  const resolvedTarget = lookupResolved ? targetLookup.target : null;

  useEffect(() => {
    let cancelled = false;

    if (!targetId || feedTarget || lookupResolved) {
      return;
    }

    fetchExploreTarget(targetId)
      .then((target) => {
        if (!cancelled) setTargetLookup({ id: targetId, target });
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[Explore] Target lookup failed:', error);
          setTargetLookup({ id: targetId, target: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetId, feedTarget, lookupResolved]);

  const target = useMemo(() => {
    if (feedTarget) return feedTarget;
    if (resolvedTarget) return resolvedTarget;
    if (!targetId) return pickRandomWithPano(items);
    return null;
  }, [feedTarget, resolvedTarget, targetId, items]);

  const handleBack = (options?: { isFromSuccess?: boolean; newCard?: import('../../components/Postcard').FeedItem }) => {
    // Prepend the newly generated postcard at position 0 so it shows first in the feed
    if (options?.newCard) {
      setItems((prev) => {
        const withoutDup = prev.filter((i) => i.id !== options.newCard!.id);
        return [options.newCard!, ...withoutDup];
      });
    }
    if (options?.isFromSuccess) {
      setTimeout(() => {
        setShowOutro(true);
      }, 600);
    } else {
      setShowOutro(true);
    }
  };

  const completeExit = () => {
    navigate('/');
  };

  // Loading state while feed items load
  if (!target) {
    const loadingTarget = targetId ? !lookupResolved : items.length === 0;

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0e] gap-4">
        {loadingTarget ? (
          <>
            <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-white/40 text-sm font-medium tracking-wide">
              {t({ es: 'Cargando destino...', en: 'Loading destination...' }, lang)}
            </p>
          </>
        ) : (
          <>
            <MapPinOff className="w-12 h-12 text-white/20" />
            <p className="text-white/50 text-sm">
              {t({ es: 'No se encontró el destino', en: 'Destination not found' }, lang)}
            </p>
            <button
              onClick={() => handleBack()}
              className="mt-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all border border-white/10"
            >
              {t({ es: 'Volver al inicio', en: 'Back to home' }, lang)}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#0a0a0e] overflow-hidden">
      {/* Teleport intro animation */}
      <AnimatePresence>
        {showIntro && (
          <TeleportIntro
            city={target.city}
            country={target.country}
            onComplete={() => setShowIntro(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOutro && (
          <TeleportOutro onComplete={completeExit} />
        )}
      </AnimatePresence>

      {/* Viewfinder — renders underneath, becomes visible when intro fades */}
      <motion.div
        className="w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: showIntro ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <ViewfinderPanel
          sourceItem={target}
          userId={user?.id}
          userIsAnonymous={user?.is_anonymous}
          onAuthRequired={(action) => handleAuthRequiredAction(action)}
          onPostcardCreated={() => analytics.track('viewfinder_postcard_saved')}
          onBack={handleBack}
        />
      </motion.div>
    </div>
  );
}
