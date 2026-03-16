import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, X } from 'lucide-react';

interface WelcomeToastProps {
  onOpenAlbums: () => void;
  onDismiss: () => void;
}

/**
 * Post-login toast that informs the user they have an album postcard
 * in their collection and invites them to explore albums.
 */
export function WelcomeToast({ onOpenAlbums, onDismiss }: WelcomeToastProps) {
  return (
    <motion.div
      className='fixed top-6 left-1/2 z-[200] w-[92vw] max-w-md'
      style={{ x: '-50%' }}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div
        className='bg-white/95 backdrop-blur-md border border-stone-200/60 rounded-2xl shadow-2xl shadow-black/10 px-4 py-3.5 flex items-center gap-3 cursor-pointer'
        onClick={onOpenAlbums}
      >
        {/* Icon */}
        <div className='shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center'>
          <Trophy className='w-5 h-5 text-amber-600' />
        </div>

        {/* Text */}
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-stone-800 leading-tight'>
            🃏 ¡Postal de álbum!
          </p>
          <p className='text-xs text-stone-500 mt-0.5 leading-tight'>
            Esta postal es parte de un álbum. ¡Tocá para verlo!
          </p>
        </div>

        {/* Dismiss */}
        <button
          className='shrink-0 p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors'
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <X className='w-4 h-4' />
        </button>
      </div>
    </motion.div>
  );
}
