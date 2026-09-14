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

// The 'nearby'/'new'/'search' segment of a list query's key (see queryKeys.ts) — the three public
// browse lists, which only ever show 'active' listings server-side. 'mine' is deliberately not in
// here: myListings has filter tabs for every status and must keep a listing in place (patched, not
// dropped) no matter what it changes to.
const BROWSE_LIST_SEGMENTS = new Set(['nearby', 'new', 'search']);

/**
 * Applies `update` to every cached copy of `listingId` — across every public/mine listing list
 * (nearby/new/search/mine, teaser and infinite shapes alike — see queryKeys.ts) and its own
 * detail cache. `update` also receives the query's own key, so callers can special-case *which*
 * list they're touching (see patchListingStatus below). Return `null` from `update` to drop the
 * item from a list; return a patched copy to update it in place.
 */
function updateListingEverywhere(
  queryClient: QueryClient,
  listingId: string,
  update: (item: Listing, queryKey: readonly unknown[]) => Listing | null
) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: queryKeys.listings.lists() });
  for (const query of queries) {
    queryClient.setQueryData(query.queryKey, (data: unknown) => {
      if (isInfiniteData(data)) {
        return { ...data, pages: data.pages.map((page) => mapPage(page, listingId, (item) => update(item, query.queryKey))) };
      }
      if (isPaginatedData(data)) {
        return mapPage(data, listingId, (item) => update(item, query.queryKey));
      }
      return data;
    });
  }

  const detailKey = queryKeys.listings.detail(listingId);
  const current = queryClient.getQueryData<Listing>(detailKey);
  if (current) {
    const next = update(current, detailKey);
    if (next) queryClient.setQueryData(detailKey, next);
    else queryClient.removeQueries({ queryKey: detailKey });
  }
}

/**
 * Patches `status` in place everywhere — *except* a public browse list (nearby/new/search) once
 * the new status isn't 'active', where the item is dropped instead, the same as a delete. Those
 * cards render no status pill at all (only myListings does), and those lists are server-filtered
 * to 'active' to begin with, so patching the field in place left a sold/reported/paused/delisted
 * listing sitting there looking exactly like a normal, buyable one — indistinguishable from doing
 * nothing at all. Dropping it doesn't have the "needs the endpoint's own sort logic" problem a
 * status moving the *other* way (back to active) would — removal never needs re-sorting, only
 * insertion does, so this stays one-directional: nothing here ever re-inserts a listing into a
 * browse list, it only ever removes one, exactly like handleListingUpdate's 'deleted' case.
 */
export function patchListingStatus(queryClient: QueryClient, listingId: string, status: Listing['status']) {
  updateListingEverywhere(queryClient, listingId, (item, queryKey) => {
    const isBrowseList = queryKey[1] === 'list' && BROWSE_LIST_SEGMENTS.has(queryKey[2] as string);
    if (isBrowseList && status !== 'active') return null;
    return { ...item, status };
  });
}

/**
 * Removes `listingId` from every cached list/detail immediately (instant, no waiting on a round
 * trip), then triggers a real background refetch of every listing list so `total`/pagination
 * bookkeeping a pure client-side splice can't fix resyncs with the server right away, not just
 * whenever that list next happens to refocus/pull-to-refresh/go stale. Every browse screen (see
 * usePaginatedListings call sites) no longer blanks its FlatList to a skeleton while this is in
 * flight — only a genuine first load does that now — so this refetch is silent: the list already
 * lost the item instantly via the splice above, and the background refetch just quietly confirms
 * it, with at most a native pull-to-refresh-style spinner, never a full list wipe.
 */
export function removeListingEverywhere(queryClient: QueryClient, listingId: string) {
  updateListingEverywhere(queryClient, listingId, () => null);
  queryClient.invalidateQueries({ queryKey: queryKeys.listings.lists() });
}
