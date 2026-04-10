import { api } from './client';

export function fetchAppointments({ status, phone, limit } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (phone) params.set('phone', phone);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  return api.get(`/appointments${qs ? `?${qs}` : ''}`);
}

export function fetchAppointment(id) {
  return api.get(`/appointments/${id}`);
}

export function patchAppointment(id, data) {
  return api.patch(`/appointments/${id}`, data);
}

export function deleteAppointment(id) {
  return api.delete(`/appointments/${id}`);
}
