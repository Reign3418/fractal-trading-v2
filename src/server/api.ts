import express from 'express';
import cors from 'cors';
import { Ripple } from '../lib/ripple';
import { StateLake } from '../nodes/state-lake';
import { ValidationForest } from '../nodes/validation-forest';
import { Watershed } from '../lib/watershed';

const app = express();
app.use(cors());
app.use(express.json());

// ===================================================================
// MOCK EXCHANGE (tracks positions and prices for paper trading)
// ===================================================================
const mockExchange = {
  positions: {} as Record<string, { quantity: number; entryPrice: number; currentPrice: number }>,

  async getPositions() {
    return { ...this.positions };
  },

  async getPrice(asset: string) {
    return this.positions[asset]?.currentPrice || 0;
  },

  async createOrder(order: any) {
    if (order.side === 'sell' && this.positions[order.asset]) {
      delete this.positions[order.asset];
    }
    return { id: 'paper-' + Date.now(), status: 'filled' };
  },

  addPosition(asset: string, quantity: number, entryPrice: number) {
    this.positions[asset] = { quantity, entryPrice, currentPrice: entryPrice };
  },

  setPrice(asset: string, price: number) {
    if (this.positions[asset]) {
      this.positions[asset].currentPrice = price;
    }
  },

  reset() {
    this.positions = {};
  },
};

// ===================================================================
// STATE STORE
// ===================================================================
const stateStore = {
  data: null as any,
  async save(state: any) {
    this.data = JSON.parse(JSON.stringify(state));
  },
  async load() {
    return this.data;
  },
};

// ===================================================================
// WATERSHED (node registry + routing)
// ===================================================================
const watershed = new Watershed();

// ===================================================================
// NODES
// ===================================================================
const lake = new StateLake({
  nodeName: 'state-lake',
  exchangeClient: mockExchange,
  stateStore,
});

const forest = new ValidationForest({
  nodeName: 'validation-forest',
  stateLake: lake,
  exchangeClient: mockExchange,
});

watershed.register('state-lake', { elevation: 100, terrain: 'lake', handler: lake });
watershed.register('validation-forest', { elevation: 700, terrain: 'forest', handler: forest });

// ===================================================================
// RIPPLE ROUTER
// ===================================================================
async function routeRipple(ripple: Ripple): Promise<any> {
  console.log(`[WATERSHED] ${ripple.type} from ${ripple.source}`);
  const routes = watershed.route(ripple);
  for (const route of routes) {
    const { nodeName } = route;
    if (nodeName === 'state-lake') {
      await lake.receive(route.ripple);
    } else if (nodeName === 'validation-forest') {
      await forest.receive(route.ripple);
    }
  }
  return { routedTo: routes.map(r => r.nodeName) };
}

// ===================================================================
// API ROUTES
// ===================================================================

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    nodes: watershed.snapshot(),
    basin: lake.getBasinSnapshot(),
    forest: forest.getStats(),
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

// ===================================================================
// DIRECT COMMIT (for manual ops via dashboard)
// ===================================================================
app.post('/api/commit', async (req, res) => {
  const { event, asset, directiveId, position, directive } = req.body;

  if (event === 'POSITION_UPDATE' && asset && position) {
    lake.canonicalState.openPositions[asset] = {
      ...position,
      updatedAt: Date.now(),
    };
    // Sync mock exchange so Forest can see it
    mockExchange.addPosition(asset, position.quantity, position.entryPrice);
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

// ===================================================================
// RIPPLE ENDPOINT
// ===================================================================
app.post('/api/ripple', async (req, res) => {
  const ripple = new Ripple(req.body);
  const result = await routeRipple(ripple);
  res.json({ received: true, id: ripple.id, routed: result.routedTo });
});

// ===================================================================
// HEARTBEAT — Forest checks positions, commits liquidations directly
// ===================================================================
app.post('/api/heartbeat', async (_req, res) => {
  console.log('[API] Heartbeat — Forest liquidation check');

  // Forest detects stop-loss triggers
  const liquidations = await forest.checkLiquidations();

  // COMMIT liquidations directly (bypasses exchange validation)
  for (const liq of liquidations) {
    const asset = liq.payload.asset;
    const directiveId = liq.payload.directiveId;

    // Remove from open positions
    delete lake.canonicalState.openPositions[asset];

    // Void the directive
    if (directiveId && lake.canonicalState.directives[directiveId]) {
      lake.canonicalState.directives[directiveId].status = 'VOID';
      lake.canonicalState.directives[directiveId].invalidatedAt = Date.now();
    }

    // Log to closed positions
    lake.canonicalState.closedPositions.push({
      asset,
      closedAt: Date.now(),
      reason: 'stop_loss',
      liquidatedBy: 'validation-forest',
    });

    // Sync mock exchange
    delete mockExchange.positions[asset];

    lake.canonicalState.lastCommit = Date.now();
    lake.logDecision('LIQUIDATION', { asset, directiveId, price: liq.payload.exitPrice });
  }

  res.json({
    heartbeat: true,
    liquidationsDetected: liquidations.length,
    state: lake.getState(),
  });
});

// ===================================================================
// TEST HELPERS
// ===================================================================
app.post('/api/test/set-price', (req, res) => {
  const { asset, price } = req.body;
  mockExchange.setPrice(asset, price);
  res.json({ asset, priceSet: price, currentPrice: mockExchange.getPrice(asset) });
});

app.post('/api/test/reset', (_req, res) => {
  mockExchange.reset();
  res.json({ reset: true });
});

// ===================================================================
// DASHBOARD (production only)
// ===================================================================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dashboard/dist'));
  app.get('*', (_req, res) => {
    res.sendFile('dashboard/dist/index.html', { root: process.cwd() });
  });
}

// ===================================================================
// START
// ===================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fractal Trading v2 on port ${PORT}`);
  console.log(`Nodes: state-lake, validation-forest`);
});

export default app;
