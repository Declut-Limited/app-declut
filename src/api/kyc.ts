import { apiClient } from './client';
import type { ApiEnvelope, KycCheckResponse, KycHistoryEntry, LivenessCheckPayload, VerifyNinPayload } from './types';

export async function verifyNin(payload: VerifyNinPayload) {
  const res = await apiClient.post<ApiEnvelope<KycCheckResponse>>('/kyc/verify-nin', payload);
  return res.data.data;
}

export async function livenessCheck(payload: LivenessCheckPayload) {
  const res = await apiClient.post<ApiEnvelope<KycCheckResponse>>('/kyc/liveness-check', payload);
  return res.data.data;
}

export async function getVerificationHistory() {
  const res = await apiClient.get<ApiEnvelope<KycHistoryEntry[]>>('/kyc/history');
  return res.data.data;
}
