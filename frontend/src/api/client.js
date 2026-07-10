/**
 * API client for Karigar.pk backend.
 *
 * Connects to the FastAPI server. No mock fallback —
 * errors surface as toast notifications via the caller.
 */

const API_BASE = 'http://localhost:8000';
const TIMEOUT_MS = 30_000;

/* ── Helpers ──────────────────────────────────── */

class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.detail?.message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms),
    ),
  ]);
}

async function request(method, path, body) {
  const token = localStorage.getItem('karigar_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await withTimeout(fetch(`${API_BASE}${path}`, opts), TIMEOUT_MS);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

/* ── Public API ───────────────────────────────── */

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

export async function checkHealth() {
  return request('GET', '/health');
}

export async function loginApi(username, password) {
  return request('POST', '/api/v1/auth/login', { username, password });
}

export async function signupApi(payload) {
  return request('POST', '/api/v1/auth/signup', payload);
}

export async function getPublicStats() {
  return request('GET', '/api/v1/stats/public');
}

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

export async function getActiveServices() {
  return request('GET', '/api/v1/stats/services');
}

export async function confirmCompletion(sessionId, rating) {
  return request('POST', '/api/v1/confirm-completion', { session_id: sessionId, rating });
}

/**
 * Maps HTTP error status to a user-facing Roman Urdu message.
 */
export function getErrorMessage(err) {
  if (err instanceof ApiError) {
    // If the backend provided a specific detail message, prioritize it
    const detailMsg = err.body?.detail?.message || err.body?.message;
    if (detailMsg) return detailMsg;

    switch (err.status) {
      case 400:
        return 'Request mein masla hai.';
      case 404:
        return 'Koi provider nahi mila.';
      case 409:
        return 'Providers busy ho gaye, dobara try karein.';
      case 410:
        return 'Session expire ho gaya. Naya booking start karein.';
      case 429:
        return 'Bohat zyada requests. Thodi der baad try karein.';
      default:
        return 'Server error. Thodi der baad try karein.';
    }
  }

  if (err?.message === 'Request timed out') {
    return 'Server se connect nahi ho pa raha. Thodi der baad try karein.';
  }

  if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
    return 'Internet connection check karein.';
  }

  return 'System mein masla hain. Dobara try karein.';
}
