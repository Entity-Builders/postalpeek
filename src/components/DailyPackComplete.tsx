import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, ArrowDown } from 'lucide-react';
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
  React.useEffect(() => {
    analytics.track('daily_pack_completed', {
      cards_count: cards.length,
      album_cards_count: albumCardCount,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className='w-full h-full flex flex-col items-center justify-center px-6'>
      {/* Celebration header */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className='text-center mb-8'
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, -3, 0] }}
          transition={{ duration: 1, delay: 0.5 }}
          className='text-5xl mb-4'
        >
          🎉
        </motion.div>
        <h2 className='text-2xl font-serif font-bold text-stone-800 mb-2'>
          ¡Sobre abierto!
        </h2>
        <p className='text-stone-500 text-sm'>
          Recibiste {cards.length} postales nuevas
        </p>
      </motion.div>

      {/* Card thumbnails grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className='flex flex-wrap justify-center gap-3 mb-8 max-w-[320px]'
      >
        {cards.map((card, idx) => (
          <motion.div
            key={card.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 + idx * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
            className='relative'
          >
            <div className='w-16 h-20 rounded-lg overflow-hidden shadow-md bg-white p-0.5'>
              <img
                src={cdnImage(card.illustration_url, { width: 128, quality: 70 })}
                alt={card.city}
                className='w-full h-full object-cover rounded-md'
              />
            </div>
            {/* Mini country label */}
            <span className='absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-stone-600 font-medium shadow-sm whitespace-nowrap border border-stone-100'>
              {card.city}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Album cards highlight */}
      {albumCardCount > 0 && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className='flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-full px-4 py-2 mb-6 shadow-sm'
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
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onGoToFeed}
        className='px-8 py-3.5 bg-gradient-to-r from-stone-800 to-stone-900 text-white font-semibold text-base rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2'
      >
        <span>¡Al Feed!</span>
        <ArrowDown className='w-4 h-4' />
      </motion.button>

      {/* Subtle hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className='text-stone-400 text-xs mt-4'
      >
        Tus postales ya están en tu colección
      </motion.p>
    </div>
  );
}
