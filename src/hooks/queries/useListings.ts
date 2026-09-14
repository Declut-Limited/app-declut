import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listingsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import { useRealtime } from '@/contexts/RealtimeContext';
import type { CreateListingPayload, Listing, UpdateListingPayload } from '@/api/types';

// LIVE, not STATIC: a listing's status is the visible half of its escrow lifecycle, and either
// side can flip it while the other is looking (a buyer checking out while the seller has this
// screen open, or vice versa). No background polling here — the party whose action actually
// changed something gets it live via their own mutation's cache invalidation, listingDetailsModal
// force-refetches on every focus (see its useFocusEffect), and the *other* party (previously only
// caught up on their own next focus/pull-to-refresh) now gets it pushed instantly too: this
// screen subscribes to the listing over the realtime socket (see useListingSubscription) unless
// it's the viewer's own, in which case it's already in their personal room automatically — either
// way RealtimeContext patches this exact cache entry the moment a listing:update event lands.
export function useListingDetail(listingId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.listings.detail(listingId ?? ''),
    queryFn: () => listingsApi.getListing(listingId as string),
    enabled: !!listingId && (options?.enabled ?? true),
    staleTime: STALE_TIME.LIVE,
  });
}

/** Applies the listing a mutation just returned straight into its detail cache (no refetch flash
 *  on the screen that triggered it) and invalidates `mine` — the only list endpoint that includes
 *  the caller's own listings. nearby/new/search all explicitly exclude them (see queryKeys.ts), so
 *  pausing/resuming/deleting your own listing can never change what any of those three return for
 *  you, regardless of the status change — invalidating them too used to eagerly refetch Home's
 *  nearby/new teasers for nothing, since Home stays mounted in the background as a tab. */
function applyListingUpdate(queryClient: QueryClient, updated: Listing) {
  queryClient.setQueryData(queryKeys.listings.detail(updated._id), updated);
  queryClient.invalidateQueries({ queryKey: queryKeys.listings.mine() });
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
      // Only `mine` — see applyListingUpdate's comment above; same reasoning applies to delete.
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.mine() });
    },
  });
}

// Owner-only, and only while the listing is active (the backend 400s otherwise — see the Postman
// collection's note on PATCH /listings/:id) — addItemModal's edit-mode gates entry into the flow
// itself on the same status, so this shouldn't be reachable outside that, but the backend's own
// check is still the real guard.
export function useUpdateListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, payload }: { listingId: string; payload: UpdateListingPayload }) =>
      listingsApi.updateListing(listingId, payload),
    onSuccess: (updated) => applyListingUpdate(queryClient, updated),
  });
}

export function useCreateListingMutation() {
  const queryClient = useQueryClient();
  const { markOwnListingId } = useRealtime();
  return useMutation({
    mutationFn: (payload: CreateListingPayload) => listingsApi.createListing(payload),
    onSuccess: (created) => {
      // Suppresses the "New listings available" banner from firing off the broadcast of this
      // exact upload — the author already knows, they're looking at the publish-success screen.
      markOwnListingId(created._id);
      // Only `mine` — nearby/new/search all exclude the caller's own listings (see queryKeys.ts),
      // so the listing just created can never appear in any of them on this device regardless of
      // timing. Invalidating the full `lists()` prefix used to eagerly refetch Home's nearby/new
      // teasers for nothing, since Home stays mounted in the background as a tab.
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.mine() });
    },
  });
}
