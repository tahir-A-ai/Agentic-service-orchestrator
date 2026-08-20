import { request } from './core';

export async function getProviderStats(providerId) {
  return request('GET', `/api/v1/stats/provider/${providerId}`);
}

export async function getProviderJobs(providerId) {
  return request('GET', `/api/v1/providers/${providerId}/jobs`);
}

export async function updateJobStatus(providerId, sessionId, status) {
  return request('PUT', `/api/v1/providers/${providerId}/jobs/${sessionId}/status`, { status });
}

export async function toggleAvailability(providerId, isAvailable) {
  return request('PUT', `/api/v1/providers/${providerId}/availability`, { is_available: isAvailable });
}

export async function updateProviderProfile(providerId, profileData) {
  return request('PUT', `/api/v1/providers/${providerId}/profile`, profileData);
}

/**
 * Upload a photo for a provider.
 * @param {string|number} providerId - The provider's identifier.
 * @param {File|Blob} file - The photo file to upload.
 * @return {Promise<*>} The API response.
 */
export async function uploadProviderPhoto(providerId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('POST', `/api/v1/providers/${providerId}/photo`, formData);
}

/**
 * Retrieves a page of reviews for a provider.
 * @param {*} providerId - The provider's identifier.
 * @param {number} page - The page number to retrieve.
 * @return {*} The provider review results.
 */
export async function fetchProviderReviews(providerId, page = 1) {
  return request('GET', `/api/v1/providers/${providerId}/reviews?page=${page}&limit=10`);
}
