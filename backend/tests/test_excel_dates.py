from datetime import date

from utils.excel_dates import iso_ymd_to_dd_mm_yyyy, parse_calendar_date_to_iso


def test_iso_to_dd_mm_yyyy():
    assert iso_ymd_to_dd_mm_yyyy("2026-04-01") == "01/04/2026"
    assert iso_ymd_to_dd_mm_yyyy("2026-03-31") == "31/03/2026"


def test_parse_dd_mm_yyyy_slash():
    iso, err = parse_calendar_date_to_iso("01/04/2025", "start date")
    assert err is None
    assert iso == "2025-04-01"


def test_parse_dd_mm_yyyy_dash():
    iso, err = parse_calendar_date_to_iso("31-03-2026", "end date")
    assert err is None
    assert iso == "2026-03-31"


def test_parse_iso_still_works():
    iso, err = parse_calendar_date_to_iso("2025-04-01", "start date")
    assert err is None
    assert iso == "2025-04-01"


def test_parse_date_object():
    iso, err = parse_calendar_date_to_iso(date(2026, 1, 15), "start date")
    assert err is None
    assert iso == "2026-01-15"


def test_invalid_date():
    iso, err = parse_calendar_date_to_iso("32/13/2026", "start date")
    assert iso is None
    assert err and "DD/MM/YYYY" in err
