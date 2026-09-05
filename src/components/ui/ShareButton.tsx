import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Check, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { encodeUuidToHash } from '@entity-builders/logic/src/hash';
import { supabase } from '@entity-builders/logic/src/supabase';
import { analytics } from '../../lib/analytics';
import { AnimatePresence, motion } from 'framer-motion';

interface ShareButtonProps {
  postcardId: string;
  country: string;
  isUserPostcard?: boolean;
}

export function ShareButton({ postcardId, country, isUserPostcard }: ShareButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  // Recalculate tooltip position when isCopied changes
  useEffect(() => {
    if (isCopied && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    } else {
      setTooltipPos(null);
    }
  }, [isCopied]);

  return (
    <div className="relative flex items-center justify-center">
      <button
        ref={buttonRef}
        className={cn(
          'p-2 md:p-2.5 rounded-full transition-colors',
          isCopied
            ? 'bg-indigo-50 text-indigo-500'
            : 'bg-stone-100/80 hover:bg-blue-50 text-stone-400 hover:text-blue-500',
        )}
        disabled={isSharing}
        onClick={async (e) => {
          e.stopPropagation();
          if (isSharing) return;
          setIsSharing(true);

          try {
            const insertData = isUserPostcard
              ? { user_postcard_id: postcardId }
              : { postcard_id: postcardId };

            const { data, error } = await supabase
              .from('shares')
              .insert(insertData)
              .select('id')
              .single();

            if (error) throw error;
            if (!data) throw new Error('No share record created');

            const shortHash = encodeUuidToHash(data.id);
            const shareLink = `${window.location.origin}/${shortHash}`;

            await navigator.clipboard.writeText(shareLink);
            
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }

            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);

            analytics.track('postcard_shared', {
              postcard_id: postcardId,
              country,
              share_link: shareLink,
            });
          } catch (err) {
            console.log('Share failed:', err);
            analytics.captureError(
              err instanceof Error ? err : new Error(String(err)),
              {
                event_type: 'share_failed',
                postcard_id: postcardId,
              },
            );
            alert('Failed to generate share link. Please try again.');
          } finally {
            setIsSharing(false);
          }
        }}
      >
        {isSharing ? (
          <Loader2 className='w-4 h-4 md:w-5 md:h-5 animate-spin' />
        ) : isCopied ? (
          <Check className='w-4 h-4 md:w-5 md:h-5 scale-110 transition-transform' />
        ) : (
          <Share2 className='w-4 h-4 md:w-5 md:h-5 transition-transform' />
        )}
      </button>

      {/* Portal: tooltip rendered at body level to escape all overflow-hidden ancestors */}
      {createPortal(
        <AnimatePresence>
          {isCopied && tooltipPos && (
            <div
              style={{
                position: 'fixed',
                top: tooltipPos.top,
                left: tooltipPos.left,
                transform: 'translate(-50%, -100%)',
                zIndex: 9999,
                pointerEvents: 'none',
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.9 }}
                className="px-3 py-1.5 bg-stone-800 text-white text-[11px] font-bold tracking-wide rounded-lg shadow-lg whitespace-nowrap"
              >
                ¡Enlace copiado!
                <div className="absolute top-[98%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-stone-800" />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
