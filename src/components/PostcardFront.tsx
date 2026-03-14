import React, { useState } from 'react';
import {
  MapPin,
  Info,
  Heart,
  Share2,
  Check,
  Play,
  Wand2,
  Loader2,
  Ticket,
} from 'lucide-react';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { supabase } from '@eb-packages/logic/src/supabase';
import { cn } from './SearchBar';
import { analytics } from '../lib/analytics';
import type { FeedItem } from './Postcard';
import { cdnUrl } from '../utils/imageUtils';

interface PostcardFrontProps {
  item: FeedItem;
  isAdmin: boolean;
  isPriority: boolean;
  isLiked: boolean;
  onToggleFavorite?: (postcardId: string) => void;
  onAuthRequired?: (postcardId: string) => void;
  onFlipCard: (view?: 'info' | 'coupon') => void;
  mainImgUrl: string;
  placeholderUrl?: string;
  srcSetString?: string;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export function PostcardFront({
  item,
  isAdmin,
  isPriority,
  isLiked,
  onToggleFavorite,
  onAuthRequired,
  onFlipCard,
  mainImgUrl,
  placeholderUrl,
  srcSetString,
  handleImageError,
}: PostcardFrontProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [localAnimState, setLocalAnimState] = useState<
    'idle' | 'queued' | null
  >(null);

  const animationState = item.video_url
    ? 'completed'
    : item.video_generation_status === 'processing'
      ? 'processing'
      : localAnimState !== null
        ? localAnimState
        : item.should_animate
          ? 'queued'
          : 'idle';

  const isBusiness = item.generation_metadata?.strategy === 'Zigzag Shared Place';

  return (
    <div
      className="absolute inset-0 w-full h-full bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] rounded-sm md:rounded-md flex flex-col p-3 md:p-4 border border-white/50"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(0deg) translateZ(1px)',
        WebkitTransform: 'rotateY(0deg) translateZ(1px)',
      }}
    >
      {/* The Illustration */}
      <div
        className="flex-1 relative overflow-hidden rounded-lg shadow-inner image-protected bg-stone-200"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Shimmer Placeholder (Visible while image loads in front) */}
        <div className="absolute inset-0 bg-stone-300/40 animate-pulse pointer-events-none z-0" />

        {/* The Cloudy Blur Placeholder (Cloudflare micro-image) */}
        {placeholderUrl && (
          <img
            src={placeholderUrl}
            alt=''
            loading='eager' /* Micro-placeholder always eager */
            decoding='async'
            className='absolute inset-0 w-full h-full object-cover blur-xl scale-110 saturate-150 transform-gpu z-0 opacity-80'
            style={{ transition: 'opacity 0.4s ease-out' }}
          />
        )}

        <img
          key={mainImgUrl}
          src={mainImgUrl}
          srcSet={srcSetString}
          sizes="(max-width: 480px) 480px, (max-width: 768px) 768px, 1024px"
          alt={item.category}
          loading={isPriority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={isPriority ? 'high' : 'auto'}
          draggable={false}
          onError={handleImageError}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-transform duration-700 z-10',
            !item.video_url && 'hover:scale-105',
          )}
        />

        {item.video_url &&
          isHovered &&
          (item.video_url.toLowerCase().includes('.gif') ? (
            <img
              key={item.video_url}
              src={cdnUrl(item.video_url!)}
              alt="Animated Scene"
              className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none"
            />
          ) : (
            <video
              key={item.video_url}
              src={cdnUrl(item.video_url!)}
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
              controls={false}
              onContextMenu={(e) => e.preventDefault()}
              onLoadedData={(e) => {
                e.currentTarget.play().catch(() => {});
              }}
              className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none"
            />
          ))}

        {/* Subtle Play Icon indicator */}
        {item.video_url && !isHovered && (
          <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md rounded-full p-1.5 text-white/90 z-20 pointer-events-none transition-opacity duration-300">
            <Play className="w-3.5 h-3.5 fill-white/80" />
          </div>
        )}
        {/* Stamp overlay effect */}
        <div className="absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-white/40 border-dashed rounded opacity-70 flex flex-col items-center justify-center -rotate-6 pointer-events-none z-[3]">
          <span className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest bg-black/20 px-1 rounded backdrop-blur-sm -rotate-12">
            POST
          </span>
          <span className="text-[8px] md:text-[10px] text-white/90 font-mono mt-1 drop-shadow-md">
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Bottom margin (Title & Location) */}
      <div className="mt-3 md:mt-4 px-2 flex justify-between items-end">
        <div className="flex-1 min-w-0 mr-3">
          <h3
            className="font-serif text-lg md:text-xl font-semibold tracking-tight leading-none mb-1 truncate"
            style={{ color: '#1a1a1a' }}
          >
            {item.category.replace(/[\u{1F300}-\u{1F9FF}]/u, '').trim()}
          </h3>
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <p className="text-sm md:text-base text-neutral-600 tracking-wide truncate">
              {item.city}, {item.country}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
                analytics.captureError(err instanceof Error ? err : new Error(String(err)), {
                  event_type: 'share_failed',
                  postcard_id: item.id,
                });
                alert('Failed to generate share link. Please try again.');
              } finally {
                setIsSharing(false);
              }
            }}
          >
            {isSharing ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : isCopied ? (
              <Check className="w-4 h-4 md:w-5 md:h-5 scale-110 transition-transform" />
            ) : (
              <Share2 className="w-4 h-4 md:w-5 md:h-5 transition-transform" />
            )}
          </button>

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
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </button>
          )}

          {isBusiness && (
            <button
              className="p-2 md:p-2.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-500 hover:text-rose-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onFlipCard('coupon');
                analytics.track('coupon_viewed', { postcard_id: item.id });
              }}
              title="Special Offer"
            >
              <Ticket className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          )}

          <button
            className="p-2 md:p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onFlipCard('info');
            }}
          >
            <Info className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
