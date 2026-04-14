import { api } from './client';

export function createTenant(data) {
  return api.post('/onboarding/tenant', data);
}

export function completeSetup(data) {
  return api.post('/onboarding/setup', data);
}

/** GET /onboarding/config — tenant config (meta_phone_number_id, ai_system_prompt, etc.). */
export function getTenantConfig() {
  return api.get('/onboarding/config');
}

/** PATCH /onboarding/config — partial update of tenant config fields. */
export function patchTenantConfig(data) {
  return api.patch('/onboarding/config', data);
}

/** POST /onboarding/logo-upload — get a presigned S3 URL to upload a business logo.
 *  Returns { upload_url, logo_url }
 *  Step 1: PUT the file to upload_url with the correct Content-Type header.
 *  Step 2: PATCH /onboarding/config with { logo_url } to persist the public URL.
 */
export function getLogoUploadUrl(contentType = 'image/png') {
  return api.post('/onboarding/logo-upload', { content_type: contentType });
}
