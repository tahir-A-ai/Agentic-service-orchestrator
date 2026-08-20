import { request } from './core';

const BASE = '/api/v1/conversations';

/** Sidebar list — lightweight, no messages */
export function listConversations(page = 1, limit = 30) {
  return request('GET', `${BASE}?page=${page}&limit=${limit}`);
}

/** Full message array — lazy loaded when user clicks a sidebar entry */
export function getConversation(id) {
  return request('GET', `${BASE}/${id}`);
}

/**
 * Upsert the current message array to DB.
 * Called on isThinking flip, beforeunload, and before hard reset.
 */
export function syncConversation(id, { title, messages, bookingSessionId = null }) {
  return request('POST', `${BASE}/${id}/sync`, {
    title,
    messages,
    booking_session_id: bookingSessionId,
  });
}

/** User manually delete from sidebar */
export function deleteConversation(id) {
  return request('DELETE', `${BASE}/${id}`);
}

/**
 * sendBeacon version of sync — used on beforeunload because fetch() may not
 * complete when the tab is closing. sendBeacon is fire-and-forget.
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
