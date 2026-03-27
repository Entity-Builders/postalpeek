import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Puzzle, Stamp, MessageCircleQuestion, X } from 'lucide-react';
import { t } from '../utils/i18n';

export type GameMode = 'hunt' | 'puzzle' | 'stamp' | 'trivia';

interface PostcardGameSelectorProps {
  open: boolean;
  /** Whether the hunt mode is available (has illustration_tags with bboxes) */
  hasHuntMode: boolean;
  /** Whether the trivia mode is available (has trivia data) */
  hasTriviaMode: boolean;
  onSelect: (mode: GameMode) => void;
  onClose: () => void;
}

export function PostcardGameSelector({
  open,
  hasHuntMode,
  hasTriviaMode,
  onSelect,
  onClose,
}: PostcardGameSelectorProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[101] px-4 pb-6 pt-3 max-w-md mx-auto"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-200">
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-stone-300" />
              </div>

              {/* Title */}
              <div className="px-5 pb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-800">
                  {t({ es: 'Elige un modo de juego', en: 'Choose a game mode' })}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-stone-100 text-stone-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Options — 2x2 grid */}
              <div className="px-4 pb-5 grid grid-cols-2 gap-2">
                {/* Hunt mode */}
                <button
                  onClick={() => onSelect('hunt')}
                  disabled={!hasHuntMode}
                  className={`flex flex-col items-center justify-center text-center gap-1.5 p-3 rounded-xl border-2 transition-all min-h-[100px] ${
                    hasHuntMode
                      ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 cursor-pointer'
                      : 'border-stone-100 bg-stone-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      hasHuntMode ? 'bg-amber-200 text-amber-700' : 'bg-stone-200 text-stone-400'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <span className={`block text-[11px] font-bold ${hasHuntMode ? 'text-amber-800' : 'text-stone-400'}`}>
                      {t({ es: 'Buscar', en: 'Find' })}
                    </span>
                    <span className="block text-[9px] text-stone-500 leading-snug">
                      {hasHuntMode ? t({ es: 'Objetos escondidos', en: 'Hidden objects' }) : t({ es: 'No disponible', en: 'Not available' })}
                    </span>
                  </div>
                </button>

                {/* Puzzle mode — always available */}
                <button
                  onClick={() => onSelect('puzzle')}
                  className="flex flex-col items-center justify-center text-center gap-1.5 p-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 cursor-pointer transition-all min-h-[100px]"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-200 text-blue-700">
                    <Puzzle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-blue-800">
                      {t({ es: 'Puzzle', en: 'Puzzle' })}
                    </span>
                    <span className="block text-[9px] text-stone-500 leading-snug">
                      {t({ es: 'Arma la postal', en: 'Assemble it' })}
                    </span>
                  </div>
                </button>

                {/* Stamp Hunt — always available */}
                <button
                  onClick={() => onSelect('stamp')}
                  className="flex flex-col items-center justify-center text-center gap-1.5 p-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 cursor-pointer transition-all min-h-[100px]"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-red-200 text-red-700">
                    <Stamp className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-red-800">
                      {t({ es: 'Sello', en: 'Stamp' })}
                    </span>
                    <span className="block text-[9px] text-stone-500 leading-snug">
                      {t({ es: '¿Dónde está el sello?', en: 'Find the stamp' })}
                    </span>
                  </div>
                </button>

                {/* Trivia Mode */}
                <button
                  onClick={() => onSelect('trivia')}
                  disabled={!hasTriviaMode}
                  className={`flex flex-col items-center justify-center text-center gap-1.5 p-3 rounded-xl border-2 transition-all min-h-[100px] ${
                    hasTriviaMode
                      ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer'
                      : 'border-stone-100 bg-stone-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      hasTriviaMode ? 'bg-emerald-200 text-emerald-700' : 'bg-stone-200 text-stone-400'
                    }`}
                  >
                    <MessageCircleQuestion className="w-4 h-4" />
                  </div>
                  <div>
                    <span className={`block text-[11px] font-bold ${hasTriviaMode ? 'text-emerald-800' : 'text-stone-400'}`}>
                      {t({ es: 'Trivia', en: 'Trivia' })}
                    </span>
                    <span className="block text-[9px] text-stone-500 leading-snug">
                      {hasTriviaMode ? t({ es: 'Responde la trivia', en: 'Answer the trivia' }) : t({ es: 'No disponible', en: 'Not available' })}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
