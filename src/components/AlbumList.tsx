import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, MapPin } from 'lucide-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { Album } from '../hooks/useAlbums';
import { useLang, t } from '../utils/i18n';

interface AlbumListProps {
  albums: Album[];
  isLoading: boolean;
  onOpenAlbum: (album: Album) => void;
}

const DIFFICULTY_CONFIG: Record<
  Album['difficulty'],
  { label: { es: string; en: string }; color: string; icon: string }
> = {
  easy: { label: { es: 'Fácil', en: 'Easy' }, color: 'bg-emerald-500/80', icon: '🌿' },
  medium: { label: { es: 'Media', en: 'Medium' }, color: 'bg-yellow-500/80', icon: '⚡' },
  hard: { label: { es: 'Difícil', en: 'Hard' }, color: 'bg-orange-500/80', icon: '🔥' },
  epic: { label: { es: 'Épica', en: 'Epic' }, color: 'bg-purple-500/80', icon: '💎' },
};

function AlbumCard({
  album,
  index,
  onClick,
}: {
  album: Album;
  index: number;
  onClick: () => void;
}) {
  const lang = useLang();
  const coverUrl = useSignedImage(album.cover_image_url, {
    width: WIDTHS.albumCard,
  });
  const isComplete = album.completed_at !== null;
  const progress =
    album.total_slots > 0
      ? Math.round((album.collected_slots / album.total_slots) * 100)
      : 0;

  return (
    <motion.button
      className={`shrink-0 w-48 md:w-56 rounded-xl overflow-hidden text-left transition-all snap-start ${
        isComplete
          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20'
          : 'shadow-md hover:shadow-xl hover:scale-[1.02]'
      }`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
    >
      {/* Cover image with overlay */}
      <div className='relative h-36 md:h-44 bg-stone-800 overflow-hidden'>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={typeof album.title === 'string' ? album.title : t(album.title, lang)}
            className='w-full h-full object-cover'
            loading='lazy'
          />
        ) : (
          <div className='w-full h-full bg-gradient-to-br from-amber-600/30 via-stone-700 to-stone-900 flex items-center justify-center'>
            <Trophy className='w-10 h-10 text-amber-500/40' />
          </div>
        )}

        {/* Dark gradient overlay for text readability */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent' />

        {/* Completed badge */}
        {isComplete && (
          <div className='absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shadow-sm'>
            {t({ es: '✓ Completo', en: '✓ Complete' }, lang)}
          </div>
        )}

        {/* Difficulty + Country pills */}
        <div className='absolute top-2 left-2 flex items-center gap-1.5'>
          {album.difficulty && album.difficulty !== 'easy' && (
            <div
              className={`${DIFFICULTY_CONFIG[album.difficulty].color} backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm`}
            >
              <span>{DIFFICULTY_CONFIG[album.difficulty].icon}</span>
              {t(DIFFICULTY_CONFIG[album.difficulty].label, lang)}
            </div>
          )}
          {album.country && (
            <div className='bg-white/20 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1'>
              <MapPin className='w-2.5 h-2.5' />
              {album.country}
            </div>
          )}
        </div>

        {/* Title + progress overlaid on image */}
        <div className='absolute bottom-0 left-0 right-0 p-3'>
          <h4 className='font-display text-sm md:text-base text-white font-semibold line-clamp-1 mb-2 drop-shadow-md'>
            {t(album.title, lang)}
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
            <span className='text-[10px] text-white/80 font-mono shrink-0'>
              {album.collected_slots}/{album.total_slots}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function AlbumList({ albums, isLoading, onOpenAlbum }: AlbumListProps) {
  const lang = useLang();
  if (isLoading) {
    return (
      <div className='px-4 pb-3'>
        <div className='flex gap-3 overflow-hidden'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='shrink-0 w-48 md:w-56 h-40 rounded-xl bg-white/5 animate-pulse'
            />
          ))}
        </div>
      </div>
    );
  }

  if (albums.length === 0) return null;

  return (
    <div className='pb-4'>
      {/* Section header */}
      <div className='flex items-center justify-between px-4 mb-3'>
        <span className='text-[10px] text-white/40'>
          {t({
            es: `${albums.filter((a) => a.completed_at).length}/${albums.length} completos`,
            en: `${albums.filter((a) => a.completed_at).length}/${albums.length} complete`
          }, lang)}
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
