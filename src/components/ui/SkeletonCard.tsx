import Masonry from 'react-masonry-css';
import type { CardLayout } from './cardLayout';

const SKELETON_LAYOUTS: CardLayout[] = [
  { aspectRatio: '3/4', showCaption: true },
  { aspectRatio: '1/1', showCaption: false },
  { aspectRatio: '2/3', showCaption: true },
  { aspectRatio: '4/5', showCaption: false },
  { aspectRatio: '5/4', showCaption: true },
  { aspectRatio: '3/4', showCaption: false },
  { aspectRatio: '1/1', showCaption: true },
  { aspectRatio: '2/3', showCaption: false },
  { aspectRatio: '4/5', showCaption: true },
  { aspectRatio: '3/4', showCaption: false },
  { aspectRatio: '5/4', showCaption: true },
  { aspectRatio: '2/3', showCaption: false },
];

export function SkeletonCard({ layout, index }: { layout: CardLayout; index: number }) {
  return (
    <div
      className='rounded-xl bg-stone-200 overflow-hidden animate-pulse'
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div
        className='w-full bg-gradient-to-br from-stone-200 via-stone-300/60 to-stone-200'
        style={{ aspectRatio: layout.aspectRatio }}
      />
      {layout.showCaption && (
        <div className='px-2.5 py-2 space-y-1.5'>
          <div className='h-2.5 w-3/4 rounded bg-stone-300/70' />
          <div className='h-2 w-1/2 rounded bg-stone-300/50' />
        </div>
      )}
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <>
      <style>{`
        .walker-masonry { display: flex; width: auto; gap: 8px; }
        .walker-masonry_column { display: flex; flex-direction: column; gap: 8px; }
      `}</style>
      <Masonry
        breakpointCols={{ default: 5, 1536: 5, 1280: 4, 1024: 3, 768: 2, 640: 2 }}
        className='walker-masonry'
        columnClassName='walker-masonry_column'
      >
        {SKELETON_LAYOUTS.map((layout, i) => (
          <SkeletonCard key={i} layout={layout} index={i} />
        ))}
      </Masonry>
    </>
  );
}
