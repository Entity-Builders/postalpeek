import React from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t, useLang, type BilingualText } from '../utils/i18n';

interface PostcardBackProps {
  item: FeedItem;
  polaroidUrl: string;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onFlipBack?: () => void;
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

export function PostcardBack({
  item,
  polaroidUrl,
  handleImageError,
  onFlipBack,
}: PostcardBackProps) {
  const storytelling = item.generation_metadata?.storytelling;
  useLang(); // subscribe — triggers re-render on language change
  const isAlbumGroup = !!item.album_id;
  const tripCtx = item.generation_metadata?.tripContext;
  const detailedTags: (BilingualText | string)[] = item.detailed_tags || [];
  const vibeInjected: string = item.generation_metadata?.vibe_injected || '';

  // Debug log — inspect full postal data in browser console
  console.log('[PostalPeek Debug]', item.id?.slice(0, 8), {
    description_raw: item.description,
    description_type: typeof item.description,
    description_t: t(item.description),
    visual_tags: item.visual_tags,
    generation_metadata: item.generation_metadata,
    streetview_pov: item.streetview_pov,
    category: item.category,
  });

  return (
    <div
      className="absolute inset-0 w-full h-full bg-[#fdfbf7] rounded-sm md:rounded-md shadow-2xl p-4 md:p-8 border border-[rgba(0,0,0,0.05)]"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg) translateZ(1px)',
        WebkitTransform: 'rotateY(180deg) translateZ(1px)',
      }}
    >
      {/* Subtle paper texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage:
            'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          borderRadius: 'inherit',
        }}
      ></div>

      {/* Flip-back button — positioned to mirror the ℹ️ button on the front */}
      {onFlipBack && (
        <button
          className='absolute bottom-3 right-3 z-40 p-2 md:p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors shadow-sm'
          onClick={(e) => {
            e.stopPropagation();
            onFlipBack();
          }}
          title='Volver al frente'
        >
          <RotateCcw className='w-4 h-4 md:w-5 md:h-5' />
        </button>
      )}

      {/* Main content – scrollable */}
      <div className="relative flex flex-col w-full h-full text-black/80 overflow-hidden pb-2">
        
        {/* Trip-specific back: storytelling + letter */}
        {isAlbumGroup && storytelling ? (
          <>
            {/* Trip header with stop info */}
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 text-xs font-semibold rounded-full border border-amber-200/60">
                {factTypeEmoji(storytelling.fact_type)}{' '}
                {factTypeLabel(storytelling.fact_type)}
              </span>
              {tripCtx && (
                <span className="text-[10px] text-stone-400 font-mono tracking-wider uppercase">
                  Stop {tripCtx.sequence}{tripCtx.totalStops ? ` / ${tripCtx.totalStops}` : ''}
                </span>
              )}
            </div>

            {/* Category */}
            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] md:text-xs font-medium rounded-full mb-3 tracking-wide uppercase w-fit border border-indigo-100">
              {t(item.category)}
            </span>

            {/* Did you know section — the main content */}
            <div className="bg-amber-50/50 rounded-xl p-4 md:p-5 border border-amber-100/60 mb-4">
              <p className="text-[10px] md:text-xs text-amber-700 font-bold uppercase tracking-wider mb-2">
                💡 ¿Sabías que...?
              </p>
              <p className="text-sm md:text-base text-stone-700 leading-relaxed">
                {t(storytelling.did_you_know)}
              </p>
            </div>

            {/* Description — the Walker's observation */}
            <p className="font-poetic italic text-base md:text-lg text-stone-900 leading-relaxed mb-4">
              "{t(item.description)}"
            </p>

            {/* Location + photo row */}
            <div className="mt-auto flex items-end gap-4 pt-3 border-t border-stone-200/50">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[9px] md:text-[10px] text-stone-400 uppercase tracking-wider mb-1">
                  {item.city}, {item.country}
                </p>
                <p className="font-mono text-[9px] text-stone-300">
                  {item.lat.toFixed(4)}° N, {Math.abs(item.lng).toFixed(4)}° {item.lng >= 0 ? 'E' : 'W'}
                </p>
              </div>

              {/* Small polaroid */}
              <div
                className="relative p-1 pb-4 bg-white shadow-md rounded-sm rotate-[-2deg] hover:rotate-0 transition-all hover:scale-105 z-10 group/photo cursor-pointer w-[90px] shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}&heading=${item.streetview_pov?.heading || 0}&pitch=${item.streetview_pov?.pitch || 0}&fov=${item.streetview_pov?.fov || 90}`,
                    '_blank',
                  );
                }}
              >
                <div
                  className="relative aspect-square overflow-hidden bg-stone-100 image-protected"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {polaroidUrl && (
                    <img
                      key={polaroidUrl}
                      src={polaroidUrl}
                      alt="Street View"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-white" />
                  </div>
                </div>
                <p className="absolute bottom-0.5 left-0 right-0 text-center text-[7px] text-stone-400 font-mono tracking-wider uppercase">
                  Street View
                </p>
              </div>
            </div>
          </>
        ) : (
          /* ── Original non-trip back ── */
          /* Always 2-column grid: left=story, right=stamp+coords+photo */
          <div className="grid grid-cols-[1fr_auto] w-full h-full gap-3">
            {/* LEFT: Description + Tags */}
            <div className="flex flex-col min-h-0 border-r border-black/10 pr-3">
              <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] md:text-xs font-medium rounded-full mb-2 tracking-wide uppercase w-fit">
                {t(item.category)}
              </span>

              <p className="font-poetic italic text-sm sm:text-xl md:text-2xl leading-snug text-stone-900 line-clamp-6 sm:line-clamp-none">
                "{t(item.description)}"
              </p>

              {/* Visual Tags — what the AI saw */}
              <div className="mt-auto pt-2 border-t border-stone-300/50">
                {vibeInjected && (
                  <p className="font-mono text-[8px] md:text-[9px] text-stone-400 uppercase tracking-wider mb-1.5 line-clamp-2">
                    🎨 {vibeInjected}
                  </p>
                )}
                {detailedTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {detailedTags.map((tag, idx) => {
                        const translatedTag = t(tag);
                        if (!translatedTag) return null;
                        return (
                          <span
                            key={`det-${idx}`}
                            className="inline-block px-1.5 py-0.5 bg-stone-100 text-stone-500 text-[8px] md:text-[9px] font-mono rounded-full border border-stone-200/80 tracking-wide"
                          >
                            {translatedTag.replace(/_/g, ' ')}
                          </span>
                        );
                      })}
                  </div>
                ) : (
                  <p className="font-mono text-[8px] md:text-[10px] text-stone-400">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT: Stamp + Coords + Polaroid */}
            <div className="flex flex-col items-end w-[100px] sm:w-[130px] md:w-[160px] shrink-0">
              {/* Stamp */}
              <div className="w-14 h-16 sm:w-18 sm:h-20 border border-stone-300 rounded flex bg-stone-100 items-center justify-center rotate-3 shadow-sm mb-3">
                <span className="text-[8px] sm:text-[9px] text-stone-400 font-mono tracking-widest -rotate-45 block text-center leading-tight">
                  STAMP
                  <br />
                  HERE
                </span>
              </div>

              {/* Address / Coords */}
              <div className="w-full flex flex-col gap-0 mb-3">
                <div className="w-full border-b border-black/10 pb-1 mb-1.5">
                  <span className="font-handwriting text-sm sm:text-base md:text-xl text-slate-800 block truncate">
                    {item.location_name || `${item.city}, ${item.country}`}
                  </span>
                </div>
                <div className="w-full border-b border-black/10 pb-1 mb-1.5">
                  <span className="font-mono text-[8px] md:text-[10px] text-slate-500 tracking-widest block">
                    LAT: {item.lat.toFixed(4)}° N
                  </span>
                </div>
                <div className="w-full border-b border-black/10 pb-1">
                  <span className="font-mono text-[8px] md:text-[10px] text-slate-500 tracking-widest block">
                    LNG: {Math.abs(item.lng).toFixed(4)}°{' '}
                    {item.lng >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              </div>

              {/* The "Polaroid" Snapshot */}
              <div
                className="relative p-1 pb-5 bg-white shadow-md rounded-sm rotate-[-2deg] hover:rotate-0 transition-all hover:scale-105 z-10 group/photo cursor-pointer w-full mt-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}&heading=${item.streetview_pov?.heading || 0}&pitch=${item.streetview_pov?.pitch || 0}&fov=${item.streetview_pov?.fov || 90}`,
                    '_blank',
                  );
                }}
              >
                <div
                  className="relative aspect-square overflow-hidden bg-stone-100 outline outline-1 outline-stone-200 image-protected"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {polaroidUrl && (
                    <img
                      key={polaroidUrl}
                      src={polaroidUrl}
                      alt="Original reality"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <ArrowUpRight className="w-4 h-4 text-white" />
                  </div>
                </div>
                <p className="absolute bottom-1 left-0 right-0 text-center text-[7px] text-stone-500 font-mono tracking-wider uppercase">
                  Street View
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
