import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedContext } from './FeedLayout';
import { CollectionGrid } from '../../components/CollectionGrid';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';

export function CollectionPage() {
  const navigate = useNavigate();
  const {
    collection,
    isCollectionLoading,
    claimStatus,
    albums,
    isLoadingAlbums,
    favoriteItems,
    favoriteIds,
  } = useFeedContext();

  return (
    <div className='w-full h-full relative z-[100]'>
      <CollectionGrid
        collection={collection}
        isLoading={isCollectionLoading}
        claimStatus={claimStatus}
        onClose={() => navigate('/feed')}
        onSelectPostcard={(item) => {
          // If a postcard is clicked in the collection, where does it go?
          // Typically, we want to view it in full screen.
          // Collection modal didn't actually have a carousel hook up easily. It used `setSelectedPostcard` which opened PostcardDetailModal.
          // Let's navigate to the public viewer for now, or back to feed with a hash.
          const hash = encodeUuidToHash(item.id);
          navigate(`/postcard/${hash}`);
        }}
        albums={albums}
        isLoadingAlbums={isLoadingAlbums}
        favoriteItems={favoriteItems}
        favoriteIds={favoriteIds}
        onOpenAlbum={(album) => {
          navigate(`/feed/album/${album.id}`);
        }}
      />
    </div>
  );
}
