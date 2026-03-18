import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t } from '../utils/i18n';
import { WIDTHS, cdnUrl } from '../utils/imageUtils';
import { useSignedImage } from '../utils/useSignedImage';
import { useWelcomeAnimation } from '../utils/useWelcomeAnimation';
import { analytics } from '../lib/analytics';

interface WalkerWelcomeProps {
  previewCards: FeedItem[];
}

/**
 * First-visit cinematic welcome screen.
 *
 * Layout uses flexbox with flex-grow ratios:
 *   - Postcards area: flex-[4.5] (takes ~45% of viewport)
 *   - Text area:      flex-[4.5] (takes ~45%)
 *   - Scroll hint:    flex-[1]   (takes ~10%)
 *
 * This makes it fully responsive — no magic percentages or absolute positioning.
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  const cards = previewCards.slice(0, 3);

  React.useEffect(() => {
    analytics.track('welcome_screen_viewed', { postcards_count: cards.length });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [fallbackEnabled, setFallbackEnabled] = useState(false);

  const baseImgUrl2 = useSignedImage(cards[2]?.illustration_url, { width: WIDTHS.thumb });
  const baseImgUrl1 = useSignedImage(cards[1]?.illustration_url, { width: WIDTHS.thumb });
  const baseImgUrl0 = useSignedImage(cards[0]?.illustration_url, { width: WIDTHS.thumb });

  const imgUrl2 = fallbackEnabled ? cdnUrl(cards[2]?.illustration_url || '') : baseImgUrl2;
  const imgUrl1 = fallbackEnabled ? cdnUrl(cards[1]?.illustration_url || '') : baseImgUrl1;
  const imgUrl0 = fallbackEnabled ? cdnUrl(cards[0]?.illustration_url || '') : baseImgUrl0;

  const handleImageFallback = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (e.currentTarget.src.includes('/cdn-cgi/image/')) {
      setFallbackEnabled(true);
    }
  };

  const anim = useWelcomeAnimation(imgUrl0);

  return (
    <div className="w-full h-full flex flex-col items-center select-none overflow-hidden">

      {/* ─── ZONE 1: Postcards (flex-[4.5] ≈ 45% of screen) ─── */}
      <motion.div
        className="flex-[4.5] w-full flex items-center justify-center relative min-h-0 overflow-hidden"
        {...anim.postcards}
      >
        {/* Postcard stack — sized by height of this zone, aspect-locked */}
        <div className="relative h-[85%] aspect-[3/4] max-w-[55%]">
          {/* Card 3 (back) — continuous sway */}
          {cards[2] && (
            <motion.div
              className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-40"
              {...anim.sway.back}
            >
              <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                {imgUrl2 && <img key={imgUrl2} src={imgUrl2} alt="" className="w-full h-full object-cover" loading="eager" onError={handleImageFallback} />}
              </div>
            </motion.div>
          )}

          {/* Card 2 (middle) — continuous sway */}
          {cards[1] && (
            <motion.div
              className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-60"
              {...anim.sway.middle}
            >
              <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                {imgUrl1 && <img key={imgUrl1} src={imgUrl1} alt="" className="w-full h-full object-cover" loading="eager" onError={handleImageFallback} />}
              </div>
            </motion.div>
          )}

          {/* Card 1 (front — hero, static) */}
          {cards[0] && (
            <div className="absolute inset-0 bg-white p-1.5 pb-6 rounded-sm shadow-xl -rotate-[1.5deg]">
              <div className="w-full h-[calc(100%-24px)] overflow-hidden rounded-[2px] bg-stone-100">
                {imgUrl0 && <img key={imgUrl0} src={imgUrl0} alt={t(cards[0].category)} className="w-full h-full object-cover" loading="eager" onError={handleImageFallback} />}
              </div>
              <p className="text-center font-handwriting text-[10px] sm:text-xs text-stone-500 mt-1 truncate px-1">
                {cards[0].city}, {cards[0].country}
              </p>
            </div>
          )}

          {/* Postmark stamp */}
          <div className="absolute -top-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm">
              <span className="font-mono text-[5px] sm:text-[6px] text-stone-600 uppercase tracking-wider text-center leading-tight">
                Postal<br />Peek
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── ZONE 2: Text content (flex-[4.5] ≈ 45% of screen) ─── */}
      <div className="flex-[4.5] flex flex-col items-center justify-start px-6 min-h-0">
        <motion.p
          className="text-stone-500 text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase mb-2 sm:mb-3 text-center"
          {...anim.presents}
        >
          Entity Builders presents
        </motion.p>

        <motion.h1
          className="font-serif text-3xl sm:text-5xl lg:text-6xl text-stone-900 tracking-tight mb-1 sm:mb-2 text-center"
          style={{ textShadow: '0 1px 8px rgba(255,255,255,0.5)' }}
          {...anim.title}
        >
          Kyle Walker
        </motion.h1>

        <motion.p
          className="text-stone-600 text-xs sm:text-sm lg:text-base tracking-wide mb-3 sm:mb-4 font-medium text-center"
          {...anim.subtitle}
        >
          Tu artista digital viajero
        </motion.p>

        <motion.p
          className="text-stone-700 text-sm sm:text-base lg:text-lg text-center leading-relaxed max-w-[400px] mb-3 sm:mb-4 px-2"
          {...anim.body}
        >
          Viajo por el mundo y pinto lo que veo.
          <br />
          Cada calle, cada café, cada rincón
          <br />
          se convierte en una postal de acuarela.
        </motion.p>

        <motion.div className="w-16 h-px bg-stone-400/60 mb-3 sm:mb-4" {...anim.divider} />

        {/* ─── Feature Pill: Coleccioná ─── */}
        <div className="flex items-center justify-center mb-3 sm:mb-4 px-2">
          <motion.div
            className="flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-stone-200/60 rounded-full px-4 py-2 sm:px-5 sm:py-2.5 shadow-sm"
            initial={anim.featurePill1.initial}
            animate={{
              ...anim.featurePill1.animate,
              y: [0, -3, 0],
            }}
            transition={{
              ...anim.featurePill1.transition,
              y: { delay: 3.4, duration: 3, ease: 'easeInOut', repeat: Infinity },
            }}
          >
            <span className="text-lg sm:text-xl">🃏</span>
            <div className="text-left">
              <p className="text-stone-800 text-xs sm:text-sm font-semibold leading-tight">Coleccioná postales</p>
              <p className="text-stone-500 text-[9px] sm:text-xs leading-tight">Cada una es un coleccionable único</p>
            </div>
          </motion.div>
        </div>

        {/* ─── Tutorial hint ─── */}
        <motion.p
          className="text-stone-600 text-xs sm:text-sm font-light italic font-serif text-center flex items-center justify-center gap-1.5"
          initial={anim.tutorialHint.initial}
          animate={{
            ...anim.tutorialHint.animate,
            opacity: [0, 1, 1, 0.6, 1],
          }}
          transition={{
            ...anim.tutorialHint.transition,
            opacity: { delay: 3.2, duration: 3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 },
          }}
        >
          <motion.span
            className="inline-block"
            animate={{ y: [0, -4, 0] }}
            transition={{ delay: 4.0, duration: 1.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.5 }}
          >
            👇
          </motion.span>
          Deslizá y reclamá tu primera postal
        </motion.p>
      </div>

      {/* ─── ZONE 3: Scroll Hint (flex-[1] = ~10% of screen) ─── */}
      <motion.div
        className="flex-[1] flex flex-col items-center justify-center gap-1 text-stone-500 animate-bounce min-h-0"
        {...anim.scrollHint}
      >
        <ChevronDown className="w-5 h-5" />
        <span className="text-xs tracking-[0.2em] uppercase font-semibold">
          Scroll to explore
        </span>
      </motion.div>
    </div>
  );
}
