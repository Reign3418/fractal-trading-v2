import express from 'express';
import cors from 'cors';
import { Ripple } from '../lib/ripple';
import { StateLake } from '../nodes/state-lake';
import { ValidationForest } from '../nodes/validation-forest';
import { Watershed } from '../lib/watershed';

const app = express();
app.use(cors());
app.use(express.json());

// Mock exchange (tracks positions + prices)
const mockExchange = {
  positions: {} as Record<string, { quantity: number; entryPrice: number; currentPrice: number }>,
  async getPositions() { return { ...this.positions }; },
  async getPrice(asset: string) { return this.positions[asset]?.currentPrice || 0; },
  async createOrder(order: any) {
    if (order.side === 'sell') delete this.positions[order.asset];
    return { id: 'paper-' + Date.now(), status: 'filled' };
  },
  addPosition(asset: string, quantity: number, entryPrice: number) {
    this.positions[asset] = { quantity, entryPrice, currentPrice: entryPrice };
  },
  setPrice(asset: string, price: number) {
    if (this.positions[asset]) this.positions[asset].currentPrice = price;
  },
  reset() { this.positions = {}; },
};

const stateStore = {
  data: null as any,
  async save(state: any) { this.data = JSON.parse(JSON.stringify(state)); },
  async load() { return this.data; },
};

// Watershed
const watershed = new Watershed();

// Nodes
const lake = new StateLake({ nodeName: 'state-lake', exchangeClient: mockExchange, stateStore });
const forest = new ValidationForest({ nodeName: 'validation-forest', stateLake: lake, exchangeClient: mockExchange });

watershed.register('state-lake', { elevation: 100, terrain: 'lake', handler: lake });
watershed.register('validation-forest', { elevation: 700, terrain: 'forest', handler: forest });

// Ripple router
async function routeRipple(ripple: Ripple): Promise<any> {
  const routes = watershed.route(ripple);
  for (const route of routes) {
    const { nodeName, node, ripple: r } = route;
    if (nodeName === 'state-lake') await lake.receive(r);
    else if (nodeName === 'validation-forest') await forest.receive(r);
  }
  return { routedTo: routes.map(r => r.nodeName) };
}

// Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', nodes: watershed.snapshot(), basin: lake.getBasinSnapshot(), forest: forest.getStats() });
});

app.get('/api/state', (_req, res) => { res.json(lake.getState()); });
app.get('/api/positions', (_req, res) => { res.json(lake.getState().openPositions); });
app.get('/api/decisions', (_req, res) => { res.json(lake.getDecisionLog(50)); });

// Direct commit
app.post('/api/commit', async (req, res) => {
  const { event, asset, directiveId, position, directive } = req.body;
  if (event === 'POSITION_UPDATE' && asset && position) {
    lake.canonicalState.openPositions[asset] = { ...position, updatedAt: Date.now() };
    mockExchange.addPosition(asset, position.quantity, position.entryPrice);
    lake.canonicalState.lastCommit = Date.now();
  }
  if (event === 'LIQUIDATION_COMPLETE' && asset) {
    delete lake.canonicalState.openPositions[asset];
    if (directiveId && lake.canonicalState.directives[directiveId]) {
      lake.canonicalState.directives[directiveId].status = 'VOID';
      lake.canonicalState.directives[directiveId].invalidatedAt = Date.now();
    }
    lake.canonicalState.closedPositions.push({ asset, closedAt: Date.now(), reason: 'liquidation', liquidatedBy: 'validation-forest' });
    lake.canonicalState.lastCommit = Date.now();
  }
  if (event === 'DIRECTIVE_CREATED' && directiveId && directive) {
    lake.canonicalState.directives[directiveId] = { ...directive, status: 'ACTIVE', createdAt: Date.now() };
    lake.canonicalState.lastCommit = Date.now();
  }
  res.json({ committed: true, state: lake.getState() });
});

// Ripple endpoint — nodes communicate through here
app.post('/api/ripple', async (req, res) => {
  const ripple = new Ripple(req.body);
  const result = await routeRipple(ripple);
  res.json({ received: true, id: ripple.id, routed: result.routedTo });
});

// Heartbeat — triggers Forest liquidation check
app.post('/api/heartbeat', async (_req, res) => {
  const heartbeat = new Ripple({ source: 'trading-planet', target: 'validation-forest', type: 'HEARTBEAT', payload: { check: 'liquidations' }, scent: { type: 'state' }, intensity: 0.5, elevation: 900 });
  const liquidations = await forest.checkLiquidations();
  for (const liq of liquidations) { await routeRipple(liq); }
  res.json({ heartbeat: true, liquidationsDetected: liquidations.length, state: lake.getState() });
});

// Test helpers
app.post('/api/test/set-price', (req, res) => {
  const { asset, price } = req.body;
  mockExchange.setPrice(asset, price);
  res.json({ asset, price });
});

app.post('/api/test/reset', (_req, res) => {
  mockExchange.reset();
  res.json({ reset: true });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dashboard/dist'));
  app.get('*', (_req, res) => { res.sendFile('dashboard/dist/index.html', { root: process.cwd() }); });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fractal Trading v2 on port ${PORT}`);
  console.log(`Nodes: state-lake (lake), validation-forest (forest)`);
  console.log(`POST /api/heartbeat — trigger liquidation check`);
  console.log(`POST /api/ripple — route Ripple between nodes`);
});

export default app;
