/**
 * ViewfinderBrackets.tsx
 *
 * Postcard frame overlay for Photo Mode.
 * Shows a centered postcard-ratio crop area with darkened edges.
 * Optional rule-of-thirds grid for composition.
 *
 * ref #96
 */

import React from 'react';
import { motion } from 'framer-motion';

interface ViewfinderBracketsProps {
  /** Show rule-of-thirds composition grid */
  showGrid?: boolean;
  /** Aspect ratio width (default 4) */
  ratioW?: number;
  /** Aspect ratio height (default 3) */
  ratioH?: number;
}

const BRACKET_SIZE = 28;
const STROKE_WIDTH = 2;

export function ViewfinderBrackets({
  showGrid = false,
  ratioW = 1,
  ratioH = 1,
}: ViewfinderBracketsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center"
    >
      {/* Dark vignette mask — darkens everything OUTSIDE the frame */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 70%)`,
        }}
      />

      {/* Frame container — centered, postcard aspect ratio */}
      <div
        className="relative"
        style={{
          width: '92vw',
          maxWidth: '560px',
          aspectRatio: `${ratioW}/${ratioH}`,
        }}
      >
        {/* Clear interior (punch a hole in the vignette) */}
        <div className="absolute inset-0 rounded-sm" />

        {/* Corner brackets */}
        {/* Top-left */}
        <svg
          className="absolute -top-px -left-px"
          width={BRACKET_SIZE}
          height={BRACKET_SIZE}
          viewBox={`0 0 ${BRACKET_SIZE} ${BRACKET_SIZE}`}
          fill="none"
        >
          <path
            d={`M0 ${BRACKET_SIZE} L0 0 L${BRACKET_SIZE} 0`}
            stroke="white"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeOpacity={0.8}
          />
        </svg>

        {/* Top-right */}
        <svg
          className="absolute -top-px -right-px"
          width={BRACKET_SIZE}
          height={BRACKET_SIZE}
          viewBox={`0 0 ${BRACKET_SIZE} ${BRACKET_SIZE}`}
          fill="none"
        >
          <path
            d={`M0 0 L${BRACKET_SIZE} 0 L${BRACKET_SIZE} ${BRACKET_SIZE}`}
            stroke="white"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeOpacity={0.8}
          />
        </svg>

        {/* Bottom-left */}
        <svg
          className="absolute -bottom-px -left-px"
          width={BRACKET_SIZE}
          height={BRACKET_SIZE}
          viewBox={`0 0 ${BRACKET_SIZE} ${BRACKET_SIZE}`}
          fill="none"
        >
          <path
            d={`M0 0 L0 ${BRACKET_SIZE} L${BRACKET_SIZE} ${BRACKET_SIZE}`}
            stroke="white"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeOpacity={0.8}
          />
        </svg>

        {/* Bottom-right */}
        <svg
          className="absolute -bottom-px -right-px"
          width={BRACKET_SIZE}
          height={BRACKET_SIZE}
          viewBox={`0 0 ${BRACKET_SIZE} ${BRACKET_SIZE}`}
          fill="none"
        >
          <path
            d={`M${BRACKET_SIZE} 0 L${BRACKET_SIZE} ${BRACKET_SIZE} L0 ${BRACKET_SIZE}`}
            stroke="white"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeOpacity={0.8}
          />
        </svg>

        {/* Rule of thirds grid */}
        {showGrid && (
          <div className="absolute inset-0">
            {/* Vertical lines */}
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/20" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/20" />
            {/* Horizontal lines */}
            <div className="absolute left-0 right-0 top-1/3 h-px bg-white/20" />
            <div className="absolute left-0 right-0 top-2/3 h-px bg-white/20" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
