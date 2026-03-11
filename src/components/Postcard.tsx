import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from './SearchBar';

// Using the FeedItem interface implicitly or moving it to a shared types file would be ideal,
// but for now we'll duplicate it or pass the item directly as any/unknown if needed.
// We'll define it here for strong typing within this component.
export interface FeedItem {
  id: string;
  location_name: string;
  lat: number;
  lng: number;
  original_image_url: string;
  illustration_url: string;
  category: string;
  description: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface PostcardProps {
  item: FeedItem;
  isActive: boolean;
}

export function Postcard({ item, isActive }: PostcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // If the postcard is no longer active (user navigating the feed), ensure it resets to front face
  React.useEffect(() => {
    if (!isActive && isFlipped) {
      setIsFlipped(false);
    }
  }, [isActive, isFlipped]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  // Format date for the postmark
  const dateObj = new Date(item.created_at);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();

  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={cn(
      "w-[90vw] max-w-[600px] md:max-w-none md:w-[80vh] xl:w-[85vh] aspect-square perspective-1000 cursor-pointer transition-all duration-700 ease-in-out mx-auto",
      isActive ? "scale-100 opacity-100" : "scale-[0.85] opacity-40 pointer-events-none"
    )}
    onClick={handleFlip}>
      <motion.div
        className="w-full h-full relative preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.8, type: "spring", stiffness: 60, damping: 15 }}
      >
        {/* FRONT FACE (Pure Art - Subtle & Minimalist) */}
        <div className="absolute inset-0 w-full h-full backface-hidden bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] overflow-hidden rounded-sm md:rounded-md">
           {/* The Illustration */}
          <img 
            src={item.illustration_url} 
            alt={item.location_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Extremely subtle location attribution, like a tiny watermark */}
          <div className="absolute bottom-4 left-5 pointer-events-none opacity-50 mix-blend-overlay hidden md:block">
            <span className="font-sans text-[10px] uppercase tracking-[0.3em] font-medium text-white drop-shadow-md">
              {item.location_name.split(',')[0]}
            </span>
          </div>
        </div>

        {/* BACK FACE (Text, Stamp, Coordinates) */}
        <div className="absolute inset-0 w-full h-full backface-hidden bg-[#fdfbf7] rounded-sm md:rounded-md shadow-2xl rotate-y-180 p-5 md:p-8 flex flex-col sm:flex-row border border-[rgba(0,0,0,0.05)] overflow-hidden">
          
          {/* Subtle paper texture overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" 
               style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }}></div>
          
          {/* Main content split */}
          <div className="relative flex flex-col sm:flex-row w-full h-full text-black/80">
            
            {/* Left Side: The Story */}
            <div className="flex-[1.3] sm:pr-6 md:pr-10 flex flex-col pt-2 sm:border-r border-black/10 relative order-2 sm:order-1 mt-4 sm:mt-0 overflow-y-auto sm:overflow-visible">
              <h3 className="font-handwriting text-2xl md:text-4xl font-bold mb-2 md:mb-6 rotate-[-2deg] text-indigo-950/80">
                The {item.category}...
              </h3>
              <p className="font-handwriting text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-relaxed text-slate-800 flex-1 whitespace-pre-wrap">
                "{item.description}"
              </p>
              
              <div className="mt-auto pt-4 md:pt-6 text-slate-400 font-sans text-[10px] md:text-xs flex items-center gap-1.5 opacity-80">
                <Navigation className="w-3 h-3 md:w-4 md:h-4" />
                <span>Captured {formattedTime}</span>
              </div>
            </div>

            {/* Right Side: Address & Stamp */}
            <div className="flex-[0.7] sm:pl-6 md:pl-10 flex flex-col relative w-full sm:w-auto shrink-0 order-1 sm:order-2 h-[200px] sm:h-auto overflow-hidden sm:overflow-visible">
              
              {/* Stamp Area (Top Right) */}
              <div className="absolute top-0 right-0 w-16 h-20 sm:w-20 sm:h-24 md:w-24 md:h-28 bg-red-50 border-2 border-dashed border-red-200/50 p-1 md:p-1.5 rotate-[4deg] shadow-sm flex flex-col items-center justify-between z-10">
                 <div className="w-full h-full border border-red-200 bg-white flex flex-col items-center justify-center overflow-hidden relative">
                   {/* Fake stamp imagery */}
                   <MapPin className="w-5 h-5 md:w-8 md:h-8 text-red-500/50 mb-1" />
                   <span className="text-[8px] md:text-[10px] font-bold text-red-900/40 tracking-wider">POSTAGE</span>
                   <span className="text-[10px] md:text-xs font-bold text-red-900/60 leading-none">PAID</span>
                   
                   {/* Fake cancellation mark overlaying the stamp */}
                   <div className="absolute -left-10 md:-left-12 top-1/2 w-40 md:w-56 h-[1.5px] bg-black/30 rotate-[-15deg] pointer-events-none mix-blend-multiply" />
                   <div className="absolute -left-10 md:-left-12 top-1/2 w-40 md:w-56 h-[1.5px] bg-black/30 rotate-[-25deg] pointer-events-none mix-blend-multiply mt-1.5" />
                 </div>
              </div>

              {/* Digital Postmark (Circular) */}
              <div className="absolute top-4 sm:top-14 md:top-20 right-20 sm:right-16 md:right-24 w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-full border border-black/20 rotate-[-12deg] flex items-center justify-center mix-blend-multiply pointer-events-none z-0">
                <div className="w-[72px] h-[72px] sm:w-[104px] sm:h-[104px] md:w-[136px] md:h-[136px] rounded-full border border-black/10 flex flex-col items-center justify-center text-center p-1 md:p-2">
                  <span className="uppercase text-[6px] sm:text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] text-black/50 font-bold mb-1 w-full truncate">POSTAL PEEK</span>
                  <span className="text-[10px] sm:text-xs md:text-sm font-bold text-black/70">{formattedDate}</span>
                  <span className="text-[6px] sm:text-[8px] md:text-[9px] tracking-[0.1em] text-black/40 mt-1 md:mt-2">AI GENERATED</span>
                </div>
              </div>

              {/* Address Lines */}
              <div className="mt-auto mb-4 md:mb-8 w-full flex flex-col gap-4 md:gap-8 pt-20 sm:pt-0">
                <div className="w-full border-b border-black/15 relative">
                  <span className="absolute -bottom-2 md:-bottom-4 font-handwriting text-xl sm:text-2xl md:text-4xl lg:text-5xl text-slate-800 rotate-[-1deg] w-full truncate block px-1">
                    {item.location_name}
                  </span>
                </div>
                <div className="w-full border-b border-black/15 relative">
                  <span className="absolute -bottom-1 md:-bottom-2 font-sans text-[10px] sm:text-xs md:text-sm text-slate-600 font-mono tracking-widest block pb-1">
                    {item.lat.toFixed(6)}° N
                  </span>
                </div>
                <div className="w-full border-b border-black/15 relative">
                   <span className="absolute -bottom-1 md:-bottom-2 font-sans text-[10px] sm:text-xs md:text-sm text-slate-600 font-mono tracking-widest block pb-1">
                    {Math.abs(item.lng).toFixed(6)}° {item.lng >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              </div>

              {/* View on Map Link */}
               <a 
                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} // Prevent card flip when clicking link
                className="mt-auto pt-2 text-[10px] sm:text-xs md:text-sm font-sans uppercase tracking-[0.2em] font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1 group w-max"
              >
                <span>Explore Map</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>

            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
