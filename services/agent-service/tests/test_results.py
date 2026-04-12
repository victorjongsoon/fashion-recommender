"""Unit test for results.build_results — verifies frontend-consumed shape."""
import os
import sys

# Allow running with `python -m pytest` from the service root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.slots import SlotState
from app.results import build_results, REQUIRED_EXTRACTED_KEYS, REQUIRED_KG_INPUT_KEYS


def test_build_results_golden_shape(monkeypatch):
    # Force the weather HTTP call to fail so we exercise the fallback path
    # without requiring the weather-service to be running.
    monkeypatch.setenv("WEATHER_SERVICE_URL", "http://127.0.0.1:1")

    s = SlotState()
    s.occasion.mark_filled("Casual")
    s.destination.mark_filled("Tokyo")
    s.month.mark_filled("June")
    s.gender.mark_filled("male")
    s.num_outfits.mark_filled(3)
    s.max_price.mark_filled(200.0)
    s.preferred_colors.mark_filled(["Black", "Blue"])
    s.avoid_colors.mark_filled([])

    # need to re-import results AFTER env is set? results reads env at function
    # time, so passing env via monkeypatch.setenv is fine.
    from app.results import build_results as bres
    r = bres(s)

    assert REQUIRED_EXTRACTED_KEYS.issubset(r["extracted"].keys())
    assert r["kg_inputs"], "kg_inputs should not be empty"
    for item in r["kg_inputs"]:
        assert REQUIRED_KG_INPUT_KEYS.issubset(item.keys())
        assert item["category"] in ("Menswear", "Ladieswear")
        assert 1 <= item["num_outfits"] <= 5
