# Property Image Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-driven image uploads to properties — cover + gallery — with public-read S3 storage, deletion, and cascade cleanup on property delete.

**Architecture:** Backend exposes a presigned-PUT endpoint (mirroring `get_document_upload_url` and `get_logo_upload_url`) and a delete endpoint that detaches images from the property record AND removes the S3 object. Frontend `PropertyForm` gains an "Imágenes" section that uploads files directly to S3 via presigned URLs and persists `image_url` + `gallery_urls` through the existing property `PUT`.

**Tech Stack:** Python 3.11 + boto3 (Lambda), pytest + moto (backend tests), React + Vite (frontend), `lucide-react` for icons. No new dependencies.

**Important context discovered while planning:**

- The S3 bucket policy already grants public read on `property-images/*` ([terraform/s3.tf:111-117](../../../terraform/s3.tf#L111-L117)) AND CORS is configured ([terraform/s3.tf:132-142](../../../terraform/s3.tf#L132-L142)).
- The properties Lambda IAM role already has `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the data bucket ([terraform/lambda.tf:65-78](../../../terraform/lambda.tf#L65-L78)).
- **→ Section 6 of the spec ("Infrastructure (Terraform)") is unnecessary. We use the existing `property-images/` prefix and existing IAM. No `.tf` files change in this plan.**
- `api.delete` in the frontend client doesn't accept a body. We add minimal body support so the delete endpoint can stay RESTful with a JSON body.

---

## File Structure

**Created:**
- (none — backend changes are inline in `handler.py`)

**Modified — backend:**
- `backend/functions/properties/handler.py` — add `get_image_upload_url`, add `delete_property_image`, extend `delete_property` to clean up S3, register two new routes.
- `backend/tests/test_properties_images.py` — **new file**, full test coverage for upload-url, delete-image, and delete-property cascade.

**Modified — frontend:**
- `frontend/src/api/client.js` — extend `api.delete` to accept optional JSON body.
- `frontend/src/api/properties.js` — add `getImageUploadUrl`, `deletePropertyImage` helpers.
- `frontend/src/pages/PropertyForm.jsx` — add "Imágenes" section above Documentos, wire upload/delete/swap-cover.

**Files NOT touched (intentional):**
- `backend/shared/models.py` — `image_url` and `gallery_urls` already exist on `Property`.
- `terraform/*.tf` — already configured (see context above).
- Public catalog pages (`PropertyList.jsx`, `PropertyCatalog.jsx`, `PropertyLanding.jsx`) — they already render `image_url`.

---

## Conventions used by this codebase

You will follow these patterns. They come from reading the existing code, not invented for this plan.

- **Lambda handler routing**: a single dispatcher in `properties/handler.py` matches by `method` + `path.endswith(...)`. Add new routes near the existing `upload-doc` route ([handler.py:967-969](../../../backend/functions/properties/handler.py#L967-L969)).
- **Tenant isolation**: every handler function receives `tenant_id` from the dispatcher; never read tenant from the request body.
- **Error responses**: use `error(msg, status)`, `server_error(msg)`, `not_found()` from `shared.response`.
- **Body parsing**: use `parse_body(event)` from `shared.utils`. It raises `json.JSONDecodeError` on bad input.
- **Tests**: use `make_api_event` from `tests/conftest.py` to build mock API Gateway events; use the `dynamodb_table` fixture for DDB; `moto.mock_aws` for S3.
- **Frontend uploads**: the documents pattern in [PropertyForm.jsx:128-164](../../../frontend/src/pages/PropertyForm.jsx#L128-L164) is the reference. Upload happens after a successful create/update, never before there's a property id.
- **Commits**: small, focused, conventional-style messages (`feat:`, `test:`, `refactor:`).

---

## Task 1: Backend — `get_image_upload_url` function (TDD)

**Files:**
- Modify: `backend/functions/properties/handler.py` (add new function near the existing document upload helper around line 477)
- Test:   `backend/tests/test_properties_images.py` (create new file)

- [ ] **Step 1.1: Create the test file with the first failing test**

Create `backend/tests/test_properties_images.py`:

```python
"""Tests for property image upload + delete handlers."""

import os
import sys
import json

import boto3
import pytest
from botocore.exceptions import ClientError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions", "properties"))

from tests.conftest import TENANT_ID, make_api_event


@pytest.fixture
def s3_data_bucket():
    """Create the data bucket via moto so presigned URLs can be generated."""
    from moto import mock_aws
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="clienta-ai-test-data")
        yield client


def _s3_object_missing(s3_client, bucket, key) -> bool:
    """Return True if head_object indicates the object is gone."""
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return False
    except ClientError as e:
        return e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound")


def test_upload_image_url_returns_presigned_put_for_jpeg(dynamodb_table, s3_data_bucket):
    import handler

    event = make_api_event(
        method="POST",
        path="/properties/upload-image",
        body={
            "property_id": "prop_abc",
            "filename": "kitchen.jpg",
            "content_type": "image/jpeg",
        },
    )
    event["tenant_id"] = TENANT_ID  # dispatcher injects this; we set it directly for the helper test

    response = handler.get_image_upload_url(TENANT_ID, event)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "upload_url" in body
    assert body["upload_url"].startswith("https://")
    assert body["s3_key"].startswith(f"property-images/{TENANT_ID}/prop_abc/")
    assert body["s3_key"].endswith(".jpg")
    assert body["image_url"].endswith(body["s3_key"])
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd /Users/david/Documents/Code/clienta_br/backend
pytest tests/test_properties_images.py::test_upload_image_url_returns_presigned_put_for_jpeg -v
```

Expected: **FAIL** with `AttributeError: module 'handler' has no attribute 'get_image_upload_url'`.

- [ ] **Step 1.3: Implement `get_image_upload_url` minimally**

In `backend/functions/properties/handler.py`, add **after** the existing `get_document_upload_url` function (around line 519). Place it within the "Document Upload URLs" section or add a new "Image Upload URLs" section comment:

```python
# ── Image Upload URLs ───────────────────────────────────────────────────

IMAGES_PREFIX = "property-images"
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def get_image_upload_url(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """POST /properties/upload-image — presigned PUT URL for a property image.

    Body: { property_id, filename, content_type }
    Returns: { upload_url, image_url, s3_key }
    """
    bucket = os.environ.get("DATA_BUCKET")
    region = os.environ.get("AWS_REGION", "us-east-1")
    if not bucket:
        return server_error("DATA_BUCKET not configured")

    try:
        body = parse_body(event)
    except json.JSONDecodeError:
        return error("Invalid JSON body", 400)

    property_id = (body.get("property_id") or "").strip()
    content_type = (body.get("content_type") or "").strip().lower()

    if not property_id:
        return error("property_id is required", 400)
    if content_type not in ALLOWED_IMAGE_MIMES:
        return error(
            f"Unsupported content_type. Allowed: {sorted(ALLOWED_IMAGE_MIMES)}",
            400,
        )

    ext = MIME_TO_EXT[content_type]
    key = f"{IMAGES_PREFIX}/{tenant_id}/{property_id}/{generate_id()}.{ext}"

    try:
        import boto3
        s3 = boto3.client("s3", region_name=region)
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=PRESIGNED_EXPIRY,
        )
    except Exception as e:
        return server_error(f"Failed to generate upload URL: {e}")

    image_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return success(body={"upload_url": upload_url, "image_url": image_url, "s3_key": key})
```

Note: `filename` from the request is intentionally ignored — we always derive the extension from `content_type`. This prevents content-type spoofing via crafted filenames.

- [ ] **Step 1.4: Run test to verify it passes**

```bash
pytest tests/test_properties_images.py::test_upload_image_url_returns_presigned_put_for_jpeg -v
```

Expected: **PASS**.

- [ ] **Step 1.5: Add the rejection tests**

Append to `tests/test_properties_images.py`:

```python
def test_upload_image_url_rejects_disallowed_mime(dynamodb_table, s3_data_bucket):
    import handler

    event = make_api_event(
        method="POST",
        path="/properties/upload-image",
        body={
            "property_id": "prop_abc",
            "filename": "evil.svg",
            "content_type": "image/svg+xml",
        },
    )
    response = handler.get_image_upload_url(TENANT_ID, event)
    assert response["statusCode"] == 400
    assert "Unsupported content_type" in json.loads(response["body"])["message"]


def test_upload_image_url_rejects_missing_property_id(dynamodb_table, s3_data_bucket):
    import handler

    event = make_api_event(
        method="POST",
        path="/properties/upload-image",
        body={"filename": "a.jpg", "content_type": "image/jpeg"},
    )
    response = handler.get_image_upload_url(TENANT_ID, event)
    assert response["statusCode"] == 400


def test_upload_image_url_picks_extension_from_mime_not_filename(dynamodb_table, s3_data_bucket):
    """A filename ending in .exe with image/png MIME must produce a .png key."""
    import handler

    event = make_api_event(
        method="POST",
        path="/properties/upload-image",
        body={
            "property_id": "prop_xyz",
            "filename": "evil.exe",
            "content_type": "image/png",
        },
    )
    response = handler.get_image_upload_url(TENANT_ID, event)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["s3_key"].endswith(".png")
```

- [ ] **Step 1.6: Run all tests in this file**

```bash
pytest tests/test_properties_images.py -v
```

Expected: 4 PASS.

- [ ] **Step 1.7: Commit**

```bash
git add backend/functions/properties/handler.py backend/tests/test_properties_images.py
git commit -m "feat(properties): add presigned image upload URL endpoint"
```

---

## Task 2: Backend — register `POST /properties/upload-image` route

**Files:**
- Modify: `backend/functions/properties/handler.py` around line 968 (where `upload-doc` is registered)

- [ ] **Step 2.1: Write the failing routing test**

Append to `backend/tests/test_properties_images.py`:

```python
def test_dispatcher_routes_upload_image(dynamodb_table, s3_data_bucket):
    import handler

    event = make_api_event(
        method="POST",
        path="/properties/upload-image",
        body={
            "property_id": "prop_abc",
            "filename": "x.jpg",
            "content_type": "image/jpeg",
        },
    )
    response = handler.handler(event, None)
    assert response["statusCode"] == 200
    assert "upload_url" in json.loads(response["body"])
```

- [ ] **Step 2.2: Run to confirm failure**

```bash
pytest tests/test_properties_images.py::test_dispatcher_routes_upload_image -v
```

Expected: FAIL — likely 405 ("Method not allowed") because the route isn't registered yet.

- [ ] **Step 2.3: Register the route**

In `handler.py`, find the existing line:

```python
        # Document upload URL
        if method == "POST" and path.endswith("/properties/upload-doc"):
            return get_document_upload_url(tenant_id, event)
```

Insert immediately after it:

```python
        # Image upload URL
        if method == "POST" and path.endswith("/properties/upload-image"):
            return get_image_upload_url(tenant_id, event)
```

- [ ] **Step 2.4: Run the routing test**

```bash
pytest tests/test_properties_images.py::test_dispatcher_routes_upload_image -v
```

Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add backend/functions/properties/handler.py backend/tests/test_properties_images.py
git commit -m "feat(properties): register POST /properties/upload-image route"
```

---

## Task 3: Backend — internal helper `_detach_and_delete_image`

This helper is used by Task 4 (delete endpoint) and Task 5 (cascade). Building it standalone avoids duplication.

**Files:**
- Modify: `backend/functions/properties/handler.py`
- Test:   `backend/tests/test_properties_images.py`

- [ ] **Step 3.1: Add the failing test**

Append to `tests/test_properties_images.py`:

```python
def test_detach_and_delete_image_removes_from_cover_and_s3(dynamodb_table, s3_data_bucket):
    """When the image_url is the cover, _detach should clear it and delete the S3 object."""
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    bucket = os.environ.get("DATA_BUCKET")
    s3_key = f"property-images/{TENANT_ID}/prop_x/abc123.jpg"
    image_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/{s3_key}"

    s3_data_bucket.put_object(Bucket=bucket, Key=s3_key, Body=b"fake-bytes")

    pk = build_pk(TENANT_ID)
    sk = build_sk("PROPERTY", "prop_x")
    put_item({
        "pk": pk, "sk": sk, "id": "prop_x",
        "name": "Test", "image_url": image_url, "gallery_urls": [],
    })

    updated = handler._detach_and_delete_image(TENANT_ID, "prop_x", image_url)

    assert updated["image_url"] in (None, "")
    # S3 object is gone
    assert _s3_object_missing(s3_data_bucket, bucket, s3_key)


def test_detach_and_delete_image_removes_from_gallery(dynamodb_table, s3_data_bucket):
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    bucket = os.environ.get("DATA_BUCKET")
    cover_key = f"property-images/{TENANT_ID}/prop_y/cover.jpg"
    gallery_key = f"property-images/{TENANT_ID}/prop_y/gallery1.jpg"
    cover_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/{cover_key}"
    gallery_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/{gallery_key}"
    s3_data_bucket.put_object(Bucket=bucket, Key=gallery_key, Body=b"x")

    pk = build_pk(TENANT_ID)
    sk = build_sk("PROPERTY", "prop_y")
    put_item({
        "pk": pk, "sk": sk, "id": "prop_y",
        "name": "Test", "image_url": cover_url, "gallery_urls": [gallery_url],
    })

    updated = handler._detach_and_delete_image(TENANT_ID, "prop_y", gallery_url)

    assert updated["image_url"] == cover_url  # cover unchanged
    assert gallery_url not in (updated.get("gallery_urls") or [])


def test_detach_and_delete_image_rejects_cross_tenant_url(dynamodb_table, s3_data_bucket):
    """An image URL whose key prefix doesn't start with this tenant must be rejected."""
    import handler

    bucket = os.environ.get("DATA_BUCKET")
    foreign_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/property-images/other-tenant/prop_z/x.jpg"

    with pytest.raises(handler.ImageOwnershipError):
        handler._detach_and_delete_image(TENANT_ID, "prop_z", foreign_url)


def test_detach_and_delete_image_tolerates_missing_s3_object(dynamodb_table, s3_data_bucket):
    """If the S3 object is already gone, the record must still be cleaned up."""
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    bucket = os.environ.get("DATA_BUCKET")
    s3_key = f"property-images/{TENANT_ID}/prop_q/never-uploaded.jpg"
    image_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/{s3_key}"
    # Note: NOT calling put_object — the S3 object does not exist.

    pk = build_pk(TENANT_ID)
    sk = build_sk("PROPERTY", "prop_q")
    put_item({
        "pk": pk, "sk": sk, "id": "prop_q",
        "name": "Test", "image_url": image_url, "gallery_urls": [],
    })

    # Must not raise
    updated = handler._detach_and_delete_image(TENANT_ID, "prop_q", image_url)
    assert updated["image_url"] in (None, "")
```

- [ ] **Step 3.2: Run to confirm failures**

```bash
pytest tests/test_properties_images.py -v -k detach
```

Expected: 4 FAIL on `AttributeError`.

- [ ] **Step 3.3: Implement helper + ownership exception**

Add to `handler.py` (just below the upload helper added in Task 1):

```python
class ImageOwnershipError(Exception):
    """Raised when an image_url does not belong to the caller's tenant/property."""


def _parse_image_key(image_url: str, bucket: str) -> str | None:
    """Return the S3 key from a fully-qualified image URL, or None if it doesn't match.

    Accepts the virtual-hosted style URL we emit:
      https://{bucket}.s3.{region}.amazonaws.com/{key}
    """
    if not image_url:
        return None
    marker = f"{bucket}.s3."
    idx = image_url.find(marker)
    if idx < 0:
        return None
    after = image_url[idx + len(marker):]
    slash = after.find("/")
    if slash < 0:
        return None
    return after[slash + 1:]


def _detach_and_delete_image(tenant_id: str, property_id: str, image_url: str) -> dict[str, Any]:
    """Remove image_url from the property record and delete the S3 object.

    Returns the updated property dict.
    Raises:
      ImageOwnershipError: if the URL is not within this tenant+property's image prefix.
      DynamoDBError: for DDB failures.
    """
    bucket = os.environ.get("DATA_BUCKET")
    region = os.environ.get("AWS_REGION", "us-east-1")
    if not bucket:
        raise RuntimeError("DATA_BUCKET not configured")

    key = _parse_image_key(image_url, bucket)
    expected_prefix = f"{IMAGES_PREFIX}/{tenant_id}/{property_id}/"
    if not key or not key.startswith(expected_prefix):
        raise ImageOwnershipError(
            f"image_url does not belong to tenant={tenant_id} property={property_id}"
        )

    pk = build_pk(tenant_id)
    sk = build_sk("PROPERTY", property_id)
    existing = get_item(pk=pk, sk=sk)
    if not existing:
        raise ImageOwnershipError(f"property {property_id} not found")

    updates: dict[str, Any] = {}
    if existing.get("image_url") == image_url:
        updates["image_url"] = None
    gallery = list(existing.get("gallery_urls") or [])
    if image_url in gallery:
        gallery = [u for u in gallery if u != image_url]
        updates["gallery_urls"] = gallery

    if updates:
        existing = update_item(pk=pk, sk=sk, updates=updates)

    # Tolerate missing S3 object (already deleted, or upload never completed).
    try:
        import boto3
        s3 = boto3.client("s3", region_name=region)
        s3.delete_object(Bucket=bucket, Key=key)
    except Exception as e:  # noqa: BLE001 — log-and-continue is intentional
        import logging
        logging.getLogger(__name__).warning("S3 delete failed for %s: %s", key, e)

    return existing
```

- [ ] **Step 3.4: Run to verify the four tests pass**

```bash
pytest tests/test_properties_images.py -v -k detach
```

Expected: 4 PASS.

- [ ] **Step 3.5: Commit**

```bash
git add backend/functions/properties/handler.py backend/tests/test_properties_images.py
git commit -m "feat(properties): add _detach_and_delete_image helper with tenant scoping"
```

---

## Task 4: Backend — `DELETE /properties/{id}/images` endpoint + route

**Files:**
- Modify: `backend/functions/properties/handler.py`
- Test:   `backend/tests/test_properties_images.py`

- [ ] **Step 4.1: Write the failing endpoint test**

Append to `tests/test_properties_images.py`:

```python
def test_delete_property_image_endpoint_happy_path(dynamodb_table, s3_data_bucket):
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    bucket = os.environ.get("DATA_BUCKET")
    cover_key = f"property-images/{TENANT_ID}/prop_a/cover.jpg"
    gallery_key = f"property-images/{TENANT_ID}/prop_a/gallery.jpg"
    cover_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/{cover_key}"
    gallery_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/{gallery_key}"
    s3_data_bucket.put_object(Bucket=bucket, Key=gallery_key, Body=b"x")

    put_item({
        "pk": build_pk(TENANT_ID), "sk": build_sk("PROPERTY", "prop_a"),
        "id": "prop_a", "name": "T", "image_url": cover_url,
        "gallery_urls": [gallery_url],
    })

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_a/images",
        body={"image_url": gallery_url},
        path_params={"id": "prop_a"},
    )
    response = handler.handler(event, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert gallery_url not in (body.get("gallery_urls") or [])


def test_delete_property_image_rejects_cross_tenant(dynamodb_table, s3_data_bucket):
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    bucket = os.environ.get("DATA_BUCKET")
    foreign_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/property-images/other/prop_b/x.jpg"

    put_item({
        "pk": build_pk(TENANT_ID), "sk": build_sk("PROPERTY", "prop_b"),
        "id": "prop_b", "name": "T",
    })

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_b/images",
        body={"image_url": foreign_url},
        path_params={"id": "prop_b"},
    )
    response = handler.handler(event, None)

    assert response["statusCode"] in (400, 403)


def test_delete_property_image_requires_image_url(dynamodb_table, s3_data_bucket):
    import handler

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_c/images",
        body={},
        path_params={"id": "prop_c"},
    )
    response = handler.handler(event, None)
    assert response["statusCode"] == 400
```

- [ ] **Step 4.2: Run to confirm failures**

```bash
pytest tests/test_properties_images.py -v -k delete_property_image
```

Expected: 3 FAIL.

- [ ] **Step 4.3: Implement endpoint handler**

Add to `handler.py` immediately after `_detach_and_delete_image`:

```python
def delete_property_image(
    tenant_id: str, property_id: str, event: dict[str, Any]
) -> dict[str, Any]:
    """DELETE /properties/{id}/images — remove one image from S3 and the record.

    Body: { image_url: str }
    """
    try:
        body = parse_body(event)
    except json.JSONDecodeError:
        return error("Invalid JSON body", 400)

    image_url = (body.get("image_url") or "").strip()
    if not image_url:
        return error("image_url is required", 400)

    try:
        updated = _detach_and_delete_image(tenant_id, property_id, image_url)
    except ImageOwnershipError as e:
        return error(str(e), 403)
    except DynamoDBError as e:
        return server_error(str(e))

    return success(body=Property.from_dynamo(updated).to_dict())
```

- [ ] **Step 4.4: Register the route**

In the dispatcher (around line 996, just before the existing DELETE route), add:

```python
        # Delete a single image from a property
        if method == "DELETE" and property_id and path.endswith(f"/properties/{property_id}/images"):
            return delete_property_image(tenant_id, property_id, event)
```

Place this **above** the existing `if method == "DELETE" and property_id: return delete_property(...)` line, so it matches first.

- [ ] **Step 4.5: Run the three tests**

```bash
pytest tests/test_properties_images.py -v -k delete_property_image
```

Expected: 3 PASS.

- [ ] **Step 4.6: Run the entire image test file to make sure nothing regressed**

```bash
pytest tests/test_properties_images.py -v
```

Expected: all PASS.

- [ ] **Step 4.7: Commit**

```bash
git add backend/functions/properties/handler.py backend/tests/test_properties_images.py
git commit -m "feat(properties): add DELETE /properties/{id}/images endpoint"
```

---

## Task 5: Backend — cascade S3 cleanup in `delete_property`

**Files:**
- Modify: `backend/functions/properties/handler.py:466-474` (the existing `delete_property` function)
- Test:   `backend/tests/test_properties_images.py`

- [ ] **Step 5.1: Write the failing test**

Append to `tests/test_properties_images.py`:

```python
def test_delete_property_cascades_image_cleanup(dynamodb_table, s3_data_bucket):
    """Deleting a property must also delete every object under its image prefix."""
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    bucket = os.environ.get("DATA_BUCKET")
    keys = [
        f"property-images/{TENANT_ID}/prop_del/img1.jpg",
        f"property-images/{TENANT_ID}/prop_del/img2.png",
        f"property-images/{TENANT_ID}/prop_del/img3.webp",
    ]
    for k in keys:
        s3_data_bucket.put_object(Bucket=bucket, Key=k, Body=b"x")

    put_item({
        "pk": build_pk(TENANT_ID), "sk": build_sk("PROPERTY", "prop_del"),
        "id": "prop_del", "name": "T",
    })

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_del",
        path_params={"id": "prop_del"},
    )
    response = handler.handler(event, None)

    assert response["statusCode"] in (200, 204)

    # Verify every object is gone
    for k in keys:
        assert _s3_object_missing(s3_data_bucket, bucket, k)


def test_delete_property_succeeds_even_when_no_images(dynamodb_table, s3_data_bucket):
    """A property with zero images must still be deletable."""
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    put_item({
        "pk": build_pk(TENANT_ID), "sk": build_sk("PROPERTY", "prop_empty"),
        "id": "prop_empty", "name": "T",
    })

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_empty",
        path_params={"id": "prop_empty"},
    )
    response = handler.handler(event, None)
    assert response["statusCode"] in (200, 204)
```

- [ ] **Step 5.2: Run to confirm failure**

```bash
pytest tests/test_properties_images.py -v -k cascades
```

Expected: FAIL — S3 objects survive the delete.

- [ ] **Step 5.3: Add a helper + extend `delete_property`**

Insert this helper next to the existing image helpers in `handler.py`:

```python
def _delete_all_property_images(tenant_id: str, property_id: str) -> None:
    """Best-effort: delete every S3 object under property-images/{tenant}/{prop}/.

    Logs and swallows individual errors so a partial S3 failure doesn't
    block the property delete.
    """
    bucket = os.environ.get("DATA_BUCKET")
    region = os.environ.get("AWS_REGION", "us-east-1")
    if not bucket:
        return

    prefix = f"{IMAGES_PREFIX}/{tenant_id}/{property_id}/"
    try:
        import boto3
        s3 = boto3.client("s3", region_name=region)
        keys: list[dict[str, str]] = []
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []) or []:
                keys.append({"Key": obj["Key"]})
        # delete_objects is limited to 1000 keys per call; chunk for safety.
        for i in range(0, len(keys), 1000):
            chunk = keys[i : i + 1000]
            if chunk:
                s3.delete_objects(Bucket=bucket, Delete={"Objects": chunk, "Quiet": True})
    except Exception as e:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).warning(
            "Failed cascade image cleanup for %s/%s: %s", tenant_id, property_id, e
        )
```

Now modify the existing `delete_property` function ([handler.py:466-474](../../../backend/functions/properties/handler.py#L466-L474)). Replace its body with:

```python
def delete_property(tenant_id: str, property_id: str) -> dict[str, Any]:
    """Delete a property + all associated S3 images."""
    pk = build_pk(tenant_id)
    sk = build_sk("PROPERTY", property_id)
    try:
        delete_item(pk=pk, sk=sk)
    except DynamoDBError as e:
        return server_error(str(e))

    # Best-effort S3 cleanup. Failures here must not block the response.
    _delete_all_property_images(tenant_id, property_id)

    return no_content()
```

- [ ] **Step 5.4: Run the cascade tests**

```bash
pytest tests/test_properties_images.py -v -k "cascades or no_images"
```

Expected: PASS.

- [ ] **Step 5.5: Run the full test suite to verify no regressions**

```bash
pytest -v
```

Expected: all PASS (existing + new image tests).

- [ ] **Step 5.6: Commit**

```bash
git add backend/functions/properties/handler.py backend/tests/test_properties_images.py
git commit -m "feat(properties): cascade S3 image cleanup on property delete"
```

---

## Task 6: Frontend — extend `api.delete` and add helpers

**Files:**
- Modify: `frontend/src/api/client.js:79`
- Modify: `frontend/src/api/properties.js` (append helpers)

- [ ] **Step 6.1: Extend `api.delete` to accept a body**

In `frontend/src/api/client.js`, replace line 79:

```js
  delete: (path) => request(path, { method: 'DELETE' }),
```

with:

```js
  delete: (path, data) =>
    data === undefined
      ? request(path, { method: 'DELETE' })
      : request(path, { method: 'DELETE', body: JSON.stringify(data) }),
```

This is backwards-compatible — every existing `api.delete(path)` call keeps working.

- [ ] **Step 6.2: Add API helpers in `frontend/src/api/properties.js`**

Append after the existing `getDocumentUploadUrl` (around line 69):

```js
/** Get a presigned PUT URL to upload an image for a property. */
export function getImageUploadUrl({ propertyId, filename, contentType }) {
  return api.post('/properties/upload-image', {
    property_id: propertyId,
    filename: filename || 'image.jpg',
    content_type: contentType || 'image/jpeg',
  });
}

/** Delete a single image from a property (S3 + record). */
export function deletePropertyImage({ propertyId, imageUrl }) {
  return api.delete(`/properties/${propertyId}/images`, { image_url: imageUrl });
}
```

- [ ] **Step 6.3: Manual smoke check — open a dev console**

Run the frontend (`cd frontend && npm run dev`) and in any page's DevTools console, paste:

```js
// Just verify the helpers are wired (don't actually call yet):
import('/src/api/properties.js').then(m => console.log(typeof m.getImageUploadUrl, typeof m.deletePropertyImage));
```

Expected: `function function`. (You can skip this if the dev server isn't running; the real verification happens in Task 8.)

- [ ] **Step 6.4: Commit**

```bash
git add frontend/src/api/client.js frontend/src/api/properties.js
git commit -m "feat(frontend): add image upload + delete API helpers"
```

---

## Task 7: Frontend — "Imágenes" section in `PropertyForm.jsx`

**Files:**
- Modify: `frontend/src/pages/PropertyForm.jsx`

This is the largest task. We add new state, two upload/delete handlers, and a new section in the JSX. We mirror the existing documents pattern.

- [ ] **Step 7.1: Update imports**

At the top of `PropertyForm.jsx`, the existing import block from `'../api/properties'` is on line 21:

```js
import { getDocumentUploadUrl, processDocument } from '../api/properties';
```

Replace with:

```js
import {
  getDocumentUploadUrl,
  processDocument,
  getImageUploadUrl,
  deletePropertyImage,
} from '../api/properties';
```

The lucide-react `Image`, `X`, `Upload`, `Loader2`, `Star` (new) icons are needed. The current import block has `Image`, `X`, `Upload`, `Loader2`. **Add `Star` and `Trash2`** to it.

Find:

```js
import {
  Building2,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Home,
  Upload,
  FileText,
  Image,
  X,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
```

Replace with (adds `Star` and `Trash2`):

```js
import {
  Building2,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Home,
  Upload,
  FileText,
  Image,
  X,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Star,
  Trash2,
} from 'lucide-react';
```

- [ ] **Step 7.2: Add state and refs for images**

In the component body, locate the documents state (around line 67-68):

```js
  const [form, setForm] = useState(INITIAL_FORM);
  const [documents, setDocuments] = useState([]);
```

Add right after:

```js
  const [coverUrl, setCoverUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
```

Locate the file input ref block (around line 63-65):

```js
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const flyerInputRef = useRef(null);
```

Add:

```js
  const imageInputRef = useRef(null);
```

- [ ] **Step 7.3: Hydrate image state when editing**

The existing `useEffect` at line 77 populates `form` from `existingProperty`. Inside that same effect (after the `setForm({...})` call, still inside the `if (existingProperty && isEditing) { ... }` block), append:

```js
      setCoverUrl(existingProperty.image_url || '');
      setGalleryUrls(existingProperty.gallery_urls || []);
```

- [ ] **Step 7.4: Add image upload + delete handlers**

After the existing `removeDoc` function (around line 126), add this block of handlers:

```js
  // ── Images ──────────────────────────────────────────────────────
  const MAX_IMAGES = 20;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const handleImagePick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file later
    if (!id) {
      setToast({ type: 'error', message: 'Guarda la propiedad antes de subir imágenes.' });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    const total = (coverUrl ? 1 : 0) + galleryUrls.length;
    const room = MAX_IMAGES - total;
    if (room <= 0) {
      setToast({ type: 'error', message: `Máximo ${MAX_IMAGES} imágenes.` });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    const accepted = files.slice(0, room);

    setImageUploading(true);
    try {
      for (const file of accepted) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          setToast({ type: 'error', message: `Tipo no permitido: ${file.name}` });
          setTimeout(() => setToast(null), 4000);
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          setToast({ type: 'error', message: `${file.name} supera 10 MB.` });
          setTimeout(() => setToast(null), 4000);
          continue;
        }

        const { upload_url, image_url } = await getImageUploadUrl({
          propertyId: id,
          filename: file.name,
          contentType: file.type,
        });

        await fetch(upload_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        // First image becomes cover automatically.
        if (!coverUrl) {
          setCoverUrl(image_url);
        } else {
          setGalleryUrls((prev) => [...prev, image_url]);
        }
      }
    } catch (err) {
      setToast({ type: 'error', message: `Error subiendo imagen: ${err.message}` });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSetCover = (url) => {
    if (!url || url === coverUrl) return;
    const oldCover = coverUrl;
    setCoverUrl(url);
    setGalleryUrls((prev) => {
      const without = prev.filter((u) => u !== url);
      return oldCover ? [oldCover, ...without] : without;
    });
  };

  const handleDeleteImage = async (url) => {
    if (!id) return;
    try {
      await deletePropertyImage({ propertyId: id, imageUrl: url });
      if (coverUrl === url) setCoverUrl('');
      setGalleryUrls((prev) => prev.filter((u) => u !== url));
    } catch (err) {
      setToast({ type: 'error', message: `No se pudo eliminar: ${err.message}` });
      setTimeout(() => setToast(null), 5000);
    }
  };
```

- [ ] **Step 7.5: Include image fields in the submit payload + redirect to edit mode after create**

Find the `handleSubmit` function (around line 218). Inside the `payload` object, add `image_url` and `gallery_urls`:

```js
    const payload = {
      ...form,
      price: form.price ? Number(form.price) : undefined,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      parking_spots: form.parking_spots ? Number(form.parking_spots) : undefined,
      area_m2: form.area_m2 ? Number(form.area_m2) : undefined,
      year_built: form.year_built ? Number(form.year_built) : undefined,
      floor_number: form.floor_number ? Number(form.floor_number) : undefined,
      image_url: coverUrl || null,
      gallery_urls: galleryUrls,
    };
```

Now change the post-submit navigation so a fresh create lands in edit mode (where image uploads are allowed). Find:

```js
      if (propertyId) await uploadDocuments(propertyId);
      navigate('/br/properties');
```

Replace with:

```js
      if (propertyId) await uploadDocuments(propertyId);
      // After CREATE, drop the user into edit mode so they can upload images.
      // After UPDATE, return to the list as before.
      if (isEditing) {
        navigate('/br/properties');
      } else {
        navigate(`/br/properties/${propertyId}`);
        setToast({ type: 'success', message: 'Propiedad creada. Ya puedes subir imágenes.' });
        setTimeout(() => setToast(null), 4000);
      }
```

- [ ] **Step 7.6: Add the "Imágenes" section to the JSX**

Find the "Documents" section (starts around line 495 with `{/* Documents */}`). **Insert this block immediately above it** so the order in the form is: Property fields → Imágenes → Documentos:

```jsx
        {/* Images */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-2">
            <Image className="h-5 w-5 text-emerald-600" />
            Imágenes
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            La primera imagen será la portada. Puedes cambiarla con el botón de estrella.
            Máximo {MAX_IMAGES} imágenes, 10 MB cada una. Formatos: JPG, PNG, WebP.
          </p>

          {!isEditing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Guarda la propiedad para poder subir imágenes.
            </div>
          )}

          {isEditing && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImagePick}
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {coverUrl && (
                  <div className="relative col-span-2 sm:col-span-3">
                    <img
                      src={coverUrl}
                      alt="Portada"
                      className="h-48 w-full rounded-lg object-cover ring-2 ring-emerald-500"
                    />
                    <span className="absolute left-2 top-2 rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                      Portada
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(coverUrl)}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-700 hover:bg-red-50 hover:text-red-600"
                      aria-label="Eliminar portada"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {galleryUrls.map((url) => (
                  <div key={url} className="relative">
                    <img
                      src={url}
                      alt="Imagen de propiedad"
                      className="h-32 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleSetCover(url)}
                      className="absolute left-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-gray-700 hover:bg-amber-50 hover:text-amber-600"
                      aria-label="Hacer portada"
                      title="Hacer portada"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(url)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-gray-700 hover:bg-red-50 hover:text-red-600"
                      aria-label="Eliminar imagen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading || (coverUrl ? 1 : 0) + galleryUrls.length >= MAX_IMAGES}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm font-medium text-gray-500 transition-colors hover:border-emerald-400 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {imageUploading ? 'Subiendo...' : 'Subir Imágenes'}
              </button>
            </>
          )}
        </div>

```

- [ ] **Step 7.7: Smoke check — does it compile?**

```bash
cd /Users/david/Documents/Code/clienta_br/frontend
npm run build
```

Expected: build succeeds with no errors. If lint warnings about unused imports show up, they're fine.

- [ ] **Step 7.8: Commit**

```bash
git add frontend/src/pages/PropertyForm.jsx
git commit -m "feat(frontend): add property image upload UI with cover + gallery"
```

---

## Task 8: Manual verification against acceptance criteria

This task is intentionally manual — the frontend has no test infrastructure. Run through every acceptance criterion from the spec.

**Prereqs:** Backend deployed (or running locally with the data bucket present), frontend built with `VITE_API_URL` pointing at the API.

- [ ] **Step 8.1: AC1 — Upload up to N images**

In the property form (edit mode for an existing property), click **Subir Imágenes**, select 3 JPG/PNG/WebP files. Each should upload with a visible spinner and appear as a thumbnail.

- [ ] **Step 8.2: AC2 — First upload becomes cover**

When the property had no cover, the first uploaded image renders in the highlighted "Portada" slot with the green ring. Subsequent uploads go to the gallery grid below.

- [ ] **Step 8.3: AC3 — Promote a gallery image to cover**

Click the star icon on a gallery thumbnail. It should swap into the cover slot, and the previous cover should appear in the gallery. Click **Actualizar Inmueble**, refresh, and confirm the swap persisted.

- [ ] **Step 8.4: AC4 — Delete an image**

Click the trash icon on any image. The thumbnail disappears immediately. Verify in S3 console (or `aws s3 ls s3://<bucket>/property-images/<tenant>/<prop>/`) that the underlying object is gone.

- [ ] **Step 8.5: AC5 — Public catalog renders new images**

Open the public catalog page (no auth) and confirm the property's `image_url` renders. The browser network tab should show a 200 from the direct `https://<bucket>.s3...` URL.

- [ ] **Step 8.6: AC6 — Property delete cascades**

Upload 2-3 images to a throwaway property, then delete the property from the list view. Verify that `aws s3 ls s3://<bucket>/property-images/<tenant>/<that-prop>/` returns nothing.

- [ ] **Step 8.7: AC7 — Cross-tenant attempt is blocked**

In DevTools, run:

```js
fetch('/properties/MY_PROP_ID/images', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await window.fetchAuthSession?.())?.tokens?.idToken?.toString?.() },
  body: JSON.stringify({ image_url: 'https://<bucket>.s3.us-east-1.amazonaws.com/property-images/SOME_OTHER_TENANT/x/y.jpg' }),
}).then(r => r.status);
```

Expected: 403 (or 400 with the ownership message). It must NOT be 200.

- [ ] **Step 8.8: Final commit (only if there are tweaks)**

If you found and fixed a small issue during manual verification, commit it now. Otherwise nothing to do.

```bash
git status
# only commit if the manual run revealed something
```

---

## Self-review checklist (run after the plan is implemented)

- All backend tests in `tests/test_properties_images.py` pass.
- Full backend test suite passes (`pytest -v`).
- Frontend builds (`npm run build`).
- All 7 acceptance criteria from the spec are verified.
- No `terraform apply` was needed (per the discovery in this plan).
- No edits were made to `Property` model or to `PropertyList.jsx` / catalog pages.
