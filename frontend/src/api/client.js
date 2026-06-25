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
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await withTimeout(fetch(`${API_BASE}${path}`, opts), TIMEOUT_MS);

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, json);
  }

  return json;
}

/* ── Public API ───────────────────────────────── */

/**
 * Phase 1 — Ask the ReAct agent to find providers.
 * @param {string} userPrompt
 * @param {string|null} sessionId — pass existing ID for follow-up messages
 */
export async function bookService(userPrompt, sessionId = null) {
  const payload = { user_prompt: userPrompt };
  if (sessionId) payload.session_id = sessionId;
  return request('POST', '/api/v1/book-service', payload);
}

/**
 * Phase 2 — Confirm booking with approved provider IDs.
 * @param {string} sessionId
 * @param {number[]} approvedProviderIds
 */
export async function confirmBooking(sessionId, approvedProviderIds) {
  return request('POST', '/api/v1/confirm-booking', {
    session_id: sessionId,
    approved_provider_ids: approvedProviderIds,
  });
}

/**
 * Health check.
 */
export async function checkHealth() {
  return request('GET', '/health');
}

/**
 * Maps HTTP error status to a user-facing Roman Urdu message.
 */
export function getErrorMessage(err) {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return err.body?.detail?.message || 'Request mein masla hai.';
      case 404:
        return 'Koi provider nahi mila.';
      case 409:
        return 'Providers busy ho gaye, dobara try karein.';
      case 429:
        return 'Bohat zyada requests. Thodi der baad try karein.';
      default:
        return 'Server error. Thodi der baad try karein.';
    }
  }

  if (err?.message === 'Request timed out') {
    return 'Request ka waqt khatam. Dobara try karein.';
  }

  if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
    return 'Internet connection check karein.';
  }

  return 'Kuch galat ho gaya. Dobara try karein.';
}
