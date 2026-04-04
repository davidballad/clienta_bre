import { api, getTokenGetter } from './client';

const API_URL = import.meta.env.VITE_API_URL || '';

/** Fetch properties list with optional filters. */
export function fetchProperties({ status, transactionType, city, search, nextToken, limit } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (transactionType) params.set('transaction_type', transactionType);
  if (city) params.set('city', city);
  if (search) params.set('search', search);
  if (nextToken) params.set('next_token', nextToken);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return api.get(`/properties${qs ? `?${qs}` : ''}`);
}

/** Fetch a single property by ID. */
export function fetchProperty(id) {
  return api.get(`/properties/${id}`);
}

/** Create a new property listing. */
export function createProperty(data) {
  return api.post('/properties', data);
}

/** Update an existing property. */
export function updateProperty(id, data) {
  return api.put(`/properties/${id}`, data);
}

/** Delete a property. */
export function deleteProperty(id) {
  return api.delete(`/properties/${id}`);
}

/** Get property stats (total, by_status, by_type). */
export function fetchPropertyStats() {
  return api.get('/properties/stats');
}

/** Get presigned upload URL for property documents (escrituras, planos, etc.). */
export function getDocumentUploadUrl({ propertyId, filename, contentType }) {
  return api.post('/properties/upload-doc', {
    property_id: propertyId,
    filename: filename || 'document.pdf',
    content_type: contentType || 'application/pdf',
  });
}

/** Import properties from CSV text. */
export function importPropertiesCsv(csvText) {
  return api.postRaw('/properties/import', csvText, 'text/csv');
}

/** Download CSV import template. */
export async function downloadPropertyTemplate() {
  if (API_URL) {
    const getToken = getTokenGetter();
    const token = getToken?.();
    const res = await fetch(`${API_URL}/properties/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download template');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'properties_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    const csv = 'name,transaction_type,property_type,price,city,neighborhood,bedrooms,bathrooms,parking_spots,area_m2,description,amenities,image_url,project_name,reference_code,tags\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'properties_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
