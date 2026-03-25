import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { WIDTHS } from '../utils/imageUtils';
import { useSignedImage, useRawSignedImage } from '../utils/useSignedImage';
import { analytics } from '../lib/analytics';

interface WalkerWelcomeProps {
  previewCards: FeedItem[];
}

// ── Easing ──
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Three-phase cinematic welcome:
 *
 * Phase 1 — The Transformation (~4s)
 *   Full frame (or slightly zoomed out) showing the real photo,
 *   slowly crossfading into the watercolor illustration while panning (Ken Burns).
 *
 * Phase 2 — The Frame (~1.5s)
 *   The full frame shrinks down and a white Polaroid border appears.
 *
 * Phase 3 — The Text Reveal
 *   Text + pills sweep in from below.
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  // We only use the very first card for this epic intro.
  const heroCard = previewCards[0];

  useEffect(() => {
    analytics.track('welcome_screen_viewed', { 
      hero_card_id: heroCard?.id,
      hero_card_city: heroCard?.city 
    });
  }, [heroCard]);

  // ── Image Loading ──
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const handleImageFallback = () => setFallbackEnabled(true);

  // Original Photo (The "Street View")
  const baseOriginalUrl = useSignedImage(heroCard?.original_image_url, { width: WIDTHS.desktop });
  const rawOriginalUrl = useRawSignedImage(heroCard?.original_image_url);
  const originalUrl = fallbackEnabled ? rawOriginalUrl : baseOriginalUrl;

  // Watercolor Illustration
  const baseIllustrationUrl = useSignedImage(heroCard?.illustration_url, { width: WIDTHS.desktop });
  const rawIllustrationUrl = useRawSignedImage(heroCard?.illustration_url);
  const illustrationUrl = fallbackEnabled ? rawIllustrationUrl : baseIllustrationUrl;

  // ── Phase state ──
  // 'photo' -> 'watercolor' -> 'framed' -> 'text'
  const [phase, setPhase] = useState<'photo' | 'watercolor' | 'framed' | 'text'>('photo');

  useEffect(() => {
    // Timing sequence
    // 0.0s: Start showing photo, slowly zooming out
    // 1.5s: Start crossfading to watercolor
    // 4.0s: Start framing (shrinking adding border)
    // 5.5s: Show text
    const t1 = setTimeout(() => setPhase('watercolor'), 1500);
    const t2 = setTimeout(() => setPhase('framed'), 4000);
    const t3 = setTimeout(() => setPhase('text'), 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (!heroCard) return null;

  const isFramed = phase === 'framed' || phase === 'text';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-[#e6e2da]">

      {/* ═══════════════════════════════════════════════════════
          PHASE 1 & 2: Image Container (Photo -> Watercolor -> Framed)
         ═══════════════════════════════════════════════════════ */}
       {/* 
          We place the image wrapper in absolute center.
          When NOT framed, it takes up a large portion of the screen (e.g. 100vh / 100vw).
          When FRAMED, it shrinks to the standard postcard size.
       */}
      <motion.div
        className="absolute z-10 flex flex-col items-center justify-center"
        initial={false}
        animate={{
          // When framed, use standard postcard dimensions and positioning
          width: isFramed ? (window.innerWidth < 640 ? 280 : 320) : '100%',
          height: isFramed ? (window.innerWidth < 640 ? 380 : 430) : '100%',
          y: isFramed ? -80 : 0, // Move up a bit when framed to make room for text
        }}
        transition={{ duration: 1.2, ease }}
      >
        <motion.div
           className="relative w-full h-full overflow-hidden bg-stone-200 flex flex-col"
           animate={{
            borderRadius: isFramed ? 8 : 0,
            boxShadow: isFramed ? '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.08)' : 'none',
           }}
           transition={{ duration: 1.2, ease }}
        >
            {/* The Image Area */}
            <motion.div 
               className="relative w-full"
               animate={{
                 height: isFramed ? '75%' : '100%',
               }}
               transition={{ duration: 1.2, ease }}
            >
              {/* Ken Burns Effect Wrapper */}
              <motion.div
                className="absolute inset-0 w-full h-full origin-center"
                initial={{ scale: 1.15, rotateZ: 1 }}
                animate={{ scale: 1.05, rotateZ: 0 }}
                transition={{ duration: 6, ease: "linear" }}
              >
                  {/* Photo (Bottom Layer) */}
                  {originalUrl && (
                    <img
                      src={originalUrl}
                      alt="Real location"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={handleImageFallback}
                    />
                  )}

                  {/* Watercolor (Top Layer, fades in) */}
                  {illustrationUrl && (
                    <motion.img
                      src={illustrationUrl}
                      alt={heroCard.city || 'Postcard'}
                      className="absolute inset-0 w-full h-full object-cover"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: phase === 'photo' ? 0 : 1 }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                      onError={handleImageFallback}
                    />
                  )}
              </motion.div>
            </motion.div>

            {/* Caption strip (only visible when framed) */}
            <motion.div 
              className="w-full bg-white flex flex-col items-center justify-center px-4"
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: isFramed ? '25%' : '0%', 
                opacity: isFramed ? 1 : 0 
              }}
              transition={{ duration: 1.0, ease, delay: isFramed ? 0.2 : 0 }}
            >
              <div className="flex flex-col items-center justify-center py-2 h-full overflow-hidden">
                <p className="text-stone-800 text-sm sm:text-base font-serif font-medium text-center whitespace-nowrap">
                  {heroCard.city || ''}
                  {heroCard.city && heroCard.country ? ', ' : ''}
                  {heroCard.country || ''}
                </p>
                {heroCard.description && (
                  <p className="text-stone-500 text-[11px] sm:text-xs text-center mt-0.5 max-w-[90%] truncate">
                    {typeof heroCard.description === 'string'
                      ? heroCard.description
                      : (heroCard.description as { es?: string; en?: string })?.es || (heroCard.description as { es?: string; en?: string })?.en || ''}
                  </p>
                )}
              </div>
            </motion.div>

        </motion.div>
        
        {/* Postmark stamp */}
        <AnimatePresence>
          {isFramed && (
             <motion.div
               className="absolute top-2 right-2 sm:top-4 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20"
               initial={{ scale: 0, rotate: -20, opacity: 0 }}
               animate={{ scale: 1, rotate: 12, opacity: 1 }}
               exit={{ scale: 0, opacity: 0 }}
               transition={{ delay: 0.8, type: 'spring', stiffness: 300, damping: 20 }}
             >
               <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                 <span className="font-mono text-[5px] sm:text-[6px] text-stone-600 uppercase tracking-wider text-center leading-tight">
                   Postal<br />Peek
                 </span>
               </div>
             </motion.div>
          )}
        </AnimatePresence>
      </motion.div>


      {/* ═══════════════════════════════════════════════════════
          PHASE 3: Text Reveal
          Sweeps in after the framing is mostly done
         ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === 'text' && (
          <motion.div
            key="text"
            className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end px-6 pb-[12vh] pointer-events-none z-20"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            {/* PostalPeek Branding */}
            <motion.p
              className="text-stone-500 text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase mb-2 text-center drop-shadow-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease }}
            >
              Entity Builders presents
            </motion.p>

            <motion.h1
              className="font-serif text-4xl sm:text-5xl lg:text-5xl text-stone-900 tracking-tight mb-2 text-center"
              style={{ textShadow: '0 2px 10px rgba(255,255,255,0.7), 0 0 40px rgba(255,255,255,0.5)' }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, ease }}
            >
              PostalPeek
            </motion.h1>

            <motion.p
              className="text-stone-700 text-sm sm:text-base text-center leading-relaxed max-w-[320px] mb-6 px-2 font-medium"
              style={{ textShadow: '0 1px 4px rgba(255,255,255,0.8)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease }}
            >
              Kyle Walker recorre el mundo y pinta lo que ve. Explorá sus postales y armá tu colección.
            </motion.p>


            {/* ── Feature Pills ── */}
            <div className="flex flex-col items-center gap-2 mb-6 w-full pointer-events-auto">
              {[
                { emoji: '🌍', title: 'Explorá postales', delay: 0.6 },
                { emoji: '🎯', title: 'Jugá para reclamar', delay: 0.7 },
                { emoji: '📖', title: 'Completá álbumes', delay: 0.8 },
              ].map((pill) => (
                <motion.div
                  key={pill.title}
                  className="flex items-center gap-2.5 bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-full px-5 py-2 shadow-sm w-full max-w-[260px]"
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: pill.delay, duration: 0.5, ease }}
                >
                  <span className="text-base">{pill.emoji}</span>
                  <p className="text-stone-800 text-xs font-semibold leading-tight">{pill.title}</p>
                </motion.div>
              ))}
            </div>

            {/* ── Scroll hint ── */}
            <motion.div
              className="flex flex-col items-center gap-1 text-stone-600 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <motion.p
                className="text-xs font-medium italic font-serif flex items-center gap-1.5"
                style={{ textShadow: '0 1px 4px rgba(255,255,255,0.8)' }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ delay: 1.5, duration: 2.5, repeat: Infinity, repeatDelay: 0.5 }}
              >
                <motion.span
                  className="inline-block"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ delay: 1.5, duration: 1.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.5 }}
                >
                  👇
                </motion.span>
                Deslizá para explorar
              </motion.p>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ChevronDown className="w-5 h-5 drop-shadow-md text-stone-700" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

