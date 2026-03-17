import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t } from '../utils/i18n';
import { cdnImage } from '../utils/imageUtils';

interface DailyPackRevealProps {
  cards: FeedItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function DailyPackReveal({ cards, isOpen, onClose }: DailyPackRevealProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());

  const currentCard = cards[currentIndex];
  const isLastCard = currentIndex === cards.length - 1;
  const isRevealed = revealedCards.has(currentIndex);

  const revealCard = () => {
    setRevealedCards((prev) => new Set(prev).add(currentIndex));
  };

  const goNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  if (!isOpen || cards.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 z-[100] flex items-center justify-center'
      >
        {/* Backdrop */}
        <div className='absolute inset-0 bg-black/70 backdrop-blur-md' onClick={onClose} />

        {/* Content */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className='relative z-10 w-[95vw] max-w-[420px] flex flex-col items-center gap-4'
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className='absolute -top-2 -right-2 z-20 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/30 transition-colors'
          >
            <X className='w-4 h-4' />
          </button>

          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className='text-center'
          >
            <div className='flex items-center justify-center gap-2 text-amber-300'>
              <Sparkles className='w-5 h-5' />
              <span className='text-sm font-medium tracking-wider uppercase'>Sobre Diario</span>
              <Sparkles className='w-5 h-5' />
            </div>
            <p className='text-white/60 text-xs mt-1'>
              Postal {currentIndex + 1} de {cards.length}
            </p>
          </motion.div>

          {/* Card area */}
          <div className='relative w-full' style={{ aspectRatio: '4/5' }}>
            <AnimatePresence mode='wait'>
              {!isRevealed ? (
                /* Card back — tap to reveal */
                <motion.button
                  key={`back-${currentIndex}`}
                  initial={{ rotateY: 0 }}
                  exit={{ rotateY: 90 }}
                  transition={{ duration: 0.3 }}
                  onClick={revealCard}
                  className='absolute inset-0 w-full h-full rounded-xl overflow-hidden cursor-pointer'
                  style={{ perspective: '1000px' }}
                >
                  <div className='w-full h-full bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-amber-300/30 shadow-[0_8px_30px_rgba(0,0,0,0.3)]'>
                    {/* Decorative pattern */}
                    <div className='absolute inset-4 border-2 border-amber-200/20 rounded-lg pointer-events-none' />
                    <div className='absolute inset-8 border border-amber-200/10 rounded-md pointer-events-none' />

                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className='w-12 h-12 text-amber-200/80' />
                    </motion.div>
                    <span className='text-amber-100 font-semibold text-lg'>Toca para revelar</span>
                    <span className='text-amber-200/60 text-sm'>Postal #{currentIndex + 1}</span>
                  </div>
                </motion.button>
              ) : (
                /* Card front — revealed postcard */
                <motion.div
                  key={`front-${currentIndex}`}
                  initial={{ rotateY: -90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.3 }}
                  className='absolute inset-0 w-full h-full rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)]'
                >
                  <div
                    className='w-full h-full bg-white flex flex-col overflow-hidden'
                    style={{
                      padding: '8px 8px 32px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {/* Image */}
                    <div className='flex-1 relative overflow-hidden rounded-md'>
                      {currentCard && (
                        <img
                          src={cdnImage(currentCard.illustration_url, {
                            width: 800,
                            quality: 85,
                          })}
                          alt={t(currentCard.description) || currentCard.city}
                          className='w-full h-full object-cover'
                        />
                      )}
                    </div>

                    {/* Label */}
                    {currentCard && (
                      <div className='mt-2 px-1'>
                        <h3 className='text-sm font-semibold text-stone-800 truncate'>
                          {t(currentCard.category) || t(currentCard.description)}
                        </h3>
                        <p className='text-xs text-stone-500'>
                          📍 {currentCard.city}, {currentCard.country}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className='flex items-center gap-4 w-full'>
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className='w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all'
            >
              <ChevronLeft className='w-5 h-5' />
            </button>

            {/* Dots */}
            <div className='flex-1 flex items-center justify-center gap-2'>
              {cards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? 'bg-amber-400 scale-125'
                      : revealedCards.has(i)
                        ? 'bg-white/50'
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {isLastCard && isRevealed ? (
              <button
                onClick={onClose}
                className='px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95'
              >
                ¡Al Feed!
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!isRevealed) revealCard();
                  else goNext();
                }}
                className='w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 transition-all'
              >
                <ChevronRight className='w-5 h-5' />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
