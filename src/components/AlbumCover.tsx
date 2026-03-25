import React, { useState, useEffect } from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { cn } from '../utils/cn';
import { cdnImage, WIDTHS, preSignUrls } from '../utils/imageUtils';
import {
  useSignedImage,
  useSignedSrcSet,
  useRawSignedImage,
} from '../utils/useSignedImage';
import type { FeedItem } from './Postcard';
import { useLang, t } from '../utils/i18n';

interface AlbumCoverProps {
  item: FeedItem;
  isActive: boolean;
  isPriority: boolean;
  onOpenTrip: () => void;
}

interface AlbumMeta {
  title: string;
  itinerary_summary: string;
}

export function AlbumCover({
  item,
  isActive,
  isPriority,
  onOpenTrip,
}: AlbumCoverProps) {
  const lang = useLang();
  const [albumMeta, setAlbumMeta] = useState<AlbumMeta | null>(null);
  const [stopThumbnails, setStopThumbnails] = useState<
    { id: string; url: string; stop_name?: string }[]
  >([]);
  const [bottomReady, setBottomReady] = useState(!item.album_id);
  const [heroReady, setHeroReady] = useState(false);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);

  const tripCtx = item.generation_metadata?.tripContext;
  // Use embedded metadata immediately — no need to wait for Supabase
  const title = albumMeta?.title || tripCtx?.title || t({ es: 'Álbum descubierto', en: 'Album discovered' }, lang);
  const totalStops = tripCtx?.totalStops || stopThumbnails.length || '?';
  const summary = albumMeta?.itinerary_summary || '';

  // Single parallel fetch for all album data (meta + stops + thumbnails)
  useEffect(() => {
    if (!item.album_id) return;
    let mounted = true;

    const fetchAlbumData = async () => {
      const [metaResult, postsResult] = await Promise.all([
        supabase
          .from('postalpeek_albums')
          .select('title, itinerary_summary')
          .eq('id', item.album_id!)
          .single(),
        supabase
          .from('postalpeek_postcards')
          .select('id, illustration_url, album_sequence')
          .eq('album_id', item.album_id!)
          .not('illustration_url', 'is', null)
          .order('album_sequence', { ascending: true }),
      ]);

      if (!mounted) return;

      // Set meta immediately
      if (metaResult.data) {
        setAlbumMeta(metaResult.data as AlbumMeta);
      }

      if (postsResult.data && postsResult.data.length > 0) {
        // Pre-sign + fetch stop names in parallel
        const [, stopsResult] = await Promise.all([
          preSignUrls(
            postsResult.data.map((d) => d.illustration_url).filter(Boolean),
          ),
          supabase
            .from('postalpeek_album_slots')
            .select('slot_order, slot_label')
            .eq('album_id', item.album_id!)
            .order('slot_order', { ascending: true }),
        ]);

        if (!mounted) return;

        const stopMap: Record<number, string> = {};
        if (stopsResult.data) {
          for (const s of stopsResult.data) {
            stopMap[s.slot_order] = s.slot_label;
          }
        }

        setStopThumbnails(
          postsResult.data.map((d) => ({
            id: d.id,
            url: d.illustration_url,
            stop_name: stopMap[d.album_sequence] || undefined,
          })),
        );
      }

      if (mounted) setBottomReady(true);
    };

    fetchAlbumData().catch(console.error);

    return () => {
      mounted = false;
    };
  }, [item.album_id]);

  // Signed image URLs for the hero image
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

  const mainImgUrl = fallbackEnabled ? rawMainUrl : baseMainUrl;
  const srcSetString = fallbackEnabled ? undefined : baseSrcSet;
  const finalPlaceholder = fallbackEnabled ? undefined : placeholderUrl;

  const handleImageError = () => {
    if (!fallbackEnabled) {
      setTimeout(() => setFallbackEnabled(true), 0);
    }
  };

  // Compute thumbnail size based on count — fill all available width
  const thumbCount = stopThumbnails.length;
  const thumbSize =
    thumbCount <= 3
      ? 'w-16 h-16 md:w-20 md:h-20'
      : thumbCount <= 5
        ? 'w-14 h-14 md:w-16 md:h-16'
        : 'w-11 h-11 md:w-14 md:h-14';

  return (
    <div
      className={cn(
        'w-full h-full max-w-[480px] cursor-pointer mx-auto ease-in-out',
        isActive && !heroReady && 'opacity-0',
        isActive && heroReady && 'opacity-100',
        !isActive && 'scale-[0.85] opacity-40 pointer-events-none',
      )}
      style={{ transition: 'opacity 300ms ease-out, transform 700ms ease-in-out' }}
      onClick={onOpenTrip}
    >
      {/* Card shell — always rendered */}
      <div className='relative w-full h-full bg-white flex flex-col overflow-hidden'>
        {/* Hero image — ALWAYS mounted so images start loading immediately */}
        <div className='relative flex-1 min-h-0 overflow-hidden bg-stone-200 rounded-md md:rounded-lg shadow-inner'>
          {/* Placeholder blur — loads in background even during skeleton */}
          {finalPlaceholder && (
            <img
              src={finalPlaceholder}
              alt=''
              loading='eager'
              decoding='async'
              className='absolute inset-0 w-full h-full object-cover blur-xl scale-110 saturate-150 transform-gpu z-0 opacity-80'
            />
          )}

          {/* Main hero illustration — also starts loading immediately */}
          {mainImgUrl && (
            <img
              src={mainImgUrl}
              srcSet={srcSetString}
              sizes='(max-width: 480px) 480px, (max-width: 768px) 768px, 1024px'
              alt={title}
              loading={isPriority ? 'eager' : 'lazy'}
              decoding='async'
              fetchPriority={isPriority ? 'high' : 'auto'}
              draggable={false}
              onError={handleImageError}
              onLoad={() => setHeroReady(true)}
              className='absolute inset-0 w-full h-full object-cover z-10'
            />
          )}

          {/* Gradient overlay at bottom of image for text overlay */}
          <div className='absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 via-black/25 to-transparent z-20' />

          {/* ─── Hero text overlays — always rendered using embedded feed data ─── */}
          {/* "VIAJE COMPLETO" badge */}
          <div className='absolute top-12 left-3 z-30'>
            <span className='bg-black/60 text-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold border border-white/20 shadow-lg tracking-wide flex items-center gap-1.5'>
              <span className="text-sm">📚</span> {t({ es: 'Álbum Disponible', en: 'Album Available' }, lang)}
            </span>
          </div>

          {/* POST stamp */}
          <div className='absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-white/40 border-dashed rounded opacity-70 flex flex-col items-center justify-center -rotate-6 pointer-events-none z-30'>
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

          {/* Title + location overlayed on image bottom */}
          <div className='absolute bottom-0 left-0 right-0 z-30 px-4 pb-3'>
            <p className='text-[10px] text-white/70 font-bold tracking-widest uppercase mb-0.5'>
              {t({ es: `ÁLBUM · ${totalStops} POSTALES`, en: `ALBUM · ${totalStops} POSTCARDS` }, lang)}
            </p>
            <h2 className='font-serif text-xl md:text-2xl font-bold leading-tight line-clamp-2 text-white drop-shadow-md'>
              {title}
            </h2>
            <div className='flex items-center gap-1.5 mt-1'>
              <MapPin className='w-3 h-3 text-white/70 shrink-0' />
              <p className='text-xs text-white/80 truncate'>
                {item.city}, {item.country}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom section — skeleton or real content */}
        {!bottomReady ? (
          <div className='shrink-0 px-2 md:px-3 pt-3 flex flex-col gap-2'>
            <div className='flex flex-col gap-1.5'>
              <div className='h-3 w-full rounded-full bg-stone-200 animate-pulse' />
              <div className='h-3 w-5/6 rounded-full bg-stone-200 animate-pulse' />
            </div>
            <div className='flex items-start justify-around gap-1 py-1'>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className='flex flex-col items-center flex-1 min-w-0'>
                  <div className='w-14 h-14 md:w-16 md:h-16 rounded-full bg-stone-200 animate-pulse mx-auto' />
                  <div className='h-2 w-10 rounded-full bg-stone-200 animate-pulse mt-1' />
                </div>
              ))}
            </div>
            <div className='w-full h-10 rounded-xl bg-stone-200 animate-pulse' />
          </div>
        ) : (
          <div className='shrink-0 px-2 md:px-3 pt-3 flex flex-col gap-2'>
            {summary && (
              <p className='text-xs md:text-sm text-stone-600 leading-relaxed italic'>
                {summary}
              </p>
            )}

            {stopThumbnails.length > 0 && (
              <div className='flex items-start justify-around gap-1 py-1'>
                {stopThumbnails.map((thumb, idx) => (
                  <div
                    key={thumb.id}
                    className='flex flex-col items-center flex-1 min-w-0'
                  >
                    <div
                      className={cn(
                        'rounded-full overflow-hidden border-2 border-stone-200 shadow-sm bg-stone-100 mx-auto',
                        thumbSize,
                      )}
                    >
                      <img
                        src={cdnImage(thumb.url, {
                          width: 160,
                          height: 160,
                          fit: 'cover',
                        })}
                        alt={thumb.stop_name || `Stop ${idx + 1}`}
                        className='w-full h-full object-cover'
                        loading='lazy'
                      />
                    </div>
                    <span className='text-[8px] md:text-[9px] text-stone-500 mt-1 text-center w-full truncate font-medium px-0.5'>
                      {thumb.stop_name || `Stop ${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              className='w-full py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm'
              onClick={(e) => {
                e.stopPropagation();
                onOpenTrip();
              }}
            >
              {t({ es: 'Abrir Álbum', en: 'Open Album' }, lang)}
              <ChevronRight className='w-4 h-4' />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
