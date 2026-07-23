import { apiClient } from './client';
import type { ApiEnvelope, DeviceTokenEntry, RegisterDeviceTokensPayload, RegisterDeviceTokensResponse } from './types';

// Fire-and-forget — a registration failure must never block or roll back the
// action that triggered it (see CLAUDE.md). Callers should not await this on
// the critical path; catch and swallow errors at the call site.
export async function registerDeviceTokens(tokens: DeviceTokenEntry[]) {
  const payload: RegisterDeviceTokensPayload = { tokens };
  const res = await apiClient.post<ApiEnvelope<RegisterDeviceTokensResponse>>('/notifications/register-token', payload);
  return res.data.data;
}

export async function unregisterDeviceToken(deviceToken: string) {
  await apiClient.delete(`/notifications/token/${deviceToken}`);
}
