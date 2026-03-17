import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail } from 'lucide-react';

interface DailyPackButtonProps {
  isAvailable: boolean;
  isLoading: boolean;
  onOpen: () => void;
}

export function DailyPackButton({ isAvailable, isLoading, onOpen }: DailyPackButtonProps) {
  if (!isAvailable) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
        onClick={onOpen}
        disabled={isLoading}
        className='fixed bottom-6 right-6 z-[60] flex items-center gap-2.5
          bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400
          text-white font-semibold text-sm
          pl-4 pr-5 py-3 rounded-full
          shadow-[0_8px_30px_rgba(251,146,60,0.45)]
          hover:shadow-[0_12px_40px_rgba(251,146,60,0.6)]
          active:scale-95
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed'
        aria-label='Abrir sobre diario'
      >
        {/* Pulse ring */}
        <span className='absolute inset-0 rounded-full animate-ping bg-amber-400/30 pointer-events-none' />

        <motion.span
          animate={{ rotate: [0, -10, 10, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 3 }}
        >
          <Mail className='w-5 h-5' />
        </motion.span>
        <span>{isLoading ? 'Abriendo...' : '¡Sobre diario!'}</span>

        {/* Badge dot */}
        <span className='absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm' />
      </motion.button>
    </AnimatePresence>
  );
}
