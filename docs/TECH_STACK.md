# Fractal Trading Engine v2 — Tech Stack Decision

> **Status**: Architecture Decision | **Date**: 2026-05-19
> **Principle**: Choose tools that match terrain, not tools that are popular.

---

## The Terrain-Tool Mapping

| Fractal Node | What It Needs | Tool Choice | Why |
|-------------|--------------|-------------|-----|
| **Cities** (strategy + execution) | Fast async processing, real-time data | **Node.js + TypeScript** | Your existing code is JS. TypeScript catches errors before they cost money. Non-blocking I/O = many concurrent data streams. |
| **Coast** (exchange API) | Reliable exchange connectivity | **ccxt** | 100+ exchanges, unified API, handles auth + rate limiting. Your gateway to the outside world. |
| **Lake** (state) | Atomic commits, file-based simplicity | **SQLite** (now) → **PostgreSQL** (later) | File-based = simple, inspectable, git-friendly. Lake concept maps to a single DB file. Upgrade to Postgres when you need queries across history. |
| **Ocean** (analysis) | Log aggregation, pattern detection | **Built-in** (Analysis Ocean) → **InfluxDB** (later) | v2: Ocean is code — it reads state, detects patterns, alerts human. v3: Add InfluxDB if you want historical query of ocean data. |
| **Forest** (validation) | Real-time price data, rule engine | **ccxt** (price feeds) + **zod** (schema validation) | ccxt for live prices. zod for runtime type checking — catches malformed Ripples before they enter the system. |
| **River** (routing) | Fast in-memory routing, low latency | **Built-in** (Watershed class) + **Redis** (later) | v2: River is in-memory code — reads scent, routes Ripples. v3: Add Redis for cross-process River if you run nodes on multiple machines. |
| **Planet** (dashboard) | Human interface, read-only view | **React + TypeScript + Tailwind** | Component-based. Fast to build. The dashboard reads Lake state and Ocean alerts. |
| **Spring** (scheduler) | Cron jobs, heartbeat, rebalancing | **bull** (Redis job queue) | Reliable scheduling with retries. Handles the 5m CIPHER heartbeat, 3h Tank cycle. |
| **Evaporation** (archival) | Completed trade storage | **Local JSON files** (now) → **S3** (later) | Simple. Gitignored in prod. Upgrade to cloud storage when you need years of history. |

---

## Full Stack

### Backend Engine
```
Runtime:     Node.js 20+ LTS
Language:    TypeScript 5.0+
Exchange:    ccxt (npm: ccxt)
Validation:  zod (npm: zod)
Scheduling:  bull (npm: bull) + Redis (locally or Railway)
Database:    better-sqlite3 (npm: better-sqlite3)
Testing:     vitest (npm: vitest) — faster than Jest
```

### Frontend Dashboard
```
Framework:   React 18 + Vite (fast dev server)
Language:    TypeScript
Styling:     Tailwind CSS
Charts:      recharts (for P&L, position history)
State:       React Query (reads Lake state via API)
```

### Infrastructure
```
Code:        GitHub (private repo: fractal-trading-v2)
CI/CD:       GitHub Actions (test → build → deploy)
Backend:     Railway or Render (persistent server, not serverless)
Frontend:    Vercel (dashboard only — the trading engine runs on Railway)
Database:    SQLite file (stored on Railway persistent disk)
Redis:       Railway Redis or Upstash (for bull job queue)
Domain:      Your domain → Vercel frontend + Railway API
Alerts:      Discord webhook or Slack (Ocean pushes alerts here)
```

### Why NOT These

| Tool | Why Not | What Instead |
|------|---------|-------------|
| Python | You're already in JS land. Context switching costs time. | Node.js + TypeScript |
| Rust | Fastest runtime, but 3-4x dev time. Not worth it until you're doing HFT microsecond arbitrage. | Node.js (good enough for 5m cycles) |
| Vercel (backend) | Serverless functions sleep. Trading engine must run 24/7. | Railway (persistent process) |
| MongoDB | Overkill. You need structured relational data (positions, directives, fills). | SQLite → PostgreSQL |
| Kubernetes | You have 11 nodes, not 1100. Docker Compose on Railway is enough. | Railway native or Docker |
| Next.js (fullstack) | Too coupled. Backend trading engine should be separate from frontend dashboard. | React frontend + Express API backend |

---

## Repo Structure (Updated)

```
fractal-trading-v2/
├── README.md
├── package.json
├── tsconfig.json
├── docker-compose.yml          # SQLite + Redis for local dev
├── .github/
│   └── workflows/
│       └── ci.yml              # Test → Build → Deploy
│
├── src/
│   ├── lib/                    # Shared primitives
│   │   ├── ripple.ts           # Ripple class
│   │   ├── basin.ts            # Basin mechanics
│   │   ├── watershed.ts        # Elevation routing
│   │   └── terrain.ts          # Terrain constants (absorption rates)
│   │
│   ├── nodes/                  # Runtime implementations
│   │   ├── state-lake.ts
│   │   ├── validation-forest.ts
│   │   ├── strategy-city-btc.ts
│   │   ├── strategy-city-eth.ts
│   │   ├── execution-city.ts
│   │   ├── trading-river.ts
│   │   ├── market-data-coast.ts
│   │   ├── exchange-coast.ts
│   │   ├── analysis-ocean.ts
│   │   └── trading-planet.ts
│   │
│   ├── config/
│   │   ├── trading.yaml        # Strategies, assets, risk limits
│   │   ├── terrain.yaml        # Absorption rates, thresholds
│   │   └── elevation.yaml      # Node elevations
│   │
│   ├── exchange/
│   │   └── client.ts           # ccxt wrapper + auth
│   │
│   ├── state/
│   │   └── store.ts            # SQLite wrapper for Lake
│   │
│   ├── scheduler/
│   │   └── heartbeat.ts        # bull job definitions
│   │
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces (Ripple, Basin, Node, etc.)
│   │
│   └── server/
│       └── api.ts              # Express API for dashboard (read-only Lake + Ocean)
│
├── dashboard/                  # React frontend (separate)
│   ├── package.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── PositionTable.tsx
│   │   │   ├── PnlChart.tsx
│   │   │   ├── AlertFeed.tsx
│   │   │   ├── NodeStatus.tsx
│   │   │   └── KillSwitch.tsx
│   │   ├── hooks/
│   │   │   └── useLakeState.ts
│   │   └── App.tsx
│   └── vite.config.ts
│
├── tests/
│   ├── doge-ghost.test.ts
│   ├── lake.test.ts
│   ├── forest.test.ts
│   ├── ocean.test.ts
│   ├── river.test.ts
│   └── integration.test.ts
│
├── scripts/
│   ├── seed.ts                 # Bootstrap initial state
│   ├── paper-trade.ts          # Paper trading harness
│   └── deploy.ts               # Deployment helper
│
└── docs/                       # Node specs (from architecture)
    ├── 00-fractal-node-template.md
    ├── 01-system-planet.md
    ├── 08-trading-planet.md
    └── REBUILD_PLAN.md
```

---

## Deployment Architecture

```
                    ┌─────────────────┐
                    │   Human User    │
                    │  (Dashboard)    │
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │  Vercel (Edge)  │
                    │ React Dashboard │
                    │  Read-Only UI   │
                    └────────┬────────┘
                             │ API Calls (REST)
                    ┌────────▼────────┐
                    │  Railway (US)   │
                    │  Express API    │ ← serves Lake state + Ocean alerts
                    │                 │
                    │  ┌───────────┐  │
                    │  │  Heartbeat │  │ ← bull + Redis, fires nodes on schedule
                    │  │  Scheduler │  │
                    │  └───────────┘  │
                    │                 │
                    │  ┌───────────┐  │
                    │  │  Trading   │  │ ← 11 nodes running as persistent process
                    │  │  Engine    │  │
                    │  │  (Node.js) │  │
                    │  └───────────┘  │
                    │                 │
                    │  ┌───────────┐  │
                    │  │  SQLite   │  │ ← Lake canonical state
                    │  │  (Disk)   │  │
                    │  └───────────┘  │
                    └────────┬────────┘
                             │ WebSocket + REST
                    ┌────────▼────────┐
                    │  Exchange API   │
                    │  (ccxt unified) │
                    └─────────────────┘
```

### Why Railway + Vercel (not all Vercel)

| | Railway | Vercel |
|---|---|---|
| **Runtime model** | Persistent server (never sleeps) | Serverless functions (sleep between requests) |
| **Use case** | Trading engine that runs 24/7 | Dashboard that loads when human visits |
| **Database** | Persistent disk (SQLite file survives restarts) | Ephemeral filesystem (data lost on sleep) |
| **WebSocket** | Yes (for real-time market data) | No (serverless can't hold connections) |
| **Cost** | $5-20/month | Free tier (frontend only) |

**The trading engine never touches Vercel.** It's a persistent Node.js process on Railway. The dashboard is a static React app on Vercel that calls the Railway API.

---

## Local Development Setup

```bash
# 1. Clone and setup
git clone git@github.com:yourusername/fractal-trading-v2.git
cd fractal-trading-v2
npm install

# 2. Start infrastructure (SQLite + Redis)
docker-compose up -d  # SQLite volume + Redis for bull

# 3. Seed initial state
npm run seed

# 4. Run tests
npm test              # All unit tests
npm run test:ghost    # DOGE ghost simulation
npm run test:watch    # Watch mode during dev

# 5. Start engine (paper trading mode)
npm run paper-trade   # Runs all 11 nodes, no real orders

# 6. Start dashboard (separate terminal)
cd dashboard
npm install
npm run dev           # Vite dev server on localhost:5173
```

---

## The Cost

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Railway (backend) | $5-15 | Hobby plan, scales with usage |
| Railway (Redis) | $0-5 | Upstash has free tier |
| Vercel (frontend) | $0 | Free tier is enough |
| GitHub (code) | $0 | Private repo is free |
| Domain | $10-15/year | Optional |
| **Total** | **$5-20/month** | Compare to AWS: $50-200/month for same setup |

---

## Go-Live Checklist (Tech Stack)

- [ ] GitHub repo created, private
- [ ] Railway project created, connected to GitHub
- [ ] Vercel project created for dashboard
- [ ] Redis provisioned (Railway or Upstash)
- [ ] SQLite persistent disk mounted on Railway
- [ ] Environment variables configured (API keys, secrets)
- [ ] Discord webhook for Ocean alerts
- [ ] CI/CD pipeline: push to main → test → deploy
- [ ] Paper trading running for 2+ weeks
- [ ] Dashboard loads, shows real Lake state + Ocean alerts
