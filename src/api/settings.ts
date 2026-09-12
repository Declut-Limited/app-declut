import { apiClient } from './client';
import type { SystemSettings } from './types';

/** Public, unauthenticated — no Bearer token required (unlike GET /admin/settings, which needs adminAccessToken). */
export async function getSettings() {
  const res = await apiClient.get<SystemSettings>('/settings');
  return res.data;
}
