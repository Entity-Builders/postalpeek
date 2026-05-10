/**
 * AdminStamps.tsx — /admin/stamps
 * Grant or deduct typed stamps for any user.
 */

import React, { useState, useCallback } from 'react';
import { Stamp, Search, Loader } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { ActionBtn, StatusMsg } from '../../components/admin/AdminUI';
import type { ActionStatus } from '../../components/admin/AdminUI';

export function AdminStamps() {
  const [stampTargetEmail, setStampTargetEmail] = useState('');
  const [stampRarity, setStampRarity] = useState<'common' | 'rare' | 'epic' | 'legendary'>('common');
  const [stampAmount, setStampAmount] = useState('10');
  const [stampReason, setStampReason] = useState('Admin manual adjustment');
  const [stampStatus, setStampStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  const manageStamps = useCallback(async (isDeduct: boolean) => {
    if (!stampTargetEmail.trim() || !stampAmount.trim()) return;
    const amount = parseInt(stampAmount.trim(), 10);
    if (isNaN(amount) || amount <= 0) {
      setStampStatus({ status: 'error', message: 'Amount must be a positive number' });
      return;
    }
    const finalAmount = isDeduct ? -amount : amount;
    const actionLabel = isDeduct ? 'Deducting' : 'Granting';
    setStampStatus({ status: 'loading', message: `${actionLabel} ${amount} ${stampRarity} stamps for ${stampTargetEmail.trim()}…` });
    try {
      const { error } = await supabase.rpc('admin_manage_typed_stamps', {
        p_user_email: stampTargetEmail.trim(),
        p_rarity: stampRarity,
        p_amount: finalAmount,
        p_reason: stampReason.trim() || 'Admin manual adjustment',
      });
      if (error) throw error;
      setStampStatus({ status: 'success', message: `✅ ${amount} ${stampRarity} sellos ${isDeduct ? 'eliminados' : 'otorgados'}.` });
      setStampTargetEmail('');
    } catch (err: unknown) {
      setStampStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [stampTargetEmail, stampRarity, stampAmount, stampReason]);

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Stamp className="w-5 h-5 text-amber-400" />
        Manage Stamps (Typed)
      </h2>
      <p className="text-white/40 text-sm">Grant or deduct specific rarity stamps for any user.</p>

      <div
        className="rounded-xl p-5 space-y-4 border"
        style={{ background: 'rgba(245,158,11,0.04)', borderColor: 'rgba(245,158,11,0.15)' }}
      >
        <div className="space-y-3">
          {/* Target email */}
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1 block">
              User Email
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="email"
                value={stampTargetEmail}
                onChange={(e) => setStampTargetEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
              />
            </div>
          </div>

          <div className="flex gap-3">
            {/* Rarity */}
            <div className="w-1/3">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1 block">
                Rarity
              </label>
              <select
                value={stampRarity}
                onChange={(e) => setStampRarity(e.target.value as typeof stampRarity)}
                className="w-full px-3 py-1.5 rounded-lg text-sm transition-all h-[34px]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
              >
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>

            {/* Amount */}
            <div className="flex-1">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1 block">
                Amount (Sellos)
              </label>
              <div className="flex gap-2">
                {[1, 5, 25].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setStampAmount(String(preset))}
                    className="px-2 py-1.5 rounded-lg text-xs font-mono font-medium transition-all h-[34px]"
                    style={{
                      background: stampAmount === String(preset) ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${stampAmount === String(preset) ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: stampAmount === String(preset) ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {preset}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  value={stampAmount}
                  onChange={(e) => setStampAmount(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm font-mono text-center h-[34px]"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1 block">
              Reason (optional)
            </label>
            <input
              type="text"
              value={stampReason}
              onChange={(e) => setStampReason(e.target.value)}
              placeholder="Admin manual adjustment"
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <div className="flex-1">
            <ActionBtn
              onClick={() => manageStamps(false)}
              disabled={stampStatus.status === 'loading' || !stampTargetEmail.trim()}
              variant="success"
            >
              {stampStatus.status === 'loading' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <span>✅</span>}
              <span>Otorgar</span>
            </ActionBtn>
          </div>
          <div className="flex-1">
            <ActionBtn
              onClick={() => manageStamps(true)}
              disabled={stampStatus.status === 'loading' || !stampTargetEmail.trim()}
              variant="danger"
            >
              {stampStatus.status === 'loading' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <span>❌</span>}
              <span>Eliminar</span>
            </ActionBtn>
          </div>
        </div>

        <StatusMsg status={stampStatus.status} message={stampStatus.message} />
      </div>

      {/* Rarity reference */}
      <div className="rounded-xl p-4 border space-y-2" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Rarity Reference</p>
        {[
          { tier: 'Common',    cost: 2,  color: '#9ca3af' },
          { tier: 'Rare',      cost: 6,  color: '#60a5fa' },
          { tier: 'Epic',      cost: 15, color: '#a78bfa' },
          { tier: 'Legendary', cost: 35, color: '#f59e0b' },
        ].map((r) => (
          <div key={r.tier} className="flex items-center justify-between text-xs">
            <span style={{ color: r.color }} className="font-medium">{r.tier}</span>
            <span className="text-white/40 font-mono">{r.cost} sellos</span>
          </div>
        ))}
      </div>
    </div>
  );
}
