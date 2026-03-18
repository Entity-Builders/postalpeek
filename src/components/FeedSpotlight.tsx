import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Check, ChevronLeft } from 'lucide-react';
import type { FeedItem } from './Postcard';
import type { SmartSearchResult } from '../hooks/useSmartSearch';
import { cdnImage } from '../utils/imageUtils';
import { analytics } from '../lib/analytics';
import { supabase } from '@eb-packages/logic/src/supabase';

const MAX_RESULTS = 4;

interface FeedSpotlightProps {
  items: FeedItem[];
  claimedIds: Set<string>;
  onClaim: (id: string) => void;
  isClaimLoading: boolean;
  onSelectPostcard: (item: FeedItem) => void;
  isIdle?: boolean;
}

export function FeedSpotlight({
  items,
  claimedIds,
  onClaim,
  isClaimLoading,
  onSelectPostcard,
  isIdle,
}: FeedSpotlightProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FeedItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [previewItem, setPreviewItem] = useState<FeedItem | null>(null);
  // Track if user has claimed one in this session
  const [sessionClaimedId, setSessionClaimedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    analytics.track('spotlight_opened');
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setIsSearching(false);
    setPreviewItem(null);
    setSessionClaimedId(null);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setHasSearched(false);
    setPreviewItem(null);

    try {
      const baseUrl =
        import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

      // Extract available tags from items for the AI
      const tagSet = new Set<string>();
      items.forEach((item) => {
        if (item.detailed_tags?.length) {
          item.detailed_tags.forEach(
            (dt: { label?: string | Record<string, string> }) => {
              const lbl = dt.label;
              const name =
                typeof lbl === 'object' && lbl !== null
                  ? lbl.en || lbl.es || ''
                  : String(lbl || '');
              if (name) tagSet.add(name);
            },
          );
        }
        (item.visual_tags || []).forEach((t: string) => tagSet.add(t));
      });

      const response = await fetch(
        `${baseUrl}/functions/v1/postalpeek-search-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${
              import.meta.env.VITE_SUPABASE_ANON_KEY ||
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o'
            }`,
            apikey:
              import.meta.env.VITE_SUPABASE_ANON_KEY ||
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o',
          },
          body: JSON.stringify({
            query: trimmed,
            availableTags: Array.from(tagSet).slice(0, 100),
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) throw new Error(`Search failed: ${response.status}`);

      const smartResult: SmartSearchResult = await response.json();

      // Query the database directly for matching postcards
      const { data: matchedPostcards, error: rpcError } = await supabase.rpc(
        'postalpeek_spotlight_search',
        {
          p_tags: smartResult.tags,
          p_time_of_day: smartResult.time_of_day,
          p_weather: smartResult.weather,
          p_scene_type: smartResult.scene_type,
          p_country: smartResult.country,
          p_city: smartResult.city,
          p_rarity: smartResult.rarity,
          p_free_text: smartResult.freeTextSearch,
          p_limit: MAX_RESULTS,
        },
      );

      if (rpcError) throw rpcError;

      const matched: FeedItem[] = matchedPostcards || [];
      setResults(matched);

      analytics.track('spotlight_searched', {
        query: trimmed,
        results_count: matched.length,
        shown_count: Math.min(matched.length, MAX_RESULTS),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.warn('[FeedSpotlight] AI search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  }, [query, items]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
      if (e.key === 'Escape') {
        if (previewItem) setPreviewItem(null);
        else handleClose();
      }
    },
    [handleSearch, handleClose, previewItem],
  );

  const handleClaim = useCallback(
    (id: string) => {
      setSessionClaimedId(id);
      onClaim(id);
      analytics.track('spotlight_card_claimed', { postcard_id: id });
    },
    [onClaim],
  );

  return (
    <>
      {/* ── FAB Trigger ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={handleOpen}
            className={`fixed bottom-24 right-6 z-[60] flex items-center justify-center
              w-12 h-12 rounded-full
              bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600
              text-white shadow-[0_6px_24px_rgba(139,92,246,0.45)]
              hover:shadow-[0_10px_32px_rgba(139,92,246,0.6)]
              active:scale-95 transition-all duration-200
              ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            aria-label='Buscar con AI'
          >
            <Sparkles className='w-5 h-5' />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Spotlight Overlay ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className='fixed inset-0 z-[200] flex flex-col justify-end'
          >
            {/* Backdrop */}
            <motion.div
              className='absolute inset-0 bg-black/50 backdrop-blur-sm'
              onClick={previewItem ? () => setPreviewItem(null) : handleClose}
            />

            {/* Content panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className='relative bg-gradient-to-t from-[#1a1814] via-[#242018] to-[#2e2920]
                backdrop-blur-xl rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl
                max-h-[70vh] overflow-hidden'
            >
              {/* Close button */}
              <button
                onClick={handleClose}
                className='absolute top-3 right-4 p-1.5 rounded-full hover:bg-white/10 transition-colors'
              >
                <X className='w-5 h-5 text-stone-400' />
              </button>

              {/* Header */}
              <div className='flex items-center gap-2 mb-4'>
                <Sparkles className='w-5 h-5 text-purple-400' />
                <h3 className='font-serif text-lg text-stone-100'>
                  Buscar postales
                </h3>
              </div>

              {/* Input */}
              <div className='flex gap-2 mb-5'>
                <input
                  ref={inputRef}
                  type='text'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder='Ej: "postales con perros", "atardeceres en la playa"'
                  className='flex-1 bg-white/10 rounded-xl border border-white/15 px-4 py-3 text-sm
                    text-stone-100 placeholder:text-stone-500
                    focus:outline-none focus:ring-2 focus:ring-purple-400/60
                    focus:border-transparent transition-all'
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !query.trim()}
                  className='shrink-0 w-12 h-12 rounded-xl bg-purple-500 text-white
                    flex items-center justify-center
                    hover:bg-purple-600 active:scale-95 transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed'
                >
                  {isSearching ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    >
                      <Sparkles className='w-5 h-5' />
                    </motion.div>
                  ) : (
                    <Send className='w-5 h-5' />
                  )}
                </button>
              </div>

              {/* Results */}
              {isSearching && (
                <div className='flex items-center justify-center py-8'>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <Sparkles className='w-8 h-8 text-purple-400' />
                  </motion.div>
                  <span className='ml-3 text-sm text-stone-400'>
                    Buscando...
                  </span>
                </div>
              )}

              {hasSearched && !isSearching && results.length === 0 && (
                <div className='flex flex-col items-center py-8 text-center'>
                  <span className='text-4xl mb-3'>🔍</span>
                  <p className='text-sm text-stone-400'>
                    No encontré postales para &ldquo;{query.trim()}&rdquo;
                  </p>
                  <p className='text-xs text-stone-500 mt-1'>
                    Probá con otras palabras
                  </p>
                </div>
              )}

              {results.length > 0 && (
                <div>
                  <p className='text-xs text-stone-500 mb-3 font-mono'>
                    {results.length}{' '}
                    {results.length === 1 ? 'resultado' : 'resultados'}
                    {sessionClaimedId && (
                      <span className='ml-2 text-purple-400'>
                        · ya reclamaste una
                      </span>
                    )}
                  </p>
                  <div className='flex gap-3 overflow-x-auto pb-2 -mx-1 px-1'>
                    {results.map((item, index) => (
                      <SpotlightCard
                        key={item.id}
                        item={item}
                        index={index}
                        isClaimed={claimedIds.has(item.id)}
                        isSessionClaimed={sessionClaimedId === item.id}
                        isClaimDisabled={
                          !!sessionClaimedId && sessionClaimedId !== item.id
                        }
                        onClaim={() => handleClaim(item.id)}
                        onTap={() => setPreviewItem(item)}
                        isClaimLoading={isClaimLoading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Inline Preview ── */}
              <AnimatePresence>
                {previewItem && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 30 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className='absolute inset-0 rounded-t-3xl overflow-hidden
                      bg-gradient-to-t from-[#1a1814] via-[#242018] to-[#1a1814]
                      flex flex-col'
                  >
                    {/* Preview header */}
                    <div className='flex items-center gap-2 px-4 pt-4 pb-3 shrink-0'>
                      <button
                        onClick={() => setPreviewItem(null)}
                        className='p-1.5 rounded-full hover:bg-white/10 transition-colors'
                      >
                        <ChevronLeft className='w-5 h-5 text-stone-300' />
                      </button>
                      <div className='flex-1'>
                        <p className='font-serif text-stone-100 text-base leading-tight'>
                          {previewItem.city || previewItem.country || 'Postal'}
                        </p>
                        {previewItem.city && previewItem.country && (
                          <p className='text-xs text-stone-500'>
                            {previewItem.country}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleClose}
                        className='p-1.5 rounded-full hover:bg-white/10 transition-colors'
                      >
                        <X className='w-5 h-5 text-stone-400' />
                      </button>
                    </div>

                    {/* Preview image */}
                    <div className='flex-1 flex items-center justify-center px-6 py-2 min-h-0'>
                      <motion.div
                        initial={{ rotateY: -15, scale: 0.9 }}
                        animate={{ rotateY: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.05 }}
                        className='w-full max-w-[300px] aspect-[3/4] rounded-xl overflow-hidden
                          shadow-[0_24px_70px_rgba(0,0,0,0.65)] border border-white/10'
                        style={{ perspective: '600px' }}
                      >
                        <img
                          src={cdnImage(previewItem.illustration_url, { width: 640, quality: 90 })}
                          alt={previewItem.city || 'Postal'}
                          className='w-full h-full object-cover'
                        />
                      </motion.div>
                    </div>

                    {/* Preview actions */}
                    <div className='shrink-0 px-5 py-4 flex gap-3'>
                      <button
                        onClick={() => {
                          handleClose();
                          onSelectPostcard(previewItem);
                        }}
                        className='flex-1 py-3 rounded-xl border border-white/20 text-stone-300
                          text-sm font-medium hover:bg-white/10 active:scale-95 transition-all'
                      >
                        Ver detalle
                      </button>
                      {claimedIds.has(previewItem.id) || sessionClaimedId === previewItem.id ? (
                        <div className='flex-1 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30
                          flex items-center justify-center gap-1.5 text-emerald-400 text-sm font-medium'>
                          <Check className='w-4 h-4' />
                          Reclamada
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            handleClaim(previewItem.id);
                          }}
                          disabled={
                            isClaimLoading ||
                            (!!sessionClaimedId && sessionClaimedId !== previewItem.id)
                          }
                          className='flex-1 py-3 rounded-xl bg-purple-500 text-white
                            text-sm font-semibold hover:bg-purple-600
                            active:scale-95 transition-all
                            disabled:opacity-40 disabled:cursor-not-allowed'
                        >
                          {sessionClaimedId && sessionClaimedId !== previewItem.id
                            ? 'Ya reclamaste una'
                            : 'Reclamar'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Simplified Postcard for Spotlight ── */
function SpotlightCard({
  item,
  index,
  isClaimed,
  isSessionClaimed,
  isClaimDisabled,
  onClaim,
  onTap,
  isClaimLoading,
}: {
  item: FeedItem;
  index: number;
  isClaimed: boolean;
  isSessionClaimed: boolean;
  isClaimDisabled: boolean;
  onClaim: () => void;
  onTap: () => void;
  isClaimLoading: boolean;
}) {
  const imgSrc = cdnImage(item.illustration_url, { width: 256, quality: 75 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 24,
        delay: index * 0.07,
      }}
      className='shrink-0 w-40'
    >
      {/* Polaroid frame */}
      <div className='bg-[#2a2520] rounded-lg shadow-md overflow-hidden border border-white/8'>
        {/* Image — tap to open preview */}
        <button
          onClick={onTap}
          className='w-full aspect-[3/4] overflow-hidden cursor-pointer'
        >
          <img
            src={imgSrc}
            alt={item.city || 'Postal'}
            className='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
            loading='lazy'
          />
        </button>

        {/* Info + action */}
        <div className='px-2.5 py-2'>
          <p className='text-[11px] font-serif text-stone-300 truncate'>
            {item.city || item.country || 'Postal'}
          </p>

          {isClaimed || isSessionClaimed ? (
            <div className='flex items-center gap-1 mt-1.5 text-[10px] text-emerald-400 font-medium'>
              <Check className='w-3 h-3' />
              Reclamada
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClaim();
              }}
              disabled={isClaimLoading || isClaimDisabled}
              className='mt-1.5 w-full py-1.5 rounded-md text-[10px] font-semibold
                bg-purple-500 text-white hover:bg-purple-600
                active:scale-95 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed'
            >
              {isClaimDisabled ? 'No disponible' : 'Reclamar'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
