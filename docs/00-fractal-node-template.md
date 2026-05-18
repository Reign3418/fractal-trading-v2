# Fractal Node Architecture: The Definitive Spec

> **Version**: 1.0  
> **Philosophy**: Every node, at every scale, uses the exact same 6-section template. A task node and a datacenter node are structurally identical — only the scale and terrain differ.  
> **Heritage**: Ring MoE (concentric rings + sparse activation) merged with geography-based topology (terrain, absorption, overflow, fractal nesting).

---

## Overview

Fractal Node replaces the fixed 5-ring hierarchy of Ring MoE with an infinite-depth, self-similar architecture. There are no special "core" nodes or "frontier" nodes — only **Nodes** with **Terrain**. A node processing a single prompt and a node routing across an entire cluster use the same structural template. The system scales from one node to one thousand through two fundamental operations: **Cell Division** (splitting) and **Confluence** (merging).

The key insight: **routing is emergent, not explicit.** There is no Gatekeeper entity. Ripples find their own path through elevation gradients — water finding downhill.

---

## Section 1: The Node Template

Every node in the system, without exception, follows this 6-section structure:

```markdown
# NODE: [Name]

## Terrain
[What this node does — capabilities, functions, processing logic]
[Terrain Type: Ocean | River | Lake | City | Mountain | Forest | Coast]

## Inlets
[How ripples enter this node — triggers, upstream, peers, parent]
[Inlet Types: Rainfall (external), Tributary (child output), Seepage (peer), Spring (self-generated)]

## Basin
[How ripples are held, absorbed, transformed — state, memory, processing queue]
[Basin Properties: Depth (max capacity), Saturation (current fill), Absorption Rate, Overflow Threshold]

## Outlets
[How ripples exit — downstream, to children, to peers, to parent]
[Outlet Types: Overflow (excess), Spillway (emergency), Evaporation (completion), Channel (directed)]

## Containment
[Sub-nodes — this node contains these child nodes. Each child is its own Node spec.]
[Format: `- [Child Name](child-file.md) — Terrain: X — Purpose: Y`]

## Boundaries
[What defines the edge — capacity limits, overflow thresholds, terrain transitions, circuit breakers]
```

### Why These Six Sections

| Section | Purpose | Analogy |
|---------|---------|---------|
| **Terrain** | Defines *what* this node does and *how* it processes | The ground type — determines interaction |
| **Inlets** | Defines *how* work arrives | Streams entering a watershed |
| **Basin** | Defines *how* work is held and transformed | Reservoir — capacity, current fill, drain rate |
| **Outlets** | Defines *where* work goes next | Outflow channels — controlled release |
| **Containment** | Defines nested child nodes | Sub-basins within a larger basin |
| **Boundaries** | Defines limits and protections | Dam walls, flood zones, capacity edges |

### Example: City vs. Lake

Both use the same 6 sections. The difference is Terrain — and therefore behavior.

**NODE: Inference-Engine (City)**
```
Terrain: City — Dense computation. Processes prompts through model layers.
  Absorption: 5%. Most intensity passes through as output tokens.
  Burst overflow under load. Creates new Ripples (token generation).

Inlets: Rainfall from API gateway. Tributary from preprocessing nodes.

Basin: Depth 1000 (concurrent requests). Saturation tracked in real-time.
  Absorption Rate: low — work flows through quickly.
  Overflow Threshold: 85% — triggers spillway to queue node.

Outlets: Overflow → Load-balancer (River). Evaporation → Token stream output.
  Spillway → Queue Lake when saturation > 85%.

Containment: None — leaf node. No children.

Boundaries: Max 1000 concurrent. Circuit breaker at 95% saturation.
  Mountain boundary on upstream — blocks flood Ripples.
```

**NODE: State-Commit (Lake)**
```
Terrain: Lake — State collection, atomic commit, overflow to parent.
  Absorption: 50%. Holds ripples until basin full or commit triggered.
  Threshold-triggered overflow — not gradual.

Inlets: Tributary from multiple City nodes. Seepage from peer Lakes.

Basin: Depth 500 (pending commits). Saturation fills until threshold.
  Absorption Rate: moderate — work accumulates.
  Overflow Threshold: 90% — triggers atomic commit, then drains.

Outlets: Overflow → Parent Ocean (commit batch). Evaporation → Ack signal.
  Channel → Direct commit to storage Mountain.

Containment: None — leaf node, but may become parent after Cell Division.

Boundaries: Hard depth limit 500. Transaction timeout: 30s.
```

The structural template is identical. The terrain type changes everything about how each node behaves — but nothing about how each node is specified.

---

## Section 2: Terrain Types Deep Dive

Terrain is the single most important property of a node. It determines absorption, directionality, overflow behavior, and routing patterns.

### Absorption Reference Table

| Terrain | Absorption | Directionality | Overflow | Use Case |
|---------|-----------|----------------|----------|----------|
| **Ocean** | High (~80%) | Low (spreads wide) | Gradual | Analysis, monitoring, wide scanning |
| **River** | Low (~10%) | High (channels flow) | Immediate | Coordination, routing, task dispatch |
| **Lake** | Moderate (~50%) | None (pools until full) | Threshold-triggered | State commit, collection, atomic operations |
| **City** | Low (~5%) | Moderate (many connections) | Burst | Domain processing, dense computation |
| **Mountain** | Blocks (~90% reflected) | Deflects | Rare | Error handling, circuit breakers, boundaries |
| **Forest** | Moderate (~40%) | Filters (only certain pass) | Seasonal | Validation, quality gates, pattern filtering |
| **Coast** | Moderate (~30%) | Bidirectional (in/out) | Tidal | Frontier, I/O, external interfaces |

### Ocean

Absorbs 80% of incoming ripple intensity. Ripples spread wide — low directionality. Overflow is gradual and continuous. The Ocean saturates slowly and holds vast capacity.

**ASCII: Ripple entering Ocean**
```
  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
  ~    [Ripple]         ~
  ~        |            ~
  ~     SPLASH          ~    80% absorbed into wide basin
  ~    /   \   \        ~    20% continues (diffused)
  ~   /     \    \      ~
  ~  /       \     \    ~
  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
     Terrain: OCEAN
     Spread: WIDE    Direction: LOW    Overflow: GRADUAL
```

**Use**: Drift detection, cross-domain analysis, monitoring, logging aggregation. The Ocean is where you send a Ripple when you want it examined from many angles — absorbed, reflected upon, and slowly processed. The Analysis Ring of Ring MoE maps directly to Ocean.

**Overflow behavior**: As saturation increases, overflow rate increases proportionally. No sharp threshold. An Ocean at 50% saturation spills 50% more than an Ocean at 25% saturation.

### River

Absorbs only 10%. Directionality is high — Ripples channel along defined paths. Overflow is immediate when capacity exceeded — water overtops banks instantly.

**ASCII: Ripple entering River**
```
    [Ripple] --> --> --> --> -->
        |                       \
    10% absorbed              90% channels forward
        |                         \
    [Basin]        >>>>>>>>>>>>>>>>>> [downstream]
    small, fast                 Terrain: RIVER
                                Direction: HIGH   Flow: IMMEDIATE
```

**Use**: Coordination, routing, task dispatch, message queues. The Coordination Ring maps to River. Rivers connect other terrains — they are the infrastructure between nodes. A River node should never do heavy processing; it should route.

**Overflow behavior**: Immediate. When a River's Basin (small by design) fills, excess Ripples overflow the banks immediately — there is no gradual buildup. This is by design: Rivers signal upstream to slow flow.

### Lake

Absorbs 50% but only while Basin has capacity. No directionality — Ripples pool. Overflow is threshold-triggered: nothing happens until a threshold is reached, then a large release occurs.

**ASCII: Ripple entering Lake**
```
        [Ripple]    [Ripple]    [Ripple]
            |           |           |
            v           v           v
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     ~  o  o  o  o  o  o  o  o    ~     50% absorbed per ripple
     ~                             ~
     ~      BASIN FILLING...       ~     Overflow: NONE (below threshold)
     ~                             ~
     ~  o  o  o  o  o  o  o  o  o  ~
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
              Terrain: LAKE
              Direction: NONE    Overflow: THRESHOLD-TRIGGERED
```

**Use**: State commit, atomic operations, batch collection, consensus. The Core Ring maps to Lake. Lakes collect until full, then release atomically. A Lake at 89% saturation does not overflow; at 91% it commits everything.

### City

Absorbs only 5%. Directionality is moderate — many connections. Overflow is burst-pattern — sudden spikes under load.

**Use**: Dense computation, domain processing, model inference, business logic. The Domain Ring maps to City. Cities are where work actually happens — they process intensely and produce new Ripples as output. A City node's Basin is small because work flows through quickly, but under load the Basin fills and bursts overflow to queueing systems.

### Mountain

Blocks 90% — reflects it back as error Ripples. Deflects rather than channels. Overflow is rare (only during extreme flood events).

**ASCII: Ripple hitting Mountain**
```
          [Ripple]  ====>    /\    ====>   [Reflected Ripple]
                           /  \              (error signal)
                          /    \
                         / Mtn  \    90% reflected as error
                        /________\   10% absorbed (audit log)
                        Terrain: MOUNTAIN
                        Role: BOUNDARY / CIRCUIT BREAKER
```

**Use**: Error handling, circuit breakers, access control, validation boundaries. Mountains protect downstream nodes. When a Ripple hits a Mountain, it bounces back with an error scent — the upstream node must handle it. Mountains are essential for system resilience.

### Forest

Absorbs 40%. Filters by scent — only Ripples matching certain patterns pass through. Overflow is seasonal — periodic cleanup releases accumulated material.

**Use**: Validation, quality gates, pattern filtering, feature flags. A Forest node examines each Ripple's scent and decides: absorb (process), pass through (matching), or drop (non-matching). Forests implement sparse activation — only relevant Ripples continue.

### Coast

Absorbs 30%. Bidirectional — Ripples flow both in and out. Overflow is tidal — rhythmic, predictable. Transforms format between external and internal representations.

**Use**: External interfaces, API boundaries, I/O adapters, frontier nodes. The Frontier Ring maps to Coast. Coasts sit at the edge of the system, translating between external protocols and internal Ripple formats. Every external request enters through a Coast; every external response exits through one.

---

## Section 3: Ripple Hydrology

A Ripple is the fundamental unit of work. It carries:

| Property | Type | Description |
|----------|------|-------------|
| `intensity` | float (0.0–1.0) | Energy level. Determines how far the Ripple travels. Decays per node visited. |
| `payload` | any | The actual data being carried. Opaque to the routing system. |
| `scent` | string[] | Routing signals. Determines which nodes will absorb/filter the Ripple. |
| `trace` | string[] | Path history. Every node appends its ID. Enables debugging and loops detection. |
| `elevation` | float | The elevation this Ripple was born at. Immutable. |

### The Full Hydrology Cycle

```
Rainfall        Inlet          Basin         Absorption/Overflow         Outlet        Evaporation
   |              |              |                   |                     |                |
   v              v              v                   v                     v                v
External    Ripple enters   Ripple held     Terrain absorbs        Ripple exits    Ripple marked
stimulus    node via        in Basin        portion, rest          node toward    complete,
            Inlet           (state,         overflows or           destination    removed from
                            memory,         channels out                            system
                            queue)          (terrain-depend)
```

### Inlets: How Ripples Enter

| Inlet Type | Source | Description |
|------------|--------|-------------|
| **Rainfall** | External | Originates outside the system. Enters through a Coast node. Every external request starts as Rainfall. |
| **Tributary** | Child node | Output from a child node flowing upward to parent. Child Basins overflow into parent Basins. |
| **Seepage** | Peer node | Lateral flow between nodes at the same elevation. Slow, low-volume. Used for state sharing. |
| **Spring** | Self-generated | The node itself creates a Ripple (e.g., scheduled job, heartbeat, timeout trigger). |

**Inlet selection** is determined by the source, not the destination. A node does not choose its Inlets; Ripples arrive through whatever channels exist.

### Basin Mechanics

The Basin has four measurable properties:

```
Basin State:
  Depth:        Maximum capacity (number of Ripples or total intensity)
  Saturation:   Current fill level (0% to 100%)
  Fill Rate:    How fast Ripples are arriving (Ripples/time)
  Drain Rate:   How fast the node processes (Ripples/time)
```

**Saturation dynamics:**
```
Saturation(t+1) = Saturation(t) + FillRate - DrainRate - OverflowRate

When Saturation + incoming > Depth:
  Overflow occurs
  OverflowAmount = Saturation + incoming - Depth
```

Different terrains handle overflow differently:

| Terrain | Overflow Behavior | Formula |
|---------|------------------|---------|
| Ocean | Gradual | OverflowRate = Saturation * 0.1 (continuous) |
| River | Immediate | If Saturation > Depth, all excess overflows instantly |
| Lake | Threshold | If Saturation > Threshold% * Depth, drain 100% |
| City | Burst | If Saturation > 80%, overflow spikes non-linearly |
| Mountain | Rare | Only at >99% saturation (flood event) |
| Forest | Seasonal | Periodic release of accumulated |
| Coast | Tidal | Rhythmic: inflow during high tide, outflow during low |

### Absorption by Terrain (Worked Example)

A Ripple with `intensity = 0.8` enters a node:

```
Ripple: { intensity: 0.8, payload: "analyze this", scent: ["analysis"] }

Entering OCEAN node:
  Absorbed: 0.8 * 0.80 = 0.64 intensity added to Basin
  Continues: 0.8 * 0.20 = 0.16 intensity Ripple forwarded downstream
  Result: Basin richer, weak Ripple continues

Entering CITY node:
  Absorbed: 0.8 * 0.05 = 0.04 intensity (token generation uses this)
  Continues: 0.8 * 0.95 = 0.76 intensity Ripple forwarded (nearly intact)
  Result: City does work, strong Ripple continues with results

Entering MOUNTAIN node:
  Absorbed: 0.8 * 0.90 = 0.72 intensity (blocked, logged as audit)
  Reflected: 0.8 * 0.10 = 0.08 intensity error Ripple back upstream
  Result: Ripple mostly stopped, error signal generated
```

### Outlets: How Ripples Exit

| Outlet Type | Destination | Trigger |
|-------------|-------------|---------|
| **Overflow** | Downstream node | Basin saturation exceeds capacity |
| **Spillway** | Emergency handler | Critical saturation (>95%) or error condition |
| **Evaporation** | Completion log | Ripple processing complete, intensity decays to 0 |
| **Channel** | Specific named node | Directed routing based on scent match |

**Evaporation** is the terminal state. A Ripple evaporates when:
- Its intensity decays below 0.01 (after traversing many nodes)
- It completes its purpose (e.g., a response is delivered)
- It is explicitly marked complete by a Lake commit

---

## Section 4: Elevation & Watershed Routing

### No Gatekeeper

Ring MoE had a Gatekeeper entity that decided which ring handled each Ripple. Fractal Node has no such entity. Routing is emergent from **elevation gradients**.

### Elevation

Every node has an elevation value (float, typically 0.0 to 1000.0):

| Elevation Range | Character | Use Case |
|-----------------|-----------|----------|
| 900–1000 | Fast, hot, urgent | Real-time processing, CIPHER, alerts |
| 700–900 | Active computation | Inference, domain logic |
| 400–700 | Coordination | Routing, load balancing, scheduling |
| 200–400 | Collection | State commit, batching, logging |
| 0–200 | Cold storage | Archival, audit, historical analysis |

**Elevation assignment rules:**
1. New nodes inherit parent elevation minus 100 (child is downhill from parent)
2. Peer nodes share the same elevation (lateral seepage possible)
3. Elevation can be adjusted dynamically based on load (thermal expansion: hot nodes rise)
4. No two sibling children should have the same elevation (ensures downhill routing)

### Watershed Logic

Ripples flow from higher elevation to lower elevation. At each node, the Ripple examines adjacent nodes (children, peers, parent) and flows to the lowest eligible neighbor.

```
Ripple at Node A (elevation 500):

  Neighbors:
    Child B: elevation 400  ← eligible (downhill)
    Child C: elevation 450  ← eligible (downhill)
    Peer D:  elevation 500  ← eligible (lateral, seepage only)
    Parent:  elevation 600  ← NOT eligible (uphill)

  Routing decision:
    1. Check scent match against all eligible neighbors
    2. Of scent-matching neighbors, select lowest elevation
    3. If multiple at same lowest elevation, load-balance
    
  Result: Ripple flows to Child B (elevation 400)
```

### Peer Seepage

Nodes at the same elevation can exchange Ripples laterally. This is **seepage** — slow, bidirectional, low-volume. Seepage is used for:
- State sharing between redundant nodes
- Load balancing between peers
- Gossip protocols

Seepage does not use intensity decay — Ripples maintain intensity during lateral movement. This distinguishes it from normal downhill routing where intensity decays per hop.

### Elevation Changes (Thermal Dynamics)

Under sustained load, a node may "heat up" and rise in elevation:

```
Load Factor = Saturation / Depth (0.0 to 1.0)

If Load Factor > 0.8 for > 60 seconds:
  Elevation += 50  (node rises — becomes "hotter")
  This may change routing: uphill neighbors become ineligible
  
If Load Factor < 0.2 for > 120 seconds:
  Elevation -= 25  (node cools — returns toward baseline)
  
Max deviation from baseline: +/- 200
```

Thermal dynamics prevent hotspots by naturally rerouting Ripples away from overloaded nodes.

---

## Section 5: Cell Division (Growing the System)

Cell Division is how a node splits into a parent with children. It is the primary scaling mechanism.

### When to Divide

A node should divide when any of these conditions are met:

| Trigger | Threshold | Rationale |
|---------|-----------|-----------|
| **Complexity** | > 5 distinct functions in Terrain | Single node doing too much — violates separation |
| **Saturation** | Basin at > 90% for > 5 minutes | Outgrowing capacity — needs distribution |
| **Containment** | Would need > 10 children | Flat list too large — needs intermediate layer |
| **Elevation span** | Handles elevations spanning > 300 | Too broad a range — needs specialization |

### Division Procedure

```
Step 1: Identify sub-functions in Terrain
  "This City node handles: auth, inference, tokenization, post-processing"
  → 4 distinct functions

Step 2: Create one child per function
  Parent: Inference-City — Terrain: City → becomes coordinator
  Child 1: Auth-Forest — Terrain: Forest (validation gate)
  Child 2: Inference-Engine — Terrain: City (dense computation)
  Child 3: Tokenizer-River — Terrain: River (fast transform)
  Child 4: PostProcessor-Lake — Terrain: Lake (batch commit)

Step 3: Distribute Basin properties
  Parent Basin depth: reduce to 20% (now a coordinator, not worker)
  Child Basin depths: inherit 80% of original, distributed by need

Step 4: Rewire Inlets and Outlets
  Parent Inlets: unchanged (still receives from upstream)
  Parent Outlets: now route to children, not external
  Child Inlets: Tributary from parent
  Child Outlets: Tributary to parent

Step 5: Assign elevations
  Parent: elevation unchanged
  Children: parent elevation - 100 each (staggered: -100, -120, -140, -160)

Step 6: Update Containment
  Parent now lists 4 children in Containment section
```

### ASCII: Before and After Cell Division

```
BEFORE: Single Node

  [Upstream] ==> [Inference-City (elevation 500)] ==> [Downstream]
                      Depth: 1000, Saturation: 95%
                      Functions: auth, inference, tokenize, post-process


AFTER: Parent + 4 Children (Cell Division)

  [Upstream] ==> [Inference-City (elevation 500)] ==> [Downstream]
                      Depth: 200 (coordinator only)
                      |
                      | Tributary Inlets
                      v
        +---------+---------+---------+
        |         |         |         |
   [Auth-Forest] [Inf-City] [Tok-River] [Post-Lake]
   elev: 400     elev: 380  elev: 360  elev: 340
   depth: 100    depth: 400 depth: 200 depth: 300
```

### Parent-Child Contracts

After division, parent and children have a contract:
- **Parent** receives Inlets, routes to appropriate child based on scent
- **Children** process work, return results via Tributary Outlets
- **Parent** aggregates child outputs, forwards to original Outlets
- **Children** never communicate directly with the parent's upstream — all flow goes through parent

### Scaling from 1 to 1000 Nodes

```
Level 0: 1 Root Node (Ocean) — elevation 1000
  Level 1: 3-5 children (Rivers) — elevation 800-900
    Level 2: 3-5 children each (Cities, Lakes) — elevation 600-800
      Level 3: 3-5 children each (Forests, Coasts) — elevation 400-600
        Level 4: leaf nodes (Cities, Mountains) — elevation 200-400

At 4 levels with branching factor 4: 1 + 4 + 16 + 64 + 256 = 341 nodes
At 5 levels with branching factor 5: 1 + 5 + 25 + 125 + 625 = 781 nodes
```

The system scales by repeating Cell Division at any node that grows too large. There is no central coordinator — each node decides independently when to divide.

---

## Section 6: Confluence (Merging Nodes)

Confluence is the inverse of Cell Division. When nodes are underutilized, they merge to reduce overhead.

### When to Merge

| Trigger | Threshold | Rationale |
|---------|-----------|-----------|
| **Underutilization** | Combined saturation < 30% for > 10 minutes | Wasted capacity — consolidate |
| **Simplification** | Children perform same function | Redundancy not needed |
| **Depth reduction** | Tree depth > 6 levels | Too deep — increases latency |

### Merge Procedure

```
Step 1: Identify candidates
  Two sibling Lake nodes, each at 20% saturation
  Both handle state commit for different model types

Step 2: Choose survivor
  Select the node with larger Basin (or simpler configuration)
  Other node becomes "absorbed"

Step 3: Combine Basins
  New Depth = survivor.Depth + absorbed.Depth * 0.5
  (not 100% — merged basin has some overhead)

Step 4: Merge Terrain
  If same terrain: keep it
  If different: parent terrain wins, or create hybrid Coast

Step 5: Rewire connections
  All Inlets from absorbed node → survivor
  All Outlets from absorbed node → survivor
  Update parent's Containment section

Step 6: Drain and decommission absorbed node
  Process remaining Ripples in absorbed Basin
  Redirect future Ripples to survivor
  Remove from parent Containment
```

### Basin Combination Rules

| Property | Combination Rule |
|----------|-----------------|
| Depth | `sum(depths) * 0.75` (25% efficiency gain from consolidation) |
| Current saturation | Weighted average of both |
| Absorption rate | Average of both, weighted by depth |
| Overflow threshold | Max of both thresholds |

---

## Section 7: Containment Patterns

Containment defines the tree structure. These are the validated patterns.

### Pattern A: Homogeneous Children

All children share the same terrain. Used for horizontal scaling.

```
NODE: Inference-Cluster
Terrain: Ocean (coordination, load distribution)
Containment:
  - [Worker-1](worker-1.md) — Terrain: City — Purpose: model shard A
  - [Worker-2](worker-2.md) — Terrain: City — Purpose: model shard B
  - [Worker-3](worker-3.md) — Terrain: City — Purpose: model shard C
  - [Worker-4](worker-4.md) — Terrain: City — Purpose: model shard D
```

All workers are Cities. Parent Ocean distributes Ripples to least-saturated worker. This is horizontal scaling of the same function.

### Pattern B: Heterogeneous Children

Children have different terrains. Used for pipeline processing.

```
NODE: Request-Pipeline
Terrain: River (coordination, flow control)
Containment:
  - [Auth-Gate](auth.md) — Terrain: Forest — Purpose: validate request
  - [Rate-Limiter](ratelimit.md) — Terrain: Mountain — Purpose: throttle if needed
  - [Processor](processor.md) — Terrain: City — Purpose: main computation
  - [Commit-Log](commit.md) — Terrain: Lake — Purpose: persist results
```

Ripples flow through the pipeline: Forest → Mountain → City → Lake. Each terrain performs its role. The parent River ensures ordered flow.

### Pattern C: Peer Adjacency via River

Two Cities connected by a River for load balancing.

```
NODE: Region-East
Terrain: Ocean
Containment:
  - [City-Alpha](alpha.md) — Terrain: City — Purpose: primary compute
  - [City-Beta](beta.md) — Terrain: City — Purpose: failover compute
  - [Link-River](link.md) — Terrain: River — Purpose: connect Alpha ↔ Beta
```

The River node enables seepage between Alpha and Beta. When Alpha saturates, excess Ripples flow through Link-River to Beta. This is lateral load balancing.

### ASCII: Full Containment Hierarchy Example

```
[Root: System-Ocean]  (elevation 1000)
    |
    +-- [Auth-Forest] (elevation 900) — Pattern: validation gate
    |       |
    |       +-- [OAuth-Coast] (elevation 800) — external auth
    |       +-- [APIKey-Mountain] (elevation 780) — key validation
    |
    +-- [Compute-River] (elevation 850) — Pattern: pipeline
    |       |
    |       +-- [Preprocess-Forest] (elevation 750)
    |       +-- [Inference-City] (elevation 700) — Pattern: homogeneous workers
    |       |       |
    |       |       +-- [GPU-Worker-1] (elevation 600)
    |       |       +-- [GPU-Worker-2] (elevation 580)
    |       |       +-- [GPU-Worker-3] (elevation 560)
    |       |
    |       +-- [Postprocess-Lake] (elevation 650)
    |
    +-- [Monitor-Ocean] (elevation 800) — Pattern: wide absorption
            |
            +-- [Metrics-Lake] (elevation 700)
            +-- [Alert-Mountain] (elevation 720)
```

### Depth Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| **Soft max** | 6 levels | Deeper trees increase routing latency |
| **Hard max** | 10 levels | Beyond this, elevation differences are too small |
| **Recommended** | 3–5 levels | Optimal for most workloads |

When a tree approaches the soft max, consider Confluence at other branches or restructuring.

---

## Section 8: Quick Reference

### Node Template Checklist

Before creating a node, confirm:

- [ ] Node has a clear, single-responsibility name
- [ ] Terrain is selected from the 7 types (not "custom")
- [ ] At least one Inlet is defined (Rainfall, Tributary, Seepage, or Spring)
- [ ] Basin has all four properties: Depth, Saturation, Absorption Rate, Overflow Threshold
- [ ] At least one Outlet is defined (Overflow, Spillway, Evaporation, or Channel)
- [ ] Containment is explicitly empty OR lists children with terrain and purpose
- [ ] Boundaries specify capacity limits and circuit breakers
- [ ] Elevation is assigned and does not conflict with siblings

### Terrain Selection Guide

| What you need | Terrain | Why |
|---------------|---------|-----|
| Analyze, scan, monitor | **Ocean** | Wide absorption, spreads Ripples across many angles |
| Route, coordinate, dispatch | **River** | High directionality, low absorption, fast throughput |
| Commit state, batch, atomic ops | **Lake** | Pools until threshold, then releases atomically |
| Compute, process, infer | **City** | Dense processing, burst overflow, many connections |
| Block, protect, error handle | **Mountain** | Reflects 90% back, circuit breaker behavior |
| Validate, filter, gate | **Forest** | Filters by scent, only matching Ripples pass |
| Interface externally | **Coast** | Bidirectional, format transformation, frontier |

### Elevation Assignment Cheat Sheet

```
Creating a child node:
  Child elevation = Parent elevation - 100 - (sibling_index * 20)
  Example: Parent at 500, 3 children → 400, 380, 360

Creating a peer node:
  Peer elevation = Same as existing peer (+/- 10 max)
  Example: Existing peer at 400 → new peer at 400

Thermal adjustment:
  Hot node (saturation > 80%): Elevation += 50
  Cool node (saturation < 20%): Elevation -= 25
  Max deviation from baseline: +/- 200
```

### Cell Division Checklist

Before dividing a node:

- [ ] Node has > 5 distinct functions OR saturation > 90% for 5+ minutes
- [ ] Child functions are clearly separable
- [ ] Parent will have 2–8 children (not 1, not > 10)
- [ ] Child elevations are planned (staggered by 20+)
- [ ] Parent Basin depth will be reduced to ~20%
- [ ] Parent Outlets will be rewired to children
- [ ] No child will have the same elevation as another
- [ ] Total tree depth after division will not exceed 6

---

## Appendix A: Ring MoE → Fractal Node Migration

| Ring MoE Concept | Fractal Node Equivalent | Notes |
|------------------|------------------------|-------|
| Core Ring | Lake terrain | Same function: state commit |
| Analysis Ring | Ocean terrain | Same function: wide analysis |
| Domain Ring | City terrain | Same function: dense processing |
| Coordination Ring | River terrain | Same function: routing |
| Frontier Ring | Coast terrain | Same function: external I/O |
| Gatekeeper | Watershed logic | Distributed, not an entity |
| Ring Fission | Cell Division | Same concept, formalized |
| Ring Fusion | Confluence | Same concept, formalized |
| Ripple | Ripple | Same concept, terrain mechanics added |
| Ripple Token | Ripple (full) | Payload + intensity + scent + trace |
| Hunt Protocol | Hydrology Cycle | Scent → Inlet → Basin → Overflow → Outlet → Evaporation |
| Sparse Activation | Terrain Filtering | Forest terrain absorbs non-matching Ripples |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Basin** | A node's holding capacity for Ripples — its memory, queue, or state store |
| **Cell Division** | Splitting one node into a parent with multiple children |
| **Confluence** | Merging multiple nodes into one |
| **Containment** | The sub-nodes held within a parent node |
| **Elevation** | A node's height in the system — determines routing direction |
| **Evaporation** | Terminal state of a Ripple — removed from the system |
| **Hydrology Cycle** | Complete Ripple lifecycle: entry → absorption → overflow → exit → completion |
| **Ripple** | Unit of work carrying intensity, payload, scent, and trace |
| **Saturation** | How full a Basin is (0% to 100%) |
| **Scent** | Routing signals in a Ripple that determine which nodes process it |
| **Seepage** | Lateral Ripple flow between peer nodes at the same elevation |
| **Terrain** | Node type determining absorption, directionality, and overflow behavior |
| **Thermal Dynamics** | Elevation changes based on sustained load |
| **Watershed** | Elevation-based routing where Ripples flow downhill |

---

*End of Fractal Node Architecture Spec v1.0*
