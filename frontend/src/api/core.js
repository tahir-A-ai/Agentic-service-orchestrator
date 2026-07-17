const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const TIMEOUT_MS = 30_000;

export class ApiError extends Error {
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

export async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);

  const res = await withTimeout(fetch(`${API_BASE}${path}`, opts), TIMEOUT_MS);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
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
