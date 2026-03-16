import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { Album } from '../hooks/useAlbums';

interface AlbumListProps {
  albums: Album[];
  isLoading: boolean;
  onOpenAlbum: (album: Album) => void;
}

function AlbumCard({
  album,
  index,
  onClick,
}: {
  album: Album;
  index: number;
  onClick: () => void;
}) {
  const coverUrl = useSignedImage(album.cover_image_url, { width: WIDTHS.thumb });
  const isComplete = album.completed_at !== null;
  const progress = album.total_slots > 0
    ? Math.round((album.collected_slots / album.total_slots) * 100)
    : 0;

  return (
    <motion.button
      className={`shrink-0 w-44 md:w-52 rounded-xl overflow-hidden text-left transition-all snap-start ${
        isComplete
          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-200/30'
          : 'shadow-md hover:shadow-lg'
      }`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
    >
      {/* Cover */}
      <div className='relative h-24 md:h-28 bg-stone-200 overflow-hidden'>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={album.title}
            className='w-full h-full object-cover'
            loading='lazy'
          />
        ) : (
          <div className='w-full h-full bg-gradient-to-br from-stone-300 to-stone-200 flex items-center justify-center'>
            <Trophy className='w-8 h-8 text-stone-400' />
          </div>
        )}

        {/* Completed badge */}
        {isComplete && (
          <div className='absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shadow-sm'>
            ✓ Completo
          </div>
        )}

        {/* Country pill */}
        {album.country && (
          <div className='absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full'>
            {album.country}
          </div>
        )}
      </div>

      {/* Info */}
      <div className='bg-white p-3'>
        <h4 className='font-serif text-xs md:text-sm text-stone-800 font-medium line-clamp-1 mb-1.5'>
          {album.title}
        </h4>

        {/* Progress bar */}
        <div className='flex items-center gap-2'>
          <div className='flex-1 bg-stone-100 rounded-full h-1.5 overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? 'bg-amber-500' : 'bg-stone-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className='text-[10px] text-stone-400 font-mono shrink-0'>
            {album.collected_slots}/{album.total_slots}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

export function AlbumList({ albums, isLoading, onOpenAlbum }: AlbumListProps) {
  if (isLoading) {
    return (
      <div className='px-4 pb-3'>
        <div className='flex gap-3 overflow-hidden'>
          {[1, 2, 3].map((i) => (
            <div key={i} className='shrink-0 w-44 md:w-52 h-36 rounded-xl bg-white/60 animate-pulse' />
          ))}
        </div>
      </div>
    );
  }

  if (albums.length === 0) return null;

  return (
    <div className='pb-4'>
      {/* Section header */}
      <div className='flex items-center justify-between px-4 mb-2'>
        <h3 className='font-serif text-sm text-stone-600 tracking-tight flex items-center gap-1.5'>
          <Trophy className='w-3.5 h-3.5 text-amber-500' />
          Álbumes
        </h3>
        <span className='text-[10px] text-stone-400'>
          {albums.filter(a => a.completed_at).length}/{albums.length} completos
        </span>
      </div>

      {/* Horizontal scroll */}
      <div className='flex gap-3 overflow-x-auto no-scrollbar px-4 snap-x snap-mandatory pb-1'>
        {albums.map((album, i) => (
          <AlbumCard
            key={album.id}
            album={album}
            index={i}
            onClick={() => onOpenAlbum(album)}
          />
        ))}
      </div>
    </div>
  );
}
