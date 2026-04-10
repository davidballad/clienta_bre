"""Appointments Lambda handler — create, read, update, cancel, and check upcoming visits.

DynamoDB key design (single-table):
  Main record:
    pk  = TENANT#{tenant_id}
    sk  = APPT#{appointment_id}

  GSI1 — lookup upcoming appointments by phone:
    gsi1pk = PHONE#{contact_phone}
    gsi1sk = APPT#{scheduled_at}   (ISO-8601 UTC, sort order gives chronological order)

Callable from:
  - The owner dashboard (JWT-authenticated routes)
  - The n8n Calendar Scheduler workflow (X-Service-Key authenticated routes)
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.auth import require_auth, validate_service_key
from shared.db import (
    DynamoDBError,
    delete_item,
    get_item,
    put_item,
    query_items,
    update_item,
)
from shared.models import Appointment
from shared.response import created, error, no_content, not_found, server_error, success
from shared.utils import build_pk, build_sk, generate_id, normalize_phone, now_iso, parse_body

APPT_SK_PREFIX = "APPT#"
VALID_STATUSES = {"confirmed", "cancelled", "rescheduled"}
LIMIT_DEFAULT = 50
LIMIT_MAX = 100


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _appt_gsi1pk(phone: str) -> str:
    return f"PHONE#{normalize_phone(phone) or phone}"


def _appt_gsi1sk(scheduled_at: str) -> str:
    """Use APPT#<scheduled_at> so GSI1 sorts chronologically."""
    return f"APPT#{scheduled_at}"


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _build_appt_item(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Build a complete DynamoDB item for a new appointment."""
    appointment_id = data.get("appointment_id") or generate_id()
    created_at = now_iso()

    phone = normalize_phone(data.get("contact_phone") or "") or data.get("contact_phone") or ""
    scheduled_at = data.get("scheduled_at") or ""

    item: dict[str, Any] = {
        "pk": build_pk(tenant_id),
        "sk": build_sk("APPT", appointment_id),
        "tenant_id": tenant_id,
        "appointment_id": appointment_id,
        "status": data.get("status", "confirmed"),
        "duration_minutes": int(data.get("duration_minutes", 60)),
        "created_at": created_at,
        "updated_at": created_at,
    }

    # Optional but important fields
    for field in (
        "contact_name", "contact_email", "contact_id",
        "property_id", "property_name", "google_event_id",
        "calendar_id", "notes",
    ):
        if data.get(field) is not None:
            item[field] = data[field]

    if phone:
        item["contact_phone"] = phone
    if scheduled_at:
        item["scheduled_at"] = scheduled_at

    # GSI1 — lookup by phone → sorted upcoming appointments
    if phone and scheduled_at:
        item["gsi1pk"] = _appt_gsi1pk(phone)
        item["gsi1sk"] = _appt_gsi1sk(scheduled_at)

    return item


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def list_appointments(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """GET /appointments — list for the owner dashboard.

    Query params:
      status   = confirmed | cancelled | rescheduled
      phone    = filter by contact phone
      limit    = max results (default 50, max 100)
    """
    params = event.get("queryStringParameters") or {}
    status_filter = params.get("status") or None
    phone_filter = normalize_phone(params.get("phone") or "") or None
    try:
        limit = min(int(params.get("limit", LIMIT_DEFAULT)), LIMIT_MAX)
    except (TypeError, ValueError):
        limit = LIMIT_DEFAULT

    pk = build_pk(tenant_id)
    try:
        items, _ = query_items(pk=pk, sk_prefix=APPT_SK_PREFIX, limit=LIMIT_MAX)
        appointments = []
        for item in items:
            appt = Appointment.from_dynamo(item).to_dict()
            if status_filter and appt.get("status") != status_filter:
                continue
            if phone_filter:
                stored = normalize_phone(appt.get("contact_phone") or "") or ""
                if stored != phone_filter:
                    continue
            appointments.append(appt)
            if len(appointments) >= limit:
                break

        # Sort by scheduled_at descending (most recent first for dashboard)
        appointments.sort(key=lambda a: a.get("scheduled_at") or "", reverse=True)
        return success({"appointments": appointments, "total": len(appointments)})
    except DynamoDBError as e:
        return server_error(str(e))


def create_appointment(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """POST /appointments — called by the n8n Calendar Scheduler after GCal event creation.

    Required body fields:
      contact_email, scheduled_at

    Recommended:
      contact_name, contact_phone, google_event_id, calendar_id
    """
    try:
        body = parse_body(event)
    except (json.JSONDecodeError, TypeError):
        return error("Invalid JSON body", 400)

    if not body.get("contact_email"):
        return error("contact_email is required", 400)
    if not body.get("scheduled_at"):
        return error("scheduled_at is required (ISO 8601 UTC)", 400)

    status = body.get("status", "confirmed")
    if status not in VALID_STATUSES:
        return error(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}", 400)

    body["tenant_id"] = tenant_id
    item = _build_appt_item(tenant_id, body)

    try:
        put_item(item)
    except DynamoDBError as e:
        return server_error(str(e))

    return created(Appointment.from_dynamo(item).to_dict())


def get_appointment(tenant_id: str, appointment_id: str) -> dict[str, Any]:
    """GET /appointments/{id}"""
    pk = build_pk(tenant_id)
    sk = build_sk("APPT", appointment_id)
    try:
        item = get_item(pk=pk, sk=sk)
    except DynamoDBError as e:
        return server_error(str(e))
    if not item:
        return not_found("Appointment not found")
    return success(Appointment.from_dynamo(item).to_dict())


def patch_appointment(
    tenant_id: str, appointment_id: str, event: dict[str, Any]
) -> dict[str, Any]:
    """PATCH /appointments/{id} — reschedule, cancel, or update notes/event ID.

    Allowed fields: status, scheduled_at, google_event_id, notes,
                    contact_name, contact_email, contact_phone, duration_minutes
    """
    pk = build_pk(tenant_id)
    sk = build_sk("APPT", appointment_id)
    try:
        existing = get_item(pk=pk, sk=sk)
    except DynamoDBError as e:
        return server_error(str(e))
    if not existing:
        return not_found("Appointment not found")

    try:
        body = parse_body(event)
    except (json.JSONDecodeError, TypeError):
        return error("Invalid JSON body", 400)
    if not body:
        return error("Request body is required", 400)

    allowed = {
        "status", "scheduled_at", "google_event_id", "calendar_id",
        "notes", "contact_name", "contact_email", "contact_phone",
        "duration_minutes", "property_id", "property_name",
    }
    updates: dict[str, Any] = {}
    for key, value in body.items():
        if key in allowed and value is not None:
            if key == "contact_phone":
                updates[key] = normalize_phone(str(value)) or str(value).strip()
            elif key == "duration_minutes":
                try:
                    updates[key] = int(value)
                except (TypeError, ValueError):
                    pass
            else:
                updates[key] = value

    if "status" in updates and updates["status"] not in VALID_STATUSES:
        return error(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}", 400)

    updates["updated_at"] = now_iso()

    # Sync GSI1 if phone or scheduled_at changes
    phone = updates.get("contact_phone") or existing.get("contact_phone") or ""
    sched = updates.get("scheduled_at") or existing.get("scheduled_at") or ""
    if ("contact_phone" in updates or "scheduled_at" in updates) and phone and sched:
        updates["gsi1pk"] = _appt_gsi1pk(phone)
        updates["gsi1sk"] = _appt_gsi1sk(sched)

    try:
        updated_item = update_item(pk=pk, sk=sk, updates=updates)
    except DynamoDBError as e:
        return server_error(str(e))

    return success(Appointment.from_dynamo(updated_item).to_dict())


def delete_appointment(tenant_id: str, appointment_id: str) -> dict[str, Any]:
    """DELETE /appointments/{id} — hard delete (owner only)."""
    pk = build_pk(tenant_id)
    sk = build_sk("APPT", appointment_id)
    try:
        existing = get_item(pk=pk, sk=sk)
        if not existing:
            return not_found("Appointment not found")
        delete_item(pk=pk, sk=sk)
    except DynamoDBError as e:
        return server_error(str(e))
    return no_content()


def check_upcoming(tenant_id: str, event: dict[str, Any]) -> dict[str, Any]:
    """GET /appointments/upcoming — check if a phone has a future confirmed appointment.

    Called by the n8n agent BEFORE starting a new booking flow.

    Query params:
      phone = WhatsApp number (required)

    Returns:
      { has_appointment: bool, appointment?: {...} }
    """
    params = event.get("queryStringParameters") or {}
    raw_phone = params.get("phone") or ""
    phone_digits = normalize_phone(raw_phone) or raw_phone.strip()

    if not phone_digits:
        return error("phone query parameter is required", 400)

    now_str = _now_utc_iso()  # e.g. "2026-04-10T05:00:00Z"

    try:
        # GSI1: pk=PHONE#<digits>, sk begins_with APPT# — sorted chronologically
        items, _ = query_items(
            pk=f"PHONE#{phone_digits}",
            sk_prefix=APPT_SK_PREFIX,
            limit=10,
            index_name="GSI1",
            pk_attr="gsi1pk",
            sk_attr="gsi1sk",
            scan_index_forward=True,
        )
        # Filter to this tenant + future + confirmed
        upcoming = [
            Appointment.from_dynamo(item).to_dict()
            for item in items
            if item.get("tenant_id") == tenant_id
            and item.get("status") == "confirmed"
            and (item.get("scheduled_at") or "") > now_str
        ]

        if upcoming:
            # Return the soonest one
            return success({"has_appointment": True, "appointment": upcoming[0]})
        return success({"has_appointment": False})
    except DynamoDBError as e:
        return server_error(str(e))


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

@require_auth
def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Route requests by method and path."""
    try:
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        path = event.get("path", "") or event.get("rawPath", "")
        path_params = event.get("pathParameters") or {}
        appointment_id = path_params.get("id")
        tenant_id = event.get("tenant_id", "")

        # n8n or owner can call /appointments/upcoming (service key OR JWT accepted)
        if method == "GET" and path.endswith("/appointments/upcoming"):
            return check_upcoming(tenant_id, event)

        # List — JWT (dashboard) or service key (n8n)
        if method == "GET" and not appointment_id:
            return list_appointments(tenant_id, event)

        # Create — service key (n8n after GCal event created)
        if method == "POST" and not appointment_id:
            return create_appointment(tenant_id, event)

        # Single-resource operations (JWT or service key for reschedule)
        if appointment_id:
            if method == "GET":
                return get_appointment(tenant_id, appointment_id)
            if method == "PATCH":
                return patch_appointment(tenant_id, appointment_id, event)
            if method == "DELETE":
                return delete_appointment(tenant_id, appointment_id)

        return error("Method not allowed", 405)
    except Exception as e:
        return server_error(str(e))
