import csv
import io
import json
import os
import sqlite3
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import safe_join

if __package__:
    from .core.wpt_model import (
        battery_status,
        coupling_for_airgap,
        mutual_inductance,
        resonance_capacitance,
        solve_series_series,
    )
else:
    from core.wpt_model import (
        battery_status,
        coupling_for_airgap,
        mutual_inductance,
        resonance_capacitance,
        solve_series_series,
    )

app = Flask(__name__, static_folder=None)
CORS(app)

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(__file__), "wpt_ev_lab.sqlite"),
)


def get_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS simulation_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS simulation_parameters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            parameters TEXT,
            FOREIGN KEY(session_id) REFERENCES simulation_sessions(id)
        );
        CREATE TABLE IF NOT EXISTS simulation_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            experiment_type TEXT,
            results TEXT,
            FOREIGN KEY(session_id) REFERENCES simulation_sessions(id)
        );
        CREATE TABLE IF NOT EXISTS battery_configurations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            configuration TEXT,
            FOREIGN KEY(session_id) REFERENCES simulation_sessions(id)
        );
        CREATE TABLE IF NOT EXISTS scenario_comparisons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            scenario_name TEXT,
            results TEXT,
            FOREIGN KEY(session_id) REFERENCES simulation_sessions(id)
        );
        """)


init_db()


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def frontend_index():
    if not os.path.isfile(os.path.join(FRONTEND_DIST, "index.html")):
        return jsonify({"error": "Frontend build not found"}), 404
    return send_from_directory(FRONTEND_DIST, "index.html")


@app.get("/<path:path>")
def frontend_assets(path):
    if path == "api" or path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404

    safe_path = safe_join(FRONTEND_DIST, path)
    if safe_path and os.path.isfile(safe_path):
        return send_from_directory(FRONTEND_DIST, path)
    if os.path.isfile(os.path.join(FRONTEND_DIST, "index.html")):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(ValueError)
def handle_validation(error):
    return jsonify({"error": str(error)}), 400


def default_params(data):
    return {
        "l1": float(data.get("l1", 200e-6)),
        "l2": float(data.get("l2", 200e-6)),
        "r1": float(data.get("r1", 0.15)),
        "r2": float(data.get("r2", 0.15)),
        "c1": float(data.get("c1", 17.5e-9)),
        "c2": float(data.get("c2", 17.5e-9)),
        "frequency": float(data.get("frequency", 85000)),
        "load": float(data.get("load", 10)),
        "k": float(data.get("k", 0.25)),
        "v1": float(data.get("v1", 400)),
        "ac_dc_efficiency": float(data.get("ac_dc_efficiency", 0.95)),
        "rectifier_efficiency": float(data.get("rectifier_efficiency", 0.96)),
        "dc_dc_efficiency": float(data.get("dc_dc_efficiency", 0.94)),
    }


@app.post("/api/simulate")
def simulate():
    data = request.get_json(silent=True) or {}
    params = default_params(data)
    result = solve_series_series(params)
    with get_db() as db:
        cursor = db.execute("INSERT INTO simulation_sessions DEFAULT VALUES")
        session_id = cursor.lastrowid
        import json
        db.execute("INSERT INTO simulation_parameters(session_id, parameters) VALUES (?, ?)",
                   (session_id, json.dumps(params)))
        db.execute("INSERT INTO simulation_results(session_id, experiment_type, results) VALUES (?, ?, ?)",
                   (session_id, "series_series", json.dumps(result)))
    result["session_id"] = session_id
    return jsonify(result)


@app.post("/api/resonance")
def resonance():
    data = request.get_json(silent=True) or {}
    l1 = float(data.get("l1", 200e-6))
    l2 = float(data.get("l2", 200e-6))
    frequency = float(data.get("frequency", 85000))
    return jsonify({
        "c1": resonance_capacitance(l1, frequency),
        "c2": resonance_capacitance(l2, frequency),
        "frequency": frequency,
    })


@app.post("/api/coupling")
def coupling():
    data = request.get_json(silent=True) or {}
    k_ref = float(data.get("k_ref", 0.25))
    gap = float(data.get("distance", 0.10))
    lateral = float(data.get("lateral", 0))
    angle = float(data.get("angle", 0))
    k = coupling_for_airgap(gap, lateral, angle, k_ref)
    l1 = float(data.get("l1", 200e-6))
    l2 = float(data.get("l2", 200e-6))
    return jsonify({"k": k, "m_h": mutual_inductance(l1, l2, k)})


@app.post("/api/battery")
def battery():
    data = request.get_json(silent=True) or {}
    result = battery_status(
        soc=data.get("soc", 54),
        capacity_ah=float(data.get("capacity_ah", 75)),
        charging_power_w=float(data.get("charging_power", data.get("battery_power", 5000))),
        nominal_voltage=float(data.get("nominal_voltage", 400)),
        max_voltage=float(data.get("max_voltage", 460)),
        max_current=float(data.get("max_current", 125)),
        delta_hours=float(data.get("delta_hours", 1)),
    )
    return jsonify(result)


@app.post("/api/experiments/frequency")
def frequency_experiment():
    data = request.get_json(silent=True) or {}
    params = default_params(data)
    start = float(data.get("start", 60000))
    end = float(data.get("end", 110000))
    points = int(data.get("points", 51))
    values = []
    for i in range(points):
        frequency = start + (end - start) * i / max(points - 1, 1)
        experiment = dict(params)
        experiment["frequency"] = frequency
        result = solve_series_series(experiment)
        values.append({
            "frequency_khz": frequency / 1000,
            "efficiency": result["total_efficiency"],
            "battery_power": result["battery_power"],
        })
    return jsonify({"points": values})


@app.post("/api/experiments/airgap")
def airgap_experiment():
    data = request.get_json(silent=True) or {}
    params = default_params(data)
    start = float(data.get("start", 0.05))
    end = float(data.get("end", 0.20))
    points = int(data.get("points", 16))
    values = []
    for i in range(points):
        distance = start + (end - start) * i / max(points - 1, 1)
        k = coupling_for_airgap(distance, float(data.get("lateral", 0)), float(data.get("angle", 0)), params["k"])
        experiment = dict(params)
        experiment["k"] = k
        result = solve_series_series(experiment)
        values.append({
            "distance_cm": distance * 100,
            "coupling": k,
            "efficiency": result["total_efficiency"],
            "battery_power": result["battery_power"],
        })
    return jsonify({"points": values})


@app.route("/api/scenarios", methods=["GET", "POST", "DELETE"])
def scenarios():
    if request.method == "GET":
        with get_db() as db:
            rows = db.execute(
                "SELECT id, scenario_name, results FROM scenario_comparisons ORDER BY id DESC"
            ).fetchall()
        return jsonify([
            {"id": row["id"], "name": row["scenario_name"], "result": json.loads(row["results"])}
            for row in rows
        ])

    data = request.get_json(silent=True) or {}
    if request.method == "DELETE":
        scenario_id = int(data.get("id", 0))
        with get_db() as db:
            db.execute("DELETE FROM scenario_comparisons WHERE id = ?", (scenario_id,))
        return jsonify({"deleted": scenario_id})

    name = str(data.get("name", "")).strip()
    if not name or len(name) > 80:
        return jsonify({"error": "Scenario name must contain 1 to 80 characters"}), 400
    params = default_params(data.get("parameters", {}))
    result = solve_series_series(params)
    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO scenario_comparisons(scenario_name, results) VALUES (?, ?)",
            (name, json.dumps({
                "parameters": params,
                "distance": float(data.get("distance", 0.10)),
                "lateral": float(data.get("lateral", 0)),
                "angle": float(data.get("angle", 0)),
                **result,
            })),
        )
    return jsonify({"id": cursor.lastrowid, "name": name, "result": result}), 201


@app.get("/api/export/csv")
def export_csv():
    data = request.args
    distance = float(data.get("distance", 0.10))
    k = float(data.get("k", coupling_for_airgap(distance)))
    params = default_params(dict(data))
    params["k"] = k
    result = solve_series_series(params)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Parameter", "Value", "Unit"])
    for key, value in result.items():
        writer.writerow([key, value, ""])
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name="wpt_simulation.csv",
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
