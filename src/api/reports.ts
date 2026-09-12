import { apiClient } from './client';
import type { ApiEnvelope, CreateReportPayload, Report } from './types';

// Regular-user, JwtAuthGuard — replaces the old admin-only /admin/reports entirely (confirmed
// 2026-09-14), same body shape. Used for the buyer-side "Report A Problem" flow.
export async function createReport(payload: CreateReportPayload) {
  const res = await apiClient.post<ApiEnvelope<Report>>('/reports', payload);
  return res.data.data;
}
