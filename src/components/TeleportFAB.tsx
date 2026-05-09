/**
 * TeleportFAB.tsx
 *
 * Floating action button that teleports the user to a random
 * Street View location from the feed.
 *
 * Before navigating, a ghost preflight check is made to the
 * Street View Metadata API (free tier) to confirm imagery is
 * available at the chosen location. If not, a different random
 * item is tried (up to MAX_ATTEMPTS) before giving up gracefully.
 *
 * ref #97
 */

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, MapPinOff } from 'lucide-react';
import { useLang, t } from '../utils/i18n';
import { analytics } from '../lib/analytics';
import type { FeedItem } from './Postcard';
import { checkStreetViewAvailability } from './explorer-utils';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const MAX_ATTEMPTS = 3;

interface TeleportFABProps {
  items: FeedItem[];
  /** Override the idle label text */
  label?: string;
}

function pickRandom(pool: FeedItem[], exclude: Set<string>): FeedItem | null {
  const candidates = pool.filter((i) => !exclude.has(i.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function TeleportFAB({ items, label }: TeleportFABProps) {
  const lang = useLang();
  const navigate = useNavigate();
  const [isLaunching, setIsLaunching] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const handleTeleport = useCallback(async () => {
    if (isLaunching) return;

    // Build a pool of candidates
    const pool = items.filter((i) => i.lat != null && i.lng != null);

    if (pool.length === 0) return;

    setIsLaunching(true);
    const tried = new Set<string>();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = pickRandom(pool, tried);
      if (!candidate) break;
      tried.add(candidate.id);

      const available = await checkStreetViewAvailability({
        panoId: candidate.streetview_pov?.pano_id,
        lat: candidate.lat,
        lng: candidate.lng,
        mapsKey: MAPS_KEY,
      });

      if (available) {
        analytics.track('teleport_surprise_trip', {
          destination_id: candidate.id,
          city: candidate.city,
          country: candidate.country,
          attempt: attempt + 1,
        });
        navigate(`/explore?id=${candidate.id}`);
        setIsLaunching(false);
        return;
      }
      // If unavailable, silently try the next candidate
    }

    // All attempts failed — inform the user gracefully
    setIsLaunching(false);
    setShowUnavailable(true);
    analytics.track('teleport_no_imagery_available', { tried: Array.from(tried) });
    setTimeout(() => setShowUnavailable(false), 3000);
  }, [items, navigate, isLaunching]);

  return (
    <div className="relative">
      <motion.button
        onClick={handleTeleport}
        disabled={isLaunching}
        initial={{ opacity: 0, y: 40, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: 0.3 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className="
          fixed bottom-8 right-6 z-[60]
          flex items-center gap-3
          px-6 py-4
          bg-gradient-to-r from-emerald-500 to-teal-600
          hover:from-emerald-400 hover:to-teal-500
          text-white font-bold text-sm tracking-wide
          rounded-full
          shadow-[0_8px_32px_rgba(16,185,129,0.4)]
          hover:shadow-[0_12px_48px_rgba(16,185,129,0.5)]
          transition-shadow duration-300
          disabled:opacity-60
          cursor-pointer
        "
      >
        {isLaunching ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
          />
        ) : (
          <motion.div
            animate={{ x: [0, 3, 0], y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Plane size={20} className="rotate-[-30deg]" />
          </motion.div>
        )}
        <span>
          {isLaunching
            ? t({ es: 'Verificando lugar...', en: 'Checking spot...' }, lang)
            : label ?? t({ es: '📸 Genera una postal', en: '📸 Generate Postcard' }, lang)}
        </span>
      </motion.button>

      {/* "No imagery" toast */}
      <AnimatePresence>
        {showUnavailable && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="fixed bottom-28 right-6 z-[61] flex items-center gap-2.5 bg-stone-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 max-w-[220px]"
          >
            <MapPinOff className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs font-medium leading-tight">
              {t(
                {
                  es: 'Sin cobertura Street View en esa zona. Probando otra...',
                  en: 'No Street View coverage there. Try again!',
                },
                lang,
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
