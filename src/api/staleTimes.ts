/**
 * Shared staleTime tiers so the reasoning lives in one place instead of a scattered magic number
 * per hook. Picking the tier is about who else can change the data out from under us, not how
 * "important" it feels:
 *
 * - STATIC: never changes during a session, or only via this app's own mutations (which already
 *   invalidateQueries on success — see queryKeys.ts). Safe to never time-out.
 * - BROWSE: a listing/marketplace view other users' actions can change (someone else posts, buys,
 *   or pauses a listing) with no local mutation to invalidate it. Long enough that normal in-app
 *   navigation (switching tabs, opening and closing a "See All") doesn't re-hit the network, short
 *   enough that a session left open for a few minutes still shows roughly-current listings.
 * - LIVE: escrow/transaction state a backend webhook or the other party can flip while we're not
 *   looking (payment confirmation, inspection-deadline auto-cancel). Short — freshness here is a
 *   money/trust concern, not a UX nicety.
 */
export const STALE_TIME = {
  STATIC: Infinity,
  BROWSE: 60_000,
  LIVE: 30_000,
} as const;
