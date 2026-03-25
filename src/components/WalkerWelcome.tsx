import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { WIDTHS, cdnUrl } from '../utils/imageUtils';
import { useSignedImage } from '../utils/useSignedImage';
import { analytics } from '../lib/analytics';

interface WalkerWelcomeProps {
  previewCards: FeedItem[];
}

// ── Easing ──
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Two-phase cinematic welcome:
 *
 * Phase 1 — Postcard Showcase (~5s)
 *   Cards appear one by one, centered and large.
 *   Each card gets ~1.6s of spotlight time.
 *
 * Phase 2 — Text Reveal
 *   Cards fade/shrink up, text + pills sweep in from below.
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  const cards = previewCards.slice(0, 3);

  useEffect(() => {
    analytics.track('welcome_screen_viewed', { postcards_count: cards.length });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Signed image URLs
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const baseImg0 = useSignedImage(cards[0]?.illustration_url, { width: WIDTHS.thumb });
  const baseImg1 = useSignedImage(cards[1]?.illustration_url, { width: WIDTHS.thumb });
  const baseImg2 = useSignedImage(cards[2]?.illustration_url, { width: WIDTHS.thumb });
  const imgUrls = [
    fallbackEnabled ? cdnUrl(cards[0]?.illustration_url || '') : baseImg0,
    fallbackEnabled ? cdnUrl(cards[1]?.illustration_url || '') : baseImg1,
    fallbackEnabled ? cdnUrl(cards[2]?.illustration_url || '') : baseImg2,
  ];

  const handleImageFallback = () => { setFallbackEnabled(true); };

  // ── Phase state ──
  const [activeCard, setActiveCard] = useState(0); // 0, 1, 2
  const [phase, setPhase] = useState<'showcase' | 'text'>('showcase');

  useEffect(() => {
    // Card 0 shows immediately, Card 1 at 1.6s, Card 2 at 3.2s, text at 4.8s
    const delays = [1600, 3200, 4800];

    const t1 = setTimeout(() => setActiveCard(1), delays[0]);
    const t2 = setTimeout(() => setActiveCard(2), delays[1]);
    const t3 = setTimeout(() => setPhase('text'), delays[2]);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-[#e6e2da]">

      {/* ═══════════════════════════════════════════════════════
          PHASE 1: Postcard Showcase
          Cards cycle one by one, centered, with crossfade
         ═══════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {phase === 'showcase' && (
          <motion.div
            key="showcase"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            exit={{ opacity: 0, y: -60, scale: 0.9 }}
            transition={{ duration: 0.6, ease }}
          >
            {/* Postcard frame */}
            <div className="relative w-[280px] h-[380px] sm:w-[320px] sm:h-[430px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCard}
                  className="absolute inset-0 rounded-lg overflow-hidden bg-white shadow-2xl"
                  style={{
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.08)',
                  }}
                  initial={{ opacity: 0, scale: 0.92, rotateZ: -2 }}
                  animate={{ opacity: 1, scale: 1, rotateZ: 0 }}
                  exit={{ opacity: 0, scale: 0.95, rotateZ: 2, y: -20 }}
                  transition={{ duration: 0.5, ease }}
                >
                  {/* Image */}
                  <div className="w-full h-[75%] bg-stone-200 overflow-hidden">
                    {imgUrls[activeCard] && (
                      <img
                        src={imgUrls[activeCard]}
                        alt={cards[activeCard]?.city || 'Postcard'}
                        className="w-full h-full object-cover"
                        onError={handleImageFallback}
                      />
                    )}
                  </div>
                  {/* Caption strip */}
                  <div className="flex-1 flex flex-col items-center justify-center px-4 py-3">
                    <p className="text-stone-800 text-sm sm:text-base font-serif font-medium text-center">
                      {cards[activeCard]?.city || ''}
                      {cards[activeCard]?.city && cards[activeCard]?.country ? ', ' : ''}
                      {cards[activeCard]?.country || ''}
                    </p>
                    {cards[activeCard]?.description && (
                      <p className="text-stone-500 text-[11px] sm:text-xs text-center mt-0.5 line-clamp-1">
                        {typeof cards[activeCard].description === 'string'
                          ? cards[activeCard].description
                          : (cards[activeCard].description as { es?: string; en?: string })?.es || (cards[activeCard].description as { es?: string; en?: string })?.en || ''}
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Postmark stamp */}
              <motion.div
                className="absolute -top-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 12 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                  <span className="font-mono text-[5px] sm:text-[6px] text-stone-600 uppercase tracking-wider text-center leading-tight">
                    Postal<br />Peek
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Card counter dots */}
            <div className="flex items-center gap-2 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  animate={{
                    width: i === activeCard ? 20 : 6,
                    height: 6,
                    backgroundColor: i === activeCard ? '#78716c' : '#d6d3d1',
                  }}
                  transition={{ duration: 0.3, ease }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          PHASE 2: Text Reveal
          Sweeps in after postcards exit
         ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === 'text' && (
          <motion.div
            key="text"
            className="absolute inset-0 flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
          >
            {/* PostalPeek postmark logo */}
            <motion.div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] border-stone-500/40 flex items-center justify-center mb-4 rotate-12"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 12 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 250, damping: 18 }}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dashed border-stone-500/50 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                <span className="font-mono text-[10px] sm:text-[12px] text-stone-700 uppercase tracking-wider text-center leading-tight font-bold">
                  Postal<br />Peek
                </span>
              </div>
            </motion.div>

            <motion.p
              className="text-stone-500 text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase mb-3 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5, ease }}
            >
              Entity Builders presents
            </motion.p>

            <motion.h1
              className="font-serif text-4xl sm:text-5xl lg:text-6xl text-stone-900 tracking-tight mb-2 text-center"
              style={{ textShadow: '0 1px 8px rgba(255,255,255,0.5)' }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5, ease }}
            >
              PostalPeek
            </motion.h1>

            <motion.p
              className="text-stone-600 text-sm sm:text-base tracking-wide mb-4 font-medium text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5, ease }}
            >
              Postales de acuarela del mundo entero
            </motion.p>

            <motion.p
              className="text-stone-700 text-sm sm:text-base text-center leading-relaxed max-w-[380px] mb-5 px-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5, ease }}
            >
              Kyle Walker recorre el mundo y pinta lo que ve.
              <br />
              Explorá sus postales, jugá con cada ilustración
              <br />
              y armá tu colección.
            </motion.p>

            <motion.div
              className="w-16 h-px bg-stone-400/60 mb-5"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.9, duration: 0.4, ease }}
            />

            {/* ── Feature Pills ── */}
            <div className="flex flex-col items-center gap-2.5 mb-5">
              {[
                { emoji: '🌍', title: 'Explorá postales', sub: 'Cada una es única e irrepetible', delay: 1.0 },
                { emoji: '🎯', title: 'Jugá para reclamar', sub: 'Buscá objetos ocultos o armá puzzles', delay: 1.1 },
                { emoji: '📖', title: 'Completá álbumes', sub: 'Colecciones temáticas del mundo', delay: 1.2 },
              ].map((pill) => (
                <motion.div
                  key={pill.title}
                  className="flex items-center gap-2.5 bg-white/70 backdrop-blur-sm border border-stone-200/60 rounded-full px-5 py-2.5 shadow-sm w-full max-w-[280px]"
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: pill.delay, duration: 0.5, ease }}
                >
                  <span className="text-lg">{pill.emoji}</span>
                  <div className="text-left">
                    <p className="text-stone-800 text-xs sm:text-sm font-semibold leading-tight">{pill.title}</p>
                    <p className="text-stone-500 text-[9px] sm:text-xs leading-tight">{pill.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Scroll hint ── */}
            <motion.div
              className="flex flex-col items-center gap-1 text-stone-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              <motion.p
                className="text-xs font-light italic font-serif flex items-center gap-1.5"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ delay: 2.0, duration: 2.5, repeat: Infinity, repeatDelay: 0.5 }}
              >
                <motion.span
                  className="inline-block"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ delay: 2.0, duration: 1.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.5 }}
                >
                  👇
                </motion.span>
                Deslizá para explorar
              </motion.p>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ChevronDown className="w-5 h-5" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
