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

// Fire-and-forget, same as above — called best-effort during sign-out so a shared device doesn't
// keep receiving the signed-out account's pushes; must never block or fail the sign-out itself.
export async function unregisterDeviceToken(token: string) {
  await apiClient.delete(`/notifications/token/${encodeURIComponent(token)}`);
}
