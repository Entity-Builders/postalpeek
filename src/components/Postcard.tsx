import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  category: string;
  description: string;
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

  // React to item updates from feed navigation
  React.useEffect(() => {
    setActiveSlideItem(item);
  }, [item]);

  // If the postcard is no longer active (user navigating the feed), ensure it resets to front face
  React.useEffect(() => {
    if (!isActive && isFlipped) {
      setIsFlipped(false);
      // Optional: reset backView to 'info' after flip animation ends
      setTimeout(() => setBackView('info'), 400); 
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

  const [fallbackEnabled, setFallbackEnabled] = useState(false);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Prevent infinite loop if the fallback itself fails
    if (fallbackEnabled) return;
    
    const currentSrc = e.currentTarget.src;
    
    // If the failed image was attempting a Cloudflare transformation, it's likely a 429 Free Tier limit.
    // Trigger the React-level fallback which will instantly re-render all images on this card with raw URLs.
    if (currentSrc.includes('/cdn-cgi/image/')) {
      console.warn(`[Image Fallback] Cloudflare Limit (429) detected. Falling back to raw R2 images for card ${item.id}`);
      // Defer state update to avoid synchronous cascading re-renders during commit phase
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
      className={cn(
        'w-full h-full perspective-1000 cursor-pointer mx-auto ease-in-out flex flex-col',
        isActive && !heroReady && 'opacity-0',
        isActive && heroReady && 'opacity-100',
        !isActive && 'scale-[0.85] opacity-40 pointer-events-none',
      )}
      onClick={handleFlip}
    >
      <motion.div
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{
          duration: 0.8,
          type: 'spring',
          stiffness: 60,
          damping: 15,
        }}
      >
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
            setIsFlipped(true);
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
      </motion.div>
    </div>
  );
}
