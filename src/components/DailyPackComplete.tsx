import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, ChevronDown } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { FeedItem } from './Postcard';
import { cdnImage } from '../utils/imageUtils';
import { analytics } from '../lib/analytics';

interface DailyPackCompleteProps {
  cards: FeedItem[];
  albumCardCount: number;
  onGoToFeed: () => void;
}

export function DailyPackComplete({
  cards,
  albumCardCount,
  onGoToFeed,
}: DailyPackCompleteProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    analytics.track('daily_pack_completed', {
      cards_count: cards.length,
      album_cards_count: albumCardCount,
    });
    const t = setTimeout(() => setShowConfetti(false), 2500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className='w-full h-full flex flex-col items-center justify-center px-6 relative'>
      {/* Confetti Lottie — same pattern as PostcardFront */}
      {showConfetti && (
        <div
          className='pointer-events-none z-50'
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            width: 500,
            height: 500,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <DotLottieReact
            src='/confetti.lottie'
            autoplay
            loop={false}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Celebration header */}
      <motion.div
        initial={{ y: -20, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
        className='text-center mb-6'
      >
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className='text-5xl mb-3'
        >
          🎉
        </motion.div>
        <h2 className='text-2xl font-serif font-bold text-stone-900 mb-1' style={{ textShadow: '0 1px 2px rgba(255,255,255,0.6)' }}>
          ¡Sobre abierto!
        </h2>
        <p className='text-stone-600 text-sm'>
          Recibiste {cards.length} postales nuevas
        </p>
      </motion.div>

      {/* Card thumbnails — with floating animation */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className='flex flex-wrap justify-center gap-3 mb-6 max-w-[400px]'
      >
        {cards.map((card, idx) => {
          const imgSrc = cdnImage(card.illustration_url, { width: 256, quality: 75 });
          const floatDuration = 2.5 + (idx % 3) * 0.4;
          const floatY = 4 + (idx % 2) * 2;
          return (
            <motion.div
              key={card.id}
              initial={{ scale: 0, opacity: 0, rotate: -5 + idx * 2 }}
              animate={{
                scale: 1,
                opacity: 1,
                rotate: -3 + idx * 1.5,
                y: [0, -floatY, 0],
              }}
              transition={{
                scale: { delay: 0.25 + idx * 0.06, type: 'spring', stiffness: 400, damping: 20 },
                opacity: { delay: 0.25 + idx * 0.06 },
                rotate: { delay: 0.25 + idx * 0.06, duration: 0.4 },
                y: { delay: 0.5 + idx * 0.1, duration: floatDuration, repeat: 2, ease: 'easeInOut' },
              }}
              className='relative'
            >
              <div className='w-24 h-28 md:w-28 md:h-32 rounded-lg overflow-hidden shadow-md bg-white p-0.5'>
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={card.city}
                    className='w-full h-full object-cover rounded-md'
                  />
                ) : (
                  <div className='w-full h-full rounded-md bg-stone-100 animate-pulse' />
                )}
              </div>
              <span className='absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-stone-600 font-medium shadow-sm whitespace-nowrap border border-stone-100'>
                {card.city}
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Album cards highlight */}
      {albumCardCount > 0 && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className='flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-full px-4 py-2 mb-5 shadow-sm'
        >
          <Trophy className='w-4 h-4 text-amber-500' />
          <span className='text-sm font-medium text-amber-800'>
            {albumCardCount === 1
              ? '¡1 carta pertenece a un álbum!'
              : `¡${albumCardCount} cartas pertenecen a álbumes!`}
          </span>
          <Sparkles className='w-4 h-4 text-amber-400' />
        </motion.div>
      )}

      {/* CTA button */}
      <motion.button
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={onGoToFeed}
        className='px-8 py-3.5 bg-gradient-to-r from-stone-800 to-stone-900 text-white font-semibold text-base rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2'
      >
        <span>Seguir explorando</span>
        <ChevronDown className='w-4 h-4' />
      </motion.button>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className='mt-4 flex flex-col items-center gap-1'
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className='w-5 h-5 text-stone-300' />
        </motion.div>
        <span className='text-stone-400 text-xs'>o desliza hacia abajo</span>
      </motion.div>
    </div>
  );
}
