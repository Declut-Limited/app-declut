import axios from 'axios';
import { apiClient } from './client';
import type { ApiEnvelope, BankAccount, CreateBankAccountPayload } from './types';

// Only bankCode/accountNumber are ever sent — the backend re-resolves the account name against
// Paystack itself and stores that, so a client can never submit a mismatched name.
export async function createBankAccount(payload: CreateBankAccountPayload) {
  const res = await apiClient.post<ApiEnvelope<BankAccount>>('/bank-accounts', payload);
  return res.data.data;
}

// 409s if the user already has one saved — that's when this is used instead of createBankAccount.
export async function updateBankAccount(id: string, payload: CreateBankAccountPayload) {
  const res = await apiClient.patch<ApiEnvelope<BankAccount>>(`/bank-accounts/${id}`, payload);
  return res.data.data;
}

/** Only the caller's own — 403 on anyone else's. 404 (no bank account saved yet) resolves to null
 *  rather than throwing — same pattern as reviewsApi.getReviewForListing — so paymentInfo.tsx's
 *  empty state renders instead of a raw error. */
export async function getMyBankAccount(userId: string) {
  try {
    const res = await apiClient.get<ApiEnvelope<BankAccount>>(`/bank-accounts/user/${userId}`);
    return res.data.data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

// 409s if the caller has any escrow_active/awaiting_inspection transaction as seller — those must
// be resolved first. Sets User.hasPayoutDetails back to false on success.
export async function deleteBankAccount(id: string) {
  await apiClient.delete(`/bank-accounts/${id}`);
}
