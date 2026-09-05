import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@entity-builders/logic/src/supabase';
import { analytics } from '../lib/analytics';

interface StampBalance {
  balance: number;
  total_earned: number;
  total_spent: number;
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

type SpendError = 'INSUFFICIENT_STAMPS' | 'AUTH_REQUIRED' | 'UNKNOWN';

interface SpendResult {
  success: boolean;
  new_balance?: number;
  error?: SpendError;
}

interface DailyClaimResult {
  success: boolean;
  already_claimed?: boolean;
  balance?: number;
  awarded?: number;
}

export type UseStampsReturn = ReturnType<typeof useStamps>;

export function useStamps(userId: string | null | undefined) {
  const [balance, setBalance] = useState<StampBalance>({
    balance: 0,
    total_earned: 0,
    total_spent: 0,
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasClaimedDaily, setHasClaimedDaily] = useState(false);

  // Fetch balance on mount / when user changes
  useEffect(() => {
    if (!userId) {
      setBalance({ balance: 0, total_earned: 0, total_spent: 0, common: 0, rare: 0, epic: 0, legendary: 0 });
      return;
    }

    supabase
      .rpc('get_stamp_balance')
      .then(({ data, error }) => {
        if (!error && data) {
          setBalance(data as StampBalance);
        }
      });
  }, [userId]);

  const refreshStamps = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc('get_stamp_balance');
    if (!error && data) {
      setBalance(data as StampBalance);
    }
  }, [userId]);

  const addLocalStamps = useCallback((common: number = 0, rare: number = 0, epic: number = 0, legendary: number = 0) => {
    setBalance(prev => ({
      ...prev,
      common: prev.common + common,
      rare: prev.rare + rare,
      epic: prev.epic + epic,
      legendary: prev.legendary + legendary,
      // For legacy compatibility
      balance: prev.balance + common + rare + epic + legendary,
    }));
  }, []);

  const setLocalStamps = useCallback((updates: Partial<StampBalance>) => {
    setBalance(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  /**
   * Award the daily login bonus (2 stamps once per calendar day).
   * Safe to call on every app open — the RPC is idempotent.
   */
  const claimDailyStamps = useCallback(async (): Promise<DailyClaimResult> => {
    if (!userId) return { success: false };

    const { data, error } = await supabase.rpc('claim_daily_stamps');
    if (error || !data) return { success: false };

    const result = data as DailyClaimResult;

    if (result.success) {
      setBalance((prev) => ({
        ...prev,
        balance: result.balance ?? prev.balance,
        total_earned: prev.total_earned + (result.awarded ?? 0),
      }));
      setHasClaimedDaily(true);
      analytics.track('stamps_daily_claimed', { awarded: result.awarded });
    } else {
      setHasClaimedDaily(true); // already claimed — mark so we don't retry
    }

    return result;
  }, [userId]);

  /**
   * Spend stamps for a postcard claim.
   * Calls the RPC which validates balance server-side and deducts atomically.
   */
  const spendStamps = useCallback(
    async (amount: number, postcardId: string): Promise<SpendResult> => {
      if (!userId) return { success: false, error: 'AUTH_REQUIRED' };

      // Optimistic guard (server will double-check)
      if (balance.balance < amount) {
        return { success: false, error: 'INSUFFICIENT_STAMPS' };
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase.rpc('spend_stamps', {
          p_amount: amount,
          p_postcard_id: postcardId,
        });

        if (error) throw error;

        const result = data as SpendResult & { new_balance?: number; error?: string };

        if (result.success) {
          setBalance((prev) => ({
            ...prev,
            balance: result.new_balance ?? prev.balance - amount,
            total_spent: prev.total_spent + amount,
          }));
          analytics.track('stamps_spent', { amount, postcard_id: postcardId });
        }

        return {
          success: result.success,
          new_balance: result.new_balance,
          error: result.error as SpendError | undefined,
        };
      } catch (err) {
        console.error('Failed to spend stamps:', err);
        analytics.captureError(err, { context: 'spend_stamps', postcard_id: postcardId });
        return { success: false, error: 'UNKNOWN' };
      } finally {
        setIsLoading(false);
      }
    },
    [userId, balance.balance],
  );

  return {
    stampBalances: balance,
    isLoading,
    hasClaimedDaily,
    claimDailyStamps,
    spendStamps,
    refreshStamps,
    addLocalStamps,
    setLocalStamps,
  };
}
