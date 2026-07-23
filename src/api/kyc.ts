import { apiClient } from './client';
import type { ApiEnvelope, KycHistoryEntry, KycVerifyPayload, KycVerifyResponse } from './types';

/** NIN + facial liveness via QoreID — one combined call (see CLAUDE.md). */
export async function verifyIdentity(payload: KycVerifyPayload) {
  const res = await apiClient.post<ApiEnvelope<KycVerifyResponse>>('/kyc/verify', payload);
  return res.data.data;
}

export async function getVerificationHistory() {
  const res = await apiClient.get<ApiEnvelope<KycHistoryEntry[]>>('/kyc/history');
  return res.data.data;
}
