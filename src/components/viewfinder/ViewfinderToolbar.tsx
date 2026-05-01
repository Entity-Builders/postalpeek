/**
 * ViewfinderToolbar.tsx
 *
 * Floating bottom toolbar for the Viewfinder panel.
 * Contains: style selector, capture button, and loading states.
 *
 * ref #94
 */

import React from 'react';
import { Camera, Loader2, Palette, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ViewfinderStep } from '../../hooks/useViewfinder';

const ILLUSTRATION_STYLES = [
  { id: 'default', label: 'Classic', emoji: '🎨' },
  { id: 'watercolor', label: 'Watercolor', emoji: '💧' },
  { id: 'vintage', label: 'Vintage', emoji: '📜' },
  { id: 'pop-art', label: 'Pop Art', emoji: '🎭' },
  { id: 'minimalist', label: 'Minimal', emoji: '✨' },
];

interface ViewfinderToolbarProps {
  step: ViewfinderStep;
  illustrationStyle: string;
  onStyleChange: (style: string) => void;
  onCapture: () => void;
  errorMessage?: string | null;
}

export function ViewfinderToolbar({
  step,
  illustrationStyle,
  onStyleChange,
  onCapture,
  errorMessage,
}: ViewfinderToolbarProps) {
  const isProcessing = step === 'preview' || step === 'illustrating';
  const isSuccess = step === 'success';
  const isError = step === 'error';

  return (
    <div className="relative w-full flex flex-col items-center pb-12 pt-6">
      
      {/* Error message toast */}
      <AnimatePresence>
        {isError && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute -top-12 bg-red-500/90 text-white text-xs px-4 py-2 rounded-full backdrop-blur-md shadow-lg"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Style picker — iOS Camera modes style */}
      <div className="w-full max-w-sm overflow-x-auto no-scrollbar flex items-center justify-start sm:justify-center gap-6 mb-8 px-6 mask-edges">
        {ILLUSTRATION_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => onStyleChange(style.id)}
            disabled={isProcessing || isSuccess}
            className={`text-xs uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
              illustrationStyle === style.id
                ? 'text-[#F5D44F] scale-105'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>

      {/* Main capture button — iOS Shutter style */}
      <div className="flex items-center justify-center w-full relative">
        <button
          onClick={onCapture}
          disabled={isProcessing || isSuccess}
          className={`relative flex items-center justify-center w-[72px] h-[72px] rounded-full transition-all duration-300 ${
            isProcessing || isSuccess || isError
              ? 'border-[3px] border-white/30'
              : 'border-[3px] border-white hover:scale-105 active:scale-95'
          }`}
        >
          {/* Inner circle */}
          <div
            className={`absolute rounded-full transition-all duration-300 flex items-center justify-center ${
              isProcessing
                ? 'bg-transparent inset-0 m-0'
                : isSuccess
                  ? 'bg-emerald-500 inset-1'
                  : isError
                    ? 'bg-red-500 inset-1'
                    : 'bg-white inset-[3px]'
            }`}
          >
            {isProcessing && <Loader2 className="w-8 h-8 text-white animate-spin" />}
            {isSuccess && <Check className="w-8 h-8 text-white" />}
            {isError && <AlertCircle className="w-8 h-8 text-white" />}
          </div>
        </button>

        {/* Status text (optional) */}
        <div className="absolute right-6 sm:right-10 text-xs font-medium text-white/50 w-24 text-right">
            {step === 'preview' && 'Preview...'}
            {step === 'illustrating' && 'Creating...'}
            {step === 'success' && 'Saved!'}
            {step === 'error' && 'Failed'}
        </div>
      </div>

      {/* Global CSS to hide scrollbar and fade edges */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .mask-edges {
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
      `}</style>
    </div>
  );
}
