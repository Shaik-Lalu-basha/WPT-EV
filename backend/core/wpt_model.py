import cmath
import math


def validate_positive(name, value):
    value = float(value)
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be a positive finite number")
    return value


def coupling_for_airgap(distance_m, lateral_m=0.0, angle_deg=0.0, k_ref=0.25, reference_gap_m=0.10):
    distance_m = validate_positive("distance", distance_m)
    lateral_m = max(0.0, float(lateral_m))
    angle_deg = max(0.0, float(angle_deg))
    k_ref = validate_positive("k_ref", k_ref)
    if k_ref > 1:
        raise ValueError("k_ref must be between 0 and 1")

    distance_factor = reference_gap_m / (distance_m + reference_gap_m)
    lateral_factor = math.exp(-((lateral_m / max(reference_gap_m, 0.01)) ** 2))
    angle_factor = max(0.0, math.cos(math.radians(min(angle_deg, 90))))
    return max(0.0, min(1.0, k_ref * distance_factor * lateral_factor * angle_factor))


def mutual_inductance(l1_h, l2_h, k):
    l1_h = validate_positive("L1", l1_h)
    l2_h = validate_positive("L2", l2_h)
    k = float(k)
    if not math.isfinite(k) or k < 0 or k > 1:
        raise ValueError("coupling coefficient must be between 0 and 1")
    return k * math.sqrt(l1_h * l2_h)


def resonance_capacitance(inductance_h, frequency_hz):
    inductance_h = validate_positive("inductance", inductance_h)
    frequency_hz = validate_positive("frequency", frequency_hz)
    capacitance = 1 / ((2 * math.pi * frequency_hz) ** 2 * inductance_h)
    return capacitance


def resonance_frequency(inductance_h, capacitance_f):
    return 1 / (2 * math.pi * math.sqrt(validate_positive("inductance", inductance_h) * validate_positive("capacitance", capacitance_f)))


def solve_series_series(params):
    l1 = validate_positive("L1", params["l1"])
    l2 = validate_positive("L2", params["l2"])
    r1 = validate_positive("R1", params["r1"])
    r2 = validate_positive("R2", params["r2"])
    c1 = validate_positive("C1", params["c1"])
    c2 = validate_positive("C2", params["c2"])
    frequency = validate_positive("frequency", params["frequency"])
    rl = validate_positive("load resistance", params["load"])
    k = float(params["k"])
    if not math.isfinite(k) or k < 0 or k > 1:
        raise ValueError("coupling coefficient must be between 0 and 1")

    omega = 2 * math.pi * frequency
    m = mutual_inductance(l1, l2, k)
    z1 = complex(r1, omega * l1) + 1 / complex(0, omega * c1)
    z2 = complex(r2 + rl, omega * l2) + 1 / complex(0, omega * c2)
    jm = complex(0, omega * m)
    determinant = z1 * z2 + omega * omega * m * m
    v1 = complex(float(params["v1"]), 0)
    i1 = (v1 * z2) / determinant
    i2 = (-jm * v1) / determinant

    pin_ac = (v1 * i1.conjugate()).real
    p_secondary = abs(i2) ** 2 * rl
    p_coil_loss = abs(i1) ** 2 * r1 + abs(i2) ** 2 * r2
    if pin_ac <= 0:
        raise ValueError("calculated input power is not positive")
    coil_efficiency = 100 * p_secondary / pin_ac

    ac_to_dc_eff = float(params.get("ac_dc_efficiency", 0.95))
    dc_dc_eff = float(params.get("dc_dc_efficiency", 0.94))
    rectifier_eff = float(params.get("rectifier_efficiency", 0.96))
    efficiencies = [ac_to_dc_eff, rectifier_eff, dc_dc_eff]
    if any(e <= 0 or e > 1 for e in efficiencies):
        raise ValueError("converter efficiencies must be in the range (0, 1]")

    input_dc = pin_ac * ac_to_dc_eff
    secondary_dc = p_secondary * rectifier_eff
    battery_power = secondary_dc * dc_dc_eff
    converter_loss = pin_ac - battery_power
    total_efficiency = 100 * battery_power / pin_ac

    return {
        "frequency_hz": frequency,
        "omega": omega,
        "m_h": m,
        "i1_rms": abs(i1),
        "i2_rms": abs(i2),
        "v1_rms": abs(v1),
        "v2_rms": abs(i2 * rl),
        "pin_ac": pin_ac,
        "p_secondary": p_secondary,
        "p_coil_loss": p_coil_loss,
        "coil_efficiency": coil_efficiency,
        "input_dc": input_dc,
        "secondary_dc": secondary_dc,
        "battery_power": battery_power,
        "converter_loss": converter_loss,
        "total_efficiency": total_efficiency,
        "coupling": k,
        "fr_primary_hz": resonance_frequency(l1, c1),
        "fr_secondary_hz": resonance_frequency(l2, c2),
    }


def battery_status(soc, capacity_ah, charging_power_w, nominal_voltage, max_voltage, max_current, delta_hours=1.0):
    soc = float(soc)
    capacity_ah = validate_positive("battery capacity", capacity_ah)
    nominal_voltage = validate_positive("nominal battery voltage", nominal_voltage)
    max_voltage = validate_positive("maximum battery voltage", max_voltage)
    max_current = validate_positive("maximum charging current", max_current)
    charging_power_w = max(0.0, float(charging_power_w))

    target_current = charging_power_w / nominal_voltage
    charging_current = min(target_current, max_current)
    charging_voltage = nominal_voltage * (1 + 0.12 * soc / 100)
    charging_voltage = min(charging_voltage, max_voltage)
    if soc >= 99.5:
        new_soc = 100.0
        charging_current = 0.0
        cutoff = True
    else:
        soc_increment = charging_current * delta_hours / capacity_ah * 100
        new_soc = min(100.0, max(0.0, soc + soc_increment))
        cutoff = new_soc >= 99.5
        if cutoff:
            new_soc = 100.0
            charging_current = 0.0

    return {
        "soc": new_soc,
        "charging_current": charging_current,
        "charging_voltage": charging_voltage,
        "charging_power": charging_current * charging_voltage,
        "charging_status": "Charging complete" if cutoff else "Charging",
        "estimated_hours": (
            max(0.0, ((100 - new_soc) / 100) * capacity_ah / charging_current)
            if charging_current > 0 else None
        ),
    }
