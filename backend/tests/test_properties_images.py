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
    response = handler.handler(event, None)
    assert response["statusCode"] == 200
    assert "upload_url" in json.loads(response["body"])
