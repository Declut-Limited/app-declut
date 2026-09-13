import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';

/** GET /settings — public, admin-configured platform config (commission %, fees, inspection
 *  window). No mutation anywhere in the app can change it, so it's cached for the life of the
 *  app session instead of being re-fetched on every screen that needs a fee number. Only ever
 *  goes stale by an app restart or an admin-side change the user wouldn't expect to see live
 *  anyway. Used for Declut's own seller-side commissionPercentage (e.g. paymentInfo.tsx's payout
 *  banner) — not for Paystack's buyer-facing checkout fee, which is a fixed published schedule
 *  computed in src/lib/paystackFees.ts instead. */
export function useSystemSettings() {
  return useQuery({
    queryKey: queryKeys.systemSettings.all,
    queryFn: () => settingsApi.getSettings(),
    staleTime: STALE_TIME.STATIC,
  });
}
