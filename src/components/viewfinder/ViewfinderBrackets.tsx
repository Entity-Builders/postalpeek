/**
 * ViewfinderBrackets.tsx
 *
 * Pure SVG overlay — white corner brackets in all 4 corners.
 * Camera viewfinder aesthetic. Purely cosmetic.
 *
 * ref #94
 */

import React from 'react';

const BRACKET_SIZE = 40;
const STROKE_WIDTH = 2.5;
const CORNER_OFFSET = 20;

export function ViewfinderBrackets() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top-left */}
      <svg
        className="absolute"
        style={{ top: CORNER_OFFSET, left: CORNER_OFFSET }}
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
          strokeOpacity={0.7}
        />
      </svg>

      {/* Top-right */}
      <svg
        className="absolute"
        style={{ top: CORNER_OFFSET, right: CORNER_OFFSET }}
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
          strokeOpacity={0.7}
        />
      </svg>

      {/* Bottom-left */}
      <svg
        className="absolute"
        style={{ bottom: CORNER_OFFSET, left: CORNER_OFFSET }}
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
          strokeOpacity={0.7}
        />
      </svg>

      {/* Bottom-right */}
      <svg
        className="absolute"
        style={{ bottom: CORNER_OFFSET, right: CORNER_OFFSET }}
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
          strokeOpacity={0.7}
        />
      </svg>

      {/* Center crosshair — subtle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 relative opacity-30">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white" />
        </div>
      </div>
    </div>
  );
}
