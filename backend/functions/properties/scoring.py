"""
Lead scoring engine for Clienta BR real estate.

Calculates a 0-100 probability score based on:
1. Intent signals (buy intent > rent intent > browsing)
2. Budget clarity (mentioned budget → higher score)
3. Urgency indicators (timeline, financing status)
4. Engagement depth (# of messages, property views)
5. Matching precision (budget vs. property price)
6. Visit readiness (asked about scheduling → high score)

Scores trigger different actions:
- 0-25: Passive — bot handles, no notification
- 26-50: Warm — bot handles, weekly digest to agent
- 51-75: Hot — bot handles + dashboard alert
- 76-100: Ready — immediate notification to agent (email + dashboard)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── Scoring Weights ──────────────────────────────────────────────────────────

@dataclass
class ScoringWeights:
    """Configurable weights for each scoring dimension."""
    intent: float = 25.0       # Max 25 points for clear buy/rent intent
    budget: float = 20.0       # Max 20 points for budget clarity
    urgency: float = 15.0      # Max 15 points for urgency signals
    engagement: float = 15.0   # Max 15 points for engagement depth
    matching: float = 15.0     # Max 15 points for budget-property match
    visit: float = 10.0        # Max 10 points for visit readiness

DEFAULT_WEIGHTS = ScoringWeights()


# ── Scoring Functions ────────────────────────────────────────────────────────

def _score_intent(intent_data: dict) -> float:
    """Score based on detected purchase/rent intent.

    Returns:
        Score from 0 to 1.0 (multiply by weight).
    """
    intent = intent_data.get("intent", "other")
    scores = {
        "buy": 1.0,
        "rent": 0.85,
        "visit": 0.9,
        "info": 0.4,
        "other": 0.1,
    }
    return scores.get(intent, 0.1)


def _score_budget(intent_data: dict, property_price: float | None = None) -> float:
    """Score based on budget clarity and mention.

    Having a clear budget shows serious intent.
    """
    budget = intent_data.get("budget_mentioned")
    wants_financing = intent_data.get("wants_financing", False)

    score = 0.0
    if budget is not None and budget > 0:
        score = 0.8
        # Bonus if they mentioned financing (shows they've thought about it)
        if wants_financing:
            score = 1.0
    elif wants_financing:
        score = 0.5  # Mentioned financing but no specific budget

    return score


def _score_urgency(intent_data: dict) -> float:
    """Score based on urgency signals."""
    urgency = intent_data.get("urgency", "low")
    scores = {
        "high": 1.0,
        "medium": 0.6,
        "low": 0.2,
    }
    return scores.get(urgency, 0.2)


def _score_engagement(
    message_count: int = 0,
    properties_viewed: int = 0,
    days_active: int = 0,
) -> float:
    """Score based on engagement depth.

    More messages, more property views, and sustained interest
    indicate a more serious buyer.
    """
    msg_score = min(message_count / 10, 1.0)  # Caps at 10 messages
    view_score = min(properties_viewed / 5, 1.0)  # Caps at 5 properties
    days_score = min(days_active / 7, 1.0) if days_active > 0 else 0  # Caps at 7 days

    # Weighted average: messages matter most, then views, then days
    return (msg_score * 0.5) + (view_score * 0.3) + (days_score * 0.2)


def _score_matching(
    budget: float | None,
    property_price: float | None,
) -> float:
    """Score based on how well the budget matches the property price.

    Perfect match = 1.0, within 20% = 0.7, >50% off = 0.1
    """
    if budget is None or property_price is None:
        return 0.3  # Neutral if we don't know

    if property_price <= 0:
        return 0.3

    ratio = budget / property_price

    # Budget exceeds price slightly (great match)
    if 0.9 <= ratio <= 1.3:
        return 1.0
    # Budget is within 20% on either side
    elif 0.8 <= ratio <= 1.5:
        return 0.7
    # Budget is somewhat close
    elif 0.5 <= ratio <= 2.0:
        return 0.4
    else:
        return 0.1


def _score_visit(intent_data: dict) -> float:
    """Score based on visit readiness.

    If the client asked about scheduling a visit, they're very serious.
    """
    if intent_data.get("ready_for_visit"):
        return 1.0
    if intent_data.get("intent") == "visit":
        return 0.8
    return 0.0


# ── Main Scoring Engine ─────────────────────────────────────────────────────

def calculate_lead_score(
    intent_data: dict,
    *,
    message_count: int = 1,
    properties_viewed: int = 0,
    days_active: int = 0,
    property_price: float | None = None,
    previous_score: int | None = None,
    weights: ScoringWeights = DEFAULT_WEIGHTS,
) -> dict[str, Any]:
    """Calculate the composite lead score.

    Args:
        intent_data: Output from detect_intent() in query.py.
        message_count: Total messages from this contact.
        properties_viewed: Number of distinct properties asked about.
        days_active: Days since first contact.
        property_price: Price of the most-recent property they asked about.
        previous_score: Previous score if any (for momentum bonus).
        weights: Scoring weights configuration.

    Returns:
        Dict with:
        - score: int (0-100)
        - tier: str (passive|warm|hot|ready)
        - intent: str (buy|rent|info|other)
        - breakdown: dict with individual dimension scores
        - summary: str (human-readable summary)
        - action: str (recommended action)
    """
    budget = intent_data.get("budget_mentioned")
    if isinstance(budget, str):
        try:
            budget = float(budget.replace(",", "").replace(".", ""))
        except (ValueError, AttributeError):
            budget = None

    # Calculate individual scores
    intent_score = _score_intent(intent_data)
    budget_score = _score_budget(intent_data, property_price)
    urgency_score = _score_urgency(intent_data)
    engagement_score = _score_engagement(message_count, properties_viewed, days_active)
    matching_score = _score_matching(budget, property_price)
    visit_score = _score_visit(intent_data)

    # Build weighted total
    raw_score = (
        intent_score * weights.intent
        + budget_score * weights.budget
        + urgency_score * weights.urgency
        + engagement_score * weights.engagement
        + matching_score * weights.matching
        + visit_score * weights.visit
    )

    # Momentum bonus: if score is increasing, add small bonus
    if previous_score is not None and raw_score > previous_score:
        momentum = min((raw_score - previous_score) * 0.1, 5)
        raw_score += momentum

    # Clamp to 0-100
    score = max(0, min(100, round(raw_score)))

    # Determine tier
    if score >= 76:
        tier = "ready"
        action = "NOTIFICAR AGENTE — Lead listo para visita. Contactar inmediatamente."
    elif score >= 51:
        tier = "hot"
        action = "ALERTA DASHBOARD — Lead caliente, monitorear de cerca."
    elif score >= 26:
        tier = "warm"
        action = "SEGUIMIENTO — Incluir en resumen semanal de leads."
    else:
        tier = "passive"
        action = "AUTOMATIZADO — Bot maneja la conversación."

    # Build human-readable summary
    intent_type = intent_data.get("intent", "other")
    intent_label = {
        "buy": "compra", "rent": "renta", "visit": "visita",
        "info": "información", "other": "no determinada"
    }.get(intent_type, intent_type)

    summary_parts = [f"Intención: {intent_label}"]
    if budget:
        summary_parts.append(f"Presupuesto: ${budget:,.0f}")
    if intent_data.get("location_mentioned"):
        summary_parts.append(f"Zona: {intent_data['location_mentioned']}")
    if intent_data.get("bedrooms_mentioned"):
        summary_parts.append(f"Habitaciones: {intent_data['bedrooms_mentioned']}")
    if intent_data.get("wants_financing"):
        summary_parts.append("Busca financiamiento")
    if intent_data.get("ready_for_visit"):
        summary_parts.append("Listo para visita")

    summary = " · ".join(summary_parts)

    breakdown = {
        "intent": round(intent_score * weights.intent, 1),
        "budget": round(budget_score * weights.budget, 1),
        "urgency": round(urgency_score * weights.urgency, 1),
        "engagement": round(engagement_score * weights.engagement, 1),
        "matching": round(matching_score * weights.matching, 1),
        "visit": round(visit_score * weights.visit, 1),
    }

    result = {
        "score": score,
        "tier": tier,
        "intent": intent_type,
        "breakdown": breakdown,
        "summary": summary,
        "action": action,
    }

    logger.info(
        "Lead score: %d (%s) — %s",
        score, tier, summary,
    )

    return result


# ── Tier Thresholds ──────────────────────────────────────────────────────────

NOTIFICATION_THRESHOLD = 75  # Score >= 75 triggers agent notification


def should_notify_agent(score: int) -> bool:
    """Check if this score should trigger an agent notification."""
    return score >= NOTIFICATION_THRESHOLD


def get_tier_emoji(tier: str) -> str:
    """Get emoji for display in notifications."""
    return {
        "ready": "🔥",
        "hot": "🟠",
        "warm": "🟡",
        "passive": "⚪",
    }.get(tier, "⚪")
