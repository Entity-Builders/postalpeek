/**
 * SpotlightPill — floating black pill that morphs into a search input.
 * State is lifted: this component only handles UI (pill → input transition).
 * Search logic and results live in WalkerFeed.
 */
import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Search } from 'lucide-react';

interface SpotlightPillProps {
  isVisible: boolean;
  isActive: boolean;           // true when results are showing
  onSearch: (query: string) => void;
  onDismiss: () => void;
  isSearching: boolean;
}

export function SpotlightPill({
  isVisible,
  isActive,
  onSearch,
  onDismiss,
  isSearching,
}: SpotlightPillProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);



  const handleExpand = useCallback(() => {
    setExpanded(true);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpanded(false);
    setQuery('');
    onDismiss();
  }, [onDismiss]);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;
    setExpanded(false); // collapse pill back after search
    onSearch(trimmed);
  }, [query, isSearching, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Escape') handleCollapse();
    },
    [handleSubmit, handleCollapse],
  );

  return (
    <motion.div
      // Levitation animation — subtle y oscillation
      animate={
        isVisible
          ? { opacity: 1, y: [0, -3, 0], scale: 1 }
          : { opacity: 0, y: 0, scale: 0.95 }
      }
      transition={
        isVisible
          ? {
              opacity: { duration: 0.3 },
              scale: { duration: 0.3 },
              y: {
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
                repeatType: 'mirror',
              },
            }
          : { duration: 0.2 }
      }
      className='pointer-events-none'
      style={{ width: '100%' }}
    >
      <AnimatePresence mode='wait'>
        {!expanded && !isActive ? (
          /* ── Resting pill ── */
          <motion.button
            key='pill'
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={handleExpand}
            className='pointer-events-auto mx-auto flex items-center gap-2.5
              bg-[#111] text-white rounded-full
              px-5 h-[42px]
              shadow-[0_6px_24px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)]
              hover:bg-[#1a1a1a] active:scale-[0.97]
              transition-colors duration-150 cursor-pointer'
            style={{ maxWidth: 'calc(95vw - 0px)' }}
          >
            <Sparkles className='w-3.5 h-3.5 text-purple-400 shrink-0' />
            <span className='text-[13px] font-medium tracking-[-0.01em] text-white/90 whitespace-nowrap'>
              Describí la postal que querés
            </span>
          </motion.button>
        ) : !expanded && isActive ? (
          /* ── Active (results visible) pill — shows query + dismiss ── */
          <motion.button
            key='active-pill'
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            onClick={handleCollapse}
            className='pointer-events-auto mx-auto flex items-center gap-2
              bg-[#111] text-white rounded-full
              px-4 h-[42px]
              shadow-[0_6px_24px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)]
              active:scale-[0.97] transition-colors duration-150 cursor-pointer'
            style={{ maxWidth: 'calc(95vw - 0px)' }}
          >
            {isSearching ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className='w-3.5 h-3.5 text-purple-400' />
              </motion.div>
            ) : (
              <Search className='w-3.5 h-3.5 text-purple-400 shrink-0' />
            )}
            <span className='text-[12px] text-white/60 flex-1 text-left truncate max-w-[180px]'>
              {isSearching ? 'Buscando...' : 'Nueva búsqueda'}
            </span>
            <X className='w-3.5 h-3.5 text-white/40 shrink-0 ml-1' />
          </motion.button>
        ) : (
          /* ── Expanded input ── */
          <motion.div
            key='input'
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className='pointer-events-auto flex items-center gap-2 bg-[#111] rounded-2xl px-4 h-[48px]
              shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06)]'
            style={{ width: '100%' }}
          >
            <Sparkles className='w-3.5 h-3.5 text-purple-400 shrink-0' />
            <input
              ref={inputRef}
              type='text'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Ej: atardeceres en la playa...'
              className='flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35
                focus:outline-none min-w-0 caret-purple-400'
            />
            <div className='flex items-center gap-1.5 shrink-0'>
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className='p-1 text-white/30 hover:text-white/60 transition-colors'
                >
                  <X className='w-3.5 h-3.5' />
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isSearching}
                className='w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center
                  hover:bg-purple-400 active:scale-95 transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <Send className='w-3.5 h-3.5 text-white' />
              </button>
              <button
                onClick={handleCollapse}
                className='p-1 text-white/30 hover:text-white/60 transition-colors'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
