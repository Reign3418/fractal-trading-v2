# Fractal Trading Engine v2 — Ground-Up Rebuild Plan

> **Status**: Architecture Complete | **Current Date**: 2026-05-19 | **Go-Live Target**: 6-8 weeks from start
> **Mandate**: Burn the ships. New repo. New architecture. No legacy.

---

## Why Rebuild (Documented Decision)

| Lesson from v1 | How v2 Fixes It |
|---------------|-----------------|
| Flat peer writes to DynamoDB — no commit authority | Core Lake — sole state committer |
| Fast lane (CIPHER 5m) / slow lane (Tank 3h) mismatch | Terrain-based routing — Ripples flow by elevation, not schedule |
| DOGE ghost x115 — no feedback loop | Feedback Ripples: Lake overflows → River channels → Cities correct |
| "Cleaning lady" patches for each anomaly | Analysis Ocean — 5-detector swarm, catches everything |
| Agents are monoliths (Tank does strategy + scheduling) | Fractal cells — each node does one thing, splits when complex |
| No state invalidation mechanism | Watershed logic — invalidations flow downhill naturally |
| Analysis Ring was an afterthought | Ocean is terrain, not a module — built in from day one |

---

## Architecture: One Planet, 11 Nodes

```
Trading Planet v2
├── Terrain: Planetary — coordinates all trading
├── Basin: Risk State, Topology Registry, Human Dashboard
├── Boundaries: Max 10 strategies, $X position, 80% saturation pause
│
├── COAST NODES (External Boundary)
│   ├── market-data-coast    — Price feeds, order book ingress
│   └── exchange-coast       — Trade execution egress
│
├── RIVER NODES (Routing)
│   └── trading-river        — Scent-based routing, watershed logic
│
├── CITY NODES (Dense Processing)
│   ├── strategy-city-btc    — BTC scalping (your Tank, reborn)
│   ├── strategy-city-eth    — ETH swing (ready for expansion)
│   └── execution-city       — Order execution (your NULL, reborn)
│
├── FOREST NODES (Filtering)
│   └── validation-forest    — CIPHER reborn: validates, liquidates, filters
│
├── LAKE NODES (State)
│   └── state-lake           — Dozer reborn: ground truth, atomic commits
│
└── OCEAN NODES (Monitoring)
    └── analysis-ocean       — 5-detector swarm, always watching
```

Every node uses the **same 6-section template** from `00-fractal-node-template.md`.
Every node is a **fractal** — it can contain sub-nodes when it grows.
Every Ripple interacts with **terrain** — Ocean absorbs 80%, River channels 90%, Lake pools until overflow.

---

## Build Order: Phase by Phase

### Phase 1: The Lake + The Coast (Week 1)
**Goal**: State committer + exchange connectivity. The foundation everything else stands on.

| Node | File | Lines | Terrain | What It Does |
|------|------|-------|---------|-------------|
| state-lake | `state-lake.js` | ~80 | Lake | Reads exchange positions (Dozer's job), writes to canonical state table, commits atomically, handles invalidations |
| market-data-coast | `market-data-coast.js` | ~60 | Coast | Connects to exchange WebSocket/REST for price feeds, transforms external data into internal Ripples |
| exchange-coast | `exchange-coast.js` | ~60 | Coast | Transforms internal Ripples into exchange API calls, handles auth, rate limiting, retries |

**Deliverable**: You can read positions from the exchange and commit them to canonical state. No trading yet. Just truth.

**Validation**: Run for 48 hours. Compare Lake state to exchange every 5 minutes. Zero mismatches = pass.

---

### Phase 2: The Cities + The River (Week 2)
**Goal**: Strategy + execution + routing. The engine that actually trades.

| Node | File | Lines | Terrain | What It Does |
|------|------|-------|---------|-------------|
| strategy-city-btc | `strategy-city-btc.js` | ~120 | City | Reads market Ripples from Coast, runs strategy logic (your Tank's brain), emits SIGNAL Ripples to River |
| execution-city | `execution-city.js` | ~100 | City | Reads ORDER Ripples from River, executes via exchange-coast, reports FILL/REJECTED back to Lake |
| trading-river | `trading-river.js` | ~80 | River | Reads scent from Ripples, routes SIGNAL → execution-city, routes FILL → state-lake, handles overflow |

**Deliverable**: End-to-end trade: market data → strategy signal → routed to execution → order placed → fill reported → state committed.

**Validation**: Paper trade for 1 week. Compare fills to exchange records. All fills accounted for = pass.

---

### Phase 3: The Forest (Week 3)
**Goal**: Validation, liquidation, filtering. The immune system.

| Node | File | Lines | Terrain | What It Does |
|------|------|-------|---------|-------------|
| validation-forest | `validation-forest.js` | ~100 | Forest | Monitors all Ripples, validates against rules, triggers Protocol 1 liquidation, filters bad signals, emits feedback to Lake |

**Deliverable**: Forest catches bad signals before they reach execution. Forest liquidates positions when stop-loss hits. Forest emits invalidation Ripples to Lake.

**Validation**: Simulate 5 bad signals. Forest catches all 5. Simulate stop-loss condition. Forest liquidates within 1 cycle (5 minutes).

**This is where the DOGE ghost dies.** Forest detects liquidation → emits invalidation Ripple → Lake commits → River channels to strategy-city → strategy respects invalidation. Ghost lifetime: 5 minutes, not 3 hours.

---

### Phase 4: The Ocean (Week 4)
**Goal**: Monitoring, anomaly detection, human alerting. The watchtower.

| Node | File | Lines | Terrain | What It Does |
|------|------|-------|---------|-------------|
| analysis-ocean | `analysis-ocean.js` | ~150 | Ocean | 5-detector swarm, absorbs 80% of all Ripples for monitoring, never blocks, emits alerts to Planet |

**Detectors**:
1. **Ghost Mission Detector** — MISSION ACCOMPLISHED x3 + empty positions → GHOST alert
2. **Cross-Agent State Validator** — strategy says open, Lake says closed → MISMATCH alert
3. **Stale Directive Detector** — signal >10min old, no fill/reject → STALE alert
4. **Lane Monitor** — River queue building up, nodes silent → BOTTLENECK alert
5. **Mission Lifecycle Auditor** — SIGNAL born but no FILL/REJECT/EXPIRE → ORPHAN alert

**Deliverable**: Dashboard shows all 5 detectors. Alerts fire correctly. No false positives after 1 week.

**Validation**: Inject a ghost manually. Ocean detects it within 15 minutes. Inject a state mismatch. Ocean flags it within 1 cycle.

---

### Phase 5: The Planet + Human Interface (Week 5)
**Goal**: Orchestration, risk management, human dashboard. The cockpit.

| Node | File | Lines | Terrain | What It Does |
|------|------|-------|---------|-------------|
| trading-planet | `trading-planet.js` | ~100 | Planetary | Orchestrates all children, manages risk limits, handles human commands, routes overflow alerts |

**Dashboard**: Read-only view of Lake (positions), Ocean (alerts), River (throughput), Cities (strategies). Risk gauge. Kill switch.

**Deliverable**: Human can see the entire system. Human can pause trading. Human sees alerts with severity.

**Validation**: Human triggers pause. All trading stops within 1 cycle. Human triggers resume. Trading resumes. Risk limit breached → system auto-pauses.

---

### Phase 6: Harden + Paper Trade (Weeks 6-8)
**Goal**: Prove it works before live capital touches it.

- Paper trade for 2-4 weeks
- Compare every fill to exchange records
- Run Ocean detectors, zero false positives
- Simulate edge cases: exchange API down, WebSocket disconnect, invalid market data, stop-loss cascade
- Load test: 10 strategies, 3 assets, full throughput

**Go-Live Criteria**:
- [ ] 2 weeks of paper trading, zero unaccounted fills
- [ ] All 5 Ocean detectors firing correctly, zero false positives
- [ ] DOGE ghost simulation: ghost dies within 5 minutes
- [ ] Exchange API failure: system pauses gracefully, resumes when API returns
- [ ] Human pause/resume: works every time, <1 cycle latency
- [ ] Risk limit breach: auto-pause, human alert, no trades slip through

---

## Repo Structure

```
fractal-trading-v2/
├── README.md
├── CHANGELOG.md
├── node-specs/                    # Node specs (the .md files)
│   ├── 00-fractal-node-template.md
│   ├── 01-system-planet.md
│   └── 08-trading-planet.md
├── nodes/                         # Runtime implementations
│   ├── state-lake.js
│   ├── market-data-coast.js
│   ├── exchange-coast.js
│   ├── strategy-city-btc.js
│   ├── strategy-city-eth.js
│   ├── execution-city.js
│   ├── validation-forest.js
│   ├── trading-river.js
│   ├── analysis-ocean.js
│   └── trading-planet.js
├── lib/                           # Shared utilities
│   ├── ripple.js                  # Ripple class (payload, intensity, scent, trace)
│   ├── terrain.js                 # Terrain mechanics (absorption, overflow, routing)
│   ├── basin.js                   # Basin class (depth, saturation, fill, overflow)
│   ├── watershed.js               # Elevation-based routing logic
│   └── exchange-client.js         # Exchange API wrapper
├── config/
│   ├── trading.yaml               # Strategy configs, risk limits, assets
│   ├── terrain.yaml               # Terrain parameters (absorption rates, thresholds)
│   └── elevation.yaml             # Node elevations
├── scripts/
│   ├── seed.js                    # Create initial state, bootstrap system
│   ├── paper-trade.js             # Paper trading harness
│   └── validate.js                # Validation suite (fills, state, alerts)
├── tests/
│   ├── lake.test.js
│   ├── ocean.test.js
│   ├── forest.test.js
│   ├── city.test.js
│   ├── river.test.js
│   ├── coast.test.js
│   ├── planet.test.js
│   └── integration.test.js        # End-to-end DOGE ghost simulation
└── state/
    ├── canonical-state.json       # Lake's committed state (gitignored in prod)
    ├── decision-log.json          # Immutable audit log
    └── ocean-alerts.json          # Alert history
```

---

## Key Design Decisions (Locked)

1. **No DynamoDB in v2.** State lives in the Lake. Lake persists to local JSON files (simple, inspectable) or a lightweight DB (SQLite) if you need queries. No shared table. No peer writes. The Lake commits. Nobody else does.

2. **Ripple is the only communication pattern.** Nodes don't call functions on each other. They emit Ripples. The terrain decides what happens next. This makes the system observable — every interaction leaves a Ripple trace.

3. **Every node is independently testable.** A City node can be tested without a River. A Lake can be tested without a City. The Ripple interface is the contract.

4. **Paper trading is the only path to live capital.** No shortcuts. 2 weeks minimum. Every fill validated.

5. **Human is always in the loop.** Dashboard is read-only except for pause/resume. Risk limits are hard stops, not suggestions. Ocean alerts go to human, not just logs.

---

## What "Shut Down Old System" Means

| Asset | Action | Timeline |
|-------|--------|----------|
| **Cash** | Hold. No trades until v2 paper trading proves solid. | Immediately |
| **Existing positions** | Let them run to natural close or manually close. Don't open new positions. | Week 0 |
| **Old repo** | Archive. Read-only. Reference for logic extraction only. | Week 0 |
| **DynamoDB table** | Keep for 30 days as audit log, then delete. | Week 8+ |
| **api/cron.js** | Stop. All scheduling handled by v2 heartbeat-spring. | Week 0 |
| **Lessons learned** | Documented in this plan, in CHANGELOG, in every node spec. | Ongoing |

---

## The Reset Button

If at any point during rebuild you lose confidence:

| Week | Reset Option |
|------|-------------|
| 1-2 | Abandon v2, keep holding cash. v1 still runnable if you need it. |
| 3-4 | v1 positions should be closed by now. Hold cash, continue v2 build. |
| 5-6 | Paper trading. If results are bad, fix and re-paper-trade. No live capital at risk. |
| 7-8 | Go/no-go decision. If v2 doesn't pass validation criteria, hold cash and iterate. |

You never go back to v1. You either go forward with v2 or you hold cash and keep building.

---

## First File to Write

`state-lake.js` — The foundation. If the Lake is wrong, nothing else works.

It does three things:
1. Read positions from exchange
2. Write them to canonical state
3. Commit invalidations when told

Everything else grows from there.
