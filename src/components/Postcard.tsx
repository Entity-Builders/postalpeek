import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ArrowUpRight, Info, Heart, Share2, Check, Play, Wand2, Loader2 } from 'lucide-react';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { supabase } from '@eb-packages/logic/src/supabase';
import { cn } from './SearchBar';
import { analytics } from '../lib/analytics';

export interface FeedItem {
  id: string;
  country: string;
  city: string;
  location_name?: string;
  lat: number;
  lng: number;
  original_image_url: string;
  illustration_url: string;
  category: string;
  description: string;
  created_at: string;
  streetview_pov?: any;
  generation_metadata?: any;
  video_url?: string;
  video_generation_status?: 'idle' | 'processing' | 'completed' | 'failed';
  imagine_task_id?: string;
  should_animate?: boolean;
}

interface PostcardProps {
  item: FeedItem;
  isActive: boolean;
  isAdmin?: boolean;
  /** When false, images are not mounted to save bandwidth (off-screen slides) */
  isNearby?: boolean;
}

export function Postcard({ item, isActive, isAdmin = false, isNearby = true }: PostcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [localAnimState, setLocalAnimState] = useState<'idle' | 'queued' | null>(null);

  const animationState = item.video_url ? 'completed' :
    item.video_generation_status === 'processing' ? 'processing' :
    localAnimState !== null ? localAnimState :
    item.should_animate ? 'queued' : 'idle';

  // If the postcard is no longer active (user navigating the feed), ensure it resets to front face
  React.useEffect(() => {
    if (!isActive && isFlipped) {
      setIsFlipped(false);
    }
  }, [isActive, isFlipped]);

  const handleFlip = () => {
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);
    if (newFlipped) {
      analytics.track('postcard_flipped', {
        postcard_id: item.id,
        country: item.country,
      });
    }
  };

  return (
    <div
      className={cn(
        'w-[90vw] max-w-[480px] h-full max-h-[80dvh] md:max-h-[85dvh] perspective-1000 cursor-pointer transition-all duration-700 mx-auto ease-in-out',
        isActive
          ? 'scale-100 opacity-100'
          : 'scale-[0.85] opacity-40 pointer-events-none',
      )}
      onClick={handleFlip}
    >
      <motion.div
        className='w-full h-full relative preserve-3d'
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{
          duration: 0.8,
          type: 'spring',
          stiffness: 60,
          damping: 15,
        }}
      >
        {/* FRONT FACE (Pure Art - Subtle & Minimalist) */}
        <div className='absolute inset-0 w-full h-full backface-hidden bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] overflow-hidden rounded-sm md:rounded-md flex flex-col p-3 md:p-4 border border-white/50'>
          {/* The Illustration */}
          <div 
            className='flex-1 relative overflow-hidden rounded-lg bg-black/5 shadow-inner'
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {isNearby ? (
              <img
                src={item.illustration_url}
                alt={item.category}
                loading={isActive ? 'eager' : 'lazy'}
                decoding='async'
                fetchPriority={isActive ? 'high' : 'auto'}
                className={cn(
                  'absolute inset-0 w-full h-full object-cover transition-transform duration-700',
                  !item.video_url && 'hover:scale-105'
                )}
              />
            ) : (
              <div className='absolute inset-0 w-full h-full bg-stone-200/50' />
            )}
            
            {item.video_url && isHovered && (
              item.video_url.toLowerCase().includes('.gif') ? (
                <img
                  key={item.video_url}
                  src={item.video_url}
                  alt="Animated Scene"
                  className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none"
                />
              ) : (
                <video
                  key={item.video_url}
                  src={item.video_url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  disablePictureInPicture
                  controls={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onLoadedData={(e) => {
                    // Force playback explicitly if autoPlay gets blocked by browser policies
                    e.currentTarget.play().catch(() => {});
                  }}
                  className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none"
                />
              )
            )}

            {/* Subtle Play Icon indicator */}
            {item.video_url && !isHovered && (
              <div 
                className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md rounded-full p-1.5 text-white/90 z-20 pointer-events-none transition-opacity duration-300"
              >
                <Play className="w-3.5 h-3.5 fill-white/80" />
              </div>
            )}
            {/* Stamp overlay effect */}
            <div className='absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-white/40 border-dashed rounded opacity-70 flex flex-col items-center justify-center -rotate-6 pointer-events-none'>
              <span className='text-[10px] md:text-xs font-bold text-white uppercase tracking-widest bg-black/20 px-1 rounded backdrop-blur-sm -rotate-12'>
                POST
              </span>
              <span className='text-[8px] md:text-[10px] text-white/90 font-mono mt-1 drop-shadow-md'>
                {new Date(item.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Bottom margin (Title & Location) */}
          <div className='mt-3 md:mt-4 px-2 flex justify-between items-end'>
            <div>
              <h3 className='font-serif text-lg md:text-xl text-stone-800 tracking-tight leading-none mb-1'>
                {item.category.replace(/[\u{1F300}-\u{1F9FF}]/u, '').trim()}
              </h3>
              <div className='flex items-center gap-1.5 min-w-0'>
                <MapPin className='w-3.5 h-3.5 text-stone-400 shrink-0' />
                <p className='text-sm md:text-base text-stone-500 tracking-wide font-light truncate'>
                  {item.city}, {item.country}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <button
                className={cn(
                  'p-2 md:p-2.5 rounded-full transition-colors',
                  isLiked
                    ? 'bg-rose-100 text-rose-500'
                    : 'bg-stone-100/80 hover:bg-rose-50 text-stone-400 hover:text-rose-500',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  const newLiked = !isLiked;
                  setIsLiked(newLiked);
                  if (newLiked) {
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

              <button
                className={cn(
                  'p-2 md:p-2.5 rounded-full transition-colors',
                  isCopied
                    ? 'bg-indigo-50 text-indigo-500'
                    : 'bg-stone-100/80 hover:bg-blue-50 text-stone-400 hover:text-blue-500',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  const shortHash = encodeUuidToHash(item.id);
                  const shareLink = `${window.location.origin}/${shortHash}`;
                  navigator.clipboard
                    .writeText(shareLink)
                    .then(() => {
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                      analytics.track('postcard_shared', {
                        postcard_id: item.id,
                        country: item.country,
                        share_link: shareLink,
                      });
                    })
                    .catch((err) => console.log('Share failed:', err));
                }}
              >
                {isCopied ? (
                  <Check className='w-4 h-4 md:w-5 md:h-5 scale-110 transition-transform' />
                ) : (
                  <Share2 className='w-4 h-4 md:w-5 md:h-5 transition-transform' />
                )}
              </button>

              {isAdmin && animationState !== 'completed' && (
                <button
                  className={cn(
                    'p-2 md:p-2.5 rounded-full transition-colors',
                    animationState === 'processing' 
                      ? 'bg-amber-100 text-amber-500 cursor-not-allowed'
                      : 'bg-violet-100/80 hover:bg-violet-200 text-violet-500 hover:text-violet-600'
                  )}
                  disabled={animationState === 'processing'}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (animationState === 'processing') return;

                    setLocalAnimState('queued'); // optimistic: show spinner immediately
                    
                    try {
                      const { data, error } = await supabase.functions.invoke(
                        'postalpeek-video-trigger',
                        { body: { postcardId: item.id } },
                      );

                      if (error) {
                        // Try to parse the structured error from our edge function
                        let reason = 'Unknown error';
                        let provider: string | undefined;
                        let httpStatus: number | undefined;
                        try {
                          const body = typeof error === 'object' && error.context
                            ? await error.context.json()
                            : null;
                          if (body) {
                            reason = body.reason || body.error || reason;
                            provider = body.provider;
                            httpStatus = body.httpStatus;
                          }
                        } catch { /* response already consumed or not JSON */ }

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
                      
                      // The function updated the DB, realtime or next fetch will pick it up
                      console.log('[Postcard] Video triggered:', data);
                      analytics.track('video_trigger_success', {
                        postcard_id: item.id,
                        country: item.country,
                        task_id: data?.taskId,
                      });
                      setLocalAnimState(null); // clear local state, let DB drive it
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
                  title={animationState === 'processing' ? 'Processing Video...' : 'Generate Video Animation'}
                >
                  {animationState === 'processing' || animationState === 'queued' ? (
                    <Loader2 className='w-4 h-4 md:w-5 md:h-5 animate-spin' />
                  ) : (
                    <Wand2 className='w-4 h-4 md:w-5 md:h-5' />
                  )}
                </button>
              )}

              <button
                className='p-2 md:p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors'
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(true);
                }}
              >
                <Info className='w-4 h-4 md:w-5 md:h-5' />
              </button>
            </div>
          </div>
        </div>

        {/* BACK FACE (Text, Stamp, Coordinates) */}
        <div className='absolute inset-0 w-full h-full backface-hidden bg-[#fdfbf7] rounded-sm md:rounded-md shadow-2xl rotate-y-180 p-4 md:p-8 border border-[rgba(0,0,0,0.05)] overflow-hidden'>
          {/* Subtle paper texture overlay */}
          <div
            className='absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply'
            style={{
              backgroundImage:
                'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
            }}
          ></div>

          {/* Main content – scrollable on mobile */}
          <div className='relative flex flex-col sm:flex-row w-full h-full text-black/80 gap-4 sm:gap-6 overflow-y-auto pb-2'>
            {/* ── Top on mobile / Right on desktop: Stamp, Address & Photo ── */}
            <div className='w-full sm:w-[40%] flex flex-col relative sm:shrink-0 order-last sm:order-last'>
              {/* Stamp */}
              <div className='w-16 h-20 sm:w-20 sm:h-24 border border-stone-300 rounded flex bg-stone-100 items-center justify-center rotate-3 shadow-sm self-end mb-4 sm:mb-8'>
                <span className='text-[9px] sm:text-[10px] text-stone-400 font-mono tracking-widest -rotate-45 block'>
                  STAMP
                  <br />
                  HERE
                </span>
              </div>

              {/* Address Lines – normal flow (no absolute positioning) */}
              <div className='w-full flex flex-col gap-0 mb-4 sm:mb-8'>
                <div className='w-full border-b border-black/10 pb-1 mb-3 sm:mb-5'>
                  <span className='font-handwriting text-lg sm:text-xl md:text-3xl text-slate-800 rotate-[-1deg] block truncate'>
                    {item.location_name || `${item.city}, ${item.country}`}
                  </span>
                </div>
                <div className='w-full border-b border-black/10 pb-1 mb-3 sm:mb-5'>
                  <span className='font-mono text-[10px] md:text-xs text-slate-500 tracking-widest block'>
                    LAT: {item.lat.toFixed(6)}° N
                  </span>
                </div>
                <div className='w-full border-b border-black/10 pb-1'>
                  <span className='font-mono text-[10px] md:text-xs text-slate-500 tracking-widest block'>
                    LNG: {Math.abs(item.lng).toFixed(6)}°{' '}
                    {item.lng >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              </div>

              {/* The "Polaroid" Snapshot */}
              <div
                className='relative p-1.5 pb-6 bg-white shadow-md rounded-sm rotate-[-2deg] hover:rotate-0 transition-all hover:scale-105 z-10 group/photo cursor-pointer w-[65%] sm:w-[80%] self-center sm:mt-auto'
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}&heading=${item.streetview_pov?.heading || 0}&pitch=${item.streetview_pov?.pitch || 0}&fov=${item.streetview_pov?.fov || 90}`,
                    '_blank',
                  );
                }}
              >
                <div className='relative aspect-square overflow-hidden bg-stone-100 outline outline-1 outline-stone-200'>
                  <img
                    src={item.original_image_url}
                    alt='Original reality'
                    loading='lazy'
                    decoding='async'
                    className='w-full h-full object-cover'
                  />
                  <div className='absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]'>
                    <span className='flex items-center gap-1.5 text-white text-xs font-semibold tracking-wide bg-black/60 px-3 py-1.5 rounded-full'>
                      Inspect <ArrowUpRight className='w-3 h-3' />
                    </span>
                  </div>
                </div>
                <p className='absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-stone-500 font-mono tracking-wider uppercase'>
                  Source Image
                </p>
              </div>
            </div>

            {/* ── Bottom on mobile / Left on desktop: The Story ── */}
            <div className='flex-1 flex flex-col pt-2 sm:border-r border-black/10 sm:pr-6 order-first sm:order-first min-h-0'>
              <span className='inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] md:text-sm font-medium rounded-full mb-3 md:mb-6 tracking-wide uppercase w-fit'>
                {item.category}
              </span>

              <p className='font-handwriting text-lg sm:text-2xl md:text-3xl leading-relaxed text-slate-800 whitespace-pre-wrap'>
                "{item.description}"
              </p>

              <div className='mt-auto border-t border-stone-300/50 pt-3 sm:pt-4 flex flex-col gap-1.5 sm:gap-2 font-mono text-[9px] md:text-xs text-stone-400'>
                <p>
                  Generation Strategy:{' '}
                  <span className='text-stone-600 font-semibold'>
                    {item.generation_metadata?.strategy || 'Random Exploration'}
                  </span>
                </p>
                <p>
                  Photographic Lens:{' '}
                  <span className='text-stone-600 font-semibold'>
                    {item.streetview_pov?.lens || 'Standard 90° FOV'}
                  </span>
                </p>
                <p>Date: {new Date(item.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
