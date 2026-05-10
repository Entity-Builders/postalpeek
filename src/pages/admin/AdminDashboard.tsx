/**
 * AdminDashboard.tsx — /admin (index)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader, RefreshCw, TrendingUp, ShieldAlert, DollarSign } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import type { AdminOutletContext } from './types';

interface UserStats {
  collectionCount: number;
  totalPostcards: number;
  unenrichedCount: number;
  noIllustrationTagsCount: number;
  albumsCount: number;
  albumsCompleted: number;
}

interface UsageStats {
  todaySuccess: number;
  todayRateLimited: number;
  todayTotal: number;
  weekSuccess: number;
  monthSuccess: number;
  globalDailyLimit: number;
  costPerGen: number;
  recentBlocked: { ip: string; count: number }[];
}

export function AdminDashboard() {
  const { user, refetchLog } = useOutletContext<AdminOutletContext>();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const userId = user?.id;
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayIso = today.toISOString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        colRes, totalRes, unenrichedRes, noTagsRes, albumsRes, albumsCompletedRes,
        todaySuccessRes, todayRateLimitedRes, weekRes, monthRes, configRes, blockedRes,
      ] = await Promise.all([
        userId
          ? supabase.from('postcards').select('id', { count: 'exact', head: true }).eq('owner_id', userId)
          : Promise.resolve({ count: 0 }),
        supabase.from('postcards').select('id', { count: 'exact', head: true }),
        supabase.from('postcards').select('id', { count: 'exact', head: true }).is('detailed_tags', null),
        supabase.from('postcards').select('id', { count: 'exact', head: true }).not('illustration_url', 'is', null).or('illustration_tags.is.null,illustration_tags.eq.[]'),
        supabase.from('albums').select('id', { count: 'exact', head: true }),
        supabase.from('album_progress').select('album_id', { count: 'exact', head: true }).not('completed_at', 'is', null),
        // Usage stats
        supabase.from('usage_logs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('created_at', todayIso),
        supabase.from('usage_logs').select('id', { count: 'exact', head: true }).in('status', ['rate_limited', 'circuit_open']).gte('created_at', todayIso),
        supabase.from('usage_logs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('created_at', weekAgo),
        supabase.from('usage_logs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('created_at', monthAgo),
        supabase.from('config').select('key, value').in('key', ['max_daily_global', 'cost_per_generation']),
        supabase.from('usage_logs').select('ip_address').in('status', ['rate_limited', 'circuit_open']).gte('created_at', todayIso).limit(50),
      ]);

      setStats({
        collectionCount: (colRes as { count: number | null }).count ?? 0,
        totalPostcards:  (totalRes as { count: number | null }).count ?? 0,
        unenrichedCount: (unenrichedRes as { count: number | null }).count ?? 0,
        noIllustrationTagsCount: (noTagsRes as { count: number | null }).count ?? 0,
        albumsCount:     (albumsRes as { count: number | null }).count ?? 0,
        albumsCompleted: (albumsCompletedRes as { count: number | null }).count ?? 0,
      });

      // Parse config values
      const configRows = (configRes.data || []) as { key: string; value: string }[];
      const globalLimit = parseInt(configRows.find(r => r.key === 'max_daily_global')?.value || '100', 10);
      const costPerGen  = parseFloat(configRows.find(r => r.key === 'cost_per_generation')?.value || '0.02');

      // Count blocked IPs
      const blockedIps: Record<string, number> = {};
      for (const row of (blockedRes.data || []) as { ip_address: string }[]) {
        if (row.ip_address) blockedIps[row.ip_address] = (blockedIps[row.ip_address] || 0) + 1;
      }
      const recentBlocked = Object.entries(blockedIps)
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const todaySuccess = (todaySuccessRes as { count: number | null }).count ?? 0;
      const todayRateLimited = (todayRateLimitedRes as { count: number | null }).count ?? 0;

      setUsage({
        todaySuccess,
        todayRateLimited,
        todayTotal: todaySuccess + todayRateLimited,
        weekSuccess: (weekRes as { count: number | null }).count ?? 0,
        monthSuccess: (monthRes as { count: number | null }).count ?? 0,
        globalDailyLimit: globalLimit,
        costPerGen,
        recentBlocked,
      });
    } catch (err) {
      console.error('Admin stats failed', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const progressPct = usage ? Math.min(100, (usage.todaySuccess / usage.globalDailyLimit) * 100) : 0;
  const progressColor = progressPct > 80 ? '#ef4444' : progressPct > 60 ? '#f59e0b' : '#10b981';

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-6">Overview</h2>

        {statsLoading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Loader className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Postcards',     value: stats.totalPostcards,          icon: '🃏' },
              { label: 'Your Collection',     value: stats.collectionCount,          icon: '📦' },
              { label: 'Albums',              value: `${stats.albumsCompleted}/${stats.albumsCount} completed`, icon: '📚' },
              { label: 'Unenriched',          value: stats.unenrichedCount === 0 ? '✅ All enriched' : `${stats.unenrichedCount} pending`, icon: '🤖' },
              { label: 'Missing Illus. Tags', value: stats.noIllustrationTagsCount, icon: '🏷️' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-white/40 text-xs mb-1">{stat.icon} {stat.label}</p>
                <p className="text-white text-lg font-mono font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/30 text-sm">No stats</p>
        )}
      </div>

      {/* ── Usage & Cost Monitor ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Usage & Cost Monitor
        </h2>

        {!usage ? (
          <p className="text-white/30 text-sm">No usage data yet</p>
        ) : (
          <div className="space-y-4">
            {/* Daily progress bar */}
            <div className="rounded-xl p-5 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/60 text-sm">Daily generations</p>
                <p className="text-white font-mono text-sm">
                  {usage.todaySuccess} <span className="text-white/30">/ {usage.globalDailyLimit}</span>
                </p>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: progressColor }}
                />
              </div>
              <p className="text-white/30 text-xs mt-2">{progressPct.toFixed(0)}% del límite diario</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Hoy', value: usage.todaySuccess, sub: `~$${(usage.todaySuccess * usage.costPerGen).toFixed(2)}`, icon: <DollarSign className="w-3.5 h-3.5" /> },
                { label: '7 días', value: usage.weekSuccess, sub: `~$${(usage.weekSuccess * usage.costPerGen).toFixed(2)}` },
                { label: '30 días', value: usage.monthSuccess, sub: `~$${(usage.monthSuccess * usage.costPerGen).toFixed(2)}` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-white/40 text-xs mb-1">{s.label}</p>
                  <p className="text-white text-xl font-mono font-semibold">{s.value}</p>
                  <p className="text-emerald-400/70 text-xs mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Blocked attempts */}
            {usage.todayRateLimited > 0 && (
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 text-sm font-medium">{usage.todayRateLimited} intentos bloqueados hoy</p>
                </div>
                {usage.recentBlocked.length > 0 && (
                  <div className="space-y-1">
                    {usage.recentBlocked.map(({ ip, count }) => (
                      <div key={ip} className="flex items-center justify-between text-xs">
                        <span className="text-white/40 font-mono">{ip}</span>
                        <span className="text-red-400/70">{count}x bloqueado</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => { fetchStats(); refetchLog(); }}
        className="flex items-center gap-2 text-white/30 text-xs hover:text-white/60 transition-colors"
      >
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}
