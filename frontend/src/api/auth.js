import { request } from './core';

export async function loginApi(email, password) {
  return request('POST', '/api/v1/auth/login', { email, password });
}

export async function signupApi(payload) {
  return request('POST', '/api/v1/auth/signup', payload);
}

/**
 * End the current authenticated session.
 * @return {*} The logout request result.
 */
export async function logoutApi() {
  return request('POST', '/api/v1/auth/logout');
}

/**
 * Fetch the authenticated user's profile.
 * @return {Promise<Object>} The authenticated user's profile.
 */
export async function getMeApi() {
  return request('GET', '/api/v1/auth/me');
}
