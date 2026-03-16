import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  MapPin,
  Info,
  Heart,
  Share2,
  Check,
  // Wand2, // commented out: video generation button hidden
  Loader2,
  Ticket,
  ChevronRight,
  Gem,
  ShieldCheck,
} from 'lucide-react';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { supabase } from '@eb-packages/logic/src/supabase';
import { cn } from './SearchBar';
import { analytics } from '../lib/analytics';
import { preSignUrls } from '../utils/imageUtils';
import type { FeedItem } from './Postcard';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { TripSlide } from './TripSlide';

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
}

export function PostcardFront({
  item,
  isAdmin,
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
}: PostcardFrontProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showClaimedTooltip, setShowClaimedTooltip] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  // Video generation state — commented out while button is hidden
  // const [localAnimState, setLocalAnimState] = useState<
  //   'idle' | 'queued' | null
  // >(null);

  // const animationState = item.video_url
  //   ? 'completed'
  //   : item.video_generation_status === 'processing'
  //     ? 'processing'
  //     : localAnimState !== null
  //       ? localAnimState
  //       : item.should_animate
  //         ? 'queued'
  //         : 'idle';

  const isBusiness =
    item.generation_metadata?.strategy === 'Zigzag Shared Place';

  // State and logic for Trip Galleries
  const [tripItems, setTripItems] = useState<FeedItem[]>([item]);
  const [tripStops, setTripStops] = useState<Record<number, { stop_name: string; stop_description?: string }>>({});

  React.useEffect(() => {
    if (!item.trip_id) return;
    let mounted = true;

    // Fetch postcards for this trip
    supabase
      .from('postalpeek_postcards')
      .select('*')
      .eq('trip_id', item.trip_id)
      .not('illustration_url', 'is', null)
      .order('trip_sequence', { ascending: true })
      .then(({ data }) => {
        if (mounted && data) {
          const items = data as FeedItem[];
          
          // Pre-sign the fetched trip URLs to ensure they display correctly
          preSignUrls(items.flatMap((i) => [i.illustration_url, i.original_image_url].filter(Boolean))).catch((err) => 
            console.error('Failed to pre-sign trip item images', err)
          );

          if (items.some((i) => i.id === item.id)) setTripItems(items);
          else
            setTripItems(
              [item, ...items].sort(
                (a, b) => (a.trip_sequence || 0) - (b.trip_sequence || 0),
              ),
            );
        }
      });

    // Fetch stop metadata (names, descriptions)
    supabase
      .from('postalpeek_trip_stops')
      .select('sequence, stop_name, stop_description')
      .eq('trip_id', item.trip_id)
      .order('sequence', { ascending: true })
      .then(({ data }) => {
        if (mounted && data) {
          const map: Record<number, { stop_name: string; stop_description?: string }> = {};
          for (const stop of data) {
            map[stop.sequence] = { stop_name: stop.stop_name, stop_description: stop.stop_description };
          }
          setTripStops(map);
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
    const initialIndex = tripItems.findIndex((i) => i.id === item.id);
    if (initialIndex > 0) emblaApi.scrollTo(initialIndex, true);

    const onSelect = () => setCurrentIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, tripItems, item.id]);

  const activeSlideItem = tripItems[currentIndex] || item;

  const isTrip = !!item.trip_id;
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
      {/* Stacked cards behind for trips — animate fan-out */}
      {isTrip && (
        <>
          <div
            className='absolute inset-0 bg-white rounded-sm md:rounded-md border border-stone-200/60 shadow-md'
            style={{
              zIndex: 0,
              animation: 'fanRight 0.6s ease-out forwards',
            }}
          />
          <div
            className='absolute inset-0 bg-white rounded-sm md:rounded-md border border-stone-200/40 shadow-sm'
            style={{
              zIndex: 0,
              animation: 'fanLeft 0.6s ease-out 0.1s forwards',
            }}
          />
          <style>{`
            @keyframes fanRight {
              from { transform: rotate(0deg) translate(0, 0); }
              to { transform: rotate(2.5deg) translate(4px, 3px); }
            }
            @keyframes fanLeft {
              from { transform: rotate(0deg) translate(0, 0); }
              to { transform: rotate(-1.5deg) translate(-3px, 5px); }
            }
          `}</style>
        </>
      )}

      {/* Main card */}
      <div
        className='relative w-full h-full bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] rounded-sm md:rounded-md flex flex-col p-3 md:p-4 border border-white/50'
        style={{ zIndex: 1 }}
      >
        {/* The Illustration */}
        <div
          className={cn(
            'relative overflow-hidden rounded-lg shadow-inner image-protected bg-stone-200',
            'flex-1',
          )}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Dev-only album badge (all postcards) */}
          {isAdmin && isInAlbum && (
            <span className='absolute top-2 left-2 z-40 inline-flex items-center gap-1 bg-amber-500/90 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm'>
              🏆 Album
            </span>
          )}

          {isTrip ? (
            <>
              <div className='absolute top-2 left-2 right-2 z-30 pointer-events-none drop-shadow-md'>
                <span className='bg-black/60 text-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-medium border border-white/20 shadow-lg'>
                  🛫{' '}
                  {item.generation_metadata?.tripContext?.title ||
                    'Viaje en progreso'}
                </span>
              </div>

              <div className='overflow-hidden w-full h-full relative z-10' ref={emblaRef}>
                <div className='flex w-full h-full'>
                  {tripItems.map((slideItem) => (
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
                    />
                  ))}
                </div>
              </div>

              {/* Pagination Dots */}
              {tripItems.length > 1 && (
                <div className='absolute bottom-4 left-0 right-0 z-30 flex justify-center gap-1.5 pointer-events-none'>
                  {tripItems.map((_, idx) => (
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
            />
          )}
        </div>

        {/* Title + Buttons row */}
        <div className='mt-3 md:mt-4 px-2 flex justify-between items-end'>
          <div className='flex-1 min-w-0 mr-3'>
            {/* Trip stop indicator */}
            {activeSlideItem.trip_id && activeSlideItem.trip_sequence != null && (() => {
              const stopMeta = tripStops[activeSlideItem.trip_sequence!];
              const tripCtx = activeSlideItem.generation_metadata?.tripContext;
              const totalStops = tripCtx?.totalStops || Object.keys(tripStops).length || tripItems.length;
              return (
                <div className='mb-1'>
                  <p className='text-[10px] md:text-xs text-stone-400 font-medium tracking-wider uppercase'>
                    📍 Stop {activeSlideItem.trip_sequence}
                    {totalStops ? ` of ${totalStops}` : ''}
                    {stopMeta?.stop_name ? ` — ${stopMeta.stop_name}` : ''}
                  </p>
                  {stopMeta?.stop_description && (
                    <p className='text-[9px] md:text-[10px] text-stone-400/80 mt-0.5 line-clamp-1'>
                      {stopMeta.stop_description}
                    </p>
                  )}
                </div>
              );
            })()}
            <h3
              className={cn(
                'font-serif font-semibold tracking-tight leading-none mb-1 truncate',
                storytelling ? 'text-base md:text-lg' : 'text-lg md:text-xl',
              )}
              style={{ color: '#1a1a1a' }}
            >
              {activeSlideItem.category
                .replace(/[\u{1F300}-\u{1F9FF}]/u, '')
                .trim()}
            </h3>
            <div className='flex items-center gap-1.5 min-w-0'>
              <MapPin className='w-3.5 h-3.5 text-stone-400 shrink-0' />
              <p className='text-sm md:text-base text-neutral-600 tracking-wide truncate'>
                {activeSlideItem.city}, {activeSlideItem.country}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2 shrink-0'>
            <button
              className={cn(
                'p-2 md:p-2.5 rounded-full transition-colors',
                isLiked
                  ? 'bg-rose-100 text-rose-500'
                  : 'bg-stone-100/80 hover:bg-rose-50 text-stone-400 hover:text-rose-500',
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (onAuthRequired && !onToggleFavorite) {
                  onAuthRequired(item.id);
                  return;
                }
                if (onToggleFavorite) {
                  onToggleFavorite(item.id);
                }
                if (!isLiked) {
                  analytics.track('postcard_liked', {
                    postcard_id: item.id,
                    country: item.country,
                  });
                }
              }}
            >
              <Heart
                className={cn(
                  'w-4 h-4 md:w-5 md:h-5 transition-transform',
                  isLiked && 'fill-current scale-110',
                )}
              />
            </button>

            {/* 🃏 Claim area */}
            <div className='relative'>
              {/* Tutorial guide tooltip */}
              {showClaimGuide && !isClaimedByMe && (
                <motion.div
                  className='absolute bottom-full right-0 mb-2 z-50 pointer-events-none'
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: [0, -4, 0] }}
                  transition={{ y: { duration: 1.5, ease: 'easeInOut', repeat: Infinity }, opacity: { duration: 0.4 } }}
                >
                  <div className='bg-amber-500 text-white text-[11px] font-semibold px-3 py-2 rounded-lg shadow-lg whitespace-nowrap'>
                    ¡Reclamá esta postal! 👆
                    <div className='absolute top-full right-4 w-2 h-2 bg-amber-500 rotate-45 -translate-y-1' />
                  </div>
                </motion.div>
              )}
              {isClaimedByMe ? (
                <button
                  className='p-2 md:p-2.5 rounded-full bg-amber-100 text-amber-600 cursor-default ring-1 ring-amber-300/50 transition-all'
                  title='Ya es tuya'
                >
                  <ShieldCheck className='w-4 h-4 md:w-5 md:h-5' />
                </button>
              ) : (
                <>
                  <button
                    className='p-2 md:p-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-500 hover:text-amber-600 hover:scale-105 transition-all'
                    disabled={isClaimLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isClaimed) {
                        setShowClaimedTooltip((prev) => !prev);
                        setTimeout(() => setShowClaimedTooltip(false), 2500);
                        return;
                      }
                      if (!onClaimPostcard) {
                        // Tutorial flow: show confetti first, then auth gate after delay
                        if (showClaimGuide) {
                          setShowConfetti(true);
                          setTimeout(() => {
                            setShowConfetti(false);
                            onAuthRequired?.(item.id);
                          }, 1800);
                        } else {
                          onAuthRequired?.(item.id);
                        }
                        return;
                      }
                      onClaimPostcard(item.id);
                      if (isInAlbum) {
                        setTimeout(() => {
                          setShowConfetti(true);
                          setTimeout(() => setShowConfetti(false), 1500);
                        }, 200);
                      }
                    }}
                    title={isClaimed ? undefined : 'Reclamar esta postal'}
                  >
                    {isClaimLoading ? (
                      <Loader2 className='w-4 h-4 md:w-5 md:h-5 animate-spin' />
                    ) : (
                      <Gem className='w-4 h-4 md:w-5 md:h-5' />
                    )}
                  </button>
                  {showClaimedTooltip && (
                    <div
                      className='absolute bottom-full right-0 mb-2 px-3 py-2 bg-stone-800 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50'
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowClaimedTooltip(false);
                      }}
                    >
                      Esta postal ya fue adquirida 🃏
                      <div className='absolute top-full right-4 w-2 h-2 bg-stone-800 rotate-45 -translate-y-1' />
                    </div>
                  )}
                </>
              )}

              {/* Confetti Lottie — centered over the button, large enough to be visible */}
              {showConfetti && (
                <div
                  className='pointer-events-none z-50'
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: 300,
                    height: 300,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <DotLottieReact
                    src='/confetti.lottie'
                    autoplay
                    loop={false}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              )}
            </div>

            <button
              className={cn(
                'p-2 md:p-2.5 rounded-full transition-colors',
                isCopied
                  ? 'bg-indigo-50 text-indigo-500'
                  : 'bg-stone-100/80 hover:bg-blue-50 text-stone-400 hover:text-blue-500',
              )}
              disabled={isSharing}
              onClick={async (e) => {
                e.stopPropagation();
                if (isSharing) return;
                setIsSharing(true);

                try {
                  // Generate a unique 1-time share link
                  const { data, error } = await supabase
                    .from('postalpeek_shares')
                    .insert({ postcard_id: item.id })
                    .select('id')
                    .single();

                  if (error) throw error;
                  if (!data) throw new Error('No share record created');

                  const shortHash = encodeUuidToHash(data.id);
                  const shareLink = `${window.location.origin}/${shortHash}`;

                  await navigator.clipboard.writeText(shareLink);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);

                  analytics.track('postcard_shared', {
                    postcard_id: item.id,
                    country: item.country,
                    share_link: shareLink,
                  });
                } catch (err) {
                  console.log('Share failed:', err);
                  analytics.captureError(
                    err instanceof Error ? err : new Error(String(err)),
                    {
                      event_type: 'share_failed',
                      postcard_id: item.id,
                    },
                  );
                  alert('Failed to generate share link. Please try again.');
                } finally {
                  setIsSharing(false);
                }
              }}
            >
              {isSharing ? (
                <Loader2 className='w-4 h-4 md:w-5 md:h-5 animate-spin' />
              ) : isCopied ? (
                <Check className='w-4 h-4 md:w-5 md:h-5 scale-110 transition-transform' />
              ) : (
                <Share2 className='w-4 h-4 md:w-5 md:h-5 transition-transform' />
              )}
            </button>

            {/* --- Video generation button (varita mágica) — commented out for now ---
            {isAdmin && animationState !== 'completed' && (
              <button
                className={cn(
                  'p-2 md:p-2.5 rounded-full transition-colors',
                  animationState === 'processing'
                    ? 'bg-amber-100 text-amber-500 cursor-not-allowed'
                    : 'bg-violet-100/80 hover:bg-violet-200 text-violet-500 hover:text-violet-600',
                )}
                disabled={animationState === 'processing'}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (animationState === 'processing') return;

                  setLocalAnimState('queued');

                  try {
                    const { data, error } = await supabase.functions.invoke(
                      'postalpeek-video-trigger',
                      { body: { postcardId: item.id } },
                    );

                    if (error) {
                      let reason = 'Unknown error';
                      let provider: string | undefined;
                      let httpStatus: number | undefined;
                      try {
                        const body =
                          typeof error === 'object' && error.context
                            ? await error.context.json()
                            : null;
                        if (body) {
                          reason = body.reason || body.error || reason;
                          provider = body.provider;
                          httpStatus = body.httpStatus;
                        }
                      } catch {
                        // ignore
                      }

                      analytics.captureError(
                        error instanceof Error ? error : new Error(reason),
                        {
                          event_type: 'video_trigger_failed',
                          postcard_id: item.id,
                          country: item.country,
                          city: item.city,
                          reason,
                          provider,
                          upstream_http_status: httpStatus,
                        },
                      );
                      analytics.track('video_trigger_failed', {
                        postcard_id: item.id,
                        country: item.country,
                        reason,
                        provider,
                        upstream_http_status: httpStatus,
                      });

                      setLocalAnimState(null);
                      alert(
                        provider
                          ? `Video provider (${provider}) is temporarily unavailable. Try again later.`
                          : 'Failed to trigger video generation. Try again later.',
                      );
                      return;
                    }

                    console.log('[Postcard] Video triggered:', data);
                    analytics.track('video_trigger_success', {
                      postcard_id: item.id,
                      country: item.country,
                      task_id: data?.taskId,
                    });
                    setLocalAnimState(null);
                  } catch (err) {
                    analytics.captureError(
                      err instanceof Error ? err : new Error(String(err)),
                      {
                        event_type: 'video_trigger_exception',
                        postcard_id: item.id,
                        country: item.country,
                        city: item.city,
                      },
                    );
                    console.error('Failed to trigger video generation', err);
                    setLocalAnimState(null);
                    alert('Failed to trigger video generation');
                  }
                }}
                title={
                  animationState === 'processing'
                    ? 'Processing Video...'
                    : 'Generate Video Animation'
                }
              >
                {animationState === 'processing' ||
                animationState === 'queued' ? (
                  <Loader2 className='w-4 h-4 md:w-5 md:h-5 animate-spin' />
                ) : (
                  <Wand2 className='w-4 h-4 md:w-5 md:h-5' />
                )}
              </button>
            )}
            --- end commented out video button --- */}

            {isBusiness && (
              <button
                className='p-2 md:p-2.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-500 hover:text-rose-600 transition-colors'
                onClick={(e) => {
                  e.stopPropagation();
                  onFlipCard('coupon');
                  analytics.track('coupon_viewed', { postcard_id: item.id });
                }}
                title='Special Offer'
              >
                <Ticket className='w-4 h-4 md:w-5 md:h-5' />
              </button>
            )}

            <button
              className='p-2 md:p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors'
              onClick={(e) => {
                e.stopPropagation();
                onFlipCard('info');
              }}
            >
              <Info className='w-4 h-4 md:w-5 md:h-5' />
            </button>
          </div>
        </div>

        {/* Storytelling preview — compact, with flip-to-read-more */}
        {storytelling && (
          <button
            className='mt-2 mx-1 rounded-lg border-l-[3px] border-amber-400/70 bg-amber-50/60 px-3.5 py-2.5 flex items-center justify-between gap-2 w-[calc(100%-0.5rem)] text-left transition-colors hover:bg-amber-50/90'
            onClick={(e) => {
              e.stopPropagation();
              onFlipCard('info');
            }}
          >
            <div className='flex-1 min-w-0'>
              <span className='inline-block text-[10px] md:text-xs font-semibold text-amber-800/80 bg-amber-100/80 px-2 py-0.5 rounded-full mb-1'>
                {factTypeEmoji(storytelling.fact_type)}{' '}
                {factTypeLabel(storytelling.fact_type)}
              </span>
              <p className='text-xs md:text-sm text-stone-600 line-clamp-1 leading-snug'>
                💡 {storytelling.did_you_know}
              </p>
            </div>
            <span className='text-amber-600 text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-0.5'>
              Leer más
              <ChevronRight className='w-3.5 h-3.5' />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function factTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    historical: '🏛️',
    architectural: '🏗️',
    cultural: '🎭',
    gastronomic: '🍽️',
    natural: '🌿',
    artistic: '🎨',
  };
  return map[type] || '📖';
}

function factTypeLabel(type: string): string {
  const map: Record<string, string> = {
    historical: 'Dato Histórico',
    architectural: 'Arquitectura',
    cultural: 'Cultura',
    gastronomic: 'Gastronomía',
    natural: 'Naturaleza',
    artistic: 'Arte',
  };
  return map[type] || 'Dato Curioso';
}

