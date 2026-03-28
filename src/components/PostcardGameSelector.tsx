/**
 * PostcardGameSelector — Challenge Overlay
 *
 * Full-card overlay that replaces the old bottom-sheet modal.
 * Shows "Completá X desafíos para ganar esta postal" + game list + "¡Comenzar!" CTA.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Puzzle, Stamp, Trophy, Check, X } from 'lucide-react';
import { t } from '../utils/i18n';
import type { DbGameType } from '../hooks/useGameProgress';

export type GameMode = 'hunt' | 'puzzle' | 'stamp' | 'trivia';

interface PostcardGameSelectorProps {
  open: boolean;
  /** Whether the hunt mode is available (has illustration_tags with bboxes) */
  hasHuntMode: boolean;
  /** Whether the trivia mode is available (has trivia data) */
  hasTriviaMode: boolean;
  /** Set of game types the user has completed for this postcard */
  completedGames?: Set<DbGameType>;
  /** Progress: { done, total } */
  progress?: { done: number; total: number };
  /** Called when user taps "¡Comenzar!" — parent decides which game to start */
  onStart: () => void;
  onClose: () => void;
  // Legacy: onSelect still supported for backwards compat
  onSelect?: (mode: GameMode) => void;
}

const GAMES: { type: DbGameType; icon: typeof Search; label: { es: string; en: string }; desc: { es: string; en: string }; color: string }[] = [
  {
    type: 'find_objects',
    icon: Search,
    label: { es: 'Buscar objetos', en: 'Find objects' },
    desc: { es: 'Encontrá los objetos escondidos', en: 'Find the hidden objects' },
    color: 'amber',
  },
  {
    type: 'puzzle',
    icon: Puzzle,
    label: { es: 'Puzzle', en: 'Puzzle' },
    desc: { es: 'Armá la postal pieza por pieza', en: 'Assemble the postcard' },
    color: 'blue',
  },
  {
    type: 'stamp_hunt',
    icon: Stamp,
    label: { es: 'Encontrar el sello', en: 'Find the stamp' },
    desc: { es: '¿Dónde se escondió el sello?', en: 'Where is the stamp hiding?' },
    color: 'red',
  },
];

export function PostcardGameSelector({
  open,
  hasHuntMode,
  completedGames,
  progress,
  onStart,
  onClose,
}: PostcardGameSelectorProps) {
  // Filter available games
  const availableGames = GAMES.filter((g) => {
    if (g.type === 'find_objects' && !hasHuntMode) return false;
    return true;
  });

  const allDone = progress && progress.done >= progress.total;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Frosted background */}
          <div
            className="absolute inset-0 bg-white/90 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Content */}
          <motion.div
            className="relative z-10 flex flex-col items-center px-6 max-w-sm w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-0 right-4 p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Trophy icon */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg mb-4">
              <Trophy className="w-7 h-7 text-amber-900" />
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-stone-800 text-center">
              {allDone
                ? t({ es: '¡Es tuya!', en: "It's yours!" })
                : t({ es: 'Completá los desafíos', en: 'Complete the challenges' })
              }
            </h3>
            <p className="text-xs text-stone-500 mt-1 text-center">
              {allDone
                ? t({ es: 'Completaste todos los juegos', en: 'All games completed' })
                : t({ es: 'para ganar esta postal', en: 'to win this postcard' })
              }
            </p>

            {/* Game list */}
            <div className="w-full mt-5 space-y-2">
              {availableGames.map((game) => {
                const Icon = game.icon;
                const isDone = completedGames?.has(game.type) ?? false;

                return (
                  <div
                    key={game.type}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      isDone
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {isDone ? (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`block text-xs font-semibold ${isDone ? 'text-emerald-700' : 'text-stone-800'}`}>
                        {t(game.label)}
                      </span>
                      <span className="block text-[10px] text-stone-400 leading-snug">
                        {isDone
                          ? t({ es: '✅ Completado', en: '✅ Done' })
                          : t(game.desc)
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            {!allDone && (
              <motion.button
                className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-amber-950 font-bold text-sm shadow-lg ring-1 ring-amber-500/30 transition-all"
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  onStart();
                }}
              >
                {progress && progress.done > 0
                  ? t({ es: '¡Continuar!', en: 'Continue!' })
                  : t({ es: '¡Comenzar!', en: 'Start!' })
                }
              </motion.button>
            )}

            {/* Progress dots */}
            {progress && progress.total > 0 && (
              <p className="mt-3 text-[10px] text-stone-400 text-center">
                {progress.done}/{progress.total} {t({ es: 'completados', en: 'completed' })}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
