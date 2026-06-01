"""Shared building blocks for bank-statement parsing.

A *statement* is a bank export of account movements. It can arrive in several
formats (CSV today; Excel / PDF in the future). Every format parser converts the
raw file bytes into the same ``ParsedTransaction`` list, so the rest of the
pipeline (matching, confirmation, persistence) stays format-agnostic.

``parse_statement`` is the Open/Closed seam: it routes a file to the right parser
by extension. Adding a format = adding one branch, nothing else changes.
"""
import re
from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class ParsedTransaction:
    date: str          # ISO format YYYY-MM-DD
    concept: str       # Raw description from the bank
    amount: float      # Always positive (credit / income amount)
    raw_text: str      # Full raw line, kept for debugging


def normalize_amount(raw: str) -> Optional[float]:
    """Convert a European-style amount string to float.

    Handles thousands spaces and comma decimals: '1 234,56' -> 1234.56,
    '160' -> 160.0. Returns None if the value cannot be parsed.
    """
    cleaned = raw.replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_date(raw: str) -> Optional[str]:
    """Convert a DD/MM/YYYY string to ISO YYYY-MM-DD. Returns None if invalid."""
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', raw.strip())
    if not m:
        return None
    day, month, year = m.groups()
    try:
        date(int(year), int(month), int(day))
        return f'{year}-{month}-{day}'
    except ValueError:
        return None


# Extensions we currently know how to parse, for caller-side validation.
SUPPORTED_EXTENSIONS = ('.csv',)


def parse_statement(filename: str, content: bytes) -> list[ParsedTransaction]:
    """Route a statement file to the parser matching its extension.

    Future formats (.xlsx, .pdf) plug in here without touching callers.
    Raises ValueError for an unsupported extension.
    """
    ext = ('.' + filename.lower().rsplit('.', 1)[-1]) if '.' in filename else ''

    if ext == '.csv':
        from app.services.csv_parser import parse_csv
        return parse_csv(content)

    raise ValueError(f'Formato no soportado: {ext or filename}')
