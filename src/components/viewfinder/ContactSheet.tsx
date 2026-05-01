import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2 } from 'lucide-react';
import type { StreetViewPOV } from '../StreetViewPanorama';
import { useLang, t } from '../../utils/i18n';

export interface LocalSnapshot {
  id: string;
  pov: StreetViewPOV;
  dataUrl: string | null;
}

interface ContactSheetProps {
  snapshots: LocalSnapshot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDevelop: (id: string) => void;
  disabled?: boolean;
}

export function ContactSheet({
  snapshots,
  selectedId,
  onSelect,
  onDelete,
  onDevelop,
  disabled
}: ContactSheetProps) {
  const lang = useLang();

  if (snapshots.length === 0) return null;

  return (
    <div className="w-full mb-6">
      <div className="flex items-end justify-start gap-4 overflow-x-auto no-scrollbar px-6 pb-2 mask-edges-right">
        <AnimatePresence initial={false}>
          {snapshots.map((snap, index) => {
            const isSelected = snap.id === selectedId;
            return (
              <motion.div
                key={snap.id}
                layout
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative flex-shrink-0"
              >
                {/* Polaroid Frame */}
                <button
                  onClick={() => onSelect(snap.id)}
                  disabled={disabled}
                  className={`relative bg-[#F9F8F4] p-1.5 pb-6 rounded-sm shadow-lg transition-all duration-300 ${
                    isSelected 
                      ? 'ring-2 ring-pink-500 scale-105 z-10 shadow-pink-500/20' 
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ width: isSelected ? '100px' : '80px' }}
                >
                  <div className="aspect-square bg-gray-200 overflow-hidden shadow-inner flex items-center justify-center">
                    {snap.dataUrl ? (
                      <img src={snap.dataUrl} alt="Snapshot" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-400 font-mono text-xs">
                        #{index + 1}
                      </div>
                    )}
                  </div>
                  
                  {/* Delete button (only on selected) */}
                  {isSelected && (
                    <button
                      onClick={(e) => {
                         e.stopPropagation();
                         onDelete(snap.id);
                      }}
                      disabled={disabled}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Develop Button for selected snapshot */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex justify-center mt-4 px-6"
          >
            <button
              onClick={() => onDevelop(selectedId)}
              disabled={disabled}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white hover:from-indigo-400 hover:to-pink-400 transition-all shadow-[0_4px_16px_rgba(236,72,153,0.4)] hover:scale-105 active:scale-95 font-medium text-sm"
            >
              <Sparkles className="w-4 h-4" />
              {t({ es: 'Revelar Selección', en: 'Develop Selection' }, lang)}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .mask-edges-right {
          mask-image: linear-gradient(to right, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, black 85%, transparent);
        }
      `}</style>
    </div>
  );
}
