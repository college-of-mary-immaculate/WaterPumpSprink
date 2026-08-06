# FPC-7700 — Fire Pump Fuzzy Controller HMI

A browser-based HMI dashboard that uses **fuzzy logic** to govern a commercial
fire-pump motor (tank level → pump speed) and sprinkler valves (smoke + heat →
valve opening), consuming a **JSON mock API** through the **Fetch API**, with a
fully **component-based UI** that re-renders dynamically every tick.

## Quick start

```bash
npm install
npm start
```

This runs two things concurrently:
- `json-server` on `http://localhost:3001` — the JSON mock API (backed by `db.json`)
- a static file server on `http://localhost:8080` — the dashboard itself

Open **http://localhost:8080** in a browser.

> If you just open `public/index.html` directly as a `file://` URL (no server),
> the app detects that the mock API is unreachable and automatically switches
> to `js/api/localFallback.js`, an in-memory stand-in with the exact same
> GET/PATCH/POST interface. Same fuzzy logic, same rendering, no setup needed
> for a quick look — but for the actual assignment deliverable, run it via
> `npm start` so the real Fetch calls hit the real JSON mock API.

## Directory structure

```
fire-pump-fuzzy-hmi/
├── package.json          # scripts: mock-api (json-server), web (static server), start (both)
├── db.json               # JSON mock API database (system, sensors, pump, sprinklers, eventLog)
├── README.md
└── public/
    ├── index.html
    ├── css/
    │   └── style.css     # industrial HMI panel theme
    └── js/
        ├── app.js             # orchestrator: simulation tick, wiring, render loop
        ├── api/
        │   ├── mockApi.js         # Fetch API client for json-server
        │   └── localFallback.js   # in-memory fallback, same interface
        ├── fuzzy/
        │   ├── fuzzyCore.js           # membership functions + Mamdani/centroid engine
        │   ├── pumpController.js      # controller 1: tank-level error -> pump speed
        │   └── sprinklerController.js # controller 2: smoke + heat -> valve opening
        └── components/
            ├── FirePanel.js       # smoke/heat gauges + membership lights
            ├── PlantPanel.js      # tank, pressure gauge, motor
            ├── SprinklerZones.js  # zone cards + mist animation
            └── EventLog.js        # scrolling decision log
```

## How this maps to the four criteria

**1. Component-based UI design** — `FirePanel`, `PlantPanel`, `SprinklerZones`,
and `EventLog` are self-contained classes: each owns a DOM subtree, exposes a
`render(data)` method, and never reaches into another component's markup.
`app.js` only orchestrates data flow between them.

**2. JSON Mock API** — `db.json` served by `json-server` exposes five
resources (`/system`, `/sensors`, `/pump`, `/sprinklers`, `/eventLog`) that
model a real fire-pump controller's points list.

**3. Fetch API Implementation** — `js/api/mockApi.js` is the only file that
calls `fetch()`. It wraps GET (read sensor/plant state), PATCH (write pump
speed, valve position, sensor drift), and POST (append log entries) — mirroring
how a real HMI polls and writes to a PLC/BMS gateway.

**4. Dynamic Rendering of Data** — nothing in the DOM is static after load.
Every ~1.1s tick: sensors drift → both fuzzy controllers re-infer → the tank
liquid height, gauge needle sweep, motor rotor spin, valve mist, and the
rule-trace / event-log text all repaint from the new values.

## The fuzzy logic, briefly

**Controller 1 — Pump speed** (`pumpController.js`)
Input: `levelError = targetLevel − currentTankLevel` (−100…100%).
5 triangular/trapezoidal sets (NB, NS, ZE, PS, PB) map to 5 output sets
(OFF, LOW, MED, HIGH, MAX) via 5 rules, Mamdani-inferred and centroid-defuzzified.
This is why the pump doesn't bang on/off like a simple thermostat: it eases
off as the tank nears its setpoint and drives hard when far below it —
closer to how a real jockey/fire-pump controller behaves.

**Controller 2 — Sprinkler valve opening** (`sprinklerController.js`)
Inputs: `smoke` and `heat` (0…100, each LOW/MED/HIGH). 9 rules (one per
combination) infer a valve opening 0…100%, again via Mamdani + centroid.
Heat is weighted slightly ahead of smoke (HIGH heat alone reaches FULL;
HIGH smoke alone only reaches OPEN unless heat corroborates it) since a
real fire tends to register on heat before smoke fully saturates a space.

Both controllers' active/dominant rule is shown live in the "rule trace"
box under each panel, and logged to the event ticker whenever the output
band changes — so the fuzzy reasoning is visible, not just its result.

## Simulating a fire

Use **SIMULATE FIRE EVENT** in the left panel to ramp smoke/heat up over a
few ticks (watch the valve controller cross PARTIAL → OPEN → FULL, the tank
level dip as the sprinklers draw water, and the pump ramp up to compensate).
**CLEAR / RESET** decays it back to standby ambient noise.
