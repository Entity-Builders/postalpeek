import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, MapPin, Tag, LayoutGrid } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { FeedItem } from './Postcard';
import type { SmartAlbum } from '../hooks/useSmartAlbums';

interface SmartAlbumDetailProps {
  album: SmartAlbum;
  collection: FeedItem[];
  isLoading: boolean;
  onClose: () => void;
  onSelectPostcard?: (item: FeedItem) => void;
}

function GridCard({
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
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
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

          {item.rarity && item.rarity !== 'common' && (
            <span
              className={`absolute top-1.5 right-1.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${rarityColors[item.rarity] || rarityColors.common}`}
            >
              {item.rarity}
            </span>
          )}
        </div>

        <p className="text-center font-handwriting text-[9px] sm:text-[10px] text-stone-500 mt-1 truncate px-0.5">
          {item.city}
        </p>
      </div>
    </motion.div>
  );
}

const TYPE_ICONS = {
  country: MapPin,
  category: LayoutGrid,
  tag: Tag,
};

export function SmartAlbumDetail({ album, collection, isLoading, onClose, onSelectPostcard }: SmartAlbumDetailProps) {
  // Filter collection locally based on smart album rules
  const matchingItems = useMemo(() => {
    if (!album.filter_value) return [];
    
    return collection.filter(item => {
      const target = album.filter_value!.toLowerCase();
      switch (album.album_type) {
        case 'country':
          return item.country?.toLowerCase() === target;
        case 'category':
          return item.category?.toLowerCase() === target;
        case 'tag':
          return item.visual_tags?.some(tag => tag.toLowerCase() === target);
        default:
          return false;
      }
    });
  }, [collection, album]);

  const albumTypeKey = album.album_type as keyof typeof TYPE_ICONS;
  const Icon = albumTypeKey && TYPE_ICONS[albumTypeKey] ? TYPE_ICONS[albumTypeKey] : Sparkles;

  return (
    <motion.div
      className='fixed inset-0 z-[160] bg-[#e6e2da] overflow-hidden flex flex-col'
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className='shrink-0 px-4 pt-4 pb-2'>
        <div className='flex items-center justify-between mb-3'>
          <button
            onClick={onClose}
            className='p-2 rounded-full bg-white/60 hover:bg-white/80 text-stone-500 hover:text-stone-700 transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
          </button>

          <span className='flex items-center gap-1 bg-sky-100 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full'>
            <Icon className='w-3.5 h-3.5' />
            Smart Album
          </span>
        </div>

        <h2 className='font-serif text-2xl text-stone-800 tracking-tight flex items-center gap-2'>
          {album.title}
        </h2>
        
        <div className='mt-3 bg-white/50 border border-stone-200/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between'>
           <p className='text-xs text-stone-600 font-medium'>
             Filtro automático: <span className="text-stone-800 font-bold capitalize">{album.filter_value}</span>
           </p>
           <span className='text-xs text-stone-500 font-mono'>
             {matchingItems.length} postales
           </span>
        </div>
      </div>

      {/* Grid */}
      <div className='flex-1 overflow-y-auto px-4 pb-8 pt-3'>
        {isLoading ? (
          <div className='flex items-center justify-center h-40'>
            <div className='w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin' />
          </div>
        ) : matchingItems.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-64 text-center'>
            <span className='text-5xl mb-4'>📭</span>
            <p className='text-stone-500 font-medium'>No hay postales aquí</p>
            <p className='text-xs text-stone-400 mt-1 max-w-[200px]'>Sigue abriendo sobres para encontrar más.</p>
          </div>
        ) : (
          <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3'>
            {matchingItems.map((item, i) => (
              <GridCard 
                key={item.id} 
                item={item} 
                index={i} 
                onClick={() => onSelectPostcard?.(item)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
