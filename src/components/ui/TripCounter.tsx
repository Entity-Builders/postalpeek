/**
 * TripCounter.tsx
 *
 * Compact widget showing remaining daily generations.
 * Appears in the viewfinder toolbar alongside the CameraFAB.
 *
 * Displays: ✈️ 3/5 (used/total) or "Volvé mañana" when exhausted.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane } from 'lucide-react';
import { useLang, t } from '../../utils/i18n';

interface TripCounterProps {
  remaining: number;
  limit: number;
}

export function TripCounter({ remaining, limit }: TripCounterProps) {
  const lang = useLang();
  const used = limit - remaining;
  const isExhausted = remaining <= 0;
  const isLow = remaining === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: 'spring', damping: 20 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{
        background: isExhausted
          ? 'rgba(239, 68, 68, 0.25)'
          : 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: isExhausted
          ? '1px solid rgba(239, 68, 68, 0.3)'
          : '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      <Plane
        className={`w-3.5 h-3.5 ${
          isExhausted
            ? 'text-red-400'
            : isLow
            ? 'text-amber-400'
            : 'text-white/70'
        }`}
      />

      <AnimatePresence mode="wait">
        {isExhausted ? (
          <motion.span
            key="exhausted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-red-300 text-[11px] font-semibold"
          >
            {t({ es: 'Volvé mañana', en: 'Come back tomorrow' }, lang)}
          </motion.span>
        ) : (
          <motion.span
            key="count"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`text-[11px] font-bold tabular-nums ${
              isLow ? 'text-amber-300' : 'text-white/80'
            }`}
          >
            {remaining}
            <span className="text-white/30 font-normal">/{limit}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
