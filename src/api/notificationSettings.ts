import { apiClient } from './client';
import type { ApiEnvelope, NotificationSettings, UpdateNotificationSettingsPayload } from './types';

/** Auto-creates with defaults on first call. */
export async function getMyNotificationSettings(userId: string) {
  const res = await apiClient.get<ApiEnvelope<NotificationSettings>>(`/notification-settings/user/${userId}`);
  return res.data.data;
}

// paymentAndEscrowUpdates/listingActivity/productUpdates/referralAndRewards aren't accepted here — 400s.
export async function updateMyNotificationSettings(userId: string, payload: UpdateNotificationSettingsPayload) {
  const res = await apiClient.patch<ApiEnvelope<NotificationSettings>>(`/notification-settings/user/${userId}`, payload);
  return res.data.data;
}
