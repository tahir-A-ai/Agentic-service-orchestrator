import { request } from './core';

const BASE = '/api/v1/conversations';

/**
 * Lists lightweight conversation records for a page.
 * @param {number} page - The page number to retrieve.
 * @param {number} limit - The maximum number of conversations to include.
 * @return {Promise} The paginated conversation records.
 */
export function listConversations(page = 1, limit = 30) {
  return request('GET', `${BASE}?page=${page}&limit=${limit}`);
}

/**
 * Retrieves the full message history for a conversation.
 * @param {string|number} id - The conversation identifier.
 * @return {Promise<Object>} The conversation and its messages.
 */
export function getConversation(id) {
  return request('GET', `${BASE}/${id}`);
}

/**
 * Synchronize a conversation's title, messages, and optional booking session with the database.
 * @param {string|number} id - The conversation identifier.
 * @param {Object} data - The conversation data to synchronize.
 * @param {string} data.title - The conversation title.
 * @param {Array} data.messages - The conversation messages.
 * @param {string|number|null} [data.bookingSessionId=null] - The associated booking session identifier.
 */
export function syncConversation(id, { title, messages, bookingSessionId = null }) {
  return request('POST', `${BASE}/${id}/sync`, {
    title,
    messages,
    booking_session_id: bookingSessionId,
  });
}

/**
 * Deletes a conversation.
 * @param {string|number} id - The conversation identifier.
 * @return {*} The delete request result.
 */
export function deleteConversation(id) {
  return request('DELETE', `${BASE}/${id}`);
}

/**
 * Synchronize a conversation during page unload.
 * @param {string|number} id - The conversation identifier.
 * @param {Object} data - The conversation data to synchronize.
 * @param {string} data.title - The conversation title.
 * @param {Array} data.messages - The conversation messages.
 * @param {string|number|null} [data.bookingSessionId=null] - The associated booking session identifier.
 */
export function beaconSync(id, { title, messages, bookingSessionId = null }) {
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
  const url = `${API_BASE}${BASE}/${id}/sync`;
  const body = JSON.stringify({
    title,
    messages,
    booking_session_id: bookingSessionId,
  });
  // sendBeacon requires a Blob with explicit Content-Type
  const blob = new Blob([body], { type: 'application/json' });
  navigator.sendBeacon(url, blob);
}
