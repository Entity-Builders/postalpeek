/**
 * ZoomSlider.tsx
 *
 * Vertical zoom slider for Street View FOV control.
 * iOS camera-style: thin track with draggable thumb on the right edge.
 *
 * ref #96
 */

import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomSliderProps {
  /** Current zoom level (0 = wide, 5 = max zoom in SV) */
  value: number;
  /** Min zoom (default 0) */
  min?: number;
  /** Max zoom (default 3) */
  max?: number;
  /** Step increment */
  step?: number;
  onChange: (zoom: number) => void;
  className?: string;
}

export function ZoomSlider({
  value,
  min = 0,
  max = 3,
  step = 0.1,
  onChange,
  className = '',
}: ZoomSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  // Convert a clientY position into a zoom value
  const yToZoom = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      // Bottom = min, Top = max (natural: drag up to zoom in)
      const ratio = 1 - (clientY - rect.top) / rect.height;
      return clamp(min + ratio * (max - min));
    },
    [min, max, value],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onChange(yToZoom(e.clientY));
    },
    [onChange, yToZoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      onChange(yToZoom(e.clientY));
    },
    [isDragging, onChange, yToZoom],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Thumb position percentage (0 = bottom, 100 = top)
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={`flex flex-col items-center gap-2 ${className}`}
    >
      {/* Zoom In icon */}
      <button
        onClick={() => onChange(clamp(value + step * 3))}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white transition-all active:scale-90"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative w-8 h-32 flex items-center justify-center cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Track line */}
        <div className="absolute w-[2px] h-full bg-white/15 rounded-full" />

        {/* Filled portion */}
        <div
          className="absolute w-[2px] rounded-full bg-white/50 bottom-0"
          style={{ height: `${pct}%` }}
        />

        {/* Thumb */}
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white/80 bg-black/40 backdrop-blur-sm shadow-lg transition-transform"
          style={{
            bottom: `calc(${pct}% - 10px)`,
            transform: isDragging ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      </div>

      {/* Zoom Out icon */}
      <button
        onClick={() => onChange(clamp(value - step * 3))}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white transition-all active:scale-90"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
