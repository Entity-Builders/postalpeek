/**
 * ViewfinderOnboarding.tsx
 *
 * One-time translucent overlay that teaches new users
 * they can rotate, zoom, and walk through Street View
 * before generating a postcard.
 *
 * Shows only once per device (localStorage flag).
 * Dismisses on tap/click or after 6 seconds.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Move, ZoomIn, Footprints } from 'lucide-react';
import { useLang, t } from '../../utils/i18n';

const STORAGE_KEY = 'postalpeek_viewfinder_onboarded';

function hasSeenViewfinderOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markViewfinderOnboarded(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // noop
  }
}

const tips = [
  {
    icon: Move,
    es: 'Arrastrá para girar la vista',
    en: 'Drag to rotate the view',
  },
  {
    icon: ZoomIn,
    es: 'Pellizca o usa scroll para zoom',
    en: 'Pinch or scroll to zoom',
  },
  {
    icon: Footprints,
    es: 'Tocá el suelo para caminar',
    en: 'Tap the ground to walk',
  },
];

interface ViewfinderOnboardingProps {
  /** If true, the parent is in viewfinder step and ready to show */
  active: boolean;
}

export function ViewfinderOnboarding({ active }: ViewfinderOnboardingProps) {
  const lang = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active && !hasSeenViewfinderOnboarding()) {
      // Small delay so the Street View loads first
      const showTimer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(showTimer);
    }
  }, [active]);

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(timer);
  }, [visible]);

  const dismiss = useCallback(() => {
    setVisible(false);
    markViewfinderOnboarded();
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="viewfinder-onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={dismiss}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 120 }}
            className="flex flex-col items-center gap-6 px-8 max-w-[320px]"
          >
            {/* Title */}
            <div className="text-center">
              <p className="text-white font-black text-lg tracking-tight">
                {t({ es: '🗺️ Explorá el lugar', en: '🗺️ Explore the place' }, lang)}
              </p>
              <p className="text-white/50 text-xs mt-1">
                {t({
                  es: 'Antes de capturar, recorré la zona',
                  en: 'Before capturing, explore the area',
                }, lang)}
              </p>
            </div>

            {/* Tips */}
            <div className="flex flex-col gap-4 w-full">
              {tips.map((tip, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.15 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                    <tip.icon className="w-5 h-5 text-white/80" />
                  </div>
                  <span className="text-white/80 text-sm font-medium">
                    {t({ es: tip.es, en: tip.en }, lang)}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Dismiss hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-white/30 text-[11px] mt-2"
            >
              {t({ es: 'Tocá para comenzar', en: 'Tap to start' }, lang)}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
