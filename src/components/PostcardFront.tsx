import React, { useState, useEffect, useMemo } from 'react';
import {
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { cn } from '../utils/cn';
import { preSignUrls } from '../utils/imageUtils';
import type { FeedItem } from './Postcard';
import { useLang } from '../utils/i18n';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { TripSlide } from './TripSlide';
import { useDiscoveries } from '../hooks/useDiscoveries';
import { AlbumStackEffect } from './ui/AlbumStackEffect';
import { PostcardActionBar } from './PostcardActionBar';
import { StorytellingPreview } from './ui/StorytellingPreview';
import { usePostcardGame, GameImageOverlay, GameBottomPanel } from './PostcardGame';
import { PostcardGameResults } from './PostcardGameResults';
import { usePostcardPuzzle, PuzzleImageOverlay, PuzzleBottomPanel } from './PostcardPuzzle';
import { PostcardGameSelector, type GameMode } from './PostcardGameSelector';

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
  isClaimed?: boolean;
  /** Collectibles: callback to claim this postcard */
  onClaimPostcard?: (postcardId: string) => void;
  /** Collectibles: whether a claim is currently in progress */
  isClaimLoading?: boolean;
  /** Dev-only: postcard belongs to an album */
  isInAlbum?: boolean;
  /** Tutorial: show a pulsing guide tooltip on the claim button */
  showClaimGuide?: boolean;
  /** Hide claim + share buttons (e.g. in daily pack reveal) */
  hideActions?: boolean;
  /** Whether this card is the currently visible slide */
  isActive?: boolean;
  /** Called when user taps expand to see fullscreen image */
  onExpandImage?: (item: FeedItem, sourceRect?: DOMRect) => void;
  /** Controlled clean/expand mode from parent */
  isClean?: boolean;
  /** Toggle clean mode callback */
  onToggleClean?: () => void;
  /** Game mode: allow play (show the Play button) */
  allowPlay?: boolean;
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
  isClaimedByMe = false,
  isClaimed = false,
  onClaimPostcard,
  isClaimLoading = false,
  isInAlbum = false,
  showClaimGuide = false,
  hideActions = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isActive = true,
  isClean = false,
  onToggleClean,
  allowPlay = true,
}: PostcardFrontProps) {
  // ── Inline game mode ──
  const [playingMode, setPlayingMode] = useState<GameMode | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [gameFlipped, setGameFlipped] = useState(false);
  const game = usePostcardGame(item);
  const puzzle = usePostcardPuzzle(item);
  const isPlaying = playingMode !== null;

  // Check if hunt mode is available (needs illustration_tags with bboxes)
  const hasHuntMode = useMemo(() => {
    const raw = item.illustration_tags as unknown as Array<{ box_2d?: number[]; bbox?: number[] }> | null;
    if (!raw || !Array.isArray(raw)) return false;
    return raw.some((t) => {
      const coords = t.box_2d ?? t.bbox;
      return coords && Array.isArray(coords) && coords.length === 4;
    });
  }, [item.illustration_tags]);

  // Flip the card when hunt game completes
  useEffect(() => {
    if (playingMode === 'hunt' && game.allFound && !gameFlipped) {
      const timer = setTimeout(() => setGameFlipped(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [game.allFound, playingMode, gameFlipped]);

  // Flip the card when puzzle completes
  useEffect(() => {
    if (playingMode === 'puzzle' && puzzle.isComplete && !gameFlipped) {
      const timer = setTimeout(() => setGameFlipped(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [puzzle.isComplete, playingMode, gameFlipped]);
  // Sticker discovery system (used by TripSlide)
  const { discoverTag, isDiscovered, isGenerating } = useDiscoveries();
  useLang(); // subscribe to language changes

  const isBusiness =
    item.generation_metadata?.strategy === 'Zigzag Shared Place';
  const [isHovered, setIsHovered] = useState(false);
  const [albumItems, setAlbumItems] = useState<FeedItem[]>([item]);
  const [albumStops, setAlbumStops] = useState<Record<number, { stop_name: string; stop_description?: string }>>({});

  React.useEffect(() => {
    if (!item.album_id) return;
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
  }, [item]);

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

  const isAlbumGroup = !!item.album_id;
  const storytelling = activeSlideItem.generation_metadata?.storytelling;

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
        className={cn('relative w-full h-full flex flex-col transition-all duration-300', isClean ? 'bg-transparent' : 'bg-white')}
        style={{ zIndex: 1 }}
      >
        <div className={cn(
          "flex-1 w-full min-h-0 relative flex flex-col transition-all duration-300",
          isClean ? 'p-0' : 'p-1 pb-0 bg-white overflow-hidden',
        )}>
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
                  isClean ? 'rounded-none loupe-active' : 'overflow-hidden shadow-inner bg-stone-200 rounded',
                )}
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                onContextMenu={(e) => e.preventDefault()}
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
                            onDiscoverTag={discoverTag}
                            isTagDiscovered={isDiscovered}
                            isTagGenerating={isGenerating}
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
                    onDiscoverTag={discoverTag}
                    isTagDiscovered={isDiscovered}
                    isTagGenerating={isGenerating}
                  />
                )}

                {/* Game overlay — renders inside the image area */}
                {playingMode === 'hunt' && <GameImageOverlay game={game} />}
                {playingMode === 'puzzle' && <PuzzleImageOverlay puzzle={puzzle} imageUrl={mainImgUrl} />}

                {/* Expand to fullscreen / Minimize — hidden during game */}
                {!isPlaying && (
                  <button
                    className={cn(
                      'absolute z-40 rounded-md transition-all shadow-md ring-1 ring-white/20',
                      isClean
                        ? 'bottom-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-sm'
                        : 'bottom-2.5 right-2.5 p-1.5 bg-black/60 hover:bg-black/80 text-white/90 hover:text-white',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleClean?.();
                    }}
                    title={isClean ? 'Volver' : 'Ver en pantalla completa'}
                  >
                    {isClean
                      ? <Minimize2 className='w-4 h-4' />
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
                  totalObjects={game.totalObjects}
                  elapsedSeconds={game.elapsedSeconds}
                  hintsUsed={game.hintsUsed}
                />
              )}
              {playingMode === 'puzzle' && (
                <PostcardGameResults
                  item={item}
                  gameType="puzzle"
                  totalObjects={puzzle.total}
                  elapsedSeconds={puzzle.elapsedSeconds}
                  hintsUsed={puzzle.peeksUsed}
                  moves={puzzle.moves}
                />
              )}
            </div>
          </div>
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
              isClaimedByMe={isClaimedByMe}
              isClaimed={isClaimed}
              onClaimPostcard={onClaimPostcard}
              isClaimLoading={isClaimLoading}
              isInAlbum={isInAlbum}
              showClaimGuide={showClaimGuide}
              hideActions={hideActions}
              isClean={isClean}
              isBusiness={isBusiness}
              storytellingTitle={storytelling ? 'short' : undefined}
              albumStops={albumStops}
              totalStops={activeSlideItem.generation_metadata?.tripContext?.totalStops || Object.keys(albumStops).length || albumItems.length}
              onPlay={allowPlay ? () => setShowSelector(true) : undefined}
            />

            {/* Storytelling preview — compact, with flip-to-read-more */}
            {storytelling && (
              <StorytellingPreview
                storytelling={storytelling}
                onFlipCard={() => {
                  onFlipCard('info');
                }}
                isClean={isClean}
              />
            )}
          </>
        ) : playingMode === 'hunt' ? (
          <GameBottomPanel
            item={item}
            game={game}
            onClose={() => {
              if (gameFlipped) {
                setGameFlipped(false);
                setTimeout(() => {
                  setPlayingMode(null);
                  window.dispatchEvent(new CustomEvent('postalpeek:next-card'));
                }, 700);
              } else {
                setPlayingMode(null);
              }
            }}
          />
        ) : playingMode === 'puzzle' ? (
          <PuzzleBottomPanel
            item={item}
            puzzle={puzzle}
            onClose={() => {
              if (gameFlipped) {
                setGameFlipped(false);
                setTimeout(() => {
                  setPlayingMode(null);
                  window.dispatchEvent(new CustomEvent('postalpeek:next-card'));
                }, 700);
              } else {
                setPlayingMode(null);
              }
            }}
          />
        ) : null}
      </div>

      {/* Game mode selector */}
      <PostcardGameSelector
        open={showSelector}
        hasHuntMode={hasHuntMode}
        onSelect={(mode) => {
          setShowSelector(false);
          setPlayingMode(mode);
        }}
        onClose={() => setShowSelector(false)}
      />
    </div>
  );
}
