import axios from 'axios';
import { apiClient } from './client';
import type { ApiEnvelope, LeaveReviewPayload, PaginatedResponse, Review } from './types';

// Buyer→seller only. 400 if the caller has no completed transaction for this listing; 409 if
// they've already reviewed it (one review per listing, ever). Recalculates the seller's
// avgRating/reviewCount server-side and notifies them.
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

// The caller's own review for a listing they bought — null if they haven't left one yet.
export async function getReviewForListing(listingId: string) {
  try {
    const res = await apiClient.get<ApiEnvelope<Review | null>>(`/reviews/listing/${listingId}`);
    return res.data.data ?? null;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}
