# WPT EV LAB

A local, software-only inductive wireless power transfer laboratory for electric vehicle charging.

## Requirements

- Windows 10/11
- Python 3.10+
- Node.js 20+

## Install

```powershell
npm install
python -m pip install -r backend/requirements.txt
```

## Run

Start the simulation API:

```powershell
npm run backend
```

Start the web interface in a second terminal:

```powershell
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Test

```powershell
python -m pytest backend/tests -q
npm run build
npm run lint
```

## Deploy to Render

This project is configured as a single free Docker web service: Flask serves both
the built Vite frontend and the `/api` endpoints.

1. Push the project to a GitHub repository.
2. In Render, choose **New** → **Blueprint** and connect that repository.
3. Render detects `render.yaml`. Review the `wpt-ev-lab` web service and create it.
   The blueprint configures the service to use Render's free instance.
4. Wait for the first Docker build and deploy to finish, then open the service URL.
   Render checks `/api/health` to verify the service is ready.

The API and frontend are served from the same URL, so no separate frontend URL,
CORS allowlist, or API URL configuration is needed. The free instance may spin
down after inactivity and its filesystem is ephemeral. SQLite saved scenarios
can be lost after a restart or redeploy; use a paid instance with persistent
storage or an external database if the data must be retained.

## Interface controls

The sidebar opens dedicated Overview, 3D Charging Lab, Coil Configuration,
Coupling Analysis, Resonance, Power Electronics, Battery System, Performance,
and Settings workspaces. In the 3D lab, the view tabs set camera presets; Start/Pause,
Magnetic field, Exploded view, and Reset position control the scene. The engineering
modules provide editable coil and converter parameters, an air-gap sweep, resonance
calculation, one-hour battery charging steps, local SQLite scenario save/delete and
CSV export.

## Engineering model

The backend uses a series-series coupled-coil phasor model. Mutual inductance is
`M = k * sqrt(L1 * L2)`. Primary and secondary currents are solved from:

- `V1 = Z1 I1 + jwM I2`
- `0 = jwM I1 + Z2 I2`

The UI sends coil position and electrical parameters to the Flask API. The API performs
the calculations and stores simulation sessions and saved scenarios in SQLite. Battery
charging advances only when the user requests a simulated time step. Magnetic field
lines are illustrative visualizations, not a solved 3D electromagnetic field.
