/**
 * SpotlightResultsSlide — shows AI search results inside the vertical feed.
 * Each result is the real <Postcard> component — same flip, claim, actions as the main feed.
 * Thumbnail strip allows switching between results.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { Postcard } from './Postcard';
import { cdnImage } from '../utils/imageUtils';
import { analytics } from '../lib/analytics';

interface SpotlightResultsSlideProps {
  results: FeedItem[];
  claimedIds: Set<string>;
  onClaim: (id: string) => void;
  isClaimLoading: boolean;
  onSelectPostcard: (item: FeedItem) => void;
  query: string;
}

export function SpotlightResultsSlide({
  results,
  claimedIds,
  onClaim,
  isClaimLoading,
  query,
}: SpotlightResultsSlideProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset to first result when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  const handleClaim = useCallback((id: string) => {
    onClaim(id);
    analytics.track('spotlight_result_claimed', { postcard_id: id, query });
  }, [onClaim, query]);

  if (results.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-4 h-full px-8 text-center'>
        <span className='text-5xl'>🔍</span>
        <p className='font-serif text-stone-600 text-lg'>No encontré postales para</p>
        <p className='text-stone-500 text-sm italic'>&ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  const active = results[activeIndex];

  return (
    <div
      className='flex flex-col items-center w-full h-full gap-2'
      style={{
        /* top: leave room for the SpotlightPill (≈70px) + status bar */
        paddingTop: 'max(72px, calc(env(safe-area-inset-top) + 60px))',
        /* bottom: leave room for thumbnails & safe area */
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.25 }}
        className='flex items-center gap-2 shrink-0'
      >
        <Sparkles className='w-3 h-3 text-purple-500' />
        <p className='text-[11px] text-stone-500 font-mono'>
          {results.length} {results.length === 1 ? 'resultado' : 'resultados'} ·{' '}
          &ldquo;{query}&rdquo;
        </p>
      </motion.div>

      {/* The real Postcard — flex-1 + min-h-0 so it shrinks to fit */}
      <AnimatePresence mode='wait'>
        <motion.div
          key={active.id}
          initial={{ opacity: 0, scale: 0.93, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className='w-full flex-1 min-h-0 flex items-center justify-center px-3'
        >
          {/* Inner wrapper respects 4:5 ratio but never overflows */}
          <div
            className='w-full h-full max-w-[400px]'
            style={{
              /* Cap height to the available flex space */
              maxHeight: '100%',
              aspectRatio: '4/5',
            }}
          >
            <Postcard
              item={active}
              isActive={true}
              isClaimedByMe={claimedIds.has(active.id)}
              isClaimed={!!active.owner_id}
              onClaimPostcard={handleClaim}
              isClaimLoading={isClaimLoading}
              hideActions={false}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Thumbnail strip to navigate between results */}
      {results.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.25 }}
          className='flex gap-2.5 items-center shrink-0 pb-1'
        >
          {results.map((item, i) => (
            <motion.button
              key={item.id}
              onClick={() => setActiveIndex(i)}
              whileTap={{ scale: 0.93 }}
              className={`relative overflow-hidden rounded-xl transition-all duration-200
                ${i === activeIndex
                  ? 'w-12 h-12 ring-2 ring-stone-800 ring-offset-2 ring-offset-[#e6e2da] opacity-100'
                  : 'w-9 h-9 opacity-45 hover:opacity-75'
                }`}
            >
              <img
                src={cdnImage(item.illustration_url, { width: 160, quality: 75 })}
                alt={item.city || ''}
                className='w-full h-full object-cover'
              />
              {claimedIds.has(item.id) && (
                <div className='absolute inset-0 bg-emerald-500/40 flex items-center justify-center'>
                  <span className='text-white text-xs'>✓</span>
                </div>
              )}
              {/* Active indicator dot */}
              {i === activeIndex && (
                <motion.div
                  layoutId='thumb-active-dot'
                  className='absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow'
                />
              )}
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

