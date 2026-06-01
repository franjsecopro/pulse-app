"""Parser for Hello Bank / BNP Paribas account statements exported as CSV.

The export is a French-locale, semicolon-delimited file:
  Date;Date de valeur;Débit;Crédit;Libellé

A row is income when its ``Crédit`` column is non-empty (``Débit`` rows are
expenses and are skipped). Columns are read by NAME, so a reordered export
keeps working — no positional guessing like the PDF parser needed.
"""
import csv
import io
import unicodedata

from app.services.statement_parser import (
    ParsedTransaction,
    normalize_amount,
    parse_date,
)

# Banks export French statements in Windows-1252 / Latin-1, not UTF-8.
# Try UTF-8 first (future-proof for banks that modernise), then fall back.
_DECODE_ORDER = ('utf-8-sig', 'cp1252')

_DELIMITER = ';'


def _decode(file_bytes: bytes) -> str:
    for encoding in _DECODE_ORDER:
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    # Last resort: never raise on a malformed byte, just flag it.
    return file_bytes.decode('cp1252', errors='replace')


def _normalize_header(header: str) -> str:
    """Strip accents and case so 'Crédit' matches 'credit' robustly."""
    decomposed = unicodedata.normalize('NFKD', header)
    without_accents = ''.join(c for c in decomposed if not unicodedata.combining(c))
    return without_accents.strip().lower()


def parse_csv(file_bytes: bytes) -> list[ParsedTransaction]:
    """Parse a CSV bank statement, returning only credit (income) rows."""
    text = _decode(file_bytes)
    if not text.strip():
        return []

    reader = csv.DictReader(io.StringIO(text), delimiter=_DELIMITER)
    if not reader.fieldnames:
        return []

    columns = {_normalize_header(name): name for name in reader.fieldnames}
    date_key = columns.get('date')
    credit_key = columns.get('credit')
    concept_key = columns.get('libelle')

    if not date_key or not credit_key:
        return []  # Not a statement we recognise.

    transactions: list[ParsedTransaction] = []
    for row in reader:
        credit_raw = (row.get(credit_key) or '').strip()
        if not credit_raw:
            continue  # Débit row (expense) — not an income.

        amount = normalize_amount(credit_raw)
        if amount is None or amount <= 0:
            continue

        iso_date = parse_date((row.get(date_key) or '').strip())
        if not iso_date:
            continue

        concept = (row.get(concept_key) or '').strip() if concept_key else ''

        transactions.append(ParsedTransaction(
            date=iso_date,
            concept=concept or 'Sin concepto',
            amount=amount,
            raw_text=_DELIMITER.join(str(v) for v in row.values()),
        ))

    return transactions
