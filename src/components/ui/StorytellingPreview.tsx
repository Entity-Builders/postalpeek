import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { t } from '../../utils/i18n';
import { motion } from 'framer-motion';

function factTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    historical: '🏛️',
    architectural: '🏗️',
    cultural: '🎭',
    gastronomic: '🍽️',
    natural: '🌿',
    artistic: '🎨',
  };
  return map[type] || '📖';
}

function factTypeLabel(type: string): string {
  const map: Record<string, string> = {
    historical: 'Dato Histórico',
    architectural: 'Arquitectura',
    cultural: 'Cultura',
    gastronomic: 'Gastronomía',
    natural: 'Naturaleza',
    artistic: 'Arte',
  };
  return map[type] || 'Dato Curioso';
}

interface StorytellingPreviewProps {
  storytelling: {
    fact_type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    did_you_know: any;
  };
  onFlipCard: () => void;
  isClean?: boolean;
  /** When true, the excerpt is hidden (zero height). Used for first-tap reveal. */
  collapsed?: boolean;
}

export function StorytellingPreview({ storytelling, onFlipCard, isClean = false, collapsed = false }: StorytellingPreviewProps) {
  const isHidden = isClean || collapsed;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isHidden ? 0 : 1, y: isHidden ? 10 : 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={isHidden ? undefined : { scale: 1.01 }}
      whileTap={isHidden ? undefined : { scale: 0.99 }}
      className={cn(
        'group mx-2 mt-3 p-3 rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50/80 shadow-[0_2px_10px_rgba(251,191,36,0.15)] flex items-center justify-between gap-3 text-left transition-all duration-300',
        isHidden ? 'max-h-0 opacity-0 overflow-hidden mt-0 py-0 px-0 border-none pointer-events-none' : 'max-h-28 opacity-100',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onFlipCard();
      }}
    >
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-1.5 mb-1.5'>
          <motion.span
            initial={{ scale: 0.5, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 15, delay: 0.3 }}
            className='inline-flex items-center justify-center w-5 h-5 text-[11px] bg-amber-200/60 rounded-full shadow-sm shrink-0'
          >
            {factTypeEmoji(storytelling.fact_type)}
          </motion.span>
          <span className='text-[10px] md:text-xs font-bold text-amber-800/80 uppercase tracking-widest'>
            {factTypeLabel(storytelling.fact_type)}
          </span>
        </div>
        <p className='text-xs md:text-sm text-stone-700/90 font-medium line-clamp-2 leading-relaxed'>
          {t(storytelling.did_you_know)}
        </p>
      </div>
      <div className='text-amber-600 flex flex-col items-center justify-center shrink-0 pr-1'>
        <div className='flex items-center justify-center w-7 h-7 bg-amber-200/40 rounded-full group-hover:bg-amber-200/70 transition-colors shadow-sm'>
          <ChevronRight className='w-4 h-4 animate-pulse' />
        </div>
      </div>
    </motion.button>
  );
}
