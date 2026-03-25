import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Loader2, Gem, ShieldCheck } from 'lucide-react';
import { useLang, t } from '../../utils/i18n';

interface ClaimButtonProps {
  postcardId: string;
  isClaimedByMe: boolean;
  isClaimed: boolean;
  isClaimLoading: boolean;
  onClaimPostcard?: (postcardId: string) => void;
  onAuthRequired?: (postcardId: string) => void;
  showClaimGuide: boolean;
  isInAlbum: boolean;
}

export function ClaimButton({
  postcardId,
  isClaimedByMe,
  isClaimed,
  isClaimLoading,
  onClaimPostcard,
  onAuthRequired,
  showClaimGuide,
  isInAlbum,
}: ClaimButtonProps) {
  const lang = useLang();
  const [showClaimedTooltip, setShowClaimedTooltip] = useState(false);
  const [showClaimTooltip, setShowClaimTooltip] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  return (
    <div className='relative'>
      {/* Tutorial guide tooltip */}
      {showClaimGuide && !isClaimedByMe && (
        <motion.div
          className='absolute bottom-full right-0 mb-2 z-50 pointer-events-none'
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: [0, -4, 0] }}
          transition={{ y: { duration: 1.5, ease: 'easeInOut', repeat: Infinity }, opacity: { duration: 0.4 } }}
        >
          <div className='bg-amber-500 text-white text-[11px] font-semibold px-3 py-2 rounded-lg shadow-lg whitespace-nowrap'>
            {t({ es: '¡Reclamá esta postal! 👆', en: 'Claim this postcard! 👆' }, lang)}
            <div className='absolute top-full right-4 w-2 h-2 bg-amber-500 rotate-45 -translate-y-1' />
          </div>
        </motion.div>
      )}

      {isClaimedByMe ? (
        <button
          className='p-2 md:p-2.5 rounded-full bg-amber-100 text-amber-600 cursor-default ring-1 ring-amber-300/50 transition-all'
          title={t({ es: 'Ya es tuya', en: 'Already yours' }, lang)}
        >
          <ShieldCheck className='w-4 h-4 md:w-5 md:h-5' />
        </button>
      ) : (
        <>
          <button
            className='p-2 md:p-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-500 hover:text-amber-600 hover:scale-105 transition-all'
            disabled={isClaimLoading}
            onMouseEnter={() => { if (!isClaimed) setShowClaimTooltip(true); }}
            onMouseLeave={() => setShowClaimTooltip(false)}
            onClick={(e) => {
              e.stopPropagation();
              setShowClaimTooltip(false);
              if (isClaimed) {
                setShowClaimedTooltip((prev) => !prev);
                setTimeout(() => setShowClaimedTooltip(false), 2500);
                return;
              }
              if (!onClaimPostcard) {
                // Tutorial flow: show confetti first, then auth gate after delay
                if (showClaimGuide) {
                  setShowConfetti(true);
                  setTimeout(() => {
                    setShowConfetti(false);
                    onAuthRequired?.(postcardId);
                  }, 1800);
                } else {
                  onAuthRequired?.(postcardId);
                }
                return;
              }
              onClaimPostcard(postcardId);
              if (isInAlbum) {
                setTimeout(() => {
                  setShowConfetti(true);
                  setTimeout(() => setShowConfetti(false), 1500);
                }, 200);
              }
            }}
          >
            {isClaimLoading ? (
              <Loader2 className='w-4 h-4 md:w-5 md:h-5 animate-spin' />
            ) : (
              <Gem className='w-4 h-4 md:w-5 md:h-5' />
            )}
          </button>
          {showClaimTooltip && (
            <div className='absolute bottom-full right-0 mb-2 px-3 py-2 bg-stone-800 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none'>
              {t({ es: 'Reclamar esta postal', en: 'Claim this postcard' }, lang)}
              <div className='absolute top-full right-4 w-2 h-2 bg-stone-800 rotate-45 -translate-y-1' />
            </div>
          )}
          {showClaimedTooltip && (
            <div
              className='absolute bottom-full right-0 mb-2 px-3 py-2 bg-stone-800 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50'
              onClick={(e) => {
                e.stopPropagation();
                setShowClaimedTooltip(false);
              }}
            >
              {t({ es: 'Esta postal ya fue adquirida 🃏', en: 'This postcard is already claimed 🃏' }, lang)}
              <div className='absolute top-full right-4 w-2 h-2 bg-stone-800 rotate-45 -translate-y-1' />
            </div>
          )}
        </>
      )}

      {/* Confetti Lottie */}
      {showConfetti && (
        <div
          className='pointer-events-none z-50'
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 300,
            height: 300,
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
    </div>
  );
}
