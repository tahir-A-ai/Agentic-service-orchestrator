import { request } from './core';

export async function bookService(userPrompt, sessionId = null, excludedIds = []) {
  const payload = { user_prompt: userPrompt };
  if (sessionId) payload.session_id = sessionId;
  if (excludedIds && excludedIds.length > 0) payload.excluded_provider_ids = excludedIds;
  return request('POST', '/api/v1/book-service', payload);
}

/**
 * Confirms a booking with the selected providers and customer details.
 * @param {string} sessionId - The booking session identifier.
 * @param {string[]} approvedProviderIds - The identifiers of the approved providers.
 * @param {string} exactAddress - The service address.
 * @param {string} customerNotes - Additional notes for the booking.
 * @return {*} The booking confirmation response.
 */
export async function confirmBooking(sessionId, approvedProviderIds, exactAddress, customerNotes) {
  return request('POST', '/api/v1/confirm-booking', {
    session_id: sessionId,
    approved_provider_ids: approvedProviderIds,
    exact_address: exactAddress,
    customer_notes: customerNotes,
  });
}

/**
 * Confirms completion of a booking with a rating and optional review.
 * @param {string} sessionId - The booking session identifier.
 * @param {*} rating - The customer's rating.
 * @param {string|null} [reviewText=null] - Optional review text.
 * @return {*} The booking completion response.
 */
export async function confirmCompletion(sessionId, rating, reviewText = null) {
  const payload = { session_id: sessionId, rating };
  if (reviewText && reviewText.trim()) payload.review_text = reviewText.trim();
  return request('POST', '/api/v1/confirm-completion', payload);
}

/**
 * Cancel a booking for a session.
 * @param {string} sessionId - The identifier of the booking session.
 * @return {Promise<*>} The cancellation response.
 */
export async function cancelBooking(sessionId) {
  return request('POST', '/api/v1/cancel-booking', { session_id: sessionId });
}
