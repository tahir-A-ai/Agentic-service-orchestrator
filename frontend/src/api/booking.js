import { request } from './core';

export async function bookService(userPrompt, sessionId = null, excludedIds = []) {
  const payload = { user_prompt: userPrompt };
  if (sessionId) payload.session_id = sessionId;
  if (excludedIds && excludedIds.length > 0) payload.excluded_provider_ids = excludedIds;
  return request('POST', '/api/v1/book-service', payload);
}

export async function confirmBooking(sessionId, approvedProviderIds, exactAddress, customerNotes) {
  return request('POST', '/api/v1/confirm-booking', {
    session_id: sessionId,
    approved_provider_ids: approvedProviderIds,
    exact_address: exactAddress,
    customer_notes: customerNotes,
  });
}

export async function confirmCompletion(sessionId, rating) {
  return request('POST', '/api/v1/confirm-completion', { session_id: sessionId, rating });
}
