import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { getSocket } from '@/lib/socket';
import type { ListingUpdateEvent, NewListingEvent, PublicListingUpdateEvent, SocketNotification } from '@/lib/socket';
import { queryKeys } from '@/api/queryKeys';
import { patchListingStatus, removeListingEverywhere, resyncListingLists } from '@/lib/realtime/listingCache';

// How long a listingId stays remembered after markOwnListingId — long enough to cover a slow
// broadcast, short enough that it can never accidentally suppress a *later, genuine* listings:new
// for the same id if this device somehow re-created one (it can't, but this keeps the set small).
const OWN_LISTING_ID_TTL_MS = 60_000;

interface RealtimeContextValue {
  /** A `listings:new` event landed since the last dismiss — surfaced as a "New listings
   *  available" banner rather than auto-splicing into a list mid-scroll (see Home). */
  hasNewListings: boolean;
  dismissNewListings: () => void;
  /** Call with a listing's id right after this device creates it — see useCreateListingMutation.
   *  Suppresses the "New listings available" banner from firing off the echo of the author's own
   *  upload, which they already know about (addItemModal has its own publish-success screen). */
  markOwnListingId: (listingId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  hasNewListings: false,
  dismissNewListings: () => {},
  markOwnListingId: () => {},
});

/**
 * Owns the four socket events every screen cares about (see src/lib/socket.ts): `notification`
 * and the "my listings changed" flavor of `listing:update` arrive automatically in this device's
 * personal room (nothing to subscribe to), and so does `listing:update` for anything explicitly
 * watched via useListingSubscription. `listings:updated` is different — a global broadcast for
 * public listing changes (status changes, edits, deletes), not room-scoped, so it needs no
 * subscription at all; that's what lets a plain browse list drop/re-style a card without having
 * called listing:subscribe for every item on it. Mounted once, inside AuthProvider (needs
 * `status`) and QueryClientProvider (needs the cache to patch) — see app/_layout.tsx.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const [hasNewListings, setHasNewListings] = useState(false);
  const ownListingIdsRef = useRef<Set<string>>(new Set());

  const markOwnListingId = useCallback((listingId: string) => {
    ownListingIdsRef.current.add(listingId);
    setTimeout(() => ownListingIdsRef.current.delete(listingId), OWN_LISTING_ID_TTL_MS);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      setHasNewListings(false);
      return;
    }
    const socket = getSocket();
    if (!socket) return;

    function handleListingUpdate(evt: ListingUpdateEvent) {
      if (__DEV__) console.log('[realtime] listing:update', evt);
      if (evt.action === 'deleted') {
        removeListingEverywhere(queryClient, evt.listingId);
      } else if (evt.action === 'status_changed' && evt.status) {
        patchListingStatus(queryClient, evt.listingId, evt.status);
      } else {
        // 'updated' (or a status_changed missing its status) carries no field-level data to
        // patch with — mark the detail stale rather than guess what changed, and resync every
        // list too, since an edit's new title/price/photo can only ever come from a real refetch.
        queryClient.invalidateQueries({ queryKey: queryKeys.listings.detail(evt.listingId) });
        resyncListingLists(queryClient);
      }
      // The server only ever routes this to us for our own listing or one we're actively
      // watching, so it's never noise from an unrelated listing — either way, a status move is
      // exactly the kind of thing that also means a transaction on it changed underneath us.
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    }

    // Global broadcast — every connected socket gets this, whether or not this listing means
    // anything to them (the actor/owner themselves is excluded server-side, so this is always
    // "someone else's" change). That's why, unlike handleListingUpdate above, this never
    // invalidates transactions.all: doing that on every public change anywhere in the marketplace
    // would make every connected client re-fetch its own transactions for no reason most of the
    // time. Widened 2026-09-20 to also carry 'updated'/'deleted', not just 'status_changed' — same
    // three actions as the room-scoped listing:update, so it branches the same way and reuses the
    // same generic cache helpers.
    function handlePublicListingUpdate(evt: PublicListingUpdateEvent) {
      if (__DEV__) console.log('[realtime] listings:updated', evt);
      if (evt.action === 'deleted') {
        removeListingEverywhere(queryClient, evt.listingId);
      } else if (evt.action === 'status_changed' && evt.status) {
        patchListingStatus(queryClient, evt.listingId, evt.status);
      } else {
        // 'updated' carries no field-level data to patch with — mark the detail stale rather
        // than guess what changed (harmless no-op if nothing has this listing's detail mounted),
        // and resync every list too, since an edit's new title/price/photo can only ever come
        // from a real refetch.
        queryClient.invalidateQueries({ queryKey: queryKeys.listings.detail(evt.listingId) });
        resyncListingLists(queryClient);
      }
    }

    function handleNotification(n: SocketNotification) {
      if (__DEV__) console.log('[realtime] notification', n);
      const { transactionId, listingId } = n.data ?? {};
      if (transactionId) queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      if (listingId) queryClient.invalidateQueries({ queryKey: queryKeys.listings.detail(listingId) });
    }

    function handleNewListings(evt: NewListingEvent) {
      if (__DEV__) console.log('[realtime] listings:new', evt);
      if (ownListingIdsRef.current.has(evt.listingId)) {
        // This is the broadcast of the listing this exact device just published — the author
        // already knows, they were just shown the publish-success screen for it.
        ownListingIdsRef.current.delete(evt.listingId);
        return;
      }
      setHasNewListings(true);
    }

    socket.on('listing:update', handleListingUpdate);
    socket.on('listings:updated', handlePublicListingUpdate);
    socket.on('notification', handleNotification);
    socket.on('listings:new', handleNewListings);

    return () => {
      socket.off('listing:update', handleListingUpdate);
      socket.off('listings:updated', handlePublicListingUpdate);
      socket.off('notification', handleNotification);
      socket.off('listings:new', handleNewListings);
    };
  }, [status, queryClient]);

  const dismissNewListings = useCallback(() => setHasNewListings(false), []);

  return (
    <RealtimeContext.Provider value={{ hasNewListings, dismissNewListings, markOwnListingId }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
