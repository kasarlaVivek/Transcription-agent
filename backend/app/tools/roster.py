"""
Roster file parsing — reads attendee lists from uploaded CSV or Excel files.
"""

import csv
import io

import openpyxl

MAX_ROSTER_ROWS = 200

# Accept a few common header spellings per field.
_HEADER_ALIASES = {
    "name": {"name", "full name", "attendee", "attendee name"},
    "email": {"email", "e-mail", "email address"},
    "role": {"role", "title", "job title", "position"},
}


def _match_header(header: str) -> str | None:
    """Map a raw column header to one of name/email/role, if recognised."""
    normalized = header.strip().lower()
    for field, aliases in _HEADER_ALIASES.items():
        if normalized in aliases:
            return field
    return None


def _rows_to_roster(header_row: list[str], data_rows) -> list[dict]:
    """Map a header row + data rows to a list of {name, email, role} dicts."""
    column_map: dict[int, str] = {}
    for i, header in enumerate(header_row):
        field = _match_header(str(header or ""))
        if field:
            column_map[i] = field

    roster: list[dict] = []
    for row in data_rows:
        entry = {"name": "", "email": "", "role": ""}
        for i, value in enumerate(row):
            field = column_map.get(i)
            if field:
                entry[field] = str(value).strip() if value is not None else ""
        if entry["name"] and entry["email"]:
            roster.append(entry)
        if len(roster) >= MAX_ROSTER_ROWS:
            break
    return roster


def parse_roster_csv(contents: bytes) -> list[dict]:
    """Parse a CSV file's bytes into a roster list."""
    text = contents.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []
    return _rows_to_roster(rows[0], rows[1:])


def parse_roster_excel(contents: bytes) -> list[dict]:
    """Parse an .xlsx file's bytes into a roster list (first sheet only)."""
    workbook = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    sheet = workbook.worksheets[0]
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    return _rows_to_roster(list(rows[0]), rows[1:])
