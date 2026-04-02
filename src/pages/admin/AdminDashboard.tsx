/**
 * AdminDashboard.tsx — /admin (index)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader, RefreshCw } from 'lucide-react';
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

export function AdminDashboard() {
  const { user, refetchLog } = useOutletContext<AdminOutletContext>();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const userId = user?.id;
      const [colRes, totalRes, unenrichedRes, noTagsRes, albumsRes, albumsCompletedRes] = await Promise.all([
        userId
          ? supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }).eq('owner_id', userId)
          : Promise.resolve({ count: 0 }),
        supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }),
        supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }).is('detailed_tags', null),
        supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }).not('illustration_url', 'is', null).or('illustration_tags.is.null,illustration_tags.eq.[]'),
        supabase.from('postalpeek_albums').select('id', { count: 'exact', head: true }),
        supabase.from('postalpeek_album_progress').select('album_id', { count: 'exact', head: true }).not('completed_at', 'is', null),
      ]);
      setStats({
        collectionCount: (colRes as { count: number | null }).count ?? 0,
        totalPostcards:  (totalRes as { count: number | null }).count ?? 0,
        unenrichedCount: (unenrichedRes as { count: number | null }).count ?? 0,
        noIllustrationTagsCount: (noTagsRes as { count: number | null }).count ?? 0,
        albumsCount:     (albumsRes as { count: number | null }).count ?? 0,
        albumsCompleted: (albumsCompletedRes as { count: number | null }).count ?? 0,
      });
    } catch (err) {
      console.error('Admin stats failed', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="max-w-2xl">
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

      <button
        onClick={() => { fetchStats(); refetchLog(); }}
        className="mt-4 flex items-center gap-2 text-white/30 text-xs hover:text-white/60 transition-colors"
      >
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}
