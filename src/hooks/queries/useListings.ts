import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listingsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import type { CreateListingPayload, Listing } from '@/api/types';

// LIVE, not STATIC: a listing's status is the visible half of its escrow lifecycle, and either
// side can flip it while the other is looking (a buyer checking out while the seller has this
// screen open, or vice versa) with no local mutation on this device to invalidate it.
// listingDetailsModal additionally force-refetches on every focus (see its useFocusEffect) —
// that bypasses staleness entirely, so this only governs how eagerly other viewers (chiefly
// myListingDetailsModal, which has no such focus refetch) re-check.
//
// refetchInterval turns that "re-check" into a live poll while it actually matters: pending_sale
// is the exact window where a buyer's confirm/report/cancel action can land at any second and the
// other party (usually the seller, sitting on myListingDetailsModal) has no other way to find out
// short of backgrounding the app and coming back. Once it's settled (active/sold/paused/reported)
// there's nothing left to poll for, so this stops on its own — no interval running forever.
export function useListingDetail(listingId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.listings.detail(listingId ?? ''),
    queryFn: () => listingsApi.getListing(listingId as string),
    enabled: !!listingId && (options?.enabled ?? true),
    staleTime: STALE_TIME.LIVE,
    refetchInterval: (query) => (query.state.data?.status === 'pending_sale' ? 8000 : false),
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
