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

/** Only the caller's own — 403 on anyone else's. */
export async function getMyBankAccount(userId: string) {
  const res = await apiClient.get<ApiEnvelope<BankAccount>>(`/bank-accounts/user/${userId}`);
  return res.data.data;
}
