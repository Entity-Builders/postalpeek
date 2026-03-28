import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { analytics } from '../lib/analytics';

interface ClaimStatus {
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
}

type ClaimError = 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED' | 'ALREADY_CLAIMED' | 'AUTH_REQUIRED' | 'INSUFFICIENT_STAMPS';

interface ClaimResult {
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
  addLocalStamps?: (amount: number) => void,
  setLocalStamps?: (balance: number) => void
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
  /** Last stamp cost encountered — useful for showing UI feedback */
  const [lastStampCost, setLastStampCost] = useState<number | null>(null);
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
    async (postcardId: string, expectedCost: number = 3): Promise<ClaimResult> => {
      if (!userId) {
        return { success: false, error: 'AUTH_REQUIRED' };
      }
      if (isClaiming) {
        return { success: false, error: 'ALREADY_CLAIMED' };
      }

      setIsClaiming(true);

      // OPTIMISTIC UI: instantly add to claimed set so UI reacts without delay
      setClaimedIds((prev) => new Set(prev).add(postcardId));
      if (addLocalStamps && expectedCost > 0) {
        addLocalStamps(-expectedCost);
      }

      try {
        const { data, error } = await supabase.rpc('postalpeek_claim_postcard', {
          p_postcard_id: postcardId,
        });

        if (error) throw error;

        const result = data as ClaimResult;

        if (result.success) {
          // Keep it in the optimistic local claimed set
          setInsufficientStamps(false);
          if (result.stamp_cost != null) setLastStampCost(result.stamp_cost);

          // Update legacy counters if present
          if (result.daily_used != null && result.daily_limit != null) {
            setClaimStatus((prev) => ({
              ...prev,
              daily_used: result.daily_used!,
              daily_limit: result.daily_limit!,
              monthly_used: result.monthly_used ?? prev.monthly_used,
              monthly_limit: result.monthly_limit ?? prev.monthly_limit,
            }));
          }
          
          if (setLocalStamps && result.remaining_stamps != null) {
            setLocalStamps(result.remaining_stamps);
          } else if (addLocalStamps && result.stamp_cost != null && result.stamp_cost !== expectedCost) {
            // Adjust optimistic deduction if cost was different
            const diff = expectedCost - result.stamp_cost;
            if (diff !== 0) addLocalStamps(diff);
          }

          analytics.track('postcard_claimed', {
            postcard_id: postcardId,
            stamp_cost: result.stamp_cost,
            remaining_stamps: result.remaining_stamps,
          });
        } else {
          // REVERT OPTIMISTIC UI on error
          setClaimedIds((prev) => {
            const next = new Set(prev);
            next.delete(postcardId);
            return next;
          });
          
          if (addLocalStamps && expectedCost > 0) {
            addLocalStamps(expectedCost); // Revert
          }
          if (setLocalStamps && result.balance != null) {
             setLocalStamps(result.balance); // Sync with source of truth
          }

          if (result.error === 'INSUFFICIENT_STAMPS') {
            setInsufficientStamps(true);
            if (result.stamp_cost != null) setLastStampCost(result.stamp_cost);
          }
          analytics.track('postcard_claim_failed', {
            postcard_id: postcardId,
            error: result.error,
          });
        }

        return result;
      } catch (err) {
        // REVERT OPTIMISTIC UI on exception
        setClaimedIds((prev) => {
          const next = new Set(prev);
          next.delete(postcardId);
          return next;
        });
        if (addLocalStamps && expectedCost > 0) {
          addLocalStamps(expectedCost); // Revert
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
    lastStampCost,
  };
}
