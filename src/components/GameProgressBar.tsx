/**
 * GameProgressBar — shows step indicators during gameplay
 *
 * Renders above the postcard image:
 *   🔍✅ ─── 🧩⏳ ─── 📮⬜ ─── 🏆
 */

import React from 'react';
import { Search, Puzzle, Stamp, Trophy, Check, HelpCircle } from 'lucide-react';

import type { DbGameType } from '../hooks/useGameProgress';

interface GameProgressBarProps {
  /** Ordered list of game types available for this postcard */
  availableGames: DbGameType[];
  /** Set of completed game types */
  completedGames: Set<DbGameType>;
  /** Currently active game type */
  activeGame: DbGameType | null;
}

const GAME_META: Record<
  DbGameType,
  { icon: typeof Search; label: string; color: string }
> = {
  find_objects: { icon: Search, label: 'Buscar', color: 'amber' },
  puzzle: { icon: Puzzle, label: 'Puzzle', color: 'blue' },
  stamp_hunt: { icon: Stamp, label: 'Sello', color: 'red' },
  trivia: { icon: HelpCircle, label: 'Trivia', color: 'purple' },
};

export function GameProgressBar({
  availableGames,
  completedGames,
  activeGame,
}: GameProgressBarProps) {
  return (
    <div className='relative mx-auto px-5 py-2.5 bg-white/90 backdrop-blur-md rounded-full border border-white/50 shadow-sm min-w-[240px] max-w-xs pointer-events-auto flex items-center justify-center'>
      <div className='absolute flex items-center gap-0 w-full'>
        {availableGames.map((gameType, idx) => {
          const meta = GAME_META[gameType];
          const Icon = meta.icon;
          const isDone = completedGames.has(gameType);
          const isActive = activeGame === gameType;

          return (
            <React.Fragment key={gameType}>
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`flex-1 h-[2px] mx-1.5 rounded-full transition-colors duration-500 ${
                    isDone || isActive ? 'bg-emerald-400' : 'bg-stone-200'
                  }`}
                />
              )}

              {/* Step circle */}
              <div
                className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : isActive
                      ? 'bg-white ring-2 ring-amber-400 text-amber-600 shadow-md scale-110'
                      : 'bg-stone-100 text-stone-400'
                }`}
              >
                {isDone ? (
                  <Check className='w-4.5 h-4.5' strokeWidth={3} />
                ) : (
                  <Icon className='w-4.5 h-4.5' />
                )}
                {isActive && (
                  <div className='absolute inset-0 rounded-full ring-2 ring-amber-400 animate-pulse' />
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Trophy at the end */}
        <div className='flex-1 h-[2px] mx-1.5 rounded-full bg-stone-200' />
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
            completedGames.size >= availableGames.length
              ? 'bg-amber-400 text-amber-900 shadow-md'
              : 'bg-stone-100 text-stone-300'
          }`}
        >
          <Trophy className='w-4.5 h-4.5' />
        </div>
      </div>
    </div>
  );
}
