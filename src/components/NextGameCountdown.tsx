/**
 * NextGameCountdown — clickable button with auto-advance countdown.
 * Always clickable. When countdown reaches 0, auto-advances.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { t } from '../utils/i18n';

interface NextGameCountdownProps {
  /** Starting countdown value in seconds */
  seconds?: number;
  /** Called to advance to the next game (on click or when countdown reaches 0) */
  onAdvance?: () => void;
}

export function NextGameCountdown({ seconds = 3, onAdvance }: NextGameCountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);

  const doAdvance = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onAdvance?.();
  }, [onAdvance]);

  // Countdown tick
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  // Auto-advance when countdown reaches 0
  useEffect(() => {
    if (remaining <= 0) {
      doAdvance();
    }
  }, [remaining, doAdvance]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        doAdvance();
      }}
      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-white transition-all hover:brightness-110 shadow-md cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, #10b981, #059669)',
        boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
      }}
    >
      <span>
        {remaining > 0
          ? `${t({ es: 'Siguiente', en: 'Next' })} ${remaining}…`
          : t({ es: 'Siguiente ▸', en: 'Next ▸' })}
      </span>
      <ChevronRight className="w-3 h-3" />
    </button>
  );
}
