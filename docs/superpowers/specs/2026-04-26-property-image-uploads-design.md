# Property Image Uploads — Design

**Date:** 2026-04-26
**Status:** Approved (ready for implementation plan)

## Problem

Properties can hold a cover image (`image_url`) and a gallery (`gallery_urls`) in the data model, but there is no way for users to upload images from the UI. The fields are populated only by CSV import or by AI flyer extraction. A first-class upload experience is missing.

Out of scope: vision/RAG over property photos. Confirmed by the user — photos are presentational only and will not be embedded.

## Goals

- Let an authenticated user attach images to a property from `PropertyForm.jsx`.
- Support a designated cover image plus an unordered gallery.
- Make images publicly viewable so the public property catalog renders them without auth.
- Clean up S3 when images or properties are deleted.

## Non-goals

- Server-side thumbnail/resize generation (defer until performance demands it).
- Drag-to-reorder gallery (only "make this the cover" swap for now).
- Embedding photos for RAG/semantic search.
- Image variants / responsive sizes / CDN — current bucket + CSS `object-fit` is enough for v1.

## Decisions

### D1. Data model — keep existing fields

Use the existing `Property.image_url: str | None` (cover) and `Property.gallery_urls: list[str] | None` (rest). No migration.

**Why:** the public catalog ([PropertyList.jsx:83](../../../frontend/src/pages/PropertyList.jsx#L83), `PropertyCatalog.jsx`, `PropertyLanding.jsx`), the CSV import/template ([handler.py:528](../../../backend/functions/properties/handler.py#L528)), and the AI flyer extraction already read/write these fields. Collapsing into a single `images: list[str]` would force compatibility shims everywhere for marginal benefit. The "swap cover ↔ gallery item" operation is a 5-line frontend helper.

### D2. Public read access for image prefix

Object key prefix `properties/{tenant_id}/{property_id}/images/{uuid}.{ext}` is publicly readable via S3 bucket policy. Documents under the legal-document prefix remain private (presigned-only).

**Why:** the marketing catalog ([fetchPublicProperties](../../../frontend/src/api/properties.js#L6)) is unauthenticated. Public-read URLs are stable, cacheable, and free of latency overhead. There is no sensitive data in property marketing photos.

### D3. Upload via presigned PUT (mirror existing pattern)

Reuse the presigned-URL pattern from `get_document_upload_url` ([handler.py:480](../../../backend/functions/properties/handler.py#L480)) and `get_logo_upload_url` ([onboarding/handler.py:776](../../../backend/functions/onboarding/handler.py#L776)). Frontend gets a PUT URL and uploads the bytes directly to S3, bypassing Lambda's 6 MB payload limit.

### D4. Property record updates stay in `PUT /properties/{id}`

The frontend updates `image_url` and `gallery_urls` via the existing property update endpoint after uploads complete. We do not introduce a dedicated "attach image to property" endpoint.

**Why:** symmetry with how documents work today, fewer endpoints, and the form already does a single `PUT` on save.

## API design

### `POST /properties/upload-image`

Generate a presigned PUT URL for a single image.

**Request body:**
```json
{
  "property_id": "prop_abc123",
  "filename": "kitchen.jpg",
  "content_type": "image/jpeg"
}
```

**Validation:**
- `content_type` must be one of: `image/jpeg`, `image/png`, `image/webp`.
- Extension must be one of: `jpg`, `jpeg`, `png`, `webp`. If the filename has a different/missing extension, derive from content type.
- `property_id` must be present (we accept upload requests for a property that's about to be created — see "Lifecycle" below).

**Response (200):**
```json
{
  "upload_url": "https://s3.../...?X-Amz-Signature=...",
  "image_url":  "https://<bucket>.s3.<region>.amazonaws.com/properties/<tenant>/<prop>/images/<uuid>.jpg",
  "s3_key":     "properties/<tenant>/<prop>/images/<uuid>.jpg"
}
```

**Errors:**
- 400: missing fields, unsupported content type, invalid extension.
- 500: failed to sign URL.

**Auth:** standard tenant auth wrapper. The handler scopes the S3 key under the caller's `tenant_id`, so a caller cannot upload into another tenant's prefix.

### `DELETE /properties/{id}/images`

Remove one image from S3 and from the property record.

**Request body:**
```json
{ "image_url": "https://<bucket>.s3.<region>.amazonaws.com/properties/<tenant>/<prop>/images/<uuid>.jpg" }
```

**Behavior:**
1. Parse the S3 key from `image_url`. Reject (400) if the key doesn't start with `properties/{caller_tenant_id}/{path-id}/images/` — this is the IDOR guard.
2. Verify `path-id == {id}` (URL property id matches key) to prevent cross-property mutation via this endpoint.
3. Load the property record; reject (404) if not found / wrong tenant.
4. If `property.image_url == image_url`: clear it. If a gallery image exists, **do not** auto-promote — leave the cover empty so the user makes an explicit choice. (Frontend can immediately call PUT to assign a new cover before deletion if desired.)
5. If `image_url` is in `gallery_urls`: remove it.
6. `s3:DeleteObject` on the S3 key. Tolerate `NoSuchKey` (already gone) — still update the record.
7. PUT the updated property (re-using internal update logic, not the public handler).

**Response:** the updated property.

### `DELETE /properties/{id}` (existing endpoint — extend)

When a property is deleted, also delete every object under `properties/{tenant_id}/{property_id}/images/`. Use `list_objects_v2` + `delete_objects` (batched). Best-effort: log and swallow individual S3 errors so a partial S3 failure does not block the property delete.

This mirrors how `delete_property_documents` ([documents.py:374](../../../backend/functions/properties/documents.py#L374)) handles vector cleanup.

## Lifecycle: how the form works

Two cases:

**A. Editing an existing property.** `property_id` is known. Pattern matches the existing documents flow:

1. User picks files (input + drag-drop dropzone).
2. For each file, frontend calls `POST /properties/upload-image` to get a presigned URL.
3. Frontend `PUT`s the bytes to S3.
4. On success, the new public `image_url` is appended to a local in-memory list of "pending images" and rendered as a thumbnail.
5. When the user submits the form, the standard `PUT /properties/{id}` includes the updated `image_url` (cover) + `gallery_urls`.
6. Deletion: clicking the trash icon calls `DELETE /properties/{id}/images` immediately (does not wait for form submit), so the S3 object isn't orphaned if the user navigates away.

**B. Creating a new property.** No `property_id` exists yet. Two sub-options:

- **Chosen approach:** create the property record first (with empty images), then enter "edit mode" so uploads can attach to the new id. The existing form already does `createProperty` then continues with documents in edit mode for the same reason ([PropertyForm.jsx:241](../../../frontend/src/pages/PropertyForm.jsx#L241)). Reuse this; do not invent a new flow.

This means the "Imágenes" section is **disabled until the property has been saved at least once**, with a hint: *"Guarda la propiedad para poder subir imágenes."* Same UX as documents today — consistency over cleverness.

## Frontend changes

### New API helpers — `frontend/src/api/properties.js`

```js
export function getImageUploadUrl({ propertyId, filename, contentType }) {
  return api.post('/properties/upload-image', {
    property_id: propertyId,
    filename,
    content_type: contentType,
  });
}

export function deletePropertyImage({ propertyId, imageUrl }) {
  return api.del(`/properties/${propertyId}/images`, { image_url: imageUrl });
}
```

(If `api.del` does not exist with a body argument, follow the same approach used elsewhere in the file or add the minimum needed.)

### `PropertyForm.jsx` — new "Imágenes" section

Place above the "Documentos" section. Components:

- **Dropzone** with `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`.
- **Validation on selection:** reject files >10 MB and unsupported types with an inline error toast.
- **Per-file pipeline:** `getImageUploadUrl` → `fetch(upload_url, { method: 'PUT', body: file })` → on success, push `image_url` into local state.
- **Cover slot** rendered first; if empty, the first uploaded image auto-fills it.
- **Gallery grid** below cover.
- **Per-thumbnail actions:**
  - 🗑 **Delete** → calls `deletePropertyImage` immediately, removes from local state, refreshes the property to pick up server-side state (so `image_url`/`gallery_urls` stay in sync).
  - ⭐ **Hacer portada** (gallery items only) → swap with current cover in local state. Persisted on next form save via `PUT /properties/{id}`.
- **Soft cap:** 20 images. Disable the picker once reached and show "Máximo 20 imágenes".

### Other frontend touches

- None required to display — `PropertyList.jsx`, `PropertyCatalog.jsx`, `PropertyLanding.jsx` already render `image_url`. Optionally, render the gallery on detail pages later (out of scope).

## Infrastructure (Terraform)

In `terraform/lambda.tf` (or the dedicated S3 module if one exists — investigate during implementation):

1. **Bucket policy statement** allowing `s3:GetObject` from `Principal: "*"` on `arn:aws:s3:::<DATA_BUCKET>/properties/*/images/*`. Do not relax the bucket-wide ACL; just this prefix.
2. **Lambda IAM additions** for the properties function:
   - `s3:DeleteObject` on `arn:aws:s3:::<DATA_BUCKET>/properties/*`
   - `s3:ListBucket` on `arn:aws:s3:::<DATA_BUCKET>` with a condition limiting `s3:prefix` to `properties/*` (so we can list a property's images for cascade delete).
3. Verify the bucket has **Block Public Access** off for "policies" (the public-read policy must be allowed). If it's currently fully blocked, narrow the block-public-access settings to permit policy-based public reads while still blocking ACL-based and arbitrary public reads.

## Validation summary

| Check | Where | Rule |
|---|---|---|
| Content type allowed | Frontend + Backend | `image/jpeg` \| `image/png` \| `image/webp` |
| Extension allowed | Backend | `jpg` \| `jpeg` \| `png` \| `webp` |
| Max file size | Frontend | 10 MB (soft check before requesting URL) |
| Max gallery size | Frontend | 20 images |
| Tenant scoping | Backend | S3 key always under caller's `tenant_id`; delete rejects keys outside it |
| Property scoping | Backend (delete) | URL property id must match the key's property id |

We do not enforce file-size on S3 via signed conditions in v1 (would require POST-policy uploads instead of presigned PUT, breaking pattern parity). The frontend check is sufficient for honest clients; a malicious client uploading huge files is bounded by S3 cost. Revisit if abuse is observed.

## Risks & open notes

- **Public bucket misconfiguration**: the most common failure mode. Mitigated by writing the policy narrowly to the `properties/*/images/*` prefix and verifying with `aws s3api get-public-access-block` after deploy.
- **Orphaned S3 objects**: if the frontend uploads then crashes before the property `PUT`, the object stays in S3 untracked. Acceptable for v1 — a periodic cleanup job (objects in `properties/*/images/*` not referenced by any property record) could be added later. Not in scope.
- **Cover-swap race**: if two tabs edit the same property, the last `PUT` wins. Existing limitation of the property update flow, not new to this feature.

## Acceptance criteria

1. From the property form (edit mode), I can select up to N images and they upload directly to S3 with a visible progress/loading state.
2. The first uploaded image becomes the cover automatically; subsequent ones go to the gallery.
3. I can promote any gallery image to cover, persisted on form save.
4. I can delete an image; it disappears from the UI and from S3 within seconds.
5. The public catalog renders the new images via direct S3 URLs without auth.
6. Deleting a property removes every associated image from S3.
7. A user from tenant A cannot upload to or delete from tenant B's image prefix (verified by attempting a crafted request).

## Implementation order

1. Backend `POST /properties/upload-image` (handler + route registration).
2. Backend `DELETE /properties/{id}/images`.
3. Backend cascade in property delete handler.
4. Terraform: bucket policy + Lambda IAM updates.
5. Frontend API helpers.
6. `PropertyForm.jsx` "Imágenes" section.
7. Manual verification against the 7 acceptance criteria.
