import { request } from './core';

export async function loginApi(username, password) {
  return request('POST', '/api/v1/auth/login', { username, password });
}

export async function signupApi(payload) {
  return request('POST', '/api/v1/auth/signup', payload);
}

export async function logoutApi() {
  return request('POST', '/api/v1/auth/logout');
}
