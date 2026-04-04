"""Properties CRUD Lambda handler for Clienta BR (Bienes Raíces)."""

from __future__ import annotations

import base64
import csv
import io
import json
import os
import re
import sys
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.auth import require_auth
from shared.db import (
    batch_put_items,
    delete_item,
    get_item,
    get_table,
    put_item,
    query_items,
    update_item,
)
from shared.db import DynamoDBError
from shared.models import Property
from shared.response import created, error, no_content, not_found, server_error, success
from shared.utils import build_pk, build_sk, generate_id, now_iso, parse_body

PROPERTY_SK_PREFIX = "PROPERTY#"
GSI1_NAME = "GSI1"
LIMIT_DEFAULT = 50
LIMIT_MAX = 100
SEARCH_SCAN_MAX = 500

VALID_TRANSACTION_TYPES = {"sale", "rent"}
VALID_STATUSES = {"disponible", "reservado", "vendido", "rentado"}
VALID_PROPERTY_TYPES = {"casa", "departamento", "terreno", "oficina", "local", "suite"}

DOCS_PREFIX = "br-docs"
PRESIGNED_EXPIRY = 300


def _normalize(s: str) -> str:
    if not s:
        return ""
    raw = unicodedata.normalize("NFD", s)
    raw = "".join(c for c in raw if unicodedata.category(c) != "Mn")
    return raw.lower()


def _search_tokens(q: str) -> list[str]:
    raw = _normalize(q)
    return [t for t in re.split(r"[^\w]+", raw, flags=re.UNICODE) if len(t) >= 2]


def _score_property(tokens: list[str], prop: dict[str, Any]) -> float:
    """Rank properties by name/city/neighborhood/description/tags match."""
    if not tokens:
        return 0.0
    fields = {
        "name": 4.0,
        "city": 3.0,
        "neighborhood": 3.0,
        "project_name": 3.0,
        "description": 1.5,
        "property_type": 2.5,
        "reference_code": 5.0,
    }
    score = 0.0
    for tok in tokens:
        for field, weight in fields.items():
            val = _normalize(str(prop.get(field) or ""))
            if tok in val:
                score += weight
        tags = prop.get("tags")
        if isinstance(tags, list):
            for tg in tags:
                tg_n = _normalize(str(tg))
                if tok == tg_n or tok in tg_n:
                    score += 6.0
        amenities = prop.get("amenities")
        if isinstance(amenities, list):
            for am in amenities:
                if tok in _normalize(str(am)):
                    score += 2.0
    return score


def _auto_tags(prop: dict[str, Any]) -> list[str]:
    """Generate search tags from property fields."""
    text_parts = [
        str(prop.get("name") or ""),
        str(prop.get("city") or ""),
        str(prop.get("neighborhood") or ""),
        str(prop.get("property_type") or ""),
        str(prop.get("project_name") or ""),
        str(prop.get("transaction_type") or ""),
    ]
    tokens = _search_tokens(" ".join(text_parts))
    stopwords = {"de", "del", "la", "las", "el", "los", "y", "con", "para", "en", "a"}
    seen: set[str] = set()
    out: list[str] = []
    for tok in tokens:
        if tok in stopwords or tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
        if len(out) >= 20:
            break
    return out


def _build_property_tags(manual_tags: Any, prop: dict[str, Any]) -> list[str] | None:
    merged: list[str] = []
    seen: set[str] = set()
    manual = manual_tags if isinstance(manual_tags, list) else []
    for tag in [_normalize(str(t)) for t in manual if t] + _auto_tags(prop):
        if tag in seen or len(tag) < 2:
            continue
        seen.add(tag)
        merged.append(tag)
    return merged or None


# ── Search ──────────────────────────────────────────────────────────────


def search_properties(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """GET /properties?search=...&limit=N&status=disponible"""
    params = event.get("queryStringParameters") or {}
    q = (params.get("search") or "").strip()
    status_filter = params.get("status") or "disponible"
    tx_type_filter = params.get("transaction_type")
    try:
        top = min(max(int(params.get("limit", 5)), 1), 25)
    except (TypeError, ValueError):
        top = 5
    if not q:
        return error("search query parameter is required", 400)

    pk = build_pk(tenant_id)
    all_items: list[dict[str, Any]] = []
    last_key: dict[str, Any] | None = None
    try:
        while len(all_items) < SEARCH_SCAN_MAX:
            batch, last_key = query_items(
                pk=pk, sk_prefix=PROPERTY_SK_PREFIX, limit=100, last_key=last_key
            )
            all_items.extend(batch)
            if not last_key:
                break
        tokens = _search_tokens(q)
        if not tokens:
            return success(body={"properties": []})
        scored: list[tuple[float, dict[str, Any]]] = []
        for item in all_items:
            prop = Property.from_dynamo(item).to_dict()
            # Filter by status
            if status_filter and prop.get("status") != status_filter:
                continue
            if tx_type_filter and prop.get("transaction_type") != tx_type_filter:
                continue
            s = _score_property(tokens, prop)
            if s > 0:
                scored.append((s, prop))
        scored.sort(key=lambda x: -x[0])
        return success(body={"properties": [p for _, p in scored[:top]]})
    except DynamoDBError as e:
        return server_error(str(e))


# ── List ────────────────────────────────────────────────────────────────


def _decode_next_token(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    try:
        decoded = base64.b64decode(token).decode("utf-8")
        return json.loads(decoded) if decoded else None
    except (ValueError, json.JSONDecodeError):
        return None


def _encode_next_token(last_key: dict[str, Any] | None) -> str | None:
    if not last_key:
        return None
    return base64.b64encode(json.dumps(last_key, default=str).encode()).decode()


def list_properties(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """List properties with optional filters and pagination."""
    params = event.get("queryStringParameters") or {}
    if (params.get("search") or "").strip():
        return search_properties(tenant_id, event)
    next_token = params.get("next_token")
    status_filter = params.get("status")
    tx_type_filter = params.get("transaction_type")
    city_filter = params.get("city")
    try:
        limit = min(int(params.get("limit", LIMIT_DEFAULT)), LIMIT_MAX)
    except (TypeError, ValueError):
        limit = LIMIT_DEFAULT

    pk = build_pk(tenant_id)
    last_key = _decode_next_token(next_token)

    has_filters = any([status_filter, tx_type_filter, city_filter])

    try:
        if has_filters:
            matched: list[dict[str, Any]] = []
            last_key_loop = last_key
            for _ in range(100):
                items, last_eval = query_items(
                    pk=pk, sk_prefix=PROPERTY_SK_PREFIX, limit=LIMIT_MAX, last_key=last_key_loop
                )
                for item in items:
                    p = Property.from_dynamo(item).to_dict()
                    if status_filter and p.get("status") != status_filter:
                        continue
                    if tx_type_filter and p.get("transaction_type") != tx_type_filter:
                        continue
                    if city_filter and _normalize(p.get("city") or "") != _normalize(city_filter):
                        continue
                    matched.append(p)
                    if len(matched) >= limit:
                        break
                if len(matched) >= limit or not last_eval:
                    break
                last_key_loop = last_eval
            body: dict[str, Any] = {"properties": matched}
            if last_eval:
                body["next_token"] = _encode_next_token(last_eval)
            return success(body=body)

        items, last_eval = query_items(
            pk=pk, sk_prefix=PROPERTY_SK_PREFIX, limit=limit, last_key=last_key
        )
        properties = [Property.from_dynamo(item).to_dict() for item in items]
        next_token_out = _encode_next_token(last_eval)
        body = {"properties": properties}
        if next_token_out:
            body["next_token"] = next_token_out
        return success(body=body)
    except DynamoDBError as e:
        return server_error(str(e))


# ── CRUD ────────────────────────────────────────────────────────────────


def create_property(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """Create a new property listing."""
    try:
        body = parse_body(event)
    except Exception as e:
        return error(str(e), 400)

    name = (body.get("name") or "").strip()
    if not name:
        return error("name is required", 400)

    tx_type = body.get("transaction_type", "sale")
    if tx_type not in VALID_TRANSACTION_TYPES:
        return error(f"transaction_type must be one of: {', '.join(VALID_TRANSACTION_TYPES)}", 400)

    prop_type = body.get("property_type")
    if prop_type and prop_type not in VALID_PROPERTY_TYPES:
        return error(f"property_type must be one of: {', '.join(VALID_PROPERTY_TYPES)}", 400)

    property_id = generate_id()
    now = now_iso()
    pk = build_pk(tenant_id)
    sk = build_sk("PROPERTY", property_id)

    item: dict[str, Any] = {
        "pk": pk,
        "sk": sk,
        "id": property_id,
        "name": name,
        "transaction_type": tx_type,
        "status": body.get("status", "disponible"),
        "currency": body.get("currency", "USD"),
        "created_at": now,
        "updated_at": now,
    }

    # Optional fields
    optional_str = [
        "city", "neighborhood", "address", "property_type", "description",
        "image_url", "assigned_agent", "agent_phone", "project_name",
        "reference_code", "external_ad_id",
    ]
    for field in optional_str:
        val = body.get(field)
        if val is not None:
            item[field] = str(val).strip()

    optional_int = ["bedrooms", "bathrooms", "parking_spots", "year_built", "floor_number"]
    for field in optional_int:
        val = body.get(field)
        if val is not None:
            try:
                item[field] = int(val)
            except (TypeError, ValueError):
                pass

    optional_decimal = ["price", "area_m2", "latitude", "longitude"]
    for field in optional_decimal:
        val = body.get(field)
        if val is not None:
            try:
                item[field] = Decimal(str(val))
            except InvalidOperation:
                pass

    optional_list = ["amenities", "gallery_urls", "document_keys"]
    for field in optional_list:
        val = body.get(field)
        if isinstance(val, list):
            item[field] = val

    # GSI1 for city-based lookups
    if item.get("city"):
        item["gsi1pk"] = pk
        item["gsi1sk"] = f"CITY#{_normalize(item['city'])}"

    # Auto-generate tags
    tags = _build_property_tags(body.get("tags"), item)
    if tags:
        item["tags"] = tags

    try:
        put_item(item)
    except DynamoDBError as e:
        return server_error(str(e))

    return created(Property.from_dynamo(item).to_dict())


def get_property(tenant_id: str, property_id: str) -> dict[str, Any]:
    """Get a single property by ID."""
    pk = build_pk(tenant_id)
    sk = build_sk("PROPERTY", property_id)
    try:
        item = get_item(pk=pk, sk=sk)
    except DynamoDBError as e:
        return server_error(str(e))
    if not item:
        return not_found("Property not found")
    return success(body=Property.from_dynamo(item).to_dict())


def update_property(tenant_id: str, property_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """Update an existing property."""
    pk = build_pk(tenant_id)
    sk = build_sk("PROPERTY", property_id)
    try:
        existing = get_item(pk=pk, sk=sk)
    except DynamoDBError as e:
        return server_error(str(e))
    if not existing:
        return not_found("Property not found")

    try:
        body = parse_body(event)
    except json.JSONDecodeError:
        return error("Invalid JSON body", 400)
    if not body:
        return error("Request body is required", 400)

    allowed_str = {
        "name", "city", "neighborhood", "address", "property_type", "description",
        "image_url", "assigned_agent", "agent_phone", "project_name",
        "reference_code", "external_ad_id", "transaction_type", "status", "currency",
    }
    allowed_int = {"bedrooms", "bathrooms", "parking_spots", "year_built", "floor_number"}
    allowed_decimal = {"price", "area_m2", "latitude", "longitude"}
    allowed_list = {"amenities", "gallery_urls", "document_keys", "tags"}

    updates: dict[str, Any] = {}

    for key in allowed_str:
        if key in body:
            updates[key] = body[key]
    for key in allowed_int:
        if key in body:
            try:
                updates[key] = int(body[key]) if body[key] is not None else None
            except (TypeError, ValueError):
                pass
    for key in allowed_decimal:
        if key in body:
            try:
                updates[key] = Decimal(str(body[key])) if body[key] is not None else None
            except (InvalidOperation, TypeError):
                pass
    for key in allowed_list:
        if key in body:
            updates[key] = body[key] if isinstance(body[key], list) else None

    if "transaction_type" in updates and updates["transaction_type"] not in VALID_TRANSACTION_TYPES:
        return error(f"transaction_type must be one of: {', '.join(VALID_TRANSACTION_TYPES)}", 400)
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        return error(f"status must be one of: {', '.join(VALID_STATUSES)}", 400)

    updates["updated_at"] = now_iso()

    # Update GSI1 if city changes
    if "city" in updates and updates["city"]:
        updates["gsi1pk"] = pk
        updates["gsi1sk"] = f"CITY#{_normalize(updates['city'])}"

    # Rebuild tags
    effective = {**existing, **updates}
    computed_tags = _build_property_tags(updates.get("tags", existing.get("tags")), effective)
    updates["tags"] = computed_tags or []

    try:
        updated_item = update_item(pk=pk, sk=sk, updates=updates)
    except DynamoDBError as e:
        return server_error(str(e))

    return success(body=Property.from_dynamo(updated_item).to_dict())


def delete_property(tenant_id: str, property_id: str) -> dict[str, Any]:
    """Delete a property."""
    pk = build_pk(tenant_id)
    sk = build_sk("PROPERTY", property_id)
    try:
        delete_item(pk=pk, sk=sk)
    except DynamoDBError as e:
        return server_error(str(e))
    return no_content()


# ── Document Upload URLs ────────────────────────────────────────────────


def get_document_upload_url(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """Generate presigned URL for uploading property documents to S3."""
    bucket = os.environ.get("DATA_BUCKET")
    region = os.environ.get("AWS_REGION", "us-east-1")
    if not bucket:
        return server_error("DATA_BUCKET not configured")

    try:
        body = parse_body(event)
    except json.JSONDecodeError:
        return error("Invalid JSON body", 400)

    property_id = body.get("property_id")
    filename = (body.get("filename") or "").strip()
    content_type = (body.get("content_type") or "application/pdf").strip()

    if not property_id or not filename:
        return error("property_id and filename are required", 400)

    # Sanitize extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "pdf"
    if not re.match(r"^[a-z0-9]{2,5}$", ext):
        ext = "pdf"

    key = f"{DOCS_PREFIX}/{tenant_id}/{property_id}/{generate_id()}.{ext}"

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

    doc_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return success(body={"upload_url": upload_url, "document_url": doc_url, "s3_key": key})


# ── CSV Import ──────────────────────────────────────────────────────────


REQUIRED_CSV = {"name"}
VALID_CSV = {
    "name", "transaction_type", "property_type", "price", "city", "neighborhood",
    "address", "bedrooms", "bathrooms", "parking_spots", "area_m2", "description",
    "amenities", "image_url", "project_name", "reference_code", "tags",
}


def get_csv_template(tenant_id: str) -> dict[str, Any]:
    """Return a CSV template for property bulk import."""
    sample = (
        "name,transaction_type,property_type,price,city,neighborhood,bedrooms,bathrooms,"
        "parking_spots,area_m2,description,amenities,image_url,project_name,reference_code,tags\n"
        '"Suite de lujo 2BR",sale,departamento,120000,Quito,La Carolina,2,2,1,85,'
        '"Vista panorámica al parque","piscina,gimnasio",,Proyecto Sol,SOL-101,"lujo,carolina"\n'
        '"Casa familiar 3BR",rent,casa,800,Guayaquil,Samborondón,3,2.5,2,180,'
        '"Urbanización cerrada con seguridad","jardín,bbq",,,,\n'
    )
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="properties_template.csv"',
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": sample,
    }


def import_csv(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """Bulk import properties from CSV."""
    body_raw = event.get("body", "")
    if not body_raw:
        return error("Request body is empty. Send CSV content in the body.", 400)
    if event.get("isBase64Encoded"):
        body_raw = base64.b64decode(body_raw).decode("utf-8")
    if body_raw.startswith("\ufeff"):
        body_raw = body_raw[1:]

    reader = csv.DictReader(io.StringIO(body_raw))
    if not reader.fieldnames:
        return error("CSV has no header row.", 400)

    headers = {h.strip().lower() for h in reader.fieldnames}
    missing = REQUIRED_CSV - headers
    if missing:
        return error(f"CSV missing required columns: {', '.join(sorted(missing))}", 400)

    pk = build_pk(tenant_id)
    now = now_iso()
    items_to_write: list[dict[str, Any]] = []
    imported: list[dict[str, Any]] = []
    errors_list: list[dict[str, Any]] = []

    for row_num, row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items()}
        name = row.get("name", "").strip()
        if not name:
            errors_list.append({"row": row_num, "error": "name is required"})
            continue

        property_id = generate_id()
        sk = build_sk("PROPERTY", property_id)

        item: dict[str, Any] = {
            "pk": pk,
            "sk": sk,
            "id": property_id,
            "name": name,
            "transaction_type": row.get("transaction_type", "sale") or "sale",
            "status": "disponible",
            "currency": "USD",
            "created_at": now,
            "updated_at": now,
        }

        # String fields
        for f in ["city", "neighborhood", "address", "property_type", "description",
                   "image_url", "project_name", "reference_code"]:
            val = row.get(f, "").strip()
            if val:
                item[f] = val

        # Integer fields
        for f in ["bedrooms", "bathrooms", "parking_spots"]:
            val = row.get(f, "").strip()
            if val:
                try:
                    item[f] = int(float(val))
                except (ValueError, TypeError):
                    pass

        # Decimal fields
        for f in ["price", "area_m2"]:
            val = row.get(f, "").strip()
            if val:
                try:
                    item[f] = Decimal(val)
                except InvalidOperation:
                    errors_list.append({"row": row_num, "name": name, "error": f"invalid {f}: '{val}'"})
                    continue

        # List fields
        amenities_raw = row.get("amenities", "").strip()
        if amenities_raw:
            item["amenities"] = [a.strip() for a in amenities_raw.split(",") if a.strip()]

        tags_raw = row.get("tags", "").strip()
        manual_tags = [t.strip().lower() for t in tags_raw.split(",") if t.strip()] if tags_raw else None

        # GSI1
        if item.get("city"):
            item["gsi1pk"] = pk
            item["gsi1sk"] = f"CITY#{_normalize(item['city'])}"

        computed_tags = _build_property_tags(manual_tags, item)
        if computed_tags:
            item["tags"] = computed_tags

        items_to_write.append(item)
        imported.append({"id": property_id, "name": name, "city": item.get("city", "")})

    if not items_to_write and not errors_list:
        return error("CSV has no data rows", 400)

    if items_to_write:
        try:
            batch_put_items(items_to_write)
        except DynamoDBError as e:
            return server_error(f"Failed to write properties: {e}")

    result: dict[str, Any] = {
        "imported_count": len(imported),
        "error_count": len(errors_list),
        "imported": imported[:50],
    }
    if errors_list:
        result["errors"] = errors_list[:50]

    status = 201 if imported else 400
    return success(result, status_code=status)


# ── Stats ───────────────────────────────────────────────────────────────


def get_property_stats(tenant_id: str) -> dict[str, Any]:
    """GET /properties/stats — aggregate counts by status and type."""
    pk = build_pk(tenant_id)
    totals: dict[str, Any] = {
        "total": 0,
        "by_status": {"disponible": 0, "reservado": 0, "vendido": 0, "rentado": 0},
        "by_type": {"sale": 0, "rent": 0},
    }
    last_key: dict[str, Any] | None = None
    try:
        while True:
            items, last_key = query_items(
                pk=pk, sk_prefix=PROPERTY_SK_PREFIX, limit=200, last_key=last_key
            )
            for item in items:
                p = Property.from_dynamo(item)
                totals["total"] += 1
                st = p.status or "disponible"
                if st in totals["by_status"]:
                    totals["by_status"][st] += 1
                tx = p.transaction_type or "sale"
                if tx in totals["by_type"]:
                    totals["by_type"][tx] += 1
            if not last_key:
                break
        return success(totals)
    except DynamoDBError as e:
        return server_error(str(e))


# ── Lambda Handler ──────────────────────────────────────────────────────


@require_auth
def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Route requests to the appropriate handler."""
    try:
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        path = event.get("path", "") or event.get("rawPath", "")
        path_params = event.get("pathParameters") or {}
        property_id = path_params.get("id")
        tenant_id = event.get("tenant_id", "")

        # CSV template
        if method == "GET" and path.endswith("/properties/import/template"):
            return get_csv_template(tenant_id)

        # CSV import
        if method == "POST" and path.endswith("/properties/import"):
            return import_csv(tenant_id, event)

        # Stats
        if method == "GET" and path.endswith("/properties/stats"):
            return get_property_stats(tenant_id)

        # Document upload URL
        if method == "POST" and path.endswith("/properties/upload-doc"):
            return get_document_upload_url(tenant_id, event)

        # CRUD
        if method == "GET" and not property_id:
            return list_properties(tenant_id, event)
        if method == "POST" and not property_id:
            return create_property(tenant_id, event)
        if method == "GET" and property_id:
            return get_property(tenant_id, property_id)
        if method in ("PUT", "PATCH") and property_id:
            return update_property(tenant_id, property_id, event)
        if method == "DELETE" and property_id:
            return delete_property(tenant_id, property_id)

        return error("Method not allowed", 405)
    except Exception as e:
        return server_error(str(e))
