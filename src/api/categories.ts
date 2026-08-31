import { apiClient } from './client';
import type { ApiEnvelope, Category, PaginatedResponse } from './types';

export async function getAllCategories(params: { page?: number; limit?: number } = {}) {
  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<Category>>>('/categories/all', { params });
  return res.data.data;
}
