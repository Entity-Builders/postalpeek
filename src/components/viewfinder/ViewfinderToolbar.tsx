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
  const [showStyles, setShowStyles] = React.useState(false);

  const isProcessing = step === 'capturing' || step === 'illustrating';
  const isSuccess = step === 'success';
  const isError = step === 'error';

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
      {/* Style picker — expands upward */}
      <AnimatePresence>
        {showStyles && step === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex gap-1.5 bg-black/70 backdrop-blur-xl rounded-2xl p-2 border border-white/10 shadow-2xl"
          >
            {ILLUSTRATION_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  onStyleChange(style.id);
                  setShowStyles(false);
                }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs transition-all duration-200 ${
                  illustrationStyle === style.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{style.emoji}</span>
                <span className="font-medium">{style.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main toolbar */}
      <div className="flex items-center gap-3 bg-black/70 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {/* Style button */}
        <button
          onClick={() => setShowStyles(!showStyles)}
          disabled={isProcessing || isSuccess}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-40"
        >
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">
            {ILLUSTRATION_STYLES.find((s) => s.id === illustrationStyle)
              ?.emoji || '🎨'}
          </span>
        </button>

        {/* Capture button — the main CTA */}
        <button
          onClick={onCapture}
          disabled={isProcessing || isSuccess}
          className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
            isProcessing
              ? 'bg-purple-500/30 border-2 border-purple-400/40 cursor-wait'
              : isSuccess
                ? 'bg-emerald-500/30 border-2 border-emerald-400/40'
                : isError
                  ? 'bg-red-500/30 border-2 border-red-400/40 hover:bg-red-500/40'
                  : 'bg-gradient-to-br from-indigo-500 to-pink-500 border-2 border-white/20 hover:from-indigo-400 hover:to-pink-400 hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(99,102,241,0.4)]'
          }`}
        >
          {isProcessing && (
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          )}
          {isSuccess && <Check className="w-7 h-7 text-emerald-400" />}
          {isError && <AlertCircle className="w-7 h-7 text-red-400" />}
          {step === 'idle' && <Camera className="w-7 h-7 text-white" />}
        </button>

        {/* Status label */}
        <div className="min-w-[80px] text-center">
          <span
            className={`text-xs font-medium tracking-wide ${
              isProcessing
                ? 'text-purple-300 animate-pulse'
                : isSuccess
                  ? 'text-emerald-300'
                  : isError
                    ? 'text-red-300'
                    : 'text-white/50'
            }`}
          >
            {step === 'capturing' && 'Capturing...'}
            {step === 'illustrating' && 'Creating art...'}
            {step === 'success' && 'Created!'}
            {step === 'error' && 'Try again'}
            {step === 'idle' && 'Capture'}
          </span>
        </div>
      </div>

      {/* Error message toast */}
      <AnimatePresence>
        {isError && errorMessage && (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="text-xs text-red-300/80 bg-black/50 px-3 py-1.5 rounded-lg backdrop-blur-sm"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
