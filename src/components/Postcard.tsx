import { type BilingualText } from '../utils/i18n';
import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useAnimate, AnimatePresence } from 'framer-motion';

import { WIDTHS } from '../utils/imageUtils';

import {
  useSignedImage,
  useSignedSrcSet,
  useRawSignedImage,
} from '../utils/useSignedImage';
import { cn } from '../utils/cn';
import { analytics } from '../lib/analytics';
import { PostcardFront } from './PostcardFront';
import { FullscreenOverlay } from './FullscreenOverlay';
import { PostcardBack } from './PostcardBack';
import { PostcardCoupon } from './PostcardCoupon';
import { useGameMode } from '../contexts/GameModeContext';

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
  last_played_at?: string | null;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  visual_tags?: string[];
  illustration_tags?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detailed_tags?: any[];
  aesthetic_vibes?: string[];
  architecture_style?: string | null;
  color_palette?: string | null;
  scene_type?: string | null;
  time_of_day?: string | null;
  weather?: string | null;
  human_activity?: string | null;
  stamp_cost?: number;
  game_stats?: {
    hp: number;
    attack: number;
    defense: number;
    magic: number;
    element: string;
    rarity: string;
  };
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
  hasOwner?: boolean;
  onClaimPostcard?: (postcardId: string, rarity: 'common' | 'rare' | 'epic' | 'legendary') => void;
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
  /** Called on quick tap (replaces flip — parent decides the behavior) */
  onTap?: () => void;
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
  /** Current user metadata */
  user?: import('@supabase/supabase-js').User | null;
}

const springFlip = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 28,
  duration: 0.1,
};
const springSnap = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  duration: 0.1,
};

export function Postcard({
  item,
  isActive,
  isAdmin = false,
  isPriority = false,
  favoriteIds,
  onToggleFavorite,
  onAuthRequired,
  isClaimedByMe = false,
  hasOwner = false,
  onClaimPostcard,
  isClaimLoading = false,
  isInAlbum = false,
  showClaimGuide = false,
  hideActions = false,
  onHeroReady,
  onTap,
  userId,
  onOpenAlbum,
  onOpenCollection,
  autoStartGame = false,
  isTutorial = false,
  onPlayGame,
  user,
}: PostcardProps) {
  const { isGameActive } = useGameMode();
  const [isFlipped, setIsFlipped] = useState(false);
  const [backView, setBackView] = useState<'info' | 'coupon'>('info');
  const [activeSlideItem, setActiveSlideItem] = useState<FeedItem>(item);
  const [heroReady, setHeroReady] = useState(false);

  /** Clean/expand mode — hides chrome, enables fullscreen overlay */
  const [isClean, setIsClean] = useState(false);
  const isInitialMount = useRef(true);
  const isLiked = favoriteIds?.has(item.id) ?? false;

  // ── Animation primitives ──
  const rotateY = useMotionValue(0);
  const [scope, animate] = useAnimate();

  const isFlippedRef = useRef(false);

  React.useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

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

  /** Programmatic flip — only triggered by ℹ️ / 🎫 buttons */
  const flipTo = useCallback(
    (flipped: boolean) => {
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
    },
    [item.id, item.country, animate, rotateY, scope],
  );

  // ── Container click handler (only delegates to onTap if provided) ──
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      if (isGameActive) return;
      if (onTap) {
        onTap();
      }
    },
    [onTap, isGameActive],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const [fallbackEnabled, setFallbackEnabled] = useState(false);

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    if (fallbackEnabled) return;

    const currentSrc = e.currentTarget.src;

    if (currentSrc.includes('/cdn-cgi/image/')) {
      console.warn(
        `[Image Fallback] Cloudflare Limit (429) detected. Falling back to raw R2 images for card ${item.id}`,
      );
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

  const placeholderUrl = useSignedImage(item.illustration_url, {
    width: WIDTHS.blur,
    quality: 20,
  });
  const baseMainUrl = useSignedImage(item.illustration_url, {
    width: WIDTHS.desktop,
  });
  const baseSrcSet = useSignedSrcSet(item.illustration_url, [
    WIDTHS.mobile,
    WIDTHS.tablet,
  ]);
  const rawMainUrl = useRawSignedImage(item.illustration_url);

  const basePolaroidUrl = useSignedImage(activeSlideItem.original_image_url, {
    width: WIDTHS.thumb,
  });
  const rawPolaroidUrl = useRawSignedImage(activeSlideItem.original_image_url);

  const mainImgUrl = fallbackEnabled ? rawMainUrl : baseMainUrl;
  const srcSetString = fallbackEnabled ? undefined : baseSrcSet;
  const polaroidUrl = fallbackEnabled ? rawPolaroidUrl : basePolaroidUrl;
  const finalPlaceholder = fallbackEnabled ? undefined : placeholderUrl;

  // Manage clean mode focus state
  React.useEffect(() => {
    if (!isActive) {
      setIsClean(false);
      isInitialMount.current = false;
    } else {
      if (isInitialMount.current) {
        // Opened directly (e.g. from grid) -> don't auto-maximize initially
        isInitialMount.current = false;
      }
      setIsClean(false);
    }
  }, [isActive]);

  const toggleClean = useCallback(() => {
    setIsClean((prev) => {
      const next = !prev;
      analytics.track(
        next ? 'postcard_clean_mode_on' : 'postcard_clean_mode_off',
        {
          postcard_id: item.id,
          country: item.country,
        },
      );
      return next;
    });
  }, [item.id, item.country]);

  // Overlay appears after a brief delay so card dissolve starts first
  const [showOverlay, setShowOverlay] = React.useState(false);
  React.useEffect(() => {
    if (isClean) {
      const timer = setTimeout(() => setShowOverlay(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowOverlay(false);
    }
  }, [isClean]);

  return (
    <>
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full perspective-1000 mx-auto ease-in-out flex flex-col transition-opacity duration-200',
        isActive && !heroReady && 'opacity-0',
        isActive && heroReady && 'opacity-100',
        !isActive && 'opacity-40 pointer-events-none',
        !onTap ? 'cursor-default' : (isClean ? 'cursor-zoom-in' : 'cursor-pointer'),
      )}
      onClick={handleClick}
    >
      <motion.div
        ref={scope}
        className={cn(
          'w-full h-full relative transition-[background-color,padding,border-radius,box-shadow] duration-300',
          (isClean || isGameActive) && !isFlipped ? 'bg-transparent' : 'bg-white',
        )}
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          rotateY,
          boxShadow: (isClean || isGameActive) && !isFlipped
            ? 'none'
            : '0 8px 30px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)',
          padding: (isClean || isGameActive) && !isFlipped ? '0' : '8px 8px 32px 8px',
          borderRadius: (isClean || isGameActive) && !isFlipped ? '0' : '12px',
        }}
      >
        <div
          className='relative w-full h-full'
          style={{ transformStyle: 'preserve-3d' }}
        >
          <PostcardFront
            item={item}
            isAdmin={isAdmin}
            isPriority={isPriority}
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
            hasOwner={hasOwner}
            onClaimPostcard={onClaimPostcard}
            isClaimLoading={isClaimLoading}
            isInAlbum={isInAlbum}
            showClaimGuide={showClaimGuide}
            hideActions={hideActions}
            isClean={isClean}
            onToggleClean={toggleClean}
            allowPlay={Array.isArray(item.illustration_tags) && item.illustration_tags.length > 0}
            userId={userId}
            onOpenAlbum={onOpenAlbum}
            onOpenCollection={onOpenCollection}
            autoStartGame={autoStartGame}
            isTutorial={isTutorial}
            onPlayGame={onPlayGame}
            user={user}
          />
          {backView === 'coupon' ? (
            <PostcardCoupon
              item={activeSlideItem}
              onFlipBack={() => flipTo(false)}
            />
          ) : (
            <PostcardBack
              item={activeSlideItem}
              polaroidUrl={polaroidUrl}
              handleImageError={handleImageError}
              onFlipBack={() => flipTo(false)}
              isActive={isActive}
              isClaimedByMe={isClaimedByMe}
              onClaimPostcard={onClaimPostcard}
              isClaimLoading={isClaimLoading}
            />
          )}
        </div>
      </motion.div>
    </div>

    {/* Fullscreen overlay — portaled to body to escape carousel transforms */}
    {createPortal(
      <AnimatePresence>
        {showOverlay && (
          <FullscreenOverlay
            item={activeSlideItem}
            cachedUrl={mainImgUrl}
            onClose={toggleClean}
          />
        )}
      </AnimatePresence>,
      document.body,
    )}
    </>
  );
}
