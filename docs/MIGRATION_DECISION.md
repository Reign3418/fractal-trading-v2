# Trading Engine Migration Decision — Refactor vs. Rebuild

## The Honest Assessment

You have **three viable paths**, not two. And the answer depends on one variable: **how broken is your current system right now?**

| Path | When to Choose | Risk Level | Time to Full Migration |
|------|---------------|------------|---------------------|
| **A. Surgical Refactor** | System works, occasional ghosts, you want to fix root cause | Low | 2-3 weeks |
| **B. Strangler Fig Pattern** | System works, you want full Fractal Node architecture, can tolerate complexity | Medium | 4-6 weeks |
| **C. Clean Rebuild** | System is unreliable, you've been fighting fires, you want a reset | High (but honest) | 6-8 weeks |

---

## Path A: Surgical Refactor (Keep Engine, Add Feedback Loops)

### What You Do
Don't touch Tank, NULL, CIPHER, or Dozer logic. Don't change the cron schedule. Don't change DynamoDB schema.

**Add one thing:** A feedback loop.

1. **CIPHER** (already runs every 5m) — after it writes `MISSION ACCOMPLISHED`, it also writes a new DynamoDB entry: `invalidation:{directiveId}` with a 5-minute TTL.
2. **Tank** (already reads DynamoDB at start of cycle) — checks for `invalidation:{myDirectiveId}` before executing. If found, marks directive VOID, skips to fresh analysis.
3. **NULL** (same pattern) — checks for invalidation before executing trades.
4. **Done.**

### What This Fixes
- DOGE ghost dies within 5 minutes (next CIPHER cycle writes invalidation, next Tank cycle respects it)
- No new infrastructure
- No new agents
- No risk to live trades

### What This Doesn't Fix
- Tank and NULL still run every 3h (slow lane stays slow)
- No Analysis Ring (no ghost detection, no cross-agent validation)
- No Core Ring authority (Dozer is still a peer writer, not a committer)
- The system is still flat, not fractal

### Effort
- **1 file:** `invalidation.js` — 40 lines
- **2 lines changed** in Tank's start-of-cycle logic
- **2 lines changed** in NULL's start-of-cycle logic
- **3 lines added** to CIPHER's post-liquidation logic
- **Total:** 1-2 hours of focused work, deploy during a low-volatility window

---

## Path B: Strangler Fig Pattern (Gradual Fractal Node Adoption)

Named after the tree that grows around an existing tree, eventually replacing it. Your existing engine keeps running while Fractal Node nodes wrap around it.

### Phase 1: The Lake (Week 1)
- Create `state-lake.js` — a thin wrapper around Dozer
- Dozer still does its job (reads exchange, writes ground truth)
- `state-lake.js` adds one thing: a `commit()` function that writes to a new `canonical_state` DynamoDB table
- Existing table stays untouched
- **Safety:** Lake is read-only from the existing system's perspective. It writes to a table nothing else reads yet.

### Phase 2: The Ocean (Week 2)
- Create `analysis-ocean.js` — a read-only monitor
- It queries the existing DynamoDB table every 5 minutes (same cadence as CIPHER)
- It logs ghost detections, stale directives, cross-agent mismatches
- It does NOT act on them. Just logs.
- **Safety:** Read-only. Zero impact on trades.

### Phase 3: The Forest + River (Week 3)
- Create `validation-forest.js` — wraps CIPHER
- CIPHER still runs as before. Forest adds the feedback loop:
  - After CIPHER liquidates, Forest emits a Ripple to the Lake
  - Lake commits state
  - Lake writes invalidation to the canonical table
- Create `trading-river.js` — a lightweight router
  - Reads scent from Tank directives
  - Routes to the right strategy city (initially: just one city, your existing Tank)
  - Checks canonical table for invalidations before routing
- **Safety:** Existing Tank still runs. River is a parallel path. Tank can run with OR without the River.

### Phase 4: The Cities (Week 4)
- Create `strategy-city-btc.js` — wraps Tank logic
- Tank still exists. City calls Tank's `analyze()` function but adds:
  - Checks canonical state before analysis
  - Respects invalidations
  - Reports to River after execution
- Create `execution-city.js` — wraps NULL
- NULL still exists. City adds:
  - Checks canonical state before execution
  - Reports fills to Lake

### Phase 5: Coast + Evaporation (Week 5-6)
- Create `market-data-coast.js` — wraps exchange API ingress
- Create `exchange-coast.js` — wraps exchange API egress
- Add evaporation: completed trades archived to cold storage
- Add human dashboard: read-only view of Lake + Ocean
- **Safety:** Coast wraps existing API calls. If Coast fails, fallback to direct API.

### Phase 6: Remove Old Skeleton (Week 6+)
- Once all Fractal Node nodes are running and validated:
  - Deprecate direct DynamoDB writes from Tank/NULL
  - Redirect all traffic through River → City → Lake
  - Old `api/cron.js` becomes `trading-river.js` + `heartbeat-spring.js`
  - Existing DynamoDB table becomes read-only audit log

### What This Gets You
- Full Fractal Node architecture
- Live capital protected throughout (existing system runs until new system is validated)
- Every phase is rollback-capable
- Zero downtime migration

### What This Costs You
- 6 weeks of parallel systems (existing + new)
- Cognitive overhead of maintaining two architectures
- Risk of drift: new system evolves while old system still runs

---

## Path C: Clean Rebuild (Burn It Down, Start Fresh)

### What You Do
- Fork the existing repo
- Create a new branch: `fractal-node-v2`
- Build the full Fractal Node trading system from the `08-trading-planet.md` spec
- Paper trade for 2-4 weeks
- Switch over when paper trading proves reliable
- Keep old system as emergency fallback

### What This Gets You
- Clean slate, no legacy debt
- Fractal Node from day one
- No parallel system maintenance
- Every design decision is intentional

### What This Costs You
- 6-8 weeks before live trades resume
- Risk: the new system might have NEW bugs the old system didn't
- Risk: market conditions change during the rebuild
- Risk: you lose the "muscle memory" of the old system

---

## The Decision Matrix

| If this is true... | Choose Path |
|-------------------|-------------|
| DOGE ghost is your biggest pain; everything else works | **A** — Surgical refactor, 1-2 hours |
| You want the full Fractal Node vision; you have 4-6 weeks | **B** — Strangler Fig, gradual |
| Your system has 5+ bugs like DOGE ghost; you're exhausted | **C** — Clean rebuild, reset |
| You trade daily; can't afford 1 day of downtime | **A or B** |
| You trade weekly; can pause for a month | **B or C** |
| You're the only developer; no team | **A** (scope control) |
| You have a team; can parallelize | **B** (gradual adoption) |
| You're rebuilding anyway for other reasons | **C** (momentum) |

---

## My Recommendation (If You're Asking)

**Path B — Strangler Fig.**

Why:
- You have live capital. Path C is 6 weeks of no trading. That's real money left on the table.
- Path A fixes the ghost but doesn't give you the architecture you clearly want (you've been iterating toward Fractal Node for 3 rounds now).
- Path B gets you both: the ghost fix in Phase 3 (2-3 weeks), the full architecture by Phase 6.
- Every phase is safe. Every phase is rollback-capable.
- The trading-planet.md spec already tells you exactly what to build.

---

## What You Need to Build Next (For Path B)

| File | Purpose | Week |
|------|---------|------|
| `state-lake.js` | Dozer wrapper + canonical commit | 1 |
| `analysis-ocean.js` | Read-only monitor, 5 detectors | 2 |
| `validation-forest.js` | CIPHER wrapper + feedback ripples | 3 |
| `trading-river.js` | Router + invalidation checker | 3 |
| `strategy-city-btc.js` | Tank wrapper + canonical read | 4 |
| `execution-city.js` | NULL wrapper + canonical read | 4 |
| `market-data-coast.js` | Exchange ingress wrapper | 5 |
| `exchange-coast.js` | Exchange egress wrapper | 5 |
| `trading-planet.js` | Parent orchestrator + human dashboard | 5-6 |

Each file is 40-120 lines. Each is a wrapper around existing logic.

---

## One Final Truth

The DOGE ghost isn't a bug in your code. It's a bug in your **architecture** — you built a flat system where agents write to a shared table as peers. No one has commit authority. No one gets told when state changes.

Path A patches the symptom. Paths B and C fix the disease.

The question isn't "can I afford to migrate?" The question is "can I afford another DOGE ghost during a volatile market?"

A ghost during a 3% swing is annoying. A ghost during a 30% swing is expensive.
