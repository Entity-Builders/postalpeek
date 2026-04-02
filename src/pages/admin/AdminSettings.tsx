/**
 * AdminSettings.tsx — /admin/settings
 * User actions: reset daily pack, reset claim limits.
 */

import React, { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@eb-packages/logic/src/supabase';
import { ActionBtn, StatusMsg } from '../../components/admin/AdminUI';
import type { ActionStatus } from '../../components/admin/AdminUI';
import type { AdminOutletContext } from './types';

export function AdminSettings() {
  const { user } = useOutletContext<AdminOutletContext>();
  const [userStatus, setUserStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  const resetDailyPack = useCallback(async () => {
    if (!user?.id) return;
    setUserStatus({ status: 'loading', message: 'Resetting daily pack…' });
    try {
      const { error } = await supabase.rpc('postalpeek_admin_reset_daily_pack', { p_user_id: user.id });
      if (error) throw error;
      setUserStatus({ status: 'success', message: 'Daily pack reset ✅' });
    } catch (err: unknown) {
      setUserStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [user?.id]);

  const resetClaimLimits = useCallback(async () => {
    if (!user?.id) return;
    setUserStatus({ status: 'loading', message: 'Resetting claim limits…' });
    try {
      const { error } = await supabase.rpc('postalpeek_admin_reset_claims', { p_user_id: user.id });
      if (error) throw error;
      setUserStatus({ status: 'success', message: 'Claim limits reset ✅' });
    } catch (err: unknown) {
      setUserStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [user?.id]);

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold">User Actions</h2>
      {!user ? (
        <p className="text-white/40 text-sm">No user logged in.</p>
      ) : (
        <>
          <p className="text-white/40 text-sm">
            Acting on <strong className="text-white/70">{user.email}</strong>
          </p>
          <div className="space-y-2">
            <ActionBtn onClick={resetDailyPack} disabled={userStatus.status === 'loading'} variant="amber">
              <span>📦</span><span>Reset Today's Daily Pack</span>
            </ActionBtn>
            <ActionBtn onClick={resetClaimLimits} disabled={userStatus.status === 'loading'} variant="danger">
              <span>🔄</span><span>Reset Claim Limits</span>
            </ActionBtn>
          </div>
          <StatusMsg status={userStatus.status} message={userStatus.message} />
        </>
      )}
    </div>
  );
}
