import { apiClient } from './client';
import type { ApiEnvelope, Bank, ResolveBankAccountResponse } from './types';

/** Paystack passthrough — nothing persisted server-side. */
export async function getBanks() {
  const res = await apiClient.get<ApiEnvelope<Bank[]>>('/banks');
  return res.data.data;
}

/** Also a Paystack passthrough — use to show the resolved account name before the user submits. */
export async function resolveBankAccount(bankCode: string, accountNumber: string) {
  const res = await apiClient.get<ApiEnvelope<ResolveBankAccountResponse>>('/banks/resolve', {
    params: { bankCode, accountNumber },
  });
  return res.data.data;
}
