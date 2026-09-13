import { apiClient } from './client';
import type { ApiEnvelope, SystemSettings } from './types';

/** Public, unauthenticated — no Bearer token required (unlike GET /admin/settings, which needs adminAccessToken). */
export async function getSettings() {
  const res = await apiClient.get<ApiEnvelope<SystemSettings>>('/settings');
  return res.data.data;
}
