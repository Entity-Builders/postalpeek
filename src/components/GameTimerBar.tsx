import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { t } from '../utils/i18n';

interface GameTimerBarProps {
  elapsedSeconds: number;
  maxSeconds: number;
  status: 'playing' | 'won' | 'lost' | 'idle' | 'paused';
}

export function GameTimerBar({ elapsedSeconds, maxSeconds, status }: GameTimerBarProps) {
  const remaining = Math.max(0, maxSeconds - elapsedSeconds);
  const progress = Math.min(100, (elapsedSeconds / maxSeconds) * 100);
  const isUrgent = remaining <= 5 && status === 'playing';

  // State colors
  const trackColor = 'bg-stone-200';
  let barColor = isUrgent 
    ? 'linear-gradient(90deg, #ef4444, #b91c1c)' // Red urgent
    : 'linear-gradient(90deg, #f59e0b, #d97706)'; // Amber normal
  
  if (status === 'won') {
    barColor = 'linear-gradient(90deg, #10b981, #059669)'; // Green
  } else if (status === 'lost') {
    barColor = 'linear-gradient(90deg, #ef4444, #991b1b)'; // Dark Red
  }

  // Timer text formatting
  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');

  return (
    <div className="w-full flex flex-col gap-1 mb-2">
      <div className="flex items-center justify-between px-1">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-stone-600'}`}>
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{mm}:{ss}</span>
        </div>
        {status === 'lost' && (
          <span className="text-xs font-bold text-red-600 mr-1 uppercase tracking-wider">
            {t({ es: '¡Tiempo agotado!', en: "Time's up!" })}
          </span>
        )}
      </div>
      <div className={`w-full h-1.5 rounded-full overflow-hidden ${trackColor}`}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: status === 'playing' ? 1 : 0.3, ease: 'linear' }}
        />
      </div>
    </div>
  );
}
