import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { SectionTitle, ActionBtn, StatusMsg } from '../../components/admin/AdminUI';
import type { ActionStatus } from '../../components/admin/AdminUI';
import { Loader, Send } from 'lucide-react';
import { useSignedImage } from '../../utils/useSignedImage';
import { WIDTHS } from '../../utils/imageUtils';

interface IgPostcard {
  id: string;
  location_name: string;
  country: string | null;
  illustration_url: string;
  ig_media_id: string | null;
  ig_published_at: string | null;
  created_at: string;
}

export function AdminInstagram() {
  const [pending, setPending] = useState<IgPostcard[]>([]);
  const [published, setPublished] = useState<IgPostcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [runStatus, setRunStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  const fetchPostcards = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch pending (ready but not published)
      const { data: pendData } = await supabase
        .from('postalpeek_postcards')
        .select('id, location_name, country, illustration_url, ig_media_id, ig_published_at, created_at')
        .not('illustration_url', 'is', null)
        .is('ig_media_id', null)
        .order('created_at', { ascending: true })
        .limit(20);
        
      setPending(pendData || []);

      // 2. Fetch published
      const { data: pubData } = await supabase
        .from('postalpeek_postcards')
        .select('id, location_name, country, illustration_url, ig_media_id, ig_published_at, created_at')
        .not('ig_media_id', 'is', null)
        .order('ig_published_at', { ascending: false })
        .limit(50);
        
      setPublished(pubData || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPostcards();
  }, [fetchPostcards]);

  const forcePublish = async (postcardId?: string) => {
    setRunStatus({ status: 'loading', message: 'Ejecutando cron-publisher...' });
    const edgeBase = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    const edgeKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    try {
      const res = await fetch(`${edgeBase}/functions/v1/postalpeek-ig-publisher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${edgeKey}`,
        },
        body: JSON.stringify(postcardId ? { postcard_id: postcardId } : {}),
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to run edge function');
      }
      
      setRunStatus({ status: 'success', message: data.message || 'Publicado con éxito!' });
      // Refresh list
      fetchPostcards();
    } catch (e: any) {
      setRunStatus({ status: 'error', message: e.message });
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <SectionTitle>📸 Instagram Publisher (Walker Bot)</SectionTitle>
      
      <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/90">Bot Estado</p>
          <p className="text-xs text-white/50 mt-1">El bot busca automáticamente postales pendientes para publicar. Usa este botón para forzar un posteo ahora (tomará la más antigua pendiente).</p>
        </div>
        <ActionBtn onClick={() => forcePublish()} disabled={runStatus.status === 'loading'} variant="primary">
          {runStatus.status === 'loading' ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>Publicar Siguiente Ahora</span>
        </ActionBtn>
      </div>
      
      <StatusMsg status={runStatus.status} message={runStatus.message} />

      {loading ? (
        <div className="py-12 flex justify-center"><Loader className="animate-spin text-white/30" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pendientes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest border-b border-white/10 pb-2">Pendientes ({pending.length})</h3>
            {pending.length === 0 && <p className="text-xs text-white/30">No hay postales pendientes.</p>}
            <div className="space-y-2">
              {pending.map(pc => (
                <IgCard key={pc.id} postcard={pc} onPublish={() => forcePublish(pc.id)} publishing={runStatus.status === 'loading'} />
              ))}
            </div>
          </div>

          {/* Publicadas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest border-b border-white/10 pb-2">Ya Publicadas ({published.length})</h3>
            {published.length === 0 && <p className="text-xs text-white/30">Todavía no se ha publicado nada.</p>}
            <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
              {published.map(pc => (
                <IgCard key={pc.id} postcard={pc} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IgCard({ postcard, onPublish, publishing }: { postcard: IgPostcard, onPublish?: () => void, publishing?: boolean }) {
  const thumb = useSignedImage(postcard.illustration_url, { width: WIDTHS.thumb });
  
  return (
    <div className="flex gap-3 bg-white/5 border border-white/5 p-2 rounded-lg items-center">
      <div className="w-12 h-12 rounded bg-black flex-shrink-0 overflow-hidden">
        {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{postcard.location_name}</p>
        <p className="text-[10px] text-white/40 truncate">{postcard.country || 'Unknown'}</p>
        {postcard.ig_published_at && (
          <p className="text-[9px] text-emerald-400 mt-1 uppercase">Pub: {new Date(postcard.ig_published_at).toLocaleDateString()}</p>
        )}
      </div>
      {onPublish && (
         <button 
           onClick={onPublish}
           disabled={publishing}
           className="px-3 py-1.5 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 rounded text-xs transition-colors shrink-0 disabled:opacity-50"
         >
           Push to IG
         </button>
      )}
      {postcard.ig_media_id && (
        <a 
          href={`https://instagram.com/`} // No public link format guaranteed by Media ID alone without username, but we can drop a generic link
          target="_blank" rel="noopener noreferrer"
          className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/50 hover:text-white"
        >
          {postcard.ig_media_id}
        </a>
      )}
    </div>
  );
}
