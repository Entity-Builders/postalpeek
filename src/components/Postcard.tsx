import { type BilingualText } from '../utils/i18n';
import React, { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useAnimate } from 'framer-motion';

import { WIDTHS } from '../utils/imageUtils';

import { useSignedImage, useSignedSrcSet, useRawSignedImage } from '../utils/useSignedImage';
import { cn } from './SearchBar';
import { analytics } from '../lib/analytics';
import { PostcardFront } from './PostcardFront';
import { PostcardBack } from './PostcardBack';
import { PostcardCoupon } from './PostcardCoupon';

export interface FeedItem {
  id: string;
  country: string;
  city: string;
  location_name?: string;
  lat: number;
  lng: number;
  original_image_url: string;
  illustration_url: string;
  category: string | BilingualText;
  description: string | BilingualText;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  streetview_pov?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generation_metadata?: any;
  album_id?: string;
  album_sequence?: number;
  video_url?: string;
  video_generation_status?: 'idle' | 'processing' | 'completed' | 'failed';
  imagine_task_id?: string;
  should_animate?: boolean;
  owner_id?: string | null;
  claimed_at?: string | null;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  visual_tags?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detailed_tags?: any[];
  aesthetic_vibes?: string[];
  architecture_style?: string | null;
  color_palette?: string | null;
  scene_type?: string | null;
  time_of_day?: string | null;
  weather?: string | null;
  human_activity?: string | null;
}

interface PostcardProps {
  item: FeedItem;
  isActive: boolean;
  isAdmin?: boolean;
  /** When true, network requests for this card's assets are prioritized */
  isPriority?: boolean;
  /** Set of postcard IDs the current user has favorited */
  favoriteIds?: Set<string>;
  /** Called when an authenticated user toggles the heart */
  onToggleFavorite?: (postcardId: string) => void;
  /** Called when an unauthenticated user taps the heart */
  onAuthRequired?: (postcardId: string) => void;
  /** Collectibles */
  isClaimedByMe?: boolean;
  isClaimed?: boolean;
  onClaimPostcard?: (postcardId: string) => void;
  isClaimLoading?: boolean;
  /** Dev-only: whether this postcard is in an album */
  isInAlbum?: boolean;
  /** Tutorial: show pulsing claim guide on the first card */
  showClaimGuide?: boolean;
  /** Hide the claim button entirely (e.g. in daily pack reveal) */
  hideActions?: boolean;
  /** Called when the hero image finishes loading */
  onHeroReady?: () => void;
  /** Called when user taps the expand icon to see fullscreen image */
  onExpandImage?: (item: FeedItem, sourceRect?: DOMRect) => void;
}

// ── Tuning constants ──
/** Max tilt in degrees the card can be dragged to (in each direction from rest) */
const MAX_TILT = 40;
/** Degrees past which releasing the card triggers a full flip */
const FLIP_THRESHOLD = 30;
/** How long (ms) the pointer must be held before entering drag-peek mode */
const PEEK_DELAY_MS = 250;
/** Pixels of horizontal movement per degree of rotation — lower = more sensitive */
const PX_PER_DEGREE = 3;

const springFlip = { type: 'spring' as const, stiffness: 60, damping: 15, duration: 0.8 };
const springSnap = { type: 'spring' as const, stiffness: 400, damping: 30, duration: 0.2 };

export function Postcard({
  item,
  isActive,
  isAdmin = false,
  isPriority = false,
  favoriteIds,
  onToggleFavorite,
  onAuthRequired,
  isClaimedByMe = false,
  isClaimed = false,
  onClaimPostcard,
  isClaimLoading = false,
  isInAlbum = false,
  showClaimGuide = false,
  hideActions = false,
  onHeroReady,
}: PostcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [backView, setBackView] = useState<'info' | 'coupon'>('info');
  const [activeSlideItem, setActiveSlideItem] = useState<FeedItem>(item);
  const [heroReady, setHeroReady] = useState(false);
  const isLiked = favoriteIds?.has(item.id) ?? false;

  // ── Animation primitives ──
  // useMotionValue drives rotateY at 60fps without React re-renders
  const rotateY = useMotionValue(0);
  // useAnimate for spring-based completion animations
  const [scope, animate] = useAnimate();

  // Gesture refs (no re-renders needed)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const isFlippedRef = useRef(false);
  const isAnimating = useRef(false);

  // Keep the ref in sync with state
  React.useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  // React to item updates from feed navigation
  React.useEffect(() => {
    setActiveSlideItem(item);
  }, [item]);

  // If the postcard is no longer active, reset to front face
  React.useEffect(() => {
    if (!isActive && isFlipped) {
      setIsFlipped(false);
      animate(scope.current, { rotateY: 0 }, springSnap);
      rotateY.set(0);
      setTimeout(() => setBackView('info'), 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isFlipped]);

  /** Programmatic flip used by child buttons (info, coupon) */
  const flipTo = useCallback((flipped: boolean) => {
    setIsFlipped(flipped);
    const target = flipped ? 180 : 0;
    animate(scope.current, { rotateY: target }, springFlip).then(() => {
      rotateY.set(target);
    });
    if (flipped) {
      analytics.track('postcard_flipped', {
        postcard_id: item.id,
        country: item.country,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.country]);

  // ── Gesture handlers ──

  const cancelPeek = useCallback(() => {
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start drag/flip if clicking on a button or link
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (isAnimating.current) return;
    cancelPeek();
    isDragging.current = false;
    startX.current = e.clientX;

    peekTimer.current = setTimeout(() => {
      peekTimer.current = null;
      isDragging.current = true;
      // Capture pointer so we keep getting move events even outside the element
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }, PEEK_DELAY_MS);
  }, [cancelPeek]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || isAnimating.current) return;

    // Prevent scroll while dragging the card
    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - startX.current;
    const baseAngle = isFlippedRef.current ? 180 : 0;
    // Convert pixels to degrees, clamp to [-MAX_TILT, MAX_TILT]
    const rawDeg = deltaX / PX_PER_DEGREE;
    const clampedDeg = Math.max(-MAX_TILT, Math.min(MAX_TILT, rawDeg));

    // Set directly on the motion value — zero overhead, GPU-driven
    rotateY.set(baseAngle + clampedDeg);
  }, [rotateY]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Ignore releases on buttons/links
    if ((e.target as HTMLElement).closest('button, a')) {
      cancelPeek();
      return;
    }
    const wasDragging = isDragging.current;
    isDragging.current = false;
    cancelPeek();

    // Release pointer capture
    try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* */ }

    if (isAnimating.current) return;

    const baseAngle = isFlippedRef.current ? 180 : 0;

    if (wasDragging) {
      // Check if dragged past threshold
      const currentAngle = rotateY.get();
      const delta = currentAngle - baseAngle;

      if (Math.abs(delta) >= FLIP_THRESHOLD) {
        // Dragged far enough → flip the card
        // If card is at back (180) and dragged → flip to 0
        const target = isFlippedRef.current ? 0 : 180;
        setIsFlipped(!isFlippedRef.current);

        isAnimating.current = true;
        animate(scope.current, { rotateY: target }, springFlip).then(() => {
          rotateY.set(target);
          isAnimating.current = false;
        });

        if (!isFlippedRef.current) {
          analytics.track('postcard_flipped', {
            postcard_id: item.id,
            country: item.country,
          });
        }
      } else {
        // Snap back — didn't drag far enough
        isAnimating.current = true;
        animate(scope.current, { rotateY: baseAngle }, springSnap).then(() => {
          rotateY.set(baseAngle);
          isAnimating.current = false;
        });
      }
    } else {
      // Quick tap — full flip instantly
      const newFlipped = !isFlippedRef.current;
      const target = newFlipped ? 180 : 0;
      setIsFlipped(newFlipped);

      isAnimating.current = true;
      animate(scope.current, { rotateY: target }, springFlip).then(() => {
        rotateY.set(target);
        isAnimating.current = false;
      });

      if (newFlipped) {
        analytics.track('postcard_flipped', {
          postcard_id: item.id,
          country: item.country,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelPeek, item.id, item.country]);

  const handlePointerLeave = useCallback(() => {
    if (isDragging.current) {
      // Was dragging → snap back without flipping
      isDragging.current = false;
      cancelPeek();
      const baseAngle = isFlippedRef.current ? 180 : 0;
      isAnimating.current = true;
      animate(scope.current, { rotateY: baseAngle }, springSnap).then(() => {
        rotateY.set(baseAngle);
        isAnimating.current = false;
      });
    } else {
      cancelPeek();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelPeek]);

  // Block scroll (wheel + touch) while dragging — must be native listener with { passive: false }
  const containerRef = useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const blockScroll = (e: WheelEvent | TouchEvent) => {
      if (isDragging.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener('wheel', blockScroll, { passive: false });
    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      el.removeEventListener('wheel', blockScroll);
      el.removeEventListener('touchmove', blockScroll);
    };
  }, []);

  const [fallbackEnabled, setFallbackEnabled] = useState(false);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Prevent infinite loop if the fallback itself fails
    if (fallbackEnabled) return;
    
    const currentSrc = e.currentTarget.src;
    
    if (currentSrc.includes('/cdn-cgi/image/')) {
      console.warn(`[Image Fallback] Cloudflare Limit (429) detected. Falling back to raw R2 images for card ${item.id}`);
      setTimeout(() => {
        setFallbackEnabled(true);
      }, 0);
      return;
    }

    analytics.captureError(new Error('Image failed to load'), {
      postcard_id: item.id,
      image_url: currentSrc,
    });
  };

  // Derive non-blocking signed Cloudflare URLs for the main item images
  const placeholderUrl = useSignedImage(item.illustration_url, { width: WIDTHS.blur, quality: 20 });
  const baseMainUrl = useSignedImage(item.illustration_url, { width: WIDTHS.desktop });
  const baseSrcSet = useSignedSrcSet(item.illustration_url, [WIDTHS.mobile, WIDTHS.tablet]);
  const rawMainUrl = useRawSignedImage(item.illustration_url);

  // Derive polaroid URLs dynamically from the activeSlideItem
  const basePolaroidUrl = useSignedImage(activeSlideItem.original_image_url, { width: WIDTHS.thumb });
  const rawPolaroidUrl = useRawSignedImage(activeSlideItem.original_image_url);

  // If fallback is triggered, bypass the signed transformations and use raw signed URLs
  const mainImgUrl = fallbackEnabled ? rawMainUrl : baseMainUrl;
  const srcSetString = fallbackEnabled ? undefined : baseSrcSet;
  const polaroidUrl = fallbackEnabled ? rawPolaroidUrl : basePolaroidUrl;
  const finalPlaceholder = fallbackEnabled ? undefined : placeholderUrl;

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full perspective-1000 cursor-grab mx-auto ease-in-out flex flex-col',
        isActive && !heroReady && 'opacity-0',
        isActive && heroReady && 'opacity-100',
        !isActive && 'opacity-40 pointer-events-none',
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
    >
      <motion.div
        ref={scope}
        className="w-full h-full relative bg-white"
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          rotateY,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)',
          padding: '8px 8px 32px 8px',
          borderRadius: '12px',
        }}
      >
        <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
          <PostcardFront
            item={item}
            isAdmin={isAdmin}
            isPriority={isPriority}
            isActive={isActive}
            isLiked={isLiked}
            onToggleFavorite={onToggleFavorite}
            onAuthRequired={onAuthRequired}
            onFlipCard={(view: 'info' | 'coupon' = 'info') => {
              setBackView(view);
              flipTo(true);
            }}
            onSlideChange={setActiveSlideItem}
            mainImgUrl={mainImgUrl}
            placeholderUrl={finalPlaceholder}
            srcSetString={srcSetString}
            handleImageError={handleImageError}
            fallbackEnabled={fallbackEnabled}
            onHeroLoad={() => {
              setHeroReady(true);
              onHeroReady?.();
            }}
            isClaimedByMe={isClaimedByMe}
            isClaimed={isClaimed}
            onClaimPostcard={onClaimPostcard}
            isClaimLoading={isClaimLoading}
            isInAlbum={isInAlbum}
            showClaimGuide={showClaimGuide}
            hideActions={hideActions}
          />
          {backView === 'coupon' ? (
            <PostcardCoupon item={activeSlideItem} />
          ) : (
            <PostcardBack
              item={activeSlideItem}
              polaroidUrl={polaroidUrl}
              handleImageError={handleImageError}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
