import math
import pytest

from backend.core.wpt_model import (
    battery_status,
    coupling_for_airgap,
    mutual_inductance,
    resonance_capacitance,
    solve_series_series,
)


def base_params():
    return {
        "l1": 200e-6, "l2": 200e-6, "r1": 0.15, "r2": 0.15,
        "c1": resonance_capacitance(200e-6, 85000),
        "c2": resonance_capacitance(200e-6, 85000),
        "frequency": 85000, "load": 10, "k": 0.25, "v1": 400,
        "ac_dc_efficiency": 0.95, "rectifier_efficiency": 0.96,
        "dc_dc_efficiency": 0.94,
    }


def test_resonance():
    c = resonance_capacitance(200e-6, 85000)
    assert c > 0
    assert abs(1 / (2 * math.pi * math.sqrt(200e-6 * c)) - 85000) < 1


def test_mutual_inductance():
    assert abs(mutual_inductance(200e-6, 200e-6, 0.25) - 50e-6) < 1e-12


def test_series_series_power_balance():
    result = solve_series_series(base_params())
    assert result["pin_ac"] > 0
    assert result["battery_power"] > 0
    assert 0 <= result["total_efficiency"] <= 100


def test_coupling_is_bounded():
    assert 0 <= coupling_for_airgap(0.05) <= 1
    assert coupling_for_airgap(0.20) < coupling_for_airgap(0.05)


def test_battery_soc_and_cutoff():
    result = battery_status(54, 75, 5000, 400, 460, 125, 1)
    assert result["soc"] == pytest.approx(54 + (12.5 / 75 * 100))
    assert result["estimated_hours"] > 0
    cutoff = battery_status(99.9, 75, 5000, 400, 460, 125, 1)
    assert cutoff["soc"] == 100
    assert cutoff["charging_current"] == 0
    assert battery_status(54, 75, 0, 400, 460, 125, 1)["estimated_hours"] is None

