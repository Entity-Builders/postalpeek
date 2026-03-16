import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import { AlbumList } from './AlbumList';
import type { FeedItem } from './Postcard';
import type { Album } from '../hooks/useAlbums';

interface CollectionGridProps {
  collection: FeedItem[];
  isLoading: boolean;
  claimStatus: {
    daily_used: number;
    daily_limit: number;
    monthly_used: number;
    monthly_limit: number;
  };
  onClose: () => void;
  onSelectPostcard?: (item: FeedItem) => void;
  /** Albums */
  albums?: Album[];
  isLoadingAlbums?: boolean;
  onOpenAlbum?: (album: Album) => void;
}

function CollectionCard({
  item,
  index,
  onClick,
}: {
  item: FeedItem;
  index: number;
  onClick?: () => void;
}) {
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.mobile });

  const rarityColors: Record<string, string> = {
    common: 'bg-stone-100 text-stone-500',
    rare: 'bg-blue-50 text-blue-600',
    epic: 'bg-purple-50 text-purple-600',
    legendary: 'bg-amber-50 text-amber-600',
  };

  return (
    <motion.div
      className="relative group cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
    >
      <div className="bg-white p-1.5 pb-3 rounded-sm shadow-md hover:shadow-lg transition-shadow hover:-translate-y-0.5 transition-transform">
        <div className="aspect-[3/4] overflow-hidden rounded-[2px] bg-stone-100 relative">
          {imgUrl && (
            <img
              src={imgUrl}
              alt={item.category}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          )}

          {/* Rarity badge */}
          {item.rarity && item.rarity !== 'common' && (
            <span
              className={`absolute top-1.5 right-1.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${rarityColors[item.rarity] || rarityColors.common}`}
            >
              {item.rarity}
            </span>
          )}
        </div>

        {/* Label */}
        <p className="text-center font-handwriting text-[9px] sm:text-[10px] text-stone-500 mt-1 truncate px-0.5">
          {item.city}
        </p>
      </div>
    </motion.div>
  );
}

export function CollectionGrid({
  collection,
  isLoading,
  claimStatus,
  onClose,
  onSelectPostcard,
  albums = [],
  isLoadingAlbums = false,
  onOpenAlbum,
}: CollectionGridProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[150] bg-[#e6e2da] overflow-hidden flex flex-col"
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/60 hover:bg-white/80 text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h2 className="font-serif text-lg text-stone-800 tracking-tight">
          Mi Colección
        </h2>

        {/* Claim counter */}
        <div className="text-right">
          <span className="text-xs text-stone-400 font-mono">
            {claimStatus.daily_used}/{claimStatus.daily_limit} hoy
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="shrink-0 px-4 pb-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white/60 px-3 py-1.5 rounded-full">
          <Package className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs text-stone-600 font-medium">
            {collection.length} postales
          </span>
        </div>
        <div className="flex-1 bg-stone-300/30 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-stone-500 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((claimStatus.daily_used / claimStatus.daily_limit) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pb-8">
        {/* Albums section */}
        {(albums.length > 0 || isLoadingAlbums) && (
          <div className='pt-2'>
            <AlbumList
              albums={albums}
              isLoading={isLoadingAlbums}
              onOpenAlbum={(a) => onOpenAlbum?.(a)}
            />
          </div>
        )}

        {/* Postcards grid */}
        <div className='px-4'>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          </div>
        ) : collection.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            <span className="text-5xl mb-4">🃏</span>
            <h3 className="font-serif text-lg text-stone-700 mb-2">
              Tu colección está vacía
            </h3>
            <p className="text-sm text-stone-400 max-w-xs">
              ¡Empezá a reclamar postales del feed de Walker para llenar tu álbum!
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-5 py-2 rounded-full bg-stone-800 text-white text-sm font-medium hover:bg-stone-900 transition-colors"
            >
              Explorar postales
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {collection.map((item, i) => (
              <CollectionCard
                key={item.id}
                item={item}
                index={i}
                onClick={() => onSelectPostcard?.(item)}
              />
            ))}
          </div>
        )}
        </div>
      </div>
    </motion.div>
  );
}
