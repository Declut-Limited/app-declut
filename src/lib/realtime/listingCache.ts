import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import type { Listing, PaginatedResponse } from '@/api/types';

type InfiniteListingData = { pages: PaginatedResponse<Listing>[]; pageParams: unknown[] };

function isInfiniteData(data: unknown): data is InfiniteListingData {
  return !!data && typeof data === 'object' && Array.isArray((data as InfiniteListingData).pages);
}

function isPaginatedData(data: unknown): data is PaginatedResponse<Listing> {
  return !!data && typeof data === 'object' && Array.isArray((data as PaginatedResponse<Listing>).results);
}

function mapPage(page: PaginatedResponse<Listing>, listingId: string, update: (item: Listing) => Listing | null): PaginatedResponse<Listing> {
  let changed = false;
  const results = page.results.flatMap((item) => {
    if (item._id !== listingId) return [item];
    changed = true;
    const next = update(item);
    return next ? [next] : [];
  });
  return changed ? { ...page, results } : page;
}

/**
 * Applies `update` to every cached copy of `listingId` — across every public/mine listing list
 * (nearby/new/search/mine, teaser and infinite shapes alike — see queryKeys.ts) and its own
 * detail cache. Return `null` from `update` to drop the item from a list (deletes); return a
 * patched copy to update it in place (status changes) — patch-in-place rather than dropping a
 * listing whose status moved away from "active" out of e.g. a nearby/new list, since correctly
 * re-inserting a listing that moves the other way would need the endpoint's own sort/filter
 * logic this cache has no way to replicate. A card briefly showing a stale status until its
 * list's own next refetch is an acceptable trade for never risking a wrongly-reordered list.
 */
function updateListingEverywhere(queryClient: QueryClient, listingId: string, update: (item: Listing) => Listing | null) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: queryKeys.listings.lists() });
  for (const query of queries) {
    queryClient.setQueryData(query.queryKey, (data: unknown) => {
      if (isInfiniteData(data)) {
        return { ...data, pages: data.pages.map((page) => mapPage(page, listingId, update)) };
      }
      if (isPaginatedData(data)) {
        return mapPage(data, listingId, update);
      }
      return data;
    });
  }

  const detailKey = queryKeys.listings.detail(listingId);
  const current = queryClient.getQueryData<Listing>(detailKey);
  if (current) {
    const next = update(current);
    if (next) queryClient.setQueryData(detailKey, next);
    else queryClient.removeQueries({ queryKey: detailKey });
  }
}

export function patchListingStatus(queryClient: QueryClient, listingId: string, status: Listing['status']) {
  updateListingEverywhere(queryClient, listingId, (item) => ({ ...item, status }));
}

export function removeListingEverywhere(queryClient: QueryClient, listingId: string) {
  updateListingEverywhere(queryClient, listingId, () => null);
}
