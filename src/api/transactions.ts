import { apiClient } from './client';
import type { ApiEnvelope, CheckoutPayload, ConfirmCodePayload, PaginatedResponse, Transaction } from './types';

export async function checkout(payload: CheckoutPayload) {
  const res = await apiClient.post<ApiEnvelope<Transaction>>('/transactions', payload);
  return res.data.data;
}

export async function listMyTransactions(page = 1, limit = 20) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Transaction>>>('/transactions', {
    params: { page, limit },
  });
  return res.data.data;
}

export async function getTransaction(transactionId: string) {
  const res = await apiClient.get<ApiEnvelope<Transaction>>(`/transactions/${transactionId}`);
  return res.data.data;
}

// Seller-side code INPUT only — confirmationCode is only ever returned to the
// buyer, and only while escrow_active/awaiting_inspection (see CLAUDE.md).
export async function confirmCode(transactionId: string, payload: ConfirmCodePayload) {
  const res = await apiClient.post<ApiEnvelope<Transaction>>(`/transactions/${transactionId}/confirm-code`, payload);
  return res.data.data;
}

// No buyer-facing cancel once paid — UI should stop offering this action once
// status has moved past pending_payment (see CLAUDE.md).
export async function cancelTransaction(transactionId: string) {
  const res = await apiClient.patch<ApiEnvelope<Transaction>>(`/transactions/${transactionId}/cancel`);
  return res.data.data;
}
