import { apiClient } from './client';
import type {
  ApiEnvelope,
  CreateListingPayload,
  Listing,
  ListingSearchParams,
  ListingsCountParams,
  ListingsCountResponse,
  NearbyListingsParams,
  NewListingsParams,
  PaginatedResponse,
  UpdateListingPayload,
} from './types';

/**
 * GET /listings — search + filter, combined. Built as an explicit flat object (not a nested
 * `params` object) so the bracket-style keys (`itemCondition[new]`, `priceRange[min]`, ...) the
 * backend expects go over the wire literally, regardless of how axios would serialize nesting.
 */
export async function searchListings(params: ListingSearchParams) {
  const query: Record<string, string | number | boolean> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.categoryId) query.categoryId = params.categoryId;
  if (params.useMyLocation) query.useMyLocation = true;
  if (params.lat !== undefined) query.lat = params.lat;
  if (params.lng !== undefined) query.lng = params.lng;
  if (params.searchWithin !== undefined) query.searchWithin = params.searchWithin;
  if (params.address) query.address = params.address;
  if (params.state) query.state = params.state;
  if (params.city) query.city = params.city;
  if (params.area) query.area = params.area;
  if (params.conditionNew) query['itemCondition[new]'] = true;
  if (params.conditionNeatlyUsed) query['itemCondition[neatlyUsed]'] = true;
  if (params.minPrice !== undefined) query['priceRange[min]'] = params.minPrice;
  if (params.maxPrice !== undefined) query['priceRange[max]'] = params.maxPrice;
  if (params.search) query.search = params.search;

  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Listing>>>('/listings', { params: query });
  return res.data.data;
}

/** Count of active listings within radiusKm (default 5) of (lat, lng) — location only, not a mirror of every /listings filter. */
export async function getListingsCount(params: ListingsCountParams) {
  const res = await apiClient.get<ApiEnvelope<ListingsCountResponse>>('/listings/count', { params });
  return res.data.data;
}

/** Active listings within radiusKm of (lat, lng), closest first — "Listings Near You". */
export async function getNearbyListings(params: NearbyListingsParams) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Listing>>>('/listings/nearby', { params });
  return res.data.data;
}

/** Active listings created in the last 7 days, newest first — "Recently Posted". */
export async function getNewListings(params: NewListingsParams = {}) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Listing>>>('/listings/new', { params });
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
