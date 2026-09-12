import { apiClient } from './client';
import type { ApiEnvelope, CheckoutPayload, CheckoutResponse, ConfirmCodePayload, PaginatedResponse, PurchaseStatusFilter, Transaction } from './types';

// Creates a pending_payment Transaction and returns where to send the buyer to pay — no money
// has moved and no Escrow exists yet at this point. Paystack's webhook (server-to-server) is what
// actually confirms the charge and flips the transaction to escrow_active; poll getTransaction()
// for that rather than trusting the checkout page's redirect alone.
export async function checkout(payload: CheckoutPayload) {
  const res = await apiClient.post<ApiEnvelope<CheckoutResponse>>('/transactions', payload);
  return res.data.data;
}

export async function listMyTransactions(page = 1, limit = 20) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Transaction>>>('/transactions', {
    params: { page, limit },
  });
  return res.data.data;
}

// Buyer-side only. status omitted = every purchase, any status; 'active' maps server-side to
// awaiting_inspection only, not every in-progress status.
export async function listMyPurchases(page = 1, limit = 20, status?: PurchaseStatusFilter) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Transaction>>>('/transactions/purchases', {
    params: status ? { page, limit, status } : { page, limit },
  });
  return res.data.data;
}

export async function getTransaction(transactionId: string) {
  const res = await apiClient.get<ApiEnvelope<Transaction>>(`/transactions/${transactionId}`);
  return res.data.data;
}

// Resolves a transaction from Paystack's own `reference` (the value it appends to callback_url
// as ?reference=...) — used by the payment-callback deep-link route for the cold-launch case,
// where there's no in-memory transactionId to fall back on.
export async function getTransactionByReference(reference: string) {
  const res = await apiClient.get<ApiEnvelope<Transaction>>(`/transactions/by-reference/${reference}`);
  return res.data.data;
}

// Seller-side code INPUT only — confirmationCode is only ever returned to the
// buyer, and only while escrow_active/awaiting_inspection (see CLAUDE.md).
export async function confirmCode(transactionId: string, payload: ConfirmCodePayload) {
  const res = await apiClient.post<ApiEnvelope<Transaction>>(`/transactions/${transactionId}/confirm-code`, payload);
  return res.data.data;
}

// Buyer-only. The buyer's own "item is fine, release my money" action — distinct from
// confirmCode above (which is the seller entering a code the buyer read out to them in person).
export async function confirmTransaction(transactionId: string) {
  const res = await apiClient.post<ApiEnvelope<Transaction>>(`/transactions/${transactionId}/confirm-transaction`);
  return res.data.data;
}

// No buyer-facing cancel once paid — UI should stop offering this action once
// status has moved past pending_payment (see CLAUDE.md).
export async function cancelTransaction(transactionId: string) {
  const res = await apiClient.patch<ApiEnvelope<Transaction>>(`/transactions/${transactionId}/cancel`);
  return res.data.data;
}
