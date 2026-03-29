import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { FeedItem } from './Postcard';
import { useSignedImage, useRawSignedImage } from '../utils/useSignedImage';
import { analytics } from '../lib/analytics';
import { useLang, t } from '../utils/i18n';

interface WalkerWelcomeProps {
  previewCards: FeedItem[];
  onStartOnboarding?: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function WalkerWelcomeAnimated({ previewCards, onStartOnboarding }: WalkerWelcomeProps) {
  const lang = useLang();

  const pool = React.useRef<FeedItem[]>([]);
  const [cards, setCards] = useState<FeedItem[]>([]);
  const [showWorld, setShowWorld] = useState(false);

  useEffect(() => {
    if (previewCards && previewCards.length > 0) {
      if (pool.current.length === 0) {
        pool.current = [...previewCards].sort(() => 0.5 - Math.random());
        setCards(pool.current.slice(0, 4)); // Initial 4 cards
      }
    }
  }, [previewCards]);

  // Rhythmically swap one card every 5 seconds for a dynamic feel
  useEffect(() => {
    if (pool.current.length <= 4) return;

    let swapIdx = 0;
    const interval = setInterval(() => {
      setCards((prev) => {
        const next = [...prev];
        // Find a card in the pool that isn't currently displayed
        const available = pool.current.filter(
          (c) => !next.some((n) => n.id === c.id),
        );
        if (available.length > 0) {
          const newCard =
            available[Math.floor(Math.random() * available.length)];
          next[swapIdx] = newCard;
          swapIdx = (swapIdx + 1) % 4; // Shift to next slot for the next swap
        }
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cards.length === 0) return;
    analytics.track('welcome_animated_viewed');

    // Slight delay before popping in the world
    const timer = setTimeout(() => setShowWorld(true), 200);
    return () => clearTimeout(timer);
  }, [cards.length]);

  if (cards.length === 0) return null;

  return (
    <div className='relative w-full h-full flex flex-col items-center justify-start overflow-hidden bg-[#e6e2da]'>
      {/* ── Animated World Area (Top Half) ── */}
      <div className='relative w-full h-[50vh] flex items-center justify-center pt-8'>
        <AnimatePresence>
          {showWorld && (
            <motion.div
              className='relative flex items-center justify-center w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]'
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            >
              {/* Central Animated Globe */}
              <div className='absolute z-10 flex items-center justify-center w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] pointer-events-none drop-shadow-md opacity-90'>
                <DotLottieReact
                  src='/global.lottie'
                  loop
                  autoplay
                  className='w-full h-full object-contain'
                  renderConfig={{ devicePixelRatio: window.devicePixelRatio || 2 }}
                />
              </div>

              {/* Orbiting Postcards Container */}
              <motion.div
                className='absolute inset-0 z-20'
                animate={{ rotate: 360 }}
                transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
              >
                {cards.map((card, idx) => {
                  const total = cards.length;
                  const angle = (idx / total) * 360;
                  // Distance from center
                  const radius = window.innerWidth < 640 ? 110 : 130;

                  // Calculate coordinates
                  const rad = angle * (Math.PI / 180);
                  const x = Math.cos(rad) * radius;
                  const y = Math.sin(rad) * radius;

                  return (
                    <div
                      key={`slot-${idx}`}
                      className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
                      style={{
                        marginLeft: `${x}px`,
                        marginTop: `${y}px`,
                      }}
                    >
                      {/* Counter-rotate the card so it stays upright! */}
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{
                          duration: 30,
                          ease: 'linear',
                          repeat: Infinity,
                        }}
                        className='relative'
                      >
                        <OrbitingCard card={card} delay={idx * 0.1} />
                      </motion.div>
                    </div>
                  );
                })}
              </motion.div>

              {/* Dotted Connections (Optional, decorative) */}
              <svg
                className='absolute inset-0 w-full h-full pointer-events-none z-0'
                viewBox='0 0 320 320'
              >
                <circle
                  cx='160'
                  cy='160'
                  r={window.innerWidth < 640 ? 110 : 130}
                  fill='none'
                  stroke='rgba(168, 162, 158, 0.3)'
                  strokeWidth='1'
                  strokeDasharray='4 6'
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Text and CTA Area (Bottom Half) ── */}
      <AnimatePresence>
        {showWorld && (
          <motion.div
            key='text'
            className='absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end px-6 pb-[6vh] pointer-events-none z-30'
            style={{
              background:
                'linear-gradient(to top, rgba(230,226,218,1) 0%, rgba(230,226,218,0.95) 60%, rgba(230,226,218,0) 100%)',
              paddingTop: '4rem',
            }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease }}
          >
            <motion.p
              className='text-stone-700 text-[10px] sm:text-[11px] font-mono font-semibold tracking-[0.3em] uppercase text-center drop-shadow-sm mb-1'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              {t(
                {
                  en: 'Entity Builders presents',
                  es: 'Entity Builders presenta',
                },
                lang,
              )}
            </motion.p>

            <motion.h1
              className='font-serif text-4xl sm:text-5xl lg:text-5xl text-stone-900 tracking-tight mb-3 text-center drop-shadow-sm'
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5, ease }}
            >
              PostalPeek
            </motion.h1>

            <motion.p
              className='text-stone-700 text-[13px] sm:text-sm text-center leading-relaxed max-w-[320px] mb-6 px-2 font-medium'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              {t(
                {
                  es: 'Un mundo entero documentado por nuestro agente de IA,  Walker. Coleccioná sus postales.',
                  en: 'An entire world documented by our AI agent, Walker. Collect his postcards.',
                },
                lang,
              )}
            </motion.p>

            {/* ── Feature Pills ── */}
            <div className='flex flex-col items-center gap-2 mb-6 w-full pointer-events-auto'>
              {[
                {
                  emoji: '🌍',
                  title: { en: 'Explore postcards', es: 'Explorá postales' },
                  delay: 0.7,
                },
                {
                  emoji: '🎯',
                  title: { en: 'Play to claim', es: 'Jugá para reclamar' },
                  delay: 0.8,
                },
                {
                  emoji: '📖',
                  title: { en: 'Complete albums', es: 'Completá álbumes' },
                  delay: 0.9,
                },
              ].map((pill) => (
                <motion.div
                  key={pill.emoji}
                  className='flex items-center gap-2.5 bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-[12px] px-5 py-2 shadow-sm w-full max-w-[240px]'
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: pill.delay,
                    type: 'spring',
                    bounce: 0.3,
                  }}
                >
                  <span className='text-base'>{pill.emoji}</span>
                  <p className='text-stone-800 text-[13px] font-semibold leading-tight'>
                    {t(pill.title, lang)}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* ── Onboarding CTA ── */}
            <motion.div
              className='w-full max-w-[240px] pointer-events-auto mt-2'
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, type: 'spring', bounce: 0.3 }}
            >
              <button
                onClick={onStartOnboarding}
                className='w-full bg-stone-900 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg active:scale-95 transition-all text-sm'
              >
                {t({ en: 'Start my collection', es: 'Empezar mi colección' }, lang)}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── OrbitingCard Subcomponent ──
function OrbitingCard({ card, delay }: { card: FeedItem; delay: number }) {
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [prevCardId, setPrevCardId] = useState(card.id);
  const [initialRotation] = useState(() => (Math.random() - 0.5) * 10);

  if (card.id !== prevCardId) {
    setPrevCardId(card.id);
    setFallbackEnabled(false);
  }

  const baseIllu = useSignedImage(card.illustration_url, { width: 300 });
  const rawIllu = useRawSignedImage(card.illustration_url);
  const illu = fallbackEnabled ? rawIllu : baseIllu;

  // Staggered pop-in
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.4 + delay, type: 'spring', damping: 15 }}
      className='w-[70px] h-[95px] sm:w-[85px] sm:h-[115px] bg-white p-1 pb-4 rounded pointer-events-auto shadow-lg border border-stone-200'
      style={{ rotate: initialRotation }}
    >
      <div className='w-full h-full bg-stone-200 rounded-sm overflow-hidden relative'>
        <AnimatePresence>
          {illu && (
            <motion.img
              key={card.id}
              src={illu}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, position: 'absolute', top: 0, left: 0 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              alt=''
              className='absolute inset-0 w-full h-full object-cover'
              onError={() => setFallbackEnabled(true)}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
