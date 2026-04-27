"""
Gemini 3.1 Flash Lite — multimodal property flyer extraction.

This module handles extracting structured property data from:
1. Canva-generated flyers (images)
2. Property listing screenshots
3. Ad creatives from Instagram/Facebook

Uses Gemini 3.1 Flash Lite for fast, cost-effective multimodal processing.
Returns structured JSON matching the Property model schema.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from decimal import Decimal
from typing import Any

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ── Config ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"  # Gemini 2.5 Flash — fast multimodal
S3_BUCKET = os.environ.get("PROPERTY_DOCS_BUCKET", "clienta-br-property-docs")
REGION = os.environ.get("AWS_REGION", "us-east-1")

# Supported image MIME types
SUPPORTED_MIMES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",  # Gemini can read single-page PDFs as images
}

# ── Extraction Prompt ────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """Eres un experto en bienes raíces de Ecuador. Analiza esta imagen de un flyer/anuncio inmobiliario y extrae TODA la información visible en formato JSON estructurado.

Devuelve SOLO un objeto JSON válido (sin markdown, sin ```json) con estos campos:

{
  "name": "nombre descriptivo del inmueble",
  "transaction_type": "sale" o "rent",
  "property_type": "casa|departamento|terreno|oficina|local|suite",
  "price": número (solo el valor, sin símbolo $),
  "currency": "USD",
  "city": "ciudad",
  "neighborhood": "sector o barrio",
  "address": "dirección si es visible",
  "bedrooms": número o null,
  "bathrooms": número o null,
  "parking_spots": número o null,
  "area_m2": número o null,
  "year_built": número o null,
  "floor_number": número o null,
  "amenities": ["lista", "de", "amenidades"],
  "description": "descripción extraída del flyer",
  "project_name": "nombre del proyecto si aplica",
  "reference_code": "código de referencia si es visible",
  "tags": ["etiquetas", "relevantes"],
  "agent_phone": "teléfono del agente si es visible",
  "assigned_agent": "nombre del agente si es visible",
  "confidence": 0.0-1.0
}

Reglas:
- Si un campo no es visible en la imagen, usa null
- Para transaction_type, infiere del contexto: "Se Vende"→"sale", "Se Arrienda"/"Se Alquila"→"rent"
- Para precios, convierte a número: "$120.000" → 120000
- Genera tags descriptivos: ubicación, tipo, características principales
- El campo "confidence" indica qué tan seguro estás de la extracción (0.0 = nada seguro, 1.0 = completamente seguro)
- Responde SOLO con el JSON, sin texto adicional
"""


# ── Lazy Clients ─────────────────────────────────────────────────────────────
_s3: Any = None
_genai_client: Any = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=REGION)
    return _s3


def _get_genai_client():
    """Lazily initialize the google-genai client."""
    global _genai_client
    if _genai_client is None:
        try:
            from google import genai
            _genai_client = genai.Client(api_key=GEMINI_API_KEY)
        except ImportError:
            raise ImportError(
                "google-genai package is required. Install with: pip install google-genai"
            )
    return _genai_client


# ── Core Extraction ──────────────────────────────────────────────────────────

def extract_from_image_bytes(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
) -> dict[str, Any]:
    """Extract property data from raw image bytes using Gemini.

    Args:
        image_bytes: Raw bytes of the image.
        mime_type: MIME type of the image.

    Returns:
        Dict with extracted property fields.

    Raises:
        ValueError: If MIME type is unsupported or extraction fails.
    """
    if mime_type not in SUPPORTED_MIMES:
        raise ValueError(f"Unsupported MIME type: {mime_type}. Supported: {SUPPORTED_MIMES}")

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    client = _get_genai_client()
    from google.genai import types

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            EXTRACTION_PROMPT,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
    )

    return _parse_extraction_response(response.text)


def extract_from_s3(
    s3_key: str,
    bucket: str | None = None,
) -> dict[str, Any]:
    """Extract property data from an image stored in S3.

    Args:
        s3_key: S3 object key (e.g., "tenant123/flyers/flyer.jpg").
        bucket: S3 bucket name (defaults to PROPERTY_DOCS_BUCKET).

    Returns:
        Dict with extracted property fields.
    """
    bucket = bucket or S3_BUCKET

    # Download image from S3
    response = _get_s3().get_object(Bucket=bucket, Key=s3_key)
    image_bytes = response["Body"].read()
    content_type = response.get("ContentType", "image/jpeg")

    logger.info("Extracting property data from S3: %s/%s (%s)", bucket, s3_key, content_type)
    return extract_from_image_bytes(image_bytes, content_type)


def extract_from_base64(
    base64_data: str,
    mime_type: str = "image/jpeg",
) -> dict[str, Any]:
    """Extract property data from a base64-encoded image.

    Useful for frontend uploads where the image is sent as base64.

    Args:
        base64_data: Base64-encoded image string (with or without data URI prefix).
        mime_type: MIME type of the image.

    Returns:
        Dict with extracted property fields.
    """
    # Strip data URI prefix if present
    if "," in base64_data:
        header, base64_data = base64_data.split(",", 1)
        # Extract MIME from header if available
        mime_match = re.match(r"data:([^;]+);", header)
        if mime_match:
            mime_type = mime_match.group(1)

    image_bytes = base64.b64decode(base64_data)
    return extract_from_image_bytes(image_bytes, mime_type)


# ── Document Text Extraction ────────────────────────────────────────────────

DOCUMENT_EXTRACTION_PROMPT = """Eres un asistente legal especializado en bienes raíces de Ecuador. Analiza este documento y extrae TODO el texto visible, incluyendo:

1. Tipo de documento (escritura, plano, certificado de predio, registro de la propiedad, etc.)
2. Información del propietario
3. Descripción legal del inmueble
4. Linderos y medidas
5. Información catastral
6. Cualquier restricción o gravamen
7. Fechas y notaría
8. Números de registro

Devuelve el texto extraído de forma organizada y legible. Si hay tablas, preséntalalas de forma clara.
NO inventes información. Solo extrae lo que es visible en el documento.
"""


def extract_document_text(
    image_bytes: bytes,
    mime_type: str = "application/pdf",
) -> str:
    """Extract text from a legal document image/PDF using Gemini.

    Used for processing escrituras, planos, certificados de predio,
    and other legal documents that need to be searchable via RAG.

    Args:
        image_bytes: Raw bytes of the document.
        mime_type: MIME type of the document.

    Returns:
        Extracted text as a string.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    client = _get_genai_client()
    from google.genai import types

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            DOCUMENT_EXTRACTION_PROMPT,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
    )

    return response.text


def extract_document_from_s3(s3_key: str, bucket: str | None = None) -> str:
    """Extract text from a legal document stored in S3.

    Args:
        s3_key: S3 object key.
        bucket: S3 bucket name.

    Returns:
        Extracted text.
    """
    bucket = bucket or S3_BUCKET
    response = _get_s3().get_object(Bucket=bucket, Key=s3_key)
    doc_bytes = response["Body"].read()
    content_type = response.get("ContentType", "application/pdf")

    logger.info("Extracting text from document: %s/%s", bucket, s3_key)
    return extract_document_text(doc_bytes, content_type)


# ── Response Parsing ─────────────────────────────────────────────────────────

def _parse_extraction_response(raw_text: str) -> dict[str, Any]:
    """Parse Gemini's JSON response into a clean property dict.

    Handles common issues like markdown wrappers, trailing commas, etc.
    """
    # Strip markdown code fences if present
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse Gemini response: %s\nRaw: %s", e, text[:500])
        return {"error": str(e), "raw_response": text[:500], "confidence": 0.0}

    # Normalize price to number
    if isinstance(data.get("price"), str):
        try:
            clean = re.sub(r"[^\d.]", "", data["price"])
            data["price"] = float(clean) if clean else None
        except ValueError:
            data["price"] = None

    # Ensure lists are actual lists
    for list_field in ("amenities", "tags"):
        if isinstance(data.get(list_field), str):
            data[list_field] = [item.strip() for item in data[list_field].split(",")]

    # Normalize transaction_type
    tx = (data.get("transaction_type") or "").lower()
    if tx in ("venta", "sale", "compra"):
        data["transaction_type"] = "sale"
    elif tx in ("renta", "rent", "alquiler", "arriendo"):
        data["transaction_type"] = "rent"

    # Normalize property_type
    ptype = (data.get("property_type") or "").lower()
    type_map = {
        "apartamento": "departamento",
        "depa": "departamento",
        "depto": "departamento",
        "lote": "terreno",
        "comercial": "local",
        "penthouse": "departamento",
    }
    if ptype in type_map:
        data["property_type"] = type_map[ptype]

    return data


# ── Batch Processing ─────────────────────────────────────────────────────────

def process_flyer_upload(
    tenant_id: str,
    s3_key: str,
    bucket: str | None = None,
) -> dict[str, Any]:
    """Full pipeline: extract → create property data from a flyer.

    Args:
        tenant_id: Tenant identifier.
        s3_key: S3 key of the uploaded flyer image.
        bucket: S3 bucket name.

    Returns:
        Dict with extracted property data, ready for the handler to save.
    """
    extracted = extract_from_s3(s3_key, bucket)

    if extracted.get("error"):
        return {"success": False, "error": extracted["error"]}

    # Add metadata
    extracted["_source"] = "flyer_extraction"
    extracted["_s3_key"] = s3_key
    extracted["_confidence"] = extracted.pop("confidence", 0.0)

    logger.info(
        "Extracted property from flyer: %s (confidence: %.2f)",
        extracted.get("name", "unknown"),
        extracted.get("_confidence", 0),
    )

    return {"success": True, "property_data": extracted}


def process_document_upload(
    tenant_id: str,
    property_id: str,
    s3_key: str,
    bucket: str | None = None,
) -> dict[str, Any]:
    """Full pipeline: extract text from legal document → store in vectors.

    Args:
        tenant_id: Tenant identifier.
        property_id: Property this document belongs to.
        s3_key: S3 key of the uploaded document.
        bucket: S3 bucket name.

    Returns:
        Dict with extraction result and vector key.
    """
    from documents import upload_document_text as store_doc_vector

    text = extract_document_from_s3(s3_key, bucket)

    if not text or len(text.strip()) < 20:
        return {"success": False, "error": "Could not extract meaningful text from document"}

    # Store extracted text as vector for RAG
    vector_key = store_doc_vector(tenant_id, property_id, s3_key, text)

    return {
        "success": True,
        "text_length": len(text),
        "vector_key": vector_key,
        "preview": text[:300],
    }
