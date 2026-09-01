import axios from 'axios';
import { apiClient } from './client';
import type { ApiEnvelope, CloudinaryMediaRef, DeleteImageResponse, UploadSignature } from './types';

/** Moved from GET /listings/upload-signature — one signed Cloudinary payload for a single file. */
export async function getUploadSignature() {
  const res = await apiClient.get<ApiEnvelope<UploadSignature>>('/media/upload-signature');
  return res.data.data;
}

/** N independently-signed payloads (1-3) in one call — for a listing's multiple images. */
export async function getBulkUploadSignatures(count: number) {
  const res = await apiClient.get<ApiEnvelope<UploadSignature[]>>('/media/upload-signature/bulk', { params: { count } });
  return res.data.data;
}

/** The one media op that has to go through us — only the backend holds CLOUDINARY_API_SECRET. */
export async function deleteImage(publicId: string) {
  const res = await apiClient.delete<ApiEnvelope<DeleteImageResponse>>('/media/image', { params: { publicId } });
  return res.data.data;
}

interface CloudinaryUploadResponse {
  public_id: string;
  url: string;
  secure_url: string;
}

/**
 * Uploads a local file straight to Cloudinary using a signature obtained above — the backend
 * never sees the raw bytes. Same signed payload works for both resource types (resource type
 * isn't part of what's signed); only the endpoint path differs.
 */
export async function uploadToCloudinary(
  localUri: string,
  signature: UploadSignature,
  resourceType: 'image' | 'video'
): Promise<CloudinaryMediaRef> {
  const form = new FormData();
  const filename = localUri.split('/').pop() ?? `upload.${resourceType === 'video' ? 'mp4' : 'jpg'}`;
  form.append('file', {
    uri: localUri,
    name: filename,
    type: resourceType === 'video' ? 'video/mp4' : 'image/jpeg',
  } as unknown as Blob);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  if (signature.folder) form.append('folder', signature.folder);

  const res = await axios.post<CloudinaryUploadResponse>(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return { publicId: res.data.public_id, url: res.data.url, secureUrl: res.data.secure_url };
}
