import { apiClient } from './client';
import type {
  ApiEnvelope,
  CreateListingPayload,
  Listing,
  ListingSearchParams,
  PaginatedResponse,
  UpdateListingPayload,
  UploadSignature,
} from './types';

export async function getUploadSignature() {
  const res = await apiClient.get<ApiEnvelope<UploadSignature>>('/listings/upload-signature');
  return res.data.data;
}

export async function searchListings(params: ListingSearchParams) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Listing>>>('/listings', { params });
  return res.data.data;
}

export async function getListing(listingId: string) {
  const res = await apiClient.get<ApiEnvelope<Listing>>(`/listings/${listingId}`);
  return res.data.data;
}

export async function createListing(payload: CreateListingPayload) {
  const res = await apiClient.post<ApiEnvelope<Listing>>('/listings', payload);
  return res.data.data;
}

export async function updateListing(listingId: string, payload: UpdateListingPayload) {
  const res = await apiClient.patch<ApiEnvelope<Listing>>(`/listings/${listingId}`, payload);
  return res.data.data;
}

export async function archiveListing(listingId: string) {
  const res = await apiClient.patch<ApiEnvelope<Listing>>(`/listings/${listingId}/archive`);
  return res.data.data;
}

export async function deleteListing(listingId: string) {
  await apiClient.delete(`/listings/${listingId}`);
}
