import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, MapPin, Library } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { Album } from '../hooks/useAlbums';

interface AlbumsModalProps {
  albums: Album[];
  isLoading: boolean;
  onClose: () => void;
  onSelectAlbum: (album: Album) => void;
}

const DIFFICULTY_CONFIG: Record<Album['difficulty'], { label: string; color: string; icon: string }> = {
  easy:   { label: 'Fácil',   color: 'bg-emerald-500/80', icon: '🌿' },
  medium: { label: 'Media',   color: 'bg-yellow-500/80',  icon: '⭐' },
  hard:   { label: 'Difícil', color: 'bg-orange-500/80',  icon: '🔥' },
  epic:   { label: 'Épica',   color: 'bg-purple-500/80',  icon: '💎' },
};

function AlbumGridCard({
  album,
  index,
  onClick,
}: {
  album: Album;
  index: number;
  onClick: () => void;
}) {
  const coverUrl = useSignedImage(album.cover_image_url, { width: WIDTHS.mobile });
  const isComplete = album.completed_at !== null;
  const progress = album.total_slots > 0
    ? Math.round((album.collected_slots / album.total_slots) * 100)
    : 0;

  return (
    <motion.button
      className={`relative w-full aspect-[4/5] sm:aspect-square md:aspect-[4/3] rounded-xl overflow-hidden text-left transition-all ${
        isComplete
          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20'
          : 'shadow-md hover:shadow-xl hover:scale-[1.02]'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      onClick={onClick}
    >
      <div className='relative w-full h-full bg-stone-800 overflow-hidden'>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={album.title}
            className='w-full h-full object-cover'
            loading='lazy'
          />
        ) : (
          <div className='w-full h-full bg-gradient-to-br from-amber-600/30 via-stone-700 to-stone-900 flex items-center justify-center'>
            <Trophy className='w-12 h-12 text-amber-500/40' />
          </div>
        )}

        {/* Dark gradient overlay for text readability */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent' />

        {/* Completed badge */}
        {isComplete && (
          <div className='absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shadow-sm'>
            ✓ Completo
          </div>
        )}

        {/* Difficulty + Country pills */}
        <div className='absolute top-2 left-2 flex items-center gap-1.5 flex-wrap pr-16'>
          {album.difficulty && album.difficulty !== 'easy' && (
            <div className={`${DIFFICULTY_CONFIG[album.difficulty].color} backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm`}>
              <span>{DIFFICULTY_CONFIG[album.difficulty].icon}</span>
              {DIFFICULTY_CONFIG[album.difficulty].label}
            </div>
          )}
          {album.country && (
            <div className='bg-white/20 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm'>
              <MapPin className='w-2.5 h-2.5' />
              {album.country}
            </div>
          )}
        </div>

        {/* Title + progress overlaid on image */}
        <div className='absolute bottom-0 left-0 right-0 p-3 sm:p-4'>
          <h4 className='font-display text-base md:text-lg text-white font-semibold line-clamp-2 mb-2 drop-shadow-md'>
            {album.title}
          </h4>
          <div className='flex items-center gap-2'>
            <div className='flex-1 bg-white/20 rounded-full h-1.5 overflow-hidden backdrop-blur-sm'>
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete ? 'bg-amber-400' : 'bg-white/80'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className='text-[10px] sm:text-xs text-white/90 font-mono shrink-0 font-medium tracking-wide'>
              {album.collected_slots}/{album.total_slots}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function AlbumsModal({
  albums,
  isLoading,
  onClose,
  onSelectAlbum,
}: AlbumsModalProps) {
  const completedCount = albums.filter(a => a.completed_at).length;

  return (
    <motion.div
      className="fixed inset-0 z-[150] bg-[#e6e2da] overflow-hidden flex flex-col"
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-4 flex items-center justify-between bg-stone-200/50 backdrop-blur-sm border-b border-stone-300/50">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/60 hover:bg-white/80 text-stone-500 hover:text-stone-700 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h2 className="font-serif text-xl text-stone-800 tracking-tight flex items-center gap-2">
          <Library className="w-5 h-5 text-indigo-600 opacity-80" />
          Álbumes
        </h2>

        <div className="text-right min-w-[3rem]">
          <span className="text-xs text-stone-500 font-mono font-medium">
            {completedCount}/{albums.length} <span className="hidden sm:inline">completos</span>
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-12 px-4 pt-6 scroll-smooth">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className='w-full aspect-[4/5] sm:aspect-square md:aspect-[4/3] rounded-xl bg-black/5 animate-pulse' />
            ))}
          </div>
        ) : albums.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {albums.map((album, i) => (
              <AlbumGridCard
                key={album.id}
                album={album}
                index={i}
                onClick={() => onSelectAlbum(album)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <Library className="w-16 h-16 text-stone-300 mb-4" />
            <h3 className="font-serif text-xl text-stone-700 mb-2">
              No hay álbumes disponibles
            </h3>
            <p className="text-sm text-stone-500 max-w-xs">
              Sigue coleccionando postales para descubrir nuevos álbumes.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
