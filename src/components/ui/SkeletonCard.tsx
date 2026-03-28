import type { CardLayout } from './cardLayout';

const SKELETON_LAYOUTS: CardLayout[] = [
  { aspectRatio: '3/4' },
  { aspectRatio: '1/1' },
  { aspectRatio: '2/3' },
  { aspectRatio: '4/5' },
  { aspectRatio: '5/4' },
  { aspectRatio: '3/4' },
  { aspectRatio: '1/1' },
  { aspectRatio: '2/3' },
  { aspectRatio: '4/5' },
  { aspectRatio: '3/4' },
  { aspectRatio: '5/4' },
  { aspectRatio: '2/3' },
];

export function SkeletonCard({ layout, index }: { layout: CardLayout; index: number }) {
  return (
    <div
      className='rounded-lg bg-white overflow-hidden animate-pulse shadow-[0_2px_12px_rgba(0,0,0,0.10)]'
      style={{ animationDelay: `${index * 80}ms`, padding: '5px 5px 0 5px' }}
    >
      <div
        className='w-full rounded-sm bg-gradient-to-br from-stone-200 via-stone-300/60 to-stone-200'
        style={{ aspectRatio: layout.aspectRatio }}
      />
      {/* Postcard chin skeleton */}
      <div className='px-1.5 py-2 flex items-center gap-2'>
        <div className='h-2 w-2/3 rounded bg-stone-300/50' />
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="walker-columns">
      {SKELETON_LAYOUTS.map((layout, i) => (
        <SkeletonCard key={i} layout={layout} index={i} />
      ))}
    </div>
  );
}
