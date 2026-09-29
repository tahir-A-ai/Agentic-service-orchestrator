import { request } from './core';

export async function loginApi(email, password) {
  return request('POST', '/api/v1/auth/login', { email, password });
}

export async function signupApi(payload) {
  return request('POST', '/api/v1/auth/signup', payload);
}

export async function logoutApi() {
  return request('POST', '/api/v1/auth/logout');
}

export async function getMeApi() {
  return request('GET', '/api/v1/auth/me');
}

/**
 * Silently refresh the access token using the refresh_token HttpOnly cookie.
 * Returns { expires_in } — the new access token lifetime in seconds.
 * Called automatically by the core.js interceptor on 401, and explicitly
 * by AuthContext on tab focus when the local expiresAt is close to expiry.
 */
export async function refreshApi() {
  return request('POST', '/api/v1/auth/refresh');
}
