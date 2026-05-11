/**
 * LoadingMetadata.tsx
 *
 * Progressive metadata reveal during illustration generation.
 * Shows facts, stats, and rarity that were fetched in parallel (~2-3s)
 * while the illustration is still generating (~10s).
 *
 * Staggered animations create an "unboxing" feeling.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin } from 'lucide-react';
import { useLang, t, type Lang } from '../../utils/i18n';
import type { LocationMetadata } from '../../services/userPostcardService';

interface LoadingMetadataProps {
  metadata: LocationMetadata | null;
  city?: string;
  country?: string;
  detectedTags?: { label: string }[];
}

const RARITY_CONFIG = {
  common:    { label: 'Common',    color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.25)' },
  rare:      { label: 'Rare',      color: '#60A5FA', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.3)'  },
  epic:      { label: 'Epic',      color: '#C084FC', bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.3)' },
  legendary: { label: 'Legendary', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.3)'  },
};


export function LoadingMetadata({ metadata, city, country, detectedTags = [] }: LoadingMetadataProps) {
  const lang = useLang();

  return (
    <div className="w-[85vw] max-w-[420px] mt-3">
      <AnimatePresence mode="wait">
        {!metadata ? (
          /* Loading shimmer while metadata is being fetched */
          <motion.div
            key="shimmer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                {city && country ? `${city}, ${country}` : t({ es: 'Analizando ubicación...', en: 'Analyzing location...' }, lang)}
              </span>
            </div>
            {/* Shimmer bars */}
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.1, 0.25, 0.1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="h-3 bg-white/10 rounded-md"
                style={{ width: `${70 + i * 10}%` }}
              />
            ))}

            {/* ─── Progressive Object Detection Reveal ─── */}
            {detectedTags.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap gap-1.5 px-1 mt-2"
              >
                {detectedTags.map((tag, i) => (
                  <motion.div
                    key={tag.label + i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring', damping: 20 }}
                    className="flex items-center px-2 py-1 bg-yellow-400/10 border border-yellow-400/20 rounded-lg backdrop-blur-sm"
                  >
                    <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
                      {tag.label}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* Actual metadata with staggered reveal */
          <motion.div
            key="metadata"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-2.5"
          >
            {/* ─── Rarity Badge ─── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 15 }}
              className="flex items-center gap-2"
            >
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: RARITY_CONFIG[metadata.rarity as keyof typeof RARITY_CONFIG]?.bg || RARITY_CONFIG.common.bg,
                  border: `1px solid ${RARITY_CONFIG[metadata.rarity as keyof typeof RARITY_CONFIG]?.border || RARITY_CONFIG.common.border}`,
                  color: RARITY_CONFIG[metadata.rarity as keyof typeof RARITY_CONFIG]?.color || RARITY_CONFIG.common.color,
                }}
              >
                <Sparkles className="w-3 h-3" />
                {RARITY_CONFIG[metadata.rarity as keyof typeof RARITY_CONFIG]?.label || 'Common'}
              </div>
              {city && (
                <span className="text-[9px] text-white/30 uppercase tracking-wider">
                  {city}, {country}
                </span>
              )}
            </motion.div>

            {/* ─── Did You Know ─── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, type: 'spring', damping: 20 }}
              className="rounded-xl px-3 py-2.5"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px]">💡</span>
                <span className="text-[9px] text-amber-400/80 font-bold uppercase tracking-wider">
                  {t({ es: '¿Sabías que...?', en: 'Did you know...?' }, lang)}
                </span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                {lang === 'es'
                  ? metadata.storytelling.did_you_know.es
                  : metadata.storytelling.did_you_know.en}
              </p>
            </motion.div>

            {/* ─── Spotted Objects ─── */}
            {metadata.spotted_objects && metadata.spotted_objects.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-wrap gap-1.5 px-1 mt-1"
              >
                {metadata.spotted_objects.map((obj, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.1, type: 'spring', damping: 20 }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-white/10 border border-white/10 rounded-lg backdrop-blur-sm"
                  >
                    <span className="text-[12px]">{obj.emoji}</span>
                    <span className="text-[10px] text-white/80 font-medium whitespace-nowrap">
                      {lang === 'es' ? obj.name.es : obj.name.en}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
