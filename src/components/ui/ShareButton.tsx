import React, { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { supabase } from '@eb-packages/logic/src/supabase';
import { analytics } from '../../lib/analytics';

interface ShareButtonProps {
  postcardId: string;
  country: string;
}

export function ShareButton({ postcardId, country }: ShareButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  return (
    <button
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
          const { data, error } = await supabase
            .from('postalpeek_shares')
            .insert({ postcard_id: postcardId })
            .select('id')
            .single();

          if (error) throw error;
          if (!data) throw new Error('No share record created');

          const shortHash = encodeUuidToHash(data.id);
          const shareLink = `${window.location.origin}/${shortHash}`;

          await navigator.clipboard.writeText(shareLink);
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
  );
}
