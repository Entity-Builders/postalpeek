import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Maximize2,
  X,
} from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameProgress, gameModeToDb, type DbGameType } from '../hooks/useGameProgress';
import { cn } from '../utils/cn';
import { preSignUrls } from '../utils/imageUtils';
import type { FeedItem } from './Postcard';
import { t, useLang } from '../utils/i18n';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import confetti from 'canvas-confetti';
import { TripSlide } from './TripSlide';
import { useDiscoveries } from '../hooks/useDiscoveries';
import { AlbumStackEffect } from './ui/AlbumStackEffect';
import { PostcardActionBar } from './PostcardActionBar';
// StorytellingPreview is now rendered inside PostcardChin (via PostcardActionBar)
import { usePostcardGame, GameImageOverlay, GameBottomPanel } from './PostcardGame';
import { PostcardGameResults } from './PostcardGameResults';
import { usePostcardPuzzle, PuzzleImageOverlay, PuzzleBottomPanel } from './PostcardPuzzle';
import { StampHuntOverlay, StampHuntBottomPanel } from './StampHuntGame';
import { useStampHunt } from '../hooks/useStampHunt';
import { PostcardGameSelector, type GameMode } from './PostcardGameSelector';
import { TriviaBottomPanel } from './TriviaRevealGame';
import { GameProgressBar } from './GameProgressBar';
import { useGameMode } from '../contexts/GameModeContext';
import { useStampContext } from '../contexts/StampContext';
import { PostalPeekStampSVG } from './ui/PostalPeekStampSVG';

// Map DB game types to UI game modes (module-level for stable reference)
const DB_TO_MODE: Record<DbGameType, GameMode> = {
  find_objects: 'hunt',
  puzzle: 'puzzle',
  stamp_hunt: 'stamp',
  trivia: 'trivia',
};

interface PostcardFrontProps {
  item: FeedItem;
  isAdmin: boolean;
  isPriority: boolean;
  isLiked: boolean;
  onToggleFavorite?: (postcardId: string) => void;
  onAuthRequired?: (postcardId: string) => void;
  onFlipCard: (view?: 'info' | 'coupon') => void;
  onSlideChange?: (item: FeedItem) => void;
  mainImgUrl: string;
  placeholderUrl?: string;
  srcSetString?: string;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  fallbackEnabled?: boolean;
  onHeroLoad?: () => void;
  /** Collectibles: whether this postcard is claimed by the current user */
  isClaimedByMe?: boolean;
  /** Collectibles: whether this postcard is claimed by anyone */
  hasOwner?: boolean;
  /** Collectibles: callback to claim this postcard */
  onClaimPostcard?: (postcardId: string, cost?: number) => void;
  /** Collectibles: whether a claim is currently in progress */
  isClaimLoading?: boolean;
  /** Dev-only: postcard belongs to an album */
  isInAlbum?: boolean;
  /** Tutorial: show a pulsing guide tooltip on the claim button */
  showClaimGuide?: boolean;
  /** Hide claim + share buttons (e.g. in daily pack reveal) */
  hideActions?: boolean;
  /** Called when user taps expand to see fullscreen image */
  onExpandImage?: (item: FeedItem, sourceRect?: DOMRect) => void;
  /** Controlled clean/expand mode from parent */
  isClean?: boolean;
  /** Toggle clean mode callback */
  onToggleClean?: () => void;
  /** Game mode: allow play (show the Play button) */
  allowPlay?: boolean;
  /** Current user ID for game progress tracking */
  userId?: string;
  /** Navigate directly to an album */
  onOpenAlbum?: (albumId: string) => void;
  /** Navigate directly to the collection */
  onOpenCollection?: () => void;
  /** Automatically start the game on mount */
  autoStartGame?: boolean;
  /** Disable blur filters during tutorial */
  isTutorial?: boolean;
  /** Override the Play behavior */
  onPlayGame?: () => void;
}

export function PostcardFront({
  item,
  isPriority,
  isLiked,
  onToggleFavorite,
  onAuthRequired,
  onFlipCard,
  onSlideChange,
  mainImgUrl,
  placeholderUrl,
  srcSetString,
  handleImageError,
  fallbackEnabled,
  onHeroLoad,
  hideActions = false,
  isClean = false,
  onToggleClean,
  allowPlay = true,
  isClaimedByMe,
  hasOwner,
  isClaimLoading,
  onClaimPostcard,
  userId,
  onOpenAlbum,
  onOpenCollection,
  autoStartGame = false,
  isTutorial = false,
  onPlayGame,
}: PostcardFrontProps) {
  const { setGameActive } = useGameMode();
  const { addLocalStamps } = useStampContext();
  // ── Inline game mode ──
  const [playingMode, setPlayingMode] = useState<GameMode | 'trivia' | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [gameFlipped, setGameFlipped] = useState(false);
  const [earnedStampsStr, setEarnedStampsStr] = useState<number | null>(null);
  const game = usePostcardGame(item);
  const puzzle = usePostcardPuzzle(item);
  const stampHunt = useStampHunt(item);
  const isPlaying = playingMode !== null;

  // Notify parent when game mode or selector changes (so it can block zoom)
  useEffect(() => {
    setGameActive(isPlaying || showSelector);
  }, [isPlaying, showSelector, setGameActive]);

  // ── Stamp Purchase Celebration ──
  const prevClaimed = useRef(isClaimedByMe);
  const [showStampAnimation, setShowStampAnimation] = useState(false);

  useEffect(() => {
    // If the card wasn't claimed before, and now it is, trigger celebration!
    if (!prevClaimed.current && isClaimedByMe) {
      setShowStampAnimation(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#ef4444', '#f59e0b', '#10b981'], // Stamp colors
        zIndex: 1000,
      });
      const t = setTimeout(() => setShowStampAnimation(false), 2000);
      return () => clearTimeout(t);
    }
    prevClaimed.current = isClaimedByMe;
  }, [isClaimedByMe]);

  // ── Game progress tracking (play-to-earn) ──
  const hasHuntMode_ = useMemo(() => {
    const raw = item.illustration_tags as unknown as Array<{ box_2d?: number[]; bbox?: number[] }> | null;
    if (!raw || !Array.isArray(raw)) return false;
    return raw.some((t) => {
      const coords = t.box_2d ?? t.bbox;
      return coords && Array.isArray(coords) && coords.length === 4;
    });
  }, [item.illustration_tags]);

  const gameProgress = useGameProgress(item.id, userId, hasHuntMode_);

  // Get the ordered list of available games (as DB types)
  const availableGamesList = useMemo(() => {
    const games: DbGameType[] = [];
    if (hasHuntMode_) games.push('find_objects');
    games.push('puzzle', 'stamp_hunt');
    return games;
  }, [hasHuntMode_]);

  // Get next incomplete game, optionally using a fresh completed set
  const getNextGame = useCallback((completedOverride?: Set<DbGameType>): GameMode | null => {
    const completed = completedOverride ?? gameProgress.completedGames;
    for (const dbType of availableGamesList) {
      if (!completed.has(dbType)) {
        return DB_TO_MODE[dbType];
      }
    }
    return null;
  }, [availableGamesList, gameProgress.completedGames]);

  // Start the challenge: auto-pick first incomplete game
  const startChallenge = useCallback(() => {
    setShowSelector(false);
    const nextGame = getNextGame();
    if (nextGame) {
      setPlayingMode(nextGame);
    }
  }, [getNextGame]);

  // Handle game completion: save progress → then auto-advance
  const handleGameClose = useCallback(async (mode: GameMode, won: boolean = true, timeSeconds: number = 0) => {
    if (!userId) {
      // No user: just move on
      setPlayingMode(null);
      return;
    }

    const dbType = gameModeToDb(mode);
    // Compute updated set locally so getNextGame works with fresh data immediately
    const newCompletedGames = new Set([...gameProgress.completedGames, dbType]);
    const { allComplete: isLastGame, rewardedStamps } = await gameProgress.saveGameCompletion(dbType, timeSeconds, won);

    if (rewardedStamps > 0) {
      addLocalStamps(rewardedStamps);
      setEarnedStampsStr(rewardedStamps);
      item.last_played_at = new Date().toISOString(); // local mutation to disable button
      setTimeout(() => setEarnedStampsStr(null), 3500);
    }

    if (isLastGame) {
      // All games complete → show victory (user just earned stamps)
      setPlayingMode(null);
      setGameFlipped(false);
      setShowVictory(true);
    } else {
      // Directly start next game without flipping the card
      const nextGame = getNextGame(newCompletedGames);
      setPlayingMode(nextGame);
    }
  }, [userId, gameProgress, getNextGame, addLocalStamps, item]);

  // Victory celebration state
  const [showVictory, setShowVictory] = useState(false);
  // Sticker discovery system (used by TripSlide)
  const { discoverTag, isDiscovered, isGenerating } = useDiscoveries();
  useLang(); // subscribe to language changes

  const isBusiness =
    item.generation_metadata?.strategy === 'Zigzag Shared Place';
  const [isHovered, setIsHovered] = useState(false);
  const [albumItems, setAlbumItems] = useState<FeedItem[]>([item]);
  const [albumStops, setAlbumStops] = useState<Record<number, { stop_name: string; stop_description?: string }>>({});

  React.useEffect(() => {
    if (!item.album_id || isTutorial) return;
    let mounted = true;

    // Fetch postcards for this album
    supabase
      .from('postalpeek_postcards')
      .select('*')
      .eq('album_id', item.album_id)
      .not('illustration_url', 'is', null)
      .order('album_sequence', { ascending: true })
      .then(({ data }) => {
        if (mounted && data) {
          const items = data as FeedItem[];
          
          // Pre-sign the fetched album URLs to ensure they display correctly
          preSignUrls(items.flatMap((i) => [i.illustration_url, i.original_image_url].filter(Boolean))).catch((err) => 
            console.error('Failed to pre-sign album item images', err)
          );

          if (items.some((i) => i.id === item.id)) setAlbumItems(items);
          else
            setAlbumItems(
              [item, ...items].sort(
                (a, b) => (a.album_sequence || 0) - (b.album_sequence || 0),
              ),
            );
        }
      });

    // Fetch stop metadata (names, descriptions)
    supabase
      .from('postalpeek_album_slots')
      .select('slot_order, slot_label, stop_description')
      .eq('album_id', item.album_id)
      .order('slot_order', { ascending: true })
      .then(({ data }) => {
        if (mounted && data) {
          const map: Record<number, { stop_name: string; stop_description?: string }> = {};
          for (const stop of data) {
            map[stop.slot_order] = { stop_name: stop.slot_label, stop_description: stop.stop_description };
          }
          setAlbumStops(map);
        }
      });

    return () => {
      mounted = false;
    };
  }, [item, isTutorial]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false }, [
    WheelGesturesPlugin(),
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  React.useEffect(() => {
    if (!emblaApi) return;

    // Register the onSelect handler FIRST, so that any synchronous events
    // fired by scrollTo are captured and currentIndex stays in sync.
    const onSelect = () => setCurrentIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);

    const initialIndex = albumItems.findIndex((i) => i.id === item.id);
    if (initialIndex > 0) {
      // Set currentIndex synchronously as a safety net in case select fires
      // before the next React render cycle.
      setCurrentIndex(initialIndex);
      emblaApi.scrollTo(initialIndex, true);
    }

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, albumItems, item.id]);

  const activeSlideItem = albumItems[currentIndex] || item;

  const isAlbumGroup = !!item.album_id && !isTutorial;
  // storytelling is now derived inside PostcardChin from activeItem
  const trivia = activeSlideItem.generation_metadata?.trivia;
  const hasCompletedTrivia = gameProgress.completedGames.has('trivia');
  const isTriviaLocked = !!trivia && !isClaimedByMe && !hasOwner && !hasCompletedTrivia;

  const prevIsTriviaLocked = React.useRef(isTriviaLocked);
  
  React.useEffect(() => {
    if (isTriviaLocked && playingMode !== 'trivia') {
      setPlayingMode('trivia');
    } else if (!isTriviaLocked && prevIsTriviaLocked.current && playingMode === 'trivia') {
      setPlayingMode(null);
    }
    prevIsTriviaLocked.current = isTriviaLocked;
  }, [isTriviaLocked, playingMode]);

  const hasAutoStarted = React.useRef(false);
  useEffect(() => {
    if (autoStartGame && allowPlay && !isTriviaLocked && hasOwner && !isPlaying && !hasAutoStarted.current) {
      setShowSelector(true);
      hasAutoStarted.current = true;
    }
  }, [autoStartGame, allowPlay, isTriviaLocked, hasOwner, isPlaying]);

  React.useEffect(() => {
    if (onSlideChange) {
      onSlideChange(activeSlideItem);
    }
  }, [activeSlideItem, onSlideChange]);

  return (
    <div
      className='absolute inset-0 w-full h-full'
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(0deg) translateZ(1px)',
        WebkitTransform: 'rotateY(0deg) translateZ(1px)',
      }}
    >
      {/* Stacked cards behind for album groups — animate fan-out */}
      {isAlbumGroup && <AlbumStackEffect />}

      {/* Main card */}
      <div
        className={cn('relative w-full h-full flex flex-col transition-all duration-300', isClean || isPlaying ? 'bg-transparent' : 'bg-white')}
        style={{ zIndex: 1 }}
      >
        <div className={cn(
          "flex-1 w-full min-h-0 relative flex flex-col transition-all duration-300",
          isClean || isPlaying ? 'p-0 bg-transparent' : 'p-1 pb-0 bg-white overflow-hidden',
        )}>
          {/* Top Game HUD Layer */}
          {isPlaying && playingMode !== 'trivia' && (
            <div className="w-full flex justify-center px-4 pt-3 pb-2 shrink-0 z-50 pointer-events-none">
              <GameProgressBar
                availableGames={availableGamesList}
                completedGames={gameProgress.completedGames}
                activeGame={gameModeToDb(playingMode as 'hunt' | 'puzzle' | 'stamp')}
              />
            </div>
          )}

          {/* 3D flip container — used when the game completes */}
          <div
            className="relative flex-1 min-h-0 w-full"
            style={{
              perspective: '1200px',
            }}
          >
            <div
              className="relative w-full h-full transition-transform duration-700"
              style={{
                transformStyle: 'preserve-3d',
                transform: gameFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              {/* ── FRONT FACE: the illustration + game overlay ── */}
              <div
                className={cn(
                  'absolute inset-0 w-full h-full',
                  isClean ? 'rounded-none loupe-active'
                    : isPlaying ? 'overflow-hidden rounded-xl bg-stone-200'
                    : 'overflow-hidden shadow-inner bg-stone-200 rounded',
                )}
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => {
                  // Don't interfere with buttons, links, or game interactions
                  if ((e.target as HTMLElement).closest('button, a')) return;
                  if (isPlaying) return;

                  e.stopPropagation(); // prevent parent Postcard handleClick

                  // Always maximize the image on tap
                  onToggleClean?.();
                }}
              >

                {isAlbumGroup ? (
                  <>
                    <div className='absolute top-2 left-2 right-2 z-30 pointer-events-none drop-shadow-md'>
                      <span className='bg-black/60 text-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-medium border border-white/20 shadow-lg'>
                        🛫{' '}
                        {item.generation_metadata?.tripContext?.title ||
                          'Álbum de viaje'}
                      </span>
                    </div>

                    <div className='overflow-hidden w-full h-full relative z-10' ref={emblaRef}>
                      <div className='flex w-full h-full'>
                        {albumItems.map((slideItem) => (
                          <TripSlide
                            key={slideItem.id}
                            slideItem={slideItem}
                            isPriority={isPriority && slideItem.id === item.id}
                            handleImageError={handleImageError}
                            fallbackEnabled={fallbackEnabled}
                            isHovered={isHovered}
                            setIsHovered={setIsHovered}
                            preloadedMainUrl={
                              slideItem.id === item.id ? mainImgUrl : undefined
                            }
                            preloadedPlaceholder={
                              slideItem.id === item.id ? placeholderUrl : undefined
                            }
                            preloadedSrcSet={
                              slideItem.id === item.id ? srcSetString : undefined
                            }
                            onHeroLoad={slideItem.id === item.id ? onHeroLoad : undefined}
                            isClean={isClean}
                            isTriviaLocked={isTriviaLocked}
                            onDiscoverTag={discoverTag}
                            isTagDiscovered={isDiscovered}
                            isTagGenerating={isGenerating}
                            hasOwner={!!slideItem.owner_id}
                            isTutorial={isTutorial}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Pagination Dots */}
                    {albumItems.length > 1 && (
                      <div className='absolute bottom-4 left-0 right-0 z-30 flex justify-center gap-1.5 pointer-events-none'>
                        {albumItems.map((_, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'h-1.5 rounded-full transition-all duration-300 shadow',
                              idx === currentIndex
                                ? 'w-4 bg-white'
                                : 'w-1.5 bg-white/50',
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <TripSlide
                    slideItem={item}
                    isPriority={isPriority}
                    handleImageError={handleImageError}
                    fallbackEnabled={fallbackEnabled}
                    isHovered={isHovered}
                    setIsHovered={setIsHovered}
                    preloadedMainUrl={mainImgUrl}
                    preloadedPlaceholder={placeholderUrl}
                    preloadedSrcSet={srcSetString}
                    onHeroLoad={onHeroLoad}
                    isClean={isClean}
                    isTriviaLocked={isTriviaLocked}
                    onDiscoverTag={discoverTag}
                    isTagDiscovered={isDiscovered}
                    isTagGenerating={isGenerating}
                    hasOwner={hasOwner}
                    isTutorial={isTutorial}
                  />
                )}

                {/* Game overlay — renders inside the image area */}
                {playingMode === 'hunt' && <GameImageOverlay game={game} />}
                {playingMode === 'puzzle' && <PuzzleImageOverlay puzzle={puzzle} imageUrl={mainImgUrl} />}
                {playingMode === 'stamp' && <StampHuntOverlay hunt={stampHunt} imageUrl={mainImgUrl ?? ''} />}

                {/* Stamp Purchase Animation Overlay */}
                <AnimatePresence>
                  {showStampAnimation && (
                    <motion.div
                      initial={{ opacity: 0, scale: 3, rotate: -20 }}
                      animate={{ opacity: 1, scale: 1, rotate: 10 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 180 }}
                      className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                      <div className="w-48 h-48 filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)]">
                        <PostalPeekStampSVG className="w-full h-full" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Expand to fullscreen / Minimize — hidden during game */}
                {!isPlaying && (
                  <button
                    className={cn(
                      'absolute z-40 transition-all shadow-md ring-1 ring-white/20',
                      isClean
                        ? 'top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-sm rounded-full'
                        : 'bottom-2.5 right-2.5 p-1.5 bg-black/60 hover:bg-black/80 text-white/90 hover:text-white rounded-md',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleClean?.();
                    }}
                    title={isClean ? 'Volver' : 'Ver en pantalla completa'}
                  >
                    {isClean
                      ? <X className='w-5 h-5' />
                      : <Maximize2 className='w-3.5 h-3.5' />
                    }
                  </button>
                )}
              </div>

              {/* ── BACK FACE: game results ── */}
              {playingMode === 'hunt' && (
                <PostcardGameResults
                  item={item}
                  gameType="hunt"
                  targetLabel={game.lastFoundTarget || undefined}
                  targetEnLabel={game.lastFoundTargetEn || undefined}
                  albumTitle={item.generation_metadata?.tripContext?.title}
                  albumSequence={item.album_sequence}
                  albumTotal={item.generation_metadata?.tripContext?.totalStops || albumItems.length}
                  onOpenAlbum={onOpenAlbum}
                />
              )}
              {playingMode === 'puzzle' && (
                <PostcardGameResults
                  item={item}
                  gameType="puzzle"
                  albumTitle={item.generation_metadata?.tripContext?.title}
                  albumSequence={item.album_sequence}
                  albumTotal={item.generation_metadata?.tripContext?.totalStops || albumItems.length}
                  onOpenAlbum={onOpenAlbum}
                />
              )}
              {playingMode === 'stamp' && (
                <PostcardGameResults
                  item={item}
                  gameType="stamp"
                  albumTitle={item.generation_metadata?.tripContext?.title}
                  albumSequence={item.album_sequence}
                  albumTotal={item.generation_metadata?.tripContext?.totalStops || albumItems.length}
                  onOpenAlbum={onOpenAlbum}
                />
              )}
            </div>
          </div>

          {/* Bottom Game HUD Layer */}
          {isPlaying && playingMode !== 'trivia' && (
            <div className="w-full px-4 pt-2 pb-6 shrink-0 z-50 pointer-events-auto">
              {playingMode === 'hunt' && (
                <GameBottomPanel
                  item={item}
                  game={game}
                  onClose={(won, timeSeconds) => handleGameClose('hunt', won, timeSeconds)}
                />
              )}
              {playingMode === 'puzzle' && (
                <PuzzleBottomPanel
                  item={item}
                  puzzle={puzzle}
                  onClose={(won, timeSeconds) => handleGameClose('puzzle', won, timeSeconds)}
                />
              )}
              {playingMode === 'stamp' && (
                <StampHuntBottomPanel
                  item={item}
                  hunt={stampHunt}
                  onClose={(won, timeSeconds) => handleGameClose('stamp', won, timeSeconds)}
                />
              )}
            </div>
          )}
        </div>
        
        {/* Title + Buttons row — hidden in clean mode and game mode */}
        {!isPlaying ? (
          <>
            <PostcardActionBar
              item={item}
              activeSlideItem={activeSlideItem}
              isLiked={isLiked}
              onToggleFavorite={onToggleFavorite}
              onAuthRequired={onAuthRequired}
              onFlipCard={(view: 'info' | 'coupon' = 'info') => {
                onFlipCard(view);
              }}
              hideActions={hideActions}
              isClean={isClean}
              isBusiness={isBusiness}
              isTriviaLocked={isTriviaLocked}
              albumStops={albumStops}
              totalStops={activeSlideItem.generation_metadata?.tripContext?.totalStops || Object.keys(albumStops).length || albumItems.length}
              onPlay={
                allowPlay && !isTriviaLocked && hasOwner
                  ? onPlayGame 
                    ? onPlayGame
                    : autoStartGame
                      ? () => setShowSelector(true) // In GamePage, just open the selector
                      : undefined // Default CTAs to /game/:id navigation
                  : undefined
              }
              onClaim={!hasOwner && !isTriviaLocked && onClaimPostcard ? (cost) => onClaimPostcard(item.id, cost) : undefined}
              onTrade={hasOwner && !isClaimedByMe ? () => console.warn('Trade not implemented yet') : undefined}
              isOwned={isClaimedByMe}
              hasOwner={hasOwner}
              onOpenAlbum={onOpenAlbum}
            />
          </>
        ) : playingMode === 'trivia' ? (
          <TriviaBottomPanel
            trivia={trivia}
            isClaimLoading={isClaimLoading}
            isTriviaLocked={isTriviaLocked}
            onClose={() => setPlayingMode(null)}
            onResolve={() => {
              // Save trivia completion so they never have to answer again
              gameProgress.saveGameCompletion('trivia', 0);
              
              if (onClaimPostcard && !isClaimLoading) {
                onClaimPostcard(item.id);
              } else if (!isTriviaLocked) {
                // If debugging/replay, just close it
                setPlayingMode(null);
              }
            }}
          />
        ) : null}
      </div>

      <PostcardGameSelector
        open={showSelector}
        hasHuntMode={hasHuntMode_}
        hasTriviaMode={!!trivia}
        completedGames={gameProgress.completedGames}
        progress={gameProgress.progress}
        onStart={startChallenge}
        onClose={() => setShowSelector(false)}
      />

      {/* Earned Stamp Floating Toast */}
      <AnimatePresence>
        {earnedStampsStr !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -30 }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] flex flex-col items-center pointer-events-none"
          >
            <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.6)] mb-2 border-4 border-white">
              <span className="text-3xl">📮</span>
            </div>
            <div className="bg-stone-900/95 text-white font-bold px-4 py-1.5 rounded-full text-sm shadow-xl backdrop-blur-md border border-white/10 flex items-center gap-1.5">
              <span className="text-amber-400">+</span>
              {earnedStampsStr} Sello{earnedStampsStr !== 1 ? 's' : ''}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Summary overlay */}
      {showVictory && (
        <GameSummaryOverlay 
          rows={gameProgress.completedRows}
          onDismiss={() => {
            setShowVictory(false);
            if (item.album_id && onOpenAlbum) {
              onOpenAlbum(item.album_id);
            } else if (onOpenCollection) {
              onOpenCollection();
            }
          }} 
        />
      )}
    </div>
  );
}

/** Game summary shown when all games are complete */
function GameSummaryOverlay({ 
  rows, 
  onDismiss 
}: { 
  rows: { game_type: string; time_seconds: number | null; won?: boolean }[]; 
  onDismiss: () => void;
}) {
  // Deterministic confetti (no Math.random needed)
  const COLORS = ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: ((i * 37 + 13) % 100),
    delay: (i % 5) * 0.1,
    duration: 1.5 + (i % 3) * 0.5,
    color: COLORS[i % 6],
    size: 4 + (i % 4) * 2,
  }));

  const formatTime = (seconds: number | null) => {
    if (seconds == null) return '-';
    const sec = Math.round(seconds);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getGameLabel = (type: string) => {
    switch (type) {
      case 'find_objects': return { label: t({ es: 'Buscar Objetos', en: 'Find Objects' }), icon: '🔍' };
      case 'puzzle': return { label: t({ es: 'Puzzle', en: 'Puzzle' }), icon: '🧩' };
      case 'stamp_hunt': return { label: t({ es: 'Encontrar Sello', en: 'Find Stamp' }), icon: '📮' };
      case 'trivia': return { label: t({ es: 'Trivia', en: 'Trivia' }), icon: '🧠' };
      default: return { label: type, icon: '🎮' };
    }
  };

  const totalStamps = rows.filter((r) => r.won !== false).length;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center overflow-hidden"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]" />

      {/* Confetti particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: '-5%',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confettiFall ${p.duration}s ${p.delay}s linear forwards`,
          }}
        />
      ))}

      {/* Summary card */}
      <div className="relative z-10 flex flex-col items-center p-6 bg-white rounded-3xl shadow-2xl animate-[bounceIn_0.5s_ease-out] w-[85%] max-w-sm max-h-[90%]">
        
        {/* PostalPeek Stamp Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg mb-4 ring-4 ring-white shrink-0">
          <PostalPeekStampSVG className="w-8 h-8 text-amber-900 border-amber-600/30" />
        </div>

        <h3 className="text-2xl font-black text-stone-800 tracking-tight text-center leading-tight shrink-0">
          ¡Ganaste {totalStamps} sello{totalStamps !== 1 && 's'}!
        </h3>
        <p className="text-sm text-stone-500 mt-1.5 mb-5 text-center px-4 shrink-0">
          {t({ es: 'Resumen de tus desafíos:', en: 'Challenge Summary:' })}
        </p>

        {/* Game list */}
        <div className="w-full space-y-2 mb-6 overflow-y-auto min-h-0">
          {rows.map((row, idx) => {
            const info = getGameLabel(row.game_type);
            const isWon = row.won !== false; // treat undefined as win for backwards compat
            return (
              <div key={idx} className={cn("flex items-center justify-between border rounded-xl p-3 shadow-sm", isWon ? "bg-stone-50 border-stone-100" : "bg-stone-100/50 border-stone-200/50")}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full shadow-sm flex items-center justify-center border text-lg", isWon ? "bg-white border-stone-100" : "bg-stone-200/50 border-stone-200 opacity-80 grayscale")}>
                    {info.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className={cn("text-sm font-bold leading-tight", isWon ? "text-stone-700" : "text-stone-500")}>{info.label}</span>
                    <span className={cn("text-[11px] font-mono tracking-wider mt-0.5", isWon ? "text-stone-400" : "text-stone-400/70")}>
                      {t({ es: 'Tardaste ', en: 'Time: ' })}<span className={cn("font-semibold", isWon ? "text-stone-500" : "text-stone-400")}>{formatTime(row.time_seconds)}</span>
                    </span>
                  </div>
                </div>
                <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold border", isWon ? "bg-amber-100/80 text-amber-700 border-amber-200/50" : "bg-stone-200/50 text-stone-500 border-stone-300/50")}>
                  {isWon ? "+1 " : "0 "}<PostalPeekStampSVG className={cn("w-3.5 h-3.5", isWon ? "text-amber-800" : "text-stone-400 grayscale opacity-60")} />
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 text-white font-bold text-sm transition-all shadow-md active:scale-[0.98] shrink-0"
        >
          {t({ es: 'Continuar', en: 'Continue' })}
        </button>
      </div>
    </div>
  );
}
