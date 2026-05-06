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

function pickRandomWithPano(items: any[]) {
  // Prefer items with verified pano_id
  const withPano = items.filter(
    (i) => i.streetview_pov?.pano_id && i.lat != null && i.lng != null,
  );
  if (withPano.length > 0) {
    return withPano[Math.floor(Math.random() * withPano.length)];
  }
  // Fallback: any item with coordinates
  const withCoords = items.filter((i) => i.lat != null && i.lng != null);
  if (withCoords.length > 0) {
    return withCoords[Math.floor(Math.random() * withCoords.length)];
  }
  return null;
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
   ExplorePage
   ────────────────────────────────────────────────────────────────── */

export function ExplorePage() {
  const lang = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, user, handleAuthRequiredAction } = useFeedContext();
  const [showIntro, setShowIntro] = useState(true);

  const targetId = searchParams.get('id');

  const target = useMemo(() => {
    if (targetId) {
      const found = items.find((i) => i.id === targetId);
      if (found) return found;
    }
    return pickRandomWithPano(items);
  }, [targetId, items]);

  const handleBack = () => {
    navigate('/');
  };

  // Loading state while feed items load
  if (!target) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0e] gap-4">
        {items.length === 0 ? (
          <>
            <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-white/40 text-sm font-medium tracking-wide">
              {t({ es: 'Cargando destinos...', en: 'Loading destinations...' }, lang)}
            </p>
          </>
        ) : (
          <>
            <MapPinOff className="w-12 h-12 text-white/20" />
            <p className="text-white/50 text-sm">
              {t({ es: 'No se encontró el destino', en: 'Destination not found' }, lang)}
            </p>
            <button
              onClick={handleBack}
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
