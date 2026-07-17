import { request } from './core';

export async function getPublicStats() {
  return request('GET', '/api/v1/stats/public');
}

export async function getActiveServices() {
  return request('GET', '/api/v1/stats/services');
}

export async function getServiceTypes() {
  return request('GET', '/api/v1/service-types');
}
