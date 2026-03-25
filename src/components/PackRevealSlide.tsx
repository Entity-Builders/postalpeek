import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { cdnImage } from '../utils/imageUtils';
import { analytics } from '../lib/analytics';
import { useLang, t } from '../utils/i18n';

interface PackRevealSlideProps {
  cards: FeedItem[];
  albumPostcardIds: Set<string>;
  onAllCollected: () => void;
}

// Vertical offset between stacked cards (how much of each card peeks out behind)
const PEEK_HEIGHT = 38;
// Card dimensions
const CARD_W = 260;
const CARD_H = 340;

export function PackRevealSlide({
  cards,
  albumPostcardIds,
  onAllCollected,
}: PackRevealSlideProps) {
  const lang = useLang();
  // Start with all cards: index 0 is the BOTTOM (behind), last is the TOP (front/interactive)
  const [remaining, setRemaining] = useState<FeedItem[]>(() => [...cards]);
  const [flyingId, setFlyingId] = useState<string | null>(null);

  const topCard = remaining[remaining.length - 1];

  const handleCollectTop = () => {
    if (!topCard || flyingId) return;

    setFlyingId(topCard.id);
    analytics.track('daily_pack_solitaire_card_collected', {
      postcard_id: topCard.id,
      is_album_card: albumPostcardIds.has(topCard.id),
    });

    setTimeout(() => {
      setFlyingId(null);
      setRemaining((prev) => {
        const next = prev.slice(0, -1);
        if (next.length === 0) {
          setTimeout(() => onAllCollected(), 350);
        }
        return next;
      });
    }, 480);
  };

  // Total stack height so we can center the whole thing vertically
  const stackHeight = CARD_H + (cards.length - 1) * PEEK_HEIGHT;

  return (
    <div className='w-full h-full flex flex-col items-center justify-center select-none gap-6'>
      {/* Label */}
      <motion.p
        key={remaining.length}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className='text-sm font-medium text-stone-600'
      >
        {remaining.length > 0
          ? t({ es: `Tocá para guardar · ${remaining.length} ${remaining.length === 1 ? 'postal' : 'postales'}`, en: `Tap to save · ${remaining.length} ${remaining.length === 1 ? 'postcard' : 'postcards'}` }, lang)
          : t({ es: '¡Listo! Guardadas en tu colección', en: 'Done! Saved to your collection' }, lang)}
      </motion.p>

      {/* Stack */}
      <div
        className='relative'
        style={{ width: CARD_W, height: stackHeight }}
      >
        <AnimatePresence>
          {remaining.map((card, stackIndex) => {
            const isTop = stackIndex === remaining.length - 1;
            const isFlying = flyingId === card.id;
            const isAlbum = albumPostcardIds.has(card.id);

            // Y position: card 0 (bottom of stack) sits at top of container,
            // each subsequent card shifts down by PEEK_HEIGHT
            const yPos = (remaining.length - 1 - stackIndex) * PEEK_HEIGHT;

            return (
              <motion.div
                key={card.id}
                initial={{ y: yPos - 40, opacity: 0, scale: 0.92 }}
                animate={
                  isFlying
                    ? { y: yPos - 340, x: 60, scale: 0.5, opacity: 0, rotate: 12 }
                    : { y: yPos, opacity: 1, scale: 1, x: 0, rotate: 0 }
                }
                exit={{ opacity: 0 }}
                transition={
                  isFlying
                    ? { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
                    : { type: 'spring', stiffness: 280, damping: 26, delay: stackIndex * 0.05 }
                }
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: CARD_W,
                  height: CARD_H,
                  zIndex: stackIndex + 1,
                  cursor: isTop ? 'pointer' : 'default',
                }}
                onClick={isTop ? handleCollectTop : undefined}
                whileHover={isTop && !flyingId ? { y: yPos - 12, transition: { duration: 0.15 } } : {}}
                whileTap={isTop && !flyingId ? { scale: 0.97 } : {}}
              >
                <div
                  className='w-full h-full rounded-2xl overflow-hidden shadow-xl border-2 border-white'
                >
                  <img
                    src={cdnImage(card.illustration_url, { width: 600, quality: 90 })}
                    alt={card.city || 'Postal'}
                    className='w-full h-full object-cover'
                    draggable={false}
                  />
                  {/* City label */}
                  <div className='absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/65 to-transparent p-4'>
                    <p className='text-white text-sm font-semibold'>{card.city || card.country}</p>
                  </div>
                  {/* Album badge */}
                  {isAlbum && (
                    <div className='absolute top-3 right-3 bg-amber-400 rounded-full p-1.5 shadow-md'>
                      <BookOpen className='w-3.5 h-3.5 text-white' />
                    </div>
                  )}
                  {/* Top card indicator */}
                  {isTop && !isFlying && (
                    <div className='absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-semibold text-stone-700 shadow-sm'>
                      {t({ es: 'Tocá para guardar', en: 'Tap to save' }, lang)}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        <AnimatePresence>
          {remaining.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className='absolute inset-0 flex items-center justify-center'
            >
              <p className='text-5xl'>✉️</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className='text-xs text-stone-400'
      >
        {remaining.length > 0 
          ? t({ es: 'Deslizá hacia abajo para explorar el feed', en: 'Swipe down to explore the feed' }, lang) 
          : t({ es: 'Deslizá para seguir explorando', en: 'Swipe to keep exploring' }, lang)}
      </motion.p>
    </div>
  );
}
