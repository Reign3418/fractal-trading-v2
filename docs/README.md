# Fractal Trading v2 — Architecture Documentation

> This directory contains the complete architecture specification, design decisions, and operational guides for the Fractal Trading v2 system.
>
> **Rule**: Code changes must be reflected in these docs. Docs drive the code, not the other way around.

---

## Core Architecture (Read These First)

| # | Document | What It Is | Read When |
|---|----------|-----------|-----------|
| 1 | [`00-fractal-node-template.md`](00-fractal-node-template.md) | **The spec.** Every node uses this 6-section template. Terrain types, Ripple mechanics, elevation routing, cell division. | You're adding any new node |
| 2 | [`01-system-planet.md`](01-system-planet.md) | **The root.** System Planet containing 5 continents (Core Lake, Analysis Ocean, Domain Cities, Coordination River, Frontier Coast). | You want to understand the full topology |
| 3 | [`08-trading-planet.md`](08-trading-planet.md) | **Proof of life.** Your trading system as a living planet — 11 child nodes across 6 terrains, the DOGE ghost fix, feedback ripples. | You want to see the architecture applied to trading |

## Design Decisions

| Document | What It Is | Read When |
|----------|-----------|-----------|
| [`TECH_STACK.md`](TECH_STACK.md) | Every tool choice and why. Node.js, TypeScript, Railway, Vercel, ccxt, SQLite, bull. | You're wondering "why this tool?" |
| [`TECH_SCOUT.md`](TECH_SCOUT.md) | The Atmosphere terrain — continuous intelligence watching the tech landscape. Scoring rubric, tiered scanning, manual + automated modes. | You want to stay ahead of tool obsolescence |
| [`MIGRATION_DECISION.md`](MIGRATION_DECISION.md) | Why we chose clean rebuild over Strangler Fig or surgical refactor. Decision matrix with your constraints. | You're explaining the rebuild to someone |
| [`REBUILD_PLAN.md`](REBUILD_PLAN.md) | 6-phase, 8-week roadmap. Week-by-week file list, go-live criteria, rollback strategy. | You're planning the build order |

## Node Registry

This table tracks every node in the system — its terrain, purpose, and file location.

| Node | Terrain | Purpose | File | Status |
|------|---------|---------|------|--------|
| **state-lake** | Lake | Sole state committer, ground truth | `src/nodes/state-lake.ts` | ✅ Live |
| **validation-forest** | Forest | Signal validation, liquidation triggers | `src/nodes/validation-forest.ts` | ✅ Live |
| trading-river | River | Scent-based routing between nodes | *not yet built* | 🔄 Planned |
| strategy-city-btc | City | BTC scalping strategy | *not yet built* | 🔄 Planned |
| strategy-city-eth | City | ETH swing strategy | *not yet built* | 🔄 Planned |
| execution-city | City | Order execution via exchange | *not yet built* | 🔄 Planned |
| analysis-ocean | Ocean | 5-detector monitoring swarm | *not yet built* | 🔄 Planned |
| market-data-coast | Coast | External market data ingress | *not yet built* | 🔄 Planned |
| exchange-coast | Coast | Trade execution egress | *not yet built* | 🔄 Planned |
| trading-planet | Planetary | Orchestrator + human dashboard | `src/server/api.ts` (partial) | 🔄 Partial |
| tech-scout-atmosphere | Atmosphere | Continuous tech intelligence | *not yet built* | 🔄 Planned |

## The Fractal Node 6-Section Template

Every node in this system uses the same structure:

```
# NODE: [Name]

## Terrain
[Terrain Type: ocean | river | lake | city | mountain | forest | coast | planetary]

## Inlets
[How ripples enter — rainfall, tributary, seepage, spring]

## Basin
[How ripples are held, absorbed, transformed]

## Outlets
[How ripples exit — overflow, spillway, evaporation, channel]

## Containment
[Sub-nodes contained by this node]

## Boundaries
[Capacity limits, overflow thresholds, circuit breakers]
```

## Terrain Absorption Reference

| Terrain | Absorption | Directionality | Use Case |
|---------|-----------|----------------|----------|
| Ocean | 80% | Low (spreads wide) | Analysis, monitoring |
| River | 10% | High (channels) | Routing, task dispatch |
| Lake | 50% | None (pools) | State commit, atomic ops |
| City | 5% | Moderate (many connections) | Domain processing |
| Mountain | 90% | Blocks | Error handling, circuit breakers |
| Forest | 40% | Filters | Validation, quality gates |
| Coast | 30% | Bidirectional | I/O, external interfaces |
| Planetary | 60% | Delegates | Root orchestration |
| Atmosphere | 20% | Wide scanning | Tech intelligence |

## Glossary

| Term | Definition |
|------|-----------|
| **Ripple** | The communication primitive — payload + intensity + scent + elevation |
| **Terrain** | How a node interacts with incoming Ripples (absorption rate) |
| **Basin** | A node's internal state — holds, absorbs, transforms Ripples |
| **Watershed** | Elevation-based routing — no central Gatekeeper |
| **Cell Division** | Splitting a node into parent + children when it grows too complex |
| **Confluence** | Merging nodes when their basins overflow into a shared parent |
| **Elevation** | Priority level — high = fast/urgent, low = slow/archival |
| **Saturation** | How full a Basin is — triggers overflow when threshold hit |
| **Overflow** | Ripples exiting a Basin that has reached capacity |

---

> **Version**: 2.0.0 | **Last Updated**: 2026-05-19 | **Status**: Active development
>
> These documents are living specifications. They evolve as the system evolves. The CHANGELOG in the project root tracks all document changes.
