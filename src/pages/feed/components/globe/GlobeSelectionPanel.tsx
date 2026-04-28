import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeedItem } from '../../../../components/Postcard';
import { Heart, Shuffle, MapPin, Camera, X, ZoomIn } from 'lucide-react';
import { useLang, t } from '../../../../utils/i18n';

interface GlobeSelectionPanelProps {
  selectedItem: FeedItem | FeedItem[] | null;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onSkipNext: () => void;
  /** When provided, shows a "Create Your Own" button that enters Viewfinder mode */
  onCreateOwn?: () => void;
}

export function GlobeSelectionPanel({ 
  selectedItem, 
  isFavorited, 
  onToggleFavorite, 
  onSkipNext,
  onCreateOwn,
}: GlobeSelectionPanelProps) {
  const lang = useLang();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Cloudflare image resizing for thumbnails
  const getThumbnailUrl = (url: string, width = 400) => {
    if (!url) return '';
    try {
      const u = new URL(url);
      return `${u.origin}/cdn-cgi/image/w=${width},q=80,f=webp${u.pathname}`;
    } catch {
      return url;
    }
  };

  const mainItem = Array.isArray(selectedItem) ? selectedItem[0] : selectedItem;
  if (!mainItem) return null;

  const imgUrl = mainItem.illustration_url || mainItem.original_image_url || '';
  const thumbUrl = getThumbnailUrl(imgUrl);
  const fullImgUrl = getThumbnailUrl(imgUrl, 1024);
  const category = t(mainItem.category) || '';

  return (
    <>
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            key={mainItem.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute bottom-6 left-4 right-4 md:bottom-8 md:left-8 md:right-auto md:w-80 z-50 pointer-events-auto"
          >
            {/* Postcard Card — the postal is the hero */}
            <div className="bg-stone-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              
              {/* Large Postcard Image — click to lightbox (no navigation) */}
              <div 
                className="relative cursor-pointer group" 
                onClick={() => setLightboxOpen(true)}
              >
                {thumbUrl ? (
                  <img 
                    src={thumbUrl}
                    alt={`${mainItem.city || ''} postcard`}
                    className="w-full aspect-[4/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] bg-stone-800 flex items-center justify-center">
                    <MapPin className="text-white/20" size={32} />
                  </div>
                )}
                
                {/* Hover overlay — zoom icon instead of navigate */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-sm rounded-full p-3">
                    <ZoomIn className="text-white" size={24} />
                  </div>
                </div>

                {/* Category badge */}
                {category && (
                  <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    {category}
                  </div>
                )}
              </div>

              {/* Info + Actions */}
              <div className="p-4">
                {/* Location */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-white text-lg font-bold truncate">
                      {mainItem.city || t({ es: 'Lugar desconocido', en: 'Unknown place' }, lang)}
                    </h3>
                    <p className="text-white/50 text-sm truncate">
                      {mainItem.country || ''}
                    </p>
                  </div>
                  
                  {/* Favorite button */}
                  <button 
                    onClick={onToggleFavorite}
                    className="shrink-0 p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <Heart 
                      size={20} 
                      className={isFavorited 
                        ? 'fill-rose-500 text-rose-500' 
                        : 'text-white/40 hover:text-white/70'
                      } 
                    />
                  </button>
                </div>

                {/* Action buttons — "Create Your Own" is the primary CTA */}
                <div className="flex items-center gap-2 mt-4">
                  {onCreateOwn && (
                    <button 
                      onClick={onCreateOwn}
                      className="flex-1 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(99,102,241,0.3)]"
                    >
                      <Camera size={16} />
                      {t({ es: 'Crear la tuya', en: 'Create Your Own' }, lang)}
                    </button>
                  )}
                  
                  <button 
                    onClick={onSkipNext}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                    title={t({ es: 'Postal aleatoria', en: 'Random postcard' }, lang)}
                  >
                    <Shuffle size={18} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox — fullscreen postcard preview (no navigation, stays in globe) */}
      <AnimatePresence>
        {lightboxOpen && mainItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 cursor-pointer"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Postcard in a white frame */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-3 pb-10">
                  <img
                    src={fullImgUrl || thumbUrl}
                    alt={`${mainItem.city || ''} postcard`}
                    className="w-full aspect-[4/3] object-cover rounded-xl"
                  />
                </div>
              </div>

              {/* Location info below */}
              <div className="text-center mt-4">
                <h3 className="text-white text-xl font-bold">
                  {mainItem.city || t({ es: 'Lugar desconocido', en: 'Unknown place' }, lang)}
                </h3>
                <p className="text-white/50 text-sm mt-1">
                  {mainItem.country || ''}
                </p>
              </div>

              {/* CTA to create your own */}
              {onCreateOwn && (
                <div className="flex justify-center mt-5">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(false);
                      onCreateOwn();
                    }}
                    className="bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white text-sm font-semibold py-3 px-6 rounded-xl transition-all flex items-center gap-2 shadow-[0_4px_16px_rgba(99,102,241,0.3)]"
                  >
                    <Camera size={16} />
                    {t({ es: 'Crear tu versión', en: 'Create Your Version' }, lang)}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
