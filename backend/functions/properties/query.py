"""
RAG query engine for Clienta BR real estate properties.

Uses:
- S3 Vectors for semantic similarity search
- Claude 3.5 Sonnet (Bedrock) for answer generation from retrieved context
- Metadata filtering (status, city, transaction_type) for precision

Designed to power WhatsApp bot responses about property details,
legal documents, pricing, and availability.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ── Config ───────────────────────────────────────────────────────────────────
VECTOR_BUCKET = os.environ.get("S3_VECTOR_BUCKET", "clienta-br-vectors")
VECTOR_INDEX = os.environ.get("S3_VECTOR_INDEX", "property-listings")
EMBED_MODEL_ID = "amazon.titan-embed-text-v2:0"
EMBED_DIMENSIONS = 512
# Claude 3.5 Sonnet for complex reasoning over retrieved context
GENERATION_MODEL_ID = os.environ.get(
    "BEDROCK_GENERATION_MODEL",
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
)
REGION = os.environ.get("AWS_REGION", "us-east-1")
TOP_K = 5  # Number of vectors to retrieve

# ── Lazy Clients ─────────────────────────────────────────────────────────────
_s3v: Any = None
_bedrock: Any = None


def _get_s3v():
    global _s3v
    if _s3v is None:
        _s3v = boto3.client("s3vectors", region_name=REGION)
    return _s3v


def _get_bedrock():
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client("bedrock-runtime", region_name=REGION)
    return _bedrock


# ── Embedding ────────────────────────────────────────────────────────────────

def _embed_query(text: str) -> list[float]:
    """Generate embedding for a query string using Titan Embed V2."""
    payload = {
        "inputText": text[:8000],
        "dimensions": EMBED_DIMENSIONS,
        "normalize": True,
    }
    response = _get_bedrock().invoke_model(
        body=json.dumps(payload),
        modelId=EMBED_MODEL_ID,
        accept="application/json",
        contentType="application/json",
    )
    body = json.loads(response["body"].read())
    return body["embedding"]


# ── Vector Search ────────────────────────────────────────────────────────────

def search_properties(
    tenant_id: str,
    query: str,
    *,
    transaction_type: str | None = None,
    city: str | None = None,
    include_sold: bool = False,
    top_k: int = TOP_K,
) -> list[dict[str, Any]]:
    """Semantic search over property vectors with metadata filtering.

    Args:
        tenant_id: Tenant identifier for isolation.
        query: Natural language search query (e.g., "departamento 2 cuartos en la carolina").
        transaction_type: Filter by "sale" or "rent".
        city: Filter by city name.
        include_sold: If False (default), excludes vendido/rentado properties.
        top_k: Number of results to return.

    Returns:
        List of dicts with property metadata and similarity scores.
    """
    # Build query embedding
    query_embedding = _embed_query(query)

    # Build metadata filter
    filters = [{"equals": {"key": "tenant_id", "value": tenant_id}}]

    if not include_sold:
        filters.append({"equals": {"key": "status", "value": "disponible"}})

    if transaction_type:
        filters.append({"equals": {"key": "transaction_type", "value": transaction_type}})

    if city:
        filters.append({"equals": {"key": "city", "value": city}})

    filter_expr = {"andAll": filters} if len(filters) > 1 else filters[0]

    # Query S3 Vectors
    try:
        result = _get_s3v().query_vectors(
            VectorBucketName=VECTOR_BUCKET,
            VectorIndexName=VECTOR_INDEX,
            QueryVector=query_embedding,
            TopK=top_k,
            Filter=filter_expr,
        )
    except Exception as e:
        logger.error("Vector search failed: %s", e)
        return []

    # Parse results
    results = []
    for match in result.get("Vectors", []):
        meta = match.get("Metadata", {})
        results.append({
            "property_id": meta.get("property_id", ""),
            "status": meta.get("status", ""),
            "transaction_type": meta.get("transaction_type", ""),
            "city": meta.get("city", ""),
            "property_type": meta.get("property_type", ""),
            "price": meta.get("price", ""),
            "bedrooms": meta.get("bedrooms", ""),
            "project_name": meta.get("project_name", ""),
            "score": match.get("Score", 0),
            "vector_key": match.get("Key", ""),
        })

    logger.info(
        "Property search for '%s' returned %d results (tenant=%s)",
        query[:50], len(results), tenant_id,
    )
    return results


# ── RAG Generation ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres un asistente inmobiliario profesional de Ecuador. Tu trabajo es ayudar a clientes interesados en comprar o rentar propiedades.

REGLAS IMPORTANTES:
1. Solo responde con información que existe en el CONTEXTO proporcionado.
2. Si no encuentras la respuesta en el contexto, di honestamente que no tienes esa información y sugiere contactar al agente.
3. Responde siempre en español ecuatoriano amigable y profesional.
4. Si mencionas precios, incluye la moneda (USD).
5. Si el cliente pregunta por financiamiento, menciona BIESS e instituciones financieras locales.
6. Nunca inventes caracteristicas, precios o disponibilidad.
7. Sé conciso pero completo — estás respondiendo por WhatsApp.
8. Si el lead parece listo para agendar visita, ofrece coordinar con el agente asignado.
"""


def generate_rag_response(
    tenant_id: str,
    query: str,
    *,
    conversation_history: list[dict] | None = None,
    transaction_type: str | None = None,
    city: str | None = None,
    property_id: str | None = None,
) -> dict[str, Any]:
    """Full RAG pipeline: search → retrieve → generate.

    Args:
        tenant_id: Tenant identifier.
        query: User's question (from WhatsApp).
        conversation_history: Optional list of prior messages [{role, content}].
        transaction_type: Optional filter for sale/rent.
        city: Optional city filter.
        property_id: If provided, search only this property's vectors.

    Returns:
        Dict with 'answer', 'sources' (property IDs), and 'confidence'.
    """
    # Step 1: Retrieve relevant vectors
    if property_id:
        # Search specifically for this property's documents
        search_results = search_properties(
            tenant_id, query, include_sold=True, top_k=TOP_K,
        )
        # Filter to this property
        search_results = [r for r in search_results if r["property_id"] == property_id]
    else:
        search_results = search_properties(
            tenant_id, query,
            transaction_type=transaction_type,
            city=city,
            top_k=TOP_K,
        )

    if not search_results:
        return {
            "answer": "No encontré propiedades que coincidan con tu búsqueda. ¿Podrías darme más detalles sobre lo que buscas? Por ejemplo: ubicación, número de habitaciones, presupuesto, o si buscas compra o arriendo.",
            "sources": [],
            "confidence": 0.0,
        }

    # Step 2: Build context from retrieved results
    context_parts = []
    source_ids = []
    for i, result in enumerate(search_results, 1):
        prop_id = result["property_id"]
        if prop_id and prop_id not in source_ids:
            source_ids.append(prop_id)

        context_parts.append(
            f"[Propiedad {i}] ID: {result['property_id']}, "
            f"Tipo: {result.get('transaction_type')}, "
            f"Ciudad: {result.get('city')}, "
            f"Precio: ${result.get('price')}, "
            f"Habitaciones: {result.get('bedrooms')}, "
            f"Tipo: {result.get('property_type')}, "
            f"Proyecto: {result.get('project_name')}, "
            f"Score: {result.get('score', 0):.3f}"
        )

    context = "\n".join(context_parts)

    # Step 3: Build messages for Claude
    messages = []

    # Add conversation history if available
    if conversation_history:
        for msg in conversation_history[-6:]:  # Last 6 messages for context
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

    # Add the current query with context
    user_message = f"""CONTEXTO DE PROPIEDADES DISPONIBLES:
{context}

PREGUNTA DEL CLIENTE:
{query}

Responde de forma útil y concisa basándote SOLO en el contexto proporcionado."""

    messages.append({"role": "user", "content": user_message})

    # Step 4: Generate with Claude
    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "system": SYSTEM_PROMPT,
            "messages": messages,
            "temperature": 0.3,
        })

        response = _get_bedrock().invoke_model(
            body=body,
            modelId=GENERATION_MODEL_ID,
            accept="application/json",
            contentType="application/json",
        )

        response_body = json.loads(response["body"].read())
        answer = response_body["content"][0]["text"]

        # Calculate confidence based on search scores
        avg_score = sum(r.get("score", 0) for r in search_results) / len(search_results)

        return {
            "answer": answer,
            "sources": source_ids,
            "confidence": round(avg_score, 3),
            "model": GENERATION_MODEL_ID,
            "results_count": len(search_results),
        }

    except Exception as e:
        logger.error("RAG generation failed: %s", e)
        return {
            "answer": "Lo siento, tuve un problema procesando tu consulta. ¿Podrías intentar de nuevo?",
            "sources": source_ids,
            "confidence": 0.0,
            "error": str(e),
        }


# ── Intent Detection ─────────────────────────────────────────────────────────

INTENT_PROMPT = """Analiza el siguiente mensaje de un cliente de WhatsApp y determina su intención respecto a bienes raíces.

Mensaje: "{message}"

Responde SOLO con un JSON:
{{
  "intent": "buy" | "rent" | "info" | "visit" | "other",
  "urgency": "high" | "medium" | "low",
  "budget_mentioned": número o null,
  "location_mentioned": "ubicación" o null,
  "bedrooms_mentioned": número o null,
  "property_type_mentioned": "tipo" o null,
  "wants_financing": true | false,
  "ready_for_visit": true | false,
  "summary": "resumen breve de la intención"
}}"""


def detect_intent(message: str) -> dict[str, Any]:
    """Detect the purchase/rent intent from a WhatsApp message.

    Used by the lead scoring system to classify incoming messages
    and update the lead's score accordingly.

    Args:
        message: Raw text from WhatsApp.

    Returns:
        Dict with intent classification fields.
    """
    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "messages": [
                {"role": "user", "content": INTENT_PROMPT.format(message=message)},
            ],
            "temperature": 0.1,
        })

        response = _get_bedrock().invoke_model(
            body=body,
            modelId=GENERATION_MODEL_ID,
            accept="application/json",
            contentType="application/json",
        )

        response_body = json.loads(response["body"].read())
        text = response_body["content"][0]["text"].strip()

        # Parse JSON from response
        import re
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        return json.loads(text)

    except Exception as e:
        logger.error("Intent detection failed: %s", e)
        return {
            "intent": "other",
            "urgency": "low",
            "summary": "Could not determine intent",
            "error": str(e),
        }
