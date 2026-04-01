import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CircleUserRound } from 'lucide-react';
import { cn } from '../utils/cn';
import { cdnUrl, WIDTHS } from '../utils/imageUtils';
import type { FeedItem } from './Postcard';
import { t } from '../utils/i18n';
import {
  useSignedImage,
  useSignedSrcSet,
  useRawSignedImage,
} from '../utils/useSignedImage';
import { PostageStamp } from './ui/PostageStamp';

interface TripSlideProps {
  slideItem: FeedItem;
  isPriority: boolean;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  fallbackEnabled?: boolean;
  isHovered: boolean;
  setIsHovered: (h: boolean) => void;
  preloadedMainUrl?: string;
  preloadedPlaceholder?: string;
  preloadedSrcSet?: string;
  onHeroLoad?: () => void;
  /** When true, enables the loupe zoom on mouse move */
  isClean?: boolean;
  /** Sticker discovery callbacks (optional) */
  onDiscoverTag?: (params: {
    postcardId: string;
    tagLabelEn: string;
    tagType: string;
    tagLayer?: number;
    bbox: number[];
  }) => void;
  isTagDiscovered?: (postcardId: string, tagLabelEn: string) => boolean;
  isTagGenerating?: (postcardId: string, tagLabelEn: string) => boolean;
  /** Trivia Reveal Game lock state */
  isTriviaLocked?: boolean;
  /** Whether anyone owns this postcard */
  hasOwner?: boolean;
  /** Disable blur filters during tutorial */
  isTutorial?: boolean;
  /** Whether the user owns this */
  isClaimedByMe?: boolean;
  /** Current user metadata */
  user?: import('@supabase/supabase-js').User | null;
}

/** Scale factor applied to the image in clean/loupe mode */
const CLEAN_SCALE = 1.35;
/** Zoom level inside the loupe circle */
const LOUPE_ZOOM = 2.5;
/** Radius of the visible loupe circle in px */
const LOUPE_RADIUS = 45;

export function TripSlide({
  slideItem,
  isPriority,
  handleImageError,
  fallbackEnabled,
  isHovered,
  setIsHovered,
  preloadedMainUrl,
  preloadedPlaceholder,
  preloadedSrcSet,
  onHeroLoad,
  isClean = false,
  onDiscoverTag,
  isTagDiscovered,
  isTagGenerating,
  isTriviaLocked = false,
  hasOwner = true,
  isTutorial = false,
  isClaimedByMe,
  user,
}: TripSlideProps) {
  const pUrl = useSignedImage(
    preloadedMainUrl ? null : slideItem.illustration_url,
    { width: WIDTHS.blur, quality: 20 },
  );
  const bUrl = useSignedImage(
    preloadedMainUrl ? null : slideItem.illustration_url,
    { width: WIDTHS.desktop },
  );
  const bsSet = useSignedSrcSet(
    preloadedMainUrl ? null : slideItem.illustration_url,
    [WIDTHS.mobile, WIDTHS.tablet],
  );
  const rUrl = useRawSignedImage(
    preloadedMainUrl ? null : slideItem.illustration_url,
  );

  const mainImgUrl = preloadedMainUrl || (fallbackEnabled ? rUrl : bUrl);
  const srcSetString = preloadedMainUrl
    ? preloadedSrcSet
    : fallbackEnabled
      ? undefined
      : bsSet;
  const finalPlaceholder = preloadedMainUrl
    ? preloadedPlaceholder
    : fallbackEnabled
      ? undefined
      : pUrl;

  // Debug: show bounding boxes when ?debug=bbox is in URL
  const debugBbox =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug');

  const avatarUrl = user?.user_metadata?.avatar_url;
  const name = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0];
  const initial = typeof name === 'string' && name.length > 0 ? name.charAt(0).toUpperCase() : '?';

  // ── Loupe zoom — ref-based for zero re-renders ──
  // We render a second <img> (the "lens") on top of the base image.
  // It's scaled up and clipped to a circle centered on the cursor.
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLImageElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isClean || !lensRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const px = (cx / rect.width) * 100;
      const py = (cy / rect.height) * 100;

      // Map cursor % to the image-content % the base image shows there
      const imgPx = (px - 50) / CLEAN_SCALE + 50;
      const imgPy = (py - 50) / CLEAN_SCALE + 50;

      const Z = CLEAN_SCALE * LOUPE_ZOOM;
      // Where that image point sits in the element (local px)
      const ox = (imgPx / 100) * rect.width;
      const oy = (imgPy / 100) * rect.height;
      // Translate so the scaled content at (ox,oy) lands at cursor (cx,cy)
      const tx = cx - ox;
      const ty = cy - oy;

      const lens = lensRef.current;
      lens.style.opacity = '1';
      // clipPath in LOCAL space at (ox,oy) — after transform it maps to (cx,cy)
      lens.style.clipPath = `circle(${LOUPE_RADIUS / Z}px at ${imgPx}% ${imgPy}%)`;
      lens.style.transformOrigin = `${imgPx}% ${imgPy}%`;
      lens.style.transform = `translate(${tx}px, ${ty}px) scale(${Z})`;
    },
    [isClean],
  );

  const handleMouseLeave = useCallback(() => {
    if (lensRef.current) {
      // Only hide via opacity — keep clipPath & transform so the lens
      // doesn't flash at its unscaled size during the opacity transition
      lensRef.current.style.opacity = '0';
    }
    setIsHovered(false);
  }, [setIsHovered]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, [setIsHovered]);

  // ── Touch-hold loupe for mobile ──
  // Hold → loupe appears, drag → follows finger, release → disappears
  const TOUCH_LOUPE_RADIUS = 60;

  const updateLensFromTouch = useCallback((touch: React.Touch) => {
    if (!lensRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = touch.clientX - rect.left;
    const cy = touch.clientY - rect.top;
    const px = (cx / rect.width) * 100;
    const py = (cy / rect.height) * 100;

    const imgPx = (px - 50) / CLEAN_SCALE + 50;
    const imgPy = (py - 50) / CLEAN_SCALE + 50;

    const Z = CLEAN_SCALE * LOUPE_ZOOM;
    const ox = (imgPx / 100) * rect.width;
    const oy = (imgPy / 100) * rect.height;
    const tx = cx - ox;
    const ty = cy - oy;

    const lens = lensRef.current;
    lens.style.opacity = '1';
    lens.style.clipPath = `circle(${TOUCH_LOUPE_RADIUS / Z}px at ${imgPx}% ${imgPy}%)`;
    lens.style.transformOrigin = `${imgPx}% ${imgPy}%`;
    lens.style.transform = `translate(${tx}px, ${ty}px) scale(${Z})`;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isClean || e.touches.length !== 1) return;
      updateLensFromTouch(e.touches[0]);
    },
    [isClean, updateLensFromTouch],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isClean || !lensRef.current) return;
      e.preventDefault(); // prevent scroll while loupe is active
      updateLensFromTouch(e.touches[0]);
    },
    [isClean, updateLensFromTouch],
  );

  const handleTouchEnd = useCallback(() => {
    if (!lensRef.current) return;
    // Only hide via opacity — keep clipPath & transform to avoid flash
    lensRef.current.style.opacity = '0';
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex-[0_0_100%] h-full min-w-0',
        isClean && 'loupe-active',
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className='absolute inset-0 bg-gradient-to-br from-stone-200/40 via-stone-100/20 to-stone-200/30 animate-pulse pointer-events-none z-0' />

      {finalPlaceholder && (
        <img
          src={finalPlaceholder}
          alt=''
          loading='eager'
          decoding='async'
          className='absolute inset-0 w-full h-full object-cover blur-xl scale-110 saturate-150 transform-gpu z-0 opacity-80'
          style={{ transition: 'opacity 0.4s ease-out' }}
        />
      )}

      {/* Base image — shared element with layoutId for hero transition */}
      {mainImgUrl && (
        <motion.img
          layoutId={`pp-hero-${slideItem.id}`}
          key={mainImgUrl}
          src={mainImgUrl}
          srcSet={srcSetString}
          sizes='(max-width: 480px) 480px, (max-width: 768px) 768px, 1024px'
          alt={t(slideItem.category)}
          loading={isPriority ? 'eager' : 'lazy'}
          decoding='async'
          fetchPriority={isPriority ? 'high' : 'auto'}
          draggable={false}
          onError={handleImageError}
          onLoad={onHeroLoad}
          className={cn(
            'absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-500',
            isClean
              ? 'scale-[1.35] opacity-0'
              : !slideItem.video_url && 'hover:scale-105',
            isTriviaLocked && 'blur-md scale-110 saturate-50 brightness-90',
          )}
        />
      )}

      {/* Scarcity lock badge — unclaimed only */}
      {!isClean && (
        <AnimatePresence>
          {!hasOwner ? (
            <motion.div
              key="unowned"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className='absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm text-white/90 text-[11px] font-semibold px-2.5 py-1.5 rounded-full pointer-events-none z-20'
            >
              <CircleUserRound className='w-4 h-4 opacity-80' /> {t({ es: 'Sin dueño', en: 'Unowned' })}
            </motion.div>
          ) : isClaimedByMe && user ? (
            <motion.div
              key="owned"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.25, type: 'spring', stiffness: 400, damping: 25 }}
              className='absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-md text-white/90 text-[11px] font-semibold pr-2.5 pl-1.5 py-1.5 rounded-full pointer-events-none z-20 border border-white/10 shadow-lg'
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 shadow-inner rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white">
                  {initial}
                </div>
              )}
              <span className="truncate max-w-[100px]">
                {name}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}

      {/* Loupe lens — disabled for now (TODO: revisit later) */}

      {slideItem.video_url &&
        isHovered &&
        (slideItem.video_url.toLowerCase().includes('.gif') ? (
          <img
            key={slideItem.video_url}
            src={cdnUrl(slideItem.video_url)}
            alt='Animated Scene'
            className='absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none'
          />
        ) : (
          <video
            key={slideItem.video_url}
            src={cdnUrl(slideItem.video_url)}
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
            className='absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none'
          />
        ))}

      {slideItem.video_url && !isHovered && (
        <div className='absolute bottom-3 left-3 bg-black/40 backdrop-blur-md rounded-full p-1.5 text-white/90 z-20 pointer-events-none transition-opacity duration-300'>
          <Play className='w-3.5 h-3.5 fill-white/80' />
        </div>
      )}

      {/* Debug: Bounding box overlay — activate with ?debug */}
      {isClean && debugBbox && (
        <div className='absolute inset-0 z-30 transition-transform duration-500 scale-[1.35]'>
          {/* 10×10 coordinate grid — each cell = 100 in 0-1000 scale */}
          <div className='absolute inset-0 pointer-events-none'>
            {/* Vertical lines */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div
                key={`v${i}`}
                className='absolute top-0 bottom-0'
                style={{
                  left: `${i * 10}%`,
                  width: '1px',
                  background:
                    i === 5
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
            {/* Horizontal lines */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div
                key={`h${i}`}
                className='absolute left-0 right-0'
                style={{
                  top: `${i * 10}%`,
                  height: '1px',
                  background:
                    i === 5
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
            {/* Coordinate labels at grid intersections */}
            {[0, 2, 4, 6, 8, 10].map((y) =>
              [0, 2, 4, 6, 8, 10].map((x) => (
                <span
                  key={`lbl-${x}-${y}`}
                  className='absolute text-[7px] font-mono text-white/30 leading-none'
                  style={{
                    left: `${x * 10}%`,
                    top: `${y * 10}%`,
                    transform: 'translate(2px, 2px)',
                  }}
                >
                  {x * 100},{y * 100}
                </span>
              )),
            )}
          </div>
          {(
            slideItem.illustration_tags as {
              label?: { en?: string };
              type?: string;
              box_2d?: number[];
              bbox?: number[];
              confidence?: number;
            }[]
          )
            ?.filter(
              (tag) => {
                const coords = tag?.box_2d ?? tag?.bbox;
                return coords && Array.isArray(coords) && coords.length === 4;
              },
            )
            .map((tag, i) => {
              const coords = (tag.box_2d ?? tag.bbox)!;
              const [ymin, xmin, ymax, xmax] = coords;
              const typeColors: Record<string, string> = {
                architecture: 'rgba(59,130,246,0.35)',
                nature: 'rgba(34,197,94,0.35)',
                vehicle: 'rgba(245,158,11,0.35)',
                person: 'rgba(168,85,247,0.35)',
                animal: 'rgba(236,72,153,0.35)',
                object: 'rgba(99,102,241,0.35)',
                infrastructure: 'rgba(107,114,128,0.35)',
                scene_details: 'rgba(156,163,175,0.3)',
              };
              const color =
                typeColors[tag.type ?? ''] || 'rgba(255,255,255,0.3)';
              const borderColor = color
                .replace('0.35', '0.8')
                .replace('0.3', '0.8');
              return (
                <button
                  key={`${tag.label?.en}-${i}`}
                  className='absolute cursor-pointer transition-all duration-150 hover:brightness-125 active:scale-95 group'
                  style={{
                    left: `${xmin / 10}%`,
                    top: `${ymin / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                    backgroundColor: color,
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: '4px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log(
                      '🎯 Debug bbox:',
                      tag.label?.en,
                      tag.type,
                      coords,
                      tag,
                    );
                  }}
                  title={`${tag.label?.en} (${tag.type})`}
                >
                  {isTagGenerating?.(slideItem.id, tag.label?.en ?? '') && (
                    <span className='absolute inset-0 flex items-center justify-center'>
                      <span className='w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin' />
                    </span>
                  )}
                  {isTagDiscovered?.(slideItem.id, tag.label?.en ?? '') && (
                    <span className='absolute inset-0 flex items-center justify-center bg-green-500/30'>
                      <span className='text-white text-lg drop-shadow'>✓</span>
                    </span>
                  )}
                  <span className='absolute -top-5 left-0 text-[9px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
                    {tag.label?.en} ({tag.confidence}/10)
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {/* Postage stamp badge — hidden in clean/loupe mode or if trivia locked */}
      {!isClean && !isTriviaLocked && <PostageStamp createdAt={slideItem.created_at} />}
    </div>
  );
}
