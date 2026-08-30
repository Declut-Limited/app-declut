import { useCallback, useState } from 'react';
import { favoritesApi } from '@/api';

/** Optimistic favorite toggle with rollback on failure — shared by any screen that renders ListingCard with showFavorite. */
export function useFavoriteToggle() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const toggleFavorite = useCallback((listingId: string) => {
    setFavoriteIds((prev) => {
      const wasFavorited = prev.has(listingId);
      const next = new Set(prev);
      if (wasFavorited) next.delete(listingId);
      else next.add(listingId);

      const request = wasFavorited ? favoritesApi.removeFavorite(listingId) : favoritesApi.addFavorite(listingId);
      request.catch(() => {
        setFavoriteIds((current) => {
          const reverted = new Set(current);
          if (wasFavorited) reverted.add(listingId);
          else reverted.delete(listingId);
          return reverted;
        });
      });

      return next;
    });
  }, []);

  return { favoriteIds, toggleFavorite };
}
