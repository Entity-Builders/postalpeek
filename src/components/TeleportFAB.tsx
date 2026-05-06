/**
 * TeleportFAB.tsx
 *
 * Floating action button that teleports the user to a random
 * Street View location from the feed. Only picks items with
 * a verified pano_id to guarantee 0% "No Street View" errors.
 *
 * ref #97
 */

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plane } from 'lucide-react';
import { useLang, t } from '../utils/i18n';
import { analytics } from '../lib/analytics';
import type { FeedItem } from './Postcard';

interface TeleportFABProps {
  items: FeedItem[];
}

export function TeleportFAB({ items }: TeleportFABProps) {
  const lang = useLang();
  const navigate = useNavigate();
  const [isLaunching, setIsLaunching] = useState(false);

  const handleTeleport = useCallback(() => {
    // Filter items that have a guaranteed Street View pano
    const validItems = items.filter(
      (i) => i.streetview_pov?.pano_id && i.lat != null && i.lng != null,
    );

    if (validItems.length === 0) {
      // Fallback: use any item with coordinates
      const fallback = items.filter((i) => i.lat != null && i.lng != null);
      if (fallback.length === 0) return;
      const random = fallback[Math.floor(Math.random() * fallback.length)];
      navigate(`/explore?id=${random.id}`);
      return;
    }

    const random = validItems[Math.floor(Math.random() * validItems.length)];

    setIsLaunching(true);
    analytics.track('teleport_surprise_trip', {
      destination_id: random.id,
      city: random.city,
      country: random.country,
    });

    // Small delay for the animation to play
    setTimeout(() => {
      navigate(`/explore?id=${random.id}`);
      setIsLaunching(false);
    }, 300);
  }, [items, navigate]);

  return (
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
          ? t({ es: 'Despegando...', en: 'Taking off...' }, lang)
          : t({ es: '✈️ Viaje Sorpresa', en: '✈️ Surprise Trip' }, lang)}
      </span>
    </motion.button>
  );
}
