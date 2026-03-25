import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { analytics } from '../lib/analytics';
import { useLang, t } from '../utils/i18n';

interface ClaimLimitModalProps {
  type: 'daily' | 'monthly';
  used: number;
  limit: number;
  onClose: () => void;
}

export function ClaimLimitModal({ type, used, limit, onClose }: ClaimLimitModalProps) {
  const lang = useLang();
  React.useEffect(() => {
    analytics.track('claim_limit_shown', { type, used, limit });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative bg-[#fdfbf7] rounded-2xl shadow-2xl p-6 md:p-8 max-w-sm w-full border border-stone-200/50"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Emoji hero */}
          <div className="text-center mb-4">
            <span className="text-5xl block mb-3">
              {type === 'daily' ? '🌅' : '📅'}
            </span>
            <h3 className="font-serif text-xl text-stone-800 tracking-tight">
              {type === 'daily'
                ? t({ es: '¡Límite diario alcanzado!', en: 'Daily limit reached!' }, lang)
                : t({ es: '¡Límite mensual alcanzado!', en: 'Monthly limit reached!' }, lang)}
            </h3>
          </div>

          {/* Counter */}
          <div className="bg-stone-100/80 rounded-xl p-4 mb-4 text-center">
            <span className="text-3xl font-bold text-stone-700">
              {used}/{limit}
            </span>
            <p className="text-xs text-stone-400 mt-1">
              {type === 'daily' 
                ? t({ es: 'postales reclamadas hoy', en: 'postcards claimed today' }, lang) 
                : t({ es: 'postales reclamadas este mes', en: 'postcards claimed this month' }, lang)}
            </p>
          </div>

          {/* Message */}
          <p className="text-sm text-stone-500 text-center leading-relaxed mb-5">
            {type === 'daily'
              ? t({ es: 'Volvé mañana para seguir coleccionando. Walker nunca para de caminar — tus próximas postales te esperan. 🚶', en: 'Come back tomorrow to keep collecting. Walker never stops walking — your next postcards await. 🚶' }, lang)
              : t({ es: 'Tu cuota mensual se renueva al inicio del próximo mes. ¡Seguí explorando mientras tanto!', en: 'Your monthly quota resets at the start of next month. Keep exploring in the meantime!' }, lang)}
          </p>

          {/* CTA */}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-stone-800 hover:bg-stone-900 active:scale-[0.98] text-white text-sm font-semibold transition-all shadow-lg shadow-stone-800/20"
          >
            {t({ es: 'Entendido', en: 'Got it' }, lang)}
          </button>

          {/* Future upgrade path — disabled for now */}
          {/*
          <button className="w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium mt-2 hover:bg-amber-100 transition-colors">
            ⭐ Desbloquear más reclamos
          </button>
          */}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
