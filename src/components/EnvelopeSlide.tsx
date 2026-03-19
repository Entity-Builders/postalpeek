import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Sparkles } from 'lucide-react';
import { analytics } from '../lib/analytics';

interface EnvelopeSlideProps {
  isLoading: boolean;
  onOpen: () => void;
}

export function EnvelopeSlide({ isLoading, onOpen }: EnvelopeSlideProps) {
  const handleOpen = () => {
    analytics.track('daily_pack_envelope_tapped');
    onOpen();
  };

  return (
    <div className='w-full h-full flex flex-col items-center justify-center px-6 gap-6'>
      {/* Envelope visual */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className='flex flex-col items-center gap-5'
      >
        {/* Floating envelope icon */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className='relative'
        >
          {/* Glow halo */}
          <div
            className='absolute inset-0 rounded-full blur-2xl opacity-60'
            style={{ background: 'radial-gradient(circle, #f59e0b66 0%, transparent 70%)' }}
          />
          <div
            className='relative w-28 h-28 rounded-3xl flex items-center justify-center shadow-xl border border-amber-200/30'
            style={{
              background: 'linear-gradient(135deg, #fbbf24, #f97316, #ef4444)',
              boxShadow: '0 16px 48px rgba(251,146,60,0.4)',
            }}
          >
            <Mail className='w-14 h-14 text-white drop-shadow-lg' />
            {/* Red dot badge */}
            <span className='absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[9px] text-white font-bold'>
              1
            </span>
          </div>
        </motion.div>

        {/* Text */}
        <div className='text-center'>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className='font-serif text-2xl font-bold text-stone-800 mb-1'
          >
            ¡Tu sobre diario llegó!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className='text-stone-500 text-sm'
          >
            Tenés postales nuevas esperándote
          </motion.p>
        </div>
      </motion.div>

      {/* CTA Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 300, damping: 22 }}
        onClick={handleOpen}
        disabled={isLoading}
        className='relative flex items-center gap-2.5 pl-6 pr-7 py-4 rounded-full text-white font-semibold text-base
          active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
          shadow-[0_8px_30px_rgba(251,146,60,0.4)] hover:shadow-[0_12px_40px_rgba(251,146,60,0.55)]'
        style={{
          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
        }}
      >
        {/* Pulse ring */}
        {!isLoading && (
          <span className='absolute inset-0 rounded-full animate-ping opacity-30'
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
          />
        )}
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className='w-5 h-5' />
          </motion.div>
        ) : (
          <Mail className='w-5 h-5' />
        )}
        <span>{isLoading ? 'Abriendo...' : 'Abrir sobre'}</span>
      </motion.button>

      {/* Swipe hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className='text-xs text-stone-400'
      >
        o deslizá hacia abajo para explorar el feed
      </motion.p>
    </div>
  );
}
