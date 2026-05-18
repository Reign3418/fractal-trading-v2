# NODE: Trading Planet

**Parent:** [System Planet](../01-system-planet.md) — global governance node coordinating all planetary activity (Research, Trading, Operations, and any future domains).

**Terrain:** Planetary (container node — holds terrain, delegates processing, enforces boundaries)

**Ring MoE Heritage:** Direct descendant of `08-trading-analysis-ring.md`. All concepts — Gatekeeper ingress filtering, Hunt Protocol scent-matching, Analysis Ring monitoring, Core Ring state commitment — are preserved and reframed as terrain-based hydrology. What was "ring level" becomes "terrain type." What was "protocol" becomes "ripple behavior governed by absorption curves and elevation."

---

## Terrain

Trading Planet is a **specialized System Planet** for cryptocurrency trading. Not a generic framework, not a proof-of-concept — this is the user's live trading system, the architecture that moves capital, executes orders, validates positions, and reports to a human operator. Every child node maps to a real agent (Tank, NULL, CIPHER, Dozer) or a real infrastructure component (api/cron.js, the 5-detector analysis swarm).

The terrain is **Planetary** — a gravitational container that coordinates without doing. It does not process order books (Coast work), execute trades (City work), or validate signals (Forest work). It **orchestrates** — holding the topology registry, enforcing risk boundaries, and routing Ripples between terrains so the system behaves as a single organism.

Three defining properties:

1. **Gravitational pull:** All children orbit within the Planet's boundary envelope. Escaped Ripples fall back toward the Basin.
2. **Atmospheric filtering:** Baseline Gatekeeper on all incoming Ripples. Rainfall pre-filtered for relevance; Tributary checked for coherence.
3. **Magnetic alignment:** Canonical coordinate system — asset names, position IDs, exchange symbols — so every child speaks the same language.

---

## Inlets

### Rainfall — External Ingress

Uncontrolled, high-volume external data — the primary input making the system reactive to the market.

- **Price feeds** — Tick-by-tick or OHLCV candles from exchanges (Binance, Bybit, etc.). Absorption: immediate by Coast nodes. Saturation risk: high during volatile markets when thousands of ticks arrive per second.
- **Order book snapshots** — Depth-of-market data for spread calculation and slippage estimation. Absorption: batched by Coast; full book is too heavy for real-time Basin storage.
- **Exchange API status** — Maintenance windows, rate-limit warnings, withdrawal freezes. Absorption: high priority; these Ripples skip the normal queue and reach the Planet's Basin immediately.
- **Cron triggers** — Time-based events from the scheduler (api/cron.js). Absorption: precise; these Ripples carry a `scheduled_at` scent and are routed to the appropriate City or Ocean.
- **Human commands** — Manual overrides, emergency stops, parameter changes. Absorption: maximum priority; human Ripples override all queued Ripples and trigger an immediate Boundary check.

Rainfall enters through **Coast nodes** (`market-data-coast.md`, `exchange-coast.md`) performing first-pass Gatekeeper filtering. Bad data (stale ticks, malformed JSON, exchange errors) reflects as `SEEPAGE_BAD` — evaporating at the Coast.

### Tributary — Child Node Outputs

Controlled, structured output from Trading Planet's own child nodes. These Ripples carry the results of processing inside the Planet's containment. They are the **proof of life** of the system.

- **Strategy signals** — `BUY`, `SELL`, `HOLD`, `LIQUIDATE` directives from Tank (strategy cities). Absorption: medium; signals queue in the trading-river for sequencing.
- **Execution confirmations** — Fill reports, partial fills, rejected orders from NULL (execution-city). Absorption: high; these Ripples carry ground truth and route immediately to state-lake.
- **Validation reports** — `PASS`, `FAIL`, `OVERRIDE` from CIPHER (validation-forest). Absorption: high; validation is a blocking step — no signal proceeds without Forest clearance.
- **Analysis alerts** — Ghost detections, stale directive warnings, cross-agent inconsistency flags from the 5-detector Ocean swarm. Absorption: medium; alerts queue for human review unless they carry `CRITICAL` scent.
- **State commits** — Atomic snapshots of positions, balances, open orders from Dozer (state-lake). Absorption: maximum; state commits are the canonical truth and update the Planet's Basin registry immediately.

When a child node stops emitting Tributary, the Ocean's Lane Monitor detector flags a silence anomaly, and the Planet's Basin marks that node as potentially stalled.

### Seepage — Peer Planet Connections

Inter-planetary Ripple flow between Trading Planet and sibling planets under System Planet's governance. Currently conceptual; room for growth without rewrites.

- **Research Planet** — Could send `MODEL_UPDATE` Ripples with new strategy parameters. Absorption: low; model changes are rare and require human approval.
- **Operations Planet** — Could send `INFRASTRUCTURE_ALERT` Ripples about server health, disk space, API key rotation. Absorption: high; infrastructure issues threaten all trading activity.
- **Future planets** — Any new domain the user adds (portfolio management, tax reporting, social sentiment) connects via Seepage, not by rewriting Trading Planet.

Seepage uses the same Ripple protocol as internal Tributary but carries a `peer_origin` scent for routing and audit purposes.

### Spring — Self-Generated Ripples

Ripples that originate inside Trading Planet's own Basin — the Planet's autonomous heartbeat, not from external sources or child nodes.

- **Scheduled rebalancing** — At 00:00 UTC, the Basin emits a `REBALANCE` Ripple to all strategy cities, triggering position-size normalization.
- **Risk circuit check** — Every 60 seconds, the Basin emits a `RISK_PULSE` Ripple. If any child node does not respond with a status Tributary within 5 seconds, the Planet triggers Boundary saturation protocol.
- **Basin self-compaction** — When the Topology Registry exceeds 10,000 entries, the Basin emits a `COMPACT` Spring Ripple to state-lake, triggering archival of closed positions to the evaporation ledger.

---

## Basin

The Basin is Trading Planet's collective memory, risk consciousness, and coordination state — a **hydrological state** of all Ripples within the Planet's gravitational field.

### Trading Topology Registry

The Registry is the canonical map of all active trading activity:

| Field | Source | Update Trigger |
|-------|--------|----------------|
| Active strategies | Child city registration | Tributary from strategy-city-* |
| Monitored assets | Coast subscription list | Rainfall from market-data-coast |
| Open positions | Derived from state-lake commits | Tributary from state-lake |
| Pending orders | Derived from execution-city reports | Tributary from execution-city |
| Exchange connections | exchange-coast health checks | Rainfall from exchange-coast |

The Registry is **eventually consistent** — it absorbs Tributary Ripples asynchronously and maintains a `last_confirmed_at` timestamp per entry. The Ocean's Cross-Agent State detector monitors the gap between Registry state and Lake state; if the gap exceeds 3 cycles, it flags a sync anomaly.

### Risk State

- **Current exposure** — Sum of absolute notional position sizes across all assets. Updated on every state-lake commit.
- **Unrealized P&L** — Marked-to-market profit/loss. Updated on every price tick from Coast.
- **Drawdown from peak** — Maximum decline from highest equity watermark. Updated every 60 seconds by Spring Ripple.
- **Margin utilization** — Percentage of available margin consumed. Updated on every position change.
- **Concentration risk** — Largest single position as percentage of total exposure. Boundary: 40% triggers spillway alert.

### Human Dashboard

Read-only projection of Basin state:

- **Active positions** — Asset, size, entry, unrealized P&L, stop distance.
- **Strategy health grid** — Per-city: status (green/yellow/red), last signal, win rate, Sharpe.
- **System log stream** — Recent Ripples color-coded by terrain.
- **Alert panel** — Boundary breaches, Ocean anomalies, heartbeat status.

Human commands enter via Rainfall, never by writing to the Basin.

### Basin Dynamics

- **Depth:** High — holds 500+ positions, 50+ strategies, 24 hours of tick data references without archival.
- **Saturation:** Medium — fills rapidly during volatile markets; normal operation sits at 20-40%.
- **Overflow behavior:** When Basin exceeds 80% saturation, new strategy initialization Ripples divert to the Spillway (human approval queue). Existing positions continue; the Planet does not panic-close.
- **Compaction:** Every 6 hours, closed positions older than 24 hours evaporate to the ledger Channel. Triggered by Spring Ripple, not human action.

---

## Outlets

### Overflow — Delegated Processing

Primary outlet. Carries Ripples from the Planet's Basin to child nodes for specialized processing. The Planet receives heavy Rainfall (thousands of price ticks), absorbs metadata into the Basin, then Overflow sends targeted subsets to appropriate Cities.

Uses **elevation-based routing** — the Basin assigns each Ripple an elevation score (priority + urgency + origin terrain). High-elevation Ripples (execution commands, risk alerts) take fast River tributaries. Low-elevation (routine reports) batch on slower channels.

### Spillway — Human Alert on Emergency

Safety outlet that opens only when Boundary conditions are breached or unresolvable anomalies are detected. Spillway Ripples bypass all child nodes and go directly to the human.

- **Stop-loss breached** — Position hit stop; automatic close executed, human notified with context.
- **System error** — Child node crashed, API key invalid, exchange returned 5xx for >30 seconds.
- **Boundary exceeded** — Max position size breached, max concurrent strategies exceeded, saturation >80%.
- **Ocean CRITICAL alert** — Ghost position detected, cross-agent state mismatch unresolved after 3 retry cycles, stale directive >5 minutes old.

Spillway Ripples carry `SPILLWAY` scent and are immutable — only the human can clear a Spillway alert.

### Evaporation — Completed Trade Archival

Terminal state for completed-lifecycle Ripples. Trade Ripples flow Rainfall → River → City → Forest → Lake → Ocean → **evaporate** to the ledger. Contains: entry/exit, asset, direction, size, prices, fees, P&L, originating nodes. Irreversible; evaporated Ripples exist only in the ledger Channel.

### Channel — External Reporting Systems

One-way outlet sending processed, non-sensitive data to systems outside Trading Planet's containment:

- **Tax software** — Quarterly P&L summaries, realized gains/losses by asset.
- **Exchange reconciliation** — End-of-day position matching to verify Lake state equals exchange state.
- **Performance analytics** — Sharpe ratio, max drawdown, win rate, sent to external dashboard.
- **System health metrics** — Uptime, API latency, fill rate, sent to monitoring infrastructure (Grafana, Datadog, etc.).

If external system is down, Channel Ripples queue 5 minutes then evaporate with `CHANNEL_FAILED` note.

---

## Containment

Trading Planet contains 11 child nodes across 6 terrain types.

```
                      ┌─────────────────────────┐
                      │      SYSTEM PLANET      │
                      └───────────┬─────────────┘
                                  │ Seepage
                                  ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        TRADING PLANET                                  │
│                                                                        │
│  INLETS              BASIN                 OUTLETS                     │
│ ┌─────────┐    ┌────────────────┐      ┌───────────┐                 │
│ │ Rainfall│───▶│Topology Registry│────▶│ Overflow  │──▶ children     │
│ │ Tributary│    │Risk State      │      │ Spillway  │──▶ human        │
│ │ Spring  │    │Human Dashboard │      │Evaporation│──▶ ledger       │
│ └─────────┘    │Spring Heartbeat│      │ Channel   │──▶ reporting    │
│                └────────────────┘      └───────────┘                 │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────┐        │
│   │              CHILD TERRAIN MESH                          │        │
│   │  COAST          RIVER         CITY                       │        │
│   │  market-data-   trading-      strategy-city-btc (Tank)   │        │
│   │    coast.md     river.md      strategy-city-eth (Tank)   │        │
│   │  exchange-                    execution-city (NULL)        │        │
│   │    coast.md                                              │        │
│   │                                                          │        │
│   │  FOREST         LAKE          OCEAN                      │        │
│   │  validation-    state-lake    analysis-ocean             │        │
│   │    forest.md      (Dozer)       (5-detector swarm)       │        │
│   │    (CIPHER)                                              │        │
│   └──────────────────────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────────────────────┘
```

### Coast Nodes — External Boundary

Coast nodes sit at the edge of Trading Planet — the membrane between external market and internal system. Coast terrain has **selective permeability**: absorbs relevant external data, reflects everything else.

- **`market-data-coast.md`** — Ingests price feeds, order book snapshots, funding rate data, and exchange health status from external APIs. First-pass Gatekeeper: stale data (>5s old), malformed payloads, exchange maintenance pages, duplicate sequence IDs reflect as `SEEPAGE_BAD` and evaporate. Absorption: high for ticks (immediate), medium for order book (batched 100ms), low for funding rates (1-hour intervals). **User system link:** The API data ingestion layer — cron-scheduled fetch jobs that pull market data and push it into the processing pipeline.

- **`exchange-coast.md`** — Handles trade execution egress — order placement, modification, cancellation — and receives fill callbacks from exchanges. Internal Ripples must be formatted to exchange API specs before leaving the Planet. Failed validations (insufficient margin, invalid symbol, rate limit), duplicate order IDs, and 5xx responses are reflected. Absorption: high for order submissions (immediate with retry), medium for cancels, low for status queries (batched). **User system link:** NULL agent's bridge to the exchange — where execution directives become real API calls.

### River Nodes — Routing Channels

River nodes channel Ripples between other nodes. They do not transform data; they **route** it. River terrain has **directional flow** — Ripples enter at one elevation and exit at another, with sorting and sequencing.

- **`trading-river.md`** — Routes signals from strategy cities to execution city, with mandatory validation-forest filtering en route. Also carries state commits from lake to cities, and analysis alerts from ocean to all nodes. Flow pattern: (1) Strategy emits `SIGNAL` → River upstream inlet. (2) River channels to validation-forest (mandatory stop). (3) Forest emits `PASS` or `FAIL`. (4) PASS → execution-city; FAIL → strategy-city with `REJECTED` scent. (5) Execution-city emits `FILL` → River → state-lake (mandatory stop). (6) Lake emits `COMMIT` → River → confirmation back to originating strategy-city. **User system link:** The task routing logic in api/cron.js — the scheduler determining which agent processes which signal in what order.

### City Nodes — Dense Processing

City nodes are dense computational terrains. City terrain has **high absorption, slow processing, high-quality output.**

- **`strategy-city-btc.md`** — BTC-specific scalping strategy. Analyzes 15m and 1h timeframes, emits `BUY`/`SELL` signals based on breakout logic. High absorption for BTC price data, medium for correlated assets (ETH can inform BTC), low for unrelated assets. **User system link:** Tank agent's BTC strategy module.

- **`strategy-city-eth.md`** — ETH-specific swing strategy. Analyzes 1h and 4h timeframes, emits signals based on trend-following logic with wider stops. High absorption for ETH price data, medium for BTC correlation, low for altcoin noise. **User system link:** Tank agent's ETH strategy module.

- **`execution-city.md`** — NULL. Receives validated signals from trading-river, converts them to exchange orders, manages order lifecycle (submit → monitor → fill → report), handles partial fills and rejections. Maximum absorption for `PASS` signals from Forest, high for `CANCEL` directives, medium for `STATUS_QUERY` Spring Ripples. **User system link:** The NULL execution engine.

### Forest Nodes — Filtering and Validation

Forest nodes filter, validate, and gatekeep Ripples. Forest terrain has **frequency-selective absorption** — only Ripples with specific scents pass; others are absorbed (logged) or reflected (rejected).

- **`validation-forest.md`** — CIPHER. Validates all trade signals before execution, filters bad signals, enforces position limits, and can emit `LIQUIDATION` Ripples when positions must be closed. Four filter layers: (1) Syntactic check — is the signal well-formed? (symbol, side, size, price). (2) Risk check — would this exceed max position size or 80% margin utilization? (3) Semantic check — is the signal consistent with the strategy's stated logic? (4) Protocol 1 override — if tagged `P1_OVERRIDE`, skip checks 2-3 and emit immediate `PASS`. Medium absorption for `SIGNAL`, high for `LIQUIDATION`, maximum for `P1_OVERRIDE`. **User system link:** The CIPHER validation and liquidation engine.

### Lake Nodes — State Collection and Ground Truth

Lake nodes collect, store, and atomically commit state. Lake terrain has **deep absorption and slow, irreversible commitment.** Once a Ripple is absorbed by a Lake, it becomes canonical record.

- **`state-lake.md`** — Dozer. Maintains ground truth of all positions, balances, and open orders. Queries exchange APIs directly to verify state. Commit cycle: receive `FILL` → absorb into pending → query exchange for ground truth → if match: commit to canonical state, emit `COMMIT` Ripple → if mismatch: emit `MISMATCH` Ripple to Ocean and hold pending in suspense. Maximum absorption for `FILL` from execution-city, high for `STATUS_RESPONSE` from exchange-coast, medium for `HEARTBEAT` Spring Ripples. **User system link:** The Dozer ground-truth engine ensuring system state matches exchange state.

### Ocean Nodes — Wide Monitoring and Detection

Ocean nodes monitor wide areas with many concurrent detectors. Ocean terrain has **wide absorption, low per-Ripple depth, and swarm-based detection.**

- **`analysis-ocean.md`** — 5-detector swarm monitoring health, consistency, and correctness of all Ripples flowing through Trading Planet. The detectors: (1) **Ghost Mission Detector** — positions existing in strategy-city but not in Lake (or vice versa). (2) **Cross-Agent State Detector** — compares execution-city, validation-forest, and state-lake reports; flags discrepancies persisting beyond 3 cycles. (3) **Stale Directive Detector** — monitors outstanding signal age; flags if no `FILL` or `REJECTED` arrives within 5 minutes. (4) **Lane Monitor** — watches trading-river traffic volume; detects bottlenecks, queue buildup, and silence from nodes that should be active. (5) **Mission Lifecycle Detector** — tracks Ripples birth-to-death; ensures every `SIGNAL` produces `FILL`, `REJECTED`, or `EXPIRED`. Alert escalation: `INFO` → logged; `WARNING` → Dashboard highlight; `CRITICAL` → Spillway to human. **User system link:** The former Analysis Ring, reframed as an Ocean swarm with terrain-appropriate behavior.

---

## Boundaries

Trading Planet enforces six hard boundaries that prevent runaway behavior and protect capital:

1. **Max Concurrent Strategies: 10** — At boundary, new strategy initialization Ripples divert to Spillway for human approval; existing strategies continue. Rationale: coordination overhead exceeds Basin capacity beyond 10, degrading Ocean monitoring.
2. **Max Single Position Size: $X** — Configurable per-asset maximum notional (e.g., $50,000 BTC, $25,000 ETH). Forest emits `FAIL` for oversize signals; emits `LIQUIDATION` to trim positions grown beyond limit due to price movement. Rationale: prevents any single market move from disproportionately impacting the portfolio.
3. **Max Basin Saturation: 80%** — At boundary, pause new strategy initialization; existing positions continue; `RISK_PULSE` accelerates from 60s to 15s. Auto-resumes below 70%. Rationale: during extreme volatility, thousands of Ripples arrive simultaneously — saturation control preserves capacity for critical Ripples (liquidations, stop-losses, human commands).
4. **Cell Division Trigger: 500 Lines** — Oversized City splits: parent becomes coordinator, children handle signal generation, risk management, and position sizing. Ocean Lane Monitor verifies all children emit Tributary within 1 cycle. Rationale: system grows by cell division, not framework expansion. Each node stays small, focused, and replaceable.
5. **Mountain Terrain Trigger: >30% Signal Rejection** — Forest rejecting >30% from one strategy-city in 1 hour marks it `DEGRADED`; new signals held in River suspense for 5 minutes; Ocean emits `CRITICAL`; Spillway opens to human. Rationale: 30% wrong is noise, not strategy. Forest rejection rate is a proxy for city health.
6. **Emergency Stop** — Human `EMERGENCY_STOP` halts all cities, cancels open orders, commits final state, dumps trace log to Spillway, zeroes Basin. `RESUME` re-enables cities with 30-second stagger; Ocean verifies each is healthy before the next resumes. Rationale: the human is the ultimate Boundary. No automated system should prevent a human from stopping it.

---

## Proof of Life: The DOGE Ghost Fix

The DOGE ghost was a real failure mode: a position was liquidated by the exchange, but the system believed it was open. The strategy city kept emitting signals for a phantom position. The validation forest validated against stale state. The execution city tried to modify non-existent orders. The analysis ring detected the ghost but had no mechanism to kill it — no feedback path from detection to state correction.

The Fractal Node architecture fixes this through **terrain-mediated feedback loops.**

### Broken Flow — Ring MoE (No Feedback Path)

```
  strategy-city-btc emits SELL signal for DOGE
         │
         ▼
  trading-river channels to execution-city
         │
         ▼
  execution-city tries to execute (DOGE already liquidated)
         │
         ▼
  [NO RIPPLE SENT TO STATE-LAKE] ←── BREAK: no commit Ripple
         │
         ▼
  state-lake still shows DOGE position OPEN
         │
         ▼
  validation-forest sees position "open" x115 ticks
         │
         ▼
  analysis-ocean detects: "ghost — strategy says open, exchange says no"
         │
         ▼
  [NO PATH FROM OCEAN TO LAKE] ←── UNFIXABLE: ring hierarchy has no
                                     feedback channel

  RESULT: Ghost persists until human manually kills it.
          115 wasted cycles. Potential double-exposure.
```

**Why it broke:** Nodes organized by ring level (Gatekeeper → Analysis → Core), not by terrain behavior. Analysis Ring could *see* the ghost but had no authority to modify Core Ring state. No River to channel a correction Ripple from Ocean to Lake.

### Fixed Flow — Fractal Node (Terrain Feedback)

```
  Step 1: validation-forest (CIPHER) detects DOGE liquidation condition

               ┌─────────────────┐
               │ validation-     │  FOREST TERRAIN: high-pass filter.
               │    forest.md    │  The mismatch passes THROUGH as a
               │    (CIPHER)     │  new Ripple: LIQUIDATION.
               └────────┬────────┘
                        │
                        ▼ LIQUIDATION Ripple (passes through Forest)

  Step 2: trading-river channels to state-lake

               ┌─────────────────┐
               │  trading-river  │  RIVER TERRAIN: directional channel.
               │     .md         │  Routes LIQUIDATION to Lake,
               │                 │  bypassing execution-city (no need
               └────────┬────────┘  to re-execute a closed position).
                        │
                        ▼

  Step 3: state-lake (Dozer) absorbs Ripple, checks exchange ground truth

               ┌─────────────────┐
               │   state-lake    │  LAKE TERRAIN: deep absorption,
               │     .md         │  atomic commit. Lake absorbs
               │    (Dozer)      │  LIQUIDATION, queries exchange,
               │                 │  commits: "DOGE position REMOVED."
               │  "DOGE position  │
               │   REMOVED"      │
               └────────┬────────┘
                        │
                        ▼ LAKE OVERFLOW: committed state → River

  Step 4: trading-river broadcasts correction to all affected nodes

               ┌─────────────────┐
               │  trading-river  │  RIVER TERRAIN: broadcast channel.
               │     .md         │  Commit Ripple fans out to correct
               └────────┬────────┘  all stale state.
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼

  Step 5a: strategy-city      Step 5b: execution-city
           (Tank)                     (NULL)

      ┌──────────────┐           ┌──────────────┐
      │ strategy-city│           │ execution-   │
      │   (Tank)     │           │   city       │
      │              │           │   (NULL)     │
      │ Receives:    │           │ Receives:    │
      │ "Your DOGE   │           │ "Execution   │
      │  directive   │           │  COMPLETE"   │
      │  is VOID"    │           │              │
      │              │           │ Marks order  │
      │ Marks DOGE   │           │ COMPLETE,    │
      │ directive    │           │ stops        │
      │ VOID, skips  │           │ retrying.    │
      │ on next      │           │              │
      │ cycle.       │           │              │
      └──────────────┘           └──────────────┘
      Ghost exorcised.           Resource leak sealed.

  Step 6: analysis-ocean validates the correction chain

               ┌─────────────────┐
               │ analysis-ocean  │  OCEAN TERRAIN: wide monitoring.
               │  (5 detectors)  │  "Did all Ripples arrive within
               │                 │   1 cycle?"
               └────────┬────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        YES: All nodes agree NO: Missing Ripple
        DOGE is closed.         → CRITICAL alert
        Cross-Agent State       → Spillway → human
        Detector: VALIDATED.

  RESULT: Ghost eliminated in <5 seconds. No human required.
          If anything fails in the chain, human alerted immediately.
```

### Why the Fix Works — Terrain-by-Terrain

| Terrain | Role in Fix | Behavior |
|---------|-------------|----------|
| **Forest** | Detection + Pass-through | Detects mismatch. LIQUIDATION Ripple (rare, high-priority event) passes through without absorption. Not blocked, not filtered. |
| **River** | Channel + Broadcast | Receives LIQUIDATION Ripple, routes to Lake first (ground truth), then broadcasts commit to all stale Cities. Directional flow ensures correction reaches every node. |
| **Lake** | Absorption + Atomic Commit | Absorbs LIQUIDATION Ripple, queries exchange, atomically commits state change. Once Lake says "DOGE is closed," that is irreversible truth. |
| **City** | Dense correction | Each City receives corrected state and updates internal logic. Strategy voids stale directive; execution stops retrying. Slow-but-thorough ensures correct application. |
| **Ocean** | Validation monitoring | Watches the entire correction chain. Confirms every node acknowledged within 1 cycle. If not, CRITICAL alert opens Spillway. |
| **Planet** | Boundary enforcement | If same ghost recurs >3 times in 1 hour, triggers Mountain terrain trigger (Boundary #5) and pauses offending strategy city for human review. |

The fix is not a single mechanism. It is an **emergent property** of the terrain mesh — each terrain type contributes a behavior, and together they form a self-healing feedback loop that the old ring hierarchy could not create.

---

## References

- **Template:** [`00-fractal-node-template.md`](./00-fractal-node-template.md) — universal Node spec format, terrain glossary, and Ripple hydrology definitions that apply to all nodes in this architecture.
- **System Planet:** [`01-system-planet.md`](./01-system-planet.md) — how Trading Planet fits into the global Fractal Node architecture: its peer planets, governance contract with System Planet, and the Seepage protocol for inter-planetary communication.
- **Child Nodes:** Each child node listed in the Containment section is a first-class Node spec file in this directory. See individual files for their terrain-specific behavior, absorption curves, and boundary definitions.

---

*This Node spec is a living document. Trading Planet grows by cell division — child nodes split, new River channels form, new Forest layers emerge — not by expanding this file. The Planetary terrain remains the gravitational container; complexity lives in the terrain mesh.*
