import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { t } from '../../utils/i18n';

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
}

export function StorytellingPreview({ storytelling, onFlipCard, isClean = false }: StorytellingPreviewProps) {
  return (
    <button
      className={cn(
        'mt-2 mx-1 rounded-lg border-l-[3px] border-amber-400/70 bg-amber-50/60 px-3.5 py-2.5 flex items-center justify-between gap-2 w-[calc(100%-0.5rem)] text-left transition-all hover:bg-amber-50/90',
        isClean ? 'max-h-0 opacity-0 overflow-hidden mt-0 py-0 px-0 border-l-0' : 'max-h-24 opacity-100',
        'duration-300',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onFlipCard();
      }}
    >
      <div className='flex-1 min-w-0'>
        <span className='inline-block text-[10px] md:text-xs font-semibold text-amber-800/80 bg-amber-100/80 px-2 py-0.5 rounded-full mb-1'>
          {factTypeEmoji(storytelling.fact_type)}{' '}
          {factTypeLabel(storytelling.fact_type)}
        </span>
        <p className='text-xs md:text-sm text-stone-600 line-clamp-1 leading-snug'>
          💡 {t(storytelling.did_you_know)}
        </p>
      </div>
      <span className='text-amber-600 text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-0.5'>
        Leer más
        <ChevronRight className='w-3.5 h-3.5' />
      </span>
    </button>
  );
}
