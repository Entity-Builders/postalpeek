import { Star } from 'lucide-react';

const RARITY_COLORS_GRID: Record<string, string> = {
  legendary: 'from-amber-400 to-yellow-300 text-amber-900',
  epic: 'from-purple-500 to-violet-400 text-white',
  rare: 'from-sky-500 to-blue-400 text-white',
  common: 'from-stone-400 to-stone-300 text-stone-700',
};

const RARITY_COLORS_COLLECTION: Record<string, string> = {
  common: 'bg-stone-100 text-stone-500',
  rare: 'bg-blue-50 text-blue-600',
  epic: 'bg-purple-50 text-purple-600',
  legendary: 'bg-amber-50 text-amber-600',
};

interface RarityBadgeProps {
  rarity: string;
  /** 'grid' = gradient pill with star, 'collection' = text-only badge */
  variant?: 'grid' | 'collection';
}

export function RarityBadge({ rarity, variant = 'grid' }: RarityBadgeProps) {
  if (rarity === 'common' && variant === 'grid') return null;

  if (variant === 'collection') {
    if (rarity === 'common') return null;
    const color = RARITY_COLORS_COLLECTION[rarity] || RARITY_COLORS_COLLECTION.common;
    return (
      <span
        className={`absolute top-1.5 right-1.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${color}`}
      >
        {rarity}
      </span>
    );
  }

  const color = RARITY_COLORS_GRID[rarity];
  if (!color) return null;

  return (
    <div
      className={`absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r ${color} shadow-md`}
    >
      <Star className='w-2 h-2' strokeWidth={2.5} />
      {rarity.toUpperCase()}
    </div>
  );
}
