"""
S3 + S3 Vectors document management for Clienta BR properties.

This module handles:
1. Uploading property documents (PDFs, images) to S3
2. Generating embeddings via Gemini Embedding (google-genai)
3. Storing vectors in S3 Vectors for RAG retrieval
4. Syncing property metadata with vector index
5. Removing vectors when a property is sold/rented
"""

from __future__ import annotations

import logging
import os
import re
import textwrap
from typing import Any

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ── Config ───────────────────────────────────────────────────────────────────
S3_BUCKET = os.environ.get("PROPERTY_DOCS_BUCKET", "clienta-br-property-docs")
VECTOR_BUCKET = os.environ.get("S3_VECTOR_BUCKET", "clienta-br-vectors")
VECTOR_INDEX = os.environ.get("S3_VECTOR_INDEX", "property-listings")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_EMBED_MODEL = "gemini-embedding-2"  # Google Gemini Embedding
EMBED_DIMENSIONS = 768  # reduced from 3072 default for cost/speed
REGION = os.environ.get("AWS_REGION", "us-east-1")

# Lazy clients ────────────────────────────────────────────────────────────────
_s3: Any = None
_s3v: Any = None
_genai_client: Any = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=REGION)
    return _s3


def _get_s3v():
    global _s3v
    if _s3v is None:
        _s3v = boto3.client("s3vectors", region_name=REGION)
    return _s3v


def _get_genai_client():
    """Lazily initialize the google-genai client for embeddings."""
    global _genai_client
    if _genai_client is None:
        from google import genai
        _genai_client = genai.Client(api_key=GEMINI_API_KEY)
    return _genai_client


# ── Embedding ────────────────────────────────────────────────────────────────

def generate_embedding(text: str) -> list[float]:
    """Generate a vector embedding using Gemini Embedding (google-genai).

    Args:
        text: The text to embed.

    Returns:
        List of floats with `EMBED_DIMENSIONS` dimensions.
    """
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text")

    client = _get_genai_client()
    result = client.models.embed_content(
        model=GEMINI_EMBED_MODEL,
        contents=text[:8000],  # safety truncation
        config={"output_dimensionality": EMBED_DIMENSIONS},
    )
    return result.embeddings[0].values


# ── S3 Vectors Management ───────────────────────────────────────────────────

def ensure_vector_index():
    """Create the vector bucket and index if they don't exist.
    Safe to call repeatedly — idempotent.
    """
    client = _get_s3v()

    # Create vector bucket (idempotent)
    try:
        client.create_vector_bucket(VectorBucketName=VECTOR_BUCKET)
        logger.info("Created vector bucket: %s", VECTOR_BUCKET)
    except client.exceptions.ConflictException:
        pass  # already exists

    # Create vector index (idempotent)
    try:
        client.create_index(
            VectorBucketName=VECTOR_BUCKET,
            VectorIndexName=VECTOR_INDEX,
            Dimensions=EMBED_DIMENSIONS,
            SimilarityMetric="COSINE",
        )
        logger.info("Created vector index: %s", VECTOR_INDEX)
    except client.exceptions.ConflictException:
        pass  # already exists


def _build_property_text(property_data: dict) -> str:
    """Build a rich text representation of a property for embedding.

    Combines all searchable fields into a single text block that
    captures the essence of the listing for semantic search.
    """
    parts = []

    # Core identity
    if property_data.get("name"):
        parts.append(f"Propiedad: {property_data['name']}")
    if property_data.get("reference_code"):
        parts.append(f"Código: {property_data['reference_code']}")
    if property_data.get("project_name"):
        parts.append(f"Proyecto: {property_data['project_name']}")

    # Transaction
    tx = property_data.get("transaction_type", "sale")
    parts.append(f"Tipo: {'Venta' if tx == 'sale' else 'Renta'}")
    if property_data.get("price"):
        unit = "/mes" if tx == "rent" else ""
        parts.append(f"Precio: ${property_data['price']}{unit} USD")

    # Property type
    ptype = property_data.get("property_type", "")
    type_map = {
        "casa": "Casa", "departamento": "Departamento", "terreno": "Terreno",
        "oficina": "Oficina", "local": "Local Comercial", "suite": "Suite",
    }
    if ptype:
        parts.append(f"Tipo de propiedad: {type_map.get(ptype, ptype)}")

    # Location
    loc_parts = []
    if property_data.get("neighborhood"):
        loc_parts.append(property_data["neighborhood"])
    if property_data.get("city"):
        loc_parts.append(property_data["city"])
    if property_data.get("address"):
        loc_parts.append(property_data["address"])
    if loc_parts:
        parts.append(f"Ubicación: {', '.join(loc_parts)}")

    # Features
    features = []
    if property_data.get("bedrooms"):
        features.append(f"{property_data['bedrooms']} habitaciones")
    if property_data.get("bathrooms"):
        features.append(f"{property_data['bathrooms']} baños")
    if property_data.get("parking_spots"):
        features.append(f"{property_data['parking_spots']} parqueaderos")
    if property_data.get("area_m2"):
        features.append(f"{property_data['area_m2']}m² de área")
    if property_data.get("year_built"):
        features.append(f"construido en {property_data['year_built']}")
    if property_data.get("floor_number"):
        features.append(f"piso {property_data['floor_number']}")
    if features:
        parts.append(f"Características: {', '.join(features)}")

    # Amenities
    amenities = property_data.get("amenities") or []
    if amenities:
        parts.append(f"Amenidades: {', '.join(amenities)}")

    # Description
    if property_data.get("description"):
        parts.append(f"Descripción: {property_data['description']}")

    # Tags
    tags = property_data.get("tags") or []
    if tags:
        parts.append(f"Etiquetas: {', '.join(tags)}")

    return "\n".join(parts)


def _build_vector_metadata(tenant_id: str, property_data: dict) -> dict:
    """Build metadata dict for vector filtering.

    S3 Vectors supports metadata-based filtering during queries,
    so we store key filterable attributes.
    """
    meta = {
        "tenant_id": tenant_id,
        "property_id": property_data.get("id", ""),
        "status": property_data.get("status", "disponible"),
        "transaction_type": property_data.get("transaction_type", "sale"),
    }
    if property_data.get("city"):
        meta["city"] = property_data["city"]
    if property_data.get("property_type"):
        meta["property_type"] = property_data["property_type"]
    if property_data.get("price"):
        meta["price"] = str(property_data["price"])
    if property_data.get("bedrooms"):
        meta["bedrooms"] = str(property_data["bedrooms"])
    if property_data.get("project_name"):
        meta["project_name"] = property_data["project_name"]
    return meta


def upsert_property_vector(tenant_id: str, property_data: dict) -> str:
    """Embed a property listing and store/update in S3 Vectors.

    This is called:
    - When a property is created
    - When a property is updated
    - When a document is processed and text is extracted

    Args:
        tenant_id: The tenant identifier.
        property_data: Dict with property fields from DynamoDB.

    Returns:
        The vector key used for storage.
    """
    prop_id = property_data.get("id", "")
    vector_key = f"{tenant_id}#{prop_id}"
    text = _build_property_text(property_data)

    if not text.strip():
        logger.warning("Empty text for property %s, skipping embedding", prop_id)
        return vector_key

    # Generate embedding
    embedding = generate_embedding(text)

    # Build metadata for filtering
    metadata = _build_vector_metadata(tenant_id, property_data)

    # Upsert into S3 Vectors
    _get_s3v().put_vectors(
        VectorBucketName=VECTOR_BUCKET,
        VectorIndexName=VECTOR_INDEX,
        Data=[
            {
                "Key": vector_key,
                "Data": embedding,
                "Metadata": metadata,
            }
        ],
    )
    logger.info("Upserted vector for property %s (key=%s)", prop_id, vector_key)
    return vector_key


def delete_property_vector(tenant_id: str, property_id: str):
    """Remove a property's vector from the index.

    Called when a property is deleted or permanently removed from listings.
    """
    vector_key = f"{tenant_id}#{property_id}"
    try:
        _get_s3v().delete_vectors(
            VectorBucketName=VECTOR_BUCKET,
            VectorIndexName=VECTOR_INDEX,
            Keys=[vector_key],
        )
        logger.info("Deleted vector for property %s", property_id)
    except Exception as e:
        logger.error("Failed to delete vector %s: %s", vector_key, e)


def update_property_status_vector(tenant_id: str, property_id: str, new_status: str):
    """Update the status metadata of an existing property vector.

    When a property is sold or rented, we update its metadata so
    that RAG queries can filter by status=disponible to exclude it.
    This avoids costly re-embedding — only metadata changes.
    """
    vector_key = f"{tenant_id}#{property_id}"
    # S3 Vectors metadata update requires re-putting the vector
    # We need to fetch the existing vector first
    try:
        result = _get_s3v().get_vectors(
            VectorBucketName=VECTOR_BUCKET,
            VectorIndexName=VECTOR_INDEX,
            Keys=[vector_key],
        )
        vectors = result.get("Vectors", [])
        if not vectors:
            logger.warning("Vector %s not found for status update", vector_key)
            return

        existing = vectors[0]
        metadata = existing.get("Metadata", {})
        metadata["status"] = new_status

        _get_s3v().put_vectors(
            VectorBucketName=VECTOR_BUCKET,
            VectorIndexName=VECTOR_INDEX,
            Data=[
                {
                    "Key": vector_key,
                    "Data": existing["Data"],
                    "Metadata": metadata,
                }
            ],
        )
        logger.info("Updated status to '%s' for property vector %s", new_status, vector_key)
    except Exception as e:
        logger.error("Failed to update status for %s: %s", vector_key, e)


# ── Document Processing (S3 → Embedding) ────────────────────────────────────

def upload_document_text(
    tenant_id: str,
    property_id: str,
    doc_key: str,
    extracted_text: str,
) -> str:
    """Store extracted document text as a supplementary vector.

    When a document (escritura, plano, certificado) is processed,
    we create an additional vector keyed by the document S3 key
    so the RAG system can answer technical/legal questions.

    Args:
        tenant_id: Tenant identifier.
        property_id: Property this document belongs to.
        doc_key: S3 key of the original document.
        extracted_text: Text extracted from the document.

    Returns:
        The vector key used for storage.
    """
    # Use a doc-specific key to allow multiple docs per property
    safe_key = re.sub(r"[^a-zA-Z0-9_\-#]", "_", doc_key)
    vector_key = f"{tenant_id}#doc#{safe_key}"

    # Prefix with context
    enriched = f"Documento legal de propiedad {property_id}:\n\n{extracted_text}"

    embedding = generate_embedding(enriched[:8000])

    metadata = {
        "tenant_id": tenant_id,
        "property_id": property_id,
        "type": "document",
        "doc_key": doc_key,
        "status": "disponible",  # inherits from property
    }

    _get_s3v().put_vectors(
        VectorBucketName=VECTOR_BUCKET,
        VectorIndexName=VECTOR_INDEX,
        Data=[
            {
                "Key": vector_key,
                "Data": embedding,
                "Metadata": metadata,
            }
        ],
    )
    logger.info("Stored document vector for %s (key=%s)", doc_key, vector_key)
    return vector_key


def delete_property_documents(tenant_id: str, property_id: str):
    """Delete all document vectors associated with a property.

    Called when a property is deleted to clean up all related vectors.
    """
    try:
        # Query for all doc vectors for this property
        prefix = f"{tenant_id}#doc#"
        result = _get_s3v().query_vectors(
            VectorBucketName=VECTOR_BUCKET,
            VectorIndexName=VECTOR_INDEX,
            QueryVector=[0.0] * EMBED_DIMENSIONS,  # dummy vector
            TopK=100,
            Filter={
                "andAll": [
                    {"equals": {"key": "tenant_id", "value": tenant_id}},
                    {"equals": {"key": "property_id", "value": property_id}},
                    {"equals": {"key": "type", "value": "document"}},
                ]
            },
        )
        keys = [v["Key"] for v in result.get("Vectors", [])]
        if keys:
            _get_s3v().delete_vectors(
                VectorBucketName=VECTOR_BUCKET,
                VectorIndexName=VECTOR_INDEX,
                Keys=keys,
            )
            logger.info("Deleted %d document vectors for property %s", len(keys), property_id)
    except Exception as e:
        logger.error("Failed to delete doc vectors for %s: %s", property_id, e)
