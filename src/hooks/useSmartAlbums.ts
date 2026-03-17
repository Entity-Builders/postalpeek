import { useEffect, useState } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Database } from '@eb-packages/logic/src/database.types';

export type SmartAlbum = Database['public']['CompositeTypes']['postalpeek_smart_album_list'];

export const useSmartAlbums = (userId: string | undefined) => {
  const [smartAlbums, setSmartAlbums] = useState<SmartAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAlbums() {
      if (!userId) {
        setSmartAlbums([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('postalpeek_get_smart_albums', {
          p_user_id: userId,
        });

        if (rpcError) throw rpcError;

        if (isMounted) {
          setSmartAlbums(data || []);
        }
      } catch (err: unknown) {
        console.error('Error fetching smart albums:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error loading smart albums');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAlbums();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return { smartAlbums, loading, error, refetch: () => {/* Add refetch logic if needed */} };
};
