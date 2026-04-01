import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { analytics } from '../lib/analytics';

export interface ClaimStatus {
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
}

type ClaimError = 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED' | 'ALREADY_CLAIMED' | 'AUTH_REQUIRED' | 'INSUFFICIENT_STAMPS';

export interface ClaimResult {
  success: boolean;
  error?: ClaimError;
  // Legacy daily/monthly limit fields (kept for backward compat)
  daily_used?: number;
  daily_limit?: number;
  monthly_used?: number;
  monthly_limit?: number;
  // Stamp economy fields
  stamp_cost?: number;
  remaining_stamps?: number;
  balance?: number; // returned on INSUFFICIENT_STAMPS
}

export function useClaimPostcard(
  userId: string | null | undefined,
  addLocalStamps?: (common: number, rare: number, epic: number, legendary: number) => void,
  setLocalStamps?: (updates: { balance: number; common?: number; rare?: number; epic?: number; legendary?: number }) => void
) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({
    daily_used: 0,
    daily_limit: 10,
    monthly_used: 0,
    monthly_limit: 200,
  });
  /** Set of postcard IDs claimed by the current user (for optimistic UI) */
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  /** True when last claim failed due to insufficient stamps */
  const [insufficientStamps, setInsufficientStamps] = useState(false);

  // Fetch claim status on mount / when user changes
  useEffect(() => {
    if (!userId) {
      setClaimStatus({ daily_used: 0, daily_limit: 10, monthly_used: 0, monthly_limit: 200 });
      setClaimedIds(new Set());
      return;
    }

    supabase
      .rpc('postalpeek_get_claim_status')
      .then(({ data, error }) => {
        if (!error && data) {
          setClaimStatus(data as ClaimStatus);
        }
      });

    // Also fetch user's claimed postcards IDs
    supabase
      .rpc('postalpeek_get_user_collection', { p_user_id: userId })
      .then(({ data, error }) => {
        if (!error && data) {
          setClaimedIds(new Set((data as { id: string }[]).map((p) => p.id)));
        }
      });
  }, [userId]);

  const claim = useCallback(
    async (postcardId: string, rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'tutorial' = 'common'): Promise<ClaimResult> => {
      if (!userId) {
        return { success: false, error: 'AUTH_REQUIRED' };
      }
      if (isClaiming) {
        return { success: false, error: 'ALREADY_CLAIMED' };
      }

      setIsClaiming(true);

      // OPTIMISTIC UI: instantly add to claimed set so UI reacts without delay
      setClaimedIds((prev) => new Set(prev).add(postcardId));
      if (addLocalStamps && rarity !== 'tutorial') {
        if (rarity === 'common') addLocalStamps(-1, 0, 0, 0);
        else if (rarity === 'rare') addLocalStamps(0, -1, 0, 0);
        else if (rarity === 'epic') addLocalStamps(0, 0, -1, 0);
        else if (rarity === 'legendary') addLocalStamps(0, 0, 0, -1);
      }

      try {
        const { data, error } = await supabase.rpc('postalpeek_claim_postcard', {
          p_postcard_id: postcardId,
        });

        if (error) throw error;

        // The RPC returns { success: true, rarity_consumed: string, remaining_stamps: number }
        const result = data as { success: boolean; rarity_consumed?: string; remaining_stamps?: number; error?: string };

        if (result.success) {
          // Keep it in the optimistic local claimed set
          setInsufficientStamps(false);

          if (setLocalStamps && result.rarity_consumed != null && result.remaining_stamps != null) {
            // we don't know the full breakdown, but the RPC could theoretically return it.
            // for now, we just sync after a short delay via refreshStamps if we wanted to be perfectly in sync!
            // Actually, `useStamps` `addLocalStamps` did the optimistic right.
          }

          analytics.track('postcard_claimed', {
            postcard_id: postcardId,
            rarity_consumed: result.rarity_consumed,
          });
        } else {
          // REVERT OPTIMISTIC UI on error
          setClaimedIds((prev) => {
            const next = new Set(prev);
            next.delete(postcardId);
            return next;
          });
          
          if (addLocalStamps && rarity !== 'tutorial') {
            if (rarity === 'common') addLocalStamps(1, 0, 0, 0);
            else if (rarity === 'rare') addLocalStamps(0, 1, 0, 0);
            else if (rarity === 'epic') addLocalStamps(0, 0, 1, 0);
            else if (rarity === 'legendary') addLocalStamps(0, 0, 0, 1);
          }

        if (result.error && result.error.includes('INSUFFICIENT')) {
          setInsufficientStamps(true);
        }
        analytics.track('postcard_claim_failed', {
          postcard_id: postcardId,
          error: result.error,
        });
      }

      return result as ClaimResult;
    } catch (err) {
        // REVERT OPTIMISTIC UI on exception
        setClaimedIds((prev) => {
          const next = new Set(prev);
          next.delete(postcardId);
          return next;
        });
        if (addLocalStamps && rarity !== 'tutorial') {
          if (rarity === 'common') addLocalStamps(1, 0, 0, 0);
          else if (rarity === 'rare') addLocalStamps(0, 1, 0, 0);
          else if (rarity === 'epic') addLocalStamps(0, 0, 1, 0);
          else if (rarity === 'legendary') addLocalStamps(0, 0, 0, 1);
        }
        
        console.error('Failed to claim postcard:', err);
        analytics.captureError(err, { context: 'claim_postcard', postcard_id: postcardId });
        return { success: false, error: 'ALREADY_CLAIMED' };
      } finally {
        setIsClaiming(false);
      }
    },
    [userId, isClaiming, addLocalStamps, setLocalStamps],
  );

    return {
    claim,
    isClaiming,
    claimStatus,
    claimedIds,
    insufficientStamps,
  };
}
