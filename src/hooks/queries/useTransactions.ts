import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import type { PurchaseStatusFilter, Transaction, TransactionStatus } from '@/api/types';

// Only these two statuses are actually waiting on someone else's next move (the other party
// confirming, an inspection deadline auto-cancelling, a webhook landing) — worth polling for.
// pending_payment is waiting on Paystack's webhook specifically, already covered by
// listingDetailsModal's own tight getTransactionResult poll while that overlay is up.
function isInFlight(status: TransactionStatus | undefined) {
  return status === 'escrow_active' || status === 'awaiting_inspection';
}

/** The buyer's own transaction for a listing. There's no GET /transactions/by-listing endpoint,
 *  so this pulls the buyer's first page of purchases for whichever status the listing's own
 *  status implies, and picks out the one that matches (see CLAUDE.md). Deliberately a distinct
 *  query key from History's own infinite purchases list (queryKeys.transactions.purchasesInfinite)
 *  — see the naming rule in queryKeys.ts. LIVE staleTime: escrow/inspection state here can change
 *  via a Paystack webhook or the seller's own action, neither of which this device's cache hears
 *  about any other way — refetchInterval turns that into an actual live poll while it's in flight. */
export function useMyPurchaseForListing(listingId: string | undefined, status: PurchaseStatusFilter, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.transactions.purchasesLookup(status),
    queryFn: () => transactionsApi.listMyPurchases(1, 50, status),
    enabled: enabled && !!listingId,
    select: (data) => data.results.find((t) => t.listing?._id === listingId) ?? null,
    staleTime: STALE_TIME.LIVE,
    refetchInterval: (query) => {
      const match = query.state.data?.results.find((t) => t.listing?._id === listingId);
      return isInFlight(match?.status) ? 8000 : false;
    },
  });
}

/** Seller-side equivalent — myListingDetailsModal's lookup for a listing it's selling
 *  (GET /transactions, not /transactions/purchases). Same LIVE + polling reasoning as above. */
export function useMyTransactionForListing(listingId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.transactions.myTransactionsLookup(),
    queryFn: () => transactionsApi.listMyTransactions(1, 50),
    enabled: enabled && !!listingId,
    select: (data) => data.results.find((t) => t.listing?._id === listingId) ?? null,
    staleTime: STALE_TIME.LIVE,
    refetchInterval: (query) => {
      const match = query.state.data?.results.find((t) => t.listing?._id === listingId);
      return isInFlight(match?.status) ? 8000 : false;
    },
  });
}

/** A transaction status change can flip the listing behind it (active <-> pending_sale <-> sold)
 *  and always affects both transaction lookups above plus History's own list. */
function invalidateAfterTransactionChange(queryClient: QueryClient, listingId: string | null | undefined) {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  if (listingId) queryClient.invalidateQueries({ queryKey: queryKeys.listings.detail(listingId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.listings.lists() });
}

// No cache to invalidate here — checkout only ever creates a pending_payment transaction with no
// listing/transaction-list impact yet. The state-changing moment is the poll that confirms
// escrow_active (see listingDetailsModal's getTransactionResult), which invalidates explicitly.
export function useCheckoutMutation() {
  return useMutation({
    mutationFn: transactionsApi.checkout,
  });
}

export function useConfirmTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => transactionsApi.confirmTransaction(transactionId),
    onSuccess: (transaction: Transaction) => invalidateAfterTransactionChange(queryClient, transaction.listing?._id),
  });
}

// Pre-payment abandonment only — see CLAUDE.md. Distinct from useCancelPurchaseMutation below.
export function useCancelTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => transactionsApi.cancelTransaction(transactionId),
    onSuccess: (transaction: Transaction) => invalidateAfterTransactionChange(queryClient, transaction.listing?._id),
  });
}

// Buyer-only, post-payment, 10% service fee — see CLAUDE.md.
export function useCancelPurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => transactionsApi.cancelPurchase(transactionId),
    onSuccess: (transaction: Transaction) => invalidateAfterTransactionChange(queryClient, transaction.listing?._id),
  });
}
