/**
 * CameraFAB.tsx
 *
 * Floating action button for transitioning from Exploration Mode to Photo Mode.
 * Camera icon with "Tomar Foto" label. Glass-morphism aesthetic.
 *
 * ref #96
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import { useLang, t } from '../../utils/i18n';

interface CameraFABProps {
  onClick: () => void;
}

export function CameraFAB({ onClick }: CameraFABProps) {
  const lang = useLang();

  return (
    <motion.button
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      className="group flex items-center gap-2.5 px-6 py-3.5 rounded-full transition-all active:scale-95"
      style={{
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="w-10 h-10 rounded-full border-[2.5px] border-white/80 flex items-center justify-center group-hover:border-white transition-colors">
        <Camera className="w-4.5 h-4.5 text-white/80 group-hover:text-white transition-colors" />
      </div>
      <span className="text-white/90 text-sm font-semibold tracking-wide group-hover:text-white transition-colors">
        {t({ es: 'Tomar Foto', en: 'Take Photo' }, lang)}
      </span>
    </motion.button>
  );
}
