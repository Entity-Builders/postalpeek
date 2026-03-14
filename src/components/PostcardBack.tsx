import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { FeedItem } from './Postcard';

interface PostcardBackProps {
  item: FeedItem;
  polaroidUrl: string;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export function PostcardBack({
  item,
  polaroidUrl,
  handleImageError,
}: PostcardBackProps) {
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

      {/* Main content – scrollable on mobile */}
      <div className="relative flex flex-col sm:flex-row w-full h-full text-black/80 gap-4 sm:gap-6 overflow-y-auto pb-2">
        {/* ── Top on mobile / Right on desktop: Stamp, Address & Photo ── */}
        <div className="w-full sm:w-[40%] flex flex-col relative sm:shrink-0 order-last sm:order-last">
          {/* Stamp */}
          <div className="w-16 h-20 sm:w-20 sm:h-24 border border-stone-300 rounded flex bg-stone-100 items-center justify-center rotate-3 shadow-sm self-end mb-4 sm:mb-8">
            <span className="text-[9px] sm:text-[10px] text-stone-400 font-mono tracking-widest -rotate-45 block">
              STAMP
              <br />
              HERE
            </span>
          </div>

          {/* Address Lines – normal flow (no absolute positioning) */}
          <div className="w-full flex flex-col gap-0 mb-4 sm:mb-8">
            <div className="w-full border-b border-black/10 pb-1 mb-3 sm:mb-5">
              <span className="font-handwriting text-lg sm:text-xl md:text-3xl text-slate-800 rotate-[-1deg] block truncate">
                {item.location_name || `${item.city}, ${item.country}`}
              </span>
            </div>
            <div className="w-full border-b border-black/10 pb-1 mb-3 sm:mb-5">
              <span className="font-mono text-[10px] md:text-xs text-slate-500 tracking-widest block">
                LAT: {item.lat.toFixed(6)}° N
              </span>
            </div>
            <div className="w-full border-b border-black/10 pb-1">
              <span className="font-mono text-[10px] md:text-xs text-slate-500 tracking-widest block">
                LNG: {Math.abs(item.lng).toFixed(6)}°{' '}
                {item.lng >= 0 ? 'E' : 'W'}
              </span>
            </div>
          </div>

          {/* The "Polaroid" Snapshot */}
          <div
            className="relative p-1.5 pb-6 bg-white shadow-md rounded-sm rotate-[-2deg] hover:rotate-0 transition-all hover:scale-105 z-10 group/photo cursor-pointer w-[65%] sm:w-[80%] self-center sm:mt-auto"
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
                <span className="flex items-center gap-1.5 text-white text-xs font-semibold tracking-wide bg-black/60 px-3 py-1.5 rounded-full">
                  Inspect <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
            <p className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-stone-500 font-mono tracking-wider uppercase">
              Source Image
            </p>
          </div>
        </div>

        {/* ── Bottom on mobile / Left on desktop: The Story ── */}
        <div className="flex-1 flex flex-col pt-2 sm:border-r border-black/10 sm:pr-6 order-first sm:order-first min-h-0">
          <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] md:text-sm font-medium rounded-full mb-3 md:mb-6 tracking-wide uppercase w-fit">
            {item.category}
          </span>

          <p className="font-handwriting text-lg sm:text-2xl md:text-3xl leading-relaxed text-slate-800 whitespace-pre-wrap">
            "{item.description}"
          </p>

          <div className="mt-auto border-t border-stone-300/50 pt-3 sm:pt-4 flex flex-col gap-1.5 sm:gap-2 font-mono text-[9px] md:text-xs text-stone-400">
            <p>
              Generation Strategy:{' '}
              <span className="text-stone-600 font-semibold">
                {item.generation_metadata?.strategy || 'Random Exploration'}
              </span>
            </p>
            <p>
              Photographic Lens:{' '}
              <span className="text-stone-600 font-semibold">
                {item.streetview_pov?.lens || 'Standard 90° FOV'}
              </span>
            </p>
            <p>Date: {new Date(item.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
