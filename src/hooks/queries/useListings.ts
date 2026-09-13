import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listingsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import type { CreateListingPayload, Listing } from '@/api/types';

// LIVE, not STATIC: a listing's status is the visible half of its escrow lifecycle, and either
// side can flip it while the other is looking (a buyer checking out while the seller has this
// screen open, or vice versa) with no local mutation on this device to invalidate it.
// listingDetailsModal force-refetches on every focus (see its useFocusEffect) and both listing
// detail screens refetch on pull-to-refresh — no background polling: the party whose action
// actually changed something gets it live via their own mutation's cache invalidation, and the
// other party catches up next time they look (return to the screen, or pull to refresh).
export function useListingDetail(listingId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.listings.detail(listingId ?? ''),
    queryFn: () => listingsApi.getListing(listingId as string),
    enabled: !!listingId && (options?.enabled ?? true),
    staleTime: STALE_TIME.LIVE,
    refetchInterval: (query) => (query.state.data?.status === 'pending_sale' ? 10000 : false),
  });
}

/** Applies the listing a mutation just returned straight into its detail cache (no refetch flash
 *  on the screen that triggered it) and invalidates every public list it could appear in or drop
 *  out of — mine/nearby/new/search all share the `lists()` prefix for exactly this. */
function applyListingUpdate(queryClient: QueryClient, updated: Listing) {
  queryClient.setQueryData(queryKeys.listings.detail(updated._id), updated);
  queryClient.invalidateQueries({ queryKey: queryKeys.listings.lists() });
}

/** Optimistically flips the cached status the instant the button is tapped, rather than waiting
 *  on the round trip — onSuccess below still overwrites with the server's own response, this just
 *  removes the visible lag in between. Rolled back on failure. */
function useOptimisticListingStatus(nextStatus: Listing['status']) {
  const queryClient = useQueryClient();
  return {
    onMutate: async (listingId: string) => {
      const key = queryKeys.listings.detail(listingId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Listing>(key);
      if (previous) queryClient.setQueryData<Listing>(key, { ...previous, status: nextStatus });
      return { previous };
    },
    onError: (_err: unknown, listingId: string, context?: { previous?: Listing }) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.listings.detail(listingId), context.previous);
    },
  };
}

export function usePauseListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => listingsApi.pauseListing(listingId),
    ...useOptimisticListingStatus('paused'),
    onSuccess: (updated) => applyListingUpdate(queryClient, updated),
  });
}

export function useResumeListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => listingsApi.resumeListing(listingId),
    ...useOptimisticListingStatus('active'),
    onSuccess: (updated) => applyListingUpdate(queryClient, updated),
  });
}

export function useDeleteListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => listingsApi.deleteListing(listingId),
    onSuccess: (_result, listingId) => {
      queryClient.removeQueries({ queryKey: queryKeys.listings.detail(listingId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.lists() });
    },
  });
}

export function useCreateListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateListingPayload) => listingsApi.createListing(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.lists() });
    },
  });
}
