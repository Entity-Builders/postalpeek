interface AlbumStopIndicatorProps {
  sequence: number;
  totalStops: number;
  stopName?: string;
  stopDescription?: string;
}

export function AlbumStopIndicator({
  sequence,
  totalStops,
  stopName,
  stopDescription,
}: AlbumStopIndicatorProps) {
  return (
    <div className='mb-1'>
      <p className='text-[10px] md:text-xs text-stone-400 font-medium tracking-wider uppercase'>
        📍 Stop {sequence}
        {totalStops ? ` of ${totalStops}` : ''}
        {stopName ? ` — ${stopName}` : ''}
      </p>
      {stopDescription && (
        <p className='text-[9px] md:text-[10px] text-stone-400/80 mt-0.5 line-clamp-1'>
          {stopDescription}
        </p>
      )}
    </div>
  );
}
