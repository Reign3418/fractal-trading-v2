# Fractal Trading v2 — Complete Build

> **Status**: Backend LIVE on Railway + Dashboard LIVE on Vercel  
> **Architecture**: Fractal Node (Ring MoE evolution)  
> **Terrain**: Lake (Core), Forest (Validation), River (Routing), City (Strategies)

---

## Quick Start

### 1. Download and Extract

Download `fractal-trading-v2-complete.zip` and extract to your project folder.

### 2. Install Backend

```bash
cd fractal-trading-v2-complete
npm install
npm run build
npm start
```

Server runs on `http://localhost:3000`

### 3. Install Dashboard (separate terminal)

```bash
cd dashboard
npm install
npm run dev
```

Dashboard runs on `http://localhost:5173`

---

## File Structure

```
fractal-trading-v2-complete/
├── package.json                  # Backend deps + scripts
├── tsconfig.json                 # TypeScript config
├── .gitignore                    # Ignores node_modules, dist, env
├── src/
│   ├── types/index.ts            # All TypeScript interfaces
│   ├── lib/
│   │   ├── ripple.ts             # Communication primitive
│   │   ├── basin.ts              # Terrain mechanics
│   │   └── watershed.ts          # Elevation routing
│   ├── nodes/
│   │   ├── state-lake.ts         # Core: state committer
│   │   └── validation-forest.ts  # Validation: filters + liquidations
│   └── server/
│       └── api.ts                # Express API (all routes)
├── dashboard/
│   ├── package.json              # Frontend deps
│   ├── vite.config.ts            # Vite config
│   ├── tsconfig.json             # Frontend TS config
│   ├── index.html                # HTML entry
│   └── src/
│       ├── main.tsx              # React entry
│       ├── App.tsx               # Complete dashboard
│       └── index.css             # Dark theme styles
├── tests/
│   └── doge-ghost.test.ts        # DOGE ghost simulation
└── README.md                     # This file
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health + node status |
| GET | `/api/state` | Full canonical state |
| GET | `/api/positions` | Open positions only |
| POST | `/api/commit` | Commit state change (create/liquidate/directive) |
| POST | `/api/ripple` | Receive Ripple from other nodes |

---

## Deployment

### Railway (Backend)
1. Push repo to GitHub
2. Connect Railway to repo
3. Set `NODE_ENV=production` and `PORT=3000`
4. Auto-deploys on push

### Vercel (Dashboard)
1. Push repo to GitHub
2. Import project on Vercel
3. Set **Root Directory**: `dashboard`
4. Add env var: `VITE_API_URL=https://YOUR_RAILWAY_URL`
5. Auto-deploys on push

---

## The DOGE Ghost Test

```bash
npm test
```

Validates that a liquidation invalidates the directive in **1 cycle**, not 3+ hours.

---

## What's Working Now

- ✅ Express API server
- ✅ Lake state committer
- ✅ Forest validation + liquidation
- ✅ Watershed routing
- ✅ Ripple communication
- ✅ Basin terrain mechanics
- ✅ Dashboard with live data
- ✅ Position create/liquidate
- ✅ Directive management
- ✅ DOGE ghost test

## What's Next

- 🔄 Trading River (routing)
- 🔄 Strategy City (actual trading logic)
- 🔄 Market Data Coast (exchange feeds)
- 🔄 Analysis Ocean (5-detector monitoring)
- 🔄 Paper trading mode
- 🔄 Live capital switch
