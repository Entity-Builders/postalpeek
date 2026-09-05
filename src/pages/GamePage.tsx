import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@entity-builders/logic/src/supabase';
import { Postcard, type FeedItem } from '../components/Postcard';
import { useAuth } from '@entity-builders/logic/src/hooks/useAuth';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useLang, t } from '../utils/i18n';

export function GamePage() {
  const { shortcode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const lang = useLang();
  
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!shortcode) return;
    
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(false);
      
      const { data, error } = await supabase
        .from('postcards')
        .select('*')
        .eq('id', shortcode)
        .single();
        
      if (isMounted) {
        if (error || !data) {
          setError(true);
        } else {
          setItem(data as FeedItem);
        }
        setLoading(false);
      }
    })();
    
    return () => { isMounted = false; };
  }, [shortcode]);

  if (loading) {
    return (
      <div className="w-screen h-[100dvh] flex items-center justify-center bg-[#e6e2da]">
        <Loader2 className="w-8 h-8 text-stone-500 animate-spin" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="w-screen h-[100dvh] flex flex-col items-center justify-center bg-[#e6e2da] text-stone-800 gap-4">
        <p className="font-medium">{t({ es: 'Postal no encontrada', en: 'Postcard not found' }, lang)}</p>
        <button 
          onClick={() => navigate('/feed')}
          className="px-5 py-2.5 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-black transition-all"
        >
          {t({ es: 'Volver', en: 'Go back' }, lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen h-[100dvh] relative bg-[#e6e2da] overflow-hidden flex flex-col">
      {/* Absolute Exit Button */}
      <button
        onClick={() => {
          if (window.history.length > 2) {
             navigate(-1);
          } else {
             navigate('/feed');
          }
        }}
        className="absolute top-4 left-4 z-[100] flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-xs font-semibold border border-white/15 hover:bg-black/60 transition-all shadow-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        {t({ es: 'Salir', en: 'Exit' }, lang)}
      </button>

      {/* Main Game Container */}
      <div className="flex-1 w-full max-w-[480px] mx-auto relative pt-[4.5rem] pb-8 px-4 md:px-6 flex flex-col">
        <Postcard
          item={item}
          isActive={true}
          isClaimedByMe={item.owner_id === user?.id}
          hasOwner={!!item.owner_id}
          userId={user?.id}
          autoStartGame={true}
          onOpenAlbum={(albumId) => navigate(`/feed/album/${albumId}`)}
          onOpenCollection={() => navigate('/feed/collection')}
        />
      </div>
    </div>
  );
}
