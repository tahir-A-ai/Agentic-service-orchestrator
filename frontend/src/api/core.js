export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
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

// ── Silent token refresh ─────────────────────────────────────────────────────
// When an access_token expires (401), we call /auth/refresh once to silently
// get a new access_token cookie, then retry the original request.
// All concurrent requests that fail during the refresh window are queued and
// replayed after the refresh completes — so the user never sees a 401 toast.

let _isRefreshing = false;
let _pendingQueue = [];

function _processQueue(error) {
  _pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve()
  );
  _pendingQueue = [];
}

async function _doRefresh() {
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('refresh_failed');
  const data = await res.json().catch(() => ({}));
  // Update local expiresAt so the AuthContext timer resets correctly
  if (data.expires_in) {
    const expiresAt = Date.now() + data.expires_in * 1000;
    window.dispatchEvent(new CustomEvent('auth:token_refreshed', { detail: { expiresAt } }));
  }
}

// ── Core request function ────────────────────────────────────────────────────

export async function request(method, path, body, timeoutMs = TIMEOUT_MS) {
  const headers = {};
  const opts = { method, headers, credentials: 'include' };

  if (body) {
    if (body instanceof FormData) {
      opts.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await withTimeout(fetch(`${API_BASE}${path}`, opts), timeoutMs);
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const isExpired =
      res.status === 401 &&
      path !== '/api/v1/auth/login' &&
      path !== '/api/v1/auth/refresh';

    if (isExpired) {
      // Try a silent refresh, then replay the original request once
      if (!_isRefreshing) {
        _isRefreshing = true;
        try {
          await _doRefresh();
          _processQueue(null);
        } catch (err) {
          _processQueue(err);
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: json }));
          throw new ApiError(res.status, json);
        } finally {
          _isRefreshing = false;
        }
      } else {
        // Another request is already refreshing — queue this one
        await new Promise((resolve, reject) =>
          _pendingQueue.push({ resolve, reject })
        );
      }
      // Replay the original request with the freshly set cookie, keeping the same timeout
      const retryRes = await withTimeout(fetch(`${API_BASE}${path}`, opts), timeoutMs);
      const retryJson = await retryRes.json().catch(() => null);
      if (!retryRes.ok) throw new ApiError(retryRes.status, retryJson);
      return retryJson;
    }

    throw new ApiError(res.status, json);
  }

  return json;
}

/**
 * Maps HTTP error status to a user-facing Roman Urdu message.
 */
export function getErrorMessage(err) {
  if (err instanceof ApiError) {
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
