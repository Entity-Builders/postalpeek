import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { analytics } from '../lib/analytics';

interface ClaimStatus {
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
}

type ClaimError = 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED' | 'ALREADY_CLAIMED' | 'AUTH_REQUIRED';

interface ClaimResult {
  success: boolean;
  error?: ClaimError;
  daily_used?: number;
  daily_limit?: number;
  monthly_used?: number;
  monthly_limit?: number;
}

export function useClaimPostcard(userId: string | null | undefined) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({
    daily_used: 0,
    daily_limit: 10,
    monthly_used: 0,
    monthly_limit: 200,
  });
  /** Set of postcard IDs claimed by the current user (for optimistic UI) */
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

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
    async (postcardId: string): Promise<ClaimResult> => {
      if (!userId) {
        return { success: false, error: 'AUTH_REQUIRED' };
      }
      if (isClaiming) {
        return { success: false, error: 'ALREADY_CLAIMED' };
      }

      setIsClaiming(true);

      try {
        const { data, error } = await supabase.rpc('postalpeek_claim_postcard', {
          p_postcard_id: postcardId,
        });

        if (error) throw error;

        const result = data as ClaimResult;

        if (result.success) {
          // Optimistic: add to local claimed set
          setClaimedIds((prev) => new Set(prev).add(postcardId));

          // Update counters
          if (result.daily_used != null && result.daily_limit != null) {
            setClaimStatus((prev) => ({
              ...prev,
              daily_used: result.daily_used!,
              daily_limit: result.daily_limit!,
              monthly_used: result.monthly_used ?? prev.monthly_used,
              monthly_limit: result.monthly_limit ?? prev.monthly_limit,
            }));
          }

          analytics.track('postcard_claimed', {
            postcard_id: postcardId,
            daily_used: result.daily_used,
            daily_limit: result.daily_limit,
          });
        } else {
          analytics.track('postcard_claim_failed', {
            postcard_id: postcardId,
            error: result.error,
          });
        }

        return result;
      } catch (err) {
        console.error('Failed to claim postcard:', err);
        analytics.captureError(err, { context: 'claim_postcard', postcard_id: postcardId });
        return { success: false, error: 'ALREADY_CLAIMED' };
      } finally {
        setIsClaiming(false);
      }
    },
    [userId, isClaiming],
  );

  return {
    claim,
    isClaiming,
    claimStatus,
    claimedIds,
  };
}
