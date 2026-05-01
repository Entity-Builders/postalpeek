/**
 * ViewfinderSidebar.tsx
 *
 * Left sidebar (280px) shown in Viewfinder mode.
 * Contains: mini-map, source postcard, nearby postcards, back button.
 *
 * ref #94
 */

import React, { useMemo } from 'react';
import { ArrowLeft, MapPin, Heart } from 'lucide-react';
import type { FeedItem } from '../Postcard';
import { cdnImage } from '../../utils/imageUtils';

import { DynamicMiniMap } from './DynamicMiniMap';

interface ViewfinderSidebarProps {
  sourceItem: FeedItem;
  nearbyItems: FeedItem[];
  onBack: () => void;
  onSelectNearby: (item: FeedItem) => void;
  currentLat?: number;
  currentLng?: number;
}

export function ViewfinderSidebar({
  sourceItem,
  nearbyItems,
  onBack,
  onSelectNearby,
  currentLat,
  currentLng,
}: ViewfinderSidebarProps) {
  // Filter nearby items that aren't the source
  const otherNearby = useMemo(
    () => nearbyItems.filter((item) => item.id !== sourceItem.id).slice(0, 5),
    [nearbyItems, sourceItem.id],
  );

  return (
    <div className="w-[280px] h-full flex flex-col bg-[#0d0d14]/95 backdrop-blur-xl border-r border-white/5 overflow-hidden">
      {/* Mini Map */}
      <div className="relative w-full h-[200px] bg-[#1a1a2e] overflow-hidden">
        {currentLat && currentLng ? (
          <DynamicMiniMap 
            currentLat={currentLat} 
            currentLng={currentLng} 
            targetLat={sourceItem.lat || undefined}
            targetLng={sourceItem.lng || undefined}
            zoom={15}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <MapPin className="w-8 h-8" />
          </div>
        )}

        {/* Location label */}
        <div className="absolute bottom-2 left-2 right-2 pointer-events-none z-20">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/5">
            <p className="text-white text-xs font-medium truncate flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
              {sourceItem.location_name ||
                `${sourceItem.city}, ${sourceItem.country}`}
            </p>
          </div>
        </div>
      </div>

      {/* Source Postcard — "The Original" */}
      <div className="px-3 py-3 border-b border-white/5">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
          The Original
        </p>
        <div className="flex gap-2.5 items-center">
          <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
            {sourceItem.illustration_url && (
              <img
                src={cdnImage(sourceItem.illustration_url, { width: 96 })}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {sourceItem.city}
            </p>
            <p className="text-white/40 text-xs truncate">
              {sourceItem.country}
            </p>
          </div>
        </div>
      </div>

      {/* Nearby Postcards */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {otherNearby.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
              Nearby postcards
            </p>
            <div className="space-y-2">
              {otherNearby.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectNearby(item)}
                  className="w-full flex gap-2.5 items-center p-2 rounded-xl hover:bg-white/5 transition-colors duration-200 text-left"
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
                    {item.illustration_url && (
                      <img
                        src={cdnImage(item.illustration_url, { width: 64 })}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white/80 text-xs font-medium truncate">
                      {item.location_name || item.city}
                    </p>
                    <p className="text-white/30 text-[10px] truncate">
                      {item.country}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Back to Globe */}
      <div className="px-4 py-4 border-t border-white/5">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all duration-200 text-sm font-semibold border border-white/10 cursor-pointer md:cursor-zoom-out shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Globe
        </button>
      </div>
    </div>
  );
}
