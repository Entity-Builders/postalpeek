import React, { useEffect, useState } from 'react';
import { ArrowUpRight, RotateCcw, MapPin, BookOpen, Camera, Loader2 } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import type { FeedItem } from './Postcard';
import { t, useLang, type BilingualText } from '../utils/i18n';
import { PostalPeekStampSVG } from './ui/PostalPeekStampSVG';

interface PostcardBackProps {
  item: FeedItem;
  polaroidUrl: string;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onFlipBack?: () => void;
  isActive?: boolean;
  isGridMode?: boolean;
  isClaimedByMe?: boolean;
  onClaimPostcard?: (postcardId: string, rarity: 'common' | 'rare' | 'epic' | 'legendary') => void;
  isClaimLoading?: boolean;
}

export function PostcardBack({
  item,
  polaroidUrl,
  handleImageError,
  onFlipBack,
  isActive = false,
  isGridMode = false,
  isClaimedByMe = false,
  onClaimPostcard,
  isClaimLoading = false,
}: PostcardBackProps) {
  const [viewMode, setViewMode] = useState<'main' | 'photo'>('main');
  
  // Conditionally fetch polaroid if user requests it in grid mode
  const fetchedPolaroidUrl = useSignedImage(
    viewMode === 'photo' && !polaroidUrl ? item.original_image_url : ''
  );
  const actualPolaroidUrl = polaroidUrl || fetchedPolaroidUrl;

  useLang(); // subscribe — triggers re-render on language change
  const detailedTags: (BilingualText | string)[] = item.detailed_tags || [];
  const vibeInjected: string = item.generation_metadata?.vibe_injected || '';

  // Debug log — fires once when this card becomes the active one
  useEffect(() => {
    if (!isActive) return;
    console.log('[PostalPeek Debug]', item.id, {
      description_raw: item.description,
      description_type: typeof item.description,
      description_t: t(item.description),
      visual_tags: item.visual_tags,
      generation_metadata: item.generation_metadata,
      streetview_pov: item.streetview_pov,
      ...item,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, item.id]);

  return (
    <div
      className={`absolute inset-0 w-full h-full bg-[#fdfbf7] rounded-sm md:rounded-md shadow-2xl border border-[rgba(0,0,0,0.05)] ${
        isGridMode ? 'p-3' : 'p-4 md:p-8'
      }`}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg) translateZ(1px)',
        WebkitTransform: 'rotateY(180deg) translateZ(1px)',
      }}
    >
      {/* Subtle paper texture overlay */}
      <div
        className='absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply'
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
      <div className={`relative flex flex-col w-full h-full text-black/80 pb-2 ${isGridMode ? 'overflow-y-auto overflow-x-hidden pr-1.5' : 'overflow-hidden'}`}>
        {isGridMode ? (
          /* ── NEW DUAL-STATE CURRENT GRID MODE ── */
          viewMode === 'photo' ? (
            <div className="flex flex-col w-full h-full pt-1">
              <div className="flex justify-between items-center mb-2 border-b border-black/10 pb-2">
                <span className="inline-block px-2 py-0.5 bg-stone-100 text-stone-700 text-[10px] font-bold rounded-full uppercase tracking-widest">
                  Polaroid Original
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setViewMode('main'); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-stone-500 hover:text-stone-800 uppercase tracking-widest transition-colors bg-stone-100 px-2 py-1 rounded-full border border-stone-200"
                >
                  <BookOpen className="w-3 h-3" />
                  Volver
                </button>
              </div>
              
              <div className="flex-1 relative rounded-md overflow-hidden bg-stone-200 border border-black/10 pointer-events-none">
                {actualPolaroidUrl ? (
                  <img
                    src={actualPolaroidUrl}
                    alt="Original polaroid"
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-stone-500 tracking-widest animate-pulse">
                    Revelando...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col w-full h-full pt-1">
              {/* Header: Location & Stamp */}
              <div className="flex items-start justify-between mb-3 border-b border-black/10 pb-3 shrink-0">
                <div className="flex-1 pr-2">
                  <h3 className="font-handwriting text-lg text-slate-800 leading-tight mb-1 truncate">
                    {item.location_name || item.city}
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest line-clamp-1">
                      {item.city}, {item.country}
                    </span>
                    <span className="font-mono text-[8px] text-stone-400">
                      {item.lat.toFixed(4)}° N, {Math.abs(item.lng).toFixed(4)}° {item.lng >= 0 ? 'E' : 'W'}
                    </span>
                  </div>
                </div>
                
                <button 
                  className={`w-10 h-12 border rounded flex items-center justify-center rotate-3 shadow-sm shrink-0 transition-colors ${
                    isClaimedByMe 
                      ? 'border-amber-200 bg-amber-50' 
                      : 'border-stone-300 bg-stone-100 hover:bg-stone-200 cursor-pointer'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isClaimedByMe && onClaimPostcard && !isClaimLoading) {
                      onClaimPostcard(item.id, item.rarity || 'common');
                    }
                  }}
                  disabled={isClaimedByMe || isClaimLoading}
                >
                  {isClaimLoading ? (
                    <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                  ) : isClaimedByMe ? (
                    <PostalPeekStampSVG className="w-8 h-8 text-amber-600 opacity-90" />
                  ) : (
                    <span className="text-[6px] text-stone-400 font-mono tracking-widest -rotate-45 block text-center leading-[1.1]">
                      STAMP<br/>HERE
                    </span>
                  )}
                </button>
              </div>

              {/* Scrollable Main Content */}
              <div className="flex-1 overflow-y-auto pr-1 pb-2 flex flex-col gap-4">
                {/* Description Element */}
                <div>
                  <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-widest mb-2">
                    {t(item.category)}
                  </span>
                  <p className="font-poetic italic text-sm text-stone-900 leading-relaxed">
                    "{t(item.description)}"
                  </p>
                </div>
                
                {/* Did You Know Fact (If any) */}
                {item.generation_metadata?.storytelling && (
                   <div className='bg-amber-50/50 rounded-xl p-3 border border-amber-100/60 shrink-0'>
                     <p className='text-[9px] text-amber-700 font-bold uppercase tracking-wider mb-1.5'>
                       💡 ¿Sabías que...?
                     </p>
                     <p className='text-xs text-stone-700 leading-relaxed'>
                       {t(item.generation_metadata.storytelling.did_you_know)}
                     </p>
                   </div>
                )}

                {/* Vibe Stats */}
                {item.generation_metadata?.stats && (
                  <div className="shrink-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-2 text-center border-b border-black/5 pb-1">
                      Radar de Vibes
                    </p>
                    <div className="flex flex-col gap-2 px-1">
                      {[
                        { label: 'Nature', value: item.generation_metadata.stats.nature, color: 'bg-emerald-500', icon: '🌿' },
                        { label: 'History', value: item.generation_metadata.stats.history, color: 'bg-amber-500', icon: '🏛️' },
                        { label: 'Urban', value: item.generation_metadata.stats.urban, color: 'bg-stone-500', icon: '🏗️' },
                        { label: 'Vibe', value: item.generation_metadata.stats.vibe, color: 'bg-purple-500', icon: '✨' },
                      ].map((stat) => (
                        <div key={stat.label} className="flex items-center gap-2">
                          <span className="text-[10px] w-4 text-center">{stat.icon}</span>
                          <span className="text-[8px] font-mono text-stone-500 uppercase tracking-widest leading-none w-12">{stat.label}</span>
                          <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                            <div className={`h-full ${stat.color} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, stat.value))}%` }} />
                          </div>
                          <span className="text-[9px] font-mono font-semibold text-stone-700 w-5 text-right">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vibe Injected Prompt */}
                {vibeInjected && (
                  <div className="pt-2 border-t border-black/5 mt-auto">
                     <p className='font-mono text-[9px] text-stone-400 uppercase tracking-wider line-clamp-1'>
                      🎨 {vibeInjected}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-2 flex gap-1.5 pt-2 pr-1 shrink-0 border-t border-black/5">
                <button
                  onClick={(e) => { e.stopPropagation(); setViewMode('photo'); }}
                  className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-sm bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200 hover:text-stone-800 transition-colors"
                  aria-label="Ver foto original"
                  title="Foto Original"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}&heading=${item.streetview_pov?.heading || 0}&pitch=${item.streetview_pov?.pitch || 0}&fov=${item.streetview_pov?.fov || 90}`,
                      '_blank'
                    );
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-sm bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200 hover:text-stone-800 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest">Street View</span>
                </button>
              </div>
            </div>
          )
        ) : (
          /* ── Original non-trip back ── */
          /* Always 2-column grid: left=story, right=stamp+coords+photo */
          <div className={isGridMode ? 'flex flex-col w-full gap-3' : 'grid grid-cols-[1fr_auto] w-full h-full gap-3'}>
            {/* LEFT: Description + Tags */}
            <div className={`flex flex-col min-h-0 ${isGridMode ? 'border-b pb-3 mb-1' : 'border-r pr-3'} border-black/10`}>
              <span className='inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] md:text-xs font-medium rounded-full mb-2 tracking-wide uppercase w-fit shrink-0'>
                {t(item.category)}
              </span>

              <p className={`font-poetic italic leading-snug text-stone-900 ${isGridMode ? 'text-sm line-clamp-4' : 'text-sm sm:text-xl md:text-2xl line-clamp-6 sm:line-clamp-none'} mb-4 shrink-0`}>
                "{t(item.description)}"
              </p>

              {/* Additional Storytelling Fact (if any) */}
              {item.generation_metadata?.storytelling && (
                <div className='bg-amber-50/50 rounded-xl p-3 md:p-4 border border-amber-100/60 mb-4 shrink-0 max-h-[140px] overflow-y-auto'>
                  <p className='text-[9px] md:text-xs text-amber-700 font-bold uppercase tracking-wider mb-2'>
                    💡 ¿Sabías que...?
                  </p>
                  <p className='text-xs md:text-sm text-stone-700 leading-relaxed'>
                    {t(item.generation_metadata.storytelling.did_you_know)}
                  </p>
                </div>
              )}

              {/* Vibe Stats (TCG style) */}
              {item.generation_metadata?.stats && (
                <div className='grid grid-cols-2 gap-x-4 gap-y-2 mt-auto mb-3 max-w-[200px]'>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px]">🌿</span>
                      <span className="text-[8px] font-mono text-stone-500 uppercase tracking-widest leading-none">Nature</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden w-16">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, item.generation_metadata.stats.nature))}%` }} />
                      </div>
                      <span className="text-[9px] font-mono font-semibold text-stone-700 w-4 text-right">{item.generation_metadata.stats.nature}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px]">🏛️</span>
                      <span className="text-[8px] font-mono text-stone-500 uppercase tracking-widest leading-none">History</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden w-16">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, item.generation_metadata.stats.history))}%` }} />
                      </div>
                      <span className="text-[9px] font-mono font-semibold text-stone-700 w-4 text-right">{item.generation_metadata.stats.history}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px]">🏗️</span>
                      <span className="text-[8px] font-mono text-stone-500 uppercase tracking-widest leading-none">Urban</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden w-16">
                        <div className="h-full bg-stone-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, item.generation_metadata.stats.urban))}%` }} />
                      </div>
                      <span className="text-[9px] font-mono font-semibold text-stone-700 w-4 text-right">{item.generation_metadata.stats.urban}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px]">✨</span>
                      <span className="text-[8px] font-mono text-stone-500 uppercase tracking-widest leading-none">Vibe</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden w-16">
                        <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, item.generation_metadata.stats.vibe))}%` }} />
                      </div>
                      <span className="text-[9px] font-mono font-semibold text-stone-700 w-4 text-right">{item.generation_metadata.stats.vibe}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Tags — what the AI saw */}
              <div className={`${!item.generation_metadata?.stats ? 'mt-auto' : ''} pt-2 border-t border-stone-300/50`}>
                {vibeInjected && (
                  <p className='font-mono text-[8px] md:text-[9px] text-stone-400 uppercase tracking-wider mb-1.5 line-clamp-2'>
                    🎨 {vibeInjected}
                  </p>
                )}
                {detailedTags.length > 0 ? (
                  <div className='flex flex-wrap gap-1'>
                    {detailedTags.map((tag, idx) => {
                      const translatedTag = t(tag);
                      if (!translatedTag) return null;
                      return (
                        <span
                          key={`det-${idx}`}
                          className='inline-block px-1.5 py-0.5 bg-stone-100 text-stone-500 text-[8px] md:text-[9px] font-mono rounded-full border border-stone-200/80 tracking-wide'
                        >
                          {translatedTag.replace(/_/g, ' ')}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className='font-mono text-[8px] md:text-[10px] text-stone-400'>
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT: Stamp + Coords + Polaroid */}
            <div className={`flex flex-col ${isGridMode ? 'items-start w-full' : 'items-end w-[100px] sm:w-[130px] md:w-[160px]'} shrink-0`}>
              {/* Stamp */}
              <button 
                className={`w-14 h-16 sm:w-18 sm:h-20 border rounded flex items-center justify-center rotate-3 shadow-sm mb-3 transition-colors ${
                  isClaimedByMe 
                    ? 'border-amber-200 bg-amber-50' 
                    : 'border-stone-300 bg-stone-100 hover:bg-stone-200 cursor-pointer'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isClaimedByMe && onClaimPostcard && !isClaimLoading) {
                    onClaimPostcard(item.id, item.rarity || 'common');
                  }
                }}
                disabled={isClaimedByMe || isClaimLoading}
              >
                {isClaimLoading ? (
                  <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
                ) : isClaimedByMe ? (
                  <PostalPeekStampSVG className="w-12 h-12 sm:w-16 sm:h-16 text-amber-600 opacity-90" />
                ) : (
                  <span className='text-[8px] sm:text-[9px] text-stone-400 font-mono tracking-widest -rotate-45 block text-center leading-tight'>
                    STAMP
                    <br />
                    HERE
                  </span>
                )}
              </button>

              {/* Address / Coords */}
              <div className='w-full flex flex-col gap-0 mb-3'>
                <div className='w-full border-b border-black/10 pb-1 mb-1.5'>
                  <span className='font-handwriting text-sm sm:text-base md:text-xl text-slate-800 block truncate'>
                    {item.location_name || `${item.city}, ${item.country}`}
                  </span>
                </div>
                <div className='w-full border-b border-black/10 pb-1 mb-1.5'>
                  <span className='font-mono text-[8px] md:text-[10px] text-slate-500 tracking-widest block'>
                    LAT: {item.lat.toFixed(4)}° N
                  </span>
                </div>
                <div className='w-full border-b border-black/10 pb-1'>
                  <span className='font-mono text-[8px] md:text-[10px] text-slate-500 tracking-widest block'>
                    LNG: {Math.abs(item.lng).toFixed(4)}°{' '}
                    {item.lng >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              </div>

              {/* The "Polaroid" Snapshot */}
              <div
                className='relative p-1 pb-5 bg-white shadow-md rounded-sm rotate-[-2deg] hover:rotate-0 transition-all hover:scale-105 z-10 group/photo cursor-pointer w-full mt-auto'
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}&heading=${item.streetview_pov?.heading || 0}&pitch=${item.streetview_pov?.pitch || 0}&fov=${item.streetview_pov?.fov || 90}`,
                    '_blank',
                  );
                }}
              >
                <div
                  className='relative aspect-square overflow-hidden bg-stone-100 outline outline-1 outline-stone-200 image-protected'
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {polaroidUrl && (
                    <img
                      key={polaroidUrl}
                      src={polaroidUrl}
                      alt='Original reality'
                      loading='lazy'
                      decoding='async'
                      draggable={false}
                      className='w-full h-full object-cover'
                      onError={handleImageError}
                    />
                  )}
                  <div className='absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]'>
                    <ArrowUpRight className='w-4 h-4 text-white' />
                  </div>
                </div>
                <p className='absolute bottom-1 left-0 right-0 text-center text-[7px] text-stone-500 font-mono tracking-wider uppercase'>
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
