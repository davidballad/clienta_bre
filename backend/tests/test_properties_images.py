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
def s3_data_bucket(dynamodb_table):
    """Create the data bucket inside the active moto context started by dynamodb_table.

    Depending on dynamodb_table guarantees a single mock_aws() session covers both
    DynamoDB and S3 so handler tests can use both without state isolation.
    """
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


def test_upload_image_url_returns_presigned_put_for_jpeg(s3_data_bucket):
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

    response = handler.get_image_upload_url(TENANT_ID, event)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "upload_url" in body
    assert body["upload_url"].startswith("https://")
    assert body["s3_key"].startswith(f"property-images/{TENANT_ID}/prop_abc/")
    assert body["s3_key"].endswith(".jpg")
    assert body["image_url"].endswith(body["s3_key"])


def test_upload_image_url_rejects_disallowed_mime(s3_data_bucket):
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
    assert "Unsupported content_type" in json.loads(response["body"])["error"]


def test_upload_image_url_rejects_missing_property_id(s3_data_bucket):
    import handler

    event = make_api_event(
        method="POST",
        path="/properties/upload-image",
        body={"filename": "a.jpg", "content_type": "image/jpeg"},
    )
    response = handler.get_image_upload_url(TENANT_ID, event)
    assert response["statusCode"] == 400


def test_upload_image_url_picks_extension_from_mime_not_filename(s3_data_bucket):
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


def test_dispatcher_routes_upload_image(s3_data_bucket):
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
    response = handler.lambda_handler(event, None)
    assert response["statusCode"] == 200
    assert "upload_url" in json.loads(response["body"])


def test_detach_and_delete_image_removes_from_cover_and_s3(s3_data_bucket):
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
    assert _s3_object_missing(s3_data_bucket, bucket, s3_key)


def test_detach_and_delete_image_removes_from_gallery(s3_data_bucket):
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


def test_detach_and_delete_image_rejects_cross_tenant_url(s3_data_bucket):
    """An image URL whose key prefix doesn't start with this tenant must be rejected."""
    import handler

    bucket = os.environ.get("DATA_BUCKET")
    foreign_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/property-images/other-tenant/prop_z/x.jpg"

    with pytest.raises(handler.ImageOwnershipError):
        handler._detach_and_delete_image(TENANT_ID, "prop_z", foreign_url)


def test_detach_and_delete_image_tolerates_missing_s3_object(s3_data_bucket):
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


def test_detach_and_delete_image_rejects_cross_property_url(s3_data_bucket):
    """A URL whose key references a different property of the same tenant must be rejected."""
    import handler

    bucket = os.environ.get("DATA_BUCKET")
    other_property_url = (
        f"https://{bucket}.s3.us-east-1.amazonaws.com/"
        f"property-images/{TENANT_ID}/prop_OTHER/x.jpg"
    )

    with pytest.raises(handler.ImageOwnershipError):
        handler._detach_and_delete_image(TENANT_ID, "prop_THIS", other_property_url)


def test_parse_image_key_rejects_spoofed_url_with_bucket_in_path(s3_data_bucket):
    """An attacker URL where the bucket-marker only appears in the path must be rejected."""
    import handler

    bucket = os.environ.get("DATA_BUCKET")
    spoofed = f"https://attacker.example/{bucket}.s3.us-east-1.amazonaws.com/property-images/{TENANT_ID}/prop_x/x.jpg"

    assert handler._parse_image_key(spoofed, bucket) is None


def test_parse_image_key_rejects_path_traversal(s3_data_bucket):
    """Keys containing '..' segments must be rejected."""
    import handler

    bucket = os.environ.get("DATA_BUCKET")
    traversal = f"https://{bucket}.s3.us-east-1.amazonaws.com/property-images/T/P/../../other/x.jpg"

    assert handler._parse_image_key(traversal, bucket) is None


def test_delete_property_image_endpoint_happy_path(s3_data_bucket):
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
    response = handler.lambda_handler(event, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert gallery_url not in (body.get("gallery_urls") or [])


def test_delete_property_image_rejects_cross_tenant(s3_data_bucket):
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
    response = handler.lambda_handler(event, None)

    assert response["statusCode"] == 403


def test_delete_property_image_returns_404_when_property_missing(s3_data_bucket):
    import handler

    bucket = os.environ.get("DATA_BUCKET")
    image_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/property-images/{TENANT_ID}/prop_ghost/x.jpg"

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_ghost/images",
        body={"image_url": image_url},
        path_params={"id": "prop_ghost"},
    )
    response = handler.lambda_handler(event, None)

    assert response["statusCode"] == 404


def test_delete_property_image_requires_image_url(s3_data_bucket):
    import handler

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_c/images",
        body={},
        path_params={"id": "prop_c"},
    )
    response = handler.lambda_handler(event, None)
    assert response["statusCode"] == 400


def test_delete_property_cascades_image_cleanup(s3_data_bucket):
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
    response = handler.lambda_handler(event, None)

    assert response["statusCode"] in (200, 204)

    # Verify every object is gone
    for k in keys:
        assert _s3_object_missing(s3_data_bucket, bucket, k)


def test_delete_property_succeeds_even_when_no_images(s3_data_bucket):
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
    response = handler.lambda_handler(event, None)
    assert response["statusCode"] in (200, 204)


def test_delete_property_cascade_does_not_touch_sibling_property(s3_data_bucket):
    """Cascade must only delete the target property's prefix, never a sibling's."""
    import handler
    from shared.utils import build_pk, build_sk
    from shared.db import put_item

    bucket = os.environ.get("DATA_BUCKET")
    sibling_key = f"property-images/{TENANT_ID}/prop_sibling/img.jpg"
    target_key = f"property-images/{TENANT_ID}/prop_target/img.jpg"
    s3_data_bucket.put_object(Bucket=bucket, Key=sibling_key, Body=b"x")
    s3_data_bucket.put_object(Bucket=bucket, Key=target_key, Body=b"x")

    put_item({
        "pk": build_pk(TENANT_ID), "sk": build_sk("PROPERTY", "prop_target"),
        "id": "prop_target", "name": "T",
    })

    event = make_api_event(
        method="DELETE",
        path="/properties/prop_target",
        path_params={"id": "prop_target"},
    )
    handler.lambda_handler(event, None)

    assert _s3_object_missing(s3_data_bucket, bucket, target_key), "target must be gone"
    assert not _s3_object_missing(s3_data_bucket, bucket, sibling_key), "sibling must survive"
