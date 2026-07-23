import { apiClient } from './client';
import type { ApiEnvelope, UpdateProfilePayload, User } from './types';

export async function getMyProfile() {
  const res = await apiClient.get<ApiEnvelope<User>>('/users/me');
  return res.data.data;
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const res = await apiClient.patch<ApiEnvelope<User>>('/users/me', payload);
  return res.data.data;
}

export async function getPublicProfile(userId: string) {
  const res = await apiClient.get<ApiEnvelope<Partial<User>>>(`/users/${userId}`);
  return res.data.data;
}
