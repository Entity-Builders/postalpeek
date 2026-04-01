import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { WIDTHS, cdnUrl } from '../utils/imageUtils';
import { useSignedImage, useRawSignedImage } from '../utils/useSignedImage';
import { analytics } from '../lib/analytics';
import { useLang, t } from '../utils/i18n';

interface WalkerWelcomeProps {
  previewCards: FeedItem[];
}

// ── Easing ──
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Three-phase cinematic welcome (Now updated for 3 cards rapid cycle):
 *
 * Sequence:
 *   - Card 0: Photo -> Watercolor
 *   - Card 1: Photo -> Watercolor
 *   - Card 2: Photo -> Watercolor -> Frame
 *   - Frame Card 2 -> Sweep in Card 0 and 1 behind it -> Show Text
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  const lang = useLang();
  
  const isLoaded = previewCards && previewCards.length > 0;
  const cards = React.useMemo(() => {
    if (!isLoaded) return [];
    return [...previewCards].sort(() => 0.5 - Math.random()).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const [seq, setSeq] = useState<{ index: number; phase: 'photo' | 'watercolor' | 'text' }>({ index: 0, phase: 'photo' });
  const [showText, setShowText] = useState(false);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const handleImageFallback = () => setFallbackEnabled(true);


  useEffect(() => {
    if (cards[seq.index]) {
      analytics.track('welcome_seq_step', { 
        step_index: seq.index,
        step_phase: seq.phase,
        card_id: cards[seq.index].id 
      });
    }
  }, [seq.index, seq.phase, cards]);

  useEffect(() => {
    // Only start the sequence once we actually have cards to show
    if (cards.length === 0) return;

    // Show text while cards are still cycling
    const t_txt = setTimeout(() => setShowText(true), 400);

    // Rapid Multi-Card Sequence (inside static frame)
    // Card 0
    const t0_w = setTimeout(() => setSeq({ index: 0, phase: 'watercolor' }), 800);
    // Card 1
    const t1_p = setTimeout(() => setSeq({ index: 1, phase: 'photo' }), 1800);
    const t1_w = setTimeout(() => setSeq({ index: 1, phase: 'watercolor' }), 2600);
    // Card 2
    const t2_p = setTimeout(() => setSeq({ index: 2, phase: 'photo' }), 3600);
    const t2_w = setTimeout(() => setSeq({ index: 2, phase: 'watercolor' }), 4400);
    // Sweep background cards at the end
    const t_end  = setTimeout(() => setSeq({ index: 2, phase: 'text' }), 5300);

    return () => {
      clearTimeout(t_txt);
      clearTimeout(t0_w); clearTimeout(t1_p); clearTimeout(t1_w);
      clearTimeout(t2_p); clearTimeout(t2_w); clearTimeout(t_end);
    };
  }, [cards.length]); // Add cards.length as dependency so it starts exactly when populated

  if (cards.length === 0) return null; // Safe guard

  // Fixed dimensions for the final standard postcard UI
  // Make them slightly smaller on mobile to give the text more breathing room
  const cardWidth = window.innerWidth < 640 ? 250 : 320;
  const cardHeight = window.innerWidth < 640 ? 320 : 430;

  // The cards that sweep into the background at the end
  const backgroundCards = cards.filter((_, i) => i !== seq.index);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-start overflow-hidden bg-[#e6e2da]">

      {/* ═══════════════════════════════════════════════════════
          PHASE 1 & 2: Image Container (Photo -> Watercolor -> Framed)
         ═══════════════════════════════════════════════════════ */}
       {/* 
          When NOT framed, the image takes up 100vh / 100vw.
          When FRAMED, it shrinks to postcard size and pushes UP, 
          leaving the bottom half of the screen for the text.
       */}
      <motion.div
        className="absolute z-10 flex flex-col items-center justify-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: 1,
          scale: 1,
          width: cardWidth,
          height: cardHeight,
          top: window.innerWidth < 640 ? '12%' : '14%', 
        }}
        transition={{ duration: 1.2, ease }}
      >
        <div
           className="relative w-full h-full flex flex-col rounded-xl bg-white"
           style={{
             boxShadow: '0 8px 30px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)',
             padding: '8px 8px 32px 8px',
           }}
        >
          {/* Secondary cards stacked behind. Sweep in at the end. */}
          <AnimatePresence>
            {seq.phase === 'text' && backgroundCards.length > 0 && (
              <motion.div
                className="absolute inset-0 z-[-1]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease }}
              >
                {backgroundCards.map((card, i) => {
                  const rotation = i === 0 ? -6 : 8;
                  const xOffset = i === 0 ? -20 : 25;
                  const yOffset = i === 0 ? 10 : 15;
                  
                  return (
                    <motion.div
                      key={card.id}
                      className="absolute inset-0 rounded-xl bg-white flex flex-col"
                      style={{
                        padding: '8px 8px 32px 8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      }}
                      initial={{ scale: 0.8, rotate: 0, x: 0, y: 0, opacity: 0 }}
                      animate={{ scale: 1, rotate: rotation, x: xOffset, y: yOffset, opacity: 1 }}
                      transition={{ duration: 0.8, ease, delay: 0.2 + (i * 0.1) }}
                    >
                      <div className="w-full h-full rounded shadow-inner bg-stone-200 overflow-hidden">
                         <img src={cdnUrl(card.illustration_url)} alt="" className="w-full h-full object-cover opacity-80" />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* The Image Area */}
          <div 
              className="relative w-full h-full flex-1"
          >
            {/* Inner mask to match PostcardFront styling when framed */}
             <div className="w-full h-full overflow-hidden relative rounded-[4px]" style={{
                 boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
             }}>
                <AnimatePresence>
                   {cards.map((card, i) => i <= seq.index && (
                      <HeroSlide 
                         key={card.id}
                         card={card}
                         isActive={i === seq.index}
                         isWatercolor={seq.phase !== 'photo' || i < seq.index}
                         isBelow={i < seq.index}
                         fallbackEnabled={fallbackEnabled}
                         handleFallback={handleImageFallback}
                      />
                   ))}
                </AnimatePresence>
            </div>
          </div>

        </div>
        
        {/* Postmark stamp */}
        <AnimatePresence>
          {seq.phase === 'text' && (
             <motion.div
               className="absolute top-2 right-2 sm:top-4 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20"
               initial={{ scale: 0, rotate: -20, opacity: 0 }}
               animate={{ scale: 1, rotate: 12, opacity: 1 }}
               exit={{ scale: 0, opacity: 0 }}
               transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
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
          PHASE 2: Text Reveal (While images animate)
         ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showText && (
          <>
            {/* Top Branding */}
            <motion.p
              key="top-branding"
              className="absolute top-[5%] sm:top-[6%] left-0 right-0 z-20 text-stone-700 text-[10px] sm:text-[11px] font-mono font-semibold tracking-[0.3em] uppercase text-center drop-shadow-sm pointer-events-none"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease }}
            >
              {t({ en: 'Entity Builders presents', es: 'Entity Builders presenta' }, lang)}
            </motion.p>

            {/* Bottom Content */}
            <motion.div
              key="text"
            // Start the text block from the bottom half, push it up enough so it doesn't get cut off but not so high it hits the cards
            className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end px-6 pb-[6vh] pointer-events-none z-20"
            style={{
              // Fallback background slightly fading up to help with text contrast
              background: 'linear-gradient(to top, rgba(230,226,218,1) 0%, rgba(230,226,218,0.85) 60%, rgba(230,226,218,0) 100%)',
              paddingTop: '6rem' // create gradient space above texts
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            {/* PostalPeek Branding */}

            <motion.h1
              className="font-serif text-3xl sm:text-4xl lg:text-5xl text-stone-900 tracking-tight mb-2 text-center"
              style={{ textShadow: '0 2px 10px rgba(255,255,255,0.7), 0 0 40px rgba(255,255,255,0.5)' }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, ease }}
            >
              PostalPeek
            </motion.h1>

            <motion.p
              className="text-stone-700 text-[13px] sm:text-sm text-center leading-relaxed max-w-[320px] mb-5 px-2 font-medium"
              style={{ textShadow: '0 1px 4px rgba(255,255,255,0.8)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease }}
            >
              {t({
                es: 'Todo este mundo está siendo documentado por Kyle Walker, nuestro agente de IA. Él viaja sin parar, tomando fotos y transformándolas en acuarelas. Coleccioná sus postales.',
                en: 'This entire world is being documented by Kyle Walker, our AI agent. He travels non-stop, taking photos and transforming them into watercolors. Collect his postcards.'
              }, lang)}
            </motion.p>


            {/* ── Feature Pills ── */}
            <div className="flex flex-col items-center gap-2 mb-6 w-full pointer-events-auto">
              {[
                { emoji: '🌍', title: { en: 'Explore postcards', es: 'Explorá postales' }, delay: 0.8 },
                { emoji: '🎯', title: { en: 'Play to claim', es: 'Jugá para reclamar' }, delay: 0.9 },
                { emoji: '📖', title: { en: 'Complete albums', es: 'Completá álbumes' }, delay: 1.0 },
              ].map((pill) => (
                <motion.div
                  key={pill.emoji}
                  className="flex items-center gap-2.5 bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-[12px] px-5 py-2 shadow-sm w-full max-w-[240px]"
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: pill.delay, duration: 0.5, ease }}
                >
                  <span className="text-base">{pill.emoji}</span>
                  <p className="text-stone-800 text-[13px] font-semibold leading-tight">{t(pill.title, lang)}</p>
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
                className="text-[11px] font-medium italic font-serif flex items-center gap-1.5"
                style={{ textShadow: '0 1px 4px rgba(255,255,255,0.8)' }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ delay: 1.5, duration: 2.5, repeat: Infinity, repeatDelay: 0.5 }}
              >
                <motion.span
                  className="inline-block"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ delay: 1.5, duration: 1.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.5 }}
                >
                  👇
                </motion.span>
                {t({ en: 'Swipe to explore', es: 'Deslizá para explorar' }, lang)}
              </motion.p>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ChevronDown className="w-5 h-5 drop-shadow-md text-stone-700" />
              </motion.div>
            </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── HeroSlide Subcomponent ──
function HeroSlide({ card, isActive, isWatercolor, isBelow, fallbackEnabled, handleFallback }: { card: FeedItem, isActive: boolean, isWatercolor: boolean, isBelow: boolean, fallbackEnabled: boolean, handleFallback: () => void }) {
  const baseOrig = useSignedImage(card.original_image_url, { width: WIDTHS.desktop });
  const rawOrig = useRawSignedImage(card.original_image_url);
  const orig = fallbackEnabled ? rawOrig : baseOrig;

  const baseIllu = useSignedImage(card.illustration_url, { width: WIDTHS.desktop });
  const rawIllu = useRawSignedImage(card.illustration_url);
  const illu = fallbackEnabled ? rawIllu : baseIllu;

  const [initialRotation] = useState(() => (Math.random() - 0.5) * 4);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full origin-center"
      initial={{ opacity: 0, scale: 1.15, y: -40, rotateZ: initialRotation }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateZ: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ pointerEvents: isActive ? 'auto' : 'none', zIndex: isBelow ? 0 : 10 }}
    >
      <motion.div
        className="absolute inset-0 w-full h-full origin-center"
        initial={{ scale: 1.15, rotateZ: 1 }}
        animate={{ scale: isBelow ? 1.05 : 1.15, rotateZ: isBelow ? 0 : 1 }}
        transition={{ duration: 6, ease: "linear" }}
      >
        {orig && (
          <img
            src={orig}
            alt="Real location"
            className="absolute inset-0 w-full h-full object-cover"
            onError={handleFallback}
          />
        )}
        {illu && (
          <motion.img
            src={illu}
            alt={card.city || 'Postcard'}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: isWatercolor ? 1 : 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            onError={handleFallback}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

