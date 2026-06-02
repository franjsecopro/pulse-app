"""
Token-based fuzzy matching between bank transaction concepts and clients.

Bank concepts are noisy (titles like MADAME, long reference numbers, surname
first). So matching works on NORMALISED TOKENS, and confidence measures how much
of the CLIENT'S NAME appears in the concept — never how much of the concept is
the name. That keeps a full-name hit at ~1.0 regardless of surrounding noise.
"""
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional

from app.models.client import Client

# Suggestions below this confidence are dropped (treated as "none").
MIN_CONFIDENCE = 0.3


@dataclass
class MatchResult:
    client_id: Optional[int]
    client_name: Optional[str]
    match_type: str   # "exact" | "partial" | "none"
    confidence: float  # 0.0 – 1.0


def _normalize(text: str) -> str:
    """Lowercase, strip accents, reduce to alphanumeric tokens separated by spaces.

    'José García' -> 'jose garcia'; 'VIR/MME MANUELA-JOSEFA' -> 'vir mme manuela josefa'
    """
    decomposed = unicodedata.normalize("NFKD", text)
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", without_accents.lower()).strip()


def match_transaction(concept: str, clients: list[Client]) -> MatchResult:
    """Match a bank transaction concept to a client by name / payment identifiers.

    Scoring (token space):
      coverage    = matched name tokens / total name tokens  (is the whole name there?)
      specificity = min(1.0, name token count / 2)           (longer name = more reliable)
      confidence  = coverage * specificity

    A full multi-token name found in the concept is labelled "exact"; a string
    that equals the concept exactly is also "exact". Everything else above
    MIN_CONFIDENCE is "partial"; below it, no suggestion.
    """
    concept_norm = _normalize(concept)
    concept_tokens = set(concept_norm.split())

    best: Optional[MatchResult] = None

    for client in clients:
        identifiers: list[str] = []
        if client.payment_name:
            identifiers.append(client.payment_name)
        identifiers.extend(payer.name for payer in client.payers)

        for identifier in identifiers:
            id_norm = _normalize(identifier)
            id_tokens = set(id_norm.split())
            if not id_tokens:
                continue

            # 1. Exact string match — best possible, return immediately.
            if id_norm == concept_norm:
                return MatchResult(client.id, client.name, "exact", 1.0)

            matched = id_tokens & concept_tokens
            if not matched:
                continue

            coverage = len(matched) / len(id_tokens)
            specificity = min(1.0, len(id_tokens) / 2)
            confidence = round(coverage * specificity, 2)

            # 2. Whole multi-token name present -> treat as exact.
            if coverage == 1.0 and len(id_tokens) >= 2:
                match_type = "exact"
            elif confidence >= MIN_CONFIDENCE:
                match_type = "partial"
            else:
                continue

            if best is None or confidence > best.confidence:
                best = MatchResult(client.id, client.name, match_type, confidence)

    return best or MatchResult(None, None, "none", 0.0)
