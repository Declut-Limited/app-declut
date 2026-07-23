import { apiClient } from './client';
import type { ApiEnvelope, Listing, PaginatedResponse } from './types';

export async function listMyFavorites(page = 1, limit = 20) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Listing>>>('/favorites', {
    params: { page, limit },
  });
  return res.data.data;
}

export async function addFavorite(listingId: string) {
  await apiClient.post(`/favorites/${listingId}`);
}

export async function removeFavorite(listingId: string) {
  await apiClient.delete(`/favorites/${listingId}`);
}
