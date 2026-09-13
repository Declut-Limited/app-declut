import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { extractErrorMessage } from '@/api/client';
import type { PaginatedResponse } from '@/api/types';

const PAGE_LIMIT = 20;

type FetchPage<T> = (params: { page: number; limit: number }) => Promise<PaginatedResponse<T>>;

// Generic despite the name (kept for backward compat with existing Listing call sites) — also
// backs Transactions (History) and Categories, all the same "load more" list shape. Delegates to
// useInfiniteQuery: `queryKey` (see src/api/queryKeys.ts) replaces the old `resetKey` param —
// changing it is what starts a fresh list instead of appending to the old one, and it's also what
// a mutation's invalidateQueries targets to make this list refetch after a create/update/delete.
//
// `staleTime` has no single right default here — callers pass one explicitly. Lists that only
// change through this app's own mutations (already covered by invalidateQueries) can go long or
// Infinity; lists other actors can change from underneath us with no local invalidation trigger
// (public listings someone else posted/sold) need a real number so a revisit still refetches.
export function usePaginatedListings<T>(queryKey: QueryKey, fetchPage: FetchPage<T>, enabled = true, staleTime = 0) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage({ page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + (page.results?.length ?? 0), 0);
      return loaded < (lastPage.total ?? 0) ? allPages.length + 1 : undefined;
    },
    enabled,
    staleTime,
  });

  const items = query.data?.pages.flatMap((page) => page.results ?? []) ?? [];

  return {
    items,
    total: query.data?.pages[0]?.total ?? null,
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    // A background refetch that's neither the first load nor a "load more" page — i.e. pull-to-
    // refresh, or a mutation elsewhere invalidating this list.
    refreshing: query.isFetching && !query.isLoading && !query.isFetchingNextPage,
    error: query.isError ? extractErrorMessage(query.error, 'Could not load listings.') : null,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    refresh: () => {
      query.refetch();
    },
  };
}
