"""
Parser for Hello Bank / BNP Paribas account statements (PDF).

The statement typically has a table with columns:
  Date | Description | Debit | Credit
We extract only Credit rows (income) and return them as ParsedTransaction objects.
"""
import re
from dataclasses import dataclass
from datetime import date
from typing import Optional

import pdfplumber


@dataclass
class ParsedTransaction:
    date: str          # ISO format YYYY-MM-DD
    concept: str       # Raw description from the bank
    amount: float      # Always positive (credit amount)
    raw_text: str      # Full raw line for debugging


def parse_hello_bank_pdf(file_bytes: bytes) -> list[ParsedTransaction]:
    """
    Parse a Hello Bank / BNP Paribas PDF statement.
    Returns a list of credit (income) transactions found in the document.
    """
    transactions: list[ParsedTransaction] = []

    with pdfplumber.open(file_bytes) as pdf:
        for page in pdf.pages:
            # Try structured table extraction first
            tables = page.extract_tables()
            for table in tables:
                rows = _parse_table(table)
                transactions.extend(rows)

            # Fallback: parse raw text lines if no table was found
            if not tables:
                text = page.extract_text() or ''
                rows = _parse_text_lines(text)
                transactions.extend(rows)

    return transactions


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_DATE_RE = re.compile(r'^\d{2}/\d{2}/\d{4}$')
_AMOUNT_RE = re.compile(r'^[\d\s]+[,.][\d]{2}$')


def _normalize_amount(raw: str) -> Optional[float]:
    """Convert European-style amount string to float. Returns None if unparseable."""
    cleaned = raw.replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_date(raw: str) -> Optional[str]:
    """Convert DD/MM/YYYY to YYYY-MM-DD. Returns None if unparseable."""
    raw = raw.strip()
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', raw)
    if not m:
        return None
    day, month, year = m.groups()
    try:
        date(int(year), int(month), int(day))
        return f'{year}-{month}-{day}'
    except ValueError:
        return None


def _parse_table(table: list[list]) -> list[ParsedTransaction]:
    """Extract transactions from a pdfplumber table structure."""
    transactions = []
    for row in table:
        if not row:
            continue
        cells = [str(c or '').strip() for c in row]

        # Look for a date in the first cell
        iso_date = _parse_date(cells[0]) if cells else None
        if not iso_date:
            continue

        # Find the credit column (rightmost non-empty numeric cell)
        # Typical layout: [date, description, debit, credit] or [date, description, credit]
        credit_amount = None
        concept = ''
        debit_idx = -1

        for i, cell in enumerate(cells[1:], start=1):
            amount = _normalize_amount(cell)
            if amount is not None and amount > 0:
                # Heuristic: assume last numeric column is credit
                credit_amount = amount
                debit_idx = i

        if credit_amount is None:
            continue  # Debit or non-numeric row — skip

        # Description: everything between date and first numeric column
        desc_cells = [c for c in cells[1:debit_idx] if c]
        concept = ' '.join(desc_cells).strip() or 'Sin concepto'

        transactions.append(ParsedTransaction(
            date=iso_date,
            concept=concept,
            amount=credit_amount,
            raw_text=' | '.join(cells),
        ))

    return transactions


def _parse_text_lines(text: str) -> list[ParsedTransaction]:
    """
    Fallback parser for PDFs where tables aren't detected.
    Looks for lines matching: DD/MM/YYYY ... amount
    """
    transactions = []
    lines = text.splitlines()

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Must start with a date
        date_match = re.match(r'^(\d{2}/\d{2}/\d{4})\s+(.*)', line)
        if not date_match:
            continue

        iso_date = _parse_date(date_match.group(1))
        if not iso_date:
            continue

        rest = date_match.group(2).strip()

        # Find all amounts at the end of the line
        # Hello Bank format: "... 150,00" or "... 1 234,56"
        amounts = re.findall(r'[\d\s]+[,.][\d]{2}', rest)
        if not amounts:
            continue

        # Take the last amount as credit (rightmost column)
        credit_raw = amounts[-1]
        amount = _normalize_amount(credit_raw)
        if not amount or amount <= 0:
            continue

        # Remove all amounts from end to get concept
        concept = rest
        for a in amounts:
            concept = concept.replace(a, '').strip()
        concept = re.sub(r'\s+', ' ', concept).strip() or 'Sin concepto'

        transactions.append(ParsedTransaction(
            date=iso_date,
            concept=concept,
            amount=amount,
            raw_text=line,
        ))

    return transactions
