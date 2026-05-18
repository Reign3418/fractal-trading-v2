import express from 'express';
import cors from 'cors';
import { StateLake } from '../nodes/state-lake';
import { ValidationForest } from '../nodes/validation-forest';
import { Watershed } from '../lib/watershed';

const app = express();
app.use(cors());
app.use(express.json());

// Mock exchange client for paper trading
const mockExchange = {
  async getPositions() {
    return {};
  },
  async getPrice(asset: string) {
    return 100;
  },
  async createOrder() {
    return { id: 'paper-' + Date.now() };
  },
};

// State store (in-memory for now)
const stateStore = {
  async save(state: any) {
    // persist to memory
  },
  async load() {
    return null;
  },
};

// Initialize watershed
const watershed = new Watershed();

// Initialize Lake
const lake = new StateLake({
  nodeName: 'state-lake',
  exchangeClient: mockExchange,
  stateStore,
});

// Initialize Forest
const forest = new ValidationForest({
  stateLake: lake,
  exchangeClient: mockExchange,
});

// Register nodes in watershed
watershed.register('state-lake', { elevation: 100, terrain: 'lake', handler: lake });
watershed.register('validation-forest', { elevation: 700, terrain: 'forest', handler: forest });

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    nodes: {
      'state-lake': { terrain: 'lake', elevation: 100 },
      'validation-forest': { terrain: 'forest', elevation: 700 },
    },
    basin: lake.getBasinSnapshot(),
  });
});

app.get('/api/state', (_req, res) => {
  res.json(lake.getState());
});

app.get('/api/positions', (_req, res) => {
  res.json(lake.getState().openPositions);
});

app.get('/api/decisions', (_req, res) => {
  res.json(lake.getDecisionLog(50));
});

app.post('/api/commit', async (req, res) => {
  const { event, asset, directiveId, position, directive } = req.body;

  if (event === 'POSITION_UPDATE' && asset && position) {
    lake.canonicalState.openPositions[asset] = { ...position, updatedAt: Date.now() };
    lake.canonicalState.lastCommit = Date.now();
  }

  if (event === 'LIQUIDATION_COMPLETE' && asset) {
    delete lake.canonicalState.openPositions[asset];
    if (directiveId && lake.canonicalState.directives[directiveId]) {
      lake.canonicalState.directives[directiveId].status = 'VOID';
      lake.canonicalState.directives[directiveId].invalidatedAt = Date.now();
    }
    lake.canonicalState.closedPositions.push({
      asset,
      closedAt: Date.now(),
      reason: 'liquidation',
      liquidatedBy: 'validation-forest',
    });
    lake.canonicalState.lastCommit = Date.now();
  }

  if (event === 'DIRECTIVE_CREATED' && directiveId && directive) {
    lake.canonicalState.directives[directiveId] = {
      ...directive,
      status: 'ACTIVE',
      createdAt: Date.now(),
    };
    lake.canonicalState.lastCommit = Date.now();
  }

  res.json({ committed: true, state: lake.getState() });
});

app.post('/api/ripple', async (req, res) => {
  const ripple = req.body;
  console.log('Ripple received:', ripple.type, 'from', ripple.source);

  if (ripple.target === 'state-lake') {
    await lake.receive(ripple);
  } else if (ripple.target === 'validation-forest') {
    await forest.receive(ripple);
  }

  res.json({ received: true, id: ripple.id });
});

// Serve dashboard in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dashboard/dist'));
  app.get('*', (_req, res) => {
    res.sendFile('dashboard/dist/index.html', { root: process.cwd() });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fractal Trading v2 on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;