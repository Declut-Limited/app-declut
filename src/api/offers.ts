import { apiClient } from './client';
import type { ApiEnvelope, CounterOfferPayload, MakeOfferPayload, Offer, PaginatedResponse } from './types';

export async function listMyOffers(page = 1, limit = 20) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Offer>>>('/offers', { params: { page, limit } });
  return res.data.data;
}

export async function getOffer(offerId: string) {
  const res = await apiClient.get<ApiEnvelope<Offer>>(`/offers/${offerId}`);
  return res.data.data;
}

export async function makeOffer(payload: MakeOfferPayload) {
  const res = await apiClient.post<ApiEnvelope<Offer>>('/offers', payload);
  return res.data.data;
}

// UI must gate accept/reject/counter on Offer.proposedBy — only the party who
// did NOT propose the current amount may act on it (see CLAUDE.md business rules).
export async function acceptOffer(offerId: string) {
  const res = await apiClient.patch<ApiEnvelope<Offer>>(`/offers/${offerId}/accept`);
  return res.data.data;
}

export async function rejectOffer(offerId: string) {
  const res = await apiClient.patch<ApiEnvelope<Offer>>(`/offers/${offerId}/reject`);
  return res.data.data;
}

export async function counterOffer(offerId: string, payload: CounterOfferPayload) {
  const res = await apiClient.post<ApiEnvelope<Offer>>(`/offers/${offerId}/counter`, payload);
  return res.data.data;
}

export async function withdrawOffer(offerId: string) {
  const res = await apiClient.patch<ApiEnvelope<Offer>>(`/offers/${offerId}/withdraw`);
  return res.data.data;
}
