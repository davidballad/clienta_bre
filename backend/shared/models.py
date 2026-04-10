"""Data models for Clienta BR (Real Estate) with DynamoDB serialization."""

from __future__ import annotations

from dataclasses import dataclass, field, fields, asdict
from decimal import Decimal
from typing import Any


def _serialize_value(value: Any, *, for_json: bool = False) -> Any:
    """Convert a value for DynamoDB or JSON output."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value) if for_json else value
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v, for_json=for_json) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v, for_json=for_json) for k, v in value.items()}
    return value


def _dict_no_none(obj: Any, *, for_json: bool = False) -> dict[str, Any]:
    """Convert a dataclass to dict, dropping None values and serializing Decimals."""
    raw = asdict(obj)
    return {k: _serialize_value(v, for_json=for_json) for k, v in raw.items() if v is not None}


class _BaseModel:
    """Mixin with to_dynamo / to_dict / from_dynamo helpers."""

    def to_dynamo(self) -> dict[str, Any]:
        return _dict_no_none(self, for_json=False)

    def to_dict(self) -> dict[str, Any]:
        return _dict_no_none(self, for_json=True)

    @classmethod
    def from_dynamo(cls, item: dict[str, Any]) -> Any:
        valid_fields = {f.name for f in fields(cls)}
        filtered = {k: v for k, v in item.items() if k in valid_fields}
        return cls(**filtered)


@dataclass
class Property(_BaseModel):
    """Real-estate property listing for Clienta BR."""

    name: str  # e.g. "Suite 2BR en La Carolina"
    id: str | None = None
    # sale | rent
    transaction_type: str = "sale"
    # disponible | reservado | vendido | rentado
    status: str = "disponible"
    price: Decimal | None = None
    currency: str = "USD"
    # Location
    city: str | None = None
    neighborhood: str | None = None
    address: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    # Features
    property_type: str | None = None  # casa | departamento | terreno | oficina | local
    bedrooms: int | None = None
    bathrooms: int | None = None
    parking_spots: int | None = None
    area_m2: Decimal | None = None
    year_built: int | None = None
    floor_number: int | None = None
    amenities: list[str] | None = None  # piscina, gimnasio, guardianía, etc.
    # Media
    image_url: str | None = None
    gallery_urls: list[str] | None = None
    # Documents (S3 keys for Bedrock RAG)
    document_keys: list[str] | None = None  # ["tenant/prop_id/docs/escritura.pdf", ...]
    # Meta Ads Integration
    external_ad_id: str | None = None
    # Search / RAG
    tags: list[str] | None = None
    description: str | None = None
    # Agent assignment
    assigned_agent: str | None = None
    agent_phone: str | None = None
    # Project grouping (e.g. "Proyecto Sol de Quito")
    project_name: str | None = None
    reference_code: str | None = None  # Human-readable code like "SOL-101"
    created_at: str | None = None
    updated_at: str | None = None


@dataclass
class Tenant(_BaseModel):
    business_name: str
    business_type: str
    owner_email: str
    id: str | None = None
    plan: str = "free"
    settings: dict[str, Any] | None = None
    phone_number: str | None = None
    meta_phone_number_id: str | None = None
    meta_business_account_id: str | None = None
    meta_access_token: str | None = None
    ai_system_prompt: str | None = None
    bank_name: str | None = None
    person_name: str | None = None
    account_type: str | None = None
    account_id: str | None = None
    identification_number: str | None = None
    capabilities: list[str] | None = None
    currency: str | None = None
    timezone: str | None = None
    business_hours: dict[str, Any] | None = None
    support_phone: str | None = None
    catalog_slug: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


@dataclass
class User(_BaseModel):
    email: str
    tenant_id: str
    id: str | None = None
    role: str = "staff"
    display_name: str | None = None
    status: str = "active"
    invited_by: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


@dataclass
class Contact(_BaseModel):
    name: str
    tenant_id: str | None = None
    contact_id: str | None = None
    phone: str | None = None
    email: str | None = None
    source_channel: str | None = None
    lead_status: str = "prospect"
    tier: str = "bronze"
    total_spent: Decimal | None = None
    last_activity_ts: str | None = None
    tags: list[str] | None = None
    created_ts: str | None = None
    # WhatsApp: "bot" = AI/n8n handles replies; "human" = staff-only until set back to bot
    conversation_mode: str = "bot"
    # Clienta BR — Lead scoring
    lead_score: int | None = None  # 0-100 purchase probability
    lead_intent: str | None = None  # buy | rent | None
    interested_property_id: str | None = None
    lead_score_summary: str | None = None  # AI-generated summary of intent


@dataclass
class Message(_BaseModel):
    tenant_id: str | None = None
    message_id: str | None = None
    channel: str = "whatsapp"
    channel_message_id: str | None = None
    direction: str | None = None  # inbound | outbound
    from_number: str | None = None
    to_number: str | None = None
    text: str | None = None
    metadata: dict[str, Any] | None = None
    contact_id: str | None = None
    category: str = "activo"
    processed_flags: list[str] | None = None
    created_ts: str | None = None


@dataclass
class ConversationSummary(_BaseModel):
    """Fast inbox/reminder view per customer conversation."""

    tenant_id: str
    customer_phone: str
    channel: str = "whatsapp"
    category: str = "activo"
    last_message_ts: str | None = None
    last_inbound_ts: str | None = None
    last_outbound_ts: str | None = None
    last_direction: str | None = None
    last_text: str | None = None
    updated_at: str | None = None


@dataclass
class Appointment(_BaseModel):
    """Scheduled appointment for a real-estate visit or meeting.

    Key design notes:
    - ``contact_email`` is required before confirming; collected by the AI agent.
    - ``google_event_id`` is stored so the n8n workflow can update/delete the
      Google Calendar event on reschedule or cancellation.
    - ``status``: confirmed | cancelled | rescheduled
    - ``scheduled_at``: ISO 8601 UTC string, e.g. "2026-04-15T15:00:00Z"
    """

    tenant_id: str
    appointment_id: str | None = None
    contact_phone: str | None = None       # normalized E.164 digits
    contact_name: str | None = None
    contact_email: str | None = None       # required; enriches Contact lead board
    contact_id: str | None = None         # linked Contact record (optional)
    scheduled_at: str | None = None        # ISO 8601 UTC
    duration_minutes: int = 60
    property_id: str | None = None
    property_name: str | None = None
    google_event_id: str | None = None    # GCal event ID for future updates/deletes
    calendar_id: str | None = None        # which GCal calendar was used
    status: str = "confirmed"             # confirmed | cancelled | rescheduled
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
