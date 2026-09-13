import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';

/**
 * Subscribes to a specific listing's realtime `listing:update` events for as long as this hook
 * is mounted with a truthy, enabled `listingId` — e.g. while its detail screen is open, or while
 * its card is visible in a feed. Only meaningful for listings this device doesn't already own
 * (an owner's own listings arrive automatically in their personal room) — subscribing to your
 * own listing anyway is harmless, just redundant, so callers don't need to special-case it.
 * Forgetting to unsubscribe isn't dangerous either (per the realtime server's own contract) but
 * this cleans up on unmount/id-change regardless, since there's no reason to keep receiving
 * updates for a listing that's no longer on screen.
 */
export function useListingSubscription(listingId: string | undefined, enabled = true) {
  useEffect(() => {
    if (!listingId || !enabled) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('listing:subscribe', { listingId });
    return () => {
      socket.emit('listing:unsubscribe', { listingId });
    };
  }, [listingId, enabled]);
}
