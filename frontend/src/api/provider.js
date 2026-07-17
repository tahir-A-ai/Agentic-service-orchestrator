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
