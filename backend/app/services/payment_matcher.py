"""
Fuzzy matching between bank transaction concepts and client payment identifiers.
"""
from dataclasses import dataclass
from typing import Optional

from app.models.client import Client


@dataclass
class MatchResult:
    client_id: Optional[int]
    client_name: Optional[str]
    match_type: str   # "exact" | "partial" | "none"
    confidence: float  # 0.0 – 1.0


def match_transaction(concept: str, clients: list[Client]) -> MatchResult:
    """
    Try to match a bank transaction concept to a client using their
    payment_identifiers and payment_name field.

    Priority:
      1. Exact match (concept contains full identifier)
      2. Partial match (identifier is a substring of concept, or vice-versa)
    """
    concept_lower = concept.lower()

    best: Optional[MatchResult] = None

    for client in clients:
        identifiers: list[str] = []

        # Collect all matching strings for this client
        if client.payment_name:
            identifiers.append(client.payment_name)
        for payer in client.payers:
            identifiers.append(payer.name)

        for identifier in identifiers:
            id_lower = identifier.lower()

            if id_lower == concept_lower:
                # Perfect exact match
                return MatchResult(
                    client_id=client.id,
                    client_name=client.name,
                    match_type="exact",
                    confidence=1.0,
                )

            if id_lower in concept_lower:
                # Identifier found inside the concept
                confidence = len(id_lower) / max(len(concept_lower), 1)
                result = MatchResult(
                    client_id=client.id,
                    client_name=client.name,
                    match_type="partial",
                    confidence=round(min(confidence, 0.99), 2),
                )
                if best is None or result.confidence > best.confidence:
                    best = result

            elif concept_lower in id_lower:
                # Concept is contained in the identifier (less reliable)
                confidence = len(concept_lower) / max(len(id_lower), 1) * 0.7
                result = MatchResult(
                    client_id=client.id,
                    client_name=client.name,
                    match_type="partial",
                    confidence=round(confidence, 2),
                )
                if best is None or result.confidence > best.confidence:
                    best = result

    return best or MatchResult(
        client_id=None,
        client_name=None,
        match_type="none",
        confidence=0.0,
    )
