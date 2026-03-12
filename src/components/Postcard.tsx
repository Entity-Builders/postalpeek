import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, ArrowUpRight, Info } from 'lucide-react';
import { cn } from './SearchBar';

export interface FeedItem {
  id: string;
  country: string;
  city: string;
  location_name?: string;
  lat: number;
  lng: number;
  original_image_url: string;
  illustration_url: string;
  category: string;
  description: string;
  created_at: string;
  streetview_pov?: any;
  generation_metadata?: any;
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
        <div className="absolute inset-0 w-full h-full backface-hidden bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] overflow-hidden rounded-sm md:rounded-md flex flex-col p-3 md:p-4 border border-white/50">
           {/* The Illustration */}
           <div className="flex-1 relative overflow-hidden rounded-lg bg-black/5 shadow-inner">
             <img 
               src={item.illustration_url} 
               alt={item.category}
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
             />
             {/* Stamp overlay effect */}
             <div className="absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-white/40 border-dashed rounded opacity-70 flex flex-col items-center justify-center -rotate-6 pointer-events-none">
                <span className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest bg-black/20 px-1 rounded backdrop-blur-sm -rotate-12">
                  POST
                </span>
                <span className="text-[8px] md:text-[10px] text-white/90 font-mono mt-1 drop-shadow-md">
                  {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                </span>
             </div>
           </div>
           
           {/* Bottom margin (Title & Location) */}
           <div className="mt-3 md:mt-4 px-2 flex justify-between items-end">
             <div>
               <h3 className="font-serif text-lg md:text-xl text-stone-800 tracking-tight leading-none mb-1">
                 {item.category.replace(/[\u{1F300}-\u{1F9FF}]/u, '').trim()}
               </h3>
               <div className="flex items-center gap-1.5 min-w-0">
                 <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                 <p className="text-sm md:text-base text-stone-500 tracking-wide font-light truncate">
                   {item.city}, {item.country}
                 </p>
               </div>
             </div>
             
             <button 
               className="p-2 md:p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors"
               onClick={(e) => {
                 e.stopPropagation();
                 setIsFlipped(true);
               }}
             >
               <Info className="w-4 h-4 md:w-5 md:h-5" />
             </button>
           </div>
        </div>

        {/* BACK FACE (Text, Stamp, Coordinates) */}
        <div className="absolute inset-0 w-full h-full backface-hidden bg-[#fdfbf7] rounded-sm md:rounded-md shadow-2xl rotate-y-180 p-5 md:p-8 flex flex-col sm:flex-row border border-[rgba(0,0,0,0.05)] overflow-hidden">
          
          {/* Subtle paper texture overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" 
               style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }}></div>
          
          {/* Main content split */}
          <div className="relative flex flex-col sm:flex-row w-full h-full text-black/80 gap-6">
            
            {/* Left Side: The Story */}
            <div className="flex-1 flex flex-col pt-2 sm:border-r border-black/10 relative mt-4 sm:mt-0 overflow-y-auto sm:overflow-visible pr-6">
              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs md:text-sm font-medium rounded-full mb-4 md:mb-6 tracking-wide uppercase w-fit">
                {item.category}
              </span>
              
              <p className="font-handwriting text-xl sm:text-2xl md:text-3xl leading-relaxed text-slate-800 whitespace-pre-wrap">
                "{item.description}"
              </p>
              
              <div className="mt-auto border-t border-stone-300/50 pt-4 flex flex-col gap-2 font-mono text-[10px] md:text-xs text-stone-400">
                <p>Generation Strategy: <span className="text-stone-600 font-semibold">{item.generation_metadata?.strategy || 'Random Exploration'}</span></p>
                <p>Photographic Lens: <span className="text-stone-600 font-semibold">{item.streetview_pov?.lens || 'Standard 90° FOV'}</span></p>
                <p>Date: {new Date(item.created_at).toLocaleString()}</p>
                <p>UID: {item.id}</p>
              </div>
            </div>

            {/* Right Side: Address & Photo */}
            <div className="w-[40%] flex flex-col relative shrink-0">
              
              <div className="w-20 h-24 border border-stone-300 rounded shrink-0 relative flex float-right bg-stone-100 items-center justify-center rotate-3 shadow-sm self-end mb-8">
                  <span className="text-[10px] text-stone-400 font-mono tracking-widest -rotate-45 block">
                    STAMP<br/>HERE
                  </span>
              </div>

              {/* Address Lines */}
              <div className="w-full flex flex-col gap-6 md:gap-8 opacity-40 mb-8">
                <div className="w-full border-b border-black/30 relative">
                  <span className="absolute -bottom-2 md:-bottom-4 font-handwriting text-xl md:text-3xl text-slate-800 rotate-[-1deg] w-full truncate px-1">
                    {item.location_name || `${item.city}, ${item.country}`}
                  </span>
                </div>
                <div className="w-full border-b border-black/30 relative">
                  <span className="absolute -bottom-1 md:-bottom-2 font-sans text-[10px] md:text-xs text-slate-600 font-mono tracking-widest block pb-1">
                    LAT: {item.lat.toFixed(6)}° N
                  </span>
                </div>
                <div className="w-full border-b border-black/30 relative">
                   <span className="absolute -bottom-1 md:-bottom-2 font-sans text-[10px] md:text-xs text-slate-600 font-mono tracking-widest block pb-1">
                    LNG: {Math.abs(item.lng).toFixed(6)}° {item.lng >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              </div>

              {/* The "Polaroid" Snapshot */}
              <div className="relative mt-auto p-1.5 pb-6 bg-white shadow-md rounded-sm rotate-[-2deg] hover:rotate-0 transition-all hover:scale-105 z-10 group/photo cursor-pointer w-[80%] self-center"
                   onClick={(e) => {
                     e.stopPropagation();
                     window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}&heading=${item.streetview_pov?.heading || 0}&pitch=${item.streetview_pov?.pitch || 0}&fov=${item.streetview_pov?.fov || 90}`, '_blank');
                   }}>
                <div className="relative aspect-square overflow-hidden bg-stone-100 outline outline-1 outline-stone-200">
                  <img src={item.original_image_url} alt="Original reality" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <span className="flex items-center gap-1.5 text-white text-xs font-semibold tracking-wide bg-black/60 px-3 py-1.5 rounded-full">
                       Inspect <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
                <p className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-stone-500 font-mono tracking-wider uppercase">
                   Source Image
                </p>
              </div>

            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
