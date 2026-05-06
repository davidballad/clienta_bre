import { api } from './client';

export function fetchUsers() {
  return api.get('/users');
}

export function fetchUser(id) {
  return api.get(`/users/${id}`);
}

export function updateUser(id, data) {
  return api.put(`/users/${id}`, data);
}

export function deactivateUser(id) {
  return api.delete(`/users/${id}`);
}
