import { apiClient } from './client';
import type { ApiEnvelope, LeaveReviewPayload, PaginatedResponse, Review } from './types';

export async function leaveReview(payload: LeaveReviewPayload) {
  const res = await apiClient.post<ApiEnvelope<Review>>('/reviews', payload);
  return res.data.data;
}

export async function listReviewsForUser(userId: string, page = 1, limit = 20) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Review>>>(`/reviews/user/${userId}`, {
    params: { page, limit },
  });
  return res.data.data;
}

export async function listReviewsForTransaction(transactionId: string) {
  const res = await apiClient.get<ApiEnvelope<Review[]>>(`/reviews/transaction/${transactionId}`);
  return res.data.data;
}
