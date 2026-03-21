import React, { useState, useEffect } from 'react';

interface AmbientBackgroundProps {
  imageUrl: string | null;
}

export function AmbientBackground({ imageUrl }: AmbientBackgroundProps) {
  const [shownUrl, setShownUrl] = useState<string | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);

  useEffect(() => {
    if (imageUrl && imageUrl !== shownUrl) {
      setPrevUrl(shownUrl);
      setShownUrl(imageUrl);
    }
  }, [imageUrl, shownUrl]);

  return (
    <div className='absolute inset-0 z-0 pointer-events-none'>
      {/* Base gradient fallback */}
      <div className='absolute inset-0 bg-gradient-to-br from-stone-300/60 via-stone-200/40 to-stone-300/50' />
      {/* Previous image (fades out) */}
      {prevUrl && (
        <img
          key={prevUrl}
          src={prevUrl}
          alt=''
          className='absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] scale-125 transform-gpu opacity-0 transition-opacity duration-700'
        />
      )}
      {/* Current image (fades in) */}
      {shownUrl && (
        <img
          key={shownUrl}
          src={shownUrl}
          alt=''
          onLoad={(e) => {
            (e.target as HTMLImageElement).style.opacity = '1';
            setPrevUrl(null);
          }}
          className='absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] scale-125 transform-gpu opacity-0 transition-opacity duration-700'
        />
      )}
      {/* Radial wash overlay */}
      <div className='absolute inset-0 bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80' />
    </div>
  );
}
